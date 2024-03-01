"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");

const response = {

    // Booking availability check Call this befor booking confirm.
    getAvailabilityApiReponse: async (clientId, providerDetails, URL, requestObj, request) => {
        let fName = "Availability_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_AVAILABILITY_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            const response = await axios.post(`${providerDetails.Viator_url}${URL}`,
              {
                productCode: requestObj.productCode,
                travelDate: requestObj.travelDate,
                currency: requestObj.currency,
                paxMix: requestObj.passengerDetails,
              },
              {
                headers: {
                  'exp-api-key': providerDetails.Viator_apiKey,
                  'Accept-Language': 'en-US',
                  'Accept': 'application/json;version=2.0',
                },
              }
            );
        
            // Response send back to user.
            let fileName = `${fName}Success`;
            createLogs(`${providerDetails.Viator_url}${URL}`, fileName, fPath, JSON.stringify(requestObj), response.data);
            
            return response?.data;
        } catch (error) {
            const errorData = error?.response?.data ?? error?.cause ?? error;
            apiCommonController.getError(errorData, fName, fPath, request);
            return errorData;
        }
    },

    // Booking hold api.
    bookingHoldResponse: async (clientId, providerDetails, URL, bookingholdObj, request) => {
        let fName = "ConfirmBooking_Hold_ApiResponse";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CONFIRM_BOOKING_PROVIDER_CONFIRM_BOOKING_HOLD_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            const response = await axios.post(`${providerDetails.Viator_url}${URL}`,
              bookingholdObj,
              {
                headers: {
                  'exp-api-key': providerDetails.Viator_apiKey,
                  'Accept-Language': 'en-US',
                  'Accept': 'application/json;version=2.0',
                },
                timeout: 120000, // Timeout in milliseconds (120 seconds)
              }
            );
        
            // Response send back to user.
            console.log(response.data);
            const fileName = `${fName}Success`;
            createLogs(`${providerDetails.Viator_url}${URL}`, fileName, fPath, JSON.stringify(bookingholdObj), response.data);
            
            return response?.data;
        } catch (error) {
            const errorData = error?.response?.data ?? error?.cause ?? error;
            apiCommonController.getError(errorData, fName, fPath, request);
            return errorData;
        }
    },
    
    // Booking confirm api.
    bookingConfirmResponse : async (clientId, providerDetails, URL, bookingObj, request)=>{
        let fName = "ConfirmBooking__ApiResponse";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CONFIRM_BOOKING_PROVIDER_CONFIRM_BOOKING_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            const response = await axios.post(`${providerDetails.Viator_url}${URL}`, bookingObj,
              {
                headers: {
                  'exp-api-key': providerDetails.Viator_apiKey,
                  'Accept-Language': 'en-US',
                  'Accept': 'application/json;version=2.0',
                },
                timeout: 120000, // Timeout in milliseconds (120 seconds)
            });
        
            // Response send back to user.
            const fileName = `${fName}Success`;
            createLogs(`${providerDetails.Viator_url}${URL}`, fileName, fPath, JSON.stringify(bookingObj), response.data);
            return response?.data;
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