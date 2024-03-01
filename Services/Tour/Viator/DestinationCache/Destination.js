"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const fs = require('fs');
const path = require('path')
const config = require("../../../../Config.js");

module.exports = async (app) => {
    // Get all dstinations and store it to a json file.
    // Send request to viator api and send the response to client. 
    app.post("/:id/Tour/Viator/DestinationCache", async function (request, response, next) {
        // Validating request fields. 
        await apiCommonController.viatordestinationCaching(request, response, next);
    }, async function (request, response) {

        const clientId = request.params.id;
        let fName = "Destination_Caching_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DESTINATION_CACHING_PROVIDER_DESTINATION_CACHING_FILE_PATH, config.Provider_Code_VTR);
        try {
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }
            // Get destination details from viator and save it to json file.
            let result = await apiResponse.getDestinationCacheApiReponse(clientId, providerDetails, "v1/taxonomy/destinations", request);

            if(result != undefined && result?.success && result?.data?.length > 0){

                let filePath = config.viator_Destination_File_Path;
                let jsonData = JSON.stringify(result, null, 2);
                
                try{
                    // Extract the directory path
                    const fullPath = path.join(process.cwd(), filePath);
                    const directory = path.dirname(fullPath);

                    // Create the directory if it doesn't exist
                    if (!fs.existsSync(directory)) {
                        fs.mkdirSync(directory, { recursive: true });
                    }
                    // write data to file
                    fs.writeFileSync(process.cwd() + filePath, jsonData, 'utf-8');
                    response.status(200).send({
                        "Result": "Destinations Successfully Saved to file."
                    });

                }
                catch(error){
                    throw new Error(error);
                }
            }
            else if (!result.success && result?.data.length < 1) {
                response.status(200).send({
                    "Result": {
                        "Code": 500,
                        "Error": {
                            "Message": result.errorMessageText || result.errorMessage || result.message || "No Data Found."
                        }
                    }
                });
            }
            else {
                    response.status(200).send({
                        "Result": {
                            "Code": 400,
                            "Error": {
                                "Message": result.message || "Internal Server Error"
                            }
                        }
                    });
                }
        
        } catch (error) {
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
