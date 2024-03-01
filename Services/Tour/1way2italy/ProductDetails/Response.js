"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");

const response = {
    getProductDetailsApiResponse : async(clientId, requestObj, providerDetails)=>{
        const fName = "Details_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DETAILS_PROVIDER_DETAILS_RESPONSE_FILE_PATH, config.Provider_Code_OWT);
        
        try{

            let xmRequestData = `<OTAX_TourActivityDescriptiveInfoRQ xmlns="http://www.opentravel.org/OTA/2003/05" PrimaryLangID="en" Target="Test">
                <POS>
                <Source>
                <RequestorID ID="${providerDetails.Requestor_ID}" MessagePassword="${providerDetails.Password}"/>
                </Source>
                </POS>
                <TourActivityDescriptiveInfos>
                <TourActivityDescriptiveInfo ChainCode="${requestObj.chainCode}"  TourActivityCode="${requestObj.productCode}"/>
                </TourActivityDescriptiveInfos>
            </OTAX_TourActivityDescriptiveInfoRQ>`;

            const response = await axios.post(`${providerDetails.Oneway2italy_url}${requestObj.url}`, xmRequestData, {
                headers: {
                    "Content-type": "application/xml; charset=utf-8",
                },
            });
    
            const fileName = fName + "Success";
            createLogs(`${providerDetails.Oneway2italy_url}${requestObj.url}`, fileName, fPath, JSON.stringify(xmRequestData), response.data);
            return response.data;
        }
        catch(error){
            const errorData = error?.response?.data ??  error?.cause;
            apiCommonController.getError(errorData, fName, fPath, requestObj);
            return errorData;
        }
    }
};

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

module.exports = response;