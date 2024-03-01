"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const xml2json = require("xml-js")
const config = require("../../../../Config.js");
module.exports = async (app) => {
    app.post("/:id/Tour/1way2italy/Book", async function (request, response, next) {
        // Validating request fields. 
        await apiCommonController.OneWay2ItalyBookingConfirmValidator(request, response, next);
    }, async function (request, response) {
        const clientId = request.params.id;
        let fName = "ConfirmBooking_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CONFIRM_BOOKING_PROVIDER_CONFIRM_BOOKING_FILE_PATH, config.Provider_Code_OWT);

        try{
            let requestObj = request.body;
            let productCode = (requestObj.productCode).split("|")
            requestObj.chainCode = requestObj.productOptionCode[0];
            requestObj.productOptionCode = requestObj.productCode;
            requestObj.productCode = productCode[0];
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "OneWay2Italy");
            if (!providerDetails.Requestor_ID && !providerDetails.Password) {
                throw new Error(config.OWTApiKeyErrorMessage);
            }
            let bookConfirmApiResponse = await apiResponse.bookingConfirmResponse(clientId, providerDetails, "touractivityres", requestObj)
            
            if(bookConfirmApiResponse != undefined){
                let options = {
                    ignoreComment: true,
                    compact: true,
                    spaces: 2,
                    explicitArray: true
                };
                let convertedJsonData = xml2json.xml2json(bookConfirmApiResponse, options);
                convertedJsonData = JSON.parse(convertedJsonData);

                if(convertedJsonData?.OTAX_TourActivityResRS?.Errors?.Error){

                    let error = convertedJsonData?.OTAX_TourActivityResRS?.Errors?.Error?._attributes ?? convertedJsonData?.OTAX_TourActivityResRS?.Errors?.Error[1]?._attributes?.ShortText;
                    response.status(200).send({
                        "Result": {
                            "STATUS": "ERROR",
                            "RESPONSE": {
                                "text": error?.ShortText ?? error ?? "No bookable items found."
                            }
                        }
                    });
                }
                else{
                    let formatedBookingResponse = await formatBookingResponse(convertedJsonData, requestObj, fName, fPath)
                    response.status(200).send({
                        "Result": formatedBookingResponse
                    });
                }                
            }
            else{
                response.status(200).send({
                    "Result": {
                        "Code": 500,
                        "Error": {
                            "Message": "Internal Server Error"
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
};

// format the booking response
async function formatBookingResponse(result , requestObj, fName, fPath){
    try {
        let tourActivityRes;

        if(result?.OTAX_TourActivityResRS?.TourActivityReservations?.TourActivityReservation != undefined){
            
            tourActivityRes = result?.OTAX_TourActivityResRS?.TourActivityReservations?.TourActivityReservation
            
            let bookingId = tourActivityRes?.ResGlobalInfo?.TourActivityReservationIDs?.TourActivityReservationID.filter(element => element?._attributes?.ResID_Type == '14')
            
            let finalData = {
                "code": 200,
                "provider" : "OWT",                
            }
            // setting up the booking status.
            if(tourActivityRes?._attributes?.ResStatus == "Confirmed"){
                finalData.status = "CONFIRMED";
            }
            else{
                finalData.status = tourActivityRes?._attributes?.ResStatus;
            }
            // extracting the currency from response .
            finalData.currency = tourActivityRes?.ResGlobalInfo?.Total?._attributes?.CurrencyCode || requestObj.currency;
            // extracing the booking reference from response.
            finalData.booking_Reference = bookingId[0]._attributes.ResID_Value || "";
            // addding partner booking reference to response, which is get from request.
            finalData.partnerBookingRef = requestObj?.bookingComponentId ?? ""
            
            finalData.travelersInfo = [];

            if(tourActivityRes?.ResGuests != undefined){
                
                const resGuests = tourActivityRes?.ResGuests
                // setting up the basic details.
                const lineItems = await lineItemsData(tourActivityRes, resGuests, finalData)
                finalData = lineItems
                
            }
            // price details
            if(tourActivityRes?.ResGlobalInfo?.Total != undefined){
                finalData.priceSummary = await getPriceDetails(tourActivityRes) 
                
            }
            // cancellation policy
            if(tourActivityRes?.ResGlobalInfo?.CancelPenalties != undefined){
                finalData.cancellationPolicy = await handleCancellationDescription(result)
            }
            finalData.voucherInfo = {}
            return finalData
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
        apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(requestObj));
    }
}

// format passenger details
async function lineItemsData(tourActivityRes, resGuests, fData){
    let finalData = fData;
    if(resGuests.ResGuest != undefined){
        let lineItems = resGuests.ResGuest;
        // get price for  per person 
        const perPersonPrice = await getPerPersonPrice(tourActivityRes, lineItems)
        let ageBand = []
        for (const element of lineItems) {
            // find the ageband
            await handleLineItemAgeBand(element, ageBand)
        }
        
        
        let traveler = {};
        
        let DistinctAgeBand =  [...new Set(ageBand)];

        DistinctAgeBand.forEach(element => {
            
            traveler.ageBand = element;
            traveler.numberOfTravelers = ageBand.filter(element => element === element).length;
            traveler.pricePerPerson = {
                    "recommendedRetailPrice": perPersonPrice * traveler.numberOfTravelers,
                    "partnerNetPrice": perPersonPrice * traveler.numberOfTravelers                
            }
             
            finalData.travelersInfo.push(traveler)
            
        });
    }
    return finalData;
}

// get per person price
async function getPerPersonPrice(tourActivityRes, lineItems){
    let perPersonPrice;
    if(tourActivityRes?.ResGlobalInfo?.Total != undefined){
        const totalPrice = tourActivityRes?.ResGlobalInfo?.Total?._attributes?.AmountAfterTax;
        perPersonPrice = totalPrice/lineItems.length;
    }
    return perPersonPrice
}

//Function to add age band to line items
async function handleLineItemAgeBand(lineItem, ageBandArr){
    let ageBand = "ADULT";
    if(lineItem != undefined && lineItem?.Profiles?.ProfileInfo?.Profile?.Customer?._attributes?.BirthDate != undefined){
        // The date of birth in string format
        const dobString = lineItem?.Profiles?.ProfileInfo?.Profile?.Customer?._attributes?.BirthDate
        // Parse the DOB string into a Date object
        const dobDate = new Date(dobString);
        // Get the current date
        const currentDate = new Date();
        // Calculate the difference in years
        let age = currentDate.getFullYear() - dobDate.getFullYear();
        
        if(age <= 3 && age >= 0){
            ageBand = "INFANT";
            ageBandArr.push(ageBand)
        }
        else if(age > 3 && age < 18){
            ageBand = "CHILD";
            ageBandArr.push(ageBand)
        }else{
            ageBandArr.push(ageBand)
        }        
    } else {
        ageBandArr.push(ageBand)
    }
};

async function getPriceDetails(tourActivityRes){
    const totalPrice = tourActivityRes?.ResGlobalInfo?.Total?._attributes?.AmountAfterTax;
    let priceSummary={}
    priceSummary.recommendedRetailPrice = totalPrice || 0;
    priceSummary.partnerNetPrice = totalPrice || 0;
    priceSummary.bookingFee = 0;
    priceSummary.partnerTotalPrice = totalPrice || 0;

    return priceSummary
}

// Function to handle cancellation description
async function handleCancellationDescription(result){
    let tourActivityRes = result?.OTAX_TourActivityResRS?.TourActivityReservations?.TourActivityReservation;
    let cancellationPolicy = {};
    let BookingTime = ""
    cancellationPolicy.type = "STANDARD";
    cancellationPolicy.cancelIfBadWeather = false
    cancellationPolicy.cancelIfInsufficientTravelers = false

    if(tourActivityRes?.ResGlobalInfo?.CancelPenalties){
        let cancelObj = tourActivityRes?.ResGlobalInfo?.CancelPenalties;
        if( cancelObj?.CancelPenalty?._attributes?.NonRefundable === "true"){
            cancellationPolicy.cancelationDescription = 'There is no refund available'
        }else if(cancelObj?.CancelPenalty?.Deadline?._attributes.AbsoluteDeadline){
            let deadline = cancelObj?.CancelPenalty?.Deadline?._attributes?.AbsoluteDeadline ;
            cancellationPolicy.cancelationDescription = `The absoulte deadline for Cancel tour package is ${deadline}`;
            if(result?.OTAX_TourActivityResRS?._attributes.TimeStamp){
                BookingTime = result?.OTAX_TourActivityResRS?._attributes.TimeStamp.split('T')[0]
            }
            cancellationPolicy.refundEligibility = [{
                "dayRangeMin": 1,
                "percentageRefundable":100,
                "startTimestamp": BookingTime,
                "endTimestamp" : deadline
            }
        ]
        }                                
     };
    return cancellationPolicy;
}