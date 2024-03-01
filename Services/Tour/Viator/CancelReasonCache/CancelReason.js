const apiCommonController = require('../../../../Utility/APICommonController')
const apiResponse = require('./Response')
const fs = require('fs')
const path = require('path')
const config = require('../../../../Config')
module.exports = async (app) => {
    app.post("/:id/Tour/Viator/CancelReasonCache", async function(request, response, next){
        
        next()
    }, async function(request, response){
        const clientId = request.params.id;
        let fName = "CancelReasons_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CANCEL_REASONS_PROVIDER_CANCEL_REASONS_FILE_PATH, config.Provider_Code_VTR);
        try {
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }
            // Take the data from viator api.
            let result = await apiResponse.getCancelReasons(clientId, providerDetails, "/bookings/cancel-reasons", request)

            if(result && result?.reasons){
                // Save booking cancel reasons to file.
                await cacheCancelReasons(request, result, response, fName, fPath)
            }
            else{
                throw new Error(result?.errorMessageText || result?.errorMessage || result?.message || "No Data Found.");
            }            
        }
        catch (error) {
            console.log(error);
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
    })
}

// Function for booking cancel reason caching.
async function cacheCancelReasons( request, result, response, fName, fPath){
    // file path.
    let filePath = config.viator_booking_cancel_reason_caching_file_location;
    // current time stamp.
    result.timestamp = new Date();
    result.provider = "VTR";
    result.totalCount = result?.reasons?.length;
    // original data.
    let jsonData = JSON.stringify(result, null, 2);

    try {
        // match the file path
        const fullPath = path.join(process.cwd(), filePath);
        // extract the directory.
        const directory = path.dirname(fullPath);
        // checking if the file or folder is exist if not then create a new file.
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }        
        //write data to file
        fs.writeFileSync(process.cwd() + filePath, jsonData, 'utf-8');
        response.status(200).send({
            "Result": "Cancel Reasons successfully save to file."
        });

    }
    catch (error) {
        console.log(error);
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
}