"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const breadCrums = require("../BreadCrums/BreadCrums.js");
const fs = require("fs");
const path = require("path");
const config = require("../../../../Config.js");
const filePath = config.viator_pickup_location_caching_file_location;

module.exports = async (app) => {
    app.post("/:id/Tour/Viator/ProductDetails", async function (request, response, next) {
        // validating request fields. 
        await apiCommonController.viatorSearchProductDetails(request, response, next);
    }, async function (request, response) {
        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "Details_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DETAILS_PROVIDER_DETAILS_FILE_PATH, config.Provider_Code_VTR);
        try {
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }
            
            // definde the request fields. 
            let productCode = requestObj.productCode;

            // defined url for viator product details api.
            let productDetails = {
                "URL" : `products/${productCode}`,
            }
            // defined url and product code for viator supplier details api.
            let supplierDetails = {
                "URL" : `suppliers/search/product-codes`,
                "productCode" : productCode
            }
            // defined url and product code for viator user review api.
            let reviewsDetails = {
                "URL" : `reviews/product`,
                "productCode" : productCode
            }
            // define url and product code for availability Schedule api.
            let availabilitySchedule = {
                URL : `availability/schedules/${productCode}`                
            }
            // get the api response.
            // waiting for all the three api results.
            let result = await apiResponse.getProductDetailsApiReponse(clientId, providerDetails, productDetails, supplierDetails, reviewsDetails, availabilitySchedule, request);

            // checking the response is valid.
            if(result != undefined && result?.productDetails != undefined){
                if(result?.productDetails?.status == "ACTIVE"){
                    // Checking the user support manual confirmation or not
                    if(!providerDetails?.manualConfirm || providerDetails?.manualConfirm != "Yes"){
                        if(result?.productDetails?.bookingConfirmationSettings?.confirmationType == "MANUAL"){
                            throw new Error("This product requires manual confirmation");
                        }
                    }
                    // result object formating for use important informations.
                    let Formatedresult = await result_object_formatter(clientId, result, providerDetails, request, response, supplierDetails);
                    // create logs
                    if(Formatedresult && Formatedresult.status == "Active"){
                        
                        response.status(200).send({
                            "Result": Formatedresult
                        });
                    }
                }
                else{
                    throw new Error("The selected product is not Active right now");
                }
                
            }
            // if in case of error occured.
            else if (result?.hasOwnProperty('message') || result.supplierDetails?.hasOwnProperty('message')) {
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
                console.log(result);
                response.status(200).send({
                    "Result": {
                        "Code": 400,
                        "Error": {
                            "Message": "No data found or Internal Server Error"
                        }
                    }
                });
            }
        }
        catch (error) {
            console.log(error);
            // Handle error safely and add logs
            handleError(response, fName, fPath, request.body, error);
        }
    });    
}

// result object formatter.
async function result_object_formatter(clientId, result, providerDetails, request, response, supplierDetails){
    let fName = "Details_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DETAILS_PROVIDER_DETAILS_FILE_PATH, config.Provider_Code_VTR);
    try{
        
        // defined an empty object for result.
        let finalData = {};
        if(providerDetails){
            let ScreenConfiguration = {
                "userReviewsShow" : providerDetails.userReviewsShow ,
                "whatToExpect" : providerDetails.whatToExpect,
                "showCancellationPolicy" : providerDetails.showCancellationPolicy,
                "showSupplier" : providerDetails.showSupplier
            }
            finalData.ScreenConfiguration = ScreenConfiguration;
        }

        if(result.productDetails.status){
            // setting up result object status to active
            finalData.status = "Active";

            // assigning all three result objects to variables for better use and identify easily.
            let productDetails = result.productDetails;

            let supplier = {};

            let availabilitySchedule = result.availabilitySchedule

            //================= supplier details from api / caching file ====================//

            // get supplier details file path from config.
            const supplierFilePath = config.viator_supplier_details_caching_file_location;
            // extracting the full path
            const supplierFullPath = path.join(process.cwd(), supplierFilePath);
            // product code.
            let supplierProductCode = productDetails.productCode
            // Checking if the file is exist or not.
            if(fs.existsSync(supplierFullPath)){
                // If the file is exist then take data from file.
                let supplierDataFromFile = await readDataFromFile(supplierProductCode, supplierFullPath, providerDetails, clientId, request, response, supplierDetails);
                supplier = supplierDataFromFile;
            }
            else{
                // If the file is not exist then create new file and get data from api and save it to file.
                let newSupplierData = await getNewSupplierDetailsFromApiAndSaveDataToFile(supplierProductCode, supplierFilePath, providerDetails, clientId, request, response, supplierDetails)
                supplier = newSupplierData;
            }

            //===============================================================================//

            // formatting the result accordingly.
            finalData.productCode = productDetails.productCode;
            finalData.title = productDetails.title;

            // primary destination.
            let destinationId;
            if(productDetails.destinations){
                finalData.PrimaryDestination = productDetails.destinations.find(obj => obj.primary === true);
                destinationId = finalData.PrimaryDestination.ref;
            }

            // get images from productdetails object.
            finalData.images = [];
            let imagesArr = imageFormatingFunction(productDetails);
            finalData.images.push(...imagesArr);
            
            // get supplioer details from supplier details object.
            finalData.supplierName = productDetails.supplier.name;
            let suppliersDetails = supplierFormatingFunction(supplier)
            finalData.contact = suppliersDetails;
            
            // adding user reviews and star ratting.
            finalData.numberOfReviews = productDetails.reviews.totalReviews;
            finalData.combinedAverageRating = productDetails.reviews.combinedAverageRating;

            // adding basic tour details.
            finalData.tourDetails = {
                "description" : productDetails.description || "NA",
                "itineraryType" : productDetails.itinerary.itineraryType || "NA",
                "maxGroupSize" : productDetails.pricingInfo.ageBands[0].maxTravelersPerBooking                
            };

            // cancellation policy adding
            finalData.tourDetails.cancellationPolicy = {
                "cancellation": "You can cancel up to 24 hours in advance of the experience for a full refund.",
                "ploicyGuidelines" : [
                    productDetails.cancellationPolicy.description,
                    "If you cancel less than 24 hours before the experience’s start time, the amount you paid will not be refunded.",
                    "Any changes made less than 24 hours before the experience’s start time will not be accepted.",
                    "Cut-off times are based on the experience’s local time."
                ]

            };

            // cancellation policy object
            finalData.cancellationPolicy = (productDetails.cancellationPolicy != undefined) ? productDetails.cancellationPolicy : {};
            
            // adding itenary type description
            finalData.tourDetails.itineraryTypeDescription = "";
            let itineraryTypeDescription = itineraryTypeDescFunction(productDetails);
            finalData.tourDetails.itineraryTypeDescription = itineraryTypeDescription;

            // ticket info like paper ticket or mobile ticket etc..
            let ticketInfo = ticketInfoFunction(productDetails);
            finalData.ticketInfo = ticketInfo;

            // adding duration.
            let duration = durationFunction(productDetails);           
            finalData.tourDetails.duration = duration;

            // adding guide language count and guide type.
            let languageGuides = languageGuidesFunction(productDetails);
            finalData.tourDetails.languageGuides = languageGuides;            

            // adding pricing info.
            let ageBandValues = ageBandFunction(productDetails);
            finalData.tourDetails.ageRangeFrom = ageBandValues.ageRangeFrom;
            finalData.tourDetails.ageRangeTo = ageBandValues.ageRangeTo;
            
            // availability check criteria per person or who can travel info
            let availabilityTypePerPerson = availabilityTypePerPersonFunction(productDetails);
            finalData.availabilityTypePerPerson = availabilityTypePerPerson;
            
            // product tags
            finalData.tags = productDetails.tags ?? [];

            // product sub options if available
            finalData.productOptions = await languageGuideTypeAndLanguageFunction(productDetails, "haveOpt");
            
            // // special flags finding.
            finalData.flags = await findFlagsByTagId(clientId, request, productDetails.tags);

            // booking requirements
            let bookingRequirements = bookingRequirementsFunction(productDetails);
            finalData.bookingRequirements = bookingRequirements;

            // booking confirmation.
            finalData.bookingConfirmationSettings = await bookingConfirmationType(productDetails);
            

            // adding booking questions
            let bookingQuestions = bookingQuestionsFunction(productDetails);
            finalData.bookingQuestions = bookingQuestions;
            
            
            // some product don't have start point or end poin.
            finalData.tourDetails.startPoint = await startPointFunction(productDetails, clientId, providerDetails, request)

            // start and end of tour.            
            finalData.tourDetails.endingPoint = await endingPointFunction(productDetails, clientId, providerDetails, request);
            
            // pickup point
            let pickUpPoint = await pickupLocationsFunction(productDetails, clientId, providerDetails, request);
            finalData.pickUpPoint = pickUpPoint;

            // some product don't have inclussion object.
            finalData.inclusions = inclussionFunction(productDetails);
            
            // some product don't have exclusions object
            finalData.exclusions = exclussionFunction(productDetails);            
           
            // what to expect object in the tour;
            // in this itenary has differnt types of itenary types so each itenary have different object structure.
            // what to expect array
            let whatToExpect = await whatToExpectFunction(providerDetails, productDetails, clientId, request);            
            finalData.whatToExpect = whatToExpect;

            // additional information of the prodct.
            finalData.additionalInformation = additionalInfoFunction(productDetails);
            
            //=================== user reviews from file / api =========================//
            
            result.reviews = await getReviewsDataFromFileOrApi(supplierProductCode, providerDetails, clientId, request, response)
            // user reviews of the product.
            finalData.userReviews = await userReviewShowYesNoFunction(providerDetails, result.reviews.reviews);
                        
            //==========================================================================//
            
            // some product don't have review count.
            finalData.reviewCountTotals = showReviewCountAndRatingfunction(providerDetails, result);            

            let breadCrumsArr = await breadCrums.getBreadCrums(clientId, destinationId, request)

            finalData.breadCrums = breadCrumsArr;

            // availability schedule
            let availabilityScheduleArr = await findAvailabilitySchedule(availabilitySchedule);
            finalData.availabilitySchedule = availabilityScheduleArr;

            finalData.languageTypeGuides = await languageGuideTypeAndLanguageFunction(productDetails, "noOpt");
                        
        }        
        // return final result.
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

// function for booking confirmation settings
async function bookingConfirmationType(productDetails){
    let confirmationType = {}
    if(productDetails.bookingConfirmationSettings){
        confirmationType = productDetails.bookingConfirmationSettings;
    }
    return confirmationType;
}

// user review show or no from the provider details
async function userReviewShowYesNoFunction(providerDetails, reviews){
    try {
        let userReviews = [];        
        // checking the configuration part for display reviews.
        if(providerDetails.userReviewsShow != "No"){
            if(reviews != undefined){
                for(let reviewsData of reviews){
                    let reviewsObj = {
                        "title" : reviewsData.title,
                        "userName" : reviewsData.userName,
                        "rating" : reviewsData.rating,
                        "text" : reviewsData.text,
                        "provider" : reviewsData.provider,
                        "publishedDate" : reviewsData.publishedDate
                    }
                    userReviews.push(reviewsObj);
                };
            }
        }
        return userReviews;
    }
    catch (error) {
        console.log(error);    
    }        
}

// user revies and rating count show or no function
function showReviewCountAndRatingfunction(providerDetails, result){
    let reviewCount = [];

    if(providerDetails.userReviewsShow != "No"){
        let reviewCountTotals = result?.reviews?.totalReviewsSummary?.reviewCountTotals;                    
        if(result?.reviews?.totalReviewsSummary != undefined && result?.reviews?.totalReviewsSummary?.totalReviews != 0){
            for(let reviewCountTotalsData of reviewCountTotals){
                reviewCount.push(reviewCountTotalsData);
            }
        }        
    }

    return reviewCount;
}

// image formatting
function imageFormatingFunction(productDetails){
    let images = [];
    if(productDetails.images != undefined){
        let productDetailsImage = productDetails.images;
        for(let productDetailsImageData of productDetailsImage){
            images.push(productDetailsImageData.variants[12]);
        };
    };
    return images;
}

//supplier details formatting
function supplierFormatingFunction(supplier){
    let contact = {
        "email" : "Null",
        "address" : "Null",
        "phone" : "Null"
    };
    if(supplier?.suppliers && supplier?.suppliers[0]?.contact){
        contact.email = supplier.suppliers[0].contact.email;
        contact.address = supplier.suppliers[0].contact.address;
        contact.phone = supplier.suppliers[0].contact.phone;
        
    }    
    return contact;
}

// itenary type description
function itineraryTypeDescFunction(productDetails){
    let itineraryType = productDetails.itinerary.itineraryType;
    let itineraryTypeDescription = "";
    switch(itineraryType){
        case "STANDARD":
            itineraryTypeDescription = "A tour-based product (focused on visiting and viewing) that occurs at a single location or proceeds through a set of locations on a single day";
            break;
        case "ACTIVITY":
            itineraryTypeDescription = "An activity-based product (focused on the activity rather than the location) that occurs at a single location or proceeds through a set of locations on a single day";
            break;
        case "MULTI_DAY_TOUR":
            itineraryTypeDescription = "A tour or activity that occurs over multiple days, and therefore includes food and accommodation";
            break;
        case "HOP_ON_HOP_OFF":
            itineraryTypeDescription = "A tour that operates continuously, such as a bus tour, wherein passengers can use their ticket to board and alight as they please at any of the stops along the route";
            break;
        case "UNSTRUCTURED":
            itineraryTypeDescription = "unstructured tour."
            break;
        default:
            break;

    }
    return itineraryTypeDescription;
}

// ticketInfoFunction
function ticketInfoFunction(productDetails){
    let ticketInfo = {};
    if(productDetails.ticketInfo != undefined){
        ticketInfo = productDetails.ticketInfo; 
    }
    return ticketInfo;
}

// duration 
function durationFunction(productDetails){
    let duration = 1440;
    if(productDetails.itinerary.duration != undefined){
        duration = (productDetails.itinerary.duration.variableDurationToMinutes != undefined) ? productDetails.itinerary.duration.variableDurationToMinutes : productDetails.itinerary.duration.fixedDurationInMinutes || "Null";
    }
    else if(productDetails.itinerary.itineraryType == 'MULTI_DAY_TOUR'){
        let itenaryDays = productDetails.itinerary.days
        duration = `${itenaryDays.length} Days`;
    }   
    return duration;
}

// languageGuide
function languageGuidesFunction(productDetails){
    let languageGuides = {
        "guideType" : "Null",
        "guideCount" : "Null"
    };
    if(productDetails.languageGuides){
        languageGuides.guideType = (productDetails.languageGuides[0].type != undefined) ? productDetails.languageGuides[0].type : "Null";
        languageGuides.guideCount = (productDetails.languageGuides.length != 0) ? productDetails.languageGuides.length : "Null";      
    }
    return languageGuides;
}

// get all language guides and type 
async function languageGuideTypeAndLanguageFunction(productDetails, option){
    try {
        if(productDetails.languageGuides){
            // read languages from json file and map.
            let JsonResponse = await jsonFileRead(config.viator_Language_Guide_Json);
            // map each guide type to guide languages.
            let languageGuides = [];
            if(option == "haveOpt"){
                let options = productDetails?.productOptions ?? []
                // format product options 
                options = await formatLanguageGuidesInProductOptions(options, JsonResponse)
                return options;
            }
            else{
                // format languageguides 
                languageGuides = await formatLanguageGuides(languageGuides, productDetails, JsonResponse)
                return languageGuides;
            }                    
        }
        else{
            return [];
        }
    }
    catch (error) {
        console.log(error);    
    }
}

// format languageguides inside all productoptions 
async function formatLanguageGuidesInProductOptions(options, JsonResponse){
    for(let i = 0;  i < options.length; i++){     
        let obj = {
            "productOptionCode" : options[i]?.productOptionCode ?? "",
            "description" : options[i]?.description ?? "",
            "title" : options[i]?.title ?? "",
            "languageGuides" : []
        }
        
        for(let lan of options[i]?.languageGuides){
            let languageLabel = JsonResponse[lan.language];
            if(languageLabel){
                // checking the array have values. if values find then append with it, else add it to new.
                let guide = obj.languageGuides.find((guide) =>guide.languageType === lan.type);
                // checking the languages array is true or not.

                if(guide){
                    // if the languages array is alread exist then add new value to it.
                    guide.languages.push({
                      label: languageLabel,
                      value: lan.language
                    });
                }
                else {
                    // if it is not exists then push new values.
                    obj.languageGuides.push({
                        languageType: lan.type,
                        languages: [{
                            "label" : languageLabel,
                            "value" : lan.language
                        }]
                    });
                }
            }                                                
        }    
        options[i] = obj;                                        
    }
    return options
}

// format languageguides 
async function formatLanguageGuides(languageGuides, productDetails, JsonResponse){
    for(let languageGuidesData of productDetails.languageGuides){     

        let languageLabel = JsonResponse[languageGuidesData.language];

        if(languageLabel){
            // checking the array have values. if values find then append with it, else add it to new.
            let guide = languageGuides.find((guide) => guide.languageType === languageGuidesData.type);
            // checking the languages array is true or not.
            if(guide){
                // if the languages array is alread exist then add new value to it.
                guide.languages.push({
                  label: languageLabel,
                  value: languageGuidesData.language
                });
            }
            else {
                // if it is not exists then push new values.
                languageGuides.push({
                    languageType: languageGuidesData.type,
                    languages: [{
                    "label" : languageLabel,
                    "value" : languageGuidesData.language
                    }]
                });
            }
        }
    }
    return languageGuides
}

async function jsonFileRead(filePath){
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
            console.log(error);
        }
    })
    
}

// ageband from and to
function ageBandFunction(productDetails){
    let ageband = {
        "ageRangeFrom" : 0,
        "ageRangeTo" : 0
    };
    if(productDetails.pricingInfo.ageBands != undefined){
        ageband.ageRangeFrom = productDetails.pricingInfo.ageBands[0].startAge;
        if(productDetails.pricingInfo.ageBands.length > 1){
            let ageBandLength = productDetails.pricingInfo.ageBands.length;
            ageband.ageRangeTo = productDetails.pricingInfo.ageBands[ageBandLength-1].endAge;
        }
        else{
            ageband.ageRangeTo = productDetails.pricingInfo.ageBands[0].endAge;
        }
    }
    return ageband;
}
//availabilityTypePerPerson
function availabilityTypePerPersonFunction(productDetails){
    let availabilityTypePerPerson = {}
    if(productDetails.pricingInfo){

        let personPriceDetails = productDetails.pricingInfo;

        personPriceDetails.ageBands.sort((a, b) => {
            let ageBandA = a.ageBand.toUpperCase();
            let ageBandB = b.ageBand.toUpperCase();
          
            if (ageBandA < ageBandB) {
              return -1;
            }
            if (ageBandA > ageBandB) {
              return 1;
            }
            return 0;
          });
          
        availabilityTypePerPerson = personPriceDetails;
    }
    return availabilityTypePerPerson;
}
// find flags values by using tag id.
async function findFlagsByTagId(clientId, request, tags){
    try{
        let flagsArr = [];
        if(tags.length != 0){
            let flags = [
                {
                    flagsId : 21972,
                    value : "Excellent Quality"
                },
                {
                    flagsId : 21873,
                    value : "Best Seller"
                },
                {
                    flagsId : 22083,
                    value : "Likely To Sell Out"
                },
                {
                    flagsId : 11940,
                    value : "Once in a Lifetime"
                },
                {
                    flagsId : 11954,
                    value : "Viator Exclusive Tours"
                },
                {
                    flagsId : 21074,
                    value : "Unique experiences"
                },
                {
                    flagsId : 6226,
                    value : "Best Value"
                },
                {
                    flagsId : 21971,
                    value : "Viator Plus"
                }
            ];
            tags.forEach(element => {
                let flag = flags.find(flag => flag.flagsId === element);
                if (flag) {
                    flagsArr.push({ flagsId: flag.flagsId, value: flag.value });
                }
            });

        }
        return flagsArr;
    }
    catch(error){
        console.log(error);
    }
}
// booking requirements
function bookingRequirementsFunction(productDetails){
    let bookingRequirements = "Null";
    if(productDetails.bookingRequirements != undefined){
        bookingRequirements = productDetails.bookingRequirements;
    }
    return bookingRequirements;
}
// booking questions
function bookingQuestionsFunction(productDetails){
    let bookingQuestions = []
    if(productDetails.bookingQuestions != undefined){
        bookingQuestions.push(...productDetails.bookingQuestions);
    }
    return bookingQuestions;
}
// strat point
async function startPointFunction(productDetails, clientId, providerDetails, request){
    let startPoint = {
        "name" : "",
        "description":"",
        "reference" : ""
    };
    if(productDetails.logistics.start != undefined){
        let startpointLocaArr = [];
        
        let startPointArr = productDetails.logistics?.start[0]?.location?.ref || [];
        
        startpointLocaArr.push(startPointArr);

        if(startpointLocaArr.length != 0){

            let locRef = await getLocationBulkFromViator(clientId, providerDetails, startpointLocaArr, request, "startPoint");

            if(locRef != undefined && locRef.length != 0){
                startPoint.name = locRef[0]?.name;
                startPoint.description = productDetails.logistics.start[0].description;
                startPoint.reference = locRef[0]?.reference                           
            }
        }
        else{
            startPoint.name = "";
            startPoint.description = productDetails.logistics?.start[0]?.description || ""
            startPoint.reference = "";
        }        
    }
    return startPoint;
}
// endpoint 
async function endingPointFunction(productDetails, clientId, providerDetails, request){
    let endingPoint = {
        "name" : "",
        "description" : ""
    }
    if(productDetails.logistics.end != undefined){

        let endLocationArr = [];
        let endPoint = productDetails.logistics?.end[0]?.location?.ref;
        endLocationArr.push(endPoint)

        if(endLocationArr.length != 0){

            let locRef = await getLocationBulkFromViator(clientId, providerDetails, endLocationArr, request, "endPoint");

            if(locRef != undefined && locRef.length != 0){
                endingPoint.name = locRef[0]?.name || "";
                endingPoint.description = productDetails.logistics.end[0].description
            }
            
        }
        else{
            endingPoint.name = "";
            endingPoint.description = productDetails.logistics.end[0].description || "";
        }                                                    
    }
    return endingPoint;
}
// pickup locations
async function pickupLocationsFunction(productDetails, clientId, providerDetails, request){
    let pickUpPoint = {
        "pickupOptionType" : "NA",
        "allowCustomTravelerPickup" : "NA",
        "minutesBeforeDepartureTimeForPickup" : "NA",
        "additionalInfo" : "NA",
        "specialInstructions" : "NA",
        "pickupLocations" : []

    }
    if(productDetails.logistics.travelerPickup){
        pickUpPoint.pickupOptionType =  (productDetails.logistics.travelerPickup.pickupOptionType != undefined) ? productDetails.logistics.travelerPickup.pickupOptionType : "NA";
        pickUpPoint.allowCustomTravelerPickup =  (productDetails.logistics.travelerPickup.allowCustomTravelerPickup != undefined) ? productDetails.logistics.travelerPickup.allowCustomTravelerPickup : "NA";
        pickUpPoint.minutesBeforeDepartureTimeForPickup =  (productDetails.logistics.travelerPickup.minutesBeforeDepartureTimeForPickup != undefined) ? productDetails.logistics.travelerPickup.minutesBeforeDepartureTimeForPickup : "NA";
        pickUpPoint.additionalInfo =  (productDetails.logistics.travelerPickup.additionalInfo != undefined) ? productDetails.logistics.travelerPickup.additionalInfo : "NA";
        
        if(productDetails.logistics.redemption){
            let redemption = productDetails.logistics.redemption;
            pickUpPoint.specialInstructions = (redemption.specialInstructions != undefined) ? redemption.specialInstructions : "NA";
        }        

        //location fetch from map but now we dont have google access. and only 500 location can get details from location api.
        let pickupPoints = await getPickupPointLocationsFunction(clientId, providerDetails, productDetails, request);
        pickUpPoint.pickupLocations = pickupPoints;        
       
    }
    return pickUpPoint;
}
// inclussion
function inclussionFunction(productDetails){

    let inclusions = [];
    if(productDetails.inclusions != undefined){
        for(let inclusionsData of productDetails.inclusions){
            if(inclusionsData.otherDescription != undefined){
                inclusions.push(inclusionsData.otherDescription);
            }
            else if(inclusionsData.description){
                inclusions.push(inclusionsData.description);
            }
            else{
                inclusions.push(inclusionsData.typeDescription);
            }
        };
    }
    return inclusions;
}
// exclussion
function exclussionFunction(productDetails){
    let exclusions = []
    if(productDetails.exclusions != undefined){
        for(let exclusionsData of productDetails.exclusions){
            if(exclusionsData.otherDescription != undefined){
                exclusions.push(exclusionsData.otherDescription)
            }
            else{
                exclusions.push(exclusionsData.description);
            }
        };
    }
    return exclusions;
}
// additional info function
function additionalInfoFunction(productDetails){
    let additionalInformation = [];
    if(productDetails.additionalInfo != undefined){
        for(let additionalInfoData of productDetails.additionalInfo){
            additionalInformation.push(additionalInfoData.description);
        }
    }    
    return additionalInformation;
}

// what to expect
async function whatToExpectFunction(providerDetails, productDetails, clientId, request){
    let whatToExpect = []
    if(providerDetails.whatToExpect !== "No"){
        if(productDetails.itinerary){
            // let locationBulkArr = [];
            // Different itenary types has different what to expect format.
            let itineraryType = productDetails.itinerary.itineraryType;
            let setWhatToExpectData = await setWhatToExpect(whatToExpect, itineraryType, providerDetails, productDetails, clientId, request);             
            whatToExpect = setWhatToExpectData;
        }
    }
    return whatToExpect;
}

// Function for set what to expect
async function setWhatToExpect(whatToExpect, itineraryType, providerDetails, productDetails, clientId, request){
    // checking the itenary types and add object structuring accordingly.
    switch(itineraryType){
        // standard type.
        case "STANDARD":
            let whatToExpectStandard = await standardItenaryFunction(providerDetails, productDetails, clientId, request);
            whatToExpect.push(...whatToExpectStandard)                    

            break

        case "ACTIVITY":
            let whatToExpectActivity = await activityItenaryFunction(providerDetails, productDetails, clientId, request)
            whatToExpect.push(...whatToExpectActivity);                    

            break;

        case "MULTI_DAY_TOUR":
            let whatToExpectMultiday = await multidayItinaryFunction(clientId, productDetails, providerDetails, request);                    
            whatToExpect.push(...whatToExpectMultiday)                                       

            break;

        case "HOP_ON_HOP_OFF":

            let whatToExpectHopOnHopOff = await HopOnHopOffItinaryFunction(clientId, productDetails, providerDetails, request);
            whatToExpect.push(...whatToExpectHopOnHopOff)                    
            
            break;

        case "UNSTRUCTURED":
            let whatToExpectUnstructured = await unStructureditinaryFunction(clientId, productDetails, providerDetails, request);
            whatToExpect.push(...whatToExpectUnstructured);
                                
            break;

        default:
            break;
    }  
    return await whatToExpect;
}

// what to expect unstructured itinary function 
async function unStructureditinaryFunction(clientId, productDetails, providerDetails, request){
    try {
        let whatToExpect = [];
        if(productDetails.itinerary.unstructuredDescription != undefined){

            let unstructuredItinerary = productDetails.itinerary;

            let itineraryItemWhatToExpect = {};

            itineraryItemWhatToExpect.stopName = "";
            itineraryItemWhatToExpect.duration = (unstructuredItinerary.duration != undefined)? unstructuredItinerary.duration.fixedDurationInMinutes : "00";
            itineraryItemWhatToExpect.passByWithoutStopping = "NA";
            itineraryItemWhatToExpect.admissionIncluded = "NA";
            itineraryItemWhatToExpect.description = (unstructuredItinerary.unstructuredDescription != undefined) ? unstructuredItinerary.unstructuredDescription : "NA";
            whatToExpect.push(itineraryItemWhatToExpect);
        }
        return whatToExpect;
    }
    catch (error) {
        console.log(error);    
    }
}

// what to expect multiday itinary function.
async function multidayItinaryFunction(clientId, productDetails, providerDetails, request){
    try {
        let whatToExpect = [];
        let locationBulkArr = [];
        if(productDetails.itinerary.days){
            
            for(const tourDay of productDetails.itinerary.days){
                let itineraryItemWhatToExpect = {
                    daysNumber: tourDay.dayNumber,
                    stopName: tourDay.title,
                    Stops: [],
                    accommodation: tourDay.accommodations || [],
                    foodAndDrinks: tourDay.foodAndDrinks || [],
                };
                
                
                for (const tourItem of tourDay.items) {     

                    const wTItem = await multidayItinaryStopNamesFunction(tourItem);
                            
                    if (wTItem.stopName) {
                        itineraryItemWhatToExpect.Stops.push(wTItem);
                        locationBulkArr.push(wTItem.stopName);
                    }
                }

                whatToExpect.push(itineraryItemWhatToExpect);
            }

            // get location from api 
            whatToExpect = await findMultidayItenaryItemStopName(clientId, providerDetails, whatToExpect, locationBulkArr, request)
        }

        return whatToExpect;
    }
    catch (error) {
        console.log(error);    
    }
}

// multiday itinary single day stop names finder
async function multidayItinaryStopNamesFunction(tourItem){
    try {
        const wTItem = {
            stopName: tourItem.pointOfInterestLocation?.location?.ref || "",
            duration: tourItem.duration?.fixedDurationInMinutes || "NA",
            passByWithoutStopping: tourItem.passByWithoutStopping || "NA",
            admissionIncluded: (() => {
                switch (tourItem.admissionIncluded) {
                    case "NOT_APPLICABLE":
                        return "Admission Ticket Free";
                    case "NO":
                        return "Admission Ticket Not Included";
                    case "YES":
                        return "Admission Ticket Included";
                    default:
                        return "NA";
                }
            })(),
            description: tourItem.description || "NA",
        };
        return wTItem;
    }
    catch (error) {
        console.log(error);    
    }
}

// hop on  hop off tour itinary function 
async function HopOnHopOffItinaryFunction(clientId, productDetails, providerDetails, request){
    try {
        let whatToExpect = [];
        let locationBulkArr = [];
        let pointOfInterestLocationArr = [];
        if(productDetails.itinerary.routes){
            
            let hopOnHopFunction = await HopOnHopOffRouteAndStopFunction(clientId, providerDetails, productDetails, request);

            whatToExpect = hopOnHopFunction.whatToExpect;
            locationBulkArr = hopOnHopFunction.locationBulkArr;
            pointOfInterestLocationArr = hopOnHopFunction.pointOfInterestLocationArr;

            // get location
            whatToExpect = await HopOnHopOffStopNameFunction(clientId, whatToExpect, locationBulkArr, providerDetails, request);
                    
            // point of intersect locations
            whatToExpect = await HopOnHopOffStopPointOfIntersectFunction(clientId, whatToExpect, pointOfInterestLocationArr, providerDetails, request);                        
            
        }
        return whatToExpect;
    }
    catch (error) {
        console.log(error);
    }
}

// hop on hop of itinary routes and stop finder function.
async function HopOnHopOffRouteAndStopFunction(clientId, providerDetails, productDetails, request){
    try {
        let whatToExpect = [];
        let locationBulkArr = [];
        let pointOfInterestLocationArr = [];
        
        let routes = productDetails.itinerary.routes;

        for (const route of routes) {
            let itineraryItemWhatToExpect = {
                daysNumber: "NA",
                stopName: route.name || "NA",
                duration: route.duration?.fixedDurationInMinutes || "00",
                operatingSchedule: route.operatingSchedule || "NA",
                Stops: [],
                pointsOfInterest: [],
            };

            let setItineraryItemWhatToExpectData = await setItineraryItemWhatToExpect(route, locationBulkArr, itineraryItemWhatToExpect)
            locationBulkArr = setItineraryItemWhatToExpectData.locationBulkArr;
            itineraryItemWhatToExpect = setItineraryItemWhatToExpectData.itineraryItemWhatToExpect


            if (route.pointsOfInterest) {
                for (const pointOfInterest of route.pointsOfInterest) {
                    const location = pointOfInterest.location;
                    if (location) {
                        pointOfInterestLocationArr.push(location.ref);
                    }

                    const pointOfInterestObj = {
                        stopName: location?.ref || "",
                    };
                    itineraryItemWhatToExpect.pointsOfInterest.push(pointOfInterestObj);
                }
            }

            whatToExpect.push(itineraryItemWhatToExpect);
        }
        return ({
            whatToExpect,
            locationBulkArr,
            pointOfInterestLocationArr
        });
    }
    catch (error) {
        console.log(error);    
    }
}

async function setItineraryItemWhatToExpect(route, locationBulkArr, itineraryItemWhatToExpect){
    if (route.stops) {
        for (const stop of route.stops) {
            const stopLocation = stop.stopLocation;
            if (stopLocation) {
                locationBulkArr.push(stopLocation.ref);
            }

            const stopObj = {
                stopName: stopLocation?.ref || "",
                duration: stop.duration || "NA",
                passByWithoutStopping: stop.passByWithoutStopping || "NA",
                admissionIncluded: stop.admissionIncluded || "NA",
                description: stop.description || "NA",
            };
            itineraryItemWhatToExpect.Stops.push(stopObj);
        }
    }
    let responseData = {
        "locationBulkArr" : await locationBulkArr,
        "itineraryItemWhatToExpect" : await itineraryItemWhatToExpect
    }
    return responseData;
}

// hop on hop of itinary stop names function 
async function HopOnHopOffStopNameFunction(clientId, whatToExpect, locationBulkArr, providerDetails, request){
    try {
        if (locationBulkArr.length === 0) {
            return whatToExpect;
        }
        const locationDetails = await getLocationBulkFromViator(clientId, providerDetails, locationBulkArr, request, "itinary");

        if (!locationDetails || locationDetails.length === 0) {
            return whatToExpect.map((item) => ({
                ...item,
                Stops: item.Stops.map((stop) => ({
                    ...stop,
                    stopName: '',
                })),
            }));
        }
    
        for (const itinerary of whatToExpect) {
            for (const stop of itinerary.Stops) {
                const matchingLocation = locationDetails.find(location => location.reference === stop.stopName);
                if (matchingLocation) {
                    stop.stopName = matchingLocation.name || "";
                }
            }
        }
    
        return whatToExpect;
                
    }
    catch (error) {
        console.log(error);
    }
}

// hop on hop off itinary location point of intersect function.
async function HopOnHopOffStopPointOfIntersectFunction(clientId, whatToExpect, pointOfInterestLocationArr, providerDetails, request){
    try {

        if (pointOfInterestLocationArr.length === 0) {
            return whatToExpect;
        }
    
        const locationDetails = await getLocationBulkFromViator(clientId, providerDetails, pointOfInterestLocationArr, request, "itinary");
    
        if (!locationDetails || locationDetails.length === 0) {
            return whatToExpect.map((item) => ({
                ...item,
                pointsOfInterest: item.pointsOfInterest.map((pointOfInterest) => ({
                    ...pointOfInterest,
                    stopName: '',
                })),
            }));
        }
    
        for (const itinerary of whatToExpect) {
            for (const pointOfInterest of itinerary.pointsOfInterest) {
                const matchingLocation = locationDetails.find(location => location.reference === pointOfInterest.stopName);
                if (matchingLocation) {
                    pointOfInterest.stopName = matchingLocation.name || "";
                }
            }
        }
    
        return whatToExpect;
    }
    catch (error) {
        console.log(error);
    }
}

// what to expect standard itenary
async function standardItenaryFunction(providerDetails, productDetails, clientId, request){
    let whatToExpect = [];

    if(productDetails.itinerary.itineraryItems){

        let itineraryItems = productDetails.itinerary.itineraryItems;
        // location ref Array for get location names from location bulk api
        let locationBulkArr = [];
        
        for(let itineraryItemsData of itineraryItems){

            let itineraryItemWhatToExpect = {};
            // Attraction name now its empty because it need google api for get that details.
            let location = itineraryItemsData.pointOfInterestLocation.location;
            locationBulkArr.push(location.ref);

            itineraryItemWhatToExpect.stopName = (location.ref) ? location.ref : "";
            
            // duration going to spent on that perticular location.
            itineraryItemWhatToExpect.duration = itineraryItemsData?.duration?.fixedDurationInMinutes ?? 0
                        
            // pass without stop the location 
            itineraryItemWhatToExpect.passByWithoutStopping = (itineraryItemsData.passByWithoutStopping) ? itineraryItemsData.passByWithoutStopping : "NA";

            // admission ticket
            itineraryItemWhatToExpect.admissionIncluded = await whatToExpectTicketInfo(itineraryItemsData.admissionIncluded);
            
            // description of what to expect attractions
            itineraryItemWhatToExpect.description = (itineraryItemsData.description) ? itineraryItemsData.description : "NA";

            // push what to expect object to an array 
            whatToExpect.push(itineraryItemWhatToExpect);
            
        }

        // get location and chamge the stop name refference value to location name.
        whatToExpect = await findStandardItenaryItemStopName(clientId, providerDetails, whatToExpect, locationBulkArr, request);        

    }
    return whatToExpect;
}

// standard itinary item stop name fining
async function findStandardItenaryItemStopName(clientId, providerDetails, whatToExpect, locationBulkArr, request) {
    if (locationBulkArr.length === 0) {
        return whatToExpect;
    }

    let locationDetails = await getLocationBulkFromViator(clientId, providerDetails, locationBulkArr, request, "itinary");

    if (locationDetails) {
        whatToExpect.forEach(expectation => {
            let matchingLocation = locationDetails.find(location => location?.reference === expectation?.stopName);
            expectation.stopName = matchingLocation ? matchingLocation.name || "" : "";
        });
    }

    return whatToExpect;
}

// multiday itinary item stop name finding
async function findMultidayItenaryItemStopName(clientId, providerDetails, whatToExpect, locationBulkArr, request){
    
    if (locationBulkArr.length === 0) {
        return whatToExpect;
    }

    let locationDetails = await getLocationBulkFromViator(clientId, providerDetails, locationBulkArr, request, "itinary");

    if (!locationDetails || locationDetails.length === 0) {
        return whatToExpect.map(item => ({
            ...item,
            Stops: item.Stops.map(stop => ({
                ...stop,
                stopName: '',
            })),
        }));
    }

    whatToExpect.forEach(item => {
        item.Stops.forEach(stop => {
            const matchingLocation = locationDetails.find(location => location.reference === stop.stopName);
            stop.stopName = matchingLocation ? matchingLocation.name || "" : "";
        });
    });

    return whatToExpect;
    
    
}

// what to expect activity itenary
async function activityItenaryFunction(providerDetails, productDetails, clientId, request){
    // what to expect activity type array.
    let whatToExpect = [];
    let locationBulkArr = [];
    let itenaryActivity = productDetails.itinerary
    let itineraryItemWhatToExpect = {};
    let location = itenaryActivity.activityInfo.location

    // get location data
    locationBulkArr.push(location.ref)
    // get location
    itineraryItemWhatToExpect.stopName = "";
    if(locationBulkArr.length != 0){
        // get location from api.
        let locationDetails = await getLocationBulkFromViator(clientId, providerDetails, locationBulkArr, request, "itinary");
        // check the location 
        if(locationDetails.length != 0){
            itineraryItemWhatToExpect.stopName = location.ref;
            for(let locationDetailsData of locationDetails){
                // checking if the location reference matches the api location reference.
                if(locationDetailsData.reference == itineraryItemWhatToExpect.stopName){
                    itineraryItemWhatToExpect.stopName = locationDetailsData.name;
                }
            }
        }       
    }
    // what to expect duration.
    itineraryItemWhatToExpect.duration = (itenaryActivity.duration.fixedDurationInMinutes) ? itenaryActivity.duration.fixedDurationInMinutes : 0;
    
    // pass by without stoping. 
    itineraryItemWhatToExpect.passByWithoutStopping = (itenaryActivity.passByWithoutStopping) ? itenaryActivity.passByWithoutStopping : "NA";
    // admission ticket yes or no.
    itineraryItemWhatToExpect.admissionIncluded = (itenaryActivity.admissionIncluded) ? itenaryActivity.admissionIncluded : "NA";

    // itinary description.
    itineraryItemWhatToExpect.description = (itenaryActivity.activityInfo.description) ? itenaryActivity.activityInfo.description : "NA";
        
    whatToExpect.push(itineraryItemWhatToExpect);

    return whatToExpect;
}

// what to expect ticket info
async function whatToExpectTicketInfo(itineraryItems){
    let admissionIncluded = "";
    if(itineraryItems){
        switch(itineraryItems){
            case "NOT_APPLICABLE":
                admissionIncluded = "Admission Ticket Free";
                break;
            case "NO":
                admissionIncluded = "Admission Ticket Not Included";
                break;
            case "YES":
                admissionIncluded = "Admission Ticket Included";
                break;
            default:
                break;
        }

    }
    return admissionIncluded;
}

// pickup point locations
async function getPickupPointLocationsFunction(clientId, providerDetails, productDetails, request){
    let pickupPoints = [];
    if(productDetails?.logistics?.travelerPickup?.locations) {

        let locations = productDetails?.logistics?.travelerPickup?.locations ?? [];

        let pickUpLocationReffArr = [];
        for (const item of locations) {
            pickUpLocationReffArr.push(item.location.ref);   
        }

        let pickUpLocData = await getLocationBulkFromViator(clientId, providerDetails, pickUpLocationReffArr, request, "pickupPoint");

        if(pickUpLocData && pickUpLocData.length != 0){

            let matchedLocations = await matchPickupTypeWithLocation(pickUpLocData, locations);
            pickupPoints.push(...matchedLocations);
        }
        
    }
    return pickupPoints;
}

// get location details using location bulk api.
async function getLocationBulkFromViator(clientId, providerDetails, locationArr, request, locationKey){
    let fName = "Details_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DETAILS_PROVIDER_DETAILS_FILE_PATH, config.Provider_Code_VTR);
    try{

        // get location bulk api response from viator.
        const productCode = request.body.productCode;
        let locationApiResponse = await findLocation(clientId, providerDetails, locationArr, productCode, locationKey)

        let locaArr = [];
        // checking if the response is empty or not.
        if(locationApiResponse && locationApiResponse.length != 0){
            
            // filter out only provide is google
            let googleLocReff = locationApiResponse.filter(obj => obj.provider == "GOOGLE");
            
            if(googleLocReff.length != 0){
                let googleLocArr = await findGoogleLocations(clientId, providerDetails, googleLocReff);
                locaArr.push(...googleLocArr);
            }

            // filter out only the provider is not google.
            let tripAdvisorLocations = locationApiResponse.filter(obj => obj.provider != "GOOGLE");
            // checking the response is empty.
            if(tripAdvisorLocations.length != 0){

                let tripAdvisorLocationsArr = await findTripAdvisorLocations(tripAdvisorLocations);
               
                // add it to final array.
                locaArr.push(...tripAdvisorLocationsArr)
            }                        
        }
        return(locaArr);
        
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
        return(errorObject);
    }
}

// find google locations
async function findGoogleLocations(clientId, providerDetails, googleLocReff){
    try {
            // extract placeid from location response from viator.
        let googlePlaceId = googleLocReff.map(loc => loc.providerReference);
        // send request to google map api and get response.
        let googleapisResponse = await apiResponse.getGoogleLocationDetails(clientId, providerDetails, googlePlaceId);
        // checking the response is not empty.
        let resultArray = [];
        if(Array.isArray(googleapisResponse) && googleapisResponse.length != 0){
            // comparare response using reference and return name and reference obj.
            resultArray = googleLocReff.map(obj => {
                const matchingRef = googleapisResponse.find(loc => loc.reference === obj.providerReference);
                if (matchingRef) {
                    return ({ name: matchingRef.name, reference: obj.reference, address : matchingRef.address });
                }
            });        
        }
        return resultArray;
    }
    catch (error) {
        console.log(error);    
    }
    
}

// find tripAdvisor locations
async function findTripAdvisorLocations(tripAdvisorLocations){
     // extract name and reference obj.
     let tripAdvisorLocationsArr = tripAdvisorLocations.map(loc => {

        let resData = {}
        resData.name = loc?.name || "";

        if(loc.address != undefined && loc.address != ""){
            if(loc.address?.street != ""){
                resData.address = `${loc?.address?.street}, ${loc?.address?.state ?? loc?.address?.administrativeArea}, ${loc?.address?.country}`;
            }
            else{
                resData.address = `${loc?.address?.state ?? loc?.address?.administrativeArea}, ${loc?.address?.country}`;
            }
        }
        else{
            resData.address = "";
        }
        
        resData.reference = loc.reference
        return(resData);                            
    })
    return tripAdvisorLocationsArr;
}

// get availability schedule.
async function findAvailabilitySchedule(availabilitySchedule){
    try{
        let availabilityScheduleSeasons = {
            "productCode": availabilitySchedule.productCode,
            "fromPrice" : availabilitySchedule.summary.fromPrice,
            "seasons" : []
        };
        let availabilitySeasons;
        if(availabilitySchedule && availabilitySchedule.bookableItems.length != 0){
            let availabilityScheduleItems = availabilitySchedule.bookableItems;
 
            // loop through the bookable items            
            for (const item of availabilityScheduleItems) {                
                let availabilityScheduleItemSeasons = item.seasons;
                // get availability schedule
                let seasonArray = await findavailabilityScheduleSeasonFunction(availabilityScheduleItemSeasons);
                // loop through the available seasons
                availabilitySeasons = await getAvailabilitySeasons(availabilitySeasons, seasonArray);   
            }
            if(availabilitySeasons){
                availabilityScheduleSeasons.seasons.push(availabilitySeasons);
            }
        }
        return availabilityScheduleSeasons;
    }
    catch(error){
        console.log(error);
    }

}

// Get availability seasons.
async function getAvailabilitySeasons(availabilitySeasons, seasonArray){
    // loop through the available seasons    
    for (const element of seasonArray) {
        if(availabilitySeasons == undefined){
            availabilitySeasons = element;
        }else {
           
            if(availabilitySeasons.startDate > element.startDate){
                availabilitySeasons.startDate = element.startDate
            }
            //if no unavailableDates are not present skip the curretn iteration
            if(element.unavailableDates.length == 0){
                continue;
            }
            
            // if unavailable dates are present compare the arrays and take only common dates
            if(availabilitySeasons?.unavailableDates !== undefined && element?.unavailableDates?.length !== 0){
                let commonDates  = availabilitySeasons.unavailableDates.filter(item =>{
                    return element.unavailableDates.some(itemElement => itemElement.date == item.date)
                })
                availabilitySeasons.unavailableDates = commonDates
            }else{
                availabilitySeasons.unavailableDates = []
            }
        }
    }
    return availabilitySeasons
}

// match location references and add pickupType with existing location result
async function matchPickupTypeWithLocation(pickUpLocData, locations){
    let resultMap = []
    if(Array.isArray(pickUpLocData)){
        resultMap = pickUpLocData.map(item1 => {
            const matchingItem = locations.find(item2 => item2.location.ref === item1.reference);
            return {
              name: item1.name,
              address: item1.address,
              reference: item1.reference,
              pickupType: matchingItem ? matchingItem.pickupType : null,
            };
        });
    }
    
    return resultMap;     
}

// find availability schedule seasons
async function findavailabilityScheduleSeasonFunction(seasons){

    if (seasons.length === 0) {
        return [];
    }

    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth() + 1;
    let currentDate = new Date();

    return seasons
        .map(item => filterSeason(item, currentYear, currentMonth, currentDate))
        .filter(Boolean);    
}

// filter season
function filterSeason(item, currentYear, currentMonth, currentDate) {
    let { startDate, endDate, pricingRecords } = item;
    let { daysOfWeek } = pricingRecords[0];
    let startDateParts = startDate.split('-');
    let seasonYear = parseInt(startDateParts[0]);
    let startSeasonMonth = parseInt(startDateParts[1]);

    let endSeasonYear = null;
    if (endDate) {
        let endDateParts = endDate.split('-');
        endSeasonYear = parseInt(endDateParts[0]);
    }

    if ((seasonYear === currentYear && startSeasonMonth >= currentMonth) ||
        (endSeasonYear && endSeasonYear >= currentYear && seasonYear < currentYear) ||
        (seasonYear <= currentYear && !endSeasonYear)) {
        let filteredUnavailableDates = [];


        if(pricingRecords[0].hasOwnProperty("timedEntries") ?? timedEntries[0]?.unavailableDates){
            filteredUnavailableDates = filterUnavailableDates(
                pricingRecords[0].timedEntries[0].unavailableDates, currentYear, currentMonth, currentDate
            );
        }
        
        return {
            startDate,
            endDate,
            daysOfWeek,
            unavailableDates: filteredUnavailableDates,
        };
    }

    return null;
}

// filter un available dates
function filterUnavailableDates(unavailableDates, currentYear, currentMonth, currentDate) {
    if (!unavailableDates) {
        return [];
    }

    return unavailableDates.filter(dateObj => {
        let dateParts = dateObj.date.split('-');
        let dateYear = parseInt(dateParts[0]);
        let dateMonth = parseInt(dateParts[1]);
        let dateDay = parseInt(dateParts[2]);
        let unavailableDate = new Date(dateYear, dateMonth - 1, dateDay);

        return dateYear === currentYear && dateMonth >= currentMonth && unavailableDate >= currentDate;
    });
}

// common error handeling function for this page.
function handleError(response, fName, fPath, requestBody, error) {
    const errorObject = {
        "STATUS": "ERROR",
        "RESPONSE": {
            "text": error.message
        }
    };
    apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(requestBody));
    response.send(errorObject);
}

// read supplier data from file.
async function readDataFromFile(supplierProductCode, fullPath, providerDetails, clientId, request, response, supplierDetails){
    try {
        let supplierResponseData = {};
        // Read data from file
        let jsonData = fs.readFileSync(fullPath, 'utf8');
        let supplierData = JSON.parse(jsonData);
        // Checking if the product is alredy exist in the file
        if(supplierData.hasOwnProperty(supplierProductCode)){
            // Check if the time is grater than 1 month if grater return true other wise false.
            let DateTimeChecking = await apiCommonController.checkTimeDifferenceFunction(supplierData[supplierProductCode].timeStamp, 1, "W");
            // If the product is exist then check the time
            if(!DateTimeChecking){
                //Take the data from file.
                supplierResponseData = supplierData[supplierProductCode] ?? {};
            }
            else{
                // Fetching new data from viator api and save it to file.
                let supplierApiResponse = await apiResponse.getSupplierDetailsFromApi(providerDetails, clientId, supplierDetails, request, request.body);                
                // Checking if the data is valid.
                if(supplierApiResponse && supplierApiResponse?.suppliers){
                    // Save data to file.
                    await cacheSupplierDetailsToFile(supplierProductCode, "RD", supplierApiResponse);
                    // Send back the response.
                    supplierResponseData = supplierApiResponse;
                }
                
            }
        }
        else{
            // If the product is not exist then fetch new data from viator.
            let supplierApiResponse = await apiResponse.getSupplierDetailsFromApi(providerDetails, clientId, supplierDetails, request, request.body);
            // Checking the data.
            if(supplierApiResponse && supplierApiResponse?.suppliers){
                // Save data to file.
                await cacheSupplierDetailsToFile(supplierProductCode, "RD", supplierApiResponse);
                // Send the response.
                supplierResponseData = supplierApiResponse;
            }                        
        }
        return supplierResponseData;
    }   
    catch (error) {
        console.log(error);    
    }
}

// Save supplier details to file
async function cacheSupplierDetailsToFile(supplierProductCode, action, newSupplierData){
    try {
        // File location
        let filePath = config.viator_supplier_details_caching_file_location    
        let fullPath = path.join(process.cwd(), filePath);

        let jsonData;
        let resForamat;
        // Creating saving object
        let data = {
            suppliers : newSupplierData?.suppliers ?? [],
            timeStamp : new Date(),
            totalCount : newSupplierData?.suppliers?.length ?? 0
        }

        if(action == "Wt"){            
            // If it is the first time adding the data.
            resForamat = {
                [supplierProductCode] : data
            }
        }
        else if(action == "RD"){           

            let supplierJsonData = fs.readFileSync(fullPath, 'utf8');
            let existingSupplierData = JSON.parse(supplierJsonData);       

            // taking the existing object for saving;
            existingSupplierData[supplierProductCode] = data 

            resForamat = existingSupplierData     
        }

        // stringify data 
        jsonData = JSON.stringify(resForamat, null, 2);
        // write data to file.
        fs.writeFileSync(process.cwd() + filePath, jsonData, 'utf-8');
        console.log("Supplier Data saved Successfully");
        return null;        
    }
    catch (error) {
        console.log("========= Supplier details caching failed =========");
        console.log(error);    
    }
}

// If the file is not exist create new file and save supplier details to file.
async function getNewSupplierDetailsFromApiAndSaveDataToFile(supplierProductCode, filePath, providerDetails, clientId, request, response, supplierDetails){
    try {
        let supplierResponseData = {}
        // File path
        const fullPath = path.join(process.cwd(), filePath);
        const directory = path.dirname(fullPath);
        // Checking if the folder is exist or not if it is not then create new folder.
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        // Fetch data from viator.
        let supplierApiResponse = await apiResponse.getSupplierDetailsFromApi(providerDetails, clientId, supplierDetails, request, request.body);
        // Checking the data.
        if(supplierApiResponse && supplierApiResponse?.suppliers){
            // Save data to file
            await cacheSupplierDetailsToFile(supplierProductCode, "Wt", supplierApiResponse);
            // Send the response.
            supplierResponseData = supplierApiResponse;
        }        
        return supplierResponseData;
    }
    catch (error) {
        console.log(error);    
    }
}

async function getReviewsDataFromFileOrApi(ProductCode, providerDetails, clientId, request, response){
    try {
        let userReviews = {};
        let reviewsDetails = {
            "URL" : `reviews/product`,
            "productCode" : ProductCode
        }

        // get reviews details file path from config.
        const reviewsFilePath = config.viator_product_user_reviews_caching_file_location;
        // extracting the full path
        const reviewsFullPath = path.join(process.cwd(), reviewsFilePath);

        if(fs.existsSync(reviewsFullPath)){
            // If the file is exist then take data from file.
            let userReviewsDataFromFile = await readUserReviewsDataFromFile(ProductCode, reviewsFullPath, providerDetails, clientId, request, response, reviewsDetails);
            userReviews = userReviewsDataFromFile;
        }
        else{
            // If the file is not exist then create new file and get data from api and save it to file.
            let userReviewsDataFromFile = await getNewUserReviewsFromApiAndSaveDataToFile(ProductCode, reviewsFilePath, providerDetails, clientId, request, response, reviewsDetails)
            userReviews = userReviewsDataFromFile;
        }
        return userReviews;
    }
    catch (error) {
        console.log(error);    
    }
}

// Read user reviews data from file
async function readUserReviewsDataFromFile(ProductCode, fullPath, providerDetails, clientId, request, response, reviewsDetails){
    try {
        
        let reviewsResponseData = {};
        // Read data from file
        let jsonData = fs.readFileSync(fullPath, 'utf8');
        let reviewsData = JSON.parse(jsonData);
        // Checking if the product is alredy exist in the file
        if(reviewsData.hasOwnProperty(ProductCode)){
            // Check if the time is grater than 1 month if grater return true other wise false.
            let DateTimeChecking = await apiCommonController.checkTimeDifferenceFunction(reviewsData[ProductCode].timeStamp, 1, "M");
            // If the product is exist then check the time
            if(!DateTimeChecking){
                //Take the data from file.
                reviewsResponseData = reviewsData[ProductCode]?.reviews ?? {};
            }
            else{
                // Fetching new data from viator api and save it to file.
                let reviewsApiResponse = await apiResponse.getReviewsDetailsFromApi(providerDetails, clientId, reviewsDetails, request, request.body);
                // Checking if the data is valid.
                if(reviewsApiResponse && reviewsApiResponse?.reviews){
                    // Save data to file.
                    await cacheReviewsDetailsToFile(ProductCode, "RD", reviewsApiResponse)
                    // Send back the response.
                    reviewsResponseData = reviewsApiResponse;
                }
                
            }
        }
        else{
            // If the product is not exist then fetch new data from viator.
            let reviewsApiResponse = await apiResponse.getReviewsDetailsFromApi(providerDetails, clientId, reviewsDetails, request, request.body);
            // Checking the data.
            if(reviewsApiResponse && reviewsApiResponse?.reviews){
                // Save data to file.
                await cacheReviewsDetailsToFile(ProductCode, "RD", reviewsApiResponse);
                
                // Send the response.
                reviewsResponseData = reviewsApiResponse;
            }                        
        }
        return reviewsResponseData;

    }
    catch (error) {
        console.log(error);    
    }
}

// new user review caching 
async function getNewUserReviewsFromApiAndSaveDataToFile(ProductCode, filePath, providerDetails, clientId, request, response, reviewsDetails){
    try {
        let reviewsResponseData = {}
        // File path
        const fullPath = path.join(process.cwd(), filePath);
        const directory = path.dirname(fullPath);
        // Checking if the folder is exist or not if it is not then create new folder.
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        // Fetch data from viator.
        let reviewsApiResponse = await apiResponse.getReviewsDetailsFromApi(providerDetails, clientId, reviewsDetails, request, request.body);
        // Checking the data.
        if(reviewsApiResponse && reviewsApiResponse?.reviews){
            // Save data to file
            await cacheReviewsDetailsToFile(ProductCode, "Wt", reviewsApiResponse);
            // Send the response.
            reviewsResponseData = reviewsApiResponse;
        }        
        return reviewsResponseData;
    }
    catch (error) {
        console.log(error);    
    }
}

// Save reviews data to file
async function cacheReviewsDetailsToFile(ProductCode, action, reviewsApiResponse){
    try {
        // File location
        let filePath = config.viator_product_user_reviews_caching_file_location    
        let fullPath = path.join(process.cwd(), filePath);

        let jsonData;
        let resForamat;
        // Creating saving object
        let data = {
            reviews : reviewsApiResponse ?? {},
            timeStamp : new Date(),
            totalCount : reviewsApiResponse?.reviews?.length ?? 0
        }

        if(action == "Wt"){            
            // If it is the first time adding the data.
            resForamat = {
                [ProductCode] : data
            }
        }
        else if(action == "RD"){           

            let reviewsJsonData = fs.readFileSync(fullPath, 'utf8');
            let existingReviewsData = JSON.parse(reviewsJsonData);       

            // taking the existing object for saving;
            existingReviewsData[ProductCode] = data 

            resForamat = existingReviewsData     
        }

        // stringify data 
        jsonData = JSON.stringify(resForamat, null, 2);
        // write data to file.
        fs.writeFileSync(process.cwd() + filePath, jsonData, 'utf-8');
        console.log("Reviews Data saved Successfully");
        return null;  
    }
    catch (error) {
        console.log(error);    
    }
}

//===================== location caching ==================//
// Filter out location and take only 500 locations max.
async function findLocation(clientId, providerDetails, allPickupLocations, productCode, locationKey){
    try {
        // Set an empty array for storing locations ref.
        let pickUpLocData = [];
       
        // Defined the file path.
        const fullPath = path.join(process.cwd(), filePath);            
        // Checking the file is exist or not
        if(fs.existsSync(fullPath)){
            // read data from file.
            let data = fs.readFileSync(fullPath, 'utf8');
            if(!data){
                // If the file not found the product then take data from api and save it to file.
                pickUpLocData = await cacheAndGetPickupLocationData(allPickupLocations, productCode, clientId, providerDetails, "Wt", locationKey, fullPath)   
            }
            else{
                // parse data
                let jsonData = JSON.parse(data);
                // checking the file have required product.
                if(jsonData.hasOwnProperty(productCode)){

                    pickUpLocData = await updateProductAndCache(jsonData, productCode, locationKey, allPickupLocations, clientId, providerDetails, fullPath)
                                                                                             
                }
                else{
                    // If the file not found the product then take data from api and save it to file.
                    
                    pickUpLocData = await cacheAndGetPickupLocationData(allPickupLocations, productCode, clientId, providerDetails, "RD", locationKey, fullPath)
                    
                }
            }            
        }
        else {
            // Initial file create.                
            if(allPickupLocations){

                pickUpLocData = await cacheAndGetPickupLocationData(allPickupLocations, productCode, clientId, providerDetails, "Wt", locationKey, fullPath)
                
            }
        }
        
        return (pickUpLocData);                                       
    }
    catch (error) {
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

//Function to create array for requesting api, extract all the locations reference.
async function generateFinalArrayForRequest(allPickupLocations){
    try {
        // Initialize an empty array to store multiple arrays
        let cachingLocationMultipleArr = [];
        //Initialize an empty array to store a single array of elements
        let cachingLocArr = []; 

        for(let pLoc = 0; pLoc < allPickupLocations.length; pLoc++){
            if(pLoc % 499 == 0 && pLoc != 0 ){
                // If the index is a multiple of 500 (except 0), push elements into cachingLocArr
                // and then push cachingLocArr into cachingLocationMultipleArr, then reset cachingLocArr
                cachingLocArr.push(allPickupLocations[pLoc]);
                cachingLocationMultipleArr.push(cachingLocArr)
                cachingLocArr = [];
            }
            else {
                // If not a multiple of 500 or at the start, push elements into cachingLocArr
                // Also, if it's the last element, push cachingLocArr into cachingLocationMultipleArr
                cachingLocArr.push(allPickupLocations[pLoc]);
                if(pLoc + 1 == allPickupLocations.length){
                    cachingLocationMultipleArr.push(cachingLocArr)
                }
            }
        }
        return cachingLocationMultipleArr;
    }
    catch (error) {
        console.log(error);    
    }
}

// fetching data from api and storing data to file.
async function cachingPickupLocations(cachingLocationMultipleArr, productCode, clientId, providerDetails, action, locationKey){
    try {
        let fullPath = path.join(process.cwd(), filePath);
        // Defined the file directory.
        let directory = path.dirname(fullPath);     
        //looping through mulidimentional array.
        let finalLocationArray = [];
        let count = 0;
        let loc = 0;
        while(loc < cachingLocationMultipleArr.length){

            let pickUpLocData = await apiResponse.getLocationDetailsFromMap(clientId, providerDetails, cachingLocationMultipleArr[loc]);
            
            // Checking response is valid.            
            if(pickUpLocData &&  Array.isArray(pickUpLocData?.locations) && pickUpLocData?.locations?.length !=0 ){
                
                finalLocationArray.push(...pickUpLocData.locations);
                count = 0;                
            }
            else if (count != 1){
                loc = loc - 1;
                count = 1;
            }
            loc++
        }
        
        if(finalLocationArray.length != 0){
            // data storing like object.
            let data = {
                locations : finalLocationArray,
                "timeStamp" : new Date(),
                "totalCount" : finalLocationArray?.length ?? 0
            }  
            let finalData;
            let jsonData;
            // if First time writing data.
            if(action == "Wt"){

                // Create the directory if it doesn't exist
                if (!fs.existsSync(directory)) {
                    // Create a folder
                    fs.mkdirSync(directory, { recursive: true });
                }   

                finalData = {
                    [productCode] : {
                        [locationKey] : data
                    }
                }
                // stringify data
                jsonData = JSON.stringify(finalData, null, 2);
            }
            else if(action == "RD"){
                                
                // parse data
                let jsonFileData  = await readFileAndUpdate(fullPath, productCode, locationKey, data)
                
                jsonData = JSON.stringify(jsonFileData, null, 2);
            }
                        
            // Writing data to file.
            fs.writeFileSync(process.cwd() + filePath, jsonData, 'utf-8');
            console.log(`${locationKey} locatios Saved successfully`);
        }
        return null;
    }
    catch (error) {
        console.log(error);    
    }
}

// read data from json file.
async function readDataFromJsonFile(locationKey, productCode, fullPath){
    try {
        let pickUpLocData = [];

        let data = fs.readFileSync(fullPath, 'utf8');
        // parse data
        let jsonData = JSON.parse(data);
        // taking the particular product data.
        pickUpLocData = jsonData[productCode][locationKey]?.locations ?? [];

        return pickUpLocData;
    }
    catch (error) {
        console.log(error);    
    }
}

// read data from file and update data 
async function readFileAndUpdate(fullPath, productCode, locationKey, data){
    let fileData = fs.readFileSync(fullPath, 'utf8');
    // parse data
    let jsonFileData = JSON.parse(fileData);

    // if writing to existing file.
    if(jsonFileData[productCode]){
        // write only the specifyied key values
        jsonFileData[productCode][locationKey] = data
    }
    else{
        // replace all the data.
        jsonFileData[productCode] = {
            [locationKey] : data
        }
    }
    return jsonFileData
    
}

async function cacheAndGetPickupLocationData(allPickupLocations, productCode, clientId, providerDetails, action, locationKey, fullPath){
    //final array generating for sending request.
    let cachingLocationMultipleArr = await generateFinalArrayForRequest(allPickupLocations)
    // caching pickup locations to file.
    await cachingPickupLocations(cachingLocationMultipleArr, productCode, clientId, providerDetails, action, locationKey);
    // read data from file and send response.
    let pickUpLocData = await readDataFromJsonFile(locationKey, productCode, fullPath)
    return pickUpLocData
}

// if product exist in file update and cache
async function updateProductAndCache(jsonData, productCode, locationKey, allPickupLocations, clientId, providerDetails, fullPath){
    let pickUpLocData;
    // take the corresponding product
    let desiredproductData = jsonData[productCode];
    if(desiredproductData.hasOwnProperty(locationKey)){
        // Check if the time is grater than 1 month if grater return true other wise false.
        let DateTimeChecking = await apiCommonController.checkTimeDifferenceFunction(desiredproductData[locationKey].timeStamp, 1, "M");

        if(DateTimeChecking){
            // If the time is grater than 1 month then add new data.
            pickUpLocData = await cacheAndGetPickupLocationData(allPickupLocations, productCode, clientId, providerDetails, "RD", locationKey, fullPath)

        }
        else{
            // If the time is not grater than 1 month take existing data.
            pickUpLocData = desiredproductData[locationKey].locations
        }      
    }
    else{
        // If the file not found the product then take data from api and save it to file.
        pickUpLocData = await cacheAndGetPickupLocationData(allPickupLocations, productCode, clientId, providerDetails, "RD", locationKey, fullPath)

    }
    return  pickUpLocData;
}
