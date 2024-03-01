"use strict";
const fs = require("fs");
const logDir = "./logs";
const md5 = require("md5");
const axios = require("axios");
const crypto = require("crypto");
const config = require("../Config");
const mongoose = require('mongoose');
const OAuth2Server = require("oauth2-server");
const moment = require('moment');
const Request = OAuth2Server.Request;
const Response = OAuth2Server.Response;
const userModel = require("../DAL/Mongo/Schemas/TourUser");
const tokenSchema = require("../DAL/Mongo/Schemas/TourToken");
const clientSchema = require("../DAL/Mongo/Schemas/TourClient");
const registrationSchema = require("../DAL/Mongo/Schemas/InitializationSchema");
const tourProviderSchema = require("../DAL/Mongo/Schemas/TourProvider");
const tourProviderDestination = require("../DAL/Mongo/Schemas/providerDestination");

const APICommonController = {

    // Through this function we will be fetching the clientId and oauthToken details from the token
    validateOauthToken: async function (app, request, response, next) {
        try {
            let token;
            const sessionObj = request.session.tokenValidation;
            if (request.body.configuration) {
                // Session validation
                if (!sessionObj) {
                    throw new Error("Session expired");
                }
                // Token Validation
                token = sessionObj.accessToken;
            } 
            else 
            {
                token = request.params.token;
            }
            
            if (typeof token !== "undefined") {
                // Set oauth token into header
                const headers = {
                    "Authorization": `Bearer ${token}`
                };
                request.headers = headers;
            }
            let tokenvalidation = await APICommonController.authenticateRequest(app, request, response, sessionObj);
            if (typeof tokenvalidation.tokenexpired !== "undefined") {
                let tokenValidationData = await setTokenValidation(tokenvalidation, request, token);
                if(tokenValidationData.status == "success"){
                    throw tokenValidationData.result;
                }else if(tokenValidationData.status == "fail"){
                    throw new Error(tokenValidationData.result);
                }
            }

            // Add clientId and oauthToken in request body
            request.body.clientId = tokenvalidation.client.id;
            request.body.oauthToken = token;
            next();
        } catch (err) {
            // Render errorpage
            response.render("views/errorpage", { errorMessage: "Token is not valid or Session has expired.", moonstrideURL: "", errorDescription: err.stack });
        }
    },
 
    validateConfigurationToken: async function (app, request, response) {
        try {
            // Token Validation
            const token = request.params.token;
            if (typeof token !== "undefined") {
                // Set oauth token into header
                const headers = {
                    "Authorization": `Bearer ${token}`
                };
                request.headers = headers;
            }
            let tokenvalidation = await APICommonController.authenticateRequest(app, request, response);
            if (typeof tokenvalidation.tokenexpired !== "undefined") {
                throw new Error(tokenvalidation.tokenexpired);
            }

            // Return tokenvalidation object
            return tokenvalidation;
        } catch (err) {
            // Return error message
            return err;
        }
    },

    refreshTokencall: async function (request, accesstoken, domainURL) {
        try {
            // Find token details
            const getTokenData = await tokenSchema.find({ accessToken: accesstoken });
            const getTokenObj = getTokenData[0];
            // Find secretkey based on clientId found from getTokenData object
            const clientSecretkey = await registrationSchema.find({ clientId: getTokenObj.client.id });
            // Variable configuration for refreshtoken API
            const refreshTokenUrl = `${domainURL}/refreshtoken`;
            const headers = {
                "content-type": "application/json",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive"
            };
            const refreshTokenRequest = {
                "secretkey": clientSecretkey[0].secretkey,
                "refreshtoken": getTokenObj.refreshToken
            }
            // Call refreshtoken API
            return await axios({
                url: refreshTokenUrl,
                method: 'post',
                headers: headers,
                data: refreshTokenRequest,
                timeout: 1000 * 30
            }).then(async (result) => {
                const tokenValidation = result.data;
                if (typeof tokenValidation.STATUS === "undefined") {
                    throw new Error(tokenValidation.tokenexpired);
                }
                request.session.tokenValidation = tokenValidation;
                return tokenValidation;
            }).catch(async (error) => {
                // Return error message
                return error;
            });
        } catch (err) {
            // Return error message
            return err;
        }

    },

    sessionFunction: async function (accessToken, tokenvalidation, request) {
        try {
            // Get clientReferenceId
            const clientreferenceid = tokenvalidation.client.id;
            // Find registration data based on clientReferenceId
            const tourRegistrationData = await registrationSchema.find({
                clientreferenceid: clientreferenceid
            });
            // If not found then throw error
            if (tourRegistrationData.length <= 0) {
                throw new Error("Client not found. Please ensure the provided information is correct and try again.");
            }

            // Update new data to that token
            const dt = new Date();
            dt.setMinutes(dt.getMinutes() - 30);
            const findData = { accessToken: accessToken };
            const myquery = {
                $set:
                {
                    accessTokenExpiresAt: dt
                }
            }
            await tokenSchema.updateMany(findData, myquery);

            // Get secretkey to new generate token
            const secretkey = tourRegistrationData[0].secretkey;
            // Get clientregion for client
            const clientRegion = tourRegistrationData[0].inputrequest.clientregion;
            // Get list of domains and parse it
            const domainList = JSON.parse(config.Domains);
            const domain = await APICommonController.createDomainURL(domainList, clientRegion);
            if (domain.STATUS === "ERROR") {
                throw new Error(domain.RESPONSE.text);
            }
            // Create token url
            const tokenUrl = `${domain}/createtoken`;
            const tokenreq = {
                "secretkey": secretkey,
                "userid": clientreferenceid
            };
            // Call createtoken API to create token
            return await axios({
                url: tokenUrl,
                method: 'POST',
                headers: {
                    "Accept-Encoding": "*",
                },
                data: tokenreq
            }).then(async (result) => {
                const resultObj = result.data;
                // Token response validation
                if (resultObj.STATUS === "ERROR") {
                    throw new Error(resultObj.RESPONSE.text);
                }

                // Store accesstoken into the session
                request.session.tokenValidation = resultObj;

                // Return Success message
                return {
                    STATUS: "OK",
                    RESPONSE: {
                        text: "Token generated successfully."
                    }
                };
            }).catch(async (error) => {
                // Return error message
                return error;
            });
        } catch (err) {
            // Return error message
            return err;
        }
    },

    validateProviderCode: async function (request, response, next) {
        let moonstrideURL;
        try {
            // Get providerCode from params
            const providerCode = request.params.providerCode?.toUpperCase();

            // Get and Validate provider data using providerCode
            const providerData = await APICommonController.getProviderData(providerCode);
            if (providerData instanceof Error) {
                throw providerData;
            }
            if (providerData.length < 0) {
                throw new Error("No data found or invalid URL. Please check the URL and try again, or contact support for assistance.");
            }

            // Add providerData to request body
            request.body.providerData = providerData[0];
            next();
        } catch (err) {
            // Render errorpage
            response.render("views/errorpage", { errorMessage: "Invalid Providercode or Sorry, no relevant data was found. Try again later.", moonstrideURL, errorDescription: err.stack });
        }
    },

    checkInitializationRequest: function (appid, appname, postappauthenticationurl, clientreferenceid, domainurl) {
        try {
            if (appid === undefined || appid === null || appid === "") {
                throw new Error("AppId  not found. Please check your information and try again.");
            }
            if (appname === undefined || appname === null || appname === "") {
                throw new Error("App name  not found. Please check your information and try again.");
            }
            if (postappauthenticationurl === undefined || postappauthenticationurl === null || postappauthenticationurl === "") {
                throw new Error("postappauthenticationurl not found. Please check your information and try again.");
            }
            if (clientreferenceid === undefined || clientreferenceid === null || clientreferenceid === "") {
                throw new Error("clientreferenceid not found. Please check your information and try again.");
            }
            if (domainurl === undefined || domainurl === null || domainurl === "") {
                throw new Error("domainurl not found. Please check your information and try again.");
            }
            return "none";
        } catch (err) {
            // Return error message
            return err;
        }
    },

    pingStatus: async function (app, request, response) {
        let fName = "pingStatus";
        let methodName = "/ping";
        let APP_DB = {}; // For storing DB status
        let pingStatus = {};
        let data;
        let flagFinalStatus = true;
        try {
            //Check for MongoDB 
            const mongodata = JSON.parse(config.Mongo_URL);
            const url = this.databaseDecrypt(mongodata.url, mongodata.decKey);
            await mongoose.connect(url, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            }).then(() => {
                APP_DB["mongodb"] = { status: true, message: "Connected" };
            }).catch((error) => {
                flagFinalStatus = false;
                APP_DB["mongodb"] = { status: false, message: "Not Connected", error: { code: 123, message: error } };
                // Handle error safely and add logs
                this.getError(error, fName, methodName, " ");
            });

            //Check for MSSQL
            let tokenValidation = await this.authenticateRequest(app, request, response);
            //Check for the token is valid or not
            if (tokenValidation.tokenexpired !== undefined) {
                flagFinalStatus = false;
                APP_DB["mssql"] = { status: false, message: "Fail", error: "Token expired." };
                data = { APP_DB };
                pingStatus = {
                    status: false, message: "Failed", data
                }
                return pingStatus;
            } else {
                const clientId = tokenValidation.client.id;
                // Get client credentials and check for the database status
                let userDetails = await registrationSchema.find({ clientreferenceid: clientId });
                let dbKey = userDetails[0].inputrequest.dbkey;
                let dburl = userDetails[0].inputrequest.dburl;

                // API call to get the database credentials
                await axios({
                    url: dburl,
                    method: "POST",
                    data: { dbkey: dbKey, dbtype: "mssql" }
                }).then(async (responseAPI) => {
                    if (responseAPI.data.APIError === undefined) {
                        APP_DB["mssql"] = { status: true, message: "Connected" };
                    }
                    else {
                        flagFinalStatus = false;
                        APP_DB["mssql"] = { status: false, message: "Not Connected", error: { code: 123, message: responseAPI.data.APIError } };
                    }
                }).catch((error) => {
                    // Handle error safely and add logs
                    fName = `${fName}Error`;
                    flagFinalStatus = false;
                    APP_DB["mssql"] = { status: false, message: "Not Connected", error: { code: 123, message: error } };
                    const resAPI = APICommonController.createFullApiLog(dburl, dbKey, " ", error);
                    APICommonController.doLogs(resAPI, fName, methodName);
                });
            }

            data = { APP_DB };
            if (flagFinalStatus === true) {
                pingStatus = { status: true, message: "Successful", data }
            } else {
                pingStatus = {
                    status: false, message: "Failed", data
                }
            }
            return pingStatus;
        } catch (err) {
            pingStatus = {
                status: false, message: "Failed", data: err
            }
            // Handle error safely and add logs
            this.getError(err, fName, methodName, " ");
            return pingStatus;
        }
    },

    createDomainURL: async function (domainList, appRegion) {
        try {
            let domain;
            switch (appRegion) {
                case "UK":
                    domain = domainList[appRegion];
                    break;
                case "US":
                    domain = domainList[appRegion];
                    break;
                default:
                    domain = domainList["default"];
            }
            return domain;
        } catch (err) {
            return err;
        }
    },

    createConfigurationURL: async function (providerName, configurationurl) {
        try {
            switch (providerName.toUpperCase()) {
                case "VIATOR":
                    configurationurl = `${configurationurl}/${config.Provider_Code_VTR}`;
                    break;
                case "1WAY2ITALY":
                    configurationurl = `${configurationurl}/${config.Provider_Code_OWT}`;
                    break;
                default:
                    throw new Error(`${providerName} is not registered Tour Service.`);
            }
            return configurationurl;
        } catch (err) {
            return err;
        }
    },

    getMsDomainUrl: async function (clientId, providerName) {
        let fName = "getMsDomainUrl";
        let methodName = `/${clientId}/Tour/${providerName}`;
        try {
            // Find authorization data
            const findData = await registrationSchema.find({ clientreferenceid: clientId });
            let domainUrl;
            if (findData.length > 0) {
                domainUrl = findData[0]?.mooncognitoResponse?.authorizationdata?.moonstrideurl;
            } else {
                throw new Error("Sorry, no relevant data was found. Try again later.");
            }
            return domainUrl;
        } catch (err) {
            // Handle error safely and add logs
            this.getError(err, fName, methodName, " ");
        }
    },

    getMsRegion: async function (clientId) {
        try {
            // Find authorization data
            const findData = await registrationSchema.find({ clientreferenceid: clientId });
            let region;
            if (findData.length > 0) {
                region = findData[0].inputrequest.authorizationdata.clientregion;
            } else {
                throw new Error("Sorry, no relevant data was found. Try again later.");
            }
            return region?.toUpperCase();
        } catch (err) {
            return null;
        }
    },

    providerDetail: async function (appid, Provider) {
        let fName = "ProviderDetail";
        let methodName = `/${appid}/Tour/Viator/Search`;
        try {
            const providerDetail = await tourProviderSchema(appid).find();
            let envVar = providerDetail.map(item => item).filter(result => (result.appid == appid))[0][Provider];
            // Check if the provider is active or not
            if (envVar?.isactive) {
                // Decrypt Viator data
                if(providerDetail[0].MoonstrideConfiguration != null){
                    if (Provider == "Viator") {
                        envVar.MoonstrideConfiguration = providerDetail[0].MoonstrideConfiguration;
                        
                        let apiKey = await setApiKey(envVar);
                        envVar = apiKey
                    }
                    else if(Provider == "OneWay2Italy"){
                        let Requestor_ID = envVar.Requestor_ID;
                        let Password = envVar.Password;
                        let decrypted_requestorId = await this.decrypt(Requestor_ID, config.Database_Salt_Key);
                        let decrypted_password = await this.decrypt(Password, config.Database_Salt_Key);
                        envVar.MoonstrideConfiguration = providerDetail[0].MoonstrideConfiguration;

                        envVar.Requestor_ID = Requestor_ID;
                        envVar.Password = Password;
                        
                        if (typeof decrypted_requestorId == "string" && typeof decrypted_password == "string") {
                            envVar.Requestor_ID = decrypted_requestorId;
                            envVar.Password = decrypted_password;
                        }                            
                    }
                } else {
                    throw Error("Configuration not found. Please verify your settings or contact support for assistance.")
                }
                return envVar;
            } else {
                return [];
            }
        } catch (err) {
            console.log(err);
            // Handle error safely and add logs
            this.getError(err, fName, methodName, " ");
            return err
        }

    },

    getProviderData: async function (providerCode) {
        try {
            const providerArray = [
                {
                    providerCode: config.Provider_Code_VTR,
                    providerName: "Viator",
                    providerURL: config.Viator_Site_URL
                },
                {
                    providerCode: "OWT",
                    providerName: "1way2italy",
                    providerURL: config.OneWay2italy_Site_URL
                }
            ];
            // Filter to get providerCode wise details
            const matchedProvider = providerArray.filter(checkProvider => checkProvider.providerCode === providerCode);

            // Return provider data
            return matchedProvider;
        } catch (err) {
            return err;
        }
    },

    checkappkeyexist: async function (clientId, providerCode) {
        try {
            let finddata;
            switch(providerCode.toUpperCase()){
                case config.Provider_Code_VTR:
                    // Find providerdata
                    finddata = await tourProviderSchema(clientId).find({ appid: clientId });
                    if (finddata.length > 0 && finddata[0]?.Viator) {
                        let findProviderData = await setVTRProviderDetails(finddata);
                        finddata = findProviderData;
                    }                    
                    break;
                case config.Provider_Code_OWT:
                    // Find providerdata
                    finddata = await tourProviderSchema(clientId).find({ appid: clientId });
                    if (finddata.length > 0 && finddata[0]?.OneWay2Italy) {
                        let findProviderData = await setOWTProviderDetails(finddata);
                        finddata = findProviderData;                        
                    }
                    break;
                default:
                    break;
            }            
            // Return provider data
            return finddata;
        } catch (err) {
            return err;
        }
    },

    databaseDecrypt: function (encryptString, clientName) {
        try {
            // Initialise separator, make sure this separator must be used on encryption time
            let strSeparator = "l1I";
            // Initialise limit of characters that we will take from encrypted clientname
            let limit = 10;
            // Initialise empty decrypt string
            let decryptString = "";

            // Var strKey = md5($_REQUEST['txtClientName']).substr(0, 20);
            let strKey = md5(clientName).substr(0, 20);
            // Get enctrypted client name
            let encryptClientName = strKey;

            // Fetching embededstring that we have to replace from passed encrypted string from second postition of separator
            if ((clientName.length) > limit) {
                limit = Math.floor((clientName.length) / 2);
            }
            let embedString = encryptClientName.substr(0, limit);

            // Convert into array by exploding defined separator
            let arrEncryptInfo = encryptString.split(strSeparator);

            Object.entries(arrEncryptInfo).forEach(async entry => {
                let [key, decVal] = entry;

                // If position of separator is second then remove embededstring from decVal
                if (key == 2) {
                    decVal = decVal.replace(embedString, '');
                }

                switch (decVal.length) {
                    // If length is 1 that means it not ecrypted so check for uppercase/lowercase and do as per it.
                    case 1:
                        if (decVal.charCodeAt(0) >= 65 && decVal.charCodeAt(0) <= 90) {
                            decVal = decVal.toLowerCase();
                        }
                        else if (decVal.charCodeAt(0) >= 97 && decVal.charCodeAt(0) <= 122) {
                            decVal = decVal.toUpperCase();
                        }                        
                        decryptString = decryptString.concat(decVal);
                        break;

                    // ParseInt(string, radix); if length is 2 that means it ecrypted so convert into decimal first and then original character.
                    case 2:
                        decryptString = decryptString.concat(String.fromCharCode(parseInt(decVal, 16)))
                        break;

                    // If length is 3 that means it ecrypted + not encrypted value so convert into decimal first and then original character for first two characters and do same as done in case 1 for 3rd character.
                    case 3:
                        let hexCode = decVal.substr(0, 2);
                        decryptString = decryptString.concat(String.fromCharCode(parseInt(hexCode, 16)))
                        decVal = decVal.replace(hexCode, "");
                        let decValAsThree = setDecValAsThree(decVal)
                        decVal = decValAsThree
                        decryptString = decryptString.concat(decVal);
                        break;
                    default:
                        break;
                }
            });
            decryptString = decryptString.split('').reverse().join('');
            return decryptString;
        } catch (err) {
            console.log(err);
        }
    },

    encrypt: function (message, Key) {
        try {
           
            const key = crypto.scryptSync(Key, 'salt', 24); //Create key
            const iv = Buffer.alloc(16, 0);
            // Generate different ciphertext everytime
            const cipher = crypto.createCipheriv(config.Enc_Algorithm, key, iv);
            let encrypted = cipher.update(message, 'utf8', 'hex') + cipher.final('hex'); // Encrypted text
            //Deciphered textconsole.log(decrypted);
            return encrypted;
        }
        catch (err) {
            console.log({ APIError: err });
        }
    },

    decrypt: async function (message, Key) {
        try {
           
            const key = crypto.scryptSync(Key, 'salt', 24);
            const iv = Buffer.alloc(16, 0);
            const decipher = crypto.createDecipheriv(config.Enc_Algorithm, key, iv);
            let decrypted = decipher.update(message, 'hex', 'utf8') + decipher.final('utf8');

            return decrypted;
        }
        catch (err) {
            console.log(err);
            return ({ APIError: err });
        }
    },

    base64encoding: function (message) {
        return (Buffer.from(message).toString('base64'));
    },

    base64decoding: function (message) {
        return (Buffer.from(message, 'base64').toString('ascii'))
    },

    authenticateRequest: async function (app, req, res) {
        try {
            // Create new request and response object
            const request = new Request(req);
            const response = new Response(res);

            // Call authenticate method to authenticate token
            return await app.oauth.authenticate(request, response)
                .then(function (token) {
                    return token;
                }).catch(function (err) {
                    return ({ tokenexpired: err });
                });
        } catch (err) {
            return ({ tokenexpired: err.message });
        }
    },

    obtainToken: function (app, req, res) {
        try {
            // Create new request and response object
            const request = new Request(req);
            const response = new Response(res);

            // Call token method to create token data
            return app.oauth.token(request, response)
                .then(function (token) {
                    return token;
                }).catch(function (err) {
                    throw err;
                });
        } catch (err) {
            return {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": err.message
                }
            };
        }
    },

    Usersave: async function (userid, password) {
        try {
            // Create User
            const user = new userModel({
                userid: userid,
                password: password
            });
            await user.save();

            return {
                "STATUS": "OK",
                "RESPONSE": {
                    "text": "User created successfully."
                }
            };
        } catch (err) {
            return {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": err.message
                }
            };
        }
    },

    clientsave: async function (clientid, clientsecret) {
        try {
            // Create Client
            const clientData = new clientSchema({
                id: clientid,
                clientId: clientid,
                clientSecret: clientsecret,
                grants: [
                    'password',
                    'refresh_token',
                    'client_credentials'
                ],
                redirectUris: []
            });
            await clientData.save();

            return {
                "STATUS": "OK",
                "RESPONSE": {
                    "text": "Client created successfully."
                }
            };
        } catch (err) {
            return {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": err.message
                }
            };
        }
    },

    // If not contains http then add it. Mainly for local.
    urlHTTP: function (url) {
        if (url.toLowerCase().indexOf('http') === -1) {
            url = 'http://' + url;
        }
        return url.replace('|', ':');
    },

    // Get Error Common Node for any of raised exception or error with current date and also do logs file base
    getError: async function (err, filename, methodName, request) {
        try {
            let fileName = filename + "Error";
            let strErr = "";

            // Handle error safely and add logs
            if (typeof err == 'object') {
                if (JSON.stringify(err) !== "{}") {
                    err = JSON.stringify(err);
                }
            }
            let errorMsg = await setErrorMsg(err, strErr);
            strErr = errorMsg

            let dt = new Date();
            let resAPI = APICommonController.createFullApiLog(" ", request, " ", strErr);

            APICommonController.doLogs(resAPI, fileName, methodName);

            //logger(fileName,methodName).error('Error: ', err )
            if (typeof err.message !== 'undefined' && err.message !== null) {
                return { date: [dt.toString()], APIError: [err.stack || err] };
            }
            else if (typeof err.stack !== 'undefined' && err.stack !== null) {
                return { date: [dt.toString()], APIError: [err.stack || err] };
            }
            else {
                return { date: [dt.toString()], APIError: [err] };
            }
        }
        catch (err1) {
            console.log(err1);
        }
    },

    // To combine logs of API request and response
    createFullApiLog: function (url, request, response, err) {
        try {
            if (typeof request.body !== 'undefined' && request.body !== null) {
                if (!request.body || typeof request.body === 'object') {
                    request = JSON.stringify(request.body);
                }
            }

            if (typeof response !== 'undefined' && response !== null) {
                if (!response || typeof response === 'object' && response.data) {
                    response = JSON.stringify(response.data);
                }
                else{
                    response = JSON.stringify(response);
                }
            }

            if (typeof err === 'object') {
                err = JSON.stringify(err);
            }

            let logs = "URL : " + url + '\r\n';
            logs = logs + '\r\n' + "Request : " + request + '\r\n';
            logs = logs + '\r\n' + "Response : " + response + '\r\n';
            logs = logs + '\r\n' + "Error : " + err + '\r\n';
            return logs;
        }
        catch (err1) {
            console.log(err1);
        }
    },

    // To combine logs of API request and response
    doLogs: function (logString, fileName, methodName) {
        try {
            let fPath = `${logDir}/${this.currnetDatetimestamp(true)}/${methodName}`;
            if (!fs.existsSync(fPath)) {
                fs.mkdirSync(fPath, { recursive: true });
            }
            let curDateTime = this.currnetDatetimestamp();
            fileName = fileName.toString() + "_" + curDateTime;
            fPath = fPath + `/${fileName}.txt`
            logString = '\r\n---' + ` ${curDateTime}${'\r\n'} ${logString.stack || logString}`
            fs.appendFile(fPath, logString, (err1) => {
                if (err1) throw err1;
            });
        } catch (err) {
            console.log('APIError:', err);
        }
    },

    currnetDatetimestamp: function (isOnlyDate) {
        let today = new Date();
        let year = today.getFullYear();
        let month = today.getMonth() + 1;      // "+ 1" becouse the 1st month is 0
        let day = today.getDate();
        let hour = today.getHours();
        let minutes = today.getMinutes();
        let secconds = today.getSeconds();
        let ms = today.getMilliseconds();
        if (isOnlyDate === true) {
            return day + '_' + month + '_' + year;
        }
        return day + '_' + month + '_' + year + ' - ' + hour + '_' + minutes + '_' + secconds + '_' + ms;
    },

    // Find provider details using client id
    findProviderDetails: async function(request, response, clientId){
        const fName = "TourFindProviderDetails";
        const fPath = `/${clientId}/Tour/findProviderDetails`;
        try{
            let providers = await tourProviderSchema(clientId).find({ appid: clientId });
            if(providers.length != 0 && providers.length > 0 ){
                let providersArr = [];
                let providerData = await setProviderData(providers, providersArr)
                providersArr = providerData
                let currenctProvider = providerData[0];
                let providerConfig;
                if(currenctProvider == config.Provider_Code_VTR){
                    providerConfig = providers[0]?.Viator;
                }else{
                    providerConfig = providers[0]?.OneWay2Italy;
                }
                let screenConfig = await screenConfigDetailsSetting(providerConfig);                
                if(providersArr.length != 0){
                    return ({                        
                        "providers" : providersArr,
                        "screenConfig" : screenConfig
                    });
                }
                else{
                    throw new Error("Sorry, no providers found. Please refine your search criteria or contact support for assistance.")
                }
            }
            else{
                throw new Error("Sorry, no providers found. Please refine your search criteria or contact support for assistance.")
            }
        }
        catch (err) {
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }

    },

    // Get provider destination data
    getProviderDestinations: async function(provider, country){

        try{
            let destinationData = await tourProviderDestination(provider).find({}, { _id: 0 });
            if(destinationData.length > 0){
                return destinationData;
            }
            else{
                return [];
            }
        }
        catch(error){
            return err;
        }
    },

    // Create api access token using domain url
    getApiAccessToken: async function(request, response, domainUrl)
    {
        const fName = "getAccessToken";
        const fPath = `/Tour/getAccessToken`;
        try
        {
            // Get seceret key from db using domain url.
            let initializationDetails = await registrationSchema.find({ "inputrequest.domainurl": domainUrl });
            if(initializationDetails.length != 0)
            {
                let secrteKey = initializationDetails[0].secretkey;
                
                // Token for moonstride tourengine
                let clientId = initializationDetails[0].clientreferenceid;
                // Find provider data 
                let availableProviders = await this.findProviderDetails(request, response, clientId);
                                
                // Adding user id as clientrefid.
                let requestObj = {
                    "userid" : initializationDetails[0].clientreferenceid,
                    "secretkey": secrteKey
                }
                
                // URL configuration for API call
                let URL = await this.urlHTTP(
                    `${config.Tour_EndPoint}/createtoken`
                );
                // Making a request and get response from token creation. 
                let TokenResponse = await axios.post(URL, requestObj, { 
                    headers: {
                        "Accept-Encoding": "gzip, deflate, br"
                    }    
                })
                if(TokenResponse.data){
                    TokenResponse.data.clientId = clientId;
                    TokenResponse.data.availableProviders = availableProviders;
                    return(TokenResponse.data);
                }
                else{
                    throw new Error("Token creation failed. Please check your information and try again, or contact support for assistance.")
                }                    
            }
            else{
               throw new Error("No initialization data found for the domain.")
            }
        }
        catch(error){
            this.getError(error, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: error.message
                }
            });
        }
    },

    // Get moonstride access token
    getMsAccessToken: async function(request, response, clientId, flag, userGuid){
        const fName = "TourFindProviderDetails";
        const fPath = `/${clientId}/Tour/findProviderDetails`;

        try {
            let msAccessToken = {};
            
            let providers = await tourProviderSchema(clientId).find({ appid: clientId });
        
            if(providers && providers.length != 0){
                if(providers[0]?.MoonstrideConfiguration){
                    // Extract moonstride configuration from db.
                    let moonstrideConfig = providers[0]?.MoonstrideConfiguration;
                    // Get token creation url.
                    let tokenurl = moonstrideConfig?.Access_token_URL;
                    // Request body.
                    let reqBody = {
                        
                        "secretkey": moonstrideConfig?.Client_secret,
                        "userid" : moonstrideConfig?.UserId
                        
                    }
                    // Process request.
                    let moonstrideAccessToken = await axios.post(tokenurl, reqBody, { 
                        headers: {
                            "Content-Type" : "application/json"
                        }
                    })
                    if(moonstrideAccessToken != undefined && moonstrideAccessToken.data != undefined){                                                               
                        msAccessToken = moonstrideAccessToken.data;                   
                        
                        msAccessToken.searchLogsUrl = moonstrideConfig?.Search_logs_EndPoint ?? "";    
                    }
                }
                else{
                    msAccessToken = {
                        "status": false,
                        "message" : "Moonstride configuration not found."
                    }
                }
                
            }
                        
            return msAccessToken;
        }
        catch (error) {
            // Add error log
            console.log(error);
            this.getError(error, fName, fPath, request);

            // Send Error response
            // response.status(400).send({
            //     STATUS: "ERROR",
            //     RESPONSE: {
            //         text: error.message
            //     }
            // });
        }
    },

    // Send booking request to moonstride.
    sendAddBookingRequest: async function(request, response, clientId, finalResponse, cartData, url){

        let fName = "Add_Booking_ApiResponse_";
        let fPath = `/${clientId}/Add_Booking/ApiResponse`;

        try{
            let allResponses = [];
            let promises = [];
            
            // taking ms token from token generation request using search logs response userGuid. 
            let accessToken = await this.getMsAccessToken(request, response, clientId, true, cartData[0].userGuid);

            if(!accessToken || accessToken?.response?.accessToken == undefined){
                throw new Error("Moonstride access token not found.")
            }
            // Headers for moonstride services
            let headers = {
                'token': `${accessToken.response.accessToken}`,
                //"clientid" : `${cartData[0].clientId}`,
                'Content-Type': 'application/json'
            };
            // Checking if the previousbookingcomponentguid is present then only delete the booking.
            if(request?.body?.previousbookingcomponentguid && request?.body?.previousbookingcomponentguid !== ""){
                let bookingGuid = finalResponse[0]?.Result?.Booking?.BookingId;
                let previousbookingcomponentguid = request?.body?.previousbookingcomponentguid;
                let deleteBookingObject = {
                    "BookingId": `${bookingGuid}`,
                    "Services": [
                        {
                            "ServiceId": previousbookingcomponentguid,
                            "ServiceCategory": {
                                "Code": config.DeleteBookingServiceCategoryCode
                            }
                        }
                    ]
                }
                
                let requestParameters = {
                    deleteBookingObject,
                    bookingGuid,
                    previousbookingcomponentguid,
                    url,
                    headers,
                    clientId}
                let deleteExistingBookingApiResponse = await this.deleteExistingBookingFromMoonstride(requestParameters);
                // Checking if the deleteing is successfull or not.
                if(deleteExistingBookingApiResponse == undefined || deleteExistingBookingApiResponse?.STATUS == "ERROR"){
                    throw new Error("A booking already exists, and we are unable to delete the previous booking.");
                }
            }
            // Some times have more than one cart data.
            for(let finalResponseData of finalResponse){
                // Moonstride booking service url.
                let promise = axios.post(url, finalResponseData.Result, { headers })
                
                .then(responseData => {
                    allResponses.push(responseData.data);                    
                })
                .catch(error => {          
                    console.log(error?.response?.data);
                    console.log("The 'Add Booking' endpoint is not accepting data. Please ensure that the provided information is correct and try again");           
                    throw Error(error?.response?.data?.Error ?? error.response?.data.APIError ?? error.message ?? error.cause);
                });

                promises.push(promise);                                                            
            }
            Promise.all(promises)
                .then(() => {
                    let resultObj = {
                        "status" : true,     
                        "Booking" : allResponses[0]?.Booking ?? []
                    }          
                    fName += "Success";
                    let createLogs = this.createFullApiLog(url, JSON.stringify(finalResponse), resultObj, "");
                    this.doLogs(createLogs, fName, fPath);
                    response.status(200).send({"response" : resultObj});
                })
                .catch(error => {
                    //console.log(error);
                    console.log("Moonstride is currently not accepting add booking data. Please try again later.");                    
                    const errMessage = {
                        "STATUS": "ERROR",
                        "RESPONSE": {
                            "text": error?.response?.data?.Error ?? error?.response?.data?.RESPONSE?.text ?? error.message,
                            "Additional_Message" : "Unable to post data to the API. Please check your connection or verify the API endpoint and try again"
                        }
                    };
                    let createLogs = this.createFullApiLog(url, JSON.stringify(finalResponse), errMessage, "");
                    this.doLogs(createLogs, fName, fPath);

                    // Send Error response
                    response.status(400).send(errMessage);
                    
                });
        }
        catch (error) {        
            //console.log(error);
            // Add error log
            this.getError(error, fName, fPath, request);
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };

            // Send Error response
            response.status(400).send(errMessage);
        }
    },

    // Delete existing booking from moonstride if only search again is available
    deleteExistingBookingFromMoonstride : async function({deleteBookingObject,
        bookingGuid,
        previousbookingcomponentguid,
        url,
        headers,
        clientId}
        ){
        let fName = "Delete_Booking_ApiResponse_";
        let fPath = `/${clientId}/Delete_Booking/ApiResponse`;
        try {
            let finalResponse;
            let axiosRequest = {
                method: 'delete',
                maxBodyLength: Infinity,
                url: url,
                headers: headers,
                data : JSON.stringify(deleteBookingObject)
            }
            //Delete moonstride booking.
            await axios.request(axiosRequest)
            .then(response => {
                console.log(response?.data);
                if(response?.data?.ServicesSuccessfullyRemoved?.length != 0){
                    let removedBookingIdArray = response?.data?.ServicesSuccessfullyRemoved;
                    let dataRemoved = removedBookingIdArray.map((item) => {
                        if(item == previousbookingcomponentguid){
                            return(item)
                        }                        
                    })
                    finalResponse = dataRemoved;
                    fName += "Success";
                }  
                else{
                    fName += "Error";
                    const errMessage = {
                        "STATUS": "ERROR",
                        "RESPONSE": {
                            "text": "Service not removed."
                        }
                    };
                    finalResponse = errMessage;                    
                }              
                
                let createLogs = this.createFullApiLog(url, JSON.stringify(deleteBookingObject), response, "");
                this.doLogs(createLogs, fName, fPath);
            })
            .catch(error => {
                console.log(error);                   
                const errMessage = {
                    "STATUS": "ERROR",
                    "RESPONSE": {
                        "text": error?.response?.data?.RESPONSE?.text ?? error.message,
                        "Additional_Message" : "Unable to delete the previous booking."
                    }
                };
                fName += "Error"
                let createLogs = this.createFullApiLog(url, JSON.stringify(deleteBookingObject), error?.response?.data ?? errMessage, "");
                this.doLogs(createLogs, fName, fPath);
                finalResponse = errMessage;
            });
            return finalResponse;
            
        } catch (error) {
            console.log(error);   
            // Add error log
            this.getError(error, fName, fPath, JSON.stringify(deleteBookingObject));
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };

            // Send Error response
            return errMessage;
        }
    },

    // send confirm booking response to moostride
    sendBookingResponseToMoonstride : async function(clientId, url, data, providerDetails, response, request){
        let fName = "Save_ConfirmBooking_ApiResponse_";
        let fPath = `/${clientId}/Save_Confirm_Booking`;

        try {
            // get request object from config file
            let responseData = config.SaveConfirmBookingRequestObject;
            // adding data to request object
            responseData.BookingComponentId = request.body?.bookingComponentId ?? ""; 
            responseData.ServiceStatus = data?.Result?.status;
            
            responseData.ConfirmationNumber = data?.Result?.booking_Reference ?? "";
            responseData.Note = data?.Result?.cancellationPolicy?.description ?? "";
            // taking current date and time 
            let currentDateTime = moment();
            // formating date to "2021-01-01 08:30:00.000" format.
            responseData.Date = currentDateTime.format('YYYY-MM-DD HH:mm:ss.SSS');

            let accessToken = "";
            if(!request?.body?.msToken && request?.body?.msToken == ""){
                // taking ms token from token generation request using search logs response userGuid. 
                accessToken = await this.getMsAccessToken(request, data, clientId, true, "");

                if(!accessToken || accessToken?.response?.accessToken == undefined){
                    throw new Error("Moonstride access token not found.")
                }
            }
            else{
                accessToken = request?.body?.msToken;
            }
            
            // Headers for moonstride services
            let headers = {
                'token': accessToken,
                'Content-Type': 'application/json'
            };
            let responseObject = {
                "providerData" : data
            } 
            // send data to moonstride
            const finalResponse = await axios.post(url, responseData, { headers });
            if(finalResponse){
                console.log(finalResponse?.data);
                responseObject.moonstrideResponse = finalResponse?.data
                fName += "Success";
                let createLogs = this.createFullApiLog(url, JSON.stringify(responseData), responseObject, "");
                this.doLogs(createLogs, fName, fPath);
                return (responseObject);                
            } else{
                console.log(finalResponse);
                throw new Error("Unable to save response data to moonstride");
            }
        } catch (error) {
            console.log(error);
            this.getError(error, fName, fPath, request);
            const errMessage = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error?.response?.data?.RESPONSE?.text ?? error.message
                }
            };

            // Send Error response
            response.status(400).send(errMessage);
        }
    },

    // Booking viator cancel reason or confirm cancel url define function.
    createViatorRequestUrlForCancel: async function(request, clientId, cancelProcess, response){
        const fName = "TourCancelUrlFinder";
        const fPath = `/${clientId}/Tour/Route/CancelUrlFinder`;
        try {
            let URL;
            if(cancelProcess == "Q"){
                // URL configuration for API call
                URL = this.urlHTTP(
                    `${config.Tour_Viator_Book_cancel_EndPoint}/${clientId}/Tour/Viator/bookingCancelReasons`
                );
                
            }
            else if(cancelProcess == "C"){
                // URL configuration for API call
                URL = this.urlHTTP(
                    `${config.Tour_Viator_Book_cancel_EndPoint}/${clientId}/Tour/Viator/bookingConfirmCancel`
                );                
            }
            return URL;
        }
        catch (error) {
            console.log(err);
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },

    // Booking 1way2italy cancel reason or confirm cancel url define function.
    create1way2italtRequestUrlForCancel: async function(request, clientId, cancelProcess, response){
        const fName = "TourCancelUrlFinder";
        const fPath = `/${clientId}/Tour/Route/CancelUrlFinder`;
        try {
            let URL;
            if(cancelProcess == "Q"){
                // URL configuration for API call
                URL = this.urlHTTP(
                    `${config.Tour_1way2italy_cancel_Booking_EndPoint}/${clientId}/Tour/1way2italy/bookingCancelReasons`
                );                
            }
            else if(cancelProcess == "C"){
                // URL configuration for API call
                URL = this.urlHTTP(
                    `${config.Tour_1way2italy_cancel_Booking_EndPoint}/${clientId}/Tour/1way2italy/bookingConfirmCancel`
                );                
            }
            return URL;
            
        }
        catch (error) {
            console.log(err);
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },

    // Viator search request validation
    viatorSearchReqValidator: async function (request, response, next) {
        const clientId = request.params.id;
        const fName = "TourViatorSearch";
        const fPath = `/${clientId}/Tour/Viator/Search`;
        try {
            const requestObj = request.body;
            // This if is checking the search term
            if (!requestObj.searchDestinationId) {
                throw new Error("Search term is required, or search destination ID is missing. Please provide a valid search term or destination ID to proceed.");
            }

            // This if is checking the Start date
            if (!requestObj.startDate) {
                throw new Error("Please select the trip starting date. Ensure you choose a valid date to proceed.");
            }

            // This if is checking Trip end date
            if (!requestObj.endDate) {
                throw new Error("Please select the trip ending date. Ensure you choose a valid date to proceed.");
            }

            // Regex for validate date. It will accept YYYY-MM-DD and YYYY/MM/DD
            const dateRex = new RegExp(/^\d{4}([-\/])\d{2}\1\d{2}$/);           

            // Checking the page count
            if(!requestObj.page){
                throw new Error("Please specify the starting page. Ensure you provide a valid page number to proceed.. Ensure you provide a valid page number to proceed.");
            }
            if(requestObj.page < 1){
                throw new Error("Page number should not be less than 1. Please enter a valid page number.");
            }
            // Checking the currency is valid
            if(!requestObj.currency || requestObj.currency == ""){
                throw new Error("Currency is required. Please select a valid currency for your transaction.");
            }
            
            if(requestObj.currency != ""){                
                let acceptableCurrency = config.viator_Available_Currency;
                if(!acceptableCurrency.includes(requestObj.currency)){
                    throw new Error("The given currency doesn't match any currency on the available currency list. Please provide a valid currency or refer to the supported currency list.")
                }
            }
            
            let currentDate = moment().format('YYYY-MM-DD');
            // This if is checking whether the start date is this two format YYYY-MM-DD and YYYY/MM/DD with the help of regex
            let checkDate = await setCheckDate(dateRex, requestObj, currentDate);
            if(checkDate != ""){
                throw new Error(checkDate);
            }
            if(requestObj.msToken == undefined || requestObj.msToken == ""){
                let error = "Please provide a valid MS Token. Ensure that the token is correct and try again.";
                throw new Error(error);
            }            

            next();
        } catch (err) {
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },

    // 1way2italy search validation
    OneWay2ItalySearchReqValidator: async function(request, response, next){
        const clientId = request.params.id;
        const fName = "Tour1way2italySearchValidation";
        const fPath = `/${clientId}/Tour/1way2italy/SearchValidation`;

        try{
            // Request object. 
            const requestObj = request.body;

            // Validate for searchDestinationId
            let searchValidation = await setSearchValidation(requestObj);
            if(searchValidation != ""){
                throw new Error(searchValidation)
            }

            // Date format validation
            const dateRex = new RegExp(/^\d{4}([-\/])\d{2}\1\d{2}$/);
            let currentDate = moment().format('YYYY-MM-DD');

            if (dateRex.test(requestObj.startDate)) {
                // Convert start_date to YYYY-MM-DD format
                requestObj.startDate = requestObj.startDate.replace(/\//g, "-");

                // This if is checking whether the END date is this two format YYYY-MM-DD and YYYY/MM/DD with the help of regex
                if (dateRex.test(requestObj.endDate)) {
                    // Convert end_date to YYYY-MM-DD format
                    requestObj.endDate = requestObj.endDate.replace(/\//g, "-");

                    // This if is checking whether the end date is not earlier than the start date
                    if (requestObj.endDate < requestObj.startDate) {
                        throw new Error("The end date cannot be earlier than the start date. Please ensure the dates are entered correctly.");
                    }
                    if(requestObj.startDate < currentDate){
                        throw new Error("Start Date cannot be earlier than the current date. Please select a valid Start Date");
                    }
                } else {
                    throw new Error("End date is not in the correct format. The expected format is YYYY-MM-DD. Please ensure the date is entered correctly.");
                }
            }
            else {
                throw new Error("Start date is not in the correct format. The expected format is YYYY-MM-DD. Please ensure the date is entered correctly.");
            }
            if(requestObj.msToken == undefined || requestObj.msToken == ""){                
                throw new Error("Please provide a valid MS Token. Ensure that the token is correct and try again.");
            }            

            next();
        }
        catch(error){
             // Add error log
            this.getError(error, fName, fPath, request);

             // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: error.message
                }
            });
        }
    },

    // Viator search product details validations
    viatorSearchProductDetails : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "TourViatorDetails";
        const fPath = `/${clientId}/Tour/Viator/Details`;
        try {
            const requestObj = request.body;
            // Checking details page product code is empty or not.
            if (!requestObj.productCode) {
                throw new Error("Invalid destination code or destination code is empty. Please provide a valid destination code or ensure that it is not empty.");
            }
            next();
        } catch (err) {
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },
    // Viator availability details validations
    viatorProductAvailabilityDetails : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "TourViatorAvailability";
        const fPath = `/${clientId}/Tour/Viator/Availability`;

        try {
            const requestObj = request.body;
            await this.productOptionCodeSplitter(requestObj);
            let errorArr = [];
            // Checking details page product code is empty or not.
            if (!requestObj.productCode) {
                let error = "Invalid product code or product code is empty. Please provide a valid product code or ensure that it is not empty. ";
                errorArr.push(error);
            }
            if(!requestObj.travelDate){
                let error = "Please select a travel date. Ensure you choose a valid date before proceeding. ";
                errorArr.push(error);
            }

            // Regex for validate date. It will accept YYYY-MM-DD and YYYY/MM/DD
            const dateRex = new RegExp(/^\d{4}([-\/])\d{2}\1\d{2}$/);

            // This if is checking whether the start date is this two format YYYY-MM-DD and YYYY/MM/DD with the help of regex
            let dateValidation = await dateValidationFunction(requestObj, dateRex);
            errorArr.push(...dateValidation);
            
            if(requestObj.passengerDetails == undefined || requestObj.passengerDetails.length < 1){
                let error = "Please select passenger details. Ensure all necessary passenger information is provided before proceeding. ";
                errorArr.push(error);
            }
            if(requestObj.passengerDetails != undefined){
                if(!requestObj.passengerDetails[0].numberOfTravelers || requestObj.passengerDetails[0].numberOfTravelers < 1){
                    let error = "Please select the number of travelers. Ensure to specify the correct number before proceeding with your request. ";
                    errorArr.push(error);
                }
            }
            if(requestObj.msToken == undefined || requestObj.msToken == ""){
                let error = "Please provide a valid MS Token. Ensure that the token is correct and try again.";
                errorArr.push(error);
            }
            if(requestObj.agentGuid == undefined || requestObj.agentGuid == ""){
                let error = "Please provide a valid Agent Guid.";
                errorArr.push(error);
            }
            
            // Currency validations
            let currencyValidation = await setCurrencyValidation(errorArr, requestObj)
            errorArr = currencyValidation
            
            if(errorArr.length > 0){
                throw new Error(errorArr);
            }
            await this.productOptionCodeSplitter(requestObj)

            next();
        } catch (err) {
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },

    // 1way2italy availability validating
    OneWay2ItalyAvailabilityValidation : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "TourViatorAvailability";
        const fPath = `/${clientId}/Tour/Viator/Availability`;
        try{
            const requestObj = request.body;
            let errorArr = [];
            // Checking details page product code is empty or not.
            if (!requestObj.productCode) {
                let error = "Invalid product code or product code is empty. Please provide a valid product code or ensure that it is not empty. ";
                errorArr.push(error);
            }
            if(!requestObj.travelDate){
                let error = "Please select a travel date. Ensure you choose a valid date before proceeding. ";
                errorArr.push(error);
            }

            // Regex for validate date. It will accept YYYY-MM-DD and YYYY/MM/DD
            const dateRex = new RegExp(/^\d{4}([-\/])\d{2}\1\d{2}$/);

            // This if is checking whether the start date is this two format YYYY-MM-DD and YYYY/MM/DD with the help of regex
            let dateValidation = await dateValidationFunction(requestObj, dateRex);
            errorArr.push(...dateValidation);

            if(requestObj.passengerDetails == undefined || requestObj.passengerDetails.length < 1){
                let error = "Please select passenger details. Ensure all necessary passenger information is provided before proceeding.";
                errorArr.push(error);
            }
            if(requestObj.passengerDetails != undefined){
                if(!requestObj.passengerDetails[0].numberOfTravelers || requestObj.passengerDetails[0].numberOfTravelers < 1){
                    let error = "Please select the number of travelers. Ensure to specify the correct number before proceeding with your request. ";
                    errorArr.push(error);
                }
            }
            if(requestObj.msToken == undefined || requestObj.msToken == ""){
                let error = "Please provide a valid MS Token. Ensure that the token is correct and try again.";
                errorArr.push(error);
            }
            if(requestObj.agentGuid == undefined || requestObj.agentGuid == ""){
                let error = "Please provide a valid Agent Guid.";
                errorArr.push(error);
            }

            if(errorArr.length > 0){
                throw new Error(errorArr);
            }

            next();
        }
        catch(err){
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },

    // Viator destination caching validations
    viatordestinationCaching : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "TourViatorDestination";
        const fPath = `/${clientId}/Tour/Viator/Destination`;
        try{
            const requestObj = request.body;
            if(requestObj.provider.length == 0){
                throw new Error("Please select 'Provider' or ensure the 'Provider' field is not empty.");
            }
            next();
        }
        catch (err) {
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },

    // Viator destination search suggestions
    viatorDestinationSearchSuggestion : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "TourViatorDestinationSearchSuggestion";
        const fPath = `/${clientId}/Tour/Viator/DestinationSearchSuggestion`;
        try{
            const requestObj = request.body;
            if(requestObj.searchTerm.length < 3){
                throw new Error("Please enter a minimum of three characters. Your input does not meet the required length.");
            }
            if(!requestObj.searchTerm){
                throw new Error("Please enter a valid search term.");
            }
            next();
        }
        catch (err) {
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },

    // Viator product book validations
    viatorBookProductValidation : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "TourViatorTourBooking";
        const fPath = `/${clientId}/Tour/Viator/TourBooking`;
        try{
            const requestObj = request.body;
            let currentDate = moment().format('YYYY-MM-DD');
            if(!requestObj.productCode){
                throw new Error("Please select a valid product. Ensure you choose an eligible item and try again.");
            }
            if(!requestObj.travelDate){
                throw new Error("Please select a travel date. Ensure you choose a valid date before proceeding.");
            }
            if(!requestObj.currency){
                throw new Error("Please select a valid currency. Ensure the currency chosen is supported.");
            }
            if(requestObj.currency != ""){
                let acceptableCurrency = config.viator_Booking_Currency;
                if(!acceptableCurrency.includes(requestObj.currency)){
                    throw new Error("The provided currency doesn't match the available currency list. Bookable currencies are: AUD, USD, EUR, GBP, CAD. Please choose a valid currency.")
                }
            }
            if(requestObj.productOptionCode){
                await this.productOptionCodeSplitter(requestObj);
                requestObj.productOptionCode = requestObj.productOptionCode[1];
                if(requestObj.productOptionCode == "Null-00"){
                    requestObj.productOptionCode = "";
                }
            }
            validateBookingRequestData(requestObj, currentDate)
            
            next();
        }
        catch(error){
             // Add error log
             this.getError(error, fName, fPath, request);

             // Send Error response
             response.status(400).send({
                 STATUS: "ERROR",
                 RESPONSE: {
                     text: error.message
                 }
             });
        }
    },
    
    // 1way2itraly booking confirm validation
    OneWay2ItalyBookingConfirmValidator : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "Tour1way2itralyTourBooking";
        const fPath = `/${clientId}/Tour/1way2itraly/TourBooking`;
        try{
            const requestObj = request.body;
            await this.productOptionCodeSplitter(requestObj);
            if(!requestObj.productCode){
                throw new Error("Please select a valid product. Ensure you choose an eligible item and try again.");
            }
            if(!requestObj.travelDate){
                throw new Error("Please select a travel date. Ensure you choose a valid date before proceeding.");
            }
            if(!requestObj.currency){
                throw new Error("Please select a valid currency. Ensure the currency chosen is supported.");
            }
            if(requestObj.passengerDetails.length == 0){
                throw new Error("Please select passenger details. Ensure all necessary passenger information is provided before proceeding.");
            }            
            if(!requestObj.bookerInfo){
                throw new Error("Please enter the booking person's information. Ensure all required details are provided before proceeding.");
            }
            if(!requestObj.communication){
                throw new Error("Please enter the booking person's communication information.  Ensure all required details are provided before proceeding.  Ensure all required details are provided before proceeding.  Ensure all required details are provided before proceeding.");
            }
            
            next();
        }
        catch(error){
            console.log(error);
             // Add error log
             this.getError(error, fName, fPath, request);

             // Send Error response
             response.status(400).send({
                 STATUS: "ERROR",
                 RESPONSE: {
                     text: error.message
                 }
             });
        }
    },

    // Viator booking status check
    viatorBookingStatusValidations : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "TourViatorTourBookingStatus";
        const fPath = `/${clientId}/Tour/Viator/BookingStatus`;
        try{
            const requestObj = request.body;

            if(!requestObj.bookingRef){
                throw new Error("Please enter a valid booking reference.");
            }
            next();
        }
        catch(error){
            this.getError(error, fName, fPath, request);

             // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: error.message
                }
            });
        }
    },

    // Price check api validation
    viatorProductpriceCheck : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "TourViatorAvailability";
        const fPath = `/${clientId}/Tour/Viator/Availability`;

        try {
            const requestObj = request.body;
            await this.productOptionCodeSplitter(requestObj)
            // Checking details page product code is empty or not.
            let checkProductCode = await setCheckProductCode(requestObj);
            if(checkProductCode != ""){
                throw new Error(checkProductCode)
            }

            // Regex for validate date. It will accept YYYY-MM-DD and YYYY/MM/DD
            const dateRex = new RegExp(/^\d{4}([-\/])\d{2}\1\d{2}$/);

            // This if is checking whether the start date is this two format YYYY-MM-DD and YYYY/MM/DD with the help of regex
            if (dateRex.test(requestObj.travelDate)) {
                // Convert start_date to YYYY-MM-DD format
                requestObj.travelDate = requestObj.travelDate.replace(/\//g, "-");              
             
                let currentDate = moment().format('YYYY-MM-DD');
                requestObj.travelDate = moment().format(requestObj.travelDate, 'YYYY-MM-DD');
                // This if is checking whether the end date is not earlier than the start date
                if (requestObj.travelDate < currentDate) {
                    throw new Error("Travel date cannot be earlier than the start date.");
                }
               
            } else {
                throw new Error("Start date is not in the correct format. The format should be YYYY-MM-DD.");
            }
            if(requestObj.passengerDetails.length < 1){
                throw new Error("Please select a traveler and number of travelers.");
            }
            if(!requestObj.passengerDetails[0].numberOfTravelers || requestObj.passengerDetails[0].numberOfTravelers < 1){
                throw new Error("Please select the number of travelers. Ensure to specify the correct number before proceeding with your request.");
            }
            // Currency validations
            if(!requestObj.currency){
                throw new Error("Currency is required.");
            }
            if(requestObj.currency == ""){
                throw new Error("Please select valid currency");
            }
            if(requestObj.currency != ""){
                let acceptableCurrency = ["AUD", "BRL", "CAD", "CHF", "DKK", "EUR", "GBP", "HKD", "INR", "JPY", "NOK", "NZD", "SEK", "SGD", "TWD", "USD", "ZAR"];
                if(!acceptableCurrency.includes(requestObj.currency)){
                    throw new Error("The given currency doesn't match any currency on the available currency list. Please provide a valid currency or refer to the supported currency list.")
                }
            }

            next();
        } catch (err) {
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },

    // Access token generation request validation
    viatorAccessTokenValidation : async function(request, response, next){
        const fName = "TourViatorGetAccessToken";
        const fPath = `/Tour/Viator/GetAccessToken`;
       
        try {
            const requestObj = request.body;
            if(!requestObj.domainurl){
                throw new Error("Domain URL is required to generate an access token.");
            }
            if(requestObj.domainurl != undefined || requestObj.domainurl != ""){
                let  urlCheck = /^(https?:\/\/)?([\w.-]+)\.([a-zA-Z]{2,6})(\/[\w.-]*)*\/?$/;
                if(!(urlCheck.test(requestObj.domainurl))){
                    throw new Error("The domain URL is not valid.");
                }
            }
            next();
        } catch (err) {
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },

    // Viator cancel reason api validation
    viatorBookCancelReasons : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "TourViatorCancelReason";
        const fPath = `/${clientId}/Tour/Viator/CancelReason`;
        try {
            const requestObj = request.body;

            // Checking details page product code is empty or not.
            if (!requestObj.provider) {
                let error = "Please select a provider.";
                throw new Error(error);
            }

            if (requestObj.provider.length == 0) {
                let error = "Please select a provider.";
                throw new Error(error);
            }
                                                
            next();
        } catch (err) {
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },

    // Confirm cancel
    viatorBookCancelConfirm : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "TourViatorCancelConfirm";
        const fPath = `/${clientId}/Tour/Viator/CancelConfirm`;

        try {
            const requestObj = request.body;

            // Checking details page product code is empty or not.
            if (!requestObj.provider) {
                let error = "Please select a provider.";
                throw new Error(error);
            }

            if (requestObj.provider.length == 0) {
                let error = "Please select a provider.";
                throw new Error(error);
            }

            if(!requestObj.cancelReason){
                let error = "Please select a valid cancellation reason.";
                throw new Error(error);
            }
                                                
            next();
        } catch (err) {
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },

    // Add booking to moonstride validation 
    addBookingValidation : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "TourViatorCancelReason";
        const fPath = `/${clientId}/Tour/Viator/CancelReason`;

        try{
            const requestObj = request.body;
            // Checking details page product code is empty or not.
            if (!requestObj.provider) {
                let error = "Please select a provider.";
                throw new Error(error);
            }

            if (requestObj.provider.length == 0) {
                let error = "Please select a provider.";
                throw new Error(error);
            }
            next();
        }
        catch (err) {
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },

    // Viator product attraction validation
    viatorProductAttractions : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "TourViatorAttractions";
        const fPath = `/${clientId}/Tour/Viator/Attractions`;
        try{
            const requestObj = request.body;
            // Checking the provider is empty
            if(!requestObj.provider){
                let error = 'Please select a provider.';
                throw new Error(error);
            };
            if(requestObj.provider.length === 0){
                let error = 'Please select a provider.';
                throw new Error(error);
            };
            // Checking the destId is empty
            if(!requestObj.destId){
                let error = 'Destination ID is empty.';
                throw new Error(error);
            };
            next();
        }
        catch(err){
            // Add error log
            this.getError(err, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: err.message
                }
            });
        }
    },

    // Viator save booking questions to moonstride
    viatorSaveBookingQuestionsValidator : async function(request, response, next){
        const clientId = request.params.id;
        const fName = "TourViatorSaveQuestions";
        const fPath = `/${clientId}/Tour/Viator/SaveQuestions`;
        try{
            let requestObj = request.body;
            if(!requestObj.productCode){
                throw new Error("Please specify the product details.");
            }
            if(!requestObj.msToken){
                throw new Error("Moonstride access token not found.");
            }
            if(!requestObj.bookingQuestionAnswers){
                throw new Error("Please answer booking questions.");
            }
            let bookerInfo = requestObj?.bookerInfo;
            if(!bookerInfo.firstName || bookerInfo.firstName == "" || !bookerInfo.lastName || bookerInfo.lastName == ""){
                throw new Error(`Please provide valid booking person information, such as first name or last name.`);
            }
            let communication = requestObj?.communication;
            if(!communication.email || communication.email == "" || !communication.phone || communication.phone == ""){
                throw new Error(`Please provide valid communication details, such as email or phone.`);
            }
            next();
        }
        catch(error){
            console.log(error);
            this.getError(error, fName, fPath, request);

            // Send Error response
            response.status(400).send({
                STATUS: "ERROR",
                RESPONSE: {
                    text: error.message
                }
            });
        }
    },

    // function for add defult product option code in case there is no option code is available.
    productOptionCodeGenerator : async function(code){
        // default optionCode

        try {
            if(code.trim() == ""){
                // default option code from env (Null-00)
                code = config.Default_OptionCode;
            }
            else if(code === config.Default_OptionCode){
                code = "";
            }

            return code;            
        }
        catch (error) {
            console.log(error);    
        }
    },

    // product option code splitter.
    productOptionCodeSplitter(requestObj){
        if(requestObj.productOptionCode && requestObj.productOptionCode != ""){
            let optCode = requestObj?.productOptionCode ?? "";
            if(optCode.includes('_')){
                
                requestObj.productOptionCode = optCode.split('_');
            }
        }
        return requestObj;
    },

    productOptionCodeSplittingKeyAdding : async function(productCode, optionCode){
        let newOptionCode = optionCode
        if(productCode && optionCode){
            newOptionCode = productCode+config.OptionCodeSplitter+optionCode
        }
        return newOptionCode;
    },

    // function for check time difference of moth and week
    checkTimeDifferenceFunction : async function(timeStamp, duration, unit){
        try {
            const timestampDate = new Date(timeStamp);
            const currentDate = new Date();

            let millisecondsInDuration;
            if (unit === 'M') {
                millisecondsInDuration = duration * 30 * 24 * 60 * 60 * 1000; // Approximating 30 days per month
            } else if (unit === 'W') {
                millisecondsInDuration = duration * 7 * 24 * 60 * 60 * 1000;
            } else {
                throw new Error(`Invalid unit. Please use either 'months' or 'weeks'. Verify your input and try again..`);
            }

            const differenceInMilliseconds = currentDate - timestampDate;

            return differenceInMilliseconds > millisecondsInDuration;
        }
        catch (error) {
            console.log(error);    
        }        
    },

    // function to replace the provider code and add the client id for logs folder 
    logsFolderStructureBuilder : async function(clientId, path, providerCode) {
        // Combine client_id and path
        const modifiedText = clientId + path;
    
        // Use a regular expression to find and replace the {{...}} pattern
        const replacedPath = modifiedText.replace(/\{\{[^}]+}}/g, providerCode);
    
        return replacedPath;
    },

    // Add booking supplier due date calculating function 
    calculateServiceSupplierDueDate : async function(bookingDate, travelStartDate) {
        // Parse the dates using moment
        let parsedBookingDate = moment(bookingDate, 'YYYY-MM-DD');
        let parsedTravelStartDate = moment(travelStartDate, 'YYYY-MM-DD');
      
        // Calculate the interval in days
        let intervalDays = parsedTravelStartDate.diff(parsedBookingDate, 'days');
        // Calculate Service Supplier Due Date
        let serviceSupplierDueDate;
      
        if (intervalDays >= 7) {
          // If the interval is 7 days or more, set the due date 7 days before travel start
          serviceSupplierDueDate = parsedTravelStartDate.clone().subtract(7, 'days');
        } else {
          // If the interval is less than 7 days, set the due date as the booking date
          serviceSupplierDueDate = parsedBookingDate;
        }
        // Format the result in 'YYYY-MM-DD' format
        return serviceSupplierDueDate.format('YYYY-MM-DD');
    },

};

// setting the screen config details 
async function screenConfigDetailsSetting(providerConfig){
    let screenConfig = {
        "pageLayout" : providerConfig?.pageLayout ?? "LTR",
        "userReviewsShow" : providerConfig?.userReviewsShow ?? "Yes",
        "whatToExpect" : providerConfig?.whatToExpect ?? "Yes",
        "showCancellationPolicy": providerConfig?.showCancellationPolicy ?? "Yes",
        "showSupplier": providerConfig?.showPickup ?? "Yes",
        "defaultCategory" : providerConfig?.defaultCategory ?? "202"
    };
    return screenConfig;
}

// Function for basic empty validation in search
async function setSearchValidation(requestObj){
    if(!requestObj.searchDestinationId && requestObj.searchDestinationId == "" || requestObj.searchDestinationId == " "){
        return ("Search Term is Required or Search Destination Id Missing.");
    }
    // Start date validation if it is empty.
    else if(!requestObj.startDate && requestObj.startDate == ""){
        return ("Please select the trip starting date. Ensure you choose a valid date to proceed.");
    }
    // End date validation if it is empty.
    else if(!requestObj.endDate && requestObj.endDate == ""){
        return ("Please select the trip ending date. Ensure you choose a valid date to proceed.");
    } else {
        return ("");
    }
}

// Function for currenct validation
async function setCurrencyValidation(errorArr, requestObj){
    if(!requestObj.currency){
        let error = "Currency is required. ";
        errorArr.push(error);
    }
    if(requestObj.currency == ""){
        let error = "Please select valid currency ";
        errorArr.push(error);
    }
    if(requestObj.currency != ""){
        let acceptableCurrency = ["AUD", "BRL", "CAD", "CHF", "DKK", "EUR", "GBP", "HKD", "INR", "JPY", "NOK", "NZD", "SEK", "SGD", "TWD", "USD", "ZAR"];
        if(!acceptableCurrency.includes(requestObj.currency)){
            let error = "Given currency dose't match on the available currency list ";
            errorArr.push(error);
        }
    }
    return await errorArr;
}

// Function for product code and check travel date
async function setCheckProductCode(requestObj){
    if (!requestObj.productCode) {
        return ("Invalid product code or product code is empty. Please provide a valid product code or ensure that it is not empty.");
    }else if(!requestObj.productOptionCode){
        return ("Invalid product option code or product option code is empty. Please provide a valid product option code or ensure that it is not empty.");
    }else if(!requestObj.travelDate){
        return ("Please select a travel date. Ensure you choose a valid date before proceeding.");
    } else {
        return ("")
    }
}

// Function for date check in viatorSearchReqValidator
async function setCheckDate(dateRex, requestObj, currentDate){
    let error = ""
    if (dateRex.test(requestObj.startDate)) {
        // Convert start_date to YYYY-MM-DD format
        requestObj.startDate = requestObj.startDate.replace(/\//g, "-");

        // This if is checking whether the END date is this two format YYYY-MM-DD and YYYY/MM/DD with the help of regex
        
        if (dateRex.test(requestObj.endDate)) {
            // Convert end_date to YYYY-MM-DD format
            requestObj.endDate = requestObj.endDate.replace(/\//g, "-");

            // This if is checking whether the end date is not earlier than the start date
            if (requestObj.endDate < requestObj.startDate) {
                error = "The end date cannot be earlier than the start date. Please ensure the dates are entered correctly.";
            }
            if(requestObj.startDate < currentDate){
                error = "Start Date cannot be earlier than the current date. Please select a valid Start Date";
            }
        } else {
            error = "End date is not in correct format. Format is YYYY-MM-DD";
        }
    }
    else {
        error = "Start date is not in the correct format. The expected format is YYYY-MM-DD. Please ensure the date is entered correctly.";
    } 
    return error 
}

// Function for set commen error message
async function setErrorMsg(err, strErr){
    if (typeof err.message !== 'undefined' && err.message !== null) {
        return(err.message);
    }
    else if (typeof err.stack !== 'undefined' && err.stack !== null) {
        return(err.stack);
    } else {
        return(err);
    }
}

// Function for set provider data
async function setProviderData(providers, providersArr){
    providers.forEach(obj => {
        if(obj.Viator && obj.Viator.isactive){
            providersArr.push(config.Provider_Code_VTR);
        }
        if(obj.OneWay2Italy && obj.OneWay2Italy.isactive){
            providersArr.push(config.Provider_Code_OWT);
        }                    
    });
    return await providersArr
}

// Function for set api key
async function setApiKey(envVar){
    const Viator_apiKey = envVar.Viator_apiKey;
    const decryptViator_apiKey = await APICommonController.decrypt(Viator_apiKey, config.Database_Salt_Key);

    if (typeof decryptViator_apiKey == "string") {
        envVar.Viator_apiKey = decryptViator_apiKey;
    } else {
        envVar.Viator_apiKey = Viator_apiKey;
    }

    // Google api key decrypt.
    const Gloc_apiKey = envVar.Gloc_apiKey;
    const decrypted_Gloc_apiKey = await APICommonController.decrypt(Gloc_apiKey, config.Database_Salt_Key);
    if (typeof decrypted_Gloc_apiKey == "string") {
        envVar.Gloc_apiKey = decrypted_Gloc_apiKey;
    } else {
        envVar.Gloc_apiKey = Gloc_apiKey;
    }
    return await envVar
}

// Function for validate token
async function setTokenValidation(tokenvalidation, request, token){
    if (sessionObj) {
        if (tokenvalidation.tokenexpired === "invalid_token: Invalid token: The access token is invalid") {
            let response = {
                "status" : "fail",
                "result" : tokenvalidation.tokenexpired
            }
            return response
        } else {
            const domain = request.protocol + '://' + request.get('host');
            const domainURL = await APICommonController.urlHTTP(domain);
            // Call refreshTokencall function to refresh accesstoken
            tokenvalidation = await APICommonController.refreshTokencall(request, token, domainURL);
            if (tokenvalidation instanceof Error) {
                let response = {
                    "status" : "success",
                    "result" : tokenvalidation
                }
                return response;
            } else {
                let response = {
                    "status" : "",
                    "result" : ""
                }
                return response;
            }
        }
    } else {
        let response = {
            "status" : "fail",
            "result" : tokenvalidation.tokenexpired
        }
        return response;
    }
}

//Function for check the decreption value
function setDecValAsThree(decVal){
    if (decVal.charCodeAt(0) >= 65 && decVal.charCodeAt(0) <= 90) {
        decVal = decVal.toLowerCase();
    }
    else if (decVal.charCodeAt(0) >= 97 && decVal.charCodeAt(0) <= 122) {
        decVal = decVal.toUpperCase();
    }
    return decVal
}

// Function for find VTR provider details
async function setVTRProviderDetails(finddata){
    // Decrypt data
    const Viator_apiKey = finddata[0]?.Viator?.Viator_apiKey;

    if (typeof Viator_apiKey !== "undefined" && Viator_apiKey !== "") {
        const decryptViator_apiKey = await APICommonController.decrypt(Viator_apiKey, config.Database_Salt_Key);

        if (typeof decryptViator_apiKey == "string") {
            finddata[0].Viator.Viator_apiKey = decryptViator_apiKey;
        } else {
            finddata[0].Viator.Viator_apiKey = Viator_apiKey;
        }
    }

    // Google api for viator
    const Gloc_apiKey = finddata[0]?.Viator?.Gloc_apiKey;
    if (typeof Gloc_apiKey !== "undefined") {
        const decryptViator_gLocKey = await APICommonController.decrypt(Gloc_apiKey, config.Database_Salt_Key);

        if (typeof decryptViator_gLocKey == "string") {
            finddata[0].Viator.Gloc_apiKey = decryptViator_gLocKey;
        } else {
            finddata[0].Viator.Gloc_apiKey = Gloc_apiKey;
        }
    }
    return await finddata
}

// Function for find OWT provider details
async function setOWTProviderDetails(finddata){
    // Decrypt data
    const Requestor_ID = finddata[0]?.OneWay2Italy?.Requestor_ID;
    if (typeof Requestor_ID !== "undefined") {
        const decryptOWTReq_ID = await APICommonController.decrypt(Requestor_ID, config.Database_Salt_Key);

        if (typeof decryptOWTReq_ID == "string") {
            finddata[0].OneWay2Italy.Requestor_ID = decryptOWTReq_ID;
        } else {
            finddata[0].OneWay2Italy.Requestor_ID = Requestor_ID;
        }
    }
    // 1way2italy Password
    const Password = finddata[0]?.OneWay2Italy?.Password;
    if (typeof Password !== "undefined") {
        const decryptOWTPass = await APICommonController.decrypt(Password, config.Database_Salt_Key);

        if (typeof decryptOWTPass == "string") {
            finddata[0].OneWay2Italy.Password = decryptOWTPass;
        } else {
            finddata[0].OneWay2Italy.Password = Password;
        }
    }
    return await finddata
}

// function for check date validation availability route.
async function dateValidationFunction(requestObj, dateRex){
    try {
        let errorArr = [];
        if (dateRex.test(requestObj.travelDate)) {
            // Convert start_date to YYYY-MM-DD format
            requestObj.travelDate = requestObj.travelDate.replace(/\//g, "-");              
            let currentDate = moment().format('YYYY-MM-DD');
            requestObj.travelDate = moment().format(requestObj.travelDate, 'YYYY-MM-DD');
            // This if is checking whether the end date is not earlier than the start date
            if (requestObj.travelDate < currentDate) {
                let error = "Travel date cannot be earlier than the current date. Please select a valid Travel date. ";
                errorArr.push(error);
            }
           
        }
        else {
            let error = "Start date is not in the correct format. The format should be YYYY-MM-DD. ";
            errorArr.push(error);
        }
        return errorArr;
    } 
    catch (error) {
        console.log(error);    
    }
}

// function for validate booking request data 
function validateBookingRequestData(requestObj, currentDate){
    if(requestObj.passengerDetails.length == 0){
        throw new Error("Please select passenger details. Ensure all necessary passenger information is provided before proceeding.");
    }
    if(!requestObj.bookerInfo){
        throw new Error("Please enter the booking person's information. Ensure all required details are provided before proceeding.");
    }
    if(!requestObj.communication){
        throw new Error("Please enter the booking person's communication information.  Ensure all required details are provided before proceeding.  Ensure all required details are provided before proceeding.");
    }
    if(requestObj.travelDate < currentDate){
        throw new Error("Travel date cannot be earlier than the current date.");
    }
    
    if(!requestObj.bookingQuestionAnswers){
        throw new Error("Please provide answers to booking questions.");
    }
    if(Array.isArray(requestObj.languageGuide)){
        throw new Error("Invalid language guide format. Please review and correct the language guide format.");
    }
    if(!Array.isArray(requestObj.bookingQuestionAnswers) || requestObj.bookingQuestionAnswers.length == 0){
        throw new Error("Invalid booking question answers format. Please check the format and ensure it meets the required criteria.");
    }
}

module.exports = APICommonController;