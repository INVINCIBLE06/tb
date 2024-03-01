"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");

const response = {
    // Get search/product response from viator 
    getSearchApiReponse: async (clientId, providerDetails, url, searchObject, request) => {
        let fName = "Search_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_SEARCH_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            // Send request to viator api and get details.
            const response = await axios.post(`${providerDetails.Viator_url}${url}`, searchObject, {
                headers: {
                    'exp-api-key': providerDetails.Viator_apiKey,
                    "Accept-Language": "en-US",
                    "Accept": "application/json;version=2.0"
                },
                timeout: 120000
            });
    
            // Send response back to the user.
            request.body = searchObject;
            const fileName = `${fName}_Success`;
            // Creating a success log.
            createLogs(`${providerDetails.Viator_url}${url}`, fileName, fPath, request, response.data);
            return response.data;
        } catch (error) {
            // Handel error data
            const errorData = error?.response?.data ?? error?.cause ?? error;
            // Creating a error logs.
            apiCommonController.getError(errorData, fName, fPath, request);
            return errorData;
        }
    },

    // Attraction Response from API.
    getAttractionsFromApi : async(clientId, providerDetails, destinationId, request) => {
        let fName = "Attraction_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_ATTRACTIONS_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_VTR);

        try {
            // Attraction endpoint url.
            const URL = apiCommonController.urlHTTP(`${config.Tour_Viator_Attraction_EndPoint}/${clientId}/Tour/Viator/Attractions`);
            const searchBody = {
                "provider": ["VTR"],
                "destId": destinationId
            };
    
            const requestData = {
                method: 'post',
                maxBodyLength: Infinity,
                url: URL,
                headers: {
                    "Accept": "application/json;version=2.0"
                },
                data: searchBody
            };
            // Send request to endpoint.
            const response = await axios(requestData);
    
            // Log and resolve success
            request.body = searchBody;
            const fileName = `${fName}Success`;
            // Creating a success log.
            createLogs(URL, fileName, fPath, request, response.data);
    
            return response.data;
        } catch (error) {
            // Log and resolve error
            const errorData = error?.response?.data ?? error?.cause ?? error;            
            apiCommonController.getError(errorData, fName, fPath, request);
            return errorData;
        }
    },

    // Get Tags details from  viator API.
    getTagsFromApi : async(clientId, providerDetails, destinationId, request) => {
        let fName = "Search_Tags_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_SEARCH_TAGS_PROVIDER_TAGS_RESPONSE_FILE_PATH, config.Provider_Code_VTR);

        try {
            const url = `${providerDetails.Viator_url}products/tags`;
            const requestData = {
                method: 'get',
                maxBodyLength: Infinity,
                url: url,
                headers: {
                    'exp-api-key': providerDetails?.Viator_apiKey,
                    "Accept-Language": "en-US",
                    "Accept": "application/json;version=2.0"
                }
            };
            // Send request to viator tags api and get data.
            const response = await axios(requestData);
    
            // Log and resolve success
            const fileName = `${fName}Success`;
            createLogs(url, fileName, fPath, request, response.data);
    
            return response.data;
        } catch (error) {
            // Log and resolve error
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
