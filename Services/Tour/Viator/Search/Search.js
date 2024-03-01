//=========================================================================================//
/*
    viator product search 
    /products/search
    formate response to common format and add markup price.
    Match the search term with the destination id in the destination.json file,
    and pass the destination id to the viator api and send back the result to client.
    send request to viator api and send the response to client. 
*/
//=========================================================================================//

"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const fs = require('fs');
const markupPrice = require("../markupCommission/tourMarkup.js")
const markupMoonstrideData = require("../markupCommission/Response.js");
const breadCrumsResponse = require("../BreadCrums/BreadCrums.js");
const config = require("../../../../Config.js");
const path = require("path");

module.exports = async (app) => {    
    app.post("/:id/Tour/Viator/Search", async function (request, response, next) {
        // Validating request fields. 
        await apiCommonController.viatorSearchReqValidator(request, response, next);
    }, async function (request, response) {
        
        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "Search_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_SEARCH_PROVIDER_SEARCH_FILE_PATH, config.Provider_Code_VTR);
        try {
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");        
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }

            // Destination ID from predictive search response.
            let searchDestinationId = requestObj.searchDestinationId;
            // Start date.
            let startDate = requestObj.startDate;
            // End date.
            let endDate = requestObj.endDate;
            // Start page.
            let startPoint = requestObj.page;
            // Total response count at a time.
            let productCount = 15;
            
            // Pagination for Viator: start point, start index, count.
            let pagination = {
                "startPoint" : 1,
                "start" : startPoint,
                "count" : productCount
            }
            // Set the start point and page count. 
            if(startPoint && startPoint > 1){
                startPoint = (startPoint * 15) - 14;
                pagination.start = startPoint;
                pagination.count = productCount;
            }
            
            // Get destination id using search text. it only get when the text matches properly. 
            if(searchDestinationId && typeof searchDestinationId !== "string"){
                // Checking the filter objects and formatting  it.
                // If the filter object is not present on the request it will create a new filter object with the current request.
                if(!requestObj.filters || Object.keys(requestObj.filters).length === 0){
                    requestObj['filters'] = {};
                }                
                requestObj.filters['destination'] = searchDestinationId;
                requestObj.filters['startDate'] = startDate;
                requestObj.filters['endDate'] = endDate;

                // Filter object formatting and rearrange.
                let filter_object = await filter_option(requestObj.filters, request, clientId, providerDetails);

                // Creating a request body for viator search. 
                let searchObject = {
                    "filtering" : filter_object,
                    "pagination" : pagination,
                    "currency" : requestObj.currency
                }

                // Setting up the sorting object. 
                if(requestObj.sorting){
                    searchObject.sorting = requestObj.sorting
                }

                // Get viator api response for search destination.
                let result = await apiResponse.getSearchApiReponse(clientId, providerDetails, "products/search",  searchObject, request);
                let parameterObject = {
                    searchDestinationId, 
                    fName,
                    fPath, 
                    request, 
                    result, 
                    requestObj, 
                    clientId, 
                    providerDetails
                }
                // Format the response for sending.
                let searchResponse = await searchResponseFormat(parameterObject)
                response.status(200).send(searchResponse);
            } else{
                response.status(200).send({
                    "Result": {
                        "Code": 400,
                        "Error": {
                            "Message": "Invalid destination ID or missing search destination ID."
                        }
                    }
                });
            }    
        } catch (error) {
            // Handle error safely and add logs
            const errorObject = {
                "Result": {
                    "Code" : 400,
                    "STATUS": "ERROR",
                    "RESPONSE": {
                        "text": error.message
                    }
                }
            }
            apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
            response.send(errorObject);
        }
    });
};

// Format the Viator result object to a common result format and remove unnecessary fields
async function result_object_formatter(result, providerDetails, requestObj, clientId, request, fName, fPath){
    try{
        // Final data object.
        let final_result = {
            status : true,
            provider : config?.Provider_Code_VTR,
            pageLayout : (providerDetails?.pageLayout)? providerDetails?.pageLayout : "LTR",
            // Adding result total count.
            totalCount : result?.totalCount
        }
        let finalData = [];
        let resultObj = result?.products;
        let tagsArr = [];

        // Agent markup msToken token
        let token = requestObj?.msToken;
        let agentID = requestObj?.agentGuid;
        let DBMarkupCommissionDataTest = false;
        // Checking the agent id is present then only the markup will apply.
        if(agentID && agentID != ""){
            let supplierCurrency = resultObj[0]?.pricing?.currency ?? requestObj?.currency;
            DBMarkupCommissionDataTest = await markupMoonstrideData.getMarkupDbApiReponse(clientId, agentID, token, supplierCurrency, request, providerDetails);                
        }
        // Check the data is valid or not.
        let DBMarkupCommissionDataTestData = setDBMarkupCommissionDataTest(DBMarkupCommissionDataTest);
        DBMarkupCommissionDataTest = DBMarkupCommissionDataTestData;    

        for(let i = 0; i < resultObj.length; i++){
            let responseData = await getFinalData(i, resultObj, clientId, requestObj, request, DBMarkupCommissionDataTest, tagsArr);            
            finalData.push(responseData?.productObj);
            tagsArr = responseData?.tagsArr;
        }
        
        // Get tag details from file and make it as array of objects for tags.
        let argumetObject = {
            "destinationId" : requestObj?.searchDestinationId,
            clientId,
            providerDetails
        }
        // Find and set tags data.
        let tagsData = await setTagsData(tagsArr, request, fName, fPath, argumetObject)
        final_result.tags = tagsData
        final_result.data = finalData
        // Send final result object.
        return(final_result);        
    } catch(error){
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

// Read tags json file and return tag array object.
async function findTagValue(tagArr, request, fName, fPath, {clientId, providerDetails, destinationId}){
    try{
        let result = []
        let tagsFilePath = config?.Tour_Viator_Product_Tags_Caching_Location;
        let tagsFullPath = path.join(process.cwd(), tagsFilePath);
        let directory = path.dirname(tagsFullPath);
        let tagArray = [];
        // Checking if the file is exist or not.
        if(fs.existsSync(tagsFullPath)){
            let jsonData = fs.readFileSync(tagsFullPath, 'utf8');
            let tagsData = JSON.parse(jsonData);
            if(tagsData.hasOwnProperty(destinationId)){
                let DateTimeChecking = await apiCommonController.checkTimeDifferenceFunction(tagsData[destinationId].timeStamp, 1, "W");
                // If the product is exist then check the time
                if(!DateTimeChecking){
                    // Take the data from file.
                    tagArray = tagsData[destinationId]?.tags ?? {};
                } else{
                    // Get data from tags api.
                    let tagsDetails = await apiResponse.getTagsFromApi(clientId, providerDetails, destinationId, request);
                    // Cache data to file.
                    await cacheTagsDataToFileAndReadDataFromFile(tagsFilePath, tagsDetails, destinationId, "RD");
                    tagArray = tagsDetails.tags;
                }
            } else{
                // Get tags details from api
                let tagsDetails = await apiResponse.getTagsFromApi(clientId, providerDetails, destinationId, request);
                if(tagsDetails?.tags){
                    await cacheTagsDataToFileAndReadDataFromFile(tagsFilePath, tagsDetails, destinationId, "RD");
                }                
                tagArray = tagsDetails.tags;      
            }                   
        } else{
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }
            // Get tags details from api
            let tagsDetails = await apiResponse.getTagsFromApi(clientId, providerDetails, destinationId, request);
            if(tagsDetails?.tags){
                await cacheTagsDataToFileAndReadDataFromFile(tagsFilePath, tagsDetails, destinationId, "Wt");
            }            
            tagArray = tagsDetails.tags;                  
        }  
        // Checking the tags are present in the array, if it is presnt then return a object.
        if(Array.isArray(tagArray)){
            result = tagArray.filter(item => tagArr?.includes(item.tagId))
            .map(item =>({
                code: item.tagId,
                value: item.allNamesByLocale.en || '' 
            }));
        }        
        return result;
        
    } catch(error){
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

// Cache tags data to file and read data from file 
async function cacheTagsDataToFileAndReadDataFromFile(filePath, tagsData, destinationId, action){
    try {
        // File location  
        let fullPath = path.join(process.cwd(), filePath);
        let jsonData;
        let resForamat;
        // Creating saving object
        let data = {
            tags : tagsData?.tags ?? [],
            timeStamp : new Date(),
            totalCount : tagsData?.tags?.length ?? 0
        }

        if(action == "Wt"){            
            // If it is the first time adding the data.
            resForamat = {
                [destinationId] : data
            }
        } else if(action == "RD"){           

            let tagsJsonData = fs.readFileSync(fullPath, 'utf8');
            let existingTagsData = JSON.parse(tagsJsonData);       
            // Taking the existing object for saving;
            existingTagsData[destinationId] = data 
            resForamat = existingTagsData     
        }

        // Stringify data to save into a file.
        jsonData = JSON.stringify(resForamat, null, 2);
        // Write data to file.
        fs.writeFileSync(process.cwd() + filePath, jsonData, 'utf-8');
        console.log("Tags Data saved Successfully");
        return null;        
    }
    catch (error) {
        console.log("========= Tags caching failed =========");
        console.log(error);    
    }
}

 // Object formatter for creating filter objects required by the Viator product search API.
async function filter_option(requestObj, request, clientId, providerDetails){
    let fName = "Search_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_SEARCH_PROVIDER_SEARCH_FILE_PATH, config.Provider_Code_VTR);

    try{
        // Filter for get only instant confirmation product.
        let filter_object = {
            "confirmationType": "INSTANT",
        };
        // Including manual confirmation product by removing confirmation type filtering.
        if(providerDetails?.manualConfirm && providerDetails?.manualConfirm == "Yes"){
            filter_object = {}
        }
        // Filtering key names.
        const filterKeys = ['destination', 'startDate', 'endDate', 'flags', 'lowestPrice', 'highestPrice', 'durationInMinutes', 'rating', 'tags'];
        filterKeys.forEach((key)=>{
            // Checking the names present in the array an return the object.
            if(key in requestObj){
                filter_object[key] = requestObj[key];
            }
        })
        return(filter_object);
    }catch(error){
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

// Find duration by itinary
async function findDurationFromTour(resultObj){
    try {
        // Find duration, default duration is 1day.
        let duration = "1-Day";
        if(resultObj?.duration){
            let resultDuration = resultObj?.duration;
            duration = (resultDuration?.variableDurationToMinutes)? resultDuration?.variableDurationToMinutes : resultDuration?.fixedDurationInMinutes;
        } else if(resultObj.itineraryType == "MULTI_DAY_TOUR"){
            // Get duration from text.
            let title = resultObj.title;
            let description = resultObj.description;
            let daysPattern = /\b(\d+\s*(?:-|\s)Days?)\b/i;
            // Check the title to get duration.
            let titleMatch = title.match(daysPattern);
            // Check the description to get duration.
            let descriptionMatch = description.match(daysPattern);
            if(titleMatch){
                duration = titleMatch[1];
            } else if(descriptionMatch) {
                duration = descriptionMatch[1];
            } else {
                duration = null;
            }

            if(duration == null){ 
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
                
                const result = extractNumber(title, data);
                let setDurationValue = setDuration(result)
                if(setDurationValue != null){
                    duration = setDurationValue
                }
                
            }
        }
        return duration;
    } catch (error) {
        console.log(error);    
    }
}

// Function for format the response data
async function searchResponseFormat({searchDestinationId, fName, fPath, request, result, requestObj, clientId, providerDetails}){
    // Checking if the product is availabe or not.
    if (result != "" && result?.hasOwnProperty('products') && result.totalCount != 0) {                    
        // Waiting to format the result object. send back only important informations only. 
        result = await result_object_formatter(result, providerDetails, requestObj, clientId, request, fName, fPath);        
        if(result.STATUS == "ERROR"){
            return{"Result":result}
        }

        //================== Attraction api / from caching file ===========================//

        let attractionsResponseFromApi = await apiResponse.getAttractionsFromApi(clientId, providerDetails, searchDestinationId, request)
        result.attractions = [];
        if(attractionsResponseFromApi?.Result && attractionsResponseFromApi.Result[0]?.title){
            result.attractions = attractionsResponseFromApi?.Result ?? [];
        }        
        //=============================================================//        
        // Get breadcrums
        let breadCrum = await breadCrumsResponse.getBreadCrums(clientId, searchDestinationId, request)        
        result.breadCrums = breadCrum;
        
        return {
            "Result": result
        }
        
    } else if (result?.hasOwnProperty('message')) {
        return {
            "Result": {
                "Code": 500,
                "Error": {
                    "Message": result?.message || "Internal Server Error"
                }
            }
        };
    } else {
        return {
            "Result": {
                "Code": 400,
                "Error": {
                    "Message": "No data found."
                }
            }
        };
    }
}

// Function for push data in to final data object
async function getFinalData(i, resultObj, clientId, requestObj, request, DBMarkupCommissionDataTest, tagsArr){
    // Get markup api response
    let accessToken = "";    
    let duration = await findDurationFromTour(resultObj[i]);
    requestObj.duration = resultObj[i].duration ?? { fixedDurationInMinutes: (parseInt(duration) * 24 * 60) } ;
    requestObj.pricingInfo = resultObj[i].pricing;
    let markupResponse = {}
    if(DBMarkupCommissionDataTest){
        // Calculate markup price.
        markupResponse = await markupPrice.findAgentMarkupAndCommission(clientId, requestObj, accessToken, request, DBMarkupCommissionDataTest);    
    }
    
    // Final result object.
    let productObj = {
        "productCode" : resultObj[i]?.productCode,
        "title" : resultObj[i]?.title,
        "description" : resultObj[i]?.description,
        "image" : resultObj[i]?.images[0]?.variants[8],
        "reviews" : {
            "numberOfReviews" : (resultObj[i]?.reviews != undefined) ? resultObj[i]?.reviews?.totalReviews : "0",
            "combinedAverageRating" : (resultObj[i].reviews != undefined) ? resultObj[i]?.reviews?.combinedAverageRating : "0.0"
        },
        "duration" : duration,
        "supplierCost" : resultObj[i]?.pricing?.summary?.fromPrice,
        "fromPriceBeforeDiscount" : "",
        "currency" : markupResponse?.AgentCurrencyCode ?? resultObj[i]?.pricing?.currency,
        "flags" : resultObj[i]?.flags,
        "itineraryType" : "NA",
        "confirmationType" : resultObj[i]?.confirmationType ?? ""
    }
    let priceSummary = resultObj[i]?.pricing?.summary;                      
    
    productObj.fromPrice = markupResponse?.TotalSupplierCostAfterAgentMarkup ?? resultObj[i]?.pricing?.summary?.fromPrice;
    
    // Price befor discount tag
    if(productObj.fromPrice < priceSummary.fromPriceBeforeDiscount){
        productObj.fromPriceBeforeDiscount = priceSummary.fromPriceBeforeDiscount;
    }
    // Itinerary Type text 
    productObj.itineraryType = resultObj[i]?.itineraryType?.replace(/_/g, ' ') ;            

    // Tags adding to single array. 
    if(resultObj[i]?.tags){
        // Taking tags from each product.
        let tagOriginalArr = resultObj[i]?.tags ?? [];
        // Checking the tag array if tag is alredy in the array it will skip.
        tagOriginalArr.forEach(element => {
            if(!tagsArr?.includes(element)){
                tagsArr.push(element);
            }
        }) 

    }
    return {
        "productObj" : productObj,
        "tagsArr" : tagsArr
    }
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
    let duration = '1-Day'
    if (result !== null) {
        duration = result + "-Day";
        return duration;
    } else {
        console.log("No matching key found in the text or 'Day' is not present in the text.");
        return duration;
    }
}

// Function for set tag data
async function setTagsData(tagsArr, request, fName, fPath, {clientId, providerDetails, destinationId}){
    if(tagsArr.length != 0){
        // Get tag values from tags json file.
        let tags = await findTagValue(tagsArr, request, fName, fPath, {clientId, providerDetails, destinationId});
        // Checking the returned value as array of objets. 
        if(Array.isArray(tags) && typeof tags[0] === 'object'){
            return tags;
        } else{
            return [];
        }
    } else {
        return [];
    }
}

// Function for set DBMarkupCommissionDataTest
function setDBMarkupCommissionDataTest(DBMarkupCommissionDataTest){
    if(DBMarkupCommissionDataTest){
        if(DBMarkupCommissionDataTest?.Error || DBMarkupCommissionDataTest?.comapnyMarkup?.hasOwnProperty('Error') || DBMarkupCommissionDataTest?.agentmarkup?.hasOwnProperty('Error') || typeof DBMarkupCommissionDataTest !== "object"){                
            DBMarkupCommissionDataTest = false;            
        }                
    }    
    return DBMarkupCommissionDataTest;
}