"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");

const response = {
    // Get all booking questions from viator
    getAllBookingQuestionApiReponse: async (clientId, providerDetails, url, request) => {
        let fName = "BookingQuestion_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_BOOKING_QUESTIONS_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_VTR);

        try {
            return new Promise((resolve) => {
                axios.get(`${providerDetails.Viator_url}${url}`, 
                    // Header Parameter
                {
                    headers: {
                        'exp-api-key': providerDetails.Viator_apiKey,
                        "Accept-Language": "en-US",
                        "Accept": "application/json;version=2.0"
                    }
                }).then((response) => {
                    // response send back to user.
                    let fileName = fName + "Success"
                    createLogs(`${providerDetails.Viator_url}${url}`, fileName, fPath, request, response.data)
                    resolve(response.data);
                }).catch((error) => {
                    if (error.hasOwnProperty('response')) {
                        console.log(error.response.data);
                        apiCommonController.getError(error.response.data, fName, fPath, request);
                        resolve(error.response.data);
                    } else {
                        console.log(error.cause);
                        apiCommonController.getError(error.cause, fName, fPath, request);
                        resolve(error.cause);
                    }
                });
            });
        } catch (err) {
            // handle error safely and add logs
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": err.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, request);
            return errorObj;
        }
    },

    // send questions to moonstride
    saveBookingQuestionAndAnswersToMoonstride : async (clientId, bookingQuestionAnswers, msToken, providerDetails)=>{

        const fName = "SaveQuestion_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_SAVE_QUESTION_PROVIDER_SAVE_QUESTION_MOONSTRIDE_RESPONSE_FILE_PATH, config.Provider_Code_VTR);
        try {
            return new Promise((resolve) => {
                const questionSave = axios.post(`${providerDetails.MoonstrideConfiguration.savebookingquestionurl}`,
                    bookingQuestionAnswers.questionAnswer, 
                    {
                        headers: {
                            'token' : msToken
                        }
                    }
                );
                
                const saveLanguageGuide = axios.post(`${providerDetails.MoonstrideConfiguration.savelanguageguideurl}`,
                    bookingQuestionAnswers.languageGuide, 
                    {
                        headers: {
                            'token' : msToken
                        }
                    }
                )

                axios.all([questionSave, saveLanguageGuide])
                // process the response of three api.
                .then(axios.spread((questionSave, saveLanguageGuide) => {
                    if(questionSave.data != undefined){
                        let responseData = {
                            "SavedQuestionResponse" : questionSave.data,
                            "SavedLanguageGuideResponse" : saveLanguageGuide.data
                        }
                        let fileName = fName + "Success"
                        createLogs(`${providerDetails.MoonstrideConfiguration.savelanguageguideurl}`, fileName, fPath, {body : bookingQuestionAnswers}, responseData)
                        resolve(responseData);
                    }
                    else{
                        throw new Error(questionSave.response.data || saveLanguageGuide.response.data || "Failed to save question or language guide.");
                    }
                }))
                .catch((error)=>{
                    console.log(error);
                    let err
                    if (error.response !=undefined) {
                        console.log(error.response.data);
                        err = error.response.data;
                    }
                    else {
                        console.log(error.cause);
                        err = error.cause ?? {message : "Api timeout."};
                    }
                    apiCommonController.getError(err, fName, fPath, {body : bookingQuestionAnswers});
                    resolve(err);
                });

            });
        }
        catch (error) {
            console.log(error);
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, {body : bookingQuestionAnswers});
            return errorObj;
        }
    }
}

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

module.exports = response;