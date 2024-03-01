"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const fs = require('fs');
const config = require("../../../../Config.js");

const breadCrumObject = {
    getBreadCrums : async(clientId, destinationId, request)=>{
        let fName = "BreadCrums_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_BREAD_CRUMS_PROVIDER_BREAD_CRUMS_FILE_PATH, config.Provider_Code_VTR);
        try{
            // File path were viator locations are saved.
            let filePath = config.viator_Destination_File_Path;
            // Read data from file.
            let data = await fs.promises.readFile(process.cwd() + filePath, 'utf8');
            // Parse into json data. 
            let jsonData = JSON.parse(data);
            // Adding into an variable.
            let destinationArr = jsonData.data;
            // Find current location from the data using destination id.
            let searchedDestination = destinationArr.find(obj => obj.destinationId == destinationId);
            // If no destination is found then return a Home response.
            if (!searchedDestination) {
                return [{ "label": "Home", "value": "Home" }];
            }
            // Initial value always Home.
            let breadCrumbsResponseArr = [
                { "label": "Home", "value": "Home" },
            ];

            let currentDestinationId = searchedDestination;
            // Taking the lookup id and make it as array using split method and remove the first element from it using slice method.
            let lookupIdArr = currentDestinationId.lookupId.split('.').slice(1);
            // Loop through the lookpu id and find the parent destinations.
            for (let destId of lookupIdArr) {
                // Find the parent destination using destination id.
                let parentDestination = destinationArr.find(dest => dest.destinationId == destId);
                
                if (parentDestination) {
                    breadCrumbsResponseArr.push({
                        "label": `Things to do in ${parentDestination.destinationName}`,
                        "value": parentDestination.destinationId
                    });
                }
            }                

            breadCrumbsResponseArr.push({
                "label": `${currentDestinationId.destinationName} Tours`,
                "value": currentDestinationId.destinationId
            });

            return breadCrumbsResponseArr;
            
        }
        catch(error){
            // Handle error safely and add logs
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, errorObj);
            return errorObj;
        }
    }
}

module.exports = breadCrumObject;