"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");

const response = {
    // Get attractions list from viator
    getAttractionsList : async (clientId, providerDetails, attractions, requestObj, request) =>{
        let fName = "Attraction_ApiResponse";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_ATTRACTIONS_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            const headers = {
                'exp-api-key': providerDetails.Viator_apiKey,
                "Accept-Language": "en-US",
                "Accept": "application/json;version=2.0"
            };
    
            const response = await axios.post(`${providerDetails.Viator_url}${attractions.attractionsCheckurl}`, {
                "destId": requestObj.destId,
                "topX": "1-20",
                "sortOrder": "RECOMMENDED"
            }, { headers });
    
            const fileName = `${fName}Success`;
            createLogs(`${providerDetails.Viator_url}${attractions.attractionsCheckurl}`, fileName, fPath, JSON.stringify(requestObj), response.data);
            return response?.data;
        } catch (error) {        
            const errorData = error?.response?.data ?? error?.cause ?? error;
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