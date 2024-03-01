"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const config = require("../../../../Config.js");
const path = require('path');
const fs = require("fs");


module.exports = async (app) => {
    // get predictive search or search suggestions base on entered value at least 3 characters
    app.post("/:id/Tour/Viator/SaveBookingQuestions", async function (request, response, next) {
        // validating request fields. 
        await apiCommonController.viatorSaveBookingQuestionsValidator(request, response, next);
    }, async function (request, response){
        const requestObj = request.body;
        const clientId = request.params.id;
        const fName = "SaveQuestion_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_SAVE_QUESTION_PROVIDER_SAVE_QUESTION_FILE_PATH, config.Provider_Code_VTR);
        try{
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }

            if(requestObj.bookingQuestionAnswers){
                let bookingQuestionAnswers = requestObj.bookingQuestionAnswers;
                let selectedPassengers = requestObj.passengers;
                let numberOfTravelers = requestObj.numberofpassengers;
                let msToken = requestObj.msToken;
                let bookingId = requestObj.bookingComponentId;
                let bookingQuestionAnswersObj = await bookingQuestionsFormatChecker(providerDetails, clientId, request, bookingQuestionAnswers, selectedPassengers, numberOfTravelers);

                if(bookingQuestionAnswersObj !== true){                    

                    response.status(200).send({
                        "Result": {
                            "Code": 400,
                            "Error": {
                                "Message": bookingQuestionAnswersObj
                            }
                        }
                    });
                }
                else{
                    
                    let SavedQuestionsFormat = await BookingQuestionsFormatter(requestObj, bookingQuestionAnswers, bookingId)
                    let responseData = await apiResponse.saveBookingQuestionAndAnswersToMoonstride(clientId, SavedQuestionsFormat, msToken, providerDetails);

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
                    else if(responseData.STATUS){
                        throw new Error(responseData?.RESPONSE?.text ?? "Internal server error.");
                    }
                    else{
                        response.status(200).send({
                            "Result": responseData
                        });
                    }                                            
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

// booking question object formnatter
async function BookingQuestionsFormatter(requestObj, bookingQuestionAnswers, bookingId){
    let answerObject = {
        "BookingComponentId" : bookingId,
        "QuestionAnswer" : bookingQuestionAnswers,        
        "communication" : {},
        "bookerInfo" : {}
    }
    let languageGuideObj = {
        "BookingComponentId" : bookingId,
        "LanguageGuide" : {}

    }
    if(requestObj.languageGuide){
        languageGuideObj.LanguageGuide = requestObj.languageGuide;
    }
    if(requestObj.bookerInfo){
        answerObject.bookerInfo = requestObj.bookerInfo;
    }
    if(requestObj.communication){
        answerObject.communication = requestObj.communication;
    }
    return (
        {
            "questionAnswer" : answerObject,
            "languageGuide" : languageGuideObj,
        }
    );
}

// booking question format checker
async function bookingQuestionsFormatChecker(providerDetails, clientId, request, bookingQuestionAnswers, selectedPassengers, numberOfTravelers){
    try {
        if(bookingQuestionAnswers.legth != 0 && selectedPassengers.legth != 0){
            // get all booking question sfrom viator.
            //let supplierBookingQuestions = await apiResponse.getAllBookingQuestionApiReponse(clientId, providerDetails, `products/booking-questions`, request);
            let supplierBookingQuestions = await getBookingQuestions(clientId, providerDetails, request)

            supplierBookingQuestions = supplierBookingQuestions.bookingQuestions || [];

            if(supplierBookingQuestions.legth == 0){
                throw new Error("Internal Server Error");
            }

            // filter out per traveler group questions from viator response.
            let PER_TRAVELER_questions = supplierBookingQuestions.filter(item => item.group === "PER_TRAVELER" );

            // filter out per booking questions from viator response.
            let PER_BOOKING_questions = supplierBookingQuestions.filter(item => item.group === "PER_BOOKING");
            // check for per traveler questions
            let checkPerTravelerQuestions = await checkPerTravelerQuestionsFunction(PER_TRAVELER_questions, bookingQuestionAnswers, selectedPassengers, numberOfTravelers);

            // check for per group questions.
            let checkPerBookingQuestions = await checkPerBookingQuestionsFunction(PER_BOOKING_questions, bookingQuestionAnswers, selectedPassengers, numberOfTravelers);

            let isValidQuestionForPerTraveler = await checkPerTravelerQuestions.some((element) => typeof element === "object"); 

            let isValidQuestionForPerBooking = await checkPerBookingQuestions.some((element) => typeof element === "object"); 

            if(isValidQuestionForPerTraveler && isValidQuestionForPerBooking){
                return true;
            }                     
            else{
                let errorText = combineAllErrorIntoOneStringFunction(checkPerTravelerQuestions, isValidQuestionForPerTraveler, checkPerBookingQuestions, isValidQuestionForPerBooking);                            
                return errorText;
            }            
        }
    }
    catch (error) {
        console.log(error);
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error.message
            }
        }
        return errorObject;
    }
}

// per traveler boking questions function 
async function checkPerTravelerQuestionsFunction(PER_TRAVELER_questions, bookingQuestionAnswers, selectedPassengers, numberOfTravelers){
    try {


        // Filter arr1 based on arr2's question field
        const filteredQuestions = PER_TRAVELER_questions.filter((questionObj1) => {
            return bookingQuestionAnswers.some((questionObj2) => questionObj2.question === questionObj1.id);
        });

        let errorData = [];
        for(let item of filteredQuestions){

            const correspondingQuestion = bookingQuestionAnswers.find((questionObj2) => questionObj2.question === item.id);

            if(correspondingQuestion){

                const answer = correspondingQuestion.answer;
                const type = item.type;
                let questionType = await setTravellerQuestionTypeValidation(errorData, type, answer, correspondingQuestion, item)
                errorData = questionType
                
            }
        }

        if(errorData.length !=0){
            return errorData;
        }
        else{
            return bookingQuestionAnswers;
        }        

    }
    catch (error) {
        console.log(error);    
    }
}

// per booking questions validation function
async function checkPerBookingQuestionsFunction(PER_BOOKING_questions, bookingQuestionAnswers, selectedPassengers, numberOfTravelers){
    try {

        // Filter arr1 based on arr2's question field
        const filteredQuestions = PER_BOOKING_questions.filter((questionObj1) => {
            return bookingQuestionAnswers.some((questionObj2) => questionObj2.question === questionObj1.id);
        });

        let errorData = [];
        for(let item of filteredQuestions){

            const correspondingQuestion = bookingQuestionAnswers.find((questionObj2) => questionObj2.question === item.id);

            if(correspondingQuestion){
                
                const answer = correspondingQuestion.answer;
                const type = item.type;
                let questionType = await setBookingQuestionTypeValidation(errorData, type, answer, correspondingQuestion, item)
                errorData = questionType
            }
            
        }
        if(errorData.length !=0){
            return errorData;
        }
        else{
            return bookingQuestionAnswers;
        }  

    }
    catch (error) {
        console.log(error);    
    }
}

// Function for validate date type
function validateTypeDateFunction(answer, correspondingQuestion){
    let errorMessage = true
    const regEx = /^\d{4}-\d{2}-\d{2}$/;
    if(!regEx.test(answer)){
        errorMessage = `Invalid answer for question : ${correspondingQuestion.question} & the format should be 'YYYY-MM-DD' `;
    }
    return errorMessage;
}

// Function for validate time type
function validateTypeTimeFunction(answer, correspondingQuestion){
    let errorMessage = true;

    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if(!regex.test(answer) || answer == "00:00"){
        errorMessage = `Invalid answer for question : ${correspondingQuestion.question} & the format should be Like '10:10' and should not be '00:00' `;
    }    
    return errorMessage;
}

// Function for validate number, unit, locRef and free text
function validateNumberAndUnitANDLocRefAndFreeTextFunction(answer, correspondingQuestion, unit){
    let availableUnits = unit.units;
    let answerdUnit = correspondingQuestion.unit;
    let errorMessage = true;
    if( (!availableUnits.includes(answerdUnit) && !isNaN(answer)) || (!availableUnits.includes(answerdUnit) && isNaN(answer))){
        errorMessage = `Invalid answer for question : ${correspondingQuestion.question} & the allowed units are ${availableUnits} `;
    }
    return errorMessage;    

}

// Function for validate type string
function validateStringTypeFunction(answer, correspondingQuestion, item){
    let errorMessage = true
    if(typeof answer !== "string"){
        errorMessage = `Invalid answer for question : ${correspondingQuestion.question}`;
    }
    if(answer.length > item.maxLength){
        errorMessage = `The ${correspondingQuestion.question}'s answer length should not be exceed more than ${item.maxLength} letters`;
    }
    return errorMessage;
}

// Function for combain all error in to one single string
function combineAllErrorIntoOneStringFunction(checkPerTravelerQuestions, isValidQuestionForPerTraveler, checkPerBookingQuestions, isValidQuestionForPerBooking){
    let errorText = '';
    let errorArr = []
    if(!isValidQuestionForPerTraveler){
        errorArr.push(...checkPerTravelerQuestions);
    }
    if(!isValidQuestionForPerBooking){
        errorArr.push(...checkPerBookingQuestions);
    }
    errorText = errorArr.join(' /n ');
    return errorText;
}

// Function for validate traveller question type 
function setTravellerQuestionTypeValidation(errorData, type, answer, correspondingQuestion, item){
    let data;
    switch(type){
        case "DATE":
            data = validateTypeDateFunction(answer, correspondingQuestion);
            if(data !== true){
                errorData.push(data)
            }
            break;
        case "NUMBER_AND_UNIT":
            data = validateNumberAndUnitANDLocRefAndFreeTextFunction(answer, correspondingQuestion, item);
            if(data !== true){
                errorData.push(data)
            }
            break;                    
        case "STRING":

            data = validateStringTypeFunction(answer, correspondingQuestion, item);
            if(data !== true){
                errorData.push(data)
            }
            break;                    
        default:
            break;
    }
    return errorData
}

// Function for validate booking question type 
function setBookingQuestionTypeValidation(errorData, type, answer, correspondingQuestion, item){
    let data;
    switch(type){
        case "LOCATION_REF_OR_FREE_TEXT":
            data = validateNumberAndUnitANDLocRefAndFreeTextFunction(answer, correspondingQuestion, item);
            if(data !== true){
                errorData.push(data)
            }
            break;
        case "STRING":
            data = validateStringTypeFunction(answer, correspondingQuestion, item);
            if(data !== true){
                errorData.push(data)
            }
            break;
        case "TIME":
            data = validateTypeTimeFunction(answer, correspondingQuestion);
            if(data !== true){
                errorData.push(data)
            }
            break;
        case "DATE":
            data = validateTypeDateFunction(answer, correspondingQuestion);
            if(data !== true){
                errorData.push(data)
            }
            break;
        default:
            break;
    }
    return errorData
}

async function getBookingQuestions(clientId, providerDetails, request){
    try {
        let filePath = config.viator_booking_questionCaching_location
        // Set an empty array for storing locations ref.
        let bookingQuestions = [];
       
        // Defined the file path.
        const fullPath = path.join(process.cwd(), filePath); 
        // Defined the file directory.
        let directory = path.dirname(fullPath);             
        // Checking the file is exist or not
        if(fs.existsSync(fullPath)){
            // read data from file.
            
            let data = fs.readFileSync(fullPath, 'utf8');
           
            if(!data){
               
                // If the file not found the product then take data from api and save it to file.
                bookingQuestions = await cacheBookingQuestionsAndRead(clientId, providerDetails, request,filePath)

            }
            else{
                bookingQuestions = await functionIfFileData(bookingQuestions, data, clientId, providerDetails, request,filePath);                                
            }            
        }
        else {
            
            if (!fs.existsSync(directory)) {
                // Create a folder
                fs.mkdirSync(directory, { recursive: true });
            }
            bookingQuestions = await cacheBookingQuestionsAndRead(clientId, providerDetails, request, filePath);            
        }
        
        return (bookingQuestions);                                       
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
// function to raad data and check time difference.
async function functionIfFileData(bookingQuestions, data, clientId, providerDetails, request, filePath){
    // parse data
    let jsonData = JSON.parse(data);
    if(Object.keys(jsonData).length == 0){
        bookingQuestions = await cacheBookingQuestionsAndRead(clientId, providerDetails, request, filePath);
    }else{
        let DateTimeChecking = await apiCommonController.checkTimeDifferenceFunction(jsonData.dateStamp, 1, "M");
     
        if(DateTimeChecking){                                          
            bookingQuestions = await cacheBookingQuestionsAndRead(clientId, providerDetails, request, filePath);                                                                              
        }
        else{                          
            bookingQuestions = jsonData  
        }
    }
    return bookingQuestions
}

async function cacheBookingQuestionsAndRead(clientId, providerDetails, request, filePath){

    const fullPath = path.join(process.cwd(), filePath); 
    // get data from api
    let result = await apiResponse.getAllBookingQuestionApiReponse(clientId, providerDetails, "products/booking-questions", request);

    if(result != undefined && result?.bookingQuestions && result?.bookingQuestions?.length > 0){
        // Adding current date and time.
        result.dateStamp = new Date();
        // Adding total count of questions.
        result.totalCount = result?.bookingQuestions?.length;
        // converting to string
        let jsonData = JSON.stringify(result, null, 2);

        // write data to file
        fs.writeFileSync(process.cwd() + filePath, jsonData, 'utf-8');
        console.log("Booking questions Saved successfully");
    }

    let data = fs.readFileSync(fullPath, 'utf8');
    let jsonData = JSON.parse(data);

    return jsonData

}