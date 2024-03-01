"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const config = require("../../../../Config.js");

module.exports = async (app) => {

    app.post("/:id/Tour/1way2italy/bookingCancelReasons", async function (request, response, next){
        // Validating request fields. 
        await apiCommonController.viatorBookCancelReasons(request, response, next);
    }, async function (request, response) {
        
        const clientId = request.params.id;
        let fName = "CancelBooking";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CANCEL_BOOKING_PROVIDER_CANCEL_BOOKING_FILE_PATH, config.Provider_Code_OWT);
        try{
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "OneWay2Italy");
            if (!providerDetails.Requestor_ID && !providerDetails.Password) {
                throw new Error(config.OWTApiKeyErrorMessage);
            }
            
            let result = await apiResponse.getCancelReasons(clientId, providerDetails);
            if(result != undefined && result.reasons.length != 0){
                response.status(200).send({
                    "Result": result
                });
            }            
            else {
                response.status(200).send({
                    "Result": {
                        "Code": 400,
                        "Error": {
                            "Message": "No data found"
                        }
                    }
                });
            }


        }
        catch(error){
            // Handle error safely and add logs
            const errorObject = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            }
            apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
            response.send(errorObject);
        }
    });

    app.post("/:id/Tour/1way2italy/bookingConfirmCancel", async function(request, response, next){
        // Validating request fields. 
        await apiCommonController.viatorBookCancelConfirm(request, response, next);
    }, async function (request, response) {

        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "CancelBooking";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CANCEL_BOOKING_PROVIDER_CANCEL_BOOKING_FILE_PATH, config.Provider_Code_OWT);
        
        try{

             // Get and Validate Provider Credentials
             const providerDetails = await apiCommonController.providerDetail(clientId, "OneWay2Italy");
             if (!providerDetails.Requestor_ID && !providerDetails.Password) {
                 throw new Error(config.OWTApiKeyErrorMessage);
             }

            let cancelObj = {
                "URL" : `cancelres`,
                "bookingRef" : requestObj.bookingReff,
                "chainCode": requestObj.chainCode
            }
            
            let result = await apiResponse.getConfirmCancelResponse(clientId, providerDetails, cancelObj);
            if(result != undefined){
                if(result?.OTA_CancelRS?.Success){
                    result.message = "The cancellation was successful";
                    result.status = "ACCEPTED";
                }
                else{
                    result.message = "The cancellation failed"; 
                    result.status = "DECLINED";                   
                }
                response.status(200).send({
                    "Result": result
                });
            }
            else{
                response.status(200).send({
                    "Result": {
                        "Code": 400,
                        "Error": {
                            "Message": result.message || "Intenal Server Error"
                        }
                    }
                });
            }

        }
        catch(error){
            console.log(error);
            const errorObject = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            }
            apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
            response.send(errorObject);
        }
    });
}