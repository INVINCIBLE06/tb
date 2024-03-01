"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const config = require("../../../../Config.js");

module.exports = async (app) => {
    app.post("/:id/Tour/1way2italy/BookStatus", async function (request, response, next) {
        // validating request fields. 
        await apiCommonController.viatorBookingStatusValidations(request, response, next);
    }, async function (request, response) {
        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "Status_Check_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_STATUS_CHECK_PROVIDER_STATUS_CHECK_FILE_PATH, config.Provider_Code_OWT);
        try {
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "OneWay2Italy");            
            if (!providerDetails.Requestor_ID || !providerDetails.Password) {
                throw new Error(config.OWTApiKeyErrorMessage);
            }
            
            // definde the request fields. 
            let bookingRef = requestObj.bookingRef;
            let chainCode = requestObj.chainCode;
            // defined url for viator booking status api.
            let BookStatus = {
                "URL" : `resretrieve`,
                "bookingRef" : bookingRef
            };            
            // get the api response.
            // waiting for all the three api results.
            let result = await apiResponse.getBookingStatusApiReponse(clientId,providerDetails, BookStatus, chainCode);                                             

            if(result != undefined){
                // format the booking status response
                result = await tourActivityReservationFormatting(result,bookingRef);
                response.status(200).send({
                    "Result": result
                });
            }
            else{
                response.status(200).send({
                    "Result": "Booking Not Found ."
                });
            }
           
        }
        catch (error) {
            // Handle error safely and add logs            
            const errorObject = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            }
            apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
            response.send(errorObject);
        };
        async function tourActivityReservationFormatting(jsonData, bookingRef){
            try{
                let bookingStatusResdObj = {
                    "status": "NOTCONFIRMED",
                    "bookingRef": `${bookingRef}`,
                    "partnerBookingRef": "",
                    "currency": "EUR",
                    "lineItems": [],
                    "totalPrice": {
                        "price": {
                            "recommendedRetailPrice": 0,
                            "partnerNetPrice": 0,
                            "bookingFee": 0,
                            "partnerTotalPrice": 0
                        }
                    },
                    "cancellationPolicy": {
                        "type": "STANDARD",
                        "description": "",
                        "cancelIfBadWeather": false,
                        "cancelIfInsufficientTravelers": false,
                        "refundEligibility": [
                            {
                                "dayRangeMin": 1,
                                "percentageRefundable": 0,
                                "startTimestamp": 0,
                                "endTimestamp": 0
                            }
                        ]
                    },
                    "voucherInfo": {
                        "url": "Null",
                        "format": "Null",
                        "type": "Null"
                    }
                };
                if(jsonData != undefined && jsonData?._attributes?.ResStatus === "Confirmed"){                    
                    
                    // adding the line items
                    let bookingStatusResdObjNew = await bookingStatus(bookingStatusResdObj, jsonData)
                    bookingStatusResdObj = bookingStatusResdObjNew;
                };
                return(bookingStatusResdObj);

            }
            catch(error){
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

        
    });    
}

//Function to add age band to line items
async function handleLineItemAgeBand(guestDob){
    let ageBand = "ADULT";
    if(guestDob?.Profile.Customer?._attributes?.BirthDate != undefined){
        // The date of birth in string format
        const dobString = guestDob?.Profile.Customer?._attributes?.BirthDate;
        // Parse the DOB string into a Date object
        const dobDate = new Date(dobString);
        // Get the current date
        const currentDate = new Date();
        // Calculate the difference in years
        let age = currentDate.getFullYear() - dobDate.getFullYear();
        
        if(age <= 3 && age >= 0){
            ageBand = "INFANT";
            return ageBand;
        }else if(age > 3 && age < 18){
            ageBand = "CHILD";
            return ageBand;
        }else{
            return ageBand;
        }        
    } else {
        return ageBand;
    }

};

//Function to handle line item prices
async function handleLineItemNetPrice(userRates, index){
    let lineItemRecommendedRetailPrice = 0;
    let lineItemPartnerNetPrice = 0;
    if(userRates){
        if(Array.isArray(userRates.GuestRates)){
            lineItemRecommendedRetailPrice = userRates.GuestRates?.GuestRate?.[index]?.AmountAfterTax;
            lineItemPartnerNetPrice = userRates.GuestRates?.GuestRate?.[index]?.AmountAfterTax;
        }   
    };
    return {"lineItemRecommendedRetailPrice":lineItemRecommendedRetailPrice, "lineItemPartnerNetPrice" : lineItemPartnerNetPrice }
}

// Function to handle total price
async function handleTotalPrice(activityRate){
    let totalAmnt = 0;
    if(activityRate && activityRate?._attributes?.AmountAfterTax){
        totalAmnt = activityRate?._attributes?.AmountAfterTax;        
    };
    return totalAmnt;
};

// Function to handle cancellation description
async function handleCancellationDescription(jsonData){
    let cancelationDescription = '';
    if(jsonData?.ResGlobalInfo?.CancelPenalties){
        let cancelObj = jsonData?.ResGlobalInfo?.CancelPenalties;
        if( cancelObj?.CancelPenalty?._attributes?.NonRefundable === "true"){
            cancelationDescription = 'There is no refund available'
        }else if(cancelObj?.CancelPenalty?.Deadline?._attributes.AbsoluteDeadline){
            let deadline = cancelObj?.CancelPenalty?.Deadline?._attributes?.AbsoluteDeadline ;
            cancelationDescription = `The absoulte deadline for Cancel tour package is ${deadline}`;
        }                                
     };
    return cancelationDescription;
}

// Function for set booking status
async function bookingStatus(bookingStatusResdObj, jsonData){
    if(Array.isArray(jsonData?.ResGuests?.ResGuest)){
        bookingStatusResdObj.status = "CONFIRMED";
        bookingStatusResdObj.title = jsonData?.Activities?.Activity?.BasicPropertyInfo?._attributes?.TourActivityName || "";
        let guestList = jsonData?.ResGuests?.ResGuest;
        let lineItemAgesInfo = [];

        for (let index = 0; index < guestList.length; index++) {                            
                let guestDob = guestList?.[index]?.Profiles?.ProfileInfo;
                let lineItemData = {
                    "ageBand": "",
                    "numberOfTravelers": 0,
                    "subtotalPrice": {
                        "price": {
                            "recommendedRetailPrice": 0,
                            "partnerNetPrice": 0
                        }
                    }
                };
                // adding the line items details
                if(guestDob != undefined){
                    lineItemData.ageBand = await handleLineItemAgeBand(guestDob);                                                                    
                    let userRates = jsonData?.Activities?.Activity?.ActivityRates?.ActivityRate?.Rates?.Rate?.TPA_Extensions;
                    // If seperate guest rates are mentioned need to add the guest rates and age can check
                    let {lineItemRecommendedRetailPrice, lineItemPartnerNetPrice } = await handleLineItemNetPrice(userRates, index);                                
                    lineItemData.subtotalPrice.price.recommendedRetailPrice = lineItemRecommendedRetailPrice;
                    lineItemData.subtotalPrice.price.partnerNetPrice = lineItemPartnerNetPrice;
                   
                    lineItemData.numberOfTravelers = 1;     
                    lineItemAgesInfo.push(lineItemData);                                                                                        
                };                                                        
        }
        
        bookingStatusResdObj.lineItems = lineItemAgesInfo ;        
         // Need to eliminate the duplicateobject
         const mergedLineItems = [];
         bookingStatusResdObj.lineItems?.forEach((item) => {
            const existingItem = mergedLineItems.find((mergedItem) => mergedItem.ageBand === item.ageBand);
          
            if (existingItem) {
                existingItem.numberOfTravelers += item.numberOfTravelers;
                existingItem.subtotalPrice.price.partnerNetPrice += item?.subtotalPrice?.price?.partnerNetPrice;
                existingItem.subtotalPrice.price.recommendedRetailPrice += item?.subtotalPrice?.price?.recommendedRetailPrice;
            } 
            else {
                mergedLineItems.push({ ...item }); // Create a new object to avoid modifying the original
            }
          });
          bookingStatusResdObj.lineItems = mergedLineItems ;
         // Adding the total price details
         let activityRate = jsonData?.ResGlobalInfo?.Total;
         //Function to add total price values
         let totalPriceVal =   await handleTotalPrice(activityRate);                          
         
        bookingStatusResdObj.totalPrice.price.recommendedRetailPrice = totalPriceVal || 0;
        bookingStatusResdObj.totalPrice.price.partnerNetPrice = totalPriceVal || 0;
        bookingStatusResdObj.totalPrice.price.bookingFee = 0;
        bookingStatusResdObj.totalPrice.price.partnerTotalPrice = totalPriceVal || 0;
         
         // Adding cancellationPolicy details
         bookingStatusResdObj.cancellationPolicy.description = await handleCancellationDescription(jsonData);
         
    }
    return await bookingStatusResdObj
}