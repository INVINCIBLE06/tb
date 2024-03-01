"use strict";
const config = require("../../../../Config.js")
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const fs = require('fs');
const path = require('path');

module.exports = async (app) => {
    // Get all dstinations and store it to a json file.
    // Send request to viator api and send the response to client. 
    app.post("/:id/Tour/Viator/BookingQuestion", async function (request, response, next) {
        // Validating request fields. 
        //await apiCommonController.viatordestinationCaching(request, response, next);
        next();
    }, async function (request, response) {

        const clientId = request.params.id;
        let fName = "BookingQuestionCache_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_BOOKING_QUESTIONS_PROVIDER_BOOKING_QUESTIONS_FILE_PATH, config.Provider_Code_VTR);
        try {
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }
            // Get destination details from viator and save it to json file.
            let result = await apiResponse.getBookingQuestionsCacheApiReponse(clientId, providerDetails, "products/booking-questions", request);
            // Cheking if it is result or error.
            if(result != undefined && result?.bookingQuestions && result?.bookingQuestions?.length > 0){
                // Adding current date and time.
                result.dateStamp = new Date();
                // Adding total count of questions.
                result.totalCount = result?.bookingQuestions?.length;
                // File path
                let filePath = config.viator_booking_questionCaching_location;
                // converting to string
                let jsonData = JSON.stringify(result, null, 2);

                try{                    
                    // Extract the directory path
                    const fullPath = path.join(process.cwd(), filePath);
                    const directory = path.dirname(fullPath);

                    // Create the directory if it doesn't exist
                    if (!fs.existsSync(process.cwd() + directory)) {
                        fs.mkdirSync(directory, { recursive: true });
                    }
                    // write data to file
                    fs.writeFileSync(process.cwd() + filePath, jsonData, 'utf-8');
                    // send back the response.
                    response.status(200).send({
                        "Result": "Questions Successfully Saved to file."
                    });                                                            
                }
                catch(error){
                    throw new Error(error);
                }
            }
            else if (!result.bookingQuestions && result?.bookingQuestions.length < 1) {
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
