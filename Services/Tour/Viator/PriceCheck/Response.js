"use strict";
const axios = require("axios");
const apiCommonController = require("../../../../Utility/APICommonController.js");
const config = require("../../../../Config.js");

const response = {
    // Get Price check response from viator 
    getPriceCheckApiReponse: async (clientId, providerDetails, PriceCheckObject, requestObj, request) => {
        const fName = "priceCheck_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_PRICE_CHECK_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_VTR);

        try {
            return new Promise((resolve) => {
                axios.post(`${providerDetails.Viator_url}${PriceCheckObject.priceCheckUrl}`, {
                    // Required parameters.
                    "productCode" : requestObj.productCode,
                    "travelDate" : requestObj.travelDate,
                    "currency" : requestObj.currency || "GBP",
                    "paxMix" : requestObj.passengerDetails
                },
                    // Header Parameter
                {
                    headers: {
                        'exp-api-key': providerDetails.Viator_apiKey,
                        "Accept-Language": "en-US",
                        "Accept": "application/json;version=2.0"
                    }
                }).then((response) => {
                    request.body = requestObj;
                    // Response send back to user.
                    let fileName = fName + "Success"
                    createLogs(`${providerDetails.Viator_url}${PriceCheckObject.priceCheckUrl}`, fileName, fPath, request, response.data)
                    resolve(response.data);
                }).catch((error) => {
                    let err
                    if (error.hasOwnProperty('response')) {
                        console.log(error.response.data);
                        err = error.response.data;
                    } else {
                        console.log(error.cause);
                        err = error.cause;
                    }
                    apiCommonController.getError(err, fName, fPath, request);
                    resolve(err);
                });
            });
        } catch (err) {
            // Handle error safely and add logs
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": err.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, request);
            return errorObj;
        }
    }
}

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}


module.exports = response;