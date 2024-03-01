"use strict";
const axios = require("axios");
const fs = require('fs');
const path = require('path');
const apiResponse = require("./Response.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");
const config = require("../../../../Config.js");
const filePath = config.viator_pickup_location_caching_file_location;


const locationResponse = {

    // Find pickup locations based on transfer arriaval mode.
    fetchViatorPicupLocations: async (clientId, provider, requestObj)=>{
        let fName = "Pickup_Location_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_PICKUP_LOCATION_PROVIDER_PICKUP_LOCATION_FILE_PATH, config.Provider_Code_VTR);
        try{
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }                        
            // Definde the request fields. 
            let url = `products/${requestObj.productCode}`;
            // Get details from viator.
            let result = await apiResponse.getProductDetailsApiReponse(clientId, providerDetails, url, requestObj);
            // Check if the product is active then only execute to next
            if(result.status == "ACTIVE"){
                let logistics = result.logistics;
                // Get locations from viator and google map.
                let getPickupLocationsFromLocationBulk = await getPickuplocationAndDecrypt(clientId, logistics, requestObj, providerDetails, requestObj.productCode);
                // Return response
                return getPickupLocationsFromLocationBulk;
            }
            else{
                throw new Error(result?.message ?? result?.response?.data?.RESPONSE?.text ?? "The selected tour is not active right now.")
            }
        }
        catch(error){
            // Handle error safely and add logs
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, JSON.stringify(requestObj));
            return errorObj;
        }
    },
}
module.exports = locationResponse;

// Function for check arrival mode and filter locations based on arrival mode.
async function getPickuplocationAndDecrypt(clientId, logistics, requestObj, providerDetails, productCode){
    let fName = "Pickup_Location_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_PICKUP_LOCATION_PROVIDER_PICKUP_LOCATION_FILE_PATH, config.Provider_Code_VTR);
    try {
        // Extract arrival mode from request
        let arrivalType = requestObj.arrivalMode;
        // Defined an empty array for adding pickupType.
        
        let mode = [];
        let locationDetails = setLocationDetails(mode, arrivalType)
        if(locationDetails.length > 0){
            mode = locationDetails
        }
        else {
            throw new Error(`Can't find the ${arrivalType} arrival mode`);
        }
        
        // Checking if the details gavepickup locations.
        if(logistics.travelerPickup){
            if(logistics.travelerPickup.locations && logistics.travelerPickup.locations.length != 0){
                // Extract all pickup locations.
                let allPickupLocations = [];
                let productPickupLocations = logistics.travelerPickup.locations;

                allPickupLocations.push(...productPickupLocations);
                // Filter out all locations includes pickup mode.
                let filteredLocations = productPickupLocations.filter(item => mode.includes(item.pickupType));
                // Find locations from viator and google api
                let findLocationsBasedOnArrivalMode = await findLocation(clientId, filteredLocations, providerDetails, allPickupLocations, productCode);
                // Check if the locations are found or not.
                if(Array.isArray(findLocationsBasedOnArrivalMode) && findLocationsBasedOnArrivalMode?.STATUS != "ERROR"){
                    // Decrepty the locations and format it to desired format.
                    let responseObject = await responseObjectFormaterFunction(clientId, providerDetails, findLocationsBasedOnArrivalMode);
                    return { "Result" : responseObject};
                }
                else{
                    throw new Error(findLocationsBasedOnArrivalMode?.RESPONSE?.text?? "Locations not found.")
                }
                
            }
            else{
                throw new Error("No pickup location found for this product.")
            }
        }      
    }
    catch (error) {
        console.log(error);
        const errorObj = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error?.cause ?? error?.message
            }
        };
        apiCommonController.getError(errorObj, fName, fPath, JSON.stringify(requestObj));
        return errorObj;       
    }
}

// Filter out location and take only 500 locations max.
async function findLocation(clientId, filteredLocations, providerDetails, allPickupLocations, productCode){
    try {
        // Set an empty array for storing locations ref.
        let pickUpLocData = [];
        if(filteredLocations.length !=0){
            // Defined the file path.
            const fullPath = path.join(process.cwd(), filePath);      
            let parameters = {
                fullPath, 
                filePath, 
                allPickupLocations, 
                productCode, 
                clientId, 
                providerDetails, 
                pickUpLocData, 
                filteredLocations
            }      
            // Checking the file is exist or not
            if(fs.existsSync(fullPath)){
                pickUpLocData = await funtionIfFileExist(parameters)

            }
            else {
                // Initial file create.                
                if(allPickupLocations){
                    //final array generating for sending request.
                    let cachingLocationMultipleArr = await generateFinalArrayForRequest(allPickupLocations)
                    // Get locations from viator and store it in to file.
                    await cachingPickupLocations(filePath, cachingLocationMultipleArr, productCode, clientId, providerDetails, "Wt")
                    // Read data from file and send the data.
                    pickUpLocData = await readDataFromJsonFile(productCode, fullPath, filteredLocations)
                }
            }
            return (pickUpLocData);                               
        }
        else{
            throw new Error("can't find any pickup locations.")
        }
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
// Search locations and filter out locations based on provider(google or tripadvisor)
async function responseObjectFormaterFunction(clientId, providerDetails, findLocationsBasedOnArrivalMode){
    try {
        let locaArr = [];
        // Extract google locations if any.
        let googleLocReff = findLocationsBasedOnArrivalMode.filter(obj => obj.provider == "GOOGLE");
        // If the google locations are found then check the user have google api key for extract locations.
        if(googleLocReff.length != 0){
            if(providerDetails.Gloc_apiKey && providerDetails.Gloc_apiKey !== ""){
                // Function for fetch google locations.
                let googleLocArr = await findGoogleLocations(clientId, providerDetails, googleLocReff);
                locaArr.push(...googleLocArr);
            }           
        }

        // Filter out only the provider is not google.
        let tripAdvisorLocations = findLocationsBasedOnArrivalMode.filter(obj => obj.provider != "GOOGLE");

        // Checking the response is empty.
        if(tripAdvisorLocations.length != 0){
            // Find trip trip advisor locations.
            let tripAdvisorLocationsArr = await findTripAdvisorLocations(tripAdvisorLocations);
        
            // Add it to final array.
            locaArr.push(...tripAdvisorLocationsArr)
        }
        return locaArr;
    }
    catch (error) {
        console.log(error);    
    }    
}

// Find tripAdvisor locations
async function findTripAdvisorLocations(tripAdvisorLocations){
    // Extract name and reference obj.
    let tripAdvisorLocationsArr = tripAdvisorLocations.map(loc => {

       let resData = {}
       resData.name = loc?.name || "";

        if(loc.address != undefined && loc.address != ""){
            if(loc.address?.street != ""){
                resData.address = `${loc?.address?.street}, ${loc?.address?.state ?? loc?.address?.administrativeArea}, ${loc?.address?.country}`;
            }
            else if(loc.address?.administrativeArea){
                    resData.address = `${loc?.address?.administrativeArea}, ${loc?.address?.country}`;
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

// Find google locations
async function findGoogleLocations(clientId, providerDetails, googleLocReff){
    // Extract placeid from location response from viator.
    let googlePlaceId = googleLocReff.map(loc => loc.providerReference);
    // Send request to google map api and get response.
    let googleapisResponse = await apiResponse.getGoogleLocationDetails(clientId, providerDetails, googlePlaceId);
    // Checking the response is not empty.
    if(googleapisResponse.length != 0 && googleapisResponse.STATUS !== "ERROR"){
        // Comparare response using reference and return name and reference obj.
        let resultArray = googleLocReff.map(obj => {
            const matchingRef = googleapisResponse.find(loc => loc.reference === obj.providerReference);
            if (matchingRef) {
                return ({ name: matchingRef.name, reference: obj.reference, address : matchingRef.address });
            }
        });

        return resultArray;    
    }
    else{
        console.log(googleapisResponse);
        return [];        
    }
}

// Function for set location details
function setLocationDetails(mode, arrivalType){
    // Checking the conditions
    if(arrivalType === "AIR"){
        // If air take only airport locations.
        mode = ["AIRPORT"];
    }
    else if(arrivalType === "SEA"){
        // If sea then take locations for port
        mode = ["PORT"];
    }
    else if(arrivalType === "OTHER"){
        // If user has selected others then take hotel and other locations etc.
        mode = ["OTHER", "HOTEL", "LOCATION"];
    }
    else if(arrivalType === "RAIL"){
        // Take only rail
        mode = ["RAIL"];
    }
    return mode
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
                cachingLocArr.push(allPickupLocations[pLoc].location?.ref);
                cachingLocationMultipleArr.push(cachingLocArr)
                cachingLocArr = [];
            }
            else {
                // If not a multiple of 500 or at the start, push elements into cachingLocArr
                // Also, if it's the last element, push cachingLocArr into cachingLocationMultipleArr
                cachingLocArr.push(allPickupLocations[pLoc].location?.ref);
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
async function cachingPickupLocations(filePath, cachingLocationMultipleArr, productCode, clientId, providerDetails, action){
    try {
        let fullPath = path.join(process.cwd(), filePath);
        // Defined the file directory.
        let directory = path.dirname(fullPath);     
        //looping through mulidimentional array.
        let finalLocationArray = [];
        let count = 0;
        let loc = 0
        while(loc < cachingLocationMultipleArr.length){
            // Get data from viator api with individual array.
            let pickUpLocData = await apiResponse.getLocationDetailsFromMap(clientId, providerDetails, cachingLocationMultipleArr[loc]);

            // Checking response is valid.            
            if(pickUpLocData && pickUpLocData?.locations.length !=0){
                finalLocationArray.push(...pickUpLocData.locations);
                count = 0;                
            }
            else if (count != 1){
                loc = loc - 1;
                count = 1;
            }
            loc ++  
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
                        pickupPoint: data
                    }
                }
                // stringify data
                jsonData = JSON.stringify(finalData, null, 2);
            }
            else if(action == "RD"){
                jsonData = await readFileAndUpdateFunction(fullPath, productCode, data) 
            }
                        
            // Writing data to file.
            fs.writeFileSync(process.cwd() + filePath, jsonData, 'utf-8');
            console.log("Pickup locatios Saved successfully");
        }
        return null;
    }
    catch (error) {
        console.log(error);    
    }
}

// read data from json file.
async function readDataFromJsonFile(productCode, fullPath, filteredLocations){
    try {
        let pickUpLocData = [];

        let data = fs.readFileSync(fullPath, 'utf8');
        // parse data
        let jsonData = JSON.parse(data);
        // taking the particular product data.
        pickUpLocData = jsonData[productCode]?.pickupPoint?.locations ?? [];
        pickUpLocData = pickUpLocData.filter(location =>{
            return filteredLocations.some(element => location.reference === element.location.ref)
        })

        return pickUpLocData;
    }
    catch (error) {
        console.log(error);    
    }
}

async function funtionIfFileExist({fullPath, filePath, allPickupLocations, productCode, clientId, providerDetails, pickUpLocData, filteredLocations}){

    // read data from file.
    let data = fs.readFileSync(fullPath, 'utf8');
    if(!data){
        if(allPickupLocations){
            //final array generating for sending request.
            let cachingLocationMultipleArr = await generateFinalArrayForRequest(allPickupLocations)
            // Get locations from viator and store it in to file.
            await cachingPickupLocations(filePath, cachingLocationMultipleArr, productCode, clientId, providerDetails, "Wt")
            // Read data from file and send the data.
            pickUpLocData = await readDataFromJsonFile(productCode, fullPath, filteredLocations)
        }
    }
    else{
        // parse data
        let jsonData = JSON.parse(data);
        // checking the file have required product.
        if(jsonData.hasOwnProperty(productCode)){
        // take the corresponding product
        let desiredproductData = jsonData[productCode];
        // Check if the time is grater than 1 month if grater return true other wise false.
        let DateTimeChecking = await apiCommonController.checkTimeDifferenceFunction(desiredproductData.pickupPoint.timeStamp, 1, "M");

        if(DateTimeChecking){
            // If the time is grater than 1 month then add new data.
            //final array generating for sending request.
            let cachingLocationMultipleArr = await generateFinalArrayForRequest(allPickupLocations)
            // Get data from viator and store data to file.
            await cachingPickupLocations(filePath, cachingLocationMultipleArr, productCode, clientId, providerDetails, "RD");
            // Read data from file and send response.
            pickUpLocData = await readDataFromJsonFile(productCode, fullPath, filteredLocations)
        }
        else{
            // If the time is not grater than 1 month take existing data.
            pickUpLocData = desiredproductData?.pickupPoint?.locations.filter(location =>{
                return filteredLocations.some(element => location.reference == element.location.ref)
            })
        }                                                            
    }
    else{
        // If the file not found the product then take data from api and save it to file.
        //final array generating for sending request.
        let cachingLocationMultipleArr = await generateFinalArrayForRequest(allPickupLocations)
        // caching pickup locations to file.
        await cachingPickupLocations(filePath, cachingLocationMultipleArr, productCode, clientId, providerDetails, "RD")
        // read data from file and send response.
        pickUpLocData = await readDataFromJsonFile(productCode, fullPath, filteredLocations)
    }
    }
    
    return pickUpLocData
}

async function readFileAndUpdateFunction(fullPath, productCode, data){
    let jsonData;
    let fileData = fs.readFileSync(fullPath, 'utf8');
    // parse data
    let jsonFileData = JSON.parse(fileData);

    
    if(jsonFileData[productCode]){
        // write only the specifyied key values
        jsonFileData[productCode].pickupPoint = data
    }
    else{
        // replace all the data.
        jsonFileData[productCode] = {
            pickupPoint : data
        }
    }
    // if writing to existing file.
    
    
    jsonData = JSON.stringify(jsonFileData, null, 2);
    return jsonData
}