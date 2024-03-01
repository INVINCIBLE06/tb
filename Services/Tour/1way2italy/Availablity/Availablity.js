"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const markupPrice = require("../markupCommission/tourMarkup.js")
const markupMoonstrideData = require("../markupCommission/Response.js");
const config = require("../../../../Config.js");

module.exports = async (app) => {
    app.post("/:id/Tour/1way2italy/ProductAvailability", async function (request, response, next) {
        await apiCommonController.viatorProductAvailabilityDetails(request, response, next);
    }, async function (request, response){
        // Defined the request fields.

        const clientId = request.params.id;
        let fName = "Availability_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_AVAILABILITY_PROVIDER_AVAILABILITY_FILE_PATH, config.Provider_Code_OWT);
        
        try{
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "OneWay2Italy");
            if (!providerDetails.Requestor_ID && !providerDetails.Password) {
                throw new Error(config.OWTApiKeyErrorMessage);
            }

            const requestObj = request.body;
            // Get response from api.
            let result = await apiResponse.getAvailabilityApiReponse(clientId, requestObj, 'tourActivityavail', providerDetails);
            // Checking if the response is success or error.
            if(result != undefined && result.Activities != undefined){
                // Format the response object for common format.
                let formatedData = await result_object_formatter(result, requestObj, clientId, request, providerDetails);
                // Checking formating is success or not.
                if(formatedData != undefined && formatedData.bookableItems.length != 0){
                    response.status(200).send({
                        "Result" : formatedData
                    });
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
            else if(result != undefined && result.Errors != undefined){
                response.status(200).send({
                    "Result": {
                        "Code": 500,
                        "Error": {
                            "Message": result?.Errors?.Error?._attributes?.ShortText || "No Availability Found."
                        }
                    }
                });
            }
            else{
                response.status(200).send({
                    "Result": {
                        "Code": 500,
                        "Error": {
                            "Message": result?.message || "No Availability Found."
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
        };        
    })
};

// Formating api response to common format.
async function result_object_formatter(resultData, requestObj, clientId, request, providerDetails){

    let fName = "Availability_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_AVAILABILITY_PROVIDER_AVAILABILITY_FILE_PATH, config.Provider_Code_OWT);
    let finalData = {};
    try{
        // Defined final result object.        
        let bookableItems = [];                

        // Some case we only have object insted of array so we will convert it to array.
        resultData = resultData?.Activities?.Activity;
        if(!Array.isArray(resultData)){
            resultData = [resultData]
        };

        // Checking the response has Activity object.
        let token = requestObj.msToken;
        let agentID = requestObj.agentGuid;

        let DBMarkupCommissionDataTest = false;
        if(agentID && agentID != ""){
            let supplierCurrency = "EUR" ?? requestObj.currency;
            DBMarkupCommissionDataTest = await markupMoonstrideData.getMarkupDbApiReponse(clientId, agentID, token, supplierCurrency, request, providerDetails);
        }
        if(DBMarkupCommissionDataTest){
            if(DBMarkupCommissionDataTest?.comapnyMarkup?.hasOwnProperty('Error') || DBMarkupCommissionDataTest?.agentmarkup?.hasOwnProperty('Error') || DBMarkupCommissionDataTest?.Error || typeof DBMarkupCommissionDataTest !== "object"){           
                DBMarkupCommissionDataTest = false;
            }            
        }
        
        if(resultData.length != 0){
            let bookableItemsData = await setBookableItems(clientId, bookableItems, resultData, requestObj, request, DBMarkupCommissionDataTest)
            bookableItems = bookableItemsData                  
                              
        }
        finalData.bookableItems = bookableItems;          
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
    };
    return(finalData);
};

// Function to handle itemdetails booking code
async function handleItemDetailBookingCode(singleResultData, itemDetails){
    let itemDetailsBookingCode = "";
    if(singleResultData?.ActivityRates?.ActivityRate != undefined){
        itemDetails.bookingCode = singleResultData?.ActivityRates?.ActivityRate?._attributes?.BookingCode || "";
    };
    itemDetailsBookingCode = itemDetails.bookingCode;
    return  itemDetailsBookingCode;
};

// Function to handle product option code
async function handleProductOptionCode(singleResultData, itemDetails){
    let productOptionCode = "";
    if(singleResultData?.ActivityRates?.ActivityRate != undefined){
        productOptionCode = await apiCommonController.productOptionCodeSplittingKeyAdding(singleResultData?.ActivityRates?.ActivityRate?._attributes?.ActivityTypeCode, itemDetails.productOptionCode);
    };
    return productOptionCode;
};

// Function to handle item descripton
async function handleItemDescription(itemDetails, singleResultData, resultData){
    let itemDetailsDescription ="";
    if(singleResultData?.ActivityTypes?.ActivityType?.ActivityDescription){
        itemDetails.description = singleResultData?.ActivityTypes?.ActivityType?.ActivityDescription?.Text?._text || "";
    };
    itemDetailsDescription = itemDetails.description;
    return(itemDetailsDescription);
};

// Function to handle detail travelers
async function handleItemDetailTraverlers(travelersAgeCount, guestRates, itemDetails, currencryconversationrate){
    // Ordering passenger details according to common structure.
    let itemDetailsTravelers = []
    if(travelersAgeCount.length != 0){
        for (let entry of travelersAgeCount) {
            for (let key in entry) {
                let { age, count } = entry[key];
                let partnerNetPrice = parseFloat(guestRates.find((item) => item?._attributes?.GuestAge === age.toString())?._attributes?.AmountAfterTax);                                
                partnerNetPrice = (partnerNetPrice * currencryconversationrate).toFixed(2);
                let travelersObj = {
                    "ageBand" : key,
                    "numberOfTravelers" : count,
                    "age" : age,
                    "subtotalPrice" : {
                        "recommendedRetailPrice" : count * partnerNetPrice,
                        "partnerNetPrice" : count * partnerNetPrice
                    }
                }
                itemDetails.travelers.push(travelersObj);                          
            };
        };
    };
    itemDetailsTravelers = itemDetails.travelers;
    return(itemDetailsTravelers);
}

// Function to handle item detail start time
async function handleItemDetailStartTime(singleResultData, itemDetails ){
    let itemDetailStartTime = "" ;
    if(singleResultData?.TPA_Extensions?.OpeningTimes != undefined){
        let openingTime = singleResultData?.TPA_Extensions?.OpeningTimes?.OpeningTime || [];
        // Some times we get object insted of array.
        if(openingTime != undefined && !Array.isArray(openingTime)){
            openingTime = [openingTime];
        };
        // Adding time object.                            
        if(openingTime != undefined && openingTime.length != 0){
            let startTime = [];
            for(const openingTimeItem of openingTime){
                let singleTime = openingTimeItem?._attributes?.FromTime || ""
                let timeObj = {
                    "label" : singleTime,
                    "value" : singleTime
                };
                startTime.push(timeObj);
            };
            itemDetails.startTime = startTime;
        };
    };
    itemDetailStartTime=itemDetails.startTime;
    return(itemDetailStartTime);
}

// Function to handle bookable items
async function handleBookableItems(cancellationObj, cancellationPolicy){
    if(cancellationObj != undefined && cancellationObj != ""){
        let dayRangeMin = `${cancellationObj?._attributes?.OffsetUnitMultiplier || 0} ${cancellationObj?._attributes?.OffsetTimeUnit || "Day"} ${cancellationObj?._attributes?.OffsetDropTime || "BeforeArrival"}` 
        let percentageRefundable = cancellationObj?.AmountPercent?._attributes?.Percent || 0;
        let cancelObj = {
            dayRangeMin,
            percentageRefundable
        }
        cancellationPolicy.refundEligibility.push(cancelObj);
    }
    else{
        let cancelObj = {
            dayRangeMin : "0",
            percentageRefundable : "0"
        }
        cancellationPolicy.refundEligibility.push(cancelObj);
    };
    return cancellationPolicy
}

// Convert to sentence case for title.
async function toSentenceCase(str) {
    // Ensure the string is not empty or null
    if (!str || typeof str !== "string") {
      return "";
    }
    // Convert the first character to uppercase and the rest to lowercase
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

async function setBookableItems(clientId, bookableItems, resultData, requestObj, request, DBMarkupCommissionDataTest){
    for(const resultDataItem of resultData){
        let singleResultData = resultDataItem;
        let itemDetails = {
            // Provider
            "provider" : requestObj.provider[0],
            "chainCode" : requestObj?.chainCode
        };
        // Setting provider code.
        itemDetails.productCode = singleResultData?.BasicPropertyInfo?._attributes.TourActivityCode;

        // Booking code.
        itemDetails.bookingCode = "";
        itemDetails.bookingCode = await handleItemDetailBookingCode(singleResultData, itemDetails);
                                 
        // Product option code
        itemDetails.productOptionCode = config.Default_OptionCode;
        itemDetails.productOptionCode = await handleProductOptionCode(singleResultData, itemDetails);               

        // Travel date.
        itemDetails.travelDate = singleResultData?.TimeSpan?._attributes?.Start;
        
        // Available or not available.
        itemDetails.available = true;               
        if(singleResultData?._attributes?.AvailabilityStatus !== "AvailableForSale"){                        
            itemDetails.available = false;
            itemDetails.unavailableReason = "";
        }                

        // Product title.
        itemDetails.title = await toSentenceCase(singleResultData?.BasicPropertyInfo?._attributes?.TourActivityName);

        // Description
        itemDetails.description = await handleItemDescription(itemDetails, singleResultData, resultData);                                

        // Price rate for traveler.
        let activityRate = singleResultData?.ActivityRates?.ActivityRate?.Rates;
        let guestRates = activityRate.Rate?.TPA_Extensions?.GuestRates?.GuestRate;
        if(!Array.isArray(guestRates)){
            guestRates = [guestRates];
        };        
                                                       
        // Total price summary.
        requestObj.pricingInfo = singleResultData?.ActivityRates?.ActivityRate?.Total;
        let accessToken = "";
        let currencryconversationrate = 1;
        let markupResponse = {}
        if(DBMarkupCommissionDataTest){
            currencryconversationrate = DBMarkupCommissionDataTest?.agentmarkup?.currancyconvertedfector ?? DBMarkupCommissionDataTest?.currancyconvertedfector?.currancyconvertedfector;

            markupResponse = await markupPrice.findAgentMarkupAndCommission(clientId, requestObj, accessToken, request, DBMarkupCommissionDataTest);                                    
        }

        // Price rate for traveler.                                                            
        let travelersAgeCount = requestObj.travelersAgeCount;
        // Traveler details array.
        itemDetails.travelers = [];
        let itemDetailsTravelers = await handleItemDetailTraverlers(travelersAgeCount, guestRates, itemDetails, currencryconversationrate);
        itemDetails.travelers = itemDetailsTravelers;

        // Currency
        itemDetails.currency = markupResponse?.AgentCurrencyCode ??  "EUR";
        
        let totalPriceObj = singleResultData?.ActivityRates?.ActivityRate?.Total;
        itemDetails = await setPriceSummary(itemDetails, totalPriceObj, markupResponse, currencryconversationrate);
        // Find the applied markup amount.
        if(itemDetails.travelers.length !=0 && markupResponse?.TotalSupplierCostAfterAgentMarkup){
            // finding the partner net price.
            let paxPriceArray = itemDetails.travelers.filter(item => item.subtotalPrice.partnerNetPrice !== 0);
            // find the total passenger price without markup.
            let totalPaxPrice = paxPriceArray.reduce((total, item) => total + item.subtotalPrice.partnerNetPrice, 0);
            // find the applied markup
            let totalPayableAmount = markupResponse?.TotalSupplierCostAfterAgentMarkup - totalPaxPrice;
            itemDetails.priceSummary.appliedMarkupPrice = totalPayableAmount;
            itemDetails.priceSummary.ExchangeRate = markupResponse?.currencryconversationrate ?? 0 
            
        }
        // We have multiple availability starting time
        itemDetails.startTime = [];
        itemDetails.startTime = await handleItemDetailStartTime(singleResultData, itemDetails);
       
        // Language guide.
        itemDetails.languageGuides = [];                    

        // Cancellation policies
        let cancellationObj = singleResultData?.CancelPenalties?.CancelPenalty;
        let cancellationPolicy = {
            "type": "",                
            "description": "",                
            "cancelIfBadWeather": false,                
            "cancelIfInsufficientTravelers": false,                
            "refundEligibility": []                
        };
        let cancellationPolicyResult= await handleBookableItems(cancellationObj, cancellationPolicy);
       
        itemDetails.cancellationPolicy = cancellationPolicyResult;
                                               
        // Add the arranged object to finalData array.
        bookableItems.push(itemDetails);                                                
    }
    return await bookableItems
}

async function setPriceSummary(itemDetails, totalPriceObj, markupResponse, currencryconversationrate){
    itemDetails.priceSummary = {
        "recommendedRetailPrice": (totalPriceObj?._attributes?.AmountAfterTax * currencryconversationrate) || "00",
        "partnerNetPrice": (totalPriceObj?._attributes?.AmountAfterTax * currencryconversationrate) || "00",
        "bookingFee": "00",
        "partnerTotalPrice": (Number.parseFloat(totalPriceObj?._attributes?.AmountAfterTax) * currencryconversationrate) || "00",
        "TotalSupplierCostAfterAgentMarkup" : markupResponse.TotalSupplierCostAfterAgentMarkup ?? (Number.parseFloat(totalPriceObj?._attributes?.AmountAfterTax) * currencryconversationrate),
        "markupPrice" : markupResponse.AgentMarkup || 0,
        "CompanyMarkup" : markupResponse?.CompanyMarkup,
        "TotalSupplierCostAfterCompanyMarkup" : markupResponse?.TotalSupplierCostAfterCompanyMarkup,
        "AgentCommission" : markupResponse?.AgentCommission,
        "TotalSupplierCostAfterAgentCommission" : markupResponse?.TotalSupplierCostAfterAgentCommission,
        "appliedMarkupPrice" : 0,
        "ExchangeRate" : 0 

    };
    return itemDetails
}