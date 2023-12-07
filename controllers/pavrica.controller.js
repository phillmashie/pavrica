const express = require("express");
const axios = require("axios");
const router = express.Router();

const connection = require("../pavricadb/pavricadb");

class IdDetails {
  constructor(idNumber, idType, passportExpiryDate, idNationality) {
    this.idNumber = idNumber;
    this.idType = idType;
    this.passportExpiryDate = passportExpiryDate;
    this.idNationality = idNationality;
  }
}

class AddressDetails {
  constructor(address1, address2, address3, postalCode, country) {
    this.address1 = address1;
    this.address2 = address2;
    this.address3 = address3;
    this.postalCode = postalCode;
    this.country = country;
  }
}

class Country {
  constructor(countryCode) {
    this.countryCode = countryCode;
  }
}

class Network {
  constructor(id) {
    this.id = id;
  }
}

// ... Other classes and functions ...

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
    throw error;
  }
}

async function saveRicaDetailsToDatabase(ricaData) {
  try {
    await connection.query(
      'INSERT INTO pavrica.tblpavrica ("responseCode", "ricaReference", "agentId", "firstName", surname, "idDetails", "registrationType", "subscriberId", "last4Iccid", "residentialAddress", "previousIdNumber", "previousIdType", network, "businessOwnerIdDetails", "altContactNumber", "ricaDate") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)',
      [
        ricaData.responseCode,
        ricaData.ricaReference,
        ricaData.agentId,
        ricaData.firstName,
        ricaData.surname,
        JSON.stringify(ricaData.idDetails),
        ricaData.registrationType,
        ricaData.subscriberId,
        ricaData.last4Iccid,
        JSON.stringify(ricaData.residentialAddress),
        ricaData.previousIdNumber,
        ricaData.previousIdType,
        JSON.stringify(ricaData.network),
        JSON.stringify(ricaData.businessOwnerIdDetails),
        ricaData.altContactNumber,
        new Date(),
      ]
    );
  } catch (error) {
    console.error("Error saving RICA details:", error);
    throw error;
  }
}

router.post("/smartrica", async (req, res) => {
  try {
    const credentials = await retrieveCredentialsFromDatabase();

    if (!credentials) {
      return res.status(500).json({ error: "Credentials not found" });
    }

    const authURL = "https://test.smartcall.co.za:8101/webservice/auth";
    const authHeader = getBasicAuthorizationHeader(
      credentials.smartricausername,
      credentials.smartricapassword
    );

    console.log("Sending authentication request...");

    const authResponse = await axios.post(
      authURL,
      {},
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    console.log("Authentication Test Response: successful");

    console.log("Sending registration request...");

    const registrationURL =
      "https://test.smartcall.co.za:8101/webservice/smartrica/registrations";

    const registrationRequest = {
      agentId: req.body.agentId,
      firstName: req.body.firstName,
      surname: req.body.surname,
      idDetails: new IdDetails(
        req.body.idDetails.idNumber,
        req.body.idDetails.idType,
        req.body.idDetails.passportExpiryDate,
        req.body.idDetails.idNationality
      ),
      registrationType: req.body.registrationType,
      subscriberId: req.body.subscriberId,
      last4Iccid: req.body.last4Iccid,
      residentialAddress: new AddressDetails(
        req.body.residentialAddress.address1,
        req.body.residentialAddress.address2,
        req.body.residentialAddress.address3,
        req.body.residentialAddress.postalCode,
        new Country(req.body.residentialAddress.country)
      ),
      previousIdNumber: req.body.previousIdNumber,
      previousIdType: req.body.previousIdType,
      network: new Network(req.body.network.id),
      businessOwnerIdDetails: req.body.businessOwnerIdDetails,
      altContactNumber: req.body.altContactNumber,
    };

    // Add a check for passport idType and validate the passportExpiryDate
    if (
      registrationRequest.idDetails.idType === "passport" &&
      !registrationRequest.idDetails.passportExpiryDate
    ) {
      return res.status(400).json({
        error: "Validation error: No passport expiry date provided",
        code: 1010,
      });
    }

    // If the check passes, proceed with the registration request
    const registrationResponse = await axios.post(
      registrationURL,
      registrationRequest,
      {
        headers: {
          Authorization: `Bearer ${authResponse.data.accessToken}`,
        },
      }
    );

    console.log("Registration response received:", registrationResponse.data);

    if (registrationResponse.data.responseCode !== "Success") {
      return res.status(400).json({ error: "SmartRICA registration failed" });
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
