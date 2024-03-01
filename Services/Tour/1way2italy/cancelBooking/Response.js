"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");
const xml2json = require('xml-js');
const response = {
    
    // Get cancelBooking reasons
    getCancelReasons: async (clientId, providerDetails)=>{
        let fName = "Cancel_Reasons_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CANCEL_REASONS_PROVIDER_CANCEL_REASONS_FILE_PATH, config.Provider_Code_OWT);
        try{
                          
            let cancelQuote = {
                "reasons" : [
                    {
                        "cancellationReasonText": "Significant global event",
                        "cancellationReasonCode": "Customer_Service.Significant_global_event"
                    },
                    {
                        "cancellationReasonText": "Weather",
                        "cancellationReasonCode": "Customer_Service.Weather"
                    },
                    {
                        "cancellationReasonText": "Duplicate Booking",
                        "cancellationReasonCode": "Customer_Service.Duplicate_Booking"
                    },
                    {
                        "cancellationReasonText": "Booked wrong tour date",
                        "cancellationReasonCode": "Customer_Service.Booked_wrong_tour_date"
                    },
                    {
                        "cancellationReasonText": "Chose a different/cheaper tour",
                        "cancellationReasonCode": "Customer_Service.Chose_a_different_cheaper_tour"
                    },
                    {
                        "cancellationReasonText": "The guide or driver didn't show up",
                        "cancellationReasonCode": "Customer_Service.Supplier_no_show"
                    },
                    {
                        "cancellationReasonText": "Unexpected medical circumstances",
                        "cancellationReasonCode": "Customer_Service.Unexpected_medical_circumstances"
                    },
                    {
                        "cancellationReasonText": "I canceled my entire trip",
                        "cancellationReasonCode": "Customer_Service.I_canceled_my_entire_trip"
                    }
                ]
            }
            let availableSuppliers = [];
            if(providerDetails){
                availableSuppliers.push(...providerDetails.availableSuppliers);
            }
            cancelQuote.availableSuppliers = availableSuppliers;
            return cancelQuote;
        }
        catch(error){
            console.log(error);
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, providerDetails);
            return errorObj;
        }

    },

    getConfirmCancelResponse: async (clientId, providerDetails, cancelObj)=>{
        let fName = "Cancel_Booking_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CANCEL_BOOKING_PROVIDER_CANCEL_BOOKING_RESPONSE_FILE_PATH, config.Provider_Code_OWT);
        try{
            const responses = await cancelReservation(providerDetails, cancelObj);
            // Converting xml data to json for better access.
            let jsonData = xml2json.xml2json( responses.data , {compact: true, spaces: 4, explicitArray: true});
            jsonData = JSON.parse(jsonData);
            let fileName = fName + "Success"
            createLogs(`${providerDetails.Oneway2italy_url}${cancelObj.URL}`, fileName, fPath, JSON.stringify(cancelObj), jsonData)
            return jsonData;
        }
        catch(error){
            console.log(error);
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, JSON.stringify(cancelObj));
            return errorObj;
        };

        // Function for cancel reservation
        async function cancelReservation(providerDetails, cancelObj){            
            try {
                let URL = `${providerDetails.Oneway2italy_url}${cancelObj.URL}`;                
                // Cancel reservation request
                let response = await axios.post(URL,`<OTA_CancelRQ xmlns="http://www.opentravel.org/OTA/2003/05" SimulateCancelAndGetPenaltyAmount="true" MarketCountryCode="us" >
                <POS>
                  <Source>
                    <RequestorID ID="${providerDetails.Requestor_ID}" MessagePassword="${providerDetails.Password}" />
                  </Source>
                </POS>
                <UniqueID Type="14" ID="${cancelObj.bookingRef}" />
                <UniqueID Type="32" ID="${cancelObj.chainCode}"/>
              </OTA_CancelRQ>`,
              {
                  headers: {
                    "Content-type": "application/xml; charset=utf-8",
                  }
                }
              );
              return(response);

            } catch(error){
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
}

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

module.exports = response;