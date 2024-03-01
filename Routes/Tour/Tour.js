// ====================================================================================================== //
/*
                                        Tour.js
                                    ---------------
                Tour.js file controlls all the initial request and response.                
*/
// ====================================================================================================== //

"use strict";
const axios = require("axios");
const config = require("../../Config.js");
const apiCommonController = require("../../Utility/APICommonController.js");
const fetchViatorLocations = require("../../Services/Tour/Viator/fetchLocationsDetails/Location.js");

module.exports = async (app) => {

    // Create access token and extract provider details etc.
    app.post("/Tour/getAccessToken", async(request, response, next)=>
    {
        // Validate the request 
        if(request.body.domainurl != undefined)
        {
            await apiCommonController.viatorAccessTokenValidation(request, response, next);
        }        
        else if(request.body.token != undefined)
        {
            request.params.token = request.body.token;
            await apiCommonController.validateOauthToken(app, request, response, next);
        }        
    }, 
    async(request, response) =>
    {
        let fPath = `${request.body.clientId}/Routes/msAccessToken`;
        let fName = "msAccessToken_";
        try
        {
            const requestObj = request.body;
            // Creating api access token and moonstride token.
            if(requestObj.domainurl != undefined)
            {
                // Get api access token.
                let TokenResponse = await apiCommonController.getApiAccessToken(request, response, requestObj.domainurl);

                if(TokenResponse)
                {
                    // Creating moonstride access token.
                    let msAccessTokenResponse = await apiCommonController.getMsAccessToken(request, response, TokenResponse.clientId, false, "");
                    TokenResponse.msAccessToken = msAccessTokenResponse;
                    // Setting the token is valid.
                    TokenResponse.isValid = true;
                    TokenResponse.providers = TokenResponse.availableProviders.providers;
                    TokenResponse.screenConfiguration = TokenResponse.availableProviders.screenConfig;
                    // Send back the response.
                    fPath = `${TokenResponse.clientId}/Routes/msAccessToken`;
                    let fileName = fName + "Success"
                    createLogs("/Tour/getAccessToken", fileName, fPath, request, TokenResponse)
                    response.send(TokenResponse);
                }                                                                                  
            }
            else if(requestObj.token && requestObj.clientId){
                const clientId = requestObj.clientId;
                // Creating only moonstride access token.
                let providerData = await apiCommonController.findProviderDetails(request, response, clientId);
                if(providerData){
                    
                    let msAccessToken = {};
                    // Token for mooncognito services.
                    let msAccessTokenResponse = await apiCommonController.getMsAccessToken(request, response, clientId, false, "");
                    msAccessToken = msAccessTokenResponse;                                     
                    let responseData = {
                        "isValid" : true,
                        "providers" : providerData?.providers,
                        "screenConfiguration" : providerData?.screenConfig ?? {},
                        "msAccessToken" : msAccessToken 
                    }
                    let fileName = fName + "Success"
                    createLogs("/Tour/getAccessToken", fileName, fPath, request, responseData)
                    response.send(responseData);
                }
            }            
        }
        catch (error) {

            // Handle error safely and add logs
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };
            apiCommonController.getError(error, fName, fPath, request);
            response.status(400).send(errMessage);
        } 
    })

    // Search destination with destination id.
    app.post("/:token/Tour/Search", async (request, response, next) => 
    {
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, 
    async (request, response) => 
    {
        // Get ClientId from request body
        const requestObj = request.body;
        const clientId = requestObj.clientId;
        let fPath = `/${clientId}/Routes/`;
        let fName = "Search";
        try 
        {
            // Array of providers
            const providerCodes = requestObj.provider;
            const combinedAllRequests = [];
            let URL = ""
            // Provider validation
            for (const providerCode of providerCodes) 
            {
                switch (providerCode.toUpperCase()) 
                {
                    case config.Provider_Code_VTR:
                        fPath += `${config.Provider_Code_VTR}/Search`
                        // URL configuration for API call
                        URL = apiCommonController.urlHTTP(`${config.Tour_Viator_Search_EndPoint}/${clientId}/Tour/Viator/Search`);
                        let requetVTR = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });

                        combinedAllRequests.push(requetVTR);
                        console.log(`requestObj`, combinedAllRequests);

                        break;
                    
                    case config.Provider_Code_OWT:
                        fPath += `${config.Provider_Code_OWT}/Search`
                        // URL configuration for API call
                        URL = apiCommonController.urlHTTP(
                            `${config.Tour_1way2italy_Search_EndPoint}/${clientId}/Tour/1way2italy/Search`
                        );
                        let requestOWT = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requestOWT);
                        break;

                    default:
                        break;
                }
            }
            // Send request to services file for processing 
            const result = await Promise.all(combinedAllRequests);

            let finalResponse = [];
            result.forEach(res => {
                if (JSON.stringify(res.data).indexOf("ERROR") === -1) {
                    finalResponse.push(res.data);
                }
                else{                    
                    throw new Error(res?.data?.Result?.RESPONSE?.text ?? res.data?.RESPONSE?.text);
                }
            });
            if (finalResponse.length === 0){
                finalResponse = { message: "No data found." };
            }
            createLogs("/Tour/Search", fName, fPath, request, finalResponse)
            response.send(finalResponse);
        } catch (error) {
            // Handle error safely and add logs
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };
            apiCommonController.getError(error, fName, fPath, request);
            response.status(400).send(errMessage);
        }
    });
    
    // Get product destials, and other details.
    app.post("/:token/Tour/ProductDetails", async (request, response, next) => {
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response) => {
        // Get ClientId from request body
        const requestObj = request.body;
        const clientId = requestObj.clientId;
        let fPath = `/${clientId}/Routes/`;
        let fName = "Details";
        let URL = "";
        try {
            // Array of providers
            const providerCodes = requestObj.provider;
            const combinedAllRequests = [];

            // Provider validation
            for (const providerCode of providerCodes) {
                switch (providerCode.toUpperCase()) {
                    case config.Provider_Code_VTR:
                        fPath += `${config.Provider_Code_VTR}/Details`
                        // URL configuration for API call
                        URL = apiCommonController.urlHTTP(
                            `${config.Tour_Viator_Product_Details_EndPoint}/${clientId}/Tour/Viator/ProductDetails`
                        );
                        let requetVTR = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requetVTR);
                        break;

                    case config.Provider_Code_OWT:
                        fPath += `${config.Provider_Code_OWT}/Details`
                        // URL configuration for API call
                        URL = apiCommonController.urlHTTP(
                            `${config.Tour_1way2italy_Product_Details_EndPoint}/${clientId}/Tour/1way2italy/ProductDetails`
                        );
                        let requestOWT = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requestOWT);
                        break;

                    default:
                        break;
                }
            }
            // Send request to services file for processing 
            const result = await Promise.all(combinedAllRequests);
            let finalResponse = [];
            result.forEach(res => {
                if (JSON.stringify(res.data).indexOf("ERROR") === -1) {
                    finalResponse.push(res.data);
                }
                else{
                    finalResponse.push(res.data)
                }
            });
            if (finalResponse.length === 0) {
                finalResponse = { message: "No data found." };
            }
            createLogs("/Tour/ProductDetails", fName, fPath, request, finalResponse)
            response.send(finalResponse);
        } catch (error) {
            console.log(error);
            // Handle error safely and add logs
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };
            apiCommonController.getError(error, fName, fPath, request);
            response.status(400).send(errMessage);
        }
    });

    // Get product availability details.
    app.post("/:token/Tour/ProductAvailability", async (request, response, next) => {
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response) => {
        // Get ClientId from request body
        const requestObj = request.body;
        const clientId = requestObj.clientId;
        let fPath = `/${clientId}/Routes/`;
        let fName = "Availability";
        try {
            // Array of providers
            const providerCodes = requestObj.provider;
            const combinedAllRequests = [];
            let URL = "";
            // Provider validation
            for (const providerCode of providerCodes) {
                switch (providerCode.toUpperCase()) {
                    case config.Provider_Code_VTR:
                        fPath += `${config.Provider_Code_VTR}/Availability`
                        // URL configuration for API call
                        URL = apiCommonController.urlHTTP(
                            `${config.Tour_Viator_Product_Availability_EndPoint}/${clientId}/Tour/Viator/ProductAvailability`
                        );
                        let requetVTR = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requetVTR);
                        break;

                    case config.Provider_Code_OWT:
                        fPath += `${config.Provider_Code_OWT}/Availability`
                            // URL configuration for API call
                            URL = apiCommonController.urlHTTP(
                                `${config.Tour_1way2italy_Product_Availability_EndPoint}/${clientId}/Tour/1way2italy/ProductAvailability`
                            );
                            let requestOWT = axios({
                                method: "post",
                                url: URL,
                                headers: {
                                    "Accept-Encoding": "gzip, deflate, br"
                                },
                                data: requestObj,
                            });
                            combinedAllRequests.push(requestOWT);
                            break;

                    default:
                        break;
                }
            }
            // Send request to services file for processing 
            const result = await Promise.all(combinedAllRequests);

            let finalResponse = [];
            result.forEach(res => {
                if (JSON.stringify(res.data).indexOf("ERROR") === -1) {
                    finalResponse.push(res.data);
                }
                else{
                    throw new Error(res.data?.RESPONSE?.text ?? res.data.message)
                }
            });
            if (finalResponse.length === 0) {
                finalResponse = { message: "No data found." };
            }

            createLogs("/Tour/ProductAvailability", fName, fPath, request, finalResponse)
            response.send(finalResponse);
        } catch (error) {
            // Handle error safely and add logs
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };
            apiCommonController.getError(error, fName, fPath, request);
            response.status(400).send(errMessage);
        }
    });

    // Tour destinations save to json file viator and 1way2italy 
    app.post("/:token/Tour/Destinations", async (request, response, next) => {
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response) => {
        // Get ClientId from request body
        const requestObj = request.body;
        const clientId = requestObj.clientId;
        let fPath = `/${clientId}/Routes/`;
        let fName = "Destination_Caching";
        try {
            // Array of providers
            const providerCodes = requestObj.provider;
            const combinedAllRequests = [];
            let URL = "";
            // Provider validation
            for (const providerCode of providerCodes) {
                switch (providerCode.toUpperCase()) {
                    case config.Provider_Code_VTR:
                        fPath += `${config.Provider_Code_VTR}/Destination_Caching`
                        // URL configuration for API call
                        URL = apiCommonController.urlHTTP(
                            `${config.Tour_Viator_Destination_Cache_EndPoint}/${clientId}/Tour/Viator/DestinationCache`
                        );
                        let requetVTR = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requetVTR);
                        break;
                    case config.Provider_Code_OWT:
                        fPath += `${config.Provider_Code_OWT}/Destination_Caching`
                        // URL configuration for API call
                        URL = apiCommonController.urlHTTP(
                            `${config.Tour_1way2italy_Destination_Cache_EndPoint}/${clientId}/Tour/1way2italy/DestinationCache`
                        );
                        let requestOWT = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requestOWT);
                        break;

                    default:
                        break;
                }
            }
            // Send request to services file for processing 
            const result = await Promise.all(combinedAllRequests);

            let finalResponse = [];
            result.forEach(res => {
                if (JSON.stringify(res.data).indexOf("ERROR") === -1) {
                    finalResponse.push(res.data);
                }
            });
            if (finalResponse.length === 0) {
                finalResponse = { message: "No data found." };
            }

            createLogs("/Tour/Destinations", fName, fPath, request, finalResponse)
            response.send(finalResponse);
        } catch (error) {
            // Handle error safely and add logs
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };
            apiCommonController.getError(error, fName, fPath, request);
            response.status(400).send(errMessage);
        }
    });

    // Search destination suggestions / predective search.
    app.post("/:token/Tour/predictiveLocationSearch", async (request, response, next) => {
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response) => {
        // Get ClientId from request body
        const requestObj = request.body;
        const clientId = requestObj.clientId;
        let fPath = `/${clientId}/Routes/`;
        let fName = "Search_Suggestion";
        try {
            // Array of providers
            const providerCodes = requestObj.provider;
            const combinedAllRequests = [];
            let URL = "";
            // Provider validation
            for (const providerCode of providerCodes) {
                switch (providerCode.toUpperCase()) {
                    case config.Provider_Code_VTR:
                        fPath += `${config.Provider_Code_VTR}/Suggestion`
                        // URL configuration for API call
                        URL = apiCommonController.urlHTTP(
                            // `${config.Tour_Viator_Destination_Cache_EndPoint}/${clientId}/Tour/Viator/Destinations`
                            `${config.Tour_Viator_Search_Suggestion_EndPoint}/${clientId}/Tour/Viator/SearchSuggestion`
                        );
                        let requetVTR = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requetVTR);
                        break;

                    case config.Provider_Code_OWT:
                        fPath += `${config.Provider_Code_OWT}/Suggestion`
                        // URL configuration for API call
                        URL = apiCommonController.urlHTTP(
                            `${config.Tour_1way2italy_Search_Suggestion_EndPoint}/${clientId}/Tour/1way2italy/SearchSuggestion`
                        );
                        let requestOWT = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requestOWT);
                        break;

                    default:
                        break;
                }
            }
            // Send request to services file for processing 
            const result = await Promise.all(combinedAllRequests);

            let finalResponse = [];
            result.forEach(res => {
                if (JSON.stringify(res.data).indexOf("ERROR") === -1) {
                    finalResponse.push(res.data);
                }
            });
            if (finalResponse.length === 0) {
                finalResponse = { message: "No data found. or Internal Error" };
            }

            createLogs("/Tour/predictiveLocationSearch", fName, fPath, request, finalResponse)
            response.send(finalResponse);
        } catch (error) {
            // Handle error safely and add logs
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };
            apiCommonController.getError(error, fName, fPath, request);
            response.status(400).send(errMessage);
        }
    });

    // Confirm tour booking.
    app.post("/:token/Tour/Book/:data", async (request, response) => {
        let fName = "Confirm_Booking";
        let fPath = "/Routes/Book";
        try {            
            // Token Validation
            const accessToken = request.params.token;
            const headers = {
                "Authorization": `Bearer ${accessToken}`
            };
            // Domain url for booking pending status check.
            const domainUrl = `${request.protocol}://${request.get('host')}/${accessToken}/`;
            request.body.domainUrl = domainUrl;
            request.headers = headers;
            const tokenvalidation = await apiCommonController.authenticateRequest(app, request, response);
            if (typeof tokenvalidation.tokenexpired !== "undefined") {
                throw new Error({ message: tokenvalidation.tokenexpired });
            }
            const clientId = tokenvalidation.client.id;

            let URL = "";
            let providerDetails = {};
            let confirmBookingUrl = "";
            // Get data from params
            const data = request.params.data;
            const params = new URLSearchParams(data);
            // Provider validation
            const providerName = params.get("provider").toUpperCase();
            
            if(providerName === config.Provider_Code_VTR){
                fPath = `/${clientId}/Routes/${config.Provider_Code_VTR}/Confirm_Booking`;
                // URL configuration for API call
                URL = apiCommonController.urlHTTP(
                    `${config.Tour_Viator_Confirm_Book_EndPoint}/${clientId}/Tour/Viator/Book`
                );
                providerDetails = await apiCommonController.providerDetail(clientId, "Viator");               
            }
            else if(providerName === config.Provider_Code_OWT){
                fPath = `/${clientId}/Routes/${config.Provider_Code_OWT}/Confirm_Booking`;
                // URL configuration for API call
                URL = apiCommonController.urlHTTP(
                    `${config.Tour_1way2italy_Booking_Confirm_EndPoint}/${clientId}/Tour/1way2italy/Book`
                );
                providerDetails = await apiCommonController.providerDetail(clientId, "OneWay2Italy");
            }
            else {
                let errogObj = `Provider-${providerName} not found.`
                // Throw error message
                throw new Error(errogObj);
            }

            //Call Book API
            await axios({
                url: URL,
                method: "POST",
                data: request.body,
                headers: headers
            }).then(async (responseAPI) => { 
                confirmBookingUrl = providerDetails?.MoonstrideConfiguration?.saveAndConfirmUrl + request?.body?.bookingGuid + config.saveConfirmBookingUrl ?? "";
                let responseDataFromMoonstride = "";
                if(request.body.checkout && responseAPI?.data?.Result?.status){
                    responseDataFromMoonstride = await apiCommonController.sendBookingResponseToMoonstride(clientId, confirmBookingUrl, responseAPI.data, providerDetails, response, request);
                }
                else{
                    responseDataFromMoonstride = responseAPI?.data;
                }                
                // Add logs
                if (config.Tour_Book_Logs === "ON") {
                    const resAPI = apiCommonController.createFullApiLog(URL, JSON.stringify(request.body), JSON.stringify(responseDataFromMoonstride), " ");
                    apiCommonController.doLogs(resAPI, fName, fPath);
                }                
                response.send(responseDataFromMoonstride);
            }).catch((errMessage) => {
                console.log(errMessage.response.data);
                // Handle error safely and add logs
                fName = `${fName}Error`;
                let resAPI = apiCommonController.createFullApiLog(URL, JSON.stringify(request.body), " ", errMessage);
                apiCommonController.doLogs(resAPI, fName, fPath);
                let responseData = {
                    "STATUS": "ERROR",
                    "RESPONSE": {
                        "text": errMessage?.response?.data?.RESPONSE?.text ?? errMessage.message
                    }
                }
                apiCommonController.getError(responseData, fName, fPath, request);
                response.send(responseData);
            });
        } catch (error) {
            // Handle error safely and add logs
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };
            apiCommonController.getError(errMessage, fName, fPath, request);
            response.status(400).send(errMessage);
        }
    });

    // Add booking to moonstride.
    app.post("/:token/Tour/AddBooking", async (request, response, next) => {
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response) => {
        const requestObj = request.body;
        const clientId = requestObj.clientId;
        let fName = "Add_Booking";
        let fPath = `${clientId}/Routes/`;
        try{
            // Array of providers
            const providerCodes = requestObj.provider;
            const combinedAllRequests = [];
            let URL = "";
            let BookingUrl = "";
            let providerDetails = "";
            // Provider validation
            for (const providerCode of providerCodes) {
                switch (providerCode.toUpperCase()) {
                    case config.Provider_Code_VTR:
                        fPath += `${config.Provider_Code_VTR}/Add_Booking`
                        // URL configuration for API call
                        URL = apiCommonController.urlHTTP(
                            `${config.Tour_Viator_Book_EndPoint}/${clientId}/Tour/Viator/AddBooking`
                        );
                        let requetVTR = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requetVTR);
                        providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
                        BookingUrl = providerDetails?.MoonstrideConfiguration?.Booking_Endpoint;                        
                        break;

                    case config.Provider_Code_OWT:
                        fPath += `${config.Provider_Code_OWT}/Add_Booking`
                            // URL configuration for API call
                            URL = apiCommonController.urlHTTP(
                                `${config.Tour_1way2italy_Add_Booking_EndPoint}/${clientId}/Tour/1way2italy/AddBooking`
                            );
                            let requestOWT = axios({
                                method: "post",
                                url: URL,
                                headers: {
                                    "Accept-Encoding": "gzip, deflate, br"
                                },
                                data: requestObj,
                            });
                            combinedAllRequests.push(requestOWT);
                            providerDetails = await apiCommonController.providerDetail(clientId, "OneWay2Italy");
                            
                            BookingUrl = providerDetails?.MoonstrideConfiguration?.Booking_Endpoint;                        
                            break;

                    default:
                        break;
                }
            }
            // Send request to services file for processing 
            const result = await Promise.all(combinedAllRequests);

            let finalResponse = [];
            result.forEach(res => {
                if (JSON.stringify(res.data).indexOf("ERROR") === -1) {
                    finalResponse.push(res.data);
                }
                else{
                    throw new Error(res?.data?.RESPONSE?.text ?? "An unidentified error occurred.")
                }
            });    

            // Get ms extension token and send data to moonstride.
            if(finalResponse != undefined && finalResponse.length != 0){ 
               
                // Get and Validate Provider Credentials
                if(!BookingUrl){
                    throw new Error("Moonstride configuration not found.");
                }
                
                // await apiCommonController.sendAddBookingRequest(request, response, clientId, finalResponse, requestObj.cartData, BookingUrl)
                response.send(finalResponse)
                createLogs("/:token/Routes/AddBooking", fName, fPath, request, finalResponse)
            }
            else{
                throw new Error("No Cart data found.");
            }                                        
        }
        catch(error){
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };
            apiCommonController.getError(error, fName, fPath, request);
            response.status(400).send(errMessage);
        }
    })

    // Checking Booking Status.
    app.post("/:token/Tour/BookingStatusCheck", async (request, response, next) => {
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response) => {
        // Get ClientId from request body
        const requestObj = request.body;
        const clientId = requestObj.clientId;
        let fPath = `/${clientId}/Routes/`;
        let fName = "Booking_Status";        
        try {
            // Array of providers
            const providerCodes = requestObj.provider;
            const combinedAllRequests = [];
            let URL = "";
            // Provider validation
            for (const providerCode of providerCodes) {
                switch (providerCode.toUpperCase()) {
                    case config.Provider_Code_VTR:
                        fPath += `${config.Provider_Code_VTR}/Booking_Status`
                        // URL configuration for API call
                        URL = apiCommonController.urlHTTP(
                            `${config.Tour_Viator_Book_Status_EndPoint}/${clientId}/Tour/Viator/BookStatus`
                        );
                        let requetVTR = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requetVTR);
                        break;
                    case config.Provider_Code_OWT:
                        fPath += `${config.Provider_Code_OWT}/Booking_Status`
                        // URL configuration for API Call
                        URL = apiCommonController.urlHTTP(
                            `${config.Tour_1way2italy_Book_Status_EndPoint}/${clientId}/Tour/1way2italy/BookStatus`
                        );
                        let onewayBookStatusRequest = axios({
                            method: "post",
                            url: URL,
                            headers:{
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj
                        });
                        combinedAllRequests.push(onewayBookStatusRequest);
                        break;
                    default:
                        break;
                }
            }
            // Send request to services file for processing 
            const result = await Promise.all(combinedAllRequests);

            let finalResponse = [];
            result.forEach(res => {
                if (JSON.stringify(res.data).indexOf("ERROR") === -1) {
                    finalResponse.push(res.data);
                } else{
                    throw new Error(res.data?.RESPONSE?.text);
                }
            });
            if (finalResponse.length === 0) {
                finalResponse = { message: "No data found." };
            }

            createLogs("/:token/Tour/BookingStatusCheck", fName, fPath, request, finalResponse)
            response.send(finalResponse[0]);
        } catch (error) {
            // Handle error safely and add logs
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };
            apiCommonController.getError(error, fName, fPath, request);
            response.status(400).send(errMessage);
        }
    })

    // Cancel booking / get cancel reason. 
    app.post("/:token/Tour/cancelBooking/:data", async (request, response, next) => {
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response) => {
        // Get ClientId from request body
        const requestObj = request.body;
        const clientId = requestObj.clientId;
        let fPath = `/${clientId}/Routes/`;
        let fName = "Cancel_Booking";
        let URL = "";
        try {
            // Array of providers
            const providerCodes = requestObj.provider;
            const combinedAllRequests = [];

            const data = request.params.data;
            const params = new URLSearchParams(data);
            // Provider validation
            const cancelProcess = params.get("process").toUpperCase();
            
            // Provider validation
            for (const providerCode of providerCodes) {
                switch (providerCode.toUpperCase()) {
                    case config.Provider_Code_VTR:
                        fPath  += `${config.Provider_Code_VTR}/Cancel_Booking`
                        // URL configuration for API call
                        URL = await apiCommonController.createViatorRequestUrlForCancel(request, clientId, cancelProcess, response);
                        let requetVTR = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requetVTR);
                                               
                        break;
                    // OWT
                    case config.Provider_Code_OWT:
                        fPath  += `${config.Provider_Code_OWT}/Cancel_Booking`;

                        URL = await apiCommonController.create1way2italtRequestUrlForCancel(request, clientId, cancelProcess, response)
                        
                        let requestOWT = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requestOWT);
                                                                        
                        break;                    
                    default:
                        break;
                }
            }
            // Send request to services file for processing 
            const result = await Promise.all(combinedAllRequests);

            let finalResponse = [];
            result.forEach(res => {
                if (JSON.stringify(res.data).indexOf("ERROR") === -1) {
                    finalResponse.push(res.data);
                }
            });
            if (finalResponse.length === 0) {
                finalResponse = { message: "No data found." };
            }

            createLogs("/:token/Tour/cancelBooking/" + params, fName, fPath, request, finalResponse)
            response.send(finalResponse[0]);
        } catch (error) {
            // Handle error safely and add logs
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };
            apiCommonController.getError(error, fName, fPath, request);
            response.status(400).send(errMessage);
        }
    });

    // Price check for product.
    app.post("/:token/Tour/BookPriceCheck", async (request, response, next) => {
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response) => {
        // Get ClientId from request body
        const requestObj = request.body;
        const clientId = requestObj.clientId;
        let fPath = `/${clientId}/Routes/`;
        let fName = "Price_Check";
        let URL = "";
        try {
            // Array of providers
            const providerCodes = requestObj.provider;
            const combinedAllRequests = [];

            // Provider validation
            for (const providerCode of providerCodes) {
                switch (providerCode.toUpperCase()) {
                    case config.Provider_Code_VTR:
                        fPath += `${config.Provider_Code_VTR}/Price_Check`;
                        // URL configuration for API call
                        URL = apiCommonController.urlHTTP(
                            `${config.Tour_Viator_Price_Check_EndPoint}/${clientId}/Tour/Viator/PriceCheck`
                        );
                        let requetVTR = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requetVTR);
                        break;
                    case config.Provider_Code_OWT:
                        fPath += `${config.Provider_Code_OWT}/Price_Check`;
                        // URL Configuration for API call
                        URL = apiCommonController.urlHTTP(
                            `${config.Tour_1way2italy_Price_Check_EndPoint}/${clientId}/Tour/1way2italy/PriceCheck`
                        );
                        let requestOWT = axios({
                            method: "post",
                            url: URL,
                            headers: {
                                "Accept-Encoding": "gzip, deflate, br"
                            },
                            data: requestObj,
                        });
                        combinedAllRequests.push(requestOWT);
                        break;  

                    default:
                        break;
                }
            }
            // Send request to services file for processing 
            const result = await Promise.all(combinedAllRequests);

            let finalResponse = [];
            result.forEach(res => {
                if (JSON.stringify(res.data).indexOf("ERROR") === -1) {
                    finalResponse.push(res.data);
                }
            });
            if (finalResponse.length === 0) {
                finalResponse = [{ message: "No data found. or Internal Error" }];
            }

            createLogs("/:token/Tour/BookPriceCheck", fName, fPath, request, finalResponse[0])
            response.send(finalResponse[0]);
        } catch (error) {
            // Handle error safely and add logs
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };
            apiCommonController.getError(error, fName, fPath, request);
            response.status(400).send(errMessage);
        }
    })    

    // Destinations attraction endpoint.
    app.post("/:token/Tour/Attractions",async (request, response, next) =>{
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response) =>{
            // Get ClientId from request body
            const requestObj = request.body;
            const clientId = requestObj.clientId;
            let fPath = `/${clientId}/Routes/`;
            let fName = "Attractions";
            let URL = "";
            try{
                  // Array of providers
                const providerCodes = requestObj.provider;
                const combinedAllRequests = [];
                // Provider validation
                for (const providerCode of providerCodes) {
                    switch (providerCode.toUpperCase()) {
                        case config.Provider_Code_VTR:
                            fPath += `${config.Provider_Code_VTR}/Attractions`;
                            // URL configuration for API call
                            URL = apiCommonController.urlHTTP(
                                `${config.Tour_Viator_Attraction_EndPoint}/${clientId}/Tour/Viator/Attractions`
                            );
                            let requetVTR = axios({
                                method: "post",
                                url: URL,
                                headers: {
                                    "Accept-Encoding": "gzip, deflate, br"
                                },
                                data: requestObj,
                            });
                            combinedAllRequests.push(requetVTR);
                            break;
                        case config.Provider_Code_OWT:
                            fPath += `${config.Provider_Code_OWT}/Attractions`;
                            // URL configuration for API call
                            throw new Error("No attractions for 1way2italy");

                        default:
                            break;
                    }
                };
                // Send request to services file for processing 
                const result = await Promise.all(combinedAllRequests);
                let finalResponse = [];
                result.forEach(res => {
                    if (JSON.stringify(res.data).indexOf("ERROR") === -1) {
                        finalResponse.push(res.data);
                    }
                });
                if (finalResponse.length === 0) {
                    finalResponse = { message: "No data found. or Internal Error" };
                }
                createLogs("/:token/Tour/Attractions", fName, fPath, request, finalResponse)
                response.send(finalResponse);

            }
            catch(error){
                 // Handle error safely and add logs
                const errMessage = {
                    "STATUS": "ERROR",
                    "RESPONSE": {
                        "text": error?.response?.data?.RESPONSE?.text ?? error.message
                    }
                };
                apiCommonController.getError(error, fName, fPath, request);
                response.status(400).send(errMessage);
            }

    })

    // Save booking questions to moonstride.
    app.post("/:token/Tour/SaveBookingQuestions",async (request, response, next) =>
    {
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, 
    async (request, response) =>
    {
        // Get ClientId from request body
        const requestObj = request.body;
        const clientId = requestObj.clientId;
            let fPath = `/${clientId}/Routes/`;
            let fName = "Save_Booking_Questions";
            let URL = "";
            try
            {
                // Array of providers
                const providerCodes = requestObj.provider;
                const combinedAllRequests = [];
                // Provider validation
                for (const providerCode of providerCodes) 
                {
                    switch (providerCode.toUpperCase()) 
                    {
                        case config.Provider_Code_VTR:
                            fPath += `${config.Provider_Code_VTR}/Save_Booking_Questions`
                            // URL configuration for API call
                            URL = apiCommonController.urlHTTP(`${config.Tour_Viator_Save_Booking_EndPoint}/${clientId}/Tour/Viator/SaveBookingQuestions`);
                            let requetVTR = axios({
                                method: "POST",
                                url: URL,
                                headers: {"Accept-Encoding": "gzip, deflate, br"},
                                data: requestObj,
                            });
                            combinedAllRequests.push(requetVTR);
                            break;
                        case config.Provider_Code_OWT:
                            fPath += `${config.Provider_Code_OWT}/Save_Booking_Questions`
                            // URL configuration for API call
                            URL = apiCommonController.urlHTTP(`${config.Tour_1way2italy_Save_Booking_EndPoint}/${clientId}/Tour/1way2italy/SaveBookingQuestions`);
                            let requetOWT = axios({
                                method: "POST",
                                url: URL,
                                headers: { "Accept-Encoding": "gzip, deflate, br" },
                                data: requestObj,
                            });
                            combinedAllRequests.push(requetOWT);
                            break;
                        default:
                            break;
                    }
                };
                // Send request to services file for processing 
                const result = await Promise.all(combinedAllRequests);
                let finalResponse = [];
                result.forEach(res => 
                {
                    if (JSON.stringify(res.data).indexOf("ERROR") === -1) 
                    {
                        finalResponse.push(res.data);
                    }
                    else
                    {
                        throw new Error(res.data?.RESPONSE?.text);
                    }
                });
                if (finalResponse.length === 0) {
                    finalResponse = [{ message: "No data found." }];
                }
                let fileName = fName + "Success"
                createLogs("/:token/Tour/SaveBookingQuestions", fileName, fPath, request, finalResponse[0])
                response.send(finalResponse[0]);

            }
            catch(error){
                 // Handle error safely and add logs
                const errMessage = {
                    "STATUS": "ERROR",
                    "RESPONSE": {
                        "text": error?.response?.data?.RESPONSE?.text ?? error.message
                    }
                };
                apiCommonController.getError(error, fName, fPath, request);
                response.status(400).send(errMessage);
            }

    })

    // Get traveler pickup location based on transfer arrival mode only for viator.
    app.post("/:token/Tour/GetPickupLocations",async (request, response, next) =>{
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response) =>{
            // Get ClientId from request body
            const requestObj = request.body;
            const clientId = requestObj.clientId;
            let fPath = `/${clientId}/Routes/`;
            let fName = "Pickup_Locations";
            try{
                  // Array of providers
                const providerCodes = requestObj.provider;
                // Provider validation
                let provider = providerCodes[0];
                if(provider == config.Provider_Code_VTR){
                    fPath += `${config.Provider_Code_VTR}/Pickup_Locations`
                    let locationResponseData = await fetchViatorLocations.fetchViatorPicupLocations(clientId, provider, requestObj);

                    if (locationResponseData.STATUS == "ERROR") {                        
                        apiCommonController.getError(locationResponseData, fName, fPath, request);
                        response.status(400).send(locationResponseData);
                    }
                    else{
                        createLogs("/:token/Tour/GetPickupLocations", fName, fPath, request, locationResponseData)
                        response.send(locationResponseData);
                    }
                    
                }                
            }
            catch(error){
                 // Handle error safely and add logs
                const errMessage = {
                    "STATUS": "ERROR",
                    "RESPONSE": {
                        "text": error?.response?.data?.RESPONSE?.text ?? error.message
                    }
                };
                apiCommonController.getError(error, fName, fPath, request);
                response.status(400).send(errMessage);
            }

    })

    // viator booking questions cache endpoint
    app.post("/:token/Tour/BookingQuestions/:provider", async (request, response, next)=>{
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response) => {
        // Get ClientId from request body
        const requestObj = request.body;
        const clientId = requestObj.clientId;
        let fPath = `/${clientId}/Routes/`;
        let fName = "Booking_Question_Caching";
        try {
            let URL = "";
           // Get data from params
           const data = request.params.provider;
           const params = new URLSearchParams(data);
           // Provider validation
           const providerName = params.get("provider").toUpperCase();

            if(providerName === config.Provider_Code_VTR){
                fPath += `${config.Provider_Code_VTR}/Booking_Question`
                // URL configuration for API call
                URL = apiCommonController.urlHTTP(
                    `${config.Tour_Viator_Cache_Booking_Questions_EndPoint}/${clientId}/Tour/Viator/BookingQuestion`
                );
            }            
            else {
                let errogObj = `Provider-${providerName} not found.`
                // Throw error message
                throw new Error(errogObj);
            }

            // Call Book API
            await axios({
                url: URL,
                method: "POST",
                data: request.body
            }).then((responseAPI) => {
                // Add logs                                
                createLogs(URL, fName, fPath, request, responseAPI.data)
                response.send(responseAPI.data);
            }).catch((errMessage) => {
                console.log(errMessage?.response?.data?.RESPONSE?.text ?? errMessage.message);
                // Handle error safely and add logs
                fName = `${fName}Error`;                
                let responseData = {
                    "STATUS": "ERROR",
                    "RESPONSE": {
                        "text": errMessage?.response?.data?.RESPONSE?.text ?? errMessage.message
                    }
                }
                apiCommonController.getError(responseData, fName, fPath, request);
                response.send(responseData);
            });
            
            
        } catch (error) {
            // Handle error safely and add logs
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };
            apiCommonController.getError(error, fName, fPath, request);
            response.status(400).send(errMessage);
        }
    })

    // viator cancel reason cache endpoint 
    app.post("/:token/Tour/CancelReasonCache/:provider",async(request, response, next) => {        
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response) => {
        // Get ClientId from request body
        const requestObj = request.body;
        const clientId = requestObj.clientId;
        let fPath = `/${clientId}/Routes/`;
        let fName = "Cancel_Reason_Caching";
        try {
            
            let URL = "";
           // Get data from params
           const data = request.params.provider;
           const params = new URLSearchParams(data);
           // Provider validation
           const providerName = params.get("provider").toUpperCase();

            if(providerName === config.Provider_Code_VTR){
                fPath += `${config.Provider_Code_VTR}/Cancel_Reason_Cache`
                // URL configuration for API call
                URL = apiCommonController.urlHTTP(
                    `${config.Tour_Viator_Booking_Cancel_Reason_Caching_EndPoint}/${clientId}/Tour/Viator/CancelReasonCache`
                );
            }            
            else {
                let errogObj = `Provider-${providerName} not found.`
                // Throw error message
                throw new Error(errogObj);
            }

            // Call Book API
            await axios({
                url: URL,
                method: "POST",
                data: request.body
            }).then((responseAPI) => {
                // Add logs                                
                createLogs(URL, fName, fPath, request, responseAPI.data)
                response.send(responseAPI.data);
            }).catch((errMessage) => {
                console.log(errMessage?.response?.data?.RESPONSE?.text ?? errMessage.message);
                // Handle error safely and add logs
                fName = `${fName}Error`;                
                let responseData = {
                    "STATUS": "ERROR",
                    "RESPONSE": {
                        "text": errMessage?.response?.data?.RESPONSE?.text ?? errMessage.message
                    }
                }
                apiCommonController.getError(responseData, fName, fPath, request);
                response.send(responseData);
            });
        } catch (error) {
             // Handle error safely and add logs
             const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };
            apiCommonController.getError(error, fName, fPath, request);
            response.status(400).send(errMessage);
        }
    })

    app.all("/test", async function (request, response) {
        try {
            response.json({
                Message: "Test Done"
            });
        } catch (err) {
            // Handle error safely and add logs
            const errMessage = { "APIError": '' + err + '' };
            response.send(errMessage);
        }
    });

};

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response)
{
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

