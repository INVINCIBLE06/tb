"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const config = require("../../../../Config.js");
const fs = require("fs");
const path = require("path");


module.exports = async (app) => {
   app.post('/:id/Tour/Viator/Attractions', async function(request, response, next){
        // Validating request fields
        await apiCommonController.viatorProductAttractions(request, response, next);
   }, async function(request, response){
        // Request fields
        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "Attraction_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_ATTRACTIONS_PROVIDER_ATTRACTIONS_FILE_PATH, config.Provider_Code_VTR);
        
        try{
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            };
            // Defined the Attractions checking url
            let attractionsReq = {
                "attractionsCheckurl" : 'v1/taxonomy/attractions'
            };

            // get file path from config.
            const filePath = config.viator_attraction_caching_location;
            // destination id;
            const destinationId = requestObj.destId;

            const fullPath = path.join(process.cwd(), filePath);
            const directory = path.dirname(fullPath);           

            let attractionsData = {};
            // Check if the folder is exist or not, if not create new folder. 
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }
            // Check if the file is exist or not.
            
            if (fs.existsSync(fullPath)) {
                
                // Read data from file.
                let parameters = {
                    filePath, 
                    attractionsData, 
                    destinationId, 
                    clientId, 
                    providerDetails, 
                    attractionsReq, 
                    requestObj, 
                    request
                }
                attractionsData = await functionIfFileExist(parameters)
                
            }
            else{

                // If the file is not exist then it is the first execution.
                // Get response from viator api
                let result = await apiResponse.getAttractionsList(clientId, providerDetails, attractionsReq, requestObj, request);

                if(result && Array.isArray(result?.data)){     
                    // Save Data
                    await saveDataToFile(result.data, filePath, "Wt", destinationId);
                    // send response.
                    attractionsData = result.data;                    
                }
            
            }

            if(attractionsData && attractionsData?.length !=0){                
                // Formatting the result and sending necessary data
                let result = await resultObject_formatter(attractionsData, fName, fPath, request, response);
                
                response.status(200).send({
                    "Result": result
                });  
                
            }
            else{
                response.status(200).send({
                    "Result": {
                        "Code": 500,
                        "Error": {
                            "Message": "Attractions not found or Internal Server Error."
                        }
                    }
                });
            };            
        }
        catch(error){
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
};

//  Function for result object formatter
async function resultObject_formatter(result, fName, fPath, request, response){
    try{        
        let finalAttractionsList = [];
        if(result?.length !=0){
            for(let i=0; i< result?.length ; i++){
                finalAttractionsList =  await setFinalData(i, finalAttractionsList, result)
            };                        
        };
        
        return(finalAttractionsList);
    }catch(error){        
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error.message
            }
        }
        apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
        response.send(errorObject);
    };
}

// Save data to file 
async function saveDataToFile(result, filePath, action, destinationId){
    try {        
        
        let jsonData;
        let resForamat;
        // Cheking if it is first time addding or file is alredy exist
        if(action == "Wt"){
            let data = {
                attractions : result,
                timeStamp : new Date(),
                totalCount : result.length  
            }
            // adding new data.
            resForamat = {
                [destinationId] : data
            }
        }
        else if(action == "RD"){
            // Creating data for saving.
            let jsonData = fs.readFileSync(process.cwd() + filePath, 'utf8');
            let attractions = JSON.parse(jsonData);

            let data = {
                attractions : result,
                timeStamp : new Date(),
                totalCount : result?.length  
            }
            // taking the existing object for saving;
            attractions[destinationId] = data 

            resForamat = attractions     
        }
        // stringify data 
        jsonData = JSON.stringify(resForamat, null, 2);
        // write data to file.
        fs.writeFileSync(process.cwd() + filePath, jsonData, 'utf-8');
        return null;        
    }
    catch (error) {
        console.log(error);
    }
}

async function setFinalData(i, finalAttractionsList, result){
    let finalData = {};
    finalData.title = result[i]?.title || "" ;
    finalData.primaryDestinationName = result[i]?.primaryDestinationName || "";
    finalData.imageUrl = result[i]?.thumbnailHiResURL || "";
    finalData.attractionState = result[i]?.attractionState || "" ;
    finalData.attractionCity = result[i]?.attractionCity || "" ;
    finalData.address = result[i]?.attractionStreetAddress || "" ;
    finalData.attractionStreetAddress = result[i]?.attractionStreetAddress || "" ;                
    finalData.destinationId = result[i]?.destinationId || "" ;
    finalData.seoId = result[i]?.seoId || "";
    finalData.thumbnailHiResURL = result[i]?.thumbnailHiResURL || "";                
    finalData.attractionLatitude = result[i]?.attractionLatitude || "" ;
    finalData.attractionLongitude = result[i]?.attractionLongitude || "";
    finalData.rating = result[i]?.rating ;                
    finalAttractionsList.push(finalData);
    return finalAttractionsList
}

// function to get attraction id there is an attraction file exist
async function functionIfFileExist({filePath, attractionsData,destinationId,clientId, providerDetails, attractionsReq, requestObj, request}){
    
    let jsonData = fs.readFileSync(process.cwd() + filePath, 'utf8');
    let attractions = JSON.parse(jsonData);
        
    // checking if the destination id is present or not.
    if(attractions.hasOwnProperty(destinationId)){
        //Destination id allredy exist
        // Check if the time is grater than 1 month if grater return true other wise false.
        let DateTimeChecking = await apiCommonController.checkTimeDifferenceFunction(attractions[destinationId].timeStamp, 1, "W");
        
        if(!DateTimeChecking){
            //Take the data from file.
            attractionsData = attractions[destinationId].attractions
            
        }
        else{

            // checking  timeSamp that is true so taking data on the vitor attraction
            let attractionsResult = await apiResponse.getAttractionsList(clientId, providerDetails, attractionsReq, requestObj, request);

            // Cheking the response is correct data.
            if(Array.isArray(attractionsResult?.data)){
                // Save data to file.
                await saveDataToFile(attractionsResult.data, filePath, "RD", destinationId);
                // Send the data.
                attractionsData = attractionsResult.data;                            
            }
        }

    }
    else{
        //New destination id is coming
        let attractionsResult = await apiResponse.getAttractionsList(clientId, providerDetails, attractionsReq, requestObj, request);
        
        if(Array.isArray(attractionsResult.data)){
            // Save data to file
            await saveDataToFile(attractionsResult.data, filePath, "RD", destinationId);
            // Send response
            attractionsData = attractionsResult.data;                        
        }
    }
    return attractionsData
}