const mongoose = require('mongoose');
// This model defines a Mongoose schema named Tour_ManualConfirm_Booking with the specified fields, We can use this schema to store manual confirmed products pending status and confirm after some time.
const ManualConfirmSchema = new mongoose.Schema({
    BookingRef: {
        type: String,
        required: true,
        default: null
    },
    BookingComponentId: {
        type: String,
        required: true,
        default: null
    },
    bookingGuid: {
        type: String,
        default: null
    },
    msToken: {
        type: String,
        default: null
    },
    clientId: {
        type: String,
        default: null
    },
    status: {
        type: String,
        default: null
    },
    cretaedDateTime: {
        type: Date,
        default: null
    },
    bookingTimeOut : {
        type: Date,
        default: null
    },
    callbackurl: {
        type: String,
        default: null
    },
    statusCheckUrl : {
        type: String,
        default: null
    },
    statusCheckRequest : {
        type : Object,
        default: null
    }
}, { collection: "Tour_VTR_ManualConfirm_Booking" });

module.exports = mongoose.model('Tour_ManualConfirm_Booking', ManualConfirmSchema);
