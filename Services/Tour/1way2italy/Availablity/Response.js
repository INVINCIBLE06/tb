"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");
const xml2json = require('xml-js');

const response = {
    // Get availability response from 1way2italy.
    getAvailabilityApiReponse: async (clientId, requestObj, url, providerDetails) => {
        let fName = "Availability_ApiResponse_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_AVAILABILITY_PROVIDER_RESPONSE_FILE_PATH, config.Provider_Code_OWT);
        try{
            let guestCountsXML = "<GuestCounts>\n";
            // sorting for adult child, infant order 
            requestObj.travelersAgeCount.sort((a, b) => {
                const keyA = Object.keys(a)[0];
                const keyB = Object.keys(b)[0];
                if (keyA < keyB) {
                  return -1;
                }
                if (keyA > keyB) {
                  return 1;
                }
                return 0;
            });

            guestCountsXML = await setGuestCount(requestObj, guestCountsXML)
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

            const headers = {
                "Content-type": "application/xml",
            };
            let axiosRequest = {
                method: 'post',
                maxBodyLength: Infinity,
                url: `${providerDetails.Oneway2italy_url}${url}`,
                headers: headers,
                data : checkAvailXmlRequest
            }
            const response = await axios.request(axiosRequest);
    
            const jsonData = JSON.parse(xml2json.xml2json(response.data, { compact: true, spaces: 4, explicitArray: true }))?.OTAX_TourActivityAvailRS;
    
            const fileName = `${fName}Success`;
            createLogs(`${providerDetails.Oneway2italy_url}${url}`, fileName, fPath, JSON.stringify(checkAvailXmlRequest), jsonData);
    
            return jsonData;
            
        }
        catch (error) {
            if(error.response == undefined || error.isAxiosError){
                let responseData = {
                    message : "Internal server error or Api timed out"
                }
                apiCommonController.getError(error?.cause, fName, fPath, JSON.stringify(requestObj));
                return(responseData)
            }
            else if(error.hasOwnProperty("response")) {
                apiCommonController.getError(error?.response?.data, fName, fPath, JSON.stringify(requestObj));
                return(error?.response?.data);
            }
        }

    }
}

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
    let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
    apiCommonController.doLogs(createLogs, fName, fPath);
}

// Categorising pax age and count
async function setGuestCount(requestObj, guestCountsXML){
    // Looping through the passenger count and age for adding passenger count for search.           
    for (const entry of requestObj.travelersAgeCount) {
        for (const key in entry) {
          const { age, count } = entry[key];
            if(age != 0 && count != 0){
                guestCountsXML += `  <GuestCount Age="${age}" Count="${count}" />\n`;
            }
        }
    }
    guestCountsXML += "</GuestCounts>";
    return guestCountsXML;
}

module.exports = response;