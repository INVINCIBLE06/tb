"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");

const response = {
    // Get search/productcode response from viator 
    getCancelQuoteApiReponse: async (clientId, providerDetails, cancelQuote, request) => {
        let fName = "Cancel_Quote_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CANCEL_BOOKING_PROVIDER_CANCEL_QUOTE_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            const headers = {
                'exp-api-key': providerDetails.Viator_apiKey,
                "Accept-Language": "en-US",
                "Accept": "application/json;version=2.0"
            };
    
            const response = await axios.get(`${providerDetails.Viator_url}${cancelQuote.URL}`, { headers });
    
            const fileName = `${fName}Success`;
            createLogs(`${providerDetails.Viator_url}${cancelQuote.URL}`, fileName, fPath, request, response.data);

            return response.data;
        } catch (error) {
            const errorData = error?.response?.data ?? error?.cause ?? error;
            apiCommonController.getError(errorData, fName, fPath, request);
            return errorData;           
        }
    },

     // get cancelBooking reasons
    getCancelReasons: async (clientId, providerDetails, url, request)=>{
        const fName = "Cancel_Reasons_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CANCEL_REASONS_PROVIDER_CANCEL_REASONS_FILE_PATH, config.Provider_Code_VTR);
        try{
            const headers = {
                'exp-api-key': providerDetails.Viator_apiKey,
                "Accept-Language": "en-US",
                "Accept": "application/json;version=2.0"
            };
    
            const response = await axios.get(`${providerDetails.Viator_url}${url}`, { headers });
    
            const fileName = `${fName}Success`;
            createLogs(`${providerDetails.Viator_url}${url}`, fileName, fPath, request, response.data);
    
            return response.data;
        }
        catch(error){
            const errorData = error?.response?.data ?? error?.cause ?? error;
            apiCommonController.getError(errorData, fName, fPath, request);
            return errorData;        
        }

    },

    // Confirm cancel booking
    getConfirmCancelResponse : async(clientId, providerDetails, cancelObj, request)=>{
        let fName = "Cancel_Booking_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CANCEL_BOOKING_PROVIDER_CANCEL_BOOKING_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            const headers = {
                'exp-api-key': providerDetails.Viator_apiKey,
                "Accept-Language": "en-US",
                "Accept": "application/json;version=2.0"
            };
    
            const response = await axios.post(`${providerDetails.Viator_url}${cancelObj.URL}`, {
                "reasonCode": cancelObj.reasonCode
            }, { headers });
    
            // Response send back to user.
            request.body = "";
            const fileName = `${fName}Success`;
            createLogs(`${providerDetails.Viator_url}${cancelObj.URL}`, fileName, fPath, request, response.data);
    
            return response.data;
        } catch (error) {
            const errorData = error?.response?.data ?? error?.cause ?? error;
            apiCommonController.getError(errorData, fName, fPath, request);
            return errorData;       
        }
    }
}

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

module.exports = response;