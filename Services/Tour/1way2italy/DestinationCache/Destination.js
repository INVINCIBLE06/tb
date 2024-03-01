"use strict";
// Destination caching file for 1way2italy 
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const fs = require('fs');
const xml2json = require('xml-js');
const config = require("../../../../Config.js");
const path = require('path')


module.exports = async(app)=>{
    // Get supplier details from 1way2italy site and get the supplier code and again fetch the destinations
    app.post("/:id/Tour/1way2italy/DestinationCache", async function(request, response, next){
        // Validating request fields. 
        await apiCommonController.viatordestinationCaching(request, response, next);
    }, async function(request, response){

        const clientId = request.params.id;
        let fName = "Destination_Caching_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_DESTINATION_CACHING_PROVIDER_DESTINATION_CACHING_FILE_PATH, config.Provider_Code_OWT);

        try{
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "OneWay2Italy");
            if (!(providerDetails.Requestor_ID && providerDetails.Password)) {
                throw new Error(config.OWTApiKeyErrorMessage);
            }

            // Get the Available Supplier details from the One way to Italy and save it to Json file
            let availableSuppliersResponse = await apiResponse.getAvailableSuppliersApiResponse(clientId,'readprofile', providerDetails);

            if (!availableSuppliersResponse) {
                // Handle the case when availableSuppliersResponse is falsy.
                throw new Error("Unable fetch suppliers details.");
            }
            const supplierDetails = parseSupplierDetails(availableSuppliersResponse);

            if (!supplierDetails) {
                // Handle the case when supplierDetails is falsy.
                throw new Error("Supplier details not found");
            }

            saveSupplierDetailsToFile(supplierDetails);

            const supplierChainCodes = supplierDetails.Connection.map(item => item['_attributes']['SupplierCode']);

            if (supplierChainCodes.length === 0) {
                // Handle the case when supplierChainCodes is empty.
                throw new Error("Supplier chain codes are empty.");
            }

            const supplierLocationsResult = await apiResponse.getSuppliersLocationsApiResponse(clientId, 'readlocalities', supplierChainCodes, providerDetails);

            if (!supplierLocationsResult || supplierLocationsResult.length === 0) {
                // Handle the case when supplierLocationsResult is empty or falsy.
                throw new Error("Supplier locations result is empty.");
            }            

            const uniqueDestinationsDataArray = processSupplierLocations(supplierLocationsResult);

            if(uniqueDestinationsDataArray){

                saveUniqueDestinationsToFile(uniqueDestinationsDataArray);

                response.send({
                    "Code": 200,
                    "Message": "Supplier Destination Added Successfully"
                });
            }                
            
            else {
                throw new Error("Supplier details not found in the response.");
            }                                           

        }
        catch(error){
            // Handle error safely and add logs
            handleError(response, fName, fPath, request.body, error);
        }
    });
}

// Convert xml data to json format.
function parseSupplierDetails(availableSuppliersResponse) {
    const jsonData = xml2json.xml2json(availableSuppliersResponse, { compact: true, spaces: 4 });
    return JSON.parse(jsonData)?.OTA_ProfileReadRS?.Profiles?.ProfileInfo?.Profile?.TPA_Extensions?.Connections;
}

// Save destination details to file
function saveSupplierDetailsToFile(supplierDetails) {

    const supplierData = JSON.stringify(supplierDetails, null, 2);
    const destinationPath = `${config.OneWay2italy_Supplier_Details_File_Path}`;
    // Extract the directory path
    const fullPath = path.join(process.cwd(), destinationPath);
    const directory = path.dirname(fullPath);

    // Create the directory if it doesn't exist
    if (!fs.existsSync(process.cwd() + directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }

    fs.writeFileSync(process.cwd() + destinationPath, supplierData, 'utf-8');
    console.log("Suppliers Details Added successfully");
}

//======== Process supplier location==========//
function processSupplierLocations(supplierLocationsResult) {
    // Implementation for processing supplier locations and creating unique destinations data.
    // Return the unique destinations data.
    try {
        if (supplierLocationsResult && supplierLocationsResult.length > 0) {
            const uniqueObjects = new Map();
            const supplierCityCodesList = [];
            supplierLocationsResult.forEach((result) => {
                if (result?.data) {
                    const locationData = parseLocationData(result.data);
                    
                    let destinationsList = locationData?.OTAX_LocalityReadRS?.Localitie?.Locality ?? [];
                    if(! Array.isArray(destinationsList)){
                        destinationsList = [destinationsList]
                    }
                    const currentSupplierCode = locationData?.OTAX_LocalityReadRS?.Localitie._attributes.ChainCode;
                    isDestinationsList(destinationsList, uniqueObjects, currentSupplierCode, supplierCityCodesList);   
                }
            });

            return enrichUniqueDestinations(uniqueObjects, supplierCityCodesList);
        }
        else {
            return [];
        }  
    }
    catch (error) {
        console.log(error);    
    }
            
}

// Function for parse location data
function parseLocationData(data) {
    const jsonData = xml2json.xml2json(data, { compact: true, spaces: 4 });
    return JSON.parse(jsonData);
}

// Function for add unique destinations
function addUniqueDestinations(destinationsList, uniqueObjects) {
    try {
        destinationsList.forEach((destination) => {
            const cityCode = destination._attributes.CityCode;
    
            if (!uniqueObjects.has(cityCode)) {
                const suppliersChainInfo = [];
                destination._attributes.supplierChainCodes = suppliersChainInfo;
                destination._attributes.destinationId = uniqueObjects.size + 1;
                uniqueObjects.set(cityCode, destination._attributes);
            }
        });
    }
    catch (error) {
        console.log(error);
    }    
}

// Function for add supplier city code
function addSupplierCityCodes(destinationsList, currentSupplierCode, supplierCityCodesList) {
    if (currentSupplierCode) {
        const cityCodesList = destinationsList?.map((destination) => destination._attributes.CityCode) || [];
        supplierCityCodesList.push({ [currentSupplierCode]: cityCodesList });
    }
}

// Function for enrich unique destinations
function enrichUniqueDestinations(uniqueObjects, supplierCityCodesList) {
    const uniqueObjectsArray = Array.from(uniqueObjects.values());

    uniqueObjectsArray.forEach((item) => {
        const cityCode = item.CityCode;
        supplierCityCodesList.forEach((supplier) => {
            const temp = Object.values(supplier)[0];
            if (temp.includes(cityCode)) {
                item.supplierChainCodes.push(Object.keys(supplier)[0]);
            }
        });
    });

    return uniqueObjectsArray;
}
//=========== End ================//

// Function for save unique destinations to file
function saveUniqueDestinationsToFile(uniqueDestinationsDataArray) {
    // Your implementation for saving unique destinations data to a file here.    

    let locationData = {
        "Data" : uniqueDestinationsDataArray,
        "Total_Locations" : uniqueDestinationsDataArray.length,
        "Created_Date" : new Date()
    }
    const uniqueDestinationsDataItem = JSON.stringify(locationData, null, 2);
    const destinationPath = `${config.OneWay2italy_Destination_File_Path}`;

    try {
        // Extract the directory path
        const fullPath = path.join(process.cwd(), destinationPath);
        const directory = path.dirname(fullPath);

        // Create the directory if it doesn't exist
        if (!fs.existsSync(process.cwd() + directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        fs.writeFileSync(process.cwd() + destinationPath, uniqueDestinationsDataItem, 'utf-8');
    }
    catch (error) {
        console.log(error);
        throw new Error(error.message);
    }
}

// Common error handeling function for this page.
function handleError(response, fName, fPath, requestBody, error) {
    const errorObject = {
        "STATUS": "ERROR",
        "RESPONSE": {
            "text": error.message
        }
    };
    apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(requestBody));
    response.send(errorObject);
}

// Function for addUniqueDestinations and addSupplierCityCodes if destinationsList is set
function isDestinationsList(destinationsList, uniqueObjects, currentSupplierCode, supplierCityCodesList){
    if (destinationsList) {
        addUniqueDestinations(destinationsList, uniqueObjects);
        addSupplierCityCodes(destinationsList, currentSupplierCode, supplierCityCodesList);
    }
}