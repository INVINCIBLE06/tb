'use strict'
const axios = require('axios')
const apiCommonController = require('../../../../Utility/APICommonController')
const config = require("../../../../Config");
const response = {
    // Get data from viator api.
    getCancelReasons:async (clientId, providerDetails, url, request) => {
        let fName = "CancelReasons_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CANCEL_REASONS_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            let apiResponse = await  axios.get(`${providerDetails.Viator_url}${url}`,
                // Header Parameter
                {
                    headers: {
                        'exp-api-key': providerDetails.Viator_apiKey,
                        "Accept-Language": "en-US",
                        "Accept": "application/json;version=2.0"
                    }
                })
            let fileName = fName + "Success";
            createLogs(url, fileName, fPath, request, apiResponse.data);
            return apiResponse.data;
        }
        catch (error) {
            console.log(error);
            let err;
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            };
            if (error.hasOwnProperty('response')) {
                console.log(error.response);
                err =  error.response.data;
            } 
            else {
                console.log(error.cause);
                err =  error.cause || error.message;
            }
            apiCommonController.getError(err, fName, fPath, request);
            return err || errorObj    
        }
    }
}

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

module.exports = response;