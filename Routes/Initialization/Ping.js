'use strict';
const apiCommonController = require('../../Utility/APICommonController.js');

module.exports = function (app) {

    app.get("/ping", async function (request, response) {
        const fPath = "/Ping";
        const fName = "ping";
        try {
            const pingStatus = await apiCommonController.pingStatus(app, request, response);
            response.status(200).send(pingStatus);
        } catch (err) {
            // Handle error safely and add logs
            apiCommonController.getError(err, fName, fPath, request);
            response.status(400).send({ Error: err.message });
        }
    });

};