"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");
const xml2json = require('xml-js');

const response = {
    // Get availability response from 1way2italy.
    getPriceCheckApiReponse: async (clientId, requestObj, url, providerDetails, request) => {
        const fName = "priceCheck_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_PRICE_CHECK_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_OWT);

        try {
            const checkAvailXmlRequest = await priceCheckQueryGeneratorFunction(clientId, providerDetails, requestObj, request);
            let axiosRequest = {
                method: 'post',
                maxBodyLength: Infinity,
                url : `${providerDetails.Oneway2italy_url}${url}`,
                headers: {
                    "Content-type": "application/xml; charset=utf-8",
                },
                data : checkAvailXmlRequest
            }
            const response = await axios.request(axiosRequest);
    
            const jsonData = xml2json.xml2json(response?.data, { compact: true, spaces: 4, explicitArray: true });
            const parsedData = JSON.parse(jsonData)?.OTAX_TourActivityAvailRS;
            const fileName = fName + "Success";
            createLogs(`${providerDetails.Oneway2italy_url}${url}`, fileName, fPath, request, parsedData);
            
            return parsedData;
        } catch (error) {
            if (!error.response || error.isAxiosError) {
                const errorObj = { message: "Internal Server Error or API timeout." };
                apiCommonController.getError(errorObj, fName, fPath, request);
                return errorObj;
            }
    
            const errorData = error?.response?.data ?? error?.cause;
            apiCommonController.getError(errorData, fName, fPath, request);
            return errorData;
        }
    }    
}

// Function for price check quer generator 
async function priceCheckQueryGeneratorFunction(clientId, providerDetails, requestObj, request){
    const fName = "priceCheck_ApiResponse_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_PRICE_CHECK_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_OWT);

    try{

        //We need to convert the Request object passengerDetails format for adding Guest Age Counts 
        let travelersAgeCount = [];
        for(const item of requestObj.passengerDetails){                                
            const {ageBand, age, numberOfTravelers } = item;
            if(age > 0 && numberOfTravelers > 0 && ageBand != undefined){
                travelersAgeCount.push({
                    [ageBand] : {"age" : age , "count" : numberOfTravelers}
                });
            };
        };
        // Looping through the passenger count and age for adding passenger count for search.
        let guestCountsXML = "<GuestCounts>\n";           
        for (const entry of travelersAgeCount) {
            for (const key in entry) {
              const { age, count } = entry[key];
                if(age != 0 && count != 0){
                    guestCountsXML += `  <GuestCount Age="${age}" Count="${count}" />\n`;
                }
            }
        };
        guestCountsXML += "</GuestCounts>";

        // Search query
        let checkAvailXmlRequest = `<OTAX_TourActivityAvailRQ xmlns="http://www.opentravel.org/OTA/2003/05" Target="Test" EnablePaxPrices="true"  PrimaryLangID="en" OnRequestInd="true" 
        MarketCountryCode="us" >
        <POS>
            <Source>
                <RequestorID ID="${providerDetails.Requestor_ID}" MessagePassword="${providerDetails.Password}" />
            </Source>
        </POS>
        <AvailRequestSegments>
            <AvailRequestSegment>
                <TourActivitySearchCriteria>
                    <Criterion>
                        <TourActivityRef ChainCode="${requestObj.chainCode}" TourActivityCode="${requestObj.productCode}" /> 
                    </Criterion>
                </TourActivitySearchCriteria>
                <StayDateRange Start="${requestObj.travelDate}" End="${requestObj.endDate}" />
                <ActivityCandidates>
                    <ActivityCandidate Quantity="1" RPH="01">
                        ${guestCountsXML}
                    </ActivityCandidate>
                </ActivityCandidates>
            </AvailRequestSegment>
        </AvailRequestSegments>
            </OTAX_TourActivityAvailRQ>`;  
        return checkAvailXmlRequest ;

    }
    catch(error){
        
            // Handle error safely and add logs
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, errorObj);
            return errorObj;
    }
}

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

module.exports = response;