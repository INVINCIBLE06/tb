"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");

const response = {
    // Get search/productcode response from viator 
    getProductDetailsApiReponse: async (clientId, providerDetails, productDetails, supplierDetails, reviewsDetails, availabilityDetails, request) => {
        const fName = "Details_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DETAILS_PROVIDER_DETAILS_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            // Headers
            const header = {
                'exp-api-key': providerDetails.Viator_apiKey,
                'Accept-Language': 'en-US',
                'Accept': 'application/json;version=2.0'
            };
    
            // Configure axios requests for product details api.
            const productDetailsRequest = {
                method: 'get',
                maxBodyLength: Infinity,
                url: `${providerDetails.Viator_url}${productDetails.URL}`,
                headers: header
            };
            // Configure axios requests for availability schedule api.
            const availabilityDetailsRequest = {
                method: 'get',
                maxBodyLength: Infinity,
                url: `${providerDetails.Viator_url}${availabilityDetails.URL}`,
                headers: header
            };
    
            // Make parallel requests
            const [productResponse, availabilityScheduleResponse] = await Promise.all([
                axios.request(productDetailsRequest),
                axios.request(availabilityDetailsRequest)
            ]);
    
            // Process responses
            if (productResponse.data) {
                const newRequestData = productDetails;
                const responseData = {
                    productDetails: productResponse.data,
                    availabilitySchedule: availabilityScheduleResponse.data
                };
                const fileName = fName + 'Success';
                createLogs(`${providerDetails.Viator_url}${productDetails.URL}`, fileName, fPath, JSON.stringify(newRequestData), responseData);
                return responseData;
            } else {
                throw new Error(productResponse.response.data);
            }
        } catch (error) {
            const errorData = error?.response?.data ?? error?.cause ?? error;
            console.log(errorData);
            apiCommonController.getError(errorData, fName, fPath, request);
            return errorData;
        }
    },

    // Location bulk api viator for get location details
    getLocationDetailsFromMap: async (clientId, providerDetails, locationsRef)=>{
        const fName = "Location_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DETAILS_PROVIDER_LOCATION_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        let requestObj = {
            body : {
                "locations" : locationsRef
            }
        }
        try {
            const response = await axios.post(`${providerDetails.Viator_url}locations/bulk`,
                { locations: locationsRef },
                {
                    headers: {
                        'exp-api-key': providerDetails.Viator_apiKey,
                        'Accept-Language': 'en-US',
                        'Accept': 'application/json;version=2.0'
                    }
                }
            );
    
            // Log and resolve response
            const fileName = fName + 'Success';
            createLogs(`${providerDetails.Viator_url}locations/bulk`, fileName, fPath, JSON.stringify(requestObj), response.data);
            return response.data;
        } catch (error) {
            // Log and resolve error
            const errorData = error?.response?.data ?? error.cause ?? error;
            apiCommonController.getError(errorData, fName, fPath, JSON.stringify(requestObj));
            return errorData;
        }
    },

    // Get location details from google map, some locations are from google map
    getGoogleLocationDetails : async(clientId, providerDetails, location)=>{
        let fName = "Google_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DETAILS_PROVIDER_GOOGLE_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try{            
            // creating an axios get request based on location ref
            let url = "";
            const requests = location.map(ref => {
                url = `${providerDetails.MoonstrideConfiguration.googleapiurl}?place_id=${encodeURIComponent(ref)}&key=${providerDetails?.Gloc_apiKey}`;
                return axios.get(url);
            });
            // send all the request to google api and waiting for response 
            try {
                const responses = await Promise.all(requests);
                if(responses != undefined && responses.length != 0){
                    const locations = responses.map(response => {
                        if(response.data.result != undefined && !response.data.error_message){

                            const { name, reference, formatted_address } = response.data.result;
                            let responseData = { name, reference, "address" : formatted_address }                           
                            return responseData;
                        }                                                
                    });
                    let fileName = fName + "Success"
                    createLogs(url, fileName, fPath, JSON.stringify({}), locations)
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
                apiCommonController.getError(errorObj, fName, fPath, JSON.stringify({}));
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
            apiCommonController.getError(errorObj, fName, fPath, JSON.stringify({}));
            return errorObj;
        }
    }, 

    // Get supplier details from viator api.
    getSupplierDetailsFromApi : async(providerDetails, clientId, supplierDetails, request, requestObj)=>{
        const fName = "SupplierDetails_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DETAILS_PROVIDER_SUPPLIER_DETAILS_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            const response = await axios.post(`${providerDetails.Viator_url}${supplierDetails.URL}`,
                {
                    productCodes: [supplierDetails.productCode]
                },
                {
                    headers: {
                        'exp-api-key': providerDetails.Viator_apiKey,
                        'Accept-Language': 'en-US',
                        'Accept': 'application/json;version=2.0'
                    }
                }
            );    
            // Log and resolve response
            const fileName = fName + 'Success';
            createLogs(`${providerDetails.Viator_url}${supplierDetails.URL}`, fileName, fPath, JSON.stringify(requestObj), response.data);
            return response.data;
        } catch (error) {
            // Log and resolve error
            const errorData = error?.response?.data ?? error.cause ?? error;
            apiCommonController.getError(errorData, fName, fPath, JSON.stringify(requestObj));
            return errorData;
        }
    },

    // Get reviews details from viator api.
    getReviewsDetailsFromApi : async(providerDetails, clientId, reviewsDetails, request, requestObj)=>{
        const fName = "Reviews_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DETAILS_PROVIDER_REVIEWS_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            const response = await axios.post(`${providerDetails.Viator_url}${reviewsDetails.URL}`, {
                "productCode": reviewsDetails.productCode,
                "provider": "ALL",
                "count": 20,
                "start": 1,
                "showMachineTranslated": true,
                "reviewsForNonPrimaryLocale": true,
                "ratings": [1, 2, 3, 4, 5],
                "sortBy": "MOST_RECENT_PER_LOCALE"
            }, {
                headers: {
                    'exp-api-key': providerDetails.Viator_apiKey,
                    "Accept-Language": "en-US",
                    "Accept": "application/json;version=2.0"
                }
            });
    
            // Log and resolve response
            let fileName = fName + "Success";
            createLogs(`${providerDetails.Viator_url}${reviewsDetails.URL}`, fileName, fPath, JSON.stringify(requestObj), response.data);
            return response.data;
        } catch (error) {
            // Log and resolve error
            const errorData = error?.response?.data ?? error.cause ?? error;
            apiCommonController.getError(errorData, fName, fPath, JSON.stringify(requestObj));
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
