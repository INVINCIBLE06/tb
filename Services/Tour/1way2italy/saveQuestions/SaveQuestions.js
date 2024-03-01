"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const config = require("../../../../Config.js");
// Main function for export
module.exports = async (app) => {
    // Get predictive search or search suggestions base on entered value at least 3 characters
    app.post("/:id/Tour/1way2italy/SaveBookingQuestions", async function (request, response, next) {
        // Validating request fields. 
        await apiCommonController.viatorSaveBookingQuestionsValidator(request, response, next);
    }, async function (request, response){
        const requestObj = request.body;
        const clientId = request.params.id;
        const fName = "SaveQuestion_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_SAVE_QUESTION_PROVIDER_SAVE_QUESTION_FILE_PATH, config.Provider_Code_OWT);
        try{
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "OneWay2Italy");
            if (!providerDetails.Requestor_ID && !providerDetails.Password) {
                throw new Error("User has not Subscribed / Activated OneWay2Italy Tour Service or Something went wrong.");
            };

            if(requestObj.bookingQuestionAnswers){
                let bookingQuestionAnswers = requestObj.bookingQuestionAnswers;
                let bookingId = requestObj.bookingComponentId;
                    
                let SavedQuestionsFormat = await BookingQuestionsFormatter(requestObj, bookingQuestionAnswers, bookingId)
                let responseData = await apiResponse.saveBookingQuestionAndAnswersToMoonstride(requestObj.clientId, SavedQuestionsFormat, requestObj.msToken, providerDetails);

                if(responseData.APIError){
                    response.status(200).send({
                        "Result": {
                            "Code": 400,
                            "Error": {
                                "Message": responseData.APIError
                            }
                        }
                    });
                }
                else{
                    response.status(200).send({
                        "Result": responseData
                    });
                }                   
            }            
        }
        catch (error) {
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
    })
}

// Booking question object formnatter also checking value of each answers 
async function BookingQuestionsFormatter(requestObj, bookingQuestionAnswers, bookingId, providerDetails){
    if(bookingQuestionAnswers.length > 0 ){
        let response = bookingQuestionAnswers.map((item)=>{
            if(item.answer == ""){
                return item.question
            }
        }).filter(item => item !== undefined)
        if(response.length > 0){
            let errorMessage = response.join(' \n ')
            let responseData = {
                "status" : false,
                "Result": {
                    "Code": 400,
                    "Error": {
                        "Message": `Invalid answer for question : ${errorMessage}, please provide valid answer`
                    }
                }
            }
            return responseData
        }
    } else {
        let responseData = {
            "status" : false,
            "Result": {
                "Code": 400,
                "Error": {
                    "Message": "Please provide required booking questions."
                }
            }
        }
        return responseData
    }

    let answerObject = {
        "BookingComponentId" : bookingId,
        "QuestionAnswer" : bookingQuestionAnswers,
        "languageGuide" : {},
        "communication" : {},
        "bookerInfo" : {}
    }
    if(requestObj.languageGuide){
        answerObject.languageGuide = requestObj.languageGuide;
    }
    if(requestObj.bookerInfo){
        answerObject.bookerInfo = requestObj.bookerInfo;
    }
    if(requestObj.communication){
        answerObject.communication = requestObj.communication;
    }
    let responseData = {
        "status" : true,
        "answerObject" : answerObject
    }
    return responseData;
}