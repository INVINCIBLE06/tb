"use strict";
const axios = require("axios");
const config = require("../../../../Config.js");
const apiCommonController = require("../../../../Utility/APICommonController.js");


const response = {
    // Booking confirm api.
    bookingConfirmResponse : async (clientId, providerDetails, URL, bookingObj)=>{
        let fName = "ConfirmBooking__ApiResponse";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_CONFIRM_BOOKING_PROVIDER_CONFIRM_BOOKING_RESPONSE_FILE_PATH, config.Provider_Code_OWT);
        try {
          return new Promise(async (resolve)=>{
              let passengersDetailsArr = bookingObj.passengerDetails;

              let totalPassengers = 0;

              passengersDetailsArr.forEach(passenger => {
                totalPassengers += passenger.numberOfTravelers;
              });
              // Generate query. 
              let queryString = await getQueryString(bookingObj, providerDetails)
              axios.post(`${providerDetails.Oneway2italy_url}${URL}`, 
                queryString ,
                    // Header Parameter
                {
                      headers: {
                        "Content-type": "application/xml; charset=utf-8",
                      },
                },
                {
                    timeout: 90000, // Timeout in milliseconds (e.g., 120 seconds)
                }).then((response) => {
                    // Response send back to user.
                    let fileName = fName + "Success"
                    createLogs(URL, fileName, fPath, JSON.stringify(bookingObj), response.data)
                    resolve(response.data);
                }).catch((error) => {
                    if (error.hasOwnProperty('response')) {
                        console.log(error.response.data);
                        apiCommonController.getError(error.response.data, fName, fPath, JSON.stringify(bookingObj));
                        resolve(error.response.data);
                    } else {
                        console.log(error.cause);
                        apiCommonController.getError(error.cause, fName, fPath, JSON.stringify(bookingObj));
                        resolve(error.cause);
                    }
                });
            })
        } catch (err) {
            const errorObj = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": err.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, JSON.stringify(bookingObj));
            return errorObj;
        }
    }
}

// Function for create logs
async function createLogs(url, fName, fPath, searchObject, response){
  let createLogs = apiCommonController.createFullApiLog(url, searchObject, response, "");
  apiCommonController.doLogs(createLogs, fName, fPath);
}

// Generate quesry string.
async function getQueryString(bookingObj, providerDetails){
  try {
    let bookinfQuestions = bookingObj.bookingQuestionAnswers;

    let pax = bookingObj?.passengers ?? [];
  
    let prefix = pax.map(passenger => passenger.title);
  
    // Passenger count.
    let ResGuestRPH = await setPassengerCount(prefix)
  
    // Passenger details
    let passengersDetails = `<ResGuests>\n `;
  
  
    let firstNames = bookinfQuestions.filter(item => item.question === "FULL_NAMES_FIRST");
  
    let lastNames = bookinfQuestions.filter(item => item.question === "FULL_NAMES_LAST");
  
    let addressLine = bookinfQuestions.filter(item => item.question === "ADDRESS_LINE")
    let cityName = bookinfQuestions.filter(item => item.question === "CITY_NAME")
    let postalCode = bookinfQuestions.filter(item => item.question === "POSTAL_CODE")
    let countryCode = bookinfQuestions.filter(item => item.question === "COUNTRY_CODE")
    let countryName = bookinfQuestions.filter(item => item.question === "COUNTRY_NAME")
    let countryAccessCode = bookinfQuestions.filter(item => item.question === "CONTRY_ACCESS_CODE")
    // Extract only date of births.
    let paxDateOfBirths = pax.filter((item) => item.dateofbirth && item.dateofbirth != "")
      .map((item) => {
        let paxDob = new Date(item.dateofbirth)
        return paxDob.toISOString().split("T")[0];
      });
  
    for(let p = 0; p < prefix.length; p++){   
      if(p == 0){
        passengersDetails += `<ResGuest ResGuestRPH="${1}">\n` 
      }
      else{
        passengersDetails += `<ResGuest ResGuestRPH="${p + 1}">\n`
      }     
      passengersDetails += `<Profiles>\n
          <ProfileInfo>\n
            <Profile>\n`
            if(paxDateOfBirths.length !=0){
              passengersDetails += `<Customer BirthDate="${paxDateOfBirths[p]}">\n`
            }else{
              passengersDetails += `<Customer>\n`
            }            
            passengersDetails += `<PersonName>\n                          
                  <NamePrefix>${prefix[p]}</NamePrefix>\n
                  <GivenName>${firstNames[p].answer}</GivenName>\n
                  <Surname>${lastNames[p].answer}</Surname>\n
                </PersonName>\n`
                if(p == 0){
                  passengersDetails += `<Telephone CountryAccessCode="${countryAccessCode[p].answer}" PhoneNumber="${bookingObj.communication.phone}" PhoneTechType="5"/>
                    <Email>${bookingObj.communication.email}</Email>
                    <Address>
                      <AddressLine>${addressLine[p].answer}</AddressLine>
                      <CityName>${cityName[p].answer}</CityName>
                      <PostalCode>${postalCode[p].answer}</PostalCode>
                      <StateProv></StateProv>
                      <CountryName Code="${countryCode[p].answer}">${countryName[p].answer}</CountryName>
                    </Address>`
                }                          
              passengersDetails += `</Customer>
            </Profile>
          </ProfileInfo>
        </Profiles>
      </ResGuest>`
    }
    passengersDetails += `</ResGuests>\n`; 
    // Query
    let queryString =  `<OTAX_TourActivityResRQ xmlns="http://www.opentravel.org/OTA/2003/05" ResStatus="Book" Target="Test" MarketCountryCode="us" >
      <POS>
        <Source>
          <RequestorID ID="${providerDetails.Requestor_ID}" MessagePassword="${providerDetails.Password}"/>
        </Source>
      </POS>
      <TourActivityReservations>
        <TourActivityReservation>
          <Activities>
            <Activity>
              <ActivityRates>
                <ActivityRate BookingCode="${bookingObj.productOptionCode}">
                <Total AmountAfterTax="0.00" CurrencyCode="${bookingObj.currency}" />
                </ActivityRate>
              </ActivityRates>
              <TimeSpan Start="${bookingObj.travelDate}" End="${bookingObj.travelDate}"/>
              <BasicPropertyInfo ChainCode="${bookingObj.chainCode}"/>
              ${ResGuestRPH}
            </Activity>
          </Activities>
          ${passengersDetails}
          <ResGlobalInfo>
            <TourActivityReservationIDs>
              <TourActivityReservationID ResID_Type="16" ResID_Value="${bookingObj.bookingComponentId}"/>
            </TourActivityReservationIDs>
          </ResGlobalInfo>
        </TourActivityReservation>
      </TourActivityReservations>
      </OTAX_TourActivityResRQ>`;
  
      return queryString
  }
  catch (error) {
    console.log(error);  
  }  
}

// funtion to set passenger count in booking request
async function setPassengerCount(prefix){
  let ResGuestRPH = `<ResGuestRPHs>\n`;
    for(let i = 0; i < prefix.length; i++){
      if(i == 0){
        ResGuestRPH += `<ResGuestRPH>${1}</ResGuestRPH>\n`;
      }
      else{
        ResGuestRPH += `<ResGuestRPH>${i + 1}</ResGuestRPH>\n`;
      }  
    }
    ResGuestRPH += `</ResGuestRPHs>\n`;
    return ResGuestRPH;
}

module.exports = response;