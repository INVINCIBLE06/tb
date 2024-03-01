"use strict";
const config = require("../../Config");
const apiCommonController = require("../../Utility/APICommonController");
const tourProviderSchema = require("../../DAL/Mongo/Schemas/TourProvider");

module.exports = async function (app) {

    app.get("/MoonstrideConfiguration/:providerCode/:token", async (request, response) => {
        try {
            // Fetch domainURL from request
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
            const configurationURL = `${domainURL}/MoonstrideConfiguration/${request.params.providerCode}`;

            // Redirect URL
            response.redirect(configurationURL);
        } catch (err) {
            // Render errorpage
            response.render("views/errorpage", { errorMessage: "Session expired.", moonstrideURL: "", errorDescription: err.stack });
        }
    });

    app.get("/MoonstrideConfiguration/:providerCode", async (request, response, next) => {

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
        const fName = "Tour_MoonstrideConfiguration";
        const fPath = `/${clientId}/Tour/MoonstrideConfiguration`;

        let moonstrideURL;
        try {
            // Configure provider details
            const { providerCode, providerName, providerURL } = requestObj.providerData;

            // Get moonstride Domain URL
            moonstrideURL = await apiCommonController.getMsDomainUrl(clientId, providerName);
            let providerdetails;
            switch(providerCode.toUpperCase()){
                case config.Provider_Code_VTR:
                    // Get and Validate data from database
                    let Viator_moonstrideConfigExists = await apiCommonController.checkappkeyexist(clientId, providerCode);
                    if (Viator_moonstrideConfigExists instanceof Error) {
                        throw Viator_moonstrideConfigExists;
                    }
                    if (Viator_moonstrideConfigExists.length > 0) {
                        providerdetails = Viator_moonstrideConfigExists[0]?.MoonstrideConfiguration;
                    }
                    else {
                        providerdetails = {
                            appid: clientId,
                            MoonstrideConfiguration : {
                                Access_token_URL: "",
                                Client_secret : "",
                                UserId : "",
                                Booking_Endpoint : "",
                                Search_logs_EndPoint : "",
                                Passengers_Endpoint : "",
                            },
                        }
                    }
                    break;

                case config.Provider_Code_OWT:
                    // Get and Validate data from database
                    let Oneway2italy_moonstrideConfigExists = await apiCommonController.checkappkeyexist(clientId, providerCode);
                    if (Oneway2italy_moonstrideConfigExists instanceof Error) {
                        throw Oneway2italy_moonstrideConfigExists;
                    }
                    if (Oneway2italy_moonstrideConfigExists.length > 0) {
                        providerdetails = Oneway2italy_moonstrideConfigExists[0]?.MoonstrideConfiguration;
                    }
                    else {
                        providerdetails = {
                            appid: clientId,
                            MoonstrideConfiguration : {
                                Access_token_URL: "",
                                Client_secret : "",
                                UserId : "",
                                Booking_Endpoint : "",
                                Search_logs_EndPoint : "",
                                Passengers_Endpoint : "",
                            },
                        }
                    }
                    break;
                default:
                    throw new Error(`${providerCode} is not registered Tour Service.`);
            }   
            const providerdetailsobject = JSON.stringify(providerdetails);

            response.render("views/token", { providerCode, providerName, providerURL, providerdetailsobject, moonstrideURL });
        } catch (err) {
            // Handle error safely and add logs
            apiCommonController.getError(err, fName, fPath, request);
            // Render error page
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
        const fName = "Tour_MoonstrideConfiguration";
        const fPath = `/${clientId}/Tour/saveMoonstrideConfiguration`;
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
                if (checkappkey.length > 0) {
                    let MoonstrideConfiguration = {
                        Access_token_URL: request.body.accessTokenUrl,
                        Client_secret : request.body.clientSecret,
                        UserId : request.body.UserId,
                        Booking_Endpoint : request.body.bookingEndpoint,
                        Search_logs_EndPoint : request.body.searchLogsEndpoint,
                        Passengers_Endpoint : request.body.passengerEndpoint,
                        createdatetime: checkappkey[0]?.OneWay2Italy?.createdatetime ?? new Date(),
                        modifydatetime: new Date(),
                        viatorurl: request.body.viatorurl,
                        onewaytoItalyurl: request.body.onewaytoItalyurl,
                        googleapiurl: request.body.googleapiurl,
                        agentmarkupurl: request.body.agentmarkupurl,
                        savebookingquestionurl: request.body.savebookingquestionurl,
                        savelanguageguideurl : request.body.savelanguageguideurl
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
                            Booking_Endpoint : request.body.bookingEndpoint,
                            Search_logs_EndPoint : request.body.searchLogsEndpoint,
                            Passengers_Endpoint : request.body.passengerEndpoint,
                            createdatetime: checkappkey[0]?.Viator?.createdatetime ?? new Date(),
                            modifydatetime: new Date(),
                            viatorurl: request.body.viatorurl,
                            onewaytoItalyurl: request.body.onewaytoItalyurl,
                            googleapiurl: request.body.googleapiurl,
                            agentmarkupurl: request.body.agentmarkupurl,
                            savebookingquestionurl: request.body.savebookingquestionurl,
                            savelanguageguideurl : request.body.savelanguageguideurl
                        }
                    });
                    await provider.save();
                }
            }

            else if(providerCode == config.Provider_Code_OWT){
                if (checkappkey.length > 0) {                    
                     
                    let MoonstrideConfiguration = {
                        Access_token_URL: request.body.accessTokenUrl,
                        Client_secret : request.body.clientSecret,
                        UserId : request.body.UserId,
                        Booking_Endpoint : request.body.bookingEndpoint,
                        Search_logs_EndPoint : request.body.searchLogsEndpoint,
                        Passengers_Endpoint : request.body.passengerEndpoint,
                        createdatetime: checkappkey[0]?.OneWay2Italy?.createdatetime ?? new Date(),
                        modifydatetime: new Date(),
                        viatorurl: request.body.viatorurl,
                        onewaytoItalyurl: request.body.onewaytoItalyurl,
                        googleapiurl: request.body.googleapiurl,
                        agentmarkupurl: request.body.agentmarkupurl,
                        savebookingquestionurl: request.body.savebookingquestionurl,
                        savelanguageguideurl : request.body.savelanguageguideurl
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
                            UserId : request.body.UserId,
                            Booking_Endpoint : request.body.bookingEndpoint,
                            Search_logs_EndPoint : request.body.searchLogsEndpoint,
                            Passengers_Endpoint : request.body.passengerEndpoint,
                            createdatetime: checkappkey[0]?.OneWay2Italy?.createdatetime ?? new Date(),
                            modifydatetime: new Date(),
                            viatorurl: request.body.viatorurl,
                            onewaytoItalyurl: request.body.onewaytoItalyurl,
                            googleapiurl: request.body.googleapiurl,
                            agentmarkupurl: request.body.agentmarkupurl,
                            savebookingquestionurl: request.body.savebookingquestionurl,
                            savelanguageguideurl : request.body.savelanguageguideurl
                        },
                    });
                    await provider.save();
                }
            }

            const successMessage = "Your data has been saved successfully.";
            let moonConfig = true;

            // Render the success page
            response.render("views/success", { successMessage, providerCode, moonstrideURL,  moonConfig});
        } catch (err) {
            // Handle error safely and add logs
            apiCommonController.getError(err, fName, fPath, request);
            response.render("views/errorpage", { errorMessage: "Something went wrong!", moonstrideURL, errorDescription: err.stack });
        }
    });
}