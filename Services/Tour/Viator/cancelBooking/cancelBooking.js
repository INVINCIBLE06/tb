"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const config = require("../../../../Config.js");
const fs = require('fs');
const path = require('path');

module.exports = async (app) => {
   
    app.post("/:id/Tour/Viator/bookingCancelReasons", async function (request, response, next){
        // Validating request fields. 
        await apiCommonController.viatorBookCancelReasons(request, response, next);
    }, async function (request, response) {
        
        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "CancelBooking";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CANCEL_BOOKING_PROVIDER_CANCEL_BOOKING_FILE_PATH, config.Provider_Code_VTR);
        try{
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }
            
            let filePath = config.viator_booking_cancel_reason_caching_file_location;
            let resultData = await getReasonsDataFromFile(clientId, filePath, providerDetails, request)

            if(requestObj.bookingReff && requestObj.bookingReff != ""){
                let result = {
                    "reasons" : []
                }

                let cancelQuoteObj = {
                    URL : `bookings/${requestObj.bookingReff}/cancel-quote`
                }

                // Get cancel quote og booking 
                let cancelQuote = await apiResponse.getCancelQuoteApiReponse(clientId, providerDetails, cancelQuoteObj, request);
                console.log(cancelQuote);
                let cancelQuoteDescription = await cancelQuoteDescriptionFunction(clientId, cancelQuote, request);
                if(cancelQuoteDescription && cancelQuote.status){
                    
                    result.cancelQuote = cancelQuoteDescription;

                    if(resultData && Array.isArray(resultData?.reasons) && resultData?.reasons.legth != 0){
                        result.reasons = resultData?.reasons
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
                                "Message": cancelQuote.message || "Intenal Server Error"
                            }
                        }
                    });
                }
                
            }            
            else {
                response.status(200).send({
                    "Result": {
                        "Code": 400,
                        "Error": {
                            "Message": resultData || "Cancel reasons not found."
                        }
                    }
                });
            }
        }
        catch(error){
            console.log(error);
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

    app.post("/:id/Tour/Viator/bookingConfirmCancel", async function(request, response, next){
        // Validating request fields. 
        await apiCommonController.viatorBookCancelConfirm(request, response, next);
    }, async function (request, response) {

        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "CancelBooking";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CANCEL_BOOKING_PROVIDER_CANCEL_BOOKING_FILE_PATH, config.Provider_Code_VTR);
        try{

            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }

            let cancelObj = {
                "URL" : `bookings/${requestObj.bookingReff}/cancel`,
                "reasonCode" : request.cancelReason
            }
            
            let result = await apiResponse.getConfirmCancelResponse(clientId, providerDetails, cancelObj, request);
            let cancellationReasonDescription = await getCancelConfirmReasonDescription(clientId, result, request);
            if(cancellationReasonDescription && cancellationReasonDescription.STATUS !== "ERROR"){
                response.status(200).send({
                    "Result": cancellationReasonDescription
                });
            }
            else{
                response.status(200).send({
                    "Result": {
                        "Code": 400,
                        "Error": {
                            "Message": cancellationReasonDescription?.RESPONSE?.text || "Intenal Server Error"
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
    })
}

// read cancel reasons from file.
async function getReasonsDataFromFile(clientId, filePath, providerDetails, request){
    try {
        let cancelReasons = {}
        // extracting the full path
        const FullPath = path.join(process.cwd(), filePath);
        const directory = path.dirname(FullPath)
        if (!fs.existsSync(directory)) {
            // Create a folder
            fs.mkdirSync(directory, { recursive: true });
        }

        if(fs.existsSync(FullPath)){
            
            let data = fs.readFileSync(FullPath, 'utf8');
            if(!data){
                // If no data found then get data from api and save to file.
                cancelReasons = await cacheCancelReasonsAndRead(clientId, providerDetails, request, filePath)
            }else{
                cancelReasons = await functionIfFileData(cancelReasons, data, clientId, providerDetails, request, filePath);
            }
        }
        else{
            
            cancelReasons = await cacheCancelReasonsAndRead(clientId, providerDetails, request, filePath)
        }  
        return  cancelReasons             
    } catch (error) {
        console.log(error);
        const errorObj = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error?.cause ?? error?.message
            }
        };
        return errorObj;   
    }
    
}

// Function to rad data and check time difference.
async function functionIfFileData(cancelReasons, data, clientId, providerDetails, request, filePath){
    let jsonData = JSON.parse(data);
    if(Object.keys(jsonData).length != 0){
        
        let DateTimeChecking = await apiCommonController.checkTimeDifferenceFunction(jsonData.timestamp, 1, "M");
        if(DateTimeChecking){
            
            cancelReasons = await cacheCancelReasonsAndRead(clientId, providerDetails, request, filePath)
        }else{
            
            cancelReasons = jsonData
        }
    }else{
        
        cancelReasons = await cacheCancelReasonsAndRead(clientId, providerDetails, request, filePath)
    }
    return cancelReasons;
}

async function cacheCancelReasonsAndRead(clientId, providerDetails, request,filePath){
    const fullPath = path.join(process.cwd(), filePath);
    let result = await apiResponse.getCancelReasons(clientId, providerDetails, "/bookings/cancel-reasons", request)
    
    if(result && result.reasons){
        // Adding current date and time.
        result.timestamp = new Date();
        result.provider = "VTR";
        // Adding total count of questions.
        result.totalCount = result?.reasons?.length;
        // converting to string
        let jsonData = JSON.stringify(result, null, 2);
        // write data to file
        fs.writeFileSync(process.cwd() + filePath, jsonData, 'utf-8');
    }

    let data = fs.readFileSync(fullPath, 'utf8');
    let jsonData = JSON.parse(data);

    return jsonData
}

// Cancel reason cancel quote description.
async function cancelQuoteDescriptionFunction(clientId, cancelQuote, request){
    let fName = "CancelBooking";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CANCEL_BOOKING_PROVIDER_CANCEL_BOOKING_FILE_PATH, config.Provider_Code_VTR);

    try{
        
        if(cancelQuote){
            let obj = {}
            if(cancelQuote.status == "CANCELLABLE"){
                obj.description =  " This booking is available to be cancelled."
                
            }
            else if(cancelQuote.status == "CANCELLED"){
                obj.description = " This booking has already been cancelled."
                
            }
            else if(cancelQuote.status == "NOT_CANCELLABLE"){
                obj.description = "  This booking cannot be cancelled (because the product's start time was in the past)."
                
            }
            cancelQuote.Reason = obj;
        }
        return cancelQuote;
    }
    catch(error){
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error.message
            }
        }
        apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
        return(errorObject);
    }
}

// Confirm cancel cancellation reson description
async function getCancelConfirmReasonDescription(clientId, result, request){
    let fName = "CancelBooking";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CANCEL_BOOKING_PROVIDER_CANCEL_BOOKING_FILE_PATH, config.Provider_Code_VTR);

    try{
        if(result.status == "ACCEPTED"){
            result.message = "The cancellation was successful";
        }
        else if(result.status == "DECLINED"){
            result.message = "The cancellation failed";
            if(result.reason){
                if(result.reason == "ALREADY_CANCELLED"){
                    result.reason = "The booking has already been cancelled";
                }
                else if(result.reason == "NOT_CANCELLABLE"){
                    result.reason = "The booking cannot be canceled because the product start time was in the past";
                }
            }
        }
        return result;
    }
    catch(error){
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error.message
            }
        }
        apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
        return(errorObject);
    }
}
