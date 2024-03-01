"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");
const xml2json = require('xml-js');

const response = {
    // Get booking status response from viator 
    getBookingStatusApiReponse: async (clientId, providerDetails, booking, chainCode) => {
        let fName = "Status_Check_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_STATUS_CHECK_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_OWT);
        try {            
            // Check for which supplier have the Tour product boooked            
                            
            const responses = await fetchReservationDetails(providerDetails, chainCode);             
            // Converting xml data to json for better access.
            let jsonData = xml2json.xml2json( responses , {compact: true, spaces: 4, explicitArray: true});
            jsonData = JSON.parse(jsonData)?.OTA_ResRetrieveRS?.ReservationsList?.TourActivityReservations;                
            let fileName = fName + "Success"
            createLogs(`${providerDetails.Oneway2italy_url}${booking.URL}`, fileName, fPath, JSON.stringify(providerDetails), jsonData)
            return jsonData;                       
        } catch (err) {
            // Handle error safely and add logs
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": err.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, JSON.stringify(providerDetails));
            return errorObj;
        };                
    }
}

// Function for fetch reservation details
async function fetchReservationDetails(providerDetails, chainCode){
    try{
        let URL = `${providerDetails.Oneway2italy_url}${booking.URL}`;
        // Get the reservation details
        let response = await axios.post(URL,
            `<OTA_ReadRQ xmlns="http://www.opentravel.org/OTA/2003/05"  Target="Test" PrimaryLangID="en" MarketCountryCode="us">
            <POS>
              <Source>
                <RequestorID ID="${providerDetails.Requestor_ID}" MessagePassword="${providerDetails.Password}" />
              </Source>
           </POS>
            <UniqueID Type="32" ID="${chainCode}" />
            <ReadRequests>
              <ReadRequest>
              <UniqueID Type="14" ID="${booking.bookingRef}" />
              </ReadRequest>
            </ReadRequests>
          </OTA_ReadRQ>`,
            {
                headers: {
                  "Content-type": "application/xml; charset=utf-8",
                }
              }
            );
        return(response.data);

    }catch(error){
        const errorObject = {
          "STATUS": "ERROR",
          "RESPONSE": {
              "text": error.message
          }
        }
        return(errorObject);
    }
}

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

module.exports = response;