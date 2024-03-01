"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const fs  = require("fs");
const markupPrice = require("../markupCommission/tourMarkup.js")
const moment = require("moment");
const markupMoonstrideData = require("../markupCommission/Response.js");
const config = require("../../../../Config.js");

module.exports = async (app) => {
    app.post("/:id/Tour/Viator/ProductAvailability", async function (request, response, next) {
        // Validating request fields. 
        await apiCommonController.viatorProductAvailabilityDetails(request, response, next);
    }, async function (request, response) {
        // Defined the request fields.
        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "Availability_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_AVAILABILITY_PROVIDER_AVAILABILITY_FILE_PATH, config.Provider_Code_VTR);
        try {
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }
            // Defined the availability check url and product details url
            let availability = {
                "AvailabilityUrl" : 'availability/check',
                "productDetailsUrl" : `products/${requestObj.productCode}`
            };

            // Get response from viator api
            let result = await apiResponse.getAvailabilityApiReponse(clientId, providerDetails, availability, requestObj, request);

            if(result != undefined && result.AvailabilityDetails != undefined){
                // Format the response and send necessary data only.
                let parameters = {
                    result,
                    providerDetails,
                    requestObj,
                    clientId,
                    request,
                    fName,
                    fPath,
                    response
                }
                result = await result_object_formatter(parameters);
                if(result != undefined){
                    response.status(200).send({
                        "Result": result
                    });
                }
            }
            else if (result?.hasOwnProperty('message')) {
                    response.status(200).send({
                        "Result": {
                            "Code": 500,
                            "Error": {
                                "Message": result.message || "Internal Server Error"
                            }
                        }
                    });
            } 
            else {
                response.status(200).send({
                    "Result": {
                        "Code": 400,
                        "Error": {
                            "Message": result.message || "No data found"
                        }
                    }
                });
            }
        } 
        catch (error) {
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
}

// Format availability result object take only needed fields.
async function result_object_formatter({result, providerDetails, requestObj, clientId, request, fName, fPath, response}){
    try{
        // Defined response object to a avariable.
        let availability = result.AvailabilityDetails;
        let productDetails = result.productDetails;
        
        // Defined final result object.
        let finalData = {};
        finalData.bookableItems = [];

        let token = requestObj.msToken;
        let agentID = requestObj.agentGuid;

        let DBMarkupCommissionDataTest = false;

        if(agentID && agentID != ""){
            let supplierCurrency = availability.currency ?? requestObj.currency;
            DBMarkupCommissionDataTest = await markupMoonstrideData.getMarkupDbApiReponse(clientId, agentID, token, supplierCurrency, request, providerDetails);
        }
        if(DBMarkupCommissionDataTest){
            if(DBMarkupCommissionDataTest?.comapnyMarkup?.hasOwnProperty('Error') || DBMarkupCommissionDataTest?.agentmarkup?.hasOwnProperty('Error') || DBMarkupCommissionDataTest?.Error || typeof DBMarkupCommissionDataTest !== "object"){
            
                DBMarkupCommissionDataTest = false;

            }
        
        }
                
        // Checking the productoptions in the product details and bookable item in the availablity.
        if(productDetails.productOptions != undefined && availability.bookableItems != undefined){
            let parameters = {
                availability,
                productDetails,
                finalData,
                provider : providerDetails.ProviderCode,
                requestObj, 
                clientId, 
                request, 
                DBMarkupCommissionDataTest, 
                response, 
                fName, 
                fPath
            }
            let checkAvailabilityIfProductOption = await checkAvailabilityIfProductOptions(parameters)
            finalData = checkAvailabilityIfProductOption
        }
        // Else case. 
        else if(availability.bookableItems != undefined && productDetails.productOptions == undefined){

            for(let j = 0; j < availability.bookableItems.length; j++){      
                let itemDetails = {};   
                itemDetails.startTime = [];
                itemDetails.travelers = [];       
                let parameters = {
                    itemDetails, 
                    availability, 
                    j, 
                    productDetails, 
                    provider : providerDetails.ProviderCode, 
                    response, 
                    requestObj, 
                    request,
                    fName, 
                    fPath,
                    DBMarkupCommissionDataTest,
                    clientId
                }
                let itemdetailsData = await setItemDetails(parameters);                
                itemDetails = itemdetailsData
                finalData.bookableItems.push(itemDetails);
            }
        }
        // Returning the final data to display. 
        return(finalData);
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

// Read language data from a json file.
async function jsonFileRead(filePath, response, request, fName, fPath){
    return new Promise((resolve)=>{
        try{
            fs.readFile(process.cwd() + filePath, 'utf8', async(err, data) => {
                if(err) throw err;
                let guideLanguages = JSON.parse(data);
                guideLanguages = guideLanguages.languages;
                resolve(guideLanguages);
            })
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
    })
    
}

// Function for finding trip days count.
async function findNumberOfDaysOrDuration(productDetails, availability, option){
    try{
        let dateDuration = {}
        if(productDetails.itinerary){
            let itinerary = productDetails.itinerary;
            let duration;
            switch(itinerary.itineraryType){
                case  "MULTI_DAY_TOUR" :                                        
                    let days = itinerary.days.length;
                    let endDate = await calculateEndDate(availability.travelDate, days);
                    dateDuration.endDate = endDate;
                    break;
                case "STANDARD":
                case "ACTIVITY":                
                    duration = (itinerary.duration) ? itinerary.duration.fixedDurationInMinutes : 0;                    
                    dateDuration.duration = duration;
                    dateDuration.endDate = await findEndDateUsingDuration(availability.travelDate, duration);
                    break;
                case "HOP_ON_HOP_OFF":
                    duration = await functionForExtractDurationFromProductDetailsOptionForHopOnHopOFF(productDetails, option);
                    dateDuration.duration = duration;
                    dateDuration.endDate = await findEndDateUsingDuration(availability.travelDate, duration);
                    break;
                default:
                    break;
            }
        }
        return dateDuration;
    }
    catch(error){
        console.log(error);
    }
}

// Find duration for hop on hop of tours.
async function functionForExtractDurationFromProductDetailsOptionForHopOnHopOFF(productDetails, optionCode){
    let durationMinutes = 1440;
    if(productDetails.productOptions && optionCode != ""){
        let productOptions = productDetails.productOptions; 
        for(let option of productOptions){            
            if(option.productOptionCode == optionCode){
                const titleMatch = option.title.match(/\b\d+\s*day(?:s)?\b/i);
                let totalDuration = setTotalDuration(durationMinutes, titleMatch, option)
                durationMinutes = totalDuration
            }            
        }

    }
    return durationMinutes;
    
}

// Function for find end date using duration.
async function findEndDateUsingDuration(travelDate, duration){
    try{
        // Parse the start date using Moment.js
        let startDateMoment = moment(travelDate);

        // Calculate the end date by adding the duration in minutes
        let endDateMoment = startDateMoment.add(duration, 'minutes');

        // Format the end date as a string
        let endDate = endDateMoment.format('YYYY-MM-DD');

        return endDate;
    }
    catch(error){
        console.log(error);
    }
}

// Function for calculate end date.
async function calculateEndDate(startDate, numberOfDays) {
    try{
         // Parse the start date using Moment.js
        let startDateMoment = moment(startDate);
    
        // Calculate the end date by adding the specified number of days
        let endDateMoment = startDateMoment.add(numberOfDays, 'days');
    
        // Format the end date as a string
        let endDate = endDateMoment.format('YYYY-MM-DD');
    
        return endDate;
    }
    catch(error){
        console.log(error);
    }
}

// Function for check availability if productOptions.
async function checkAvailabilityIfProductOptions({availability, productDetails, finalData, provider, requestObj, clientId, request, DBMarkupCommissionDataTest, response, fName, fPath}){    
    // Start looping through product option code in the product details object.
    for(let i = 0; i < productDetails.productOptions.length; i++){
        // Start looping through the availability bookable items.
        let itemDetails = {};
        let startTime = [];
        // Checking the bookable items in the availability.
        for(let j = 0; j < availability.bookableItems.length; j++){
            let parameters = {
                clientId, 
                provider, 
                availability, 
                i, 
                j, 
                itemDetails, 
                startTime, 
                productDetails, 
                requestObj, 
                request, 
                DBMarkupCommissionDataTest
            }
            let itemDetailsData = await itemDetailsDataHavingProductCode(parameters)
            // Checking product option code is same in the availibility product option code. 
            itemDetails = itemDetailsData.itemDetails;
            startTime = itemDetailsData.startTime;               
        }
        // Adding language guide
        let languageGuide = await setLanguageGuide(productDetails, response, request, fName, fPath, itemDetails)
        itemDetails = languageGuide;

        if(itemDetails?.hasOwnProperty("productOptionCode")){
            finalData.bookableItems.push(itemDetails);
        }
    }
    return await finalData

}

// Function for set unavailable reason.
async function setUnavailableReason(j, availability, itemDetails){
    // If the product is not available adding an unavailable reason
    switch(availability.bookableItems[j].unavailableReason){
        case "NOT_OPERATING":
            itemDetails.unavailableReason = "The product is not operating on this date";
            break;
        case "SOLD_OUT":
            itemDetails.unavailableReason = "This option is unavailable because it has sold out";
            break;
        case "PAST_BOOKING_CUTOFF":
            itemDetails.unavailableReason = "It is too near to the product's starting time to book this item";
            break;
        case "TRAVELER_MISMATCH":
            itemDetails.unavailableReason = "This item is not available for the specified passenger Details";
            break;
        case "UNKNOWN":
        default:
            itemDetails.unavailableReason = "The reason is unknown";
            break;
    }
    return await itemDetails
}

// Function for set traveler ageband.
async function setTravelerAgeBand(k, availabilityItem, totalPriceObject){
    let traveler = {};
    let numberOfTravelers = (availabilityItem[k].numberOfTravelers) ? availabilityItem[k].numberOfTravelers : 0;

    // Checking the age band and add the number of travalers.
    switch(availabilityItem[k].ageBand){
        case "ADULT":
            traveler.ageBand = "ADULT";
            traveler.numberOfTravelers = numberOfTravelers;
            traveler.subtotalPrice = (availabilityItem[k].subtotalPrice.price) ? availabilityItem[k].subtotalPrice.price : {};
            traveler.subtotalPrice.partnerTotalPrice = totalPriceObject?.partnerTotalPrice;
            break;
        case "CHILD":
            traveler.ageBand = "CHILD";
            traveler.numberOfTravelers = numberOfTravelers
            traveler.subtotalPrice = (availabilityItem[k].subtotalPrice.price) ? availabilityItem[k].subtotalPrice.price : {};
            traveler.subtotalPrice.partnerTotalPrice = totalPriceObject?.partnerTotalPrice;
            break;
        case "TRAVELER":
            traveler.ageBand = "TRAVELER";
            traveler.numberOfTravelers = numberOfTravelers
            traveler.subtotalPrice = (availabilityItem[k].subtotalPrice.price) ? availabilityItem[k].subtotalPrice.price : {};
            traveler.subtotalPrice.partnerTotalPrice = totalPriceObject?.partnerTotalPrice;
            break;
        case "INFANT":
            traveler.ageBand = "INFANT";
            traveler.numberOfTravelers = numberOfTravelers
            traveler.subtotalPrice = (availabilityItem[k].subtotalPrice.price) ? availabilityItem[k].subtotalPrice.price : {};
            traveler.subtotalPrice.partnerTotalPrice = totalPriceObject?.partnerTotalPrice;
            break;
        default:                                            
            break;
    }
    return traveler;
}

// Function for set item details
async function setItemDetails({itemDetails, availability, j, productDetails, provider, response, requestObj, request, fName, fPath, DBMarkupCommissionDataTest, clientId}){

    // Setting up the provider, product code, available etc..
    itemDetails.provider = provider
    itemDetails.productCode = availability.productCode;
    itemDetails.travelDate = availability.travelDate;
    itemDetails.currency = availability.currency;
    // If the product is available
    if(availability.bookableItems[j].available){
        itemDetails.available = availability.bookableItems[j].available;
    }
    else{
        itemDetails.available = availability.bookableItems[j].available;
        let unavailableReason = await setUnavailableReason(j, availability, itemDetails)
        itemDetails = unavailableReason
    }

    // Adding product title and descriptions.
    itemDetails.title = productDetails.title;
    itemDetails.description = "";
    let optCode = await apiCommonController.productOptionCodeGenerator("");
    itemDetails.productOptionCode = await apiCommonController.productOptionCodeSplittingKeyAdding(availability.productCode, optCode)

    // Setting the start time.
    if(availability.bookableItems[j].startTime){
        let timeObj = {
            "label" : availability.bookableItems[j].startTime,
            "value" : availability.bookableItems[j].startTime
        }
        itemDetails.startTime.push(timeObj);
    }

    // Adding ageBand and number of travelers.
    let availabilityItem  = availability.bookableItems[j].lineItems;
    let totalPriceObject = availability.bookableItems[j]?.totalPrice?.price ?? {}
    for(let k = 0; k < availabilityItem.length; k++){
        // Checking the age band and add the number of travalers.
        let travelerAgeBand = await setTravelerAgeBand(k, availabilityItem, totalPriceObject)
        itemDetails.travelers.push(travelerAgeBand)
    }

    let languageGuide = await setLanguageGuide(productDetails, response, request, fName, fPath, itemDetails)
    itemDetails = languageGuide;
    
    // Adding price details
    let availabilityTotalPrice = availability.bookableItems[j].totalPrice;

    let dayOrDurationFinder = await findNumberOfDaysOrDuration(productDetails, availability, "");

    requestObj.endDate = dayOrDurationFinder.endDate;
    requestObj.duration = dayOrDurationFinder.duration;

    let accessToken = "";
    requestObj.pricingInfo = availabilityTotalPrice;
    requestObj.startTime = availability.bookableItems[j].startTime || "";

    let markupResponse = {};
    if(DBMarkupCommissionDataTest){
        markupResponse = await markupPrice.findAgentMarkupAndCommission(clientId, requestObj, accessToken, request, DBMarkupCommissionDataTest);

    }

    itemDetails.priceSummary = {};
    if(availabilityTotalPrice){
        itemDetails.priceSummary = availabilityTotalPrice.price;
        itemDetails.priceSummary.TotalSupplierCostAfterAgentMarkup = markupResponse?.TotalSupplierCostAfterAgentMarkup ?? availabilityTotalPrice.price.partnerTotalPrice;
        itemDetails.priceSummary.markupPrice = markupResponse?.AgentMarkup ?? 0;
        itemDetails.priceSummary.CompanyMarkup = markupResponse?.CompanyMarkup;
        itemDetails.priceSummary.TotalSupplierCostAfterCompanyMarkup = markupResponse?.TotalSupplierCostAfterCompanyMarkup;
        itemDetails.priceSummary.AgentCommission = markupResponse?.AgentCommission;
        itemDetails.priceSummary.TotalSupplierCostAfterAgentCommission = markupResponse?.TotalSupplierCostAfterAgentCommission;
        itemDetails.priceSummary.appliedMarkupPrice = 0;
        itemDetails.priceSummary.ExchangeRate = 0;
    }
    // Find the markup amount.
    if(itemDetails.travelers.length !=0 && markupResponse?.TotalSupplierCostAfterAgentMarkup){
        // Get total supplier price.
        let totalPaxPrice = markupResponse?.SupplierConvertedCost;
        // Find markup added price.
        let totalPayableAmount = markupResponse?.TotalSupplierCostAfterAgentMarkup - totalPaxPrice;
        // Applied markup
        itemDetails.priceSummary.appliedMarkupPrice = totalPayableAmount;  
        // Exchnage rate.
        itemDetails.priceSummary.ExchangeRate = markupResponse?.currencryconversationrate ?? 0             
    }

    itemDetails.currency = markupResponse?.agentcurrancycode || requestObj?.currency;
    return itemDetails;
}

// Function for set language guide in item details
async function setLanguageGuide(productDetails, response, request, fName, fPath, itemDetails){
    // Adding language guides
    if(productDetails.languageGuides != undefined && itemDetails.productOptionCode){
        // Read languages from json file and map.
        let JsonResponse = await jsonFileRead(`${config.viator_Language_Guide_Json}`, response, request, fName, fPath);

        // Map each guide type to guide languages.
        itemDetails.languageGuides = [];
        
        let optionCode = itemDetails.productOptionCode;
        if(optionCode.includes("_")){
            optionCode = itemDetails.productOptionCode.split('_')[1]
        }
        let lang;
        if(productDetails?.productOptions){
            lang = productDetails.productOptions.find(item => item.productOptionCode == optionCode);
        }
        if(lang){            
            itemDetails = await formatLanguageGuide(JsonResponse,lang.languageGuides, itemDetails)
  
        }
        else{
            
            itemDetails = await formatLanguageGuide(JsonResponse,productDetails.languageGuides, itemDetails)   
             
        }
    }
    else{
        itemDetails.languageGuides = [];
        let languageGuides = {
            "languageType" : "Null",
            "languages" : []
        }
        itemDetails.languageGuides.push(languageGuides);
    }
    return await itemDetails;
}

// Functions for item details which having productcode
async function itemDetailsDataHavingProductCode({clientId, provider, availability, i, j, itemDetails, startTime, productDetails, requestObj, request, DBMarkupCommissionDataTest}){

    if(productDetails.productOptions[i].productOptionCode == availability.bookableItems[j].productOptionCode){
        // Setting up the provider, productCode, productOptionCode, travelDate, currency these are basic for all products.
        itemDetails.provider = provider;
        itemDetails.productCode = availability.productCode;
        itemDetails.productOptionCode = await apiCommonController.productOptionCodeSplittingKeyAdding(availability.productCode, availability?.bookableItems[j]?.productOptionCode);
        itemDetails.travelDate = availability.travelDate;
        itemDetails.currency = availability.currency || "GBP";
        // product availability checking function
        itemDetails = await checkingAvailabeProductsFunction(availability, j, itemDetails, startTime);

        let basicDetails = await setBasicDetails(itemDetails, productDetails, availability, i, j)
        itemDetails = basicDetails
             
        // Total price of product 
        let availabilityTotalPrice = availability.bookableItems[j].totalPrice;
        // Adding markup price
        let accessToken = "";                                
        let dayOrDurationFinder = await findNumberOfDaysOrDuration(productDetails, availability, availability.bookableItems[j].productOptionCode);
        requestObj.endDate = dayOrDurationFinder.endDate;
        requestObj.duration = dayOrDurationFinder.duration;
        
        requestObj.startTime = availability.bookableItems[j].startTime || "";
        requestObj.pricingInfo = availabilityTotalPrice;
        // Adding markup if markup response is available.
        let markupResponse = {}

        if(DBMarkupCommissionDataTest){            
            markupResponse = await markupPrice.findAgentMarkupAndCommission(clientId, requestObj, accessToken, request, DBMarkupCommissionDataTest);
        }

        itemDetails.priceSummary = {};
        if(availabilityTotalPrice != undefined){
            itemDetails.priceSummary = availabilityTotalPrice.price;
            itemDetails.priceSummary.TotalSupplierCostAfterAgentMarkup = markupResponse?.TotalSupplierCostAfterAgentMarkup ?? availabilityTotalPrice.price.partnerTotalPrice;
            itemDetails.priceSummary.markupPrice = markupResponse?.AgentMarkup ?? 0;
            itemDetails.priceSummary.CompanyMarkup = markupResponse?.CompanyMarkup;
            itemDetails.priceSummary.TotalSupplierCostAfterCompanyMarkup = markupResponse?.TotalSupplierCostAfterCompanyMarkup;
            itemDetails.priceSummary.AgentCommission = markupResponse?.AgentCommission;
            itemDetails.priceSummary.TotalSupplierCostAfterAgentCommission = markupResponse?.TotalSupplierCostAfterAgentCommission;
            itemDetails.priceSummary.appliedMarkupPrice = 0;
            itemDetails.priceSummary.ExchangeRate =  0;
        }
        // Find the markup amount.
        if(itemDetails.travelers.length !=0 && markupResponse?.TotalSupplierCostAfterAgentMarkup){
            // Get total supplier price.
            let totalPaxPrice = markupResponse?.SupplierConvertedCost;
            // Find markup added price.
            let totalPayableAmount = markupResponse?.TotalSupplierCostAfterAgentMarkup - totalPaxPrice;
            // Applied markup
            itemDetails.priceSummary.appliedMarkupPrice = totalPayableAmount;  
            // Exchnage rate.
            itemDetails.priceSummary.ExchangeRate = markupResponse?.currencryconversationrate ?? 0           
        }
        
       
        // We have multiple availibility starting time.
        if(availability.bookableItems[j].startTime && availability.bookableItems[j].available){
            let timeObj = {
                "label" : availability.bookableItems[j].startTime,
                "value" : availability.bookableItems[j].startTime
            }
            startTime.push(timeObj);
            itemDetails.startTime = startTime;
        }
    }   
    return {
        "itemDetails" : await itemDetails,
        "startTime" : await startTime
    }
}

// function for find available product and unavailable reason 
async function checkingAvailabeProductsFunction(availability, j, itemDetails, startTime){
    // If the product is available
    if(availability.bookableItems[j].available){
        itemDetails.available = availability.bookableItems[j].available;
    }
    else{
        itemDetails.available = availability.bookableItems[j].available;
        // If the product is not available adding an unavailable reason
        // Check for if same product have available and not availabel case only the time is different so need to check the time.
        if(startTime.includes(itemDetails.available.startTime)){
            let unavailableReason = await setUnavailableReason(j, availability, itemDetails)
            itemDetails = unavailableReason
        }
        
    }
    return itemDetails;
}

// Functions for basic item details which having productcode
async function setBasicDetails(itemDetails, productDetails, availability, i, j){
    // Adding product titile and description.
    itemDetails.title = (productDetails.productOptions[i].title != undefined) ? productDetails.productOptions[i].title : "";
    itemDetails.description = (productDetails.productOptions[i].description) ? productDetails.productOptions[i].description : "";

    // Age band and traveler number object adding.
    let availabilityItem  = availability.bookableItems[j].lineItems;
    let totalPriceObject = availability.bookableItems[j]?.totalPrice?.price ?? {};
    itemDetails.travelers = [];
    if(availabilityItem != undefined){
        for(let k = 0; k < availabilityItem.length; k++){
            let travelerAgeBand = await setTravelerAgeBand(k, availabilityItem, totalPriceObject)
            itemDetails.travelers.push(travelerAgeBand)
        }
    }
    else{
        let traveler = {
            "ageBand" : "Null",
            "numberOfTravelers" : "Null"
        };
        itemDetails.travelers.push(traveler)
    }
    return await itemDetails
}

// Function for set total duration
function setTotalDuration(durationMinutes, titleMatch, option){
    if (titleMatch) {
        const days = parseInt(titleMatch[1], 10);
        durationMinutes = days * 24 * 60; // Convert days to minutes
    }
    else {
        const descriptionMatch = option.description.match(/\b\d+\s*days?\b/i);
        if (descriptionMatch) {
            const days = parseInt(descriptionMatch[1], 10);
            durationMinutes = days * 24 * 60; // Convert days to minutes
        }
    }
    return durationMinutes
}

// set language guide in specified format
async function formatLanguageGuide(JsonResponse,languageGuides, itemDetails){
    try {
        for(let language of languageGuides){
            let languageLabel = JsonResponse[language.language];
            if(languageLabel){
                // Checking the array have values. if values find then append with it, else add it to new.
                let guide = itemDetails.languageGuides.find((guide) => guide.languageType === language.type);
                // Checking the languages array is true or not.
                if(guide){
                    // If the languages array is alread exist then add new value to it.
                    guide.languages.push({
                    label: languageLabel,
                    value: language.language
                    });
                }
                else {
                    // If it is not exists then push new values.
                    itemDetails.languageGuides.push({
                        languageType: language.type,
                        languages: [{
                            "label" : languageLabel,
                            "value" : language.language
                        }]
                    });
                }
            }
        }
        return itemDetails;
    }
    catch (error) {
        console.log(error);    
    }    
}