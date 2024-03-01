"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");

const response = {
    // Get availability/check response from viator 
    getAvailabilityApiReponse: async (clientId, providerDetails, availabilityObject, requestObj, request) => {

        let fName = "Availability_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_AVAILABILITY_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            const header = {
                headers: {
                    'exp-api-key': providerDetails.Viator_apiKey,
                    "Accept-Language": "en-US",
                    "Accept": "application/json;version=2.0"
                }
            };

            const [productDetails, availabilityDetails] = await Promise.all([
                axios.get(`${providerDetails.Viator_url}${availabilityObject.productDetailsUrl}`, header),
                axios.post(`${providerDetails.Viator_url}${availabilityObject.AvailabilityUrl}`, {
                    "productCode": requestObj.productCode,
                    "travelDate": requestObj.travelDate,
                    "currency": requestObj.currency,
                    "paxMix": requestObj.passengerDetails
                }, header)
            ]);

            if (productDetails?.data && availabilityDetails?.data) {
                const responseData = {
                    "productDetails": productDetails.data,
                    "AvailabilityDetails": availabilityDetails.data
                };

                let fileName = `${fName}Success`;
                createLogs(`${providerDetails.Viator_url}${availabilityObject.AvailabilityUrl}`, fileName, fPath, JSON.stringify(requestObj), responseData);
                return responseData;
            }
        } catch (error) {
            console.log(error);
            if (error?.response?.data) {
                handleErrorResponse(error.response.data, fName, fPath, requestObj);
                return error.response.data;
            } else {
                apiCommonController.getError(error.cause, fName, fPath, JSON.stringify(requestObj));
                return error.cause;
            }
        }
    
    }
}
// Common error handling function for this page.
function handleErrorResponse(data, fName, fPath, requestObj) {
    console.log(data);

    if (data.code === "BAD_REQUEST" || data.code === "NOT_FOUND") {
        const errorObj = {
            "message": data.message || "The passenger count is invalid."
        };
        apiCommonController.getError(errorObj, fName, fPath, JSON.stringify(requestObj));
    } else {
        apiCommonController.getError(data, fName, fPath, JSON.stringify(requestObj));
    }
}

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

module.exports = response;