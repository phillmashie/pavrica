const express = require("express");
const axios = require("axios");
const router = express.Router();
const storage = require("node-persist");
require("dotenv").config();

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

let accessToken = null;
let tokenExpirationTime = 0;

// Initialize storage
storage.initSync();

async function authenticateAndGetToken() {
  if (accessToken && Date.now() < tokenExpirationTime) {
    console.log("Reusing existing token.");
    return accessToken;
  }

  try {
    const credentials = await retrieveCredentialsFromDatabase();

    if (!credentials) {
      throw new Error("Credentials not found");
    }

    const authURL = process.env.SMARTCALL_PRODAUTH;
    const authHeader = getBasicAuthorizationHeader(
      credentials.smartricausername,
      credentials.smartricapassword
    );

    console.log("Fetching a new access token...");

    const authResponse = await axios.post(
      authURL,
      {},
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    console.log("Authentication Response: successful");

    accessToken = authResponse.data.accessToken;
    tokenExpirationTime = Date.now() + authResponse.data.expiresIn * 1000;

    // Store the token securely
    storage.setItemSync("accessToken", accessToken);
    storage.setItemSync("tokenExpirationTime", tokenExpirationTime);

    return accessToken;
  } catch (error) {
    console.error("Error fetching access token:", error);
    throw error;
  }
}

function getStoredToken() {
  return storage.getItemSync("accessToken");
}

function getStoredTokenExpirationTime() {
  return storage.getItemSync("tokenExpirationTime");
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

async function performRegistrationRequest(
  registrationURL,
  registrationRequest,
  token
) {
  try {
    const response = await axios.post(registrationURL, registrationRequest, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("Registration response received:", response.data);

    return response;
  } catch (error) {
    console.error("Error in registration request:", error);
    throw error;
  }
}

router.post("/smartrica", async (req, res) => {
  try {
    const storedToken = getStoredToken();
    const storedTokenExpirationTime = getStoredTokenExpirationTime();

    if (storedToken && Date.now() < storedTokenExpirationTime) {
      accessToken = storedToken;
      tokenExpirationTime = storedTokenExpirationTime;
      console.log("Using stored token.");
    } else {
      accessToken = await authenticateAndGetToken();
    }

    const registrationURLs = [
      process.env.SMARTCALL_PRODRICAREGENV1,
      process.env.SMARTCALL_PRODRICAREGENV2,
    ];

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

    if (
      registrationRequest.idDetails.idType === "passport" &&
      !registrationRequest.idDetails.passportExpiryDate
    ) {
      return res.status(400).json({
        error: "Validation error: No passport expiry date provided",
        code: 1010,
      });
    }

    let registrationResponse = null;

    for (const url of registrationURLs) {
      try {
        registrationResponse = await performRegistrationRequest(
          url,
          registrationRequest,
          accessToken
        );
        if (registrationResponse.data.responseCode === "Success") {
          break;
        }
      } catch (error) {
        console.error(`Failed registration attempt for ${url}`);
      }
    }

    if (
      !registrationResponse ||
      registrationResponse.data.responseCode !== "Success"
    ) {
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
