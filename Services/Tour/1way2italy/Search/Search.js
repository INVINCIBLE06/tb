"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const fs = require('fs');
const markupPrice = require("../markupCommission/tourMarkup.js")
const markupMoonstrideData = require("../markupCommission/Response.js");
const config = require("../../../../Config.js");


module.exports = async (app) => {

    app.post("/:id/Tour/1way2italy/Search", async function (request, response, next) {
        // Validating request fields. 
        await apiCommonController.OneWay2ItalySearchReqValidator(request, response, next);
    }, async function(request, response){

        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "Search_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_SEARCH_PROVIDER_SEARCH_FILE_PATH, config.Provider_Code_OWT);
        
        try{
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "OneWay2Italy");  
            if(!providerDetails.Requestor_ID && !providerDetails.Password) {
                throw new Error(config.OWTApiKeyErrorMessage);
            };

            // Get destination city code using destination id from the request.
            if(typeof requestObj.searchDestinationId !== "number"){
                let cityCode = requestObj.searchDestinationId.toUpperCase();
                // Get supplier codes for the corresponding city code from the file.                                
                let supplierChainCodes = await getSupplierChainCodeFromDestination(cityCode, providerDetails.availableSuppliers, request, clientId);

                if(supplierChainCodes.length != 0 && !supplierChainCodes.STATUS){
                    
                    let searchObject = {
                        "code" : cityCode,
                        "supplierChainCodes" : supplierChainCodes,
                        "catCode" : requestObj?.categoryCodes ?? providerDetails?.defaultCategory,
                        "startDate" : requestObj.startDate,
                        "endDate" : requestObj.endDate,
                        "currency" : requestObj.currency,
                        "selectedPassengersData" : requestObj?.selectedPassengersData ?? []
                    };
                    // Get location api response from 1way2Italy.
                    let result = await apiResponse.getSearchApiReponse(clientId, "touractivityavail",  searchObject, providerDetails);
                    handleAvailability(result, request, response, requestObj, clientId, providerDetails);
                } else{
                    response.status(200).send({
                        "Result": {
                            "Code": 200,
                            "Error": {
                                "Message": supplierChainCodes?.RESPONSE?.text || supplierChainCodes || "Supplier not found for the destination."
                            }
                        }
                    });
                }
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
        } catch(error){
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

    })
}

// Function for handle product details and availability.
async function handleAvailability(result, request, response, searchObject, clientId, providerDetails){
    if(result && result.length != 0 && Array.isArray(result)){
        // Some product has more than one object so remove the same product.
        let withoutDuplicateData = await removeDuplicatedResultData(result);
        if(withoutDuplicateData.length == 0){
            withoutDuplicateData = result;
        }
        let resultObject = await resultObjectFormatter(withoutDuplicateData, request, searchObject, clientId, providerDetails);
        if(resultObject && resultObject.status){
            response.status(200).send({
                "Result": resultObject
            });
        }                
    } else if(result?.RESPONSE?.text == "No availability"){        
        response.status(200).send({
            "Result": {
                "Code": 400,
                "Error": {
                    "Message": "No Available data found for this search criteria."
                }
            }
        });                                                                                    
    } else if(result?.RESPONSE?.text == "Invalid check-out date"){                
        response.status(200).send({
            "Result": {
                "Code": 400,
                "Error": {
                    "Message": "Please select valid the Start date or End Date."
                }
            }
        });                        
    } else{
        response.status(200).send({
            "Result": {
                "Code": 500,
                "Error": {
                    "Message": result?.message ?? result?.RESPONSE?.text ?? "Internal Server Error"
                }
            }
        });   
    }    
}

// Result object formtting for common response structur.
async function resultObjectFormatter(data, request, searchObject, clientId, providerDetails){
    let fName = "Search_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_SEARCH_PROVIDER_SEARCH_FILE_PATH, config.Provider_Code_OWT);
    try{
        let finalData = await handleResultData(data, request, searchObject, clientId, providerDetails);

        //============= Adding filter ===================//
        const filters = searchObject?.filters ?? {};
        if(Object.keys(filters).length > 0){ 
            finalData = await filterFinalResult(finalData, filters);            
        }
        // Checking the sort order and sort option.
        if(searchObject?.sorting?.sort == 'PRICE' && searchObject?.sorting?.order == 'ASCENDING'){
            let sortedData = await sortFinalResult(finalData, 'ASCENDING');
            finalData =  sortedData;
        } else if(searchObject?.sorting?.sort == 'PRICE' && searchObject?.sorting?.order == 'DESCENDING'){
            let sortedData = await sortFinalResult(finalData, 'DESCENDING');
            finalData =  sortedData;
        }
        //========================================================//

        return(finalData);
       
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
   
};

// Function for handle result data of OWT
async function handleResultData(resultData, request, searchObject, clientId, providerDetails){
    let fName = "Search_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_SEARCH_PROVIDER_SEARCH_FILE_PATH, config.Provider_Code_OWT);
    try{
        let final_result = {
            status : true,
            provider : config.Provider_Code_OWT,
            pageLayout : "LTR",
            // Adding result total count.
            totalCount : resultData.length
        };

        if(resultData.length != 0){        
            let finalData = [];            
            let token = searchObject.msToken;
            let agentID = searchObject.agentGuid;

            let DBMarkupCommissionDataTest = false;
            // Check the agent is present or not.
            if(agentID && agentID != ""){
                let supplierCurrency = "EUR" ?? searchObject.currency;
                // Get markup calculations and price.
                DBMarkupCommissionDataTest = await markupMoonstrideData.getMarkupDbApiReponse(clientId, agentID, token, supplierCurrency, request, providerDetails);
            }
            if(DBMarkupCommissionDataTest){
                if(DBMarkupCommissionDataTest?.comapnyMarkup?.hasOwnProperty('Error') || DBMarkupCommissionDataTest?.agentmarkup?.hasOwnProperty('Error') || DBMarkupCommissionDataTest?.Error || typeof DBMarkupCommissionDataTest !== "object"){                
                    DBMarkupCommissionDataTest = false;
                }                
            }
            let productObjData = await setProductObjData(resultData, searchObject, DBMarkupCommissionDataTest, clientId, request)
            finalData = productObjData
            // Get tag value
            final_result.tags = [];        
            final_result.data = finalData;        
        };
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
    
};

// Get supplier chain code using city code 
async function getSupplierChainCodeFromDestination(code, supplierList, request, clientId){
    let fName = "Search_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_SEARCH_PROVIDER_SEARCH_FILE_PATH, config.Provider_Code_OWT);
    try{
        // File path for supplier destination location.
        let filePath = `${config.OneWay2italy_Destination_File_Path}`;
        let data = fs.readFileSync(process.cwd() + filePath, 'utf8')
        if(!data){
            throw new Error("Failed to get destination data.");
        }
        let jsonData = JSON.parse(data);
        // An array of locations.
        
        jsonData = jsonData.Data;
        // Filter supplier codes from the json data according to the city code.
        let suppliersData = jsonData.find((item) => item.CityCode === code);
        if(suppliersData){
                    
            // Checking if the search item is available for the subscribed supplier list.
            let supplierExist = supplierList.some(value => suppliersData.supplierChainCodes.includes(value.SupplierCode));
            if (!supplierExist) {
                let error = `The Selected city has a different supplier you are not selected those suppliers.`;
                const errorObject = {
                    "STATUS": "ERROR",
                    "RESPONSE": {
                        "text": error
                    }
                }
                return (errorObject)
            }
            else{
                suppliersData = (suppliersData)? suppliersData.supplierChainCodes : [];                                       
                return (suppliersData)
                
            }   
        }
        else{
            let errorObject = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": "Destination not found."
                }
            }
            return (errorObject)
        }        
        
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
};

// Function to set itineray type and activity code
function handleItinerayType(resultData, productObj){
    // ItineraryType text 
    if(resultData.TPA_Extensions){
        let itenary = resultData?.TPA_Extensions?.CategoryCodes?.TourActivityCategory?._attributes?.CodeDetail || "";
        switch(itenary){
            case "TRANSFER":
                productObj.itineraryType = "TRANSFER";
                break;
            case "ACTIVITY":
                productObj.itineraryType = "ACTIVITY";
                break;
            case "TOUR":
                productObj.itineraryType = "TOUR";
                break;
            default:
                break;
        }
    }
    else{
        productObj.itineraryType = "NA";
    };
    //Activity code for 1way2Italy
    productObj.activityCode = "";                        
    if(resultData.ActivityRates){
        productObj.activityCode = resultData.ActivityRates?.ActivityRate?._attributes?.ActivityTypeCode || "";
    }
    return(productObj);
};


// Function to handle description.
function handleProductDescription(resultData){
    let descriptionData = "";
    try{
        if(resultData?.ActivityTypes?.ActivityType?.ActivityDescription != undefined){           
            descriptionData = resultData?.ActivityTypes?.ActivityType?.ActivityDescription?.Text?._text || "" ;            
        }                        
        
        return descriptionData;
    }catch(error){         
        return descriptionData || "";
    };        
};

// Function for set product object.
async function setProductObjData(resultData, searchObject, DBMarkupCommissionDataTest, clientId, request){
    // Looping through result array. 
    let responseData = []
    for(const resultDataObj of resultData){

        // Some product have different duration variable and some don't have duration.
        const basicInfo = resultDataObj?.BasicPropertyInfo?._attributes;
        // Reviews data.
        const reviews = resultDataObj?.reviews || {};
        const activityRates = resultDataObj?.ActivityRates?.ActivityRate?.Total?._attributes;

        resultDataObj.duration = "00";
        resultDataObj.searchObject = searchObject;                
        let accessToken = ""

        let markupResponse = {};
        // Calculate markup price.
        if(DBMarkupCommissionDataTest){
            markupResponse = await markupPrice.findAgentMarkupAndCommission(clientId, resultDataObj, accessToken, request, DBMarkupCommissionDataTest);            
        }
        // Final result object.
        let productObj = {
            "productCode" : basicInfo.TourActivityCode || "Null",
            "title" : basicInfo.TourActivityName || "Null",                
            "image" : resultDataObj?.TPA_Extensions?.ImageItems?.ImageItem?.ImageFormat?.URL?._text || "Null",
            "reviews" : {
                "numberOfReviews" : reviews.totalReviews || "0",
                "combinedAverageRating" : reviews.combinedAverageRating || "0.0"
            },
            "duration" : resultDataObj.duration || "00",
            "supplierCost" : activityRates?.AmountAfterTax,
            "fromPrice" : markupResponse.TotalSupplierCostAfterAgentMarkup ?? Number.parseFloat(activityRates?.AmountAfterTax),
            "fromPriceBeforeDiscount" : "",
            "currency" : markupResponse.AgentCurrencyCode ?? "EUR",
            "flags" : []
        };
        // Some times description have different objects
        productObj.description = handleProductDescription(resultDataObj);
        
        productObj = handleItinerayType(resultDataObj, productObj)                        
        // Chain code

        productObj.chainCode = resultDataObj?._attributes?.chainCode || "Null";  
        responseData.push(productObj);
    }
    return responseData
}

// Filter the final result 
async function filterFinalResult(finalData, filters){
    try {
        let array = finalData.data
        // Get the price from request.
        let highestPrice = parseInt(filters?.highestPrice)
        let lowestPrice = parseInt(filters?.lowestPrice)
        let filteredArray;
        
        if(highestPrice == '500'){
            filteredArray = array.filter(data => {
                const fromPrice = parseInt(data.fromPrice)
                return fromPrice >= lowestPrice
            })
            
        } else{
            filteredArray = array.filter(data => {
                const fromPrice = parseInt(data.fromPrice)
                return fromPrice >= lowestPrice && fromPrice <= highestPrice
            })
            
        }
        finalData.data = filteredArray;
        finalData.totalCount = filteredArray.length;
        return finalData
    } catch (error) {
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error.message
            }
        }
        return(errorObject);
    }

    
}

// Sort the final result by price sort option
async function sortFinalResult(finalData, sortOrder){
    try {
        let array = finalData.data;
        let sortedArray;
        // Sort by ascenting order
        if(sortOrder == 'ASCENDING'){
            sortedArray = array.sort((a, b) => a.fromPrice - b.fromPrice);   
        } else if(sortOrder == 'DESCENDING'){
            sortedArray = array.sort((a, b) => b.fromPrice - a.fromPrice);   
        }
        finalData.data = sortedArray;
        return finalData;
    } catch (error) {
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error.message
            }
        }
        return(errorObject);
    }

    
}

// Remove duplicate data from result, check product code and option code if both are same then remove the data
async function removeDuplicatedResultData(result){
    let finalArr = [];
    // Loop through the result and remove duplicate data.
    for(let resultData of result){
        let bookingCode = resultData?.ActivityRates?.ActivityRate?._attributes?.BookingCode;
        let productCode = resultData?.BasicPropertyInfo?._attributes?.TourActivityCode;
        // Find data in array.
        let exist = finalArr.some((item)=>{
            return (
                // Filtering out same product code products.
                productCode === item?.BasicPropertyInfo?._attributes?.TourActivityCode
            );
        })
        if (!exist) {
            finalArr.push(resultData);
        }
    }
    return finalArr;
}