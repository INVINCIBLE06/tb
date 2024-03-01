"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const xml2json = require("xml-js");
const config = require("../../../../Config.js");

module.exports = async (app) => {
    app.post("/:id/Tour/1way2italy/ProductDetails", async function (request, response, next) {
        // Validating request fields. 
        await apiCommonController.viatorSearchProductDetails(request, response, next);
    }, async function (request, response) {

        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "Details_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DETAILS_PROVIDER_DETAILS_FILE_PATH, config.Provider_Code_OWT);

        try{
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "OneWay2Italy");
            if (!providerDetails.Requestor_ID && !providerDetails.Password) {
                throw new Error(config.OWTApiKeyErrorMessage);
            };
            let productCode = requestObj.productCode;
            if(productCode.includes('|')){
                productCode = productCode.split('|')[0];
            }
            let chainCode = requestObj.chainCode;
            if(chainCode.includes('_')){
                chainCode = chainCode.split('_')[0];
            }

            let requestData = {
                "url" : "touractivitydescriptiveinfo",
                "chainCode" : chainCode,
                "productCode" : productCode
            }
            let detailsApiResponse = await apiResponse.getProductDetailsApiResponse(clientId, requestData, providerDetails);
            if(detailsApiResponse && detailsApiResponse?.code !== "ECONNRESET"){
                let convertedJsonData = await convertXmlDataToJsonFormat(clientId, detailsApiResponse, request);
                handleResultData(convertedJsonData, request, response, clientId, providerDetails);                
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
}

//Function to convert xml to json
async function convertXmlDataToJsonFormat(clientId, xmlData, request){
    let fName = "Details_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DETAILS_PROVIDER_DETAILS_FILE_PATH, config.Provider_Code_OWT);
    try{                
        let options = {
            ignoreComment: true,
            compact: true,
            spaces: 2,
            explicitArray: true
        };
        let convertedJsonData = xml2json.xml2json(xmlData, options);
        convertedJsonData = JSON.parse(convertedJsonData);
        return(convertedJsonData);                
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
        return(errorObject); 
    }
};
// Function to format the result
async function resultObjectFormatting(clientId, data, request, providerDetails){
    let fName = "Details_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DETAILS_PROVIDER_DETAILS_FILE_PATH, config.Provider_Code_OWT);
    try{
        if(data != undefined && data.TourActivityDescriptiveContent != undefined){
            let responseData = data.TourActivityDescriptiveContent;
            // Defined an empty object for result.
            let finalData = {};                    

            let ScreenConfiguration = {
                "userReviewsShow" : providerDetails.userReviewsShow,
                "whatToExpect" : providerDetails.whatToExpect,
                "showCancellationPolicy" : providerDetails.showCancellationPolicy,
                "showSupplier" : providerDetails.showSupplier
            }
            finalData.ScreenConfiguration = ScreenConfiguration;

            finalData.status = "Active";
            // Formatting the result accordingly.

            finalData.productCode = responseData?._attributes?.TourActivityCode || "";
            finalData.title = responseData?._attributes?.TourActivityName || "";
            // Get images from productdetails object.
            finalData.images = await handleProductImages(responseData, finalData);
            // Get supplioer details from supplier details object.
            finalData.supplierName = "Null";
            finalData.contact = {
                "email" : "Null",
                "address" : "Null",
                "phone" : "Null"
            };

            // Adding user reviews and star ratting.
            finalData.numberOfReviews = 0;
            finalData.combinedAverageRating = 0;

            // Adding basic tour details.
            finalData.tourDetails = {                        
                "itineraryType" : responseData?._attributes?.CategoryCodeDetail || "Null",
                "maxGroupSize" : "Null",                        
            };
            finalData.tourDetails.description = await handleTourDescription(responseData, finalData);    


            // Cancellation policy                   
            let {cancellationPolicy, cancelPolicyGuideLines} = await handleCancelPolicyGuidelines(responseData);             
            finalData.cancellationPolicy = cancellationPolicy;                    
            finalData.tourDetails.cancellationPolicy = cancelPolicyGuideLines;

            // child policies 
            let childPolicy = await handleChildPolicies(responseData)
            finalData.childPolicy = childPolicy
            
            // Adding itenary type description                    
            finalData.tourDetails.itineraryTypeDescription = "Null";

            // Ticket info like paper ticket or mobile ticket etc..
            finalData.ticketInfo = {}; 

            // Adding duration.                    
            finalData.tourDetails.duration = await handleDuration(responseData, finalData);

            // Adding guide language count and guide type.
            let languageGuides = await handleLanguageGuides(responseData)
            finalData.tourDetails.languageGuides = languageGuides;

            // Adding pricing ageband info.
            let ageBand = responseData?.TPA_Extensions?.PriceAgeBands?.PriceAgeBand || [];
            let {ageRangeFrom, ageRangeTo} = await handlePriceAgeBand(ageBand,finalData);
            finalData.tourDetails.ageRangeFrom = ageRangeFrom;
            finalData.tourDetails.ageRangeTo = ageRangeTo;
            // Availability check criteria per person or who can travel info                    
            let availabilityTypePerPerson = {};
            let availabilityPerPerson = responseData?.TPA_Extensions?.PriceAgeBands?.PriceAgeBand || [];
            if(!Array.isArray(availabilityPerPerson)){
                availabilityPerPerson = [availabilityPerPerson];
            }
            if(availabilityPerPerson.length == 1){
                availabilityPerPerson = await convertAgeArray(availabilityPerPerson);
            }
            // Age band.              
            availabilityTypePerPerson.type = "PER_PERSON";
            let ageBands = [];

            // Categorise age band based on ageBand array count and min and max
            ageBands = await categorisePersonsAge(availabilityPerPerson, ageBands);
                                               
            availabilityTypePerPerson.ageBands = ageBands;

            finalData.availabilityTypePerPerson = availabilityTypePerPerson;

            // Product tags
            finalData.tags = [];
            
            // Booking requirements                    
            finalData.bookingRequirements = {
                "minTravelersPerBooking": 1,
                "maxTravelersPerBooking": "Null",
                "requiresAdultForBooking": true
            };

            // Adding booking questions                    
            finalData.bookingQuestions = [];
            let itineraryTypeVal = responseData?._attributes?.CategoryCodeDetail || "";
            let bookingQuestions = await handleBookingQuestions(itineraryTypeVal, finalData);
            finalData.bookingQuestions = bookingQuestions;     

            // Some product don't have start point or end poin.                    
            let startPoint = await handleTourStartPoint(responseData)                   
            finalData.tourDetails.startPoint = startPoint;

            // Start and end of tour.                    
            let endingPoint = await handleTourEndingPoint(responseData)                   
            finalData.tourDetails.endingPoint = endingPoint;            

            // Pickup point                        
            finalData.pickUpPoint = {
                "pickupOptionType" : "Null",
                "allowCustomTravelerPickup" : "Null",
                "minutesBeforeDepartureTimeForPickup" : "Null",
                "additionalInfo" : "Null",
                "specialInstructions" : "Null",
                "pickupLocations" : []

            }
            // Some product don't have inclussion object.
            let inclusions = await handleInclusions(responseData)
            finalData.inclusions = inclusions;       
            
            // Some product don't have exclusions object
            let exclusions = await handleExclusion(responseData)
            finalData.exclusions = exclusions;
            
            // What to expect
            let itineraryItemWhatToExpect = {
                "stopName" : "",
                "duration" : "",
                "passByWithoutStopping" : "Null",
                "admissionIncluded" : "Null",
            };
            itineraryItemWhatToExpect = await handleItineraryItemWhatToExpect(responseData, itineraryItemWhatToExpect);
            finalData.whatToExpect = [itineraryItemWhatToExpect];
                
            // Additional information of the prodct. 
            finalData.additionalInformation = [];
            let additionalInformation = await handleAdditionalInformation(responseData, finalData);          
            finalData.additionalInformation = additionalInformation;
            // User reviews of the product.
            finalData.userReviews = [];

            // productOptions 
            finalData.productOptions = [];

            // Some product don't have review count.
            finalData.reviewCountTotals = []

            // Return final result.
            return(finalData);
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
        return(errorObject);
    }
};

 // Function to convert the original array into three objects based on specified ranges
 async function convertAgeArray(arr) {
    const newObj = arr[0]._attributes;
    const resultArray = [];
    
    if (parseInt(newObj.min) === 0 && parseInt(newObj.max) >= 80) {
        resultArray.push({ _attributes: { min: '0', max: '3' } });
        resultArray.push({ _attributes: { min: '4', max: '17' } });
        resultArray.push({ _attributes: { min: '18', max: newObj.max } });
    } 
    else if(parseInt(newObj.min) >= 5 && parseInt(newObj.min) <= 17 && parseInt(newObj.max) >= 80){
        resultArray.push({ _attributes: { min: newObj.min, max: '17' } });
        resultArray.push({ _attributes: { min: '18', max: newObj.max } });
    }
    else if(parseInt(newObj.min) > 17){
        resultArray.push({ _attributes: { min: newObj.min, max: newObj.max } });
    }
    else {
        // If the condition doesn't match, keep the original object
        resultArray.push(arr[0]);
    }

    return resultArray;
}

// Function to handle result data
async function handleResultData(convertedJsonData, request, response, clientId, providerDetails){
    if(convertedJsonData != undefined && convertedJsonData?.OTAX_TourActivityDescriptiveInfoRS?.Success != undefined){
        let resultData = convertedJsonData?.OTAX_TourActivityDescriptiveInfoRS?.TourActivityDescriptiveContents;

        // Result object formatting
        let finalResult = await resultObjectFormatting(clientId, resultData, request, providerDetails);
        if(finalResult != undefined && finalResult.status == "Active"){
            response.status(200).send({
                "Result": finalResult
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
    else{
        let error = convertedJsonData?.OTAX_TourActivityDescriptiveInfoRS?.Errors?.Error?._attributes?.ShortText;
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error || "No Data Found"
            }
        }
        response.status(400).send(errorObject) 
    };
    return null;
};
// Function to get images from product details
async function handleProductImages(responseData, finalData) {
    finalData.images = [];
    try {
        if (responseData.MultimediaDescriptions?.MultimediaDescription) {
            let imageArr = responseData.MultimediaDescriptions.MultimediaDescription;
            if(!Array.isArray(responseData.MultimediaDescriptions?.MultimediaDescription)){
                imageArr = [responseData.MultimediaDescriptions?.MultimediaDescription];
            }
    
            if (Array.isArray(imageArr) && imageArr.length > 0) {
                finalData.images = imageArr.map(item => item?.ImageItems?.ImageItem?.ImageFormat?.URL?._text || null);
            }
        } else if (responseData.MultimediaDescriptions?.MultimediaDescription?.ImageItems) {
            let imageObj = responseData.MultimediaDescriptions.MultimediaDescription.ImageItems.ImageItem;
            finalData.images = [imageObj?.ImageFormat?.URL?._text || ""];
        }
    }
    catch (error) {
        finalData.images = [];
        // Handle error safely and add logs
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error?.message || ""
            }
        };
        apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));      
    }
    
    return finalData.images;
}

// Function to add tourdetail description
async function handleTourDescription(responseData, finalData){

    finalData.tourDetails.description = "";
    try {
        if (responseData?.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription) {

            let descriptions = responseData.TourActivityInfo.Descriptions.MultimediaDescriptions.MultimediaDescription;
            if (Array.isArray(descriptions)) {
    
                let descriptionText = descriptions.filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "DESC")
                .map(item => item?.TextItems?.TextItem?.Description?._text || null);
    
                finalData.tourDetails.description = descriptionText[0] || "";
            }else if(descriptions.TextItems && descriptions.TextItems.TextItem){
                finalData.tourDetails.description = descriptions.TextItems.TextItem.Description?._text || "";
    
            } 
        }
    }
    catch (error) {
        finalData.tourDetails.description = "";
        // Handle error safely and add logs
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error?.message || ""
            }
        };
        apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));      
    }   

    return finalData.tourDetails.description;
};


// Function to handle cancellation guidelines
async function handleCancelPolicyGuidelines(responseData) {
    let cancellationPolicy = {
        "type": "",
        "description": "",
        "cancelIfBadWeather": "",
        "cancelIfInsufficientTravelers": "",
        "refundEligibility": [
            {
                "dayRangeMin": 0,
                "percentageRefundable": 0
            }
        ]
    };
    let cancelPolicyGuideLines = {
        "cancellation": "",
        "policyGuidelines" : []
    };
    try {
        if (responseData.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription) {
            let cancellationDescription = responseData.TourActivityInfo.Descriptions.MultimediaDescriptions.MultimediaDescription;
    
            if (Array.isArray(cancellationDescription)) {
                let cancellation = cancellationDescription
                    .filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "CANCELLATION_POLICIES")
                    .map(item => item?.TextItems?.TextItem?.Description?._text || null);
    
                    cancellationPolicy.type = "";
                    cancellationPolicy.description = cancellation[0] || "";
                    cancellationPolicy.cancelIfBadWeather = "";
                    cancellationPolicy.cancelIfInsufficientTravelers = "";
                    cancellationPolicy.refundEligibility = [];
                    cancelPolicyGuideLines.cancellation = cancellation[0] || "";
                    cancelPolicyGuideLines.ploicyGuidelines = [];
    
            } else if (cancellationDescription.TextItems && cancellationDescription.TextItems.TextItem._attributes.SourceID === "CANCELLATION_POLICIES") {
                    cancellationPolicy.type = "";
                    cancellationPolicy.description = cancelObj?.TextItem?.Description?._text || "";
                    cancellationPolicy.cancelIfBadWeather = "";
                    cancellationPolicy.cancelIfInsufficientTravelers = "";
                    cancellationPolicy.refundEligibility = [];
                    cancelPolicyGuideLines.cancellation = cancelObj?.TextItem?.Description?._text || "";
                    cancelPolicyGuideLines.policyGuidelines = [];
            }
        }
    }
    catch (error) {
        cancellationPolicy ={
            "type": "",
            "description": "",
            "cancelIfBadWeather": "",
            "cancelIfInsufficientTravelers": "",
            "refundEligibility": [
                {
                    "dayRangeMin": 0,
                    "percentageRefundable": 0
                }
            ]
        };
        cancelPolicyGuideLines = {
            "cancellation": "",
            "ploicyGuidelines" : []
        };
        // Handle error safely and add logs
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error?.message || ""
            }
        };
        apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
    }
    
    return { "cancellationPolicy": cancellationPolicy, "cancelPolicyGuideLines": cancelPolicyGuideLines };
}


// Function to handle price ageband
async function handlePriceAgeBand(ageBand,finalData){
    if(!Array.isArray(ageBand)){
        ageBand = [ageBand];
    }                    
    if(ageBand.length != 0){
        let minAgeband = ageBand.map(obj => parseInt(obj._attributes.min));
        let maxAgeband = ageBand.map(obj => parseInt(obj._attributes.max));                        
        // Find minimum and maximum values using spread operator and Math functions
        let min = Math.min(...minAgeband);
        let max = Math.max(...maxAgeband);
        if(min == 0){
            min = 1
        }
        
        finalData.tourDetails.ageRangeFrom = min;                        
        finalData.tourDetails.ageRangeTo = max;
    }
    else{
        finalData.tourDetails.ageRangeFrom = 1;                        
        finalData.tourDetails.ageRangeTo = 99;
    };
    let ageRangeFrom = finalData.tourDetails.ageRangeFrom;
    let ageRangeTo = finalData.tourDetails.ageRangeTo;
    return {ageRangeFrom:ageRangeFrom, ageRangeTo:ageRangeTo};
}
// Function to categorise persons age
async function categorisePersonsAge(availabilityPerPerson, ageBands){
    // Categorise age band according to moonstride age standard, ADULT, CHILD, INFANT
    if(availabilityPerPerson.length != 0){     
        ageBands = await handleAgeBand(availabilityPerPerson, ageBands)           
    }   
    // Sorting by alphabetic order.
    ageBands = ageBands.sort((a, b) => a.ageBand.localeCompare(b.ageBand));

    return ageBands
};
// Age band categorisaton.
async function handleAgeBand(availabilityPerPerson, ageBands){
    if(availabilityPerPerson.length == 5){
        let sortedAgeArray = availabilityPerPerson.sort((a, b) => parseInt(a._attributes.min) - parseInt(b._attributes.min));
        // Infant 
        let infantAge = {
            "ageBand" : "INFANT",
            "startAge" : sortedAgeArray[0]._attributes.min,
            "endAge" : sortedAgeArray[0]._attributes.max,
            "minTravelersPerBooking" : 0,
            "maxTravelersPerBooking" : "Null",
        };
        ageBands.push(infantAge);

        // Child
        let childAge = {
            "ageBand" : "CHILD",
            "startAge" : sortedAgeArray[1]._attributes.min,
            "endAge" : sortedAgeArray[1]._attributes.max,
            "minTravelersPerBooking" : 0,
            "maxTravelersPerBooking" : "Null",
        };
        ageBands.push(childAge);

        // Adult
        let adultAge = {
            "ageBand" : "ADULT",
            "startAge" : (sortedAgeArray[2]._attributes.min == "0") ? 1 : sortedAgeArray[2]._attributes.min,
            "endAge" : sortedAgeArray[4]._attributes.max,
            "minTravelersPerBooking" : 1,
            "maxTravelersPerBooking" : "Null",
        };
        ageBands.push(adultAge);
    }
    else if(availabilityPerPerson.length == 4){
        let sortedAgeArray = availabilityPerPerson.sort((a, b) => parseInt(a._attributes.min) - parseInt(b._attributes.min));
        // Infant 
        let infantAge = {
            "ageBand" : "INFANT",
            "startAge" : sortedAgeArray[0]._attributes.min,
            "endAge" : sortedAgeArray[0]._attributes.max,
            "minTravelersPerBooking" : 0,
            "maxTravelersPerBooking" : "Null",
        };
        ageBands.push(infantAge);

        // Child
        let childAge = {
            "ageBand" : "CHILD",
            "startAge" : sortedAgeArray[1]._attributes.min,
            "endAge" : sortedAgeArray[1]._attributes.max,
            "minTravelersPerBooking" : 0,
            "maxTravelersPerBooking" : "Null",
        };
        ageBands.push(childAge);
        
        // Adult
        let adultAge = {
            "ageBand" : "ADULT",
            "startAge" : (sortedAgeArray[2]._attributes.min == "0") ? 1 : sortedAgeArray[2]._attributes.min,
            "endAge" : sortedAgeArray[3]._attributes.max,
            "minTravelersPerBooking" : 1,
            "maxTravelersPerBooking" : "Null",
        };
        ageBands.push(adultAge);

    }
    else if(availabilityPerPerson.length == 3){
        let sortedAgeArray = availabilityPerPerson.sort((a, b) => parseInt(a._attributes.min) - parseInt(b._attributes.min));
        // Infant 
        let infantAge = {
            "ageBand" : "INFANT",
            "startAge" : sortedAgeArray[0]._attributes.min,
            "endAge" : sortedAgeArray[0]._attributes.max,
            "minTravelersPerBooking" : 0,
            "maxTravelersPerBooking" : "Null",
        };
        ageBands.push(infantAge);

        // Child
        let childAge = {
            "ageBand" : "CHILD",
            "startAge" : sortedAgeArray[1]._attributes.min,
            "endAge" : sortedAgeArray[1]._attributes.max,
            "minTravelersPerBooking" : 0,
            "maxTravelersPerBooking" : "Null",
        };
        ageBands.push(childAge);
        
        // Adult
        let adultAge = {
            "ageBand" : "ADULT",
            "startAge" : (sortedAgeArray[2]._attributes.min == "0")? 1 : sortedAgeArray[2]._attributes.min,
            "endAge" : sortedAgeArray[2]._attributes.max,
            "minTravelersPerBooking" : 1,
            "maxTravelersPerBooking" : "Null",
        };
        ageBands.push(adultAge);                        
    }
    else if(availabilityPerPerson.length == 2){
        let sortedAgeArray = availabilityPerPerson.sort((a, b) => parseInt(a._attributes.min) - parseInt(b._attributes.min));                        
        // Child
        let childAge = {
            "ageBand" : "CHILD",
            "startAge" : sortedAgeArray[0]._attributes.min,
            "endAge" : sortedAgeArray[0]._attributes.max,
            "minTravelersPerBooking" : 0,
            "maxTravelersPerBooking" : "Null",
        };
        ageBands.push(childAge);
        
        // Adult
        let adultAge = {
            "ageBand" : "ADULT",
            "startAge" : (sortedAgeArray[1]._attributes.min == "0")? 1 : sortedAgeArray[1]._attributes.min,
            "endAge" : sortedAgeArray[1]._attributes.max,
            "minTravelersPerBooking" : 0,
            "maxTravelersPerBooking" : "Null",
        };
        ageBands.push(adultAge);                        
    }
    else if(availabilityPerPerson.length == 1){
        let sortedAgeArray = availabilityPerPerson.sort((a, b) => parseInt(a._attributes.min) - parseInt(b._attributes.min));                                                
        // Adult
        let adultAge = {
            "ageBand" : "ADULT",
            "startAge" : (sortedAgeArray[0]._attributes.min == "0")? 1 : sortedAgeArray[0]._attributes.min,
            "endAge" : sortedAgeArray[0]._attributes.max,
            "minTravelersPerBooking" : 1,
            "maxTravelersPerBooking" : "Null",
        };
        ageBands.push(adultAge);                        
    }
    return ageBands;
}

// Function to handle booking questions
async function handleBookingQuestions(itineraryTypeVal, finalData){
    if(itineraryTypeVal != undefined && itineraryTypeVal != ""){
        let questions = "";
        switch(itineraryTypeVal){
            case "TRANSFER":
                questions = ["PREFIX", "FULL_NAMES_FIRST", "FULL_NAMES_LAST","ADDRESS_LINE", "CITY_NAME", "POSTAL_CODE", "STATE", "COUNTRY_CODE", "COUNTRY_NAME", "SPECIAL_REQUIREMENTS", "AGEBAND", "TRANSFER_LOCATION_CODE", "TRANSFER_ARIVAL_TERMINAL", "TRANSFER_ARIVAL_GATE", "TRANSFER_ARIVAL_AIRPORT", "TRANSFER_AIR_ARRIVAL_AIRLINE", "TRANSFER_AIR_ARRIVAL_FLIGHT_NO", "TRANSFER_ARRIVAL_TIME", "TRANSFER_ARRIVAL_DATE", "TRANSFER_ARRIVAL_DROP_OFF", "CONTRY_ACCESS_CODE"]
                finalData.bookingQuestions.push(...questions);
                break;
            case "ACTIVITY":
            case "TOUR":
                questions = ["SPECIAL_REQUIREMENTS", "FULL_NAMES_FIRST", "FULL_NAMES_LAST", "ADDRESS_LINE", "CITY_NAME", "POSTAL_CODE", "STATE", "COUNTRY_CODE", "COUNTRY_NAME", "AGEBAND", "PREFIX", "CONTRY_ACCESS_CODE"]
                finalData.bookingQuestions.push(...questions);
                break;            
            default :
                break;
        }
    };
    let bookingQuestions = finalData.bookingQuestions; 
    return bookingQuestions;
};
// Function to handle itineraty type description
async function handleItineraryItemWhatToExpect(responseData,itineraryItemWhatToExpect ){
    itineraryItemWhatToExpect.description = "";
    try {
        if (responseData.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription) {
            let whatToExpectArr = responseData?.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription;
            if (Array.isArray(whatToExpectArr)) {
                let whatToExpectDescription = whatToExpectArr.filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "WHAT_YOU_CAN_EXPECT")
                .map(item => item?.TextItems?.TextItem?.Description?._text || null);
            itineraryItemWhatToExpect.description = whatToExpectDescription[0] || "";                                                
            }
            else if(whatToExpectArr.TextItems && whatToExpectArr.TextItems.TextItem._attributes?.SourceID == "WHAT_YOU_CAN_EXPECT"){
                itineraryItemWhatToExpect.description = whatToExpectArr.TextItems.TextItem.Description._text || "";
            }
        }
    }
    catch (error) {
        itineraryItemWhatToExpect.description = "";
        // Handle error safely and add logs
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error?.message || ""
            }
        };
        apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));    
    }
   
    return itineraryItemWhatToExpect;
};


// Funciton to handle additional information
async function handleAdditionalInformation(responseData, finalData){

    try {
        if(responseData?.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription){
            let additionalInfoArr = responseData?.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription;
            if(Array.isArray(additionalInfoArr)){
                    let additionalDescription = additionalInfoArr.filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "ADDITIONAL_INFO")
                    .map(item => item?.TextItems?.TextItem?.Description?._text || null);
                let addInfoText = additionalDescription.toString();
                finalData.additionalInformation.push(addInfoText);

                // if data has extra fields like city tax and hotel etc.
                let cityTax = additionalInfoArr.filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "CITY_TAX")
                .map(item => item?.TextItems?.TextItem?.Description?._text || null);
                finalData.additionalInformation.push(...cityTax);

                let hotel = additionalInfoArr.filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "HOTEL")
                .map(item => item?.TextItems?.TextItem?.Description?._text || null);
                finalData.additionalInformation.push(...hotel);

                let bookingMemo = additionalInfoArr.filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "BOOKINGFILE_MEMO")
                .map(item => item?.TextItems?.TextItem?.Description?._text || null);
                finalData.additionalInformation.push(...bookingMemo);

    
            }else if(additionalInfoArr.TextItems && additionalInfoArr.TextItems.TextItem?._attributes?.SourceID == "ADDITIONAL_INFO"){
                finalData.additionalInformation.push(additionalInfoArr.TextItems.TextItem?.Description?._text)
            }
        }
    }
    catch (error) {
         // Handle error safely and add logs
         const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error?.message || ""
            }
        };
        apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
        return additionalInformation;    
    }
   
    let additionalInformation = finalData.additionalInformation;

    return additionalInformation;
}

async function handleDuration(responseData, finalData){
    let durationArray;
    let duration = 1440;
    let durationRegex = /\b(\d+)\s*(?:Days?|Nights?)\b/i;
    if(responseData?.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription){

        let MultimediaDescription = responseData?.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription;
        durationArray = MultimediaDescription.filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "DURATION")

    }
    if(durationArray && durationArray.length != 0){
        // function to get duration if duration details is present in multimedia description array
        duration = await durationFromMultimediaDescription(durationArray, duration);                
    }
    else if(durationRegex.test(finalData.title)){
        const daysMatch = finalData.title.match(durationRegex);

        // Extract the number of days if found
        if (daysMatch && daysMatch[0]) {
            duration = daysMatch[0];
        }
    }
    else{
        let openingTime = responseData?.TPA_Extensions?.OpeningTimes?.OpeningTime
        if(openingTime && openingTime?._attributes?.FromTime && openingTime?._attributes?.ToTime){
            duration = await timeDifferenceInMinutes(openingTime?._attributes?.FromTime, openingTime?._attributes?.ToTime)
        }        
    }
    return duration
}

// function to get duration if multimediadescription array have duration details
async function durationFromMultimediaDescription(durationArray, duration){
    const durationText = durationArray[0]?.TextItems?.TextItem?.Description?._text

    let daysPattern = /\b(\d+\s*(?:-|\s)Days?)\b/i;

    let durationMatch = durationText.match(daysPattern);

    if(durationMatch){
        duration = durationMatch[1];
    }
    else{
        if(/\d/.test(durationText) && /(Day|Days)/i.test(durationText)){

            const hours = parseInt(durationText.match(/\d+/)[0], 10);

            // Convert hours to minutes
            const minutes = hours * 60;
            duration = minutes
        }
        else{
            const data = [
                {
                    "One": 1
                },
                {
                    "Two": 2
                },
                {
                    "Three": 3
                },
                {
                    "Four": 4
                },
                {
                    "Five": 5
                },
                {
                    "Six": 6
                },
                {
                    "Seven": 7
                },
                {
                    "Eight": 8
                },
                {
                    "Nine": 9
                },
                {
                    "Ten": 10
                }
            ];
            
            const result = extractNumber(durationText, data);
            let setDurationValue = setDuration(result)
            if(setDurationValue != null){
                duration = setDurationValue
            }
        }            
    }
    return duration;
}

async function timeDifferenceInMinutes(openingTime, closingTime) {
    const [openingHours, openingMinutes] = openingTime.split(':').map(Number);
    const [closingHours, closingMinutes] = closingTime.split(':').map(Number);
  
    const totalOpeningMinutes = openingHours * 60 + openingMinutes;
    const totalClosingMinutes = closingHours * 60 + closingMinutes;
  
    const differenceInMinutes = Math.abs(totalOpeningMinutes - totalClosingMinutes);
  
    return differenceInMinutes;
}

// funtion to handle child policies
async function handleChildPolicies(responseData){
    let childPolicy = {
        description: ""
    }
    if(responseData?.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription){
        
        let MultimediaDescriptionsArray = responseData?.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription ?? [];
        let childrenPolicyDescription = MultimediaDescriptionsArray
            .filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "CHILDREN_POLICIES")
            .map(item => item?.TextItems?.TextItem?.Description?._text || null);
        
        if(childrenPolicyDescription && childrenPolicyDescription.length != 0 ){
            childPolicy.description = childrenPolicyDescription[0]
        }
    }
    return childPolicy;
}

// function for handle language guide
async function handleLanguageGuides(responseData){
    let languageGuides = {
        "guideType" : "Null",
        "guideCount" : "Null",
        "description": "Null"
    };
    if(responseData.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription){

        let languageGuidesArray = responseData.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription

        let languageGuidesDescription = languageGuidesArray
            .filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "LANGUAGES")
            .map(item => item?.TextItems?.TextItem?.Description?._text || null);

        if(languageGuidesDescription != undefined && languageGuidesDescription.length != 0){
            languageGuides.description = languageGuidesDescription[0];
        }     
    }
    return languageGuides;
}

//funtion to handle startpoint
async function handleTourStartPoint(responseData){
    let startPoint = {
        "name": "",
        "description": ""                        
    }

    if(responseData.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription){
        let startPointArray = responseData.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription;
        let startPointDescription = startPointArray
            .filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "DEPARTURE_POINT")
            .map(item => item?.TextItems?.TextItem?.Description?._text || null)
        
        if(startPointDescription != undefined && startPointDescription.length != 0){
            startPoint.description = startPointDescription[0]
        }     
    }
    return startPoint;

}

// funtion to handle ending point
async function handleTourEndingPoint(responseData){
    let endingPoint = {
        "name": "",
        "description": ""                        
    }

    if(responseData.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription){
        let endingPointArray = responseData.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription;

        let endingPointDescription = endingPointArray
            .filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "TOUR_ENDS")
            .map(item => item?.TextItems?.TextItem?.Description?._text || null);
        
        if(endingPointDescription != undefined && endingPointDescription.length != 0){
            endingPoint.description = endingPointDescription[0];
        }     
    }
    return endingPoint;
}

// funtion to handle inclusions
async function handleInclusions(responseData){
    let inclusions = []
    if(responseData.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription){
        let inclusionArray = responseData.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription;
        let inclusionDescription = inclusionArray
            .filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "INCLUDED")
            .map(item => item?.TextItems?.TextItem?.Description?._text || null)
        inclusions.push(...inclusionDescription)
        let mealDescription = inclusionArray
            .filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "MEAL")
            .map(item => item?.TextItems?.TextItem?.Description?._text || null)
        inclusions.push(...mealDescription) 
    }

    return inclusions
}


// Function to handle exclusions
async function handleExclusion(responseData){
    let exclusions = []
    if(responseData.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription){
        let exclusionArray = responseData.TourActivityInfo?.Descriptions?.MultimediaDescriptions?.MultimediaDescription
        let exclusionDescription = exclusionArray
            .filter(item => item?.TextItems?.TextItem?._attributes?.SourceID === "NO_INCLUDED")
            .map(item => item?.TextItems?.TextItem?.Description?._text || null)
        if(exclusionDescription != undefined && exclusionDescription.length != 0){
            exclusions.push(...exclusionDescription)
        }     
    }
    return exclusions
}

// Function for extract numbers
function extractNumber(text, data) {
    // Split the input text into words using space or hyphen as separators
    const words = text.toLowerCase().split(/[\s-]+/);

    // Check if "Day" is present in the input text
    const dayIndex = words.indexOf("day");
    if (dayIndex > 0) {
        // Get the previous word
        const previousWord = words[dayIndex - 1];
        // Check if the previous word is a key in the data array
        for (const item of data) {
            for (const key in item) {
                const pattern = new RegExp("\\b" + key + "\\b", "i"); // "i" flag for case-insensitive matching
                if (pattern.test(previousWord)) {
                    return item[key];
                }
            }
        }
    }
    return null;
}

// Function for set duration if duration is a day in intiger
function setDuration(result){
    let duration = '1 Day'
    if (result !== null) {
        duration = result +" "+"Day";
        return duration;
    } else {
        return duration;
    }
}

