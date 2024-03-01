"use strict";
const axios = require("axios");
const mssql = require("mssql");
const config = require("../../Config");
const NodeCache = require("node-cache");
const dbCredCache = new NodeCache({ stdTTL: 86400 });
const apiCommonController = require("../../Utility/APICommonController");
const registrationSchema = require("../Mongo/Schemas/InitializationSchema");

module.exports = {

}
