const express = require("express");
const router = express.Router();

const pavrica = require("../controllers/pavrica.controller");
router.use("/pavrica", pavrica);

module.exports = router;
