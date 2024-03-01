"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");

const response = {
    // Send questions to moonstride
    saveBookingQuestionAndAnswersToMoonstride : async (clientId, bookingQuestionAnswers, msToken, providerDetails)=>{
        const fName = "SaveQuestion_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_SAVE_QUESTION_PROVIDER_SAVE_QUESTION_MOONSTRIDE_RESPONSE_FILE_PATH, config.Provider_Code_OWT);
        try {
            const response = await axios.post(
                providerDetails?.MoonstrideConfiguration?.savebookingquestionurl,
                bookingQuestionAnswers?.answerObject,
                {
                    headers: {
                        'token': msToken,
                    },
                }
            );
    
            const fileName = fName + "Success";
            createLogs(providerDetails.MoonstrideConfiguration.savebookingquestionurl, fileName, fPath, { bookingQuestionAnswers }, response.data);
    
            return response.data;
        }
        catch (error) {

            const errorData = error?.response?.data ?? error?.cause ?? { message: error?.message };
            apiCommonController.getError(errorData, fName, fPath, { bookingQuestionAnswers });

            return errorData; 
        }
    }
}

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

module.exports = response;