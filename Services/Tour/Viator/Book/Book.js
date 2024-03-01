"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const apiBookStatusResponse = require("../BookingStatus/Response.js");
const config = require("../../../../Config.js");
const pendingBookingModel = require("../../../../DAL/Mongo/Schemas/TourManualConfirmSchema.js");
module.exports = async (app) => {

    app.post("/:id/Tour/Viator/Book", async function (request, response, next) { 
        // validating request fields. 
        await apiCommonController.viatorBookProductValidation(request, response, next);
    }, async function (request, response) {
        const clientId = request.params.id;
        let fName = "ConfirmBooking_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CONFIRM_BOOKING_PROVIDER_CONFIRM_BOOKING_FILE_PATH, config.Provider_Code_VTR);
        try {
            let requestObj = request.body;
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }
            // availability checking befor going to booking
            
            let availabilityConfirm = await apiResponse.getAvailabilityApiReponse(clientId, providerDetails, "availability/check", requestObj, request)
            // checking availability details
            if(availabilityConfirm && availabilityConfirm.bookableItems != undefined){
                availabilityConfirm = availabilityConfirm?.bookableItems;
                // checking if the product has prodiuct option code.
                checkProductOption(response, clientId, fName, fPath, availabilityConfirm, providerDetails, request);
                                                 
            }
            else{
                response.status(200).send({
                    "Result": {
                        "Code": 400,
                        "Error": {
                            "Message": availabilityConfirm.message || "No Availability found for this booking."
                        }
                    }
                });
            }
 
        }
        catch (error) {
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

};

// Result object formatter
async function tourBookingConfirmResultFormater({clientId, providerDetails, BookStatus, result, fName, fPath,  request, response}){
    try{
        if(result != undefined && result.status == "CONFIRMED"){
            let finalData = {
                "code" : 200,
                "provider" : "VTR",
                "status" : result.status,
                "booking_Reference" : result.bookingRef,
                "partnerBookingRef" : result.partnerBookingRef,
                "currency" : result.currency
            };
            finalData.travelersInfo = [];
            // Travelers age band and number of traveler info.
            let lineItems = await lineItemsData(result, finalData)
            finalData = lineItems

            // Price info.
            if(result.totalPrice != undefined){
                finalData.priceSummary = result.totalPrice.price;
            }

            // Cancellation policy
            if(result.cancellationPolicy != undefined){
                finalData.cancellationPolicy = result.cancellationPolicy;
            }

            // VoucherInfo 
            if(result.voucherInfo != undefined){
                finalData.voucherInfo = result.voucherInfo;
            }
            return(finalData);

        }
        else if(result.status == "REJECTED"){
            let finalData = {
                "code" : 200,
                "status" : result.status,
                "booking_Reference" : result.bookingRef,
                "partnerBookingRef" : result.partnerBookingRef,
                "currency" : result.currency
            }

            // Product booking rejection reasons.
            let endData = await rejectionReasons(result, finalData);
            finalData = endData;
            return(finalData);
        }
        else if(result.status == "IN_PROGRESS"){
            let finalData = {
                "code" : 200,
                "status" : result.status,
                "message" : "The booking is still being processed by the booking server",
                "booking_Reference" : result.bookingRef,
                "partnerBookingRef" : result.partnerBookingRef,
                "currency" : result.currency
            }
            return(finalData);
        }
        else if(result.status == "CANCELED"){
            let finalData = {
                "code" : 200,
                "status" : result.status,
                "message" : "The booking has been canceled",
                "booking_Reference" : result.bookingRef,
                "partnerBookingRef" : result.partnerBookingRef
            }
            return(finalData);
        }
        else if(result.status == "PENDING"){
            let finalData = {
                "code" : 200,
                "status" : result.status,
                "message" : "Your booking status is currently pending. Please check back later.",
                "booking_Reference" : result.bookingRef,
                "partnerBookingRef" : result.partnerBookingRef,
                "currency" : result.currency,
                "lineItems" : result.lineItems,
                "priceSummary" : result?.totalPrice.price,
                "cancellationPolicy" : result?.cancellationPolicy
            }           
            //await savePendingResponseToDb({clientId, providerDetails, BookStatus, result, fName, fPath,  request, response})      
            return(finalData);
        }
        else if(result.status == "FAILED"){
            let finalData = {
                "code" : 400,
                "status" : result.status,
                "message" : "The booking request failed",
                "booking_Reference" : result.bookingRef,
                "partnerBookingRef" : result.partnerBookingRef
            }
            return(finalData);
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
}

async function savePendingResponseToDb({clientId, providerDetails, BookStatus, result, fName, fPath,  request, response}){
    try {
        // Get the current date
        const currentDate = new Date();
        // Calculate the date after 72 hours (3 days)
        const futureDate = new Date(currentDate.getTime() + 72 * 60 * 60 * 1000);
        // Create new pending booking 
        let reqTokenHeader = request.headers['authorization'];
        let token = reqTokenHeader.split(' ')[1];
        const pendingData = new pendingBookingModel({
            BookingRef: result?.bookingRef,
            BookingComponentId : request?.body?.bookingComponentId,
            bookingGuid : request?.body?.bookingGuid,
            msToken : request?.body?.msToken,
            clientId : clientId,
            status : result?.status,
            cretaedDateTime : new Date(),
            bookingTimeOut : futureDate,
            callbackurl : providerDetails?.MoonstrideConfiguration?.saveAndConfirmUrl + request?.body?.bookingGuid + config.saveConfirmBookingUrl,
            statusCheckUrl : `${request?.body?.domainUrl}Tour/BookingStatusCheck`,
            statusCheckRequest : {
                "provider": [
                    "VTR"
                ],
                "bookingRef" : result?.bookingRef
            }

        });
        await pendingData.save();        
        
    } catch (error) {
        console.log(error);
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error.message
            }
        }
        apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
        // response.send(errorObject);
    }
}

// Function for product booking rejection reasons.
async function rejectionReasons(result, finalData){
    if(result.rejectionReasonCode != undefined){
        switch(result.rejectionReasonCode){
            case "BOOKABLE_ITEM_IS_NO_LONGER_AVAILABLE":
                finalData.rejectionReason = "The bookable item is no longer available";
                break;
            case "WEATHER":
                finalData.rejectionReason = "This booking was rejected on account of the weather";
                break;
            case "DUPLICATE_BOOKING":
                finalData.rejectionReason = "This is a duplicate booking";
                break;
            case "PRODUCT_NO_LONGER_OPERATING":
                finalData.rejectionReason = "The product is no longer operating";
                break;
            case "MINIMUM_NUMBER_OF_PASSENGERS_NOT_MET":
                finalData.rejectionReason = "There are too few passengers for the product to operate";
                break;
            case "SIGNIFICANT_GLOBAL_EVENT_FORCE_MAJEURE":
                finalData.rejectionReason = "The booking was rejected due to a natural disaster or other large-scale catastrophe";
                break;
            case "TOUR_WAS_CANCELLED":
                finalData.rejectionReason = " The product was cancelled";
                break;
            case "ISSUE_WITH_TICKET":
                finalData.rejectionReason = " There was an issue with the ticket";
                break;
            case "ISSUE_WITH_PICKUP":
                finalData.rejectionReason = "There was an issue with pickup";
                break;
            case "OTHER":
            default :
                finalData.rejectionReason = "other/unlisted reason";
                break;
        }
        
    }
    return await finalData;
}

// Function for travelers age band and number of traveler info.
async function lineItemsData(result, fData){
    let finalData = fData;
    if(result.lineItems != undefined){
        let lineItems = result.lineItems;
        for(let lineItemsData of lineItems){
            let traveler = {};
            switch (lineItemsData.ageBand) {
                case "ADULT":
                case "CHILD":
                case "TRAVELER":
                case "YOUTH":
                    traveler.ageBand = lineItemsData.ageBand;
                    traveler.numberOfTravelers = lineItemsData.numberOfTravelers;
                    traveler.pricePerPerson = lineItemsData.subtotalPrice.price;
                    break;
                default:
                    traveler.ageBand = lineItemsData.ageBand;
                    traveler.numberOfTravelers = "Null";
                    traveler.pricePerPerson = "Null";
            }
            
            finalData.travelersInfo.push(traveler);
        }
    }
    return await finalData;
}

// Function for checking if the product has prodiuct option code and process
async function checkProductOption(response, clientId, fName, fPath, availabilityConfirm, providerDetails, request){
    let requestObj = request.body;
    if(requestObj.productOptionCode && requestObj.productOptionCode != ""){   
        // Get the selected product from availability response. 
        let matchingProduct = availabilityConfirm.filter(item => item.productOptionCode  === requestObj.productOptionCode && item.available);
        let parameters = {
            clientId,
            providerDetails,
            request, 
            fName, 
            fPath, 
            response, 
            matchingProduct, 
            requestObj
        }
        formattingRequestObjectOnMatchingProduct(parameters)

    }else{
        for(let i = 0; i < availabilityConfirm.length; i++){
        // Checking the product is same and available.
            let availabilityConfirmationParameters = {
                i, 
                clientId, 
                providerDetails, 
                availabilityConfirm, 
                requestObj, 
                request, 
                fName, 
                fPath, 
                response
            }
            let availabilityCheck = await availabilityConfirmation(availabilityConfirmationParameters);
            if(availabilityCheck != {}){
                response.status(200).send(availabilityCheck);
                break;
            }                     
        }
    } 
}

// Function for availability confirmation
async function availabilityConfirmation({i, clientId, providerDetails, availabilityConfirm, requestObj, request, fName, fPath, response}){
    if(availabilityConfirm[i]?.available){
        // Formatting an request object for booking hold
        let bookingholdObj = {
            "productCode" : requestObj.productCode,
            "travelDate" : requestObj.travelDate,
            "currency" : requestObj.currency,
            "paxMix" : requestObj.passengerDetails
        }
        
        // Start time.
        if(requestObj.startTime && requestObj.startTime !== "00:00:00"){
            requestObj.startTime = await extractExactTimeFromRequest(requestObj.startTime);
            bookingholdObj.startTime = requestObj.startTime
        }
        // Get result from booking hold api.
        let result = await apiResponse.bookingHoldResponse(clientId, providerDetails, "bookings/hold", bookingholdObj, request);

        let holdBookingParameters = {
            result, 
            bookingholdObj, 
            requestObj, 
            clientId, 
            providerDetails, 
            request, 
            fName, 
            fPath, 
            response
        }
        let holdBooking = await holdBookings(holdBookingParameters);
        return holdBooking
    }
    else{
        return {
            "Result": {
                "Code": 400,
                "Error": {
                    "Message": "The selected product currently not available right now."
                }
            }
        };                                
    }   
}


// Function for checking the product satus HOLDING OR HOLDING_NOT_PROVIDE.
async function holdBookings({result, bookingholdObj, requestObj, clientId, providerDetails, request, fName, fPath, response}){

    if(result && result.bookingRef){
        // Checking the product satus HOLDING OR HOLDING_NOT_PROVIDE.
        let pricingHold = result.bookingHoldInfo?.pricing;
        if(pricingHold.status){
            if(pricingHold.status !== "HOLDING"){
                throw Error("Booking price hold not provided, There is a possibility to chnage price after booking.")
            }
            // booking hold validity time.
            let bookingHoldTime = new Date(pricingHold.validUntil);
            // Setting up the booking ref from booking hold response.
            bookingholdObj.bookingRef = result.bookingRef;
            let bookingRef = await setBookingRef(bookingholdObj, result, requestObj);
            
            bookingholdObj = bookingRef;
            // Adding booking persond info and communication.
            bookingholdObj.bookerInfo = requestObj.bookerInfo;
            bookingholdObj.communication = requestObj.communication

            let currentDateTime = new Date();
            // Sending request to confirm booking api
            
            if(currentDateTime > bookingHoldTime){
                throw new Error("The booking hold timeout, please try again later.");
            }

            result = await apiResponse.bookingConfirmResponse(clientId, providerDetails, "bookings/book", bookingholdObj, request);
            let bookingConfirmResponse = await setBookingConfirmResponse(clientId, providerDetails, result, fName, fPath, request, response)
            return bookingConfirmResponse;
        }
        else{
            return {
                "Result": {
                    "Code": 400,
                    "Error": {
                        "Message": "The selected item Holding not provided or Booking not available right now."
                    }
                }
            };
        }

    }
    else{
        return {
            "Result": {
                "Code": 400,
                "Error": {
                    "Message": result.message || "No data found or Booking Failed."
                }
            }
        };                                    
    }
}

// Function for set booking reference data
async function setBookingRef(bookingholdObj, result, requestObj){
    //let partnerBookingRef = requestObj?.bookingGuid ?? "";
    let partnerBookingRef = "";
    // Setting up the partner ref. if partner ref is not available its ok to use viator ref. 
    if(partnerBookingRef == ""){
        partnerBookingRef = result.bookingRef;
    }
    bookingholdObj.partnerBookingRef = partnerBookingRef;
    // If lanuage guide is available add language guides tothe request.
    if(requestObj?.languageGuide && requestObj?.languageGuide?.type != "" && requestObj?.languageGuide?.language != undefined){
        bookingholdObj.languageGuide = requestObj.languageGuide;
    }
    // If the booking questions available then add it to request. 
    if(requestObj.bookingQuestionAnswers != undefined){
        bookingholdObj.bookingQuestionAnswers = requestObj.bookingQuestionAnswers;
    }
    // If the additional details available add it to the request for the confirm booking.
    if(requestObj?.additionalBookingDetails != undefined && requestObj?.additionalBookingDetails?.voucherDetails){
        bookingholdObj.additionalBookingDetails = requestObj.additionalBookingDetails;
    }else{
        bookingholdObj.additionalBookingDetails = {
            "voucherDetails": config.viator_voucherDetails
        }
    }
    return await bookingholdObj;

}

// Function for formatting request object
async function formattingRequestObject(clientId, providerDetails, request, fName, fPath, response, matchingProduct){
    try {
        let requestObj = request.body;
        let bookingholdObj = {
            "productCode" : requestObj.productCode,
            "travelDate" : requestObj.travelDate,
            "currency" : requestObj.currency,
            "paxMix" : requestObj.passengerDetails
        }
        // Productoption code.                             
        bookingholdObj.productOptionCode = await apiCommonController.productOptionCodeGenerator(requestObj.productOptionCode)

        // Start time.
        if(matchingProduct.startTime){
            // Checking the start time and 
            if(!requestObj.startTime || requestObj.startTime == "00:00:00"){
                throw new Error(`Start time is required, Starting time of this tour ${matchingProduct.startTime}`);
            }
            else{
                let extractedTime = requestObj.startTime;
                if(requestObj.startTime){
                    let timeParts = requestObj.startTime.split(':');
                    extractedTime = timeParts.slice(0, 2).join(':');
                }
                bookingholdObj.startTime = extractedTime;
            }         
        }
        
        // Get result from booking hold api.
        let result = await apiResponse.bookingHoldResponse(clientId, providerDetails, "bookings/hold", bookingholdObj, request);

        // Checking the booking hold response.
        let pricingHold = result?.bookingHoldInfo?.pricing;
        let pricingHoldDateTime = new Date(pricingHold?.validUntil);
        let currentDateTime = new Date();

        if(pricingHold?.status !== "HOLDING"){
            throw new Error("Booking price hold not provided, There is a possibility to chnage price after booking.");
            
        }
        if(currentDateTime > pricingHoldDateTime){
            throw new Error("Booking hold timeout, please try again later.");
        }

        let parameters = {
            result,
            bookingholdObj, 
            requestObj, 
            clientId, 
            providerDetails,
            request, 
            fName,
            fPath,
            response
        }

        let responseObject = await setFormatedResponseObject(parameters)
        return responseObject; 
    }
    catch (error) {
        console.log(error);
        return ({
            "Result": {
                "Code": 400,
                "Error": {
                    "Message": error?.message || "Internal server error."
                }
            }
        })
    }    
}

// Function for creating response object creation
async function responseObjectCreation(clientId, providerDetails, result, fName, fPath, request, response){

    if(result.status){
        // Definde the request fields. 
        let bookingRef = result.bookingRef;
        // Defined url for viator booking status api.
        let BookStatus = {
            "URL" : `bookings/status`,
            "bookingRef" : bookingRef
        };      
        let requestParameters = {
            clientId,
            providerDetails,
            BookStatus,
            result,
            fName,
            fPath, 
            request,
            response,
        };
        result = await tourBookingConfirmResultFormater(requestParameters);
        if(result != undefined){
           return {
                "Result" : result
            };
        }
        else{
           return {
                "Result" : "Bookign not found."
            };
        };
    };    
};

// Function for set formated response object
async function setFormatedResponseObject({result, bookingholdObj, requestObj, clientId, providerDetails, request, fName, fPath, response}){

    if(result != undefined && result.bookingRef != undefined){
        // Checking the product satus HOLDING OR HOLDING_NOT_PROVIDE.
        if(result.bookingHoldInfo.availability.status != undefined){
            // Setting up the booking ref from booking hold response.
            bookingholdObj.bookingRef = result.bookingRef;
            let bookingRef = await setBookingRef(bookingholdObj, result, requestObj);
            
            bookingholdObj = bookingRef;
            // Adding booking persond info and communication.
            bookingholdObj.bookerInfo = requestObj.bookerInfo;
            bookingholdObj.communication = requestObj.communication

            // Sending request to confirm booking api
            result = await apiResponse.bookingConfirmResponse(clientId, providerDetails, "bookings/book", bookingholdObj, request);

            if(result.status != undefined){
                let responseObject = await responseObjectCreation(clientId, providerDetails, result, fName, fPath, request, response)
                return responseObject;
                // Final result processing and response object creation.
                
            }
            else{
                return {
                    "Result": {
                        "Code": 400,
                        "Error": {
                            "Message": result.message || "Failed to confirm Booking."
                        }
                    }
                };
                
            }  
        }
        else{
            return {
                "Result": {
                    "Code": 400,
                    "Error": {
                        "Message": "The selected item Holding not provided or Booking not available right now."
                    }
                }
            };
        }
    }
    else{
        return {
            "Result": {
                "Code": 400,
                "Error": {
                    "Message": result.message || "No data found or Booking Failed."
                }
            }
        }; 
    }  
}

// Function for set booking confirm response
async function setBookingConfirmResponse(clientId, providerDetails, result, fName, fPath, request, response){
    if(result.status != undefined){    
        let bookingConfirmResponseCheck = await responseObjectCreation(clientId, providerDetails, result, fName, fPath, request, response);
        return bookingConfirmResponseCheck ;
    }
    else{
        return {
            "Result": {
                "Code": 400,
                "Error": {
                    "Message": result.message || "Failed to confirm Booking."
                }
            }
        };
    }
}   


async function formattingRequestObjectOnMatchingProduct({clientId, providerDetails, request, fName, fPath, response, matchingProduct, requestObj}){
    try {
        if(requestObj.startTime != "" && requestObj.startTime != "00:00:00"){
            requestObj.startTime = await extractExactTimeFromRequest(requestObj.startTime);
            for(let match of matchingProduct){
                if(match.startTime == requestObj.startTime){
                    matchingProduct = match;
                    break;
                }
            }
        }
        else{
            matchingProduct = matchingProduct[0];
        }
        if(matchingProduct?.productOptionCode == requestObj.productOptionCode){
            if(matchingProduct.available){
                let responseData = await formattingRequestObject(clientId, providerDetails, request, fName, fPath, response, matchingProduct)
                // Formatting an request object for booking hold
                response.status(200).send(responseData);
            }
            else{
                response.status(200).send({
                    "Result": {
                        "Code": 400,
                        "Error": {
                            "Message": "The selected product currently not available right now."
                        }
                    }
                });
                
            }
        }
        else{
            response.status(200).send({
                "Result": {
                    "Code": 400,
                    "Error": {
                        "Message": "The selected product currently not available right now."
                    }
                }
            });
            
        
        }
    }
    catch (error) {
        console.log(error);    
    }
    
}

// extract exact time from request like if the time has 00:00:00 , then remove the seconds value from it
async function extractExactTimeFromRequest(startTime){
   // Check if the time string contains seconds
    if (startTime.length === 8 && startTime[5] === ':') {
        startTime = startTime.slice(0, -3); // Remove the last three characters (seconds)
    }

    return(startTime); 
}