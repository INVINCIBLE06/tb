"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const fs = require('fs');
const config = require("../../../../Config.js");

module.exports = async (app) => {
    // Get predictive search or search suggestions base on entered value at least 3 characters
    app.post("/:id/Tour/1way2italy/SearchSuggestion", async function (request, response, next) {
        // Validating request fields. 
        await apiCommonController.viatorDestinationSearchSuggestion(request, response, next);
    }, async function (request, response){

        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "Search_Suggestion_";
        let fPath = `/${clientId}/Service/OWT/Search_Suggestion`;
        try{
            // Base path for supplier destination details.
            let filePath = `${config.OneWay2italy_Destination_File_Path}`;
            // Search word
            let searchString = requestObj.searchTerm;
            // Read location data json file for destinations.
            fs.readFile(process.cwd() + filePath, 'utf8', async (err, data) => {
                if(err) throw err; 
                let jsonData = JSON.parse(data);
                // An array of locations.
                jsonData = jsonData.Data;
                
                // Checking the search string is present in the data in checking with area name and region name and .
                let filteredResults = jsonData.filter(item => {
                    // Checking with city name 
                    let cityNameStartsWith = item.CityName?.toLowerCase().startsWith(searchString.toLowerCase());
                    // Checking with region name 
                    let regionNameStartsWith = item.RegionName?.toLowerCase().startsWith(searchString.toLowerCase());
                    // Checking with area name .
                    let areaNameStartsWith = item.AreaName?.toLowerCase().startsWith(searchString.toLowerCase());
                    // Return all the available values.
                    return cityNameStartsWith || regionNameStartsWith || areaNameStartsWith;
                });
                //Empty array for store result
                let filteredArray =[];                                
                if(filteredResults != undefined && filteredResults.length >= 1){
                    let filteredArrayResult = await handleFinalResult(filteredResults, filteredArray);
                    // Converting to sentance case - making capital letter for fist letter only.
                    filteredArray = filteredArrayResult.map((item) => {
                        return {
                          ...item,
                          "label": item.label.toLowerCase().replace(/(?:^|\s)\S/g, (match) => match.toUpperCase())
                        };
                    });
                      
                    response.status(200).send({
                        "Result": {
                            "provider" : config.Provider_Code_OWT,
                            "Code" : 200,
                            filteredArray
                        }
                    });
                }
                else{
                    response.status(200).send({
                        "Result": {
                            "Code": 400,
                            "Error": {
                                "Message": "No Matching Data Found."
                            }
                        }
                    });
                };
                
            });

        }
        catch (error) {
            // Handle error safely and add logs
            const errorObject = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            }
            apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
            response.send(errorObject);
        };        
    })
}
// Function to handle final result
async function handleFinalResult(filteredResults, filteredArray){
    // Looping through filterd array .
    for(const filteredResultsObj of filteredResults){
        let suggObj = {};
        // Checking if the area name is exist then take area name first.
        if(filteredResultsObj.AreaName != undefined && filteredResultsObj.CityName != undefined && filteredResultsObj.RegionName){
            suggObj.label = `${filteredResultsObj.AreaName}, ${filteredResultsObj.CityName}, ${filteredResultsObj.RegionName}, ${filteredResultsObj.CountryName}`;
            suggObj.value = filteredResultsObj.CityCode;
            filteredArray.push(suggObj);
        }
        else if(filteredResultsObj.RegionName != undefined && filteredResultsObj.CityName != undefined){

            suggObj.label = `${filteredResultsObj.CityName}, ${filteredResultsObj.RegionName}, ${filteredResultsObj.CountryName}`;
            suggObj.value = filteredResultsObj.CityCode;
            filteredArray.push(suggObj);                    
        }               
    }; 
    return filteredArray;
};