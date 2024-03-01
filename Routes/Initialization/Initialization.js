"use strict";
const axios = require("axios");
const config = require("../../Config");
const apiCommonController = require("../../Utility/APICommonController.js");
const registrationSchema = require("../../DAL/Mongo/Schemas/InitializationSchema");

module.exports = function (app) {

    app.post("/initialization", async function (request, response) {
        let fPath = "/Tour/initialization";
        let fName = "initialization";
        try {
            const {
                clientreferenceid,
                appid,
                appname,
                postappauthenticationurl,
                domainurl,
                clientregion
            } = request.body;
            let mooncognitoResponse = {};

            // Mooncognito request validation
            const initializationError = apiCommonController.checkInitializationRequest(appid, appname, postappauthenticationurl, clientreferenceid, domainurl);
            if (initializationError.STATUS === "ERROR") {
                throw new Error(initializationError.RESPONSE.text);
            }

            // Update file path with client reference id and app name
            fPath = `/${clientreferenceid}/Tour/${appname}/initialization`;

            // Create secretkey
            const gid = BigInt(Math.floor((Math.random() * 1000000000000000000000000000000) + 1));
            let secretkey = gid.toString();
            const clientCredentials = `${clientreferenceid}:${secretkey}`;
            const clientbase64 = apiCommonController.base64encoding(clientCredentials);
            secretkey = apiCommonController.encrypt(clientbase64, config.Encryption_Key);

            // Get list of domains and parse it
            const domainList = JSON.parse(config.Domains);
            // Get list of domains and parse it
            const frontDomainList = JSON.parse(config.Front_Domains);

            // Region wise domain configuration and response validation
            const appRegion = clientregion?.toUpperCase();
            const domain = await apiCommonController.createDomainURL(domainList, appRegion);
            if (domain.STATUS === "ERROR") {
                throw new Error(domain.RESPONSE.text);
            }
            const frontDomain = await apiCommonController.createDomainURL(frontDomainList, appRegion);
            if (frontDomain.STATUS === "ERROR") {
                throw new Error(frontDomain.RESPONSE.text);
            }

            // Get callback URL details and parse it
            let jsoncallback = JSON.parse(config.Callback_URL);

            // Callback URLs configuration
            const tokenurl = `${domain}${jsoncallback.tokenurl}`;
            let configurationurl = `${domain}${jsoncallback.configurationurl}`;

            // Get and Validate Appwise configurationURL
            configurationurl = await apiCommonController.createConfigurationURL(appname, configurationurl);
            if (configurationurl.STATUS === "ERROR") {
                throw new Error(configurationurl.RESPONSE.text);
            }

            jsoncallback = {
                appname: appname,
                tokenurl,
                configurationurl,
                secretkey,
                apprefrencenumber: "",
                endpointurl: domain,
                fronturl: frontDomain
            };

            // Find clientReferenceId and clientId in database
            const value = await registrationSchema.find({ "clientreferenceid" : clientreferenceid, "appid" : appid })
                .maxTimeMS(20000)
                .lean()
                .exec();
            if (value.length > 0) {
                // If found value have data then overwrite the secretkey with found from the database
                jsoncallback.secretkey = value[0].secretkey;
            }
            else {
                // If this client have another provider then we will use that provider's clientsecret other wise we will create new one
                const findClientRefId = await registrationSchema.find({ "clientreferenceid" : clientreferenceid })
                .maxTimeMS(20000)
                .lean()
                .exec();
                
                if (findClientRefId.length > 0) {
                    jsoncallback.secretkey = findClientRefId[0].secretkey;
                }
                else {
                    // Create and validate new client
                    const newClient = await apiCommonController.clientsave(clientreferenceid, gid.toString());
                    if (newClient.STATUS === "ERROR") {
                        throw new Error(newClient.RESPONSE.text);
                    }
                }
            }

            // API variables configuration
            const URL = postappauthenticationurl;
            const Headers = {
                "content-type": "application/json",
                "Accept-Encoding": "*",
                "x-api-key": config.Mooncognito_X_Api_Key
            };
            const Data = {
                "authorizationdata": jsoncallback
            };

            // Update callback data to mooncognito
            await axios({
                url: URL,
                method: "post",
                data: Data,
                headers: Headers
            }).then(async (result) => {
                mooncognitoResponse = result.data[0];
                // Handle response safely and add logs
                if (config.Tour_Initialization_Logs === "ON") {
                    const resAPI = apiCommonController.createFullApiLog(URL, JSON.stringify(Data), result, " ");
                    apiCommonController.doLogs(resAPI, fName, fPath);
                }
            }).catch(async (err) => {
                // Handle error safely and add logs
                fName = `${fName}Error`;
                const resAPI = apiCommonController.createFullApiLog(URL, JSON.stringify(Data), " ", err);
                apiCommonController.doLogs(resAPI, fName, fPath);
            });

            // Insert or Update the data in the database
            await registrationSchema.updateOne(
                { appid: appid },
                {
                    $set: {
                        appid,
                        clientreferenceid,
                        inputrequest: request.body,
                        mooncognitoResponse: mooncognitoResponse,
                        guid: gid.toString(),
                        secretkey: jsoncallback.secretkey,
                        callbackurl: jsoncallback
                    }
                },
                { upsert: true }
            );

            response.send({
                appid,
                ui: {
                    secretkey: jsoncallback.secretkey,
                    callbackurl: jsoncallback
                }
            });
            let fileName = fName + "Success"
            createLogs("/Tour/initialization", fileName, fPath, request, {
                appid,
                ui: {
                    secretkey: jsoncallback.secretkey,
                    callbackurl: jsoncallback
                }
            })
        } catch (err) {
            console.log(err)
            // Handle error safely and add logs
            apiCommonController.getError(err, fName, fPath, request);
            response.send({
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": err.message
                }
            });
        }
    });

    app.post("/createtoken", async function (request, response) {
        let fPath = "/createtoken";
        let fName = "createtoken";
        const requestObj = request.body;
        try {
            const userid = requestObj.userid;
            let secretkey = requestObj.secretkey;
            secretkey = await apiCommonController.decrypt(secretkey, config.Encryption_Key);

            const headers = {
                'content-type': 'application/x-www-form-urlencoded',
                'user-agent': 'PostmanRuntime/7.29.0',
                accept: '*/*',
                'accept-encoding': 'gzip, deflate, br',
                connection: 'keep-alive',
                'content-length': '205',
                "Authorization": `Basic ${secretkey}`
            };
            request.headers = headers;

            const password = Math.floor((Math.random() * 10000) + 1);
            const newUser = await apiCommonController.Usersave(userid, password);
            if (newUser.STATUS === "ERROR") {
                throw new Error(newUser.RESPONSE.text);
            }

            request.body = {
                grant_type: 'password',
                username: userid,
                password
            };

            const Token = await apiCommonController.obtainToken(app, request, response);
            response.status(200).send(Token);
        } catch (err) {
            // Handle error safely and add logs
            apiCommonController.getError(err, fName, fPath, request);
            response.status(400).send({
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": err.message
                }
            });
        }
    });

    app.post("/refreshtoken", async function (request, response) {
        let fPath = "/Tour/refreshtoken";
        let fName = "refreshtoken";
        try {
            // Get refreshToken and secretKey from the request
            const refreshToken = request.body.refreshtoken;

            let secretKey = request.body.secretkey;
            // Decrypt secretkey
            secretKey = await apiCommonController.decrypt(secretKey, config.Encryption_Key);
            request.headers = {
                'content-type': 'application/x-www-form-urlencoded',
                'accept-encoding': 'gzip, deflate, br',
                'content-length': '205',
                "Authorization": `Basic ${secretKey}`
            };
            request.body = {
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            };

            // Get refreshed access and refresh token
            const Token = await apiCommonController.obtainToken(app, request, response);

            // Send refreshed Token object
            response.send(Token);
        } catch (err) {
            // Handle error safely and add logs
            apiCommonController.getError(err, fName, fPath, request);

            // Return Error message
            response.send({
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": err.message
                }
            });
        }
    });

};

async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}