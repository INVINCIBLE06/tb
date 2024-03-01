"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");

const response = {

    // Getting the Available supplier details from one way to Italy
    getAvailableSuppliersApiResponse: async (clientId, url, providerDetails) => {
        let fName = "Destination_Caching_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DESTINATION_CACHING_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_OWT);

        // Axios post data is in xml format
        
        try {
            let readprofileSoapXml =
            `<OTAX_ProfileReadRQ xmlns="http://www.opentravel.org/OTA/2003/05"  PrimaryLangID="en" >
                <POS>
                    <Source>
                        <RequestorID ID="${providerDetails.Requestor_ID}" MessagePassword="${providerDetails.Password}"/>
                    </Source>
                </POS>
            </OTAX_ProfileReadRQ>`;

            return new Promise((resolve) => {
                // Get the user profile details with Supplier detials from the one wayt to Italy
                axios.post(`${providerDetails.Oneway2italy_url}${url}`,
                    readprofileSoapXml,
                    //Header Parameter
                    {
                        headers: {
                            "Content-type": "application/xml; charset=utf-8",
                        },
                    }
                )
                .then((response) => {
                    let fileName = fName + "Success"
                    createLogs(`${providerDetails.Oneway2italy_url}${url}`, fileName, fPath, JSON.stringify({readprofileSoapXml}), response.data)
                    resolve(response.data);
                })
                .catch((error) => {
                    if (error.hasOwnProperty("response")) {
                        console.log(error);
                        apiCommonController.getError(error?.response?.data, fName, fPath, {});
                        resolve(error?.response?.data);
                    } else {
                        apiCommonController.getError(error?.cause, fName, fPath, {});
                        resolve(error?.cause);
                    }
                });
            });
        }
        catch (error) {
            console.log(error);
            // Handle error safely and add logs
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, {});
            return errorObj;
        }
    },

    // Get the supplier location details
    getSuppliersLocationsApiResponse: async(clientId, url, supplierChainCodes, providerDetails)=>{
        let fName = "Destination_Caching_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DESTINATION_CACHING_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_OWT);
        try{
            // Url 
            const requests = supplierChainCodes.map(code => fetchSupplierLocations(code, providerDetails));
            try{
                const responses = await Promise.all(requests);                
                return responses;
            }
            catch(error){
                console.log(error);
                const errorObj = {
                    "STATUS": "ERROR",
                    "RESPONSE": {
                        "text": error.message
                    }
                };
                apiCommonController.getError(errorObj, fName, fPath, {});
                return errorObj;
            }
            
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
            apiCommonController.getError(errorObj, fName, fPath, {});
            return errorObj;
        }

        // Function for fetch supplier locations
        async function fetchSupplierLocations(chainCode, providerDetails){
            try{
              let URL = `${providerDetails.Oneway2italy_url}${url}`;
              // Get the supplier locations using SOAP request 
              // Data type for SOAP call is in xml format
              let response = await axios.post(URL, 
                `<OTAX_LocalityReadRQ xmlns="http://www.opentravel.org/OTA/2003/05" Target="Test" PrimaryLangID="en">
                  <POS>
                    <Source>
                    <RequestorID ID="${providerDetails.Requestor_ID}" MessagePassword="${providerDetails.Password}"/>
                    </Source>
                  </POS>
                  <ProductLocality ChainCode="${chainCode}" CityCode="" AreaID=""/>
                </OTAX_LocalityReadRQ>`,
                {
                  headers: {
                    "Content-type": "application/xml; charset=utf-8",
                  }
                }
              ); 
              return(response) ;
            }
            catch(error){
              const errorObject = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
              }
              return(errorObject);
            }
        }
    }

};

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

module.exports = response;