"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");

const response = {
    
    // Get search/productcode response from viator 
    getProductDetailsApiReponse: async (clientId, providerDetails, url, request) => {
        let fName = "PickupLocation_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_PICKUP_LOCATION_PROVIDER_GET_LOCATION_FROM_DETAILS_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            return new Promise((resolve) =>{
                //-------------------//
                // axios.get(`${providerDetails.supplierUrl}${url}`,
                //-------------------//
                axios.get(`${providerDetails.Viator_url}${url}`,
                // Header Parameters
                {
                    headers: {
                        'exp-api-key': providerDetails.Viator_apiKey,
                        "Accept-Language": "en-US",
                        "Accept": "application/json;version=2.0"
                    }
                }).then((response) =>{
                    // Response send back to user.           
                    let fileName = fName + "Success"
                    //-----------------//
                    // createLogs(`${providerDetails.supplierUrl}${url}`, fileName, fPath, JSON.stringify(request), response.data)
                    //----------------//
                    createLogs(`${providerDetails.Viator_url}${url}`, fileName, fPath, JSON.stringify(request), response.data)
                    resolve(response.data);
                }).catch((error)=>{
                    console.log(error?.cause ?? error.response.data)
                    let err = error?.cause ?? error.response.data;
                    apiCommonController.getError(err, fName, fPath, JSON.stringify(request));
                    resolve(err);
                });
            });
        }
        catch (err) {
            console.log(err);
            // Handle error safely and add logs
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": err.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, JSON.stringify(request));
            return errorObj;
        }
    },

    // Location bulk api viator for get location details
    getLocationDetailsFromMap: async (clientId, providerDetails, locationsRef)=>{        
        let fName = "Location_Bulk_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_PICKUP_LOCATION_PROVIDER_LOCATION_BULK_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        let request = {"locations" : locationsRef}
        try{
            return new Promise((resolve) => {
                //axios.post(`${providerDetails.supplierUrl}locations/bulk`,request ,
                axios.post(`${providerDetails.Viator_url}locations/bulk`,request ,
                    // Header Parameter
                {
                    headers: {
                        'exp-api-key': providerDetails.Viator_apiKey,
                        "Accept-Language": "en-US",
                        "Accept": "application/json;version=2.0"
                    }
                }).then((response) => {
                    // Response send back to user.
                    let fileName = fName + "Success"
                    //createLogs(`${providerDetails.supplierUrl}locations/bulk`, fileName, fPath, JSON.stringify(request), response.data)
                    createLogs(`${providerDetails.Viator_url}locations/bulk`, fileName, fPath, JSON.stringify(request), response.data)
                    resolve(response.data);
                }).catch((error) => {
                    let err = error?.cause ?? error.response.data;
                    console.log(err);  
                    apiCommonController.getError(err, fName, fPath, JSON.stringify(request));         
                    resolve(err);
                    
                });
            })
        }
        catch(error){
            console.log(error);
            // Handle error safely and add logs
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, JSON.stringify(request));
            return errorObj;
        }
    },

    // Get location details from google map, some locations are from google map
    getGoogleLocationDetails : async(clientId, providerDetails, location)=>{
        let fName = "Google_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_PICKUP_LOCATION_PROVIDER_GOOGLE_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try{
            // Google location api base url
            const baseUrl = providerDetails.MoonstrideConfiguration.googleapiurl;
            // Creating an axios get request based on location ref
            const requests = location.map(ref => {
                const url = `${baseUrl}?place_id=${encodeURIComponent(ref)}&key=${providerDetails?.Gloc_apiKey}`;
                return axios.get(url);
            });
            // Send all the request to google api and waiting for response 
            try {
                const responses = await Promise.all(requests);

                if(responses != undefined && responses.length != 0){
                    const locations = responses.map(response => {
                        if(response.data.result != undefined && !response.data.error_message){

                            const { name, reference, formatted_address } = response.data.result;
      
                            return { name, reference, "address" : formatted_address };
                        }                                                
                    });
                    let fileName = fName + "Success"
                    createLogs(`${baseUrl}`, fileName, fPath, JSON.stringify(requests), locations)
                    return locations;
                }
                else{
                    throw new Error("Google Api Error");
                }
                
            }
            catch (error) {
                const errorObj = {
                    "STATUS": "ERROR",
                    "RESPONSE": {
                        "text": error.message
                    }
                };
                apiCommonController.getError(errorObj, fName, fPath, JSON.stringify(requests));
                return errorObj;
            }

        }
        catch(error){
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, JSON.stringify(providerDetails));
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