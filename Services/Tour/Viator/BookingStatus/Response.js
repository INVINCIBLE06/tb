"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");

const response = {
    // Get booking status response from viator 
    getBookingStatusApiReponse: async (clientId, providerDetails, booking) => {
        let fName = "Status_Check_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_STATUS_CHECK_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        let reqObject = {
            "bookingRef" : booking.bookingRef
        }
        try {
            const headers = {
                'exp-api-key': providerDetails.Viator_apiKey,
                "Accept-Language": "en-US",
                "Accept": "application/json;version=2.0"
            };
    
            const response = await axios.post(`${providerDetails.Viator_url}${booking.URL}`, reqObject, { headers });
            // Response send back to the user.
            const fileName = `${fName}Success`;
            createLogs(`${providerDetails.Viator_url}${booking.URL}`, fileName, fPath, JSON.stringify(reqObject), response.data);
            return response?.data;
        } catch (error) {
            const err = error?.response?.data ?? error?.cause ?? error;
            apiCommonController.getError(err, fName, fPath, JSON.stringify(reqObject));
            return err;
        }
    }

}

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

module.exports = response;