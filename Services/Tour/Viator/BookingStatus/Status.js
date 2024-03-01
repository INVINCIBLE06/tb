"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const config = require("../../../../Config.js");
module.exports = async (app) => {
    app.post("/:id/Tour/Viator/BookStatus", async function (request, response, next) {
        // Validating request fields. 
        await apiCommonController.viatorBookingStatusValidations(request, response, next);
    }, async function (request, response) {
        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "Status_Check_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_STATUS_CHECK_PROVIDER_STATUS_CHECK_FILE_PATH, config.Provider_Code_VTR);
        try {
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }
            let result;
            // Definde the request fields. 
            let bookingRef = requestObj.bookingRef;
            // Defined url for viator booking status api.
            let BookStatus = {
                "URL" : `bookings/status`,
                "bookingRef" : bookingRef
            }
            
            // Get the api response.
            // Waiting for all the three api results.
            result = await apiResponse.getBookingStatusApiReponse(clientId, providerDetails, BookStatus);
            if(result?.status){
                if(result?.rejectionReasonCode){
                    result = await rejectionReasons(result);
                }                
                response.status(200).send({
                    "Result": result
                });
            }
            else{
                throw new Error(result?.message);
            }
           
        } catch (error) {
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

        
    });    
}

// Function for product booking rejection reasons.
async function rejectionReasons(result){
    if(result.rejectionReasonCode != undefined){
        switch(result.rejectionReasonCode){
            case "BOOKABLE_ITEM_IS_NO_LONGER_AVAILABLE":
                result.rejectionReason = "The bookable item is no longer available";
                break;
            case "WEATHER":
                result.rejectionReason = "This booking was rejected on account of the weather";
                break;
            case "DUPLICATE_BOOKING":
                result.rejectionReason = "This is a duplicate booking";
                break;
            case "PRODUCT_NO_LONGER_OPERATING":
                result.rejectionReason = "The product is no longer operating";
                break;
            case "MINIMUM_NUMBER_OF_PASSENGERS_NOT_MET":
                result.rejectionReason = "There are too few passengers for the product to operate";
                break;
            case "SIGNIFICANT_GLOBAL_EVENT_FORCE_MAJEURE":
                result.rejectionReason = "The booking was rejected due to a natural disaster or other large-scale catastrophe";
                break;
            case "TOUR_WAS_CANCELLED":
                result.rejectionReason = " The product was cancelled";
                break;
            case "ISSUE_WITH_TICKET":
                result.rejectionReason = " There was an issue with the ticket";
                break;
            case "ISSUE_WITH_PICKUP":
                result.rejectionReason = "There was an issue with pickup";
                break;
            case "OTHER":
            default :
            result.rejectionReason = "Other/Unlisted reason";
                break;
        }        
    }
    return await result;
}