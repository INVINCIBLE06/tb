"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");

const response = {
    getMarkupDbApiReponse : async(clientId, agentGuid, token, currency, request, providerDetails)=>{

        const fName = "markup_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_MARKUP_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_OWT);
        try{
            return new Promise((resolve) => {
                // Defined headder, it is common for all apis.
                // Let URL = config.MoonstrideConfiguration.agentmarkupurl;
                // Headers for token and accept type
                let header = {
                    "headers" : {
                        'token': token,
                        'Content-Type': 'application/json'
                    }
                };

                async function fetchData() {
                    try {
                        if(providerDetails?.MoonstrideConfiguration?.agentmarkupurl == undefined || !providerDetails?.MoonstrideConfiguration?.agentcommissionurl == undefined){
                            throw new Error("markup calculation url not found.")
                        }
                      const comapnyMarkupResponse = await axios.get(`${providerDetails?.MoonstrideConfiguration?.agentmarkupurl+agentGuid}?currency=${currency}`,
                        { headers: header.headers });
                  
                      const agentmarkupResponse = await axios.get(`${providerDetails?.MoonstrideConfiguration?.agentmarkupurl+agentGuid}?currency=${currency}`,
                       { headers: header.headers });

                       const agentcommission = await axios.get(`${providerDetails?.MoonstrideConfiguration?.agentcommissionurl+agentGuid}?currency=${currency}`,
                       { headers: header.headers });
                  
                      if (comapnyMarkupResponse.data !== undefined && agentmarkupResponse.data !== undefined && agentcommission) {                        
                  
                        return {
                          "comapnyMarkup": comapnyMarkupResponse.data,
                          "agentmarkup": agentmarkupResponse.data,
                          "agentcommission" : agentcommission.data
                        };
                      }
                    }
                    catch (error) {
                      return(error?.cause ?? "Markup response not found." )
                    }
                }
                  
                fetchData()
                .then((data) => {
                    // Handle the data returned from the API requests
                    let fileName = fName + "Success"
                    createLogs(`${providerDetails.MoonstrideConfiguration.agentmarkupurl+agentGuid} ,//, ${providerDetails?.MoonstrideConfiguration?.agentcommissionurl+agentGuid}?currency=${currency}`, fileName, fPath, request, data)
                    resolve(data);
                })
                .catch((error) => {
                    console.log(error);
                    let errorObj = {
                        "Error" : {
                            "status" : 400,
                            "message" : "Markup data not found." || error.message
                        }
                    }
                    apiCommonController.getError(errorObj, fName, fPath, request);
                    resolve(errorObj)
                });                                               
            });
        }
        catch(error){
            // Handle error safely and add logs
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
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