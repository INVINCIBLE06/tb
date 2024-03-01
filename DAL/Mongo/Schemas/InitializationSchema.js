const mongoose = require('mongoose');

const InitializationSchema = new mongoose.Schema({
    appid: {
        type: String,
        required: true,
        default: null
    },
    clientreferenceid: {
        type: String,
        required: true,
        default: null
    },
    inputrequest: {
        type: Object,
        default: null
    },
    mooncognitoResponse: {
        type: Object,
        default: null
    },
    guid: {
        type: String,
        default: null
    },
    secretkey: {
        type: Object,
        default: null
    },
    callbackurl: {
        type: Object,
        default: null
    }
}, { collection: "Tour_Initialization" });
module.exports = mongoose.model('Tour_Initialization', InitializationSchema);