"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const fs = require('fs');
const config = require("../../../../Config.js")
const axios = require("axios");

module.exports = async (app) => {
    // get predictive search or search suggestions base on entered value at least 3 characters
    app.post("/:id/Tour/Viator/SearchSuggestion", async function (request, response, next) {
        // validating request fields. 
        await apiCommonController.viatorDestinationSearchSuggestion(request, response, next);
    }, async function (request, response){
        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "Search_Suggestion_";
        let fPath = `/${clientId}/Service/VTR/Search_Suggestion`;
        try{

            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");

            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }

            let filePath = config.viator_Destination_File_Path;
            let DestinationArray;
            let searchString = requestObj.searchTerm;
            // read the json file .
            fs.readFile(process.cwd() + filePath, 'utf8', (err, data) => {
                if(err){
                    const errorObject = {
                        "STATUS": "ERROR",
                        "RESPONSE": {
                            "text": err.message
                        }
                    };
                    // Handle error and send appropriate response here
                    response.status(500).send(errorObject);
                    return;
                }
                try{
                    let jsonData = JSON.parse(data);
                    DestinationArray = jsonData.data;
                    // checking the search string is present in the destination array and starts with the search string.
                    let filteredArray = DestinationArray.filter(obj => obj.destinationName.toLowerCase().startsWith(searchString.toLowerCase()));
                    let dataArray = [];
                    if(filteredArray != undefined && filteredArray.length >= 1){
                        let filterArrayData = filteredArrayLoop(filteredArray, DestinationArray)
        
                        dataArray = filterArrayData
                        
                        // add the values to object.
                        filteredArray = filteredArray.map((obj, index) =>(
                            {label : dataArray[index], value : obj.destinationId}
                        ))
                        response.status(200).send({
                            "Result": {
                                "provider" : config.Provider_Code_VTR,
                                "Code" : 200,
                                filteredArray
                            }
                        });
                    }
                    else{
                        response.status(200).send({
                            "Result": {
                                "Code": 400,
                                "Error": {
                                    "Message": "No Matching Data Found."
                                }
                            }
                        });
                    }
                }
                catch(error){
                    const errorObject = {
                        "STATUS": "ERROR",
                        "RESPONSE": {
                            "text": error.message
                        }
                    };
                    // Handle JSON parsing error and send appropriate response here
                    response.status(500).send(errorObject);
                    return;
                }                
                
            });            
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
        }
    })
}

// Function for filtered array loop
function filteredArrayLoop(filteredArray, DestinationArray){

    let returnData = []

    for (let filteredItem of filteredArray) {
        let parentDestinationName = [];
        // checking the lookup id for get parent destinations.
        let lookupId = filteredItem.lookupId.split('.');

        if (lookupId.length > 1) {
            // avaoid the first id
            lookupId = lookupId.slice(1);

            // looping through the lookup id array
            for (let id of lookupId) {
                // all destination list checking.
                for (let destination of DestinationArray) {
                    // checking if the lookup id and destination id match.
                    if (destination.destinationId == id) {
                        // adding the parent destination names to an array.
                        parentDestinationName.push(destination.destinationName);
                    }
                }
            }
        }
        parentDestinationName.reverse()
        // revese the array and convert to string and add a space after a coma.
        parentDestinationName = parentDestinationName.join(", ").toString()        
        returnData.push(parentDestinationName);
    }
    return returnData
}

