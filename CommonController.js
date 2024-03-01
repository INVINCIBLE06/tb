"use strict";
const path = require("path");
const express = require("express");
const process = require("process");
const config = require("./Config");
const bodyParser = require("body-parser");
const OAuth2Server = require("oauth2-server");
const sessions = require('express-session');
const APICommonController = require("./Utility/APICommonController");
const fName = "commonController";
const methodName = "/commonController";

const CommonController = {

    appStarted: function (routesPath, EndPointURL, EndPointName) {
        try {
            // Express configuration
            let app = express();
            app.use(bodyParser.urlencoded({ extended: true }));
            app.use(bodyParser.json());
            let cors = require("cors");
            app.use(cors({
                origin: '*',
            }));

            // Creating 24 hours from milliseconds received from ENV. file
            let data = config.SessionMaxAge;
            data = data.split("*");
            let sessionvalue = 1;

            for (const value of data) {
                sessionvalue *= Number(value);
            }
            // Momery unleaked---------
            app.set('trust proxy', 1);

            // Session middleware            
            app.use(sessions({
                secret: config.Session_Secret_Key,
                saveUninitialized: true,
                rolling: true,
                cookie: {
                    httpOnly: true,
                    maxAge: sessionvalue
                },
                resave: true
            }));

            // Oauth server configuration
            app.oauth = new OAuth2Server({
                model: require('./Routes/Initialization/Oauthfunction'),
                accessTokenLifetime: 60 * 60 * 24 * 365,
                refreshTokenLifetime: 60 * 60 * 24 * 365,
                allowBearerTokensInQueryString: true
            });

            // To install ejs engine
            app.set('view engine', 'ejs');
            app.set('views', path.resolve(__dirname, './template'));
            app.use(express.static("template"));
            app.use('/css', express.static(__dirname + '../../../template/css'));

            // Destination json public files
            //app.use('/json', express.static(__dirname + '\\template\\destination_json\\All_destinations.json'))

            app.get('/error', function (req, res, next) {
                throw new Error("Problem occurred");
            });

            // Routes configuration
            const routes = require(routesPath);
            const routes1 = require('./Routes/Configuration/TourServices.js');
            const routes2 = require('./Routes/Initialization/Initialization.js');
            const routes3 = require('./Routes/Initialization/Ping.js');
            const routes4 = require('./Routes/Location_Mapping/Mapping');
            const routes5 = require('./Routes/Token_Configuration/Token_Configuration');
            routes(app);
            routes1(app);
            routes2(app);
            routes3(app);
            routes4(app);
            routes5(app);

            // 404 page
            app.use((req, res, next) => {
                res.render("views/errorpage", { errorMessage: "404 Page not found.", errorDescription: "404 Page not found." });
            });

            if (EndPointURL.indexOf('|')) {
                let endpointSplit = EndPointURL.split('|');
                app.listen(endpointSplit[1], endpointSplit[0], function () {
                    // console.log(`${EndPointName} App listening on http://${endpointSplit[0]}:${endpointSplit[1]}`);
                });
            } else {
                let endpointSplit = EndPointURL;
                app.listen(endpointSplit, function () {
                    // console.log(`${EndPointName} App listening on PORT ${endpointSplit}`);
                });
            }
        } catch (err) {
            console.log(err);
            // Handle error safely and add logs
            APICommonController.getError(err, fName, methodName, " ");
        }
    }

};

process.on('uncaughtException', (err) => {
    console.log(err);
    // Handle error safely and add logs
    APICommonController.getError(err, fName, methodName, " ");
});

module.exports = CommonController;