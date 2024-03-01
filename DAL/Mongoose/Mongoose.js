'use strict';
const mongoose = require('mongoose');
const config = require('../../Config');
const apiCommonController = require("../../Utility/APICommonController");

function connectionwithmongoDB() {
    const fName = "mongoDB";
    const fPath = "/mongoDB";
    try {
        // Fetch and parse Mongo url
        const mongoDetails = JSON.parse(config.Mongo_URL);
        // Decrypt mongo connection string    
        const url = apiCommonController.databaseDecrypt(mongoDetails.url, mongoDetails.decKey);
        console.log(url);
        // Connect mongoose
        mongoose.connect(url, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }).then(() => {
            let fileName = fName + "Success"
            createLogs("Tour/Mongoose", fileName, fPath, JSON.stringify(mongoDetails), "Connected with database.")
            console.log("Connected with database");
        }).catch((error) => {
            //console.log("MongoError:", error);
            // handle error safely and add logs
            apiCommonController.getError(error, fName, fPath, JSON.stringify(mongoDetails));
            createLogs("Tour/Mongoose", fName, fPath, JSON.stringify(mongoDetails), "Database connection error.")
            return error
        });
    } catch (err) {
        console.log("MongoError::", err);
        // handle error safely and add logs
        apiCommonController.getError(err, fName, fPath, " ");
        return err
    }
}
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

module.exports = connectionwithmongoDB;
