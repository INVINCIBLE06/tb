"use strict";
const config = require("../../Config");
const apiCommonController = require("../../Utility/APICommonController");
const tourProviderSchema = require("../../DAL/Mongo/Schemas/TourProvider");

module.exports = async function (app) {
    let host
    let protocol
    // Configuration Page
    app.get("/accesssource/:providerCode/:token", async (request, response) => {
        try {
            // Fetch domainURL from request
            host = request.get('host');
            protocol = request.connection.encrypted ? 'https' : 'http';
            const domainURL = `${request.protocol}://${request.get('host')}`;
            // Check if token data is stored in session or not
            if (!request.session.tokenValidation) {
                const token = request.params.token;
                const tokenStatus = await apiCommonController.validateConfigurationToken(app, request, response);
                if (tokenStatus instanceof Error) {
                    throw tokenStatus;
                }

                // Set and validate session for token data
                const sessionData = await apiCommonController.sessionFunction(token, tokenStatus, request);
                if (sessionData instanceof Error) {
                    throw sessionData;
                }
            }
            // API url configuration
            const configurationURL = `${domainURL}/accesssource/${request.params.providerCode}`;

            // Redirect URL
            response.redirect(configurationURL);
        } catch (err) {
            // Render errorpage
            response.render("views/errorpage", { errorMessage: "Session expired.", moonstrideURL: "", errorDescription: err.stack });
        }
    });


    // Configuration Page
    app.get("/accesssource/:providerCode", async (request, response, next) => {
            request.body.configuration = true;
            // Validate oauth token and if valid then execute next function
            await apiCommonController.validateOauthToken(app, request, response, next);
        }, async (request, response, next) => {
            // Validate Gateway provider and if valid then execute next function
            await apiCommonController.validateProviderCode(request, response, next);
        }, async (request, response) => {
            // Get clientId and token from request
            const requestObj = request.body;
            const { clientId } = requestObj;
            // Log file name and path declaration
            let fName = "Configuration";
            const fPath = `/${clientId}/Configuration/accesssource`;
            let moonstrideURL;
            try {
                // Configure provider details
                const { providerCode, providerName, providerURL } = requestObj.providerData;
                let apiKeyExist = false 
                let owtRequestorIdExist = false
                // Get moonstride Domain URL
                moonstrideURL = await apiCommonController.getMsDomainUrl(clientId, providerName);

                let providerdetails = await getProviderDetails(clientId, providerCode, config);

                let moonstrideConfiguration = providerdetails?.MoonstrideConfiguration ?? {};
                if(providerCode == config.Provider_Code_VTR){
                    if(providerdetails?.Viator?.Viator_apiKey && providerdetails?.Viator?.Viator_apiKey !== ""){
                        providerdetails = providerdetails?.Viator;
                        apiKeyExist = true
                    }
                }                
                else if(providerdetails?.OneWay2Italy?.Requestor_ID && providerdetails?.OneWay2Italy?.Requestor_ID !== ""){
                    providerdetails = providerdetails?.OneWay2Italy;
                    owtRequestorIdExist = true
                }
                const providerdetailsobject = JSON.stringify(providerdetails);

                let moonstrideConfigurationObject = JSON.stringify(moonstrideConfiguration);

                let accessToken = request?.session?.tokenValidation?.accessToken

                let requestUrl = `${protocol}://${host}/${accessToken}/Tour/Destinations`;
                let questionCachingUrl = `${protocol}://${host}/${accessToken}/Tour/BookingQuestions/provider=VTR`;
                let cancelReasonCachingUrl = `${protocol}://${host}/${accessToken}/Tour/CancelReasonCache/provider=VTR`;
                
                let bookingQuestionsCachingLoc = `${config.viator_booking_questionCaching_location.split('template')[1]}`
                let cancelReasonsCachingLoc = `${config.viator_booking_cancel_reason_caching_file_location.split('template')[1]}`
                let destinationCachingLoc = `${config.viator_Destination_File_Path.split('template')[1]}`
                
                response.render("views/source", {destinationCachingLoc, cancelReasonsCachingLoc, bookingQuestionsCachingLoc, providerCode, providerName, providerURL, providerdetailsobject, moonstrideURL, requestUrl, apiKeyExist, owtRequestorIdExist, questionCachingUrl, cancelReasonCachingUrl, moonstrideConfigurationObject });
            } 
            catch (err) {
                console.log(err);
                // Handle error safely and add logs
                apiCommonController.getError(err, fName, fPath, request);
                // Render error page
                response.render("views/errorpage", { errorMessage: "Something went wrong!", moonstrideURL, errorDescription: err.stack });
            }
    });
    


    // Insert or Update provider data in database
    app.post("/saveproviderdetails/:providerCode", async (request, response, next) => {
        request.body.configuration = true;
        // Validate oauth token and if valid then execute next function
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response, next) => {
        // Validate Gateway provider and if valid then execute next function
        await apiCommonController.validateProviderCode(request, response, next);
    }, async (request, response) => {
        // Get clientId and token from request
        const requestObj = request.body;
        const { clientId } = requestObj;
        // Log file name and path declaration
        const fName = "Configuration";
        const fPath = `/${clientId}/Configuration/saveproviderdetails`;
        let moonstrideURL;
        try {
            // Get provider details from request
            const { providerCode, providerName } = requestObj.providerData;

            // Get moonstride Domain URL
            moonstrideURL = await apiCommonController.getMsDomainUrl(clientId, providerName);            

            // Get and Validate data from database
            const checkappkey = await apiCommonController.checkappkeyexist(clientId, providerCode);
            if (checkappkey instanceof Error) {
                throw checkappkey;
            }

            if (providerCode == config.Provider_Code_VTR) {
                await viatorConfigurationSaveToDb(clientId, request, providerCode, checkappkey, response, moonstrideURL);               
            }
            else if(providerCode == config.Provider_Code_OWT){
                await OneWay2ItalyConfigurationSaveToDb(clientId, request, providerCode, checkappkey, response, moonstrideURL);
                
            }

            const successMessage = "Your data has been saved successfully.";
            // Render the success page
            response.render("views/success", { successMessage, providerCode, moonstrideURL });
        } catch (err) {
            // Handle error safely and add logs
            apiCommonController.getError(err, fName, fPath, request);
            response.render("views/errorpage", { errorMessage: "Something went wrong!", moonstrideURL, errorDescription: err.stack });
        }
    });


    // Insert or Update provider data in database
    app.post("/saveMoonstrideConfiguration/:providerCode", async (request, response, next) => {
        request.body.configuration = true;
        // Validate oauth token and if valid then execute next function
        await apiCommonController.validateOauthToken(app, request, response, next);
    }, async (request, response, next) => {
        // Validate Gateway provider and if valid then execute next function
        await apiCommonController.validateProviderCode(request, response, next);
    }, async (request, response) => {
        // Get clientId and token from request
        const requestObj = request.body;
        const { clientId } = requestObj;
        // Log file name and path declaration
        const fName = "MoonstrideConfiguration";
        const fPath = `/${clientId}/MoonstrideConfiguration/saveMoonstrideConfiguration`;
        let moonstrideURL;
        try {
            // Get provider details from request
            const { providerCode, providerName } = requestObj.providerData;
            // Get moonstride Domain URL
            moonstrideURL = await apiCommonController.getMsDomainUrl(clientId, providerName);  
            // Get and Validate data from database
            const checkappkey = await apiCommonController.checkappkeyexist(clientId, providerCode);
            if (checkappkey instanceof Error) {
                throw checkappkey;
            }
            if (providerCode == config.Provider_Code_VTR || providerCode == config.Provider_Code_OWT) {        
                if (checkappkey.length > 0) {
                    let MoonstrideConfiguration = {
                        Access_token_URL: request.body.accessTokenUrl,
                        Client_secret : request.body.clientSecret,
                        UserId : request.body.UserId,
                        msBaseUrl : request.body.msBaseUrl,
                        Booking_Endpoint : request.body.bookingEndpoint,
                        Search_logs_EndPoint : request.body.searchLogsEndpoint,
                        Passengers_Endpoint : request.body.passengerEndpoint,
                        createdatetime: checkappkey[0]?.OneWay2Italy?.createdatetime ?? new Date(),
                        modifydatetime: new Date(),
                        googleapiurl: request.body.googleapiurl,
                        agentmarkupurl: request.body.agentmarkupurl,
                        agentcommissionurl : request.body.agentcommissionurl,
                        savebookingquestionurl: request.body.savebookingquestionurl,
                        savelanguageguideurl : request.body.savelanguageguideurl,
                        saveAndConfirmUrl : request.body.saveAndConfirmUrl
                    };

                    let updateData = { appid: clientId };
                    let query = {
                        $set:
                        {
                            "MoonstrideConfiguration": MoonstrideConfiguration,
                            "modifydatetime": new Date()
                        }
                    }
                    await tourProviderSchema(clientId).updateMany(updateData, query);
                    
                }
                else {

                    const provider = tourProviderSchema(clientId)({
                        appid: clientId,
                        MoonstrideConfiguration : {
                            Access_token_URL: request.body.accessTokenUrl,
                            Client_secret : request.body.clientSecret,
                            UserId : request.body.client_Id,
                            msBaseUrl : request.body.msBaseUrl,
                            Booking_Endpoint : request.body.bookingEndpoint,
                            Search_logs_EndPoint : request.body.searchLogsEndpoint,
                            Passengers_Endpoint : request.body.passengerEndpoint,
                            createdatetime: checkappkey[0]?.Viator?.createdatetime ?? new Date(),
                            modifydatetime: new Date(),
                            googleapiurl: request.body.googleapiurl,
                            agentmarkupurl: request.body.agentmarkupurl,
                            agentcommissionurl : request.body.agentcommissionurl,
                            savebookingquestionurl: request.body.savebookingquestionurl,
                            savelanguageguideurl : request.body.savelanguageguideurl,
                            saveAndConfirmUrl : request.body.saveAndConfirmUrl
                        }
                    });
                    await provider.save();
                }
            }
            const successMessage = "Your data has been saved successfully.";

            // Render the success page
            response.render("views/success", { successMessage, providerCode, moonstrideURL});
        } catch (err) {
            // Handle error safely and add logs
            apiCommonController.getError(err, fName, fPath, request);
            response.render("views/errorpage", { errorMessage: "Something went wrong!", moonstrideURL, errorDescription: err.stack });
        }
    });

}

// Encrypt or decrypt values
async function encryptDataValues(providerCode, dataKey, salt){
    if(providerCode == config.Provider_Code_VTR){
        let encryptedVTRValue = apiCommonController.encrypt(dataKey, salt);
        return encryptedVTRValue;
    }
    else if(providerCode == config.Provider_Code_OWT){
        let encryptedOWTValue = apiCommonController.encrypt(dataKey, salt);
        return encryptedOWTValue;
    }
}

// Viator configuration details save to database
async function viatorConfigurationSaveToDb(clientId, request, providerCode, checkappkey, response, moonstrideURL){

    let fName = "Configuration";
    let fPath = `/${clientId}/Configuration/saveproviderdetails`;

    try{
        // encrypt viator api key
        request.body.VTR_apiKey = await encryptDataValues(providerCode, request.body.VTR_apiKey, config.Database_Salt_Key)
                               
        // encrypt google api key
        request.body.Gloc_apiKey = await encryptDataValues(providerCode, request.body.Gloc_apiKey, config.Database_Salt_Key);

        if (checkappkey.length > 0) {
            let Active = (request.body.isactive)? request.body.isactive : false;

            let IsActive = Boolean(Active);
            
            let Viator = {
                ProviderCode: config.Provider_Code_VTR,
                Viator_url: request.body.Viator_url,
                Viator_apiKey: request.body.VTR_apiKey,
                Gloc_apiKey : request.body.Gloc_apiKey,
                isactive: IsActive,
                manualConfirm : request.body.manualConfirm ?? "No",
                createdatetime: checkappkey[0]?.Viator?.createdatetime ?? new Date(),
                modifydatetime: new Date(),
                pageLayout : request.body.pageLayout,
                userReviewsShow : request.body.showReviews,
                whatToExpect : request.body.whatToExpect,
                showCancellationPolicy : request.body.cancellationPolicy,
                showSupplier : request.body.supplier,
                showPickup : request.body.pickup
            };

            let updateData = { appid: clientId };
            let query = {
                $set:
                {
                    "Viator": Viator,
                    "modifydatetime": new Date()
                }
            }
            await tourProviderSchema(clientId).updateMany(updateData, query);
            
        }
        else {
            let Active = request.body.isactive;
            if (Active == undefined) {
                Active = false;
            }
            const IsActive = Boolean(Active);
            const provider = tourProviderSchema(clientId)({
                appid: clientId,
                Viator: {
                    ProviderCode: config.Provider_Code_VTR,
                    Viator_url: request.body.Viator_url,
                    Viator_apiKey: request.body.VTR_apiKey,
                    Gloc_apiKey : request.body.Gloc_apiKey,
                    isactive: IsActive,
                    manualConfirm : request.body.manualConfirm ?? "No",
                    createdatetime: new Date(),
                    modifydatetime: null,
                    pageLayout : request.body.pageLayout,
                    userReviewsShow : request.body.showReviews,
                    whatToExpect : request.body.whatToExpect,
                    showCancellationPolicy : request.body.cancellationPolicy,
                    showSupplier : request.body.supplier,
                    showPickup : request.body.pickup
                }
            });
            await provider.save();
        }
        return null;
    }
    catch(error){
        apiCommonController.getError(err, fName, fPath, request);
        response.render("views/errorpage", { errorMessage: "Something went wrong!", moonstrideURL, errorDescription: err.stack });
    }
}

// Function for oneway2Italy configuration details save to db
async function OneWay2ItalyConfigurationSaveToDb(clientId, request, providerCode, checkappkey, response, moonstrideURL){

    let fName = "Configuration";
    let fPath = `/${clientId}/Configuration/saveproviderdetails`;

    try{
        // encrypt the requestor id
        request.body.OWT_requestorKey = await encryptDataValues(providerCode, request.body.OWT_requestorKey, config.Database_Salt_Key);
        // encrypt the requestor password
        request.body.OWT_passKey = await encryptDataValues(providerCode, request.body.OWT_passKey, config.Database_Salt_Key);
        let availableSuppliersArrObj = await getSuppliersName(request, clientId);
        if (checkappkey.length > 0) {
            let Active = request.body.isactive;
            if (Active == undefined) {
                Active = false;
            }
            let IsActive = Boolean(Active);
            
            let OneWay2Italy = {
                ProviderCode: config.Provider_Code_OWT,
                Oneway2italy_url : request.body.Oneway2italy_url,
                Requestor_ID: request.body.OWT_requestorKey,
                Password : request.body.OWT_passKey,
                isactive: IsActive,
                defaultCategory : request.body.defaultCategory ?? "202",
                createdatetime: checkappkey[0]?.Viator?.createdatetime ?? new Date(),
                modifydatetime: new Date(),
                pageLayout : request.body.pageLayout,
                showHideSupplier : request.body.showHideSupplier,
                availableSuppliers : availableSuppliersArrObj
                
            };

            let updateData = { appid: clientId };
            let query = {
                $set:
                {
                    "OneWay2Italy": OneWay2Italy,
                    "modifydatetime": new Date()
                }
            }
            await tourProviderSchema(clientId).updateMany(updateData, query);
            
        }
        else {
            let Active = request.body.isactive;
            if (Active == undefined) {
                Active = false;
            }
            const IsActive = Boolean(Active);
            const provider = tourProviderSchema(clientId)({
                appid: clientId,
                OneWay2Italy: {
                    ProviderCode: config.Provider_Code_OWT,
                    Oneway2italy_url : request.body.Oneway2italy_url,
                    Requestor_ID: request.body.OWT_requestorKey,
                    Password : request.body.OWT_passKey,
                    isactive: IsActive,
                    defaultCategory : request.body.defaultCategory ?? "202",
                    createdatetime: new Date(),
                    modifydatetime: null,                            
                    pageLayout : request.body.pageLayout,
                    showHideSupplier : request.body.showHideSupplier,
                    availableSuppliers : [
                        {
                            "SupplierName" : "Carrani di Escursioni Italiane S.R.L.",
                            "SupplierCode" : "CARRANI"
                        },
                        {
                            "SupplierName" : "Nitrodi Srl TEST",
                            "SupplierCode" : "NITROTST"
                        },
                        {
                            "SupplierName" : "Norma Vacanze TEST",
                            "SupplierCode" : "NORMATST"
                        },
                        {
                            "SupplierName" : "Belmondo",
                            "SupplierCode" : "DOGEOFV"
                        },
                        {
                            "SupplierName" : "Anxur Tours Srl",
                            "SupplierCode" : "ANXUR"
                        } 
                    ]
                }
            });
            await provider.save();
        }
        return null;
    }
    catch(error){
        apiCommonController.getError(err, fName, fPath, request);
        response.render("views/errorpage", { errorMessage: "Something went wrong!", moonstrideURL, errorDescription: err.stack });
    }
}

// Function for get supplier name
async function getSuppliersName(request, clientId){
    try{
        let supplierArr = [];
        let suppliersCodes = request.body.supplier;
        if(!Array.isArray(suppliersCodes)){
            suppliersCodes = [suppliersCodes];
        }
        
        for(let sup of suppliersCodes){
            let obj;
            switch(sup){
                case "CARRANI":
                    obj = {
                        "SupplierName" : "Carrani di Escursioni Italiane S.R.L.",
                        "SupplierCode" : sup
                    }
                    supplierArr.push(obj);
                break;
                case "NITROTST":
                    obj = {
                        "SupplierName" : "Nitrodi Srl TEST",
                        "SupplierCode" : sup
                    }
                    supplierArr.push(obj);
                break;
                case "NORMATST":
                    obj = {
                        "SupplierName" : "Norma Vacanze TEST",
                        "SupplierCode" : sup
                    }
                    supplierArr.push(obj);
                break;
                case "DOGEOFV":
                    obj = {
                        "SupplierName" : "Belmondo",
                        "SupplierCode" : sup
                    }
                    supplierArr.push(obj);
                break;
                case "ANXUR":
                    obj = {
                        "SupplierName" : "Anxur Tours Srl",
                        "SupplierCode" : sup
                    }
                    supplierArr.push(obj);
                break;
            }
        }
        return supplierArr;
    }
    catch(error){
        console.log(error);
    }
}

//****************************************/
//Function for get provider details
async function getProviderDetails(clientId, providerCode, config) {
    
    switch (providerCode.toUpperCase()) {
        case config.Provider_Code_VTR:
            return getViatorProviderDetails(clientId, config);
        case config.Provider_Code_OWT:
            return getOneWay2ItalyProviderDetails(clientId, config);
        default:
            throw new Error(`${providerCode} is not a registered Tour Service.`);
    }
}

//Function for get viter provider details
async function getViatorProviderDetails(clientId, config) {
    const viarorAppExist = await apiCommonController.checkappkeyexist(clientId, config.Provider_Code_VTR);

    if (viarorAppExist instanceof Error) {
        throw viarorAppExist;
    }

    if (viarorAppExist.length > 0) {
        const providerdetails = viarorAppExist[0];
        if(providerdetails != null && providerdetails?.Viator?.Viator_apiKey && providerdetails?.Viator?.Viator_apiKey !== ""){
             return providerdetails
        }
        else {
            return {
                appid: clientId,
                Viator: {
                    ProviderCode: config.Provider_Code_VTR,
                    Viator_apiKey: "",
                    Gloc_apiKey: "",
                    isactive: true,
                },
                MoonstrideConfiguration : {}
            };
        }
    }
    else {
        return {
            appid: clientId,
            Viator: {
                ProviderCode: config.Provider_Code_VTR,
                Viator_apiKey: "",
                Gloc_apiKey: "",
                isactive: true,
            },
            MoonstrideConfiguration : {}
        };
    }
}
//Function for get  1 way to italy provider details
async function getOneWay2ItalyProviderDetails(clientId, config) {
    const Oneway2italyAppExist = await apiCommonController.checkappkeyexist(clientId, config.Provider_Code_OWT);

    if (Oneway2italyAppExist instanceof Error) {
        throw Oneway2italyAppExist;
    }

    if (Oneway2italyAppExist.length > 0) {
        const providerdetails = Oneway2italyAppExist[0];
        if(providerdetails != null && providerdetails?.OneWay2Italy?.Requestor_ID && providerdetails?.OneWay2Italy?.Requestor_ID !== ""){
             return providerdetails
        }
        else{
            return {
                appid: clientId,
                OneWay2Italy: {
                    ProviderCode: config.Provider_Code_OWT,
                    Requestor_ID: "",
                    Password: "",
                    availableSuppliers: [],
                    isactive: true,
                },
                MoonstrideConfiguration : {}
            };
        }
    }
    else {
        return {
            appid: clientId,
            OneWay2Italy: {
                ProviderCode: config.Provider_Code_OWT,
                Requestor_ID: "",
                Password: "",
                availableSuppliers: [],
                isactive: true,
            },
            MoonstrideConfiguration : {}
        };
    }
}