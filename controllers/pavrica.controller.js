const express = require("express");
const axios = require("axios");
const router = express.Router();

const connection = require("../pavricadb/pavricadb");

function getBasicAuthorizationHeader(username, password) {
  const authString = `${username}:${password}`;
  const base64AuthString = Buffer.from(authString).toString("base64");
  return `Basic ${base64AuthString}`;
}

async function retrieveCredentialsFromDatabase() {
  try {
    const queryResult = await connection.query(
      "SELECT smartricausername, smartricapassword FROM pavrica.tblpavricacredentials WHERE id = 1"
    );
    return queryResult.rows[0];
  } catch (error) {
    console.error("Error retrieving credentials:", error);
    return null;
  }
}

async function saveRicaDetailsToDatabase(ricaData) {
  try {
    await connection.query(
      "INSERT INTO pavrica.tblpavrica (responseCode, ricaReference, agentId, firstName, surname, idDetails, registrationType, subscriberId, last4Iccid, residentialAddress, previousIdNumber, previousIdType, network, businessOwnerIdDetails, altContactNumber, ricaDate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)",
      [
        ricaData.responseCode,
        ricaData.ricaReference,
        ricaData.agentId,
        ricaData.firstName,
        ricaData.surname,
        ricaData.idDetails,
        ricaData.registrationType,
        ricaData.subscriberId,
        ricaData.last4Iccid,
        ricaData.residentialAddress,
        ricaData.previousIdNumber,
        ricaData.previousIdType,
        ricaData.network,
        ricaData.businessOwnerIdDetails,
        ricaData.altContactNumber,
        new Date(),
      ]
    );
  } catch (error) {
    console.error("Error saving RICA details:", error);
  }
}

router.post("/smartrica", async (req, res) => {
  try {
    const credentials = await retrieveCredentialsFromDatabase();

    if (!credentials) {
      return res.status(500).json({ error: "Credentials not found" });
    }

    const authHeader = getBasicAuthorizationHeader(
      credentials.smartricausername,
      credentials.smartricapassword
    );

    const [authResponse, registrationResponse] = await Promise.all([
      axios.post(
        "https://test.smartcall.co.za:8101/webservice/auth",
        {},
        {
          headers: {
            Authorization: authHeader,
          },
        }
      ),
      axios.post(
        "https://test.smartcall.co.za:8101/webservice/smartrica/registration",
        req.body,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      ),
    ]);

    if (authResponse.data.responseCode !== "Success") {
      return res.status(500).json({ error: "Authentication failed" });
    }

    if (registrationResponse.data.responseCode !== "Success") {
      return res.status(500).json({ error: "SmartRICA registration failed" });
    }

    const ricaData = {
      ...req.body,
      responseCode: registrationResponse.data.responseCode,
      ricaReference: registrationResponse.data.ricaReference,
    };

    await saveRicaDetailsToDatabase(ricaData);

    return res.status(200).json({
      success: true,
      message: "RICA customer registered successfully",
      ricaReference: ricaData.ricaReference,
      ricadate: new Date(),
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "An error occurred" });
  }
});

module.exports = router;

// https://test.smartcall.co.za:8101/webservice/smartrica/registration
// https://test.smartcall.co.za:8101/webservice/auth
