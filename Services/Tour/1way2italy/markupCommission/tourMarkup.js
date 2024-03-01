/* =========================================================================================================== */
/* This Page is For find the markup price. 
    Request parameters are =>   client id / token
                                SupplierCost
                                RequestCurrencyCode
                                CheckInDate
                                CheckOutDate
                                NumberOfadult
                                NumberOfchild
                                NumberOfinfant
                            
*/
/* ============================================================================================================ */
'use strict';
const apiCommonController = require("../../../../Utility/APICommonController.js");
const MarkupDbApiReponse = require("./Response.js");
const moment = require("moment")
const config = require("../../../../Config.js");
const markupAndCommission = {
    findAgentMarkupAndCommission : async function(clientId, RequestParameters, accessToken, request, DBMarkupCommissionDataTest){
        let fName = "markup_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_MARKUP_PROVIDER_MARKUP_FILE_PATH, config.Provider_Code_OWT);

        try{
            
            //------------------------------------------------------------//
            // Get cartdata from request            
            let {requestParameters, tourDetails} = await handleRequestParameters(RequestParameters);
           
            let comapnyMarkupData = {};
            let agentMarkupData = {};
            let agentcommission = {};

            if(DBMarkupCommissionDataTest != undefined && !DBMarkupCommissionDataTest.Error){
                comapnyMarkupData = DBMarkupCommissionDataTest.comapnyMarkup;
                agentMarkupData = DBMarkupCommissionDataTest.agentmarkup;
                agentcommission = DBMarkupCommissionDataTest.agentcommission;
            }
            else{
                return (DBMarkupCommissionDataTest);
            };

            //------------------------Api response should be like---------------------------------//           
            let comapnyMarkupDataArr = [comapnyMarkupData];
            let agentMarkupDataArr = [agentMarkupData, agentcommission];
            let DBMarkupCommissionData = {
                "comapnyMarkupData" : comapnyMarkupDataArr,
                "agentMarkupData" : agentMarkupDataArr
            }

            //----------------------------------------//
            let tourStartTime =  tourDetails.startTime ?? 0;
            let tourEndDate = RequestParameters.endDate ?? "";

            // Get date and time 
            let tourStartDate;
            let tourStartDateData = await handleTourStartDate(tourDetails,RequestParameters);

            let {tourStartDateRes, tourEndDateRes, startDateRes, endDateRes } = await handleTourDates(RequestParameters,tourStartDateData,tourStartDate,tourEndDate );
            tourStartDate = tourStartDateRes;
            tourEndDate = tourEndDateRes;
            RequestParameters.startDate = startDateRes;
            RequestParameters.endDate = endDateRes;

           if(!RequestParameters.startDate){
            RequestParameters.startDate = RequestParameters.travelDate;
           };
           
           let tourEndDateResOne = await handleEndTimeAndDate(tourDetails, tourEndDate, clientId, tourStartTime, tourStartDate );
           tourEndDate= tourEndDateResOne;                  
            
            // Get the number of nights from start date and end date.
            let NumberOfNights = await this.getNumberOfNights(clientId, tourStartDate, tourEndDate, tourDetails.duration);
            NumberOfNights = NumberOfNights ?? 1;            

            // Get travelers details like how many trvelers where going;
            let NumberOfTravellers = 0;            
            // Calculating the travelers;
            let passangers = requestParameters.passengerDetails || requestParameters.searchObject.passengerDetails;
            let {adult, child, infant, traveler} = await handlePassengerCounts(passangers);
                        
            // Total number of travelers
            NumberOfTravellers = adult + child + infant + traveler;
            let NumberOfadult = parseInt(adult);
            let NumberOfchild = parseInt(child);
            let NumberOfinfant = parseInt(infant);

            // Supplier coast           
            let priceSummary = RequestParameters?.ActivityRates?.ActivityRate?.Total || RequestParameters?.ActivityRates?.ActivityRate || RequestParameters.pricingInfo?._attributes;

            // Supplier price which is partnerTotalPrice            
            let SupplierCost = await handleSupplierCost(priceSummary);            

            let iscommissionable = false;
            let SupplierConvertedCost = 0;
            //-------------------------------------------------------------//
            // If the DBmarkup commission date is undefined then return the current supplier price.
           if(!DBMarkupCommissionData){
                return({
                    SupplierCost: SupplierCost,
                    currencryconversationrate: 1,
                    SupplierConvertedCost: SupplierCost,
                    CompanyMarkup: 0,
                    TotalSupplierCostAfterCompanyMarkup: SupplierCost,
                    AgentMarkup: 0,
                    TotalSupplierCostAfterAgentMarkup: SupplierCost,
                    AgentCommission: 0,
                    TotalSupplierCostAfterAgentCommission: SupplierCost
                })
           };

            // Take currency conversationrate based on company data or agentdat
            let AgentsWiseData = [
                {
                    // Company data 
                    agentid: "21",
                    username: "CMAGT",
                    markupcategory: DBMarkupCommissionData.comapnyMarkupData
                },
                {
                    // Agent data
                    agentid: "",
                    username: "",
                    markupcategory: DBMarkupCommissionData.agentMarkupData
                }

            ]

            // Taking company markup data which is the username is CMAGT
            let CompanyAgentWiseData = AgentsWiseData.filter(item => item.username === "CMAGT");
            // Taking the agent markup data
            let AgentWiseData = AgentsWiseData.filter(item => item.username !== "CMAGT");
            // Taking markup for Agent category wise  markupcategory id 1, it also has is 5.
            let markupcategoryidwiseagent = AgentWiseData[0].markupcategory.filter(item => item.markupcategoryid === "1");
            // Taking maekup configuration calculation method UPB, UPN, PPB, PPN
            let markupconfigurationcalculationmethod = markupcategoryidwiseagent[0].markupconfigurationcalculationmethod;

            // Find company Markup
            let SupplierCostAfterCompanyMarkup = 0;
            let CompanyMarkup = 0;
            // Taking flag ignore company markup true or false .
            let flagignorecompanymarkup = markupcategoryidwiseagent[0].flagignorecompanymarkup;
            // Taking comapny agent wise data , markup category id 1.
            let markupcategoryidwisecompanyagent = CompanyAgentWiseData[0].markupcategory.filter(item => item.markupcategoryid === "1");

            // Price band criteria from db
            let PriceBandCriteria = markupcategoryidwiseagent[0].agentname;
            // Agent currency code
            let AgentCurrencyCode = markupcategoryidwiseagent[0].agentcurrancycode;
            // Currency conversationfactor for convert currency.
            let currencryconversationrate = markupcategoryidwiseagent[0].currancyconvertedfector;
            // Flag share markup commission
            let flagsharemarkupascommission = markupcategoryidwiseagent[0].flagsharemarkupascommission;

            // Supplier coast after converted using currency conversation factor.
            SupplierConvertedCost = parseFloat(SupplierCost) * parseFloat(currencryconversationrate);
            let companymarkupconfigurationcalculationmethod = markupcategoryidwisecompanyagent[0].markupconfigurationcalculationmethod;
            
            //--------------------------- Find company markup ---------------------------------------------------//

            // Checking UPB and UPN
            let TotalSupplierCostAfterCompanyMarkup;
            let reqParameter = {
                TotalSupplierCostAfterCompanyMarkup, 
                SupplierCostAfterCompanyMarkup, 
                NumberOfinfant, 
                NumberOfchild, 
                NumberOfadult, 
                NumberOfTravellers, 
                SupplierConvertedCost, 
                NumberOfNights, 
                flagignorecompanymarkup, 
                tourDetails, 
                CompanyMarkup, 
                markupcategoryidwisecompanyagent, 
                companymarkupconfigurationcalculationmethod
            }
            let totalSupplierCostAfterCompanyMarkupData = await setTotalSupplierCostAfterCompanyMarkupData(reqParameter);
            TotalSupplierCostAfterCompanyMarkup = totalSupplierCostAfterCompanyMarkupData.TotalSupplierCostAfterCompanyMarkup;
            CompanyMarkup = totalSupplierCostAfterCompanyMarkupData.CompanyMarkup;
            SupplierCostAfterCompanyMarkup = totalSupplierCostAfterCompanyMarkupData.SupplierCostAfterCompanyMarkup;

            //-------------------------- End Comapny Markup ---------------------------------------------//

            //---------------------------- Find Agent Markup --------------------------------------------//

            let SupplierCostAfterAgentMarkup = 0;
            let AgentMarkup = 0;
            let TotalSupplierCostAfterAgentMarkup;
            let reqParameters = {
                NumberOfadult, 
                NumberOfchild, 
                NumberOfinfant, 
                NumberOfTravellers, 
                tourDetails, 
                markupcategoryidwiseagent, 
                NumberOfNights, 
                SupplierCostAfterCompanyMarkup, 
                companymarkupconfigurationcalculationmethod, 
                markupconfigurationcalculationmethod,
                TotalSupplierCostAfterAgentMarkup, 
                AgentMarkup, 
                SupplierCostAfterAgentMarkup
            }
            let totalSupplierCostAfterAgentMarkupData = await setTotalSupplierCostAfterAgentMarkup(reqParameters)
            AgentMarkup = totalSupplierCostAfterAgentMarkupData.AgentMarkup
            SupplierCostAfterAgentMarkup = totalSupplierCostAfterAgentMarkupData.SupplierCostAfterAgentMarkup
            TotalSupplierCostAfterAgentMarkup = totalSupplierCostAfterAgentMarkupData.TotalSupplierCostAfterAgentMarkup

            //------------------------------ End Agent Markup ----------------------------------------------//

            //----------------------------- Find Agent Commission ------------------------------------------//

            let SupplierCostAfterAgentCommission = 0;
            let AgentCommission = 0;
            let TotalSupplierCostAfterAgentCommission;
            // If flag sharemarkup as commission is false then only calculate agent Commission
            let reqParameterData = {
                SupplierCostAfterCompanyMarkup, 
                TotalSupplierCostAfterCompanyMarkup, 
                AgentMarkup, 
                tourDetails, 
                TotalSupplierCostAfterAgentCommission, 
                SupplierCostAfterAgentCommission, 
                AgentCommission, 
                NumberOfNights, 
                markupconfigurationcalculationmethod,
                AgentWiseData, 
                flagsharemarkupascommission, 
                SupplierCostAfterAgentMarkup, 
                NumberOfadult, 
                NumberOfchild, 
                NumberOfinfant, 
                NumberOfTravellers,
                TotalSupplierCostAfterAgentMarkup,
                iscommissionable
            }
            let supplierCostAfterAgentCommissionData = await setSupplierCostAfterAgentCommission(reqParameterData)
            AgentCommission = supplierCostAfterAgentCommissionData.AgentCommission;
            TotalSupplierCostAfterAgentCommission = supplierCostAfterAgentCommissionData.TotalSupplierCostAfterAgentCommission;
            iscommissionable = supplierCostAfterAgentCommissionData.iscommissionable;

            if(typeof AgentMarkup == 'object'){
            
                AgentMarkup = +(Number.parseFloat(AgentMarkup?.adultvalue + AgentMarkup?.childvalue + AgentMarkup?.infantvalue).toFixed(2))
            }

            // The response data.
            let responsedata = {
                SupplierCost: SupplierCost,
                AgentCurrencyCode: AgentCurrencyCode,
                currencryconversationrate: currencryconversationrate,
                SupplierConvertedCost: SupplierConvertedCost,
                CompanyMarkup: CompanyMarkup,
                TotalSupplierCostAfterCompanyMarkup: TotalSupplierCostAfterCompanyMarkup,
                AgentMarkup: AgentMarkup,
                TotalSupplierCostAfterAgentMarkup: TotalSupplierCostAfterAgentMarkup,
                iscommissionable: iscommissionable,
                AgentCommission: AgentCommission,
                PriceBandCriteria : (PriceBandCriteria != undefined && PriceBandCriteria !== "") ? PriceBandCriteria : "",
                TotalSupplierCostAfterAgentCommission: TotalSupplierCostAfterAgentCommission
            }
            request.body = RequestParameters;
            return (responsedata);
        }
        catch(error){
            // Handle error safely and add logs
            console.log(error);
            const errorObject = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            };
            apiCommonController.getError(errorObj, fName, fPath, errorObject);
            return(errorObject);
           
        }
    },

    findfixmarkup: function (markupcategoryidwisecompanyagent, RequestParameters) {
        try {
            let fixmarkup = 0;
            let BookingDate = new Date();
            let tourStartDate = new Date(RequestParameters.startDate);
            let bookingfromdate = new Date(markupcategoryidwisecompanyagent[0].bookingfromdate);
            let bookingtodate = new Date(markupcategoryidwisecompanyagent[0].bookingtodate);
            let servicefromdate = new Date(markupcategoryidwisecompanyagent[0].servicefromdate);
            let servicetodate = new Date(markupcategoryidwisecompanyagent[0].servicetodate);

            if (BookingDate >= bookingfromdate && BookingDate <= bookingtodate && tourStartDate >= servicefromdate && tourStartDate <= servicetodate) {
                fixmarkup = parseFloat(markupcategoryidwisecompanyagent[0].value);
            }
            return fixmarkup;
        }
        catch (err) {
            return (err);
        }
    },

    findpercentagemarkup: function (markupcategoryidwisecompanyagent, RequestParameters, Cost) {
        try {
            let percentagemarkup = "";
            let BookingDate = new Date();
            let CheckInDate = new Date(RequestParameters.startDate);
            let bookingfromdate = new Date(markupcategoryidwisecompanyagent[0].bookingfromdate);
            let bookingtodate = new Date(markupcategoryidwisecompanyagent[0].bookingtodate);
            let servicefromdate = new Date(markupcategoryidwisecompanyagent[0].servicefromdate);
            let servicetodate = new Date(markupcategoryidwisecompanyagent[0].servicetodate);

            if (BookingDate >= bookingfromdate && BookingDate <= bookingtodate && CheckInDate >= servicefromdate && CheckInDate <= servicetodate) {

                if (markupcategoryidwisecompanyagent[0].markupconfigurationdetailcalculationmethod === "MKU") {

                    percentagemarkup = (Cost * parseFloat(markupcategoryidwisecompanyagent[0].value)) / 100;


                }
                else if (markupcategoryidwisecompanyagent[0].markupconfigurationdetailcalculationmethod === "MRG") {
                    
                    percentagemarkup = (Cost * parseFloat(markupcategoryidwisecompanyagent[0].value)) / (100 - parseFloat(markupcategoryidwisecompanyagent[0].value));

                }
            }
            else {

                percentagemarkup = 0;
               
            }
            return percentagemarkup;
        }
        catch (err) {
            return (err);
        }
    },

    findpaxwisefixmarkup: function (markupcategoryidwisecompanyagent, RequestParameters) {
        try {
            let paxwisefixmarkup = "";
            let BookingDate = new Date();
            let CheckInDate = new Date(RequestParameters.startDate);
            let bookingfromdate = new Date(markupcategoryidwisecompanyagent[0].bookingfromdate);
            let bookingtodate = new Date(markupcategoryidwisecompanyagent[0].bookingtodate);
            let servicefromdate = new Date(markupcategoryidwisecompanyagent[0].servicefromdate);
            let servicetodate = new Date(markupcategoryidwisecompanyagent[0].servicetodate);

            if (BookingDate >= bookingfromdate && BookingDate <= bookingtodate && CheckInDate >= servicefromdate && CheckInDate <= servicetodate) {
                paxwisefixmarkup = {
                    adultvalue: parseFloat(markupcategoryidwisecompanyagent[0].adultvalue),
                    childvalue: parseFloat(markupcategoryidwisecompanyagent[0].childvalue),
                    infantvalue: parseFloat(markupcategoryidwisecompanyagent[0].infantvalue)
                }
            }
            else {
                paxwisefixmarkup = {
                    adultvalue: 0,
                    childvalue: 0,
                    infantvalue: 0
                };
            }
            return paxwisefixmarkup;
        }
        catch (err) {
            return (err);
        }
    },

    findpaxwisepercentagemarkup: function (markupcategoryidwisecompanyagent, RequestParameters, Cost) {
        try {
            let BookingDate = new Date();
            let CheckInDate = new Date(RequestParameters.startDate);
            let bookingfromdate = new Date(markupcategoryidwisecompanyagent[0].bookingfromdate);
            let bookingtodate = new Date(markupcategoryidwisecompanyagent[0].bookingtodate);
            let servicefromdate = new Date(markupcategoryidwisecompanyagent[0].servicefromdate);
            let servicetodate = new Date(markupcategoryidwisecompanyagent[0].servicetodate);
            let NumberOfadult = parseInt(RequestParameters.NumberOfadult);
            let NumberOfchild = parseInt(RequestParameters.NumberOfchild);
            let NumberOfinfant = parseInt(RequestParameters.NumberOfinfant);
            let percentagemarkup = {
                adultvalue: 0,
                childvalue: 0,
                infantvalue: 0
            };

            if (BookingDate >= bookingfromdate && BookingDate <= bookingtodate && CheckInDate >= servicefromdate && CheckInDate <= servicetodate) {
                if (markupcategoryidwisecompanyagent[0].markupconfigurationdetailcalculationmethod === "MKU") {
                    
                    let {adultvalueRes,childvalueRes,infantvalueRes} = handleMKUPassengers(NumberOfadult,NumberOfchild,NumberOfinfant,Cost,markupcategoryidwisecompanyagent );                    
                    percentagemarkup = {
                        adultvalue: adultvalueRes,
                        childvalue: childvalueRes,
                        infantvalue: infantvalueRes
                    };

                }
                else if (markupcategoryidwisecompanyagent[0].markupconfigurationdetailcalculationmethod === "MRG") {

                    let {adultvalueRes,childvalueRes,infantvalueRes} = handleMRGPassengers(NumberOfadult,NumberOfchild,NumberOfinfant,Cost ,markupcategoryidwisecompanyagent );
                    
                    percentagemarkup = {
                        adultvalue: adultvalueRes,
                        childvalue: childvalueRes,
                        infantvalue: infantvalueRes
                    };
                }
            };
            return percentagemarkup;
        }
        catch (err) {
            return (err);
        }
    },

    convertDurationToEndDate : async function(clientId, startDate, duration, startTime){
        try{            
            let travelDate = moment(startDate);
            let durationMinutes = duration;
            // Find the end date and end time 
            //---------------------------------------//
            if (startTime) {
                let [hours, minutes] = startTime.split(':').map(Number);
                travelDate.set({ hours, minutes });
            }  
            let endDate = travelDate.clone().add(durationMinutes, 'minutes')
            endDate = endDate.format('YYYY-MM-DD');
            let endTime = travelDate.clone().add(durationMinutes, 'minutes')
            endTime = endTime.format('HH:mm')
            
            return ({
                endDate : endDate,
                endTime : endTime
            })
        }
        catch(error){                       
            // Send Error response
            return({
                STATUS: "ERROR",
                RESPONSE: {
                    text: error.message
                }
            });
        }
        
    },

    getNumberOfNights : async function(clientId, StartDate, EndDate, duration){
        try{            

            // Step 1: Parse the start date and end date using moment.js
            let startDate = moment(StartDate);
            let endDate = moment(EndDate);

            // Step 2: Calculate the number of nights between start and end date
            let numberOfNights = endDate.diff(startDate, 'days');

            if(numberOfNights < 1){
                numberOfNights = 1;
            };           
            return numberOfNights;
        }
        catch(error){

            // Send Error response
            return({
                STATUS: "ERROR",
                RESPONSE: {
                    text: error.message
                }
            });
        }
    }
    

}

// Function to handle passenger counts for MKU  markup configuration method
function handleMKUPassengers(NumberOfadult,NumberOfchild,NumberOfinfant,Cost,markupcategoryidwisecompanyagent ){
    let adultvalue = 0;
    let childvalue = 0;
    let infantvalue = 0;
    if (NumberOfadult > 0) {
        adultvalue = (Cost.adultvalue * parseFloat(markupcategoryidwisecompanyagent[0].adultvalue)) / 100;
    };
    if (NumberOfchild > 0) {
        childvalue = (Cost.childvalue * parseFloat(markupcategoryidwisecompanyagent[0].childvalue)) / 100;
    };
    if (NumberOfinfant > 0) {
        infantvalue = (Cost.infantvalue * parseFloat(markupcategoryidwisecompanyagent[0].infantvalue)) / 100;
    };
    return {"adultvalueRes":adultvalue ,"childvalueRes":childvalue,"infantvalueRes":infantvalue};
};

// Function to handle passenger counts for MRG markup configuration method
function handleMRGPassengers(NumberOfadult,NumberOfchild,NumberOfinfant,Cost ,markupcategoryidwisecompanyagent ){
    let adultvalue = 0;
    let childvalue = 0;
    let infantvalue = 0;

    if (NumberOfadult > 0) {
        adultvalue = (Cost.adultvalue * parseFloat(markupcategoryidwisecompanyagent[0].adultvalue)) / (100 - parseFloat(markupcategoryidwisecompanyagent[0].adultvalue));
    };
    if (NumberOfchild > 0) {
        childvalue = (Cost.childvalue * parseFloat(markupcategoryidwisecompanyagent[0].childvalue)) / (100 - parseFloat(markupcategoryidwisecompanyagent[0].childvalue));
    };
    if (NumberOfinfant > 0) {
        infantvalue = (Cost.infantvalue * parseFloat(markupcategoryidwisecompanyagent[0].infantvalue)) / (100 - parseFloat(markupcategoryidwisecompanyagent[0].infantvalue));
    };
    return {"adultvalueRes":adultvalue,"childvalueRes":childvalue,"infantvalueRes":infantvalue};
};

// Function handle request parameters and tourdetails
async function handleRequestParameters(RequestParameters){
    let requestParameters;
    let tourDetails;
    if(RequestParameters.cartData){
        requestParameters = RequestParameters?.cartData[0];
        tourDetails = requestParameters.tourDetails;
    }
    else{
        requestParameters = RequestParameters;
        tourDetails = RequestParameters
    };
    return {"requestParameters": requestParameters, "tourDetails": tourDetails};
};

//Function to handle tour start date
async function handleTourStartDate(tourDetails,RequestParameters){
    let tourStartDate = "";
    if(tourDetails.startDate){
        tourStartDate = new Date(tourDetails.startDate);
        return tourStartDate;
    }
    else if(RequestParameters.startDate){
        tourStartDate = new Date(RequestParameters.startDate);
        return tourStartDate;
    }
    else if(RequestParameters.travelDate){
        tourStartDate = new Date(RequestParameters.travelDate);
        return tourStartDate;
    }
    else {
        return tourStartDate;
    }
};

//Function to handle start and end dates
async function handleTourDates(RequestParameters,tourStartDateData,tourStartDate,tourEndDate ){
    let startDate = '';
    let endDate = '';
    let tourStartDateValue ;
    let tourEndDateValue = tourEndDate;
    if(RequestParameters.searchObject){
        tourStartDateValue = new Date(RequestParameters.searchObject.startDate);
        tourEndDateValue = new Date(RequestParameters.searchObject.endDate)
        startDate = RequestParameters.searchObject.startDate;
        endDate = RequestParameters.searchObject.endDate;
    }else{
        tourStartDateValue = tourStartDateData;
    };
    return {"tourStartDateRes" :tourStartDateValue, "tourEndDateRes":tourEndDateValue, "startDateRes":startDate, "endDateRes":endDate };
};

//Function to handle tour endtime and date
async function handleEndTimeAndDate(tourDetails, tourEndDate, clientId, tourStartTime, tourStartDate ){
    let tourEndDateVal = tourEndDate;
    // Checking the duration is not empty then getting the end date and end time.
    if(tourDetails.duration != "" && tourDetails.duration != "00" && !tourEndDate){
        let endTimeAndDate = await markupAndCommission.convertDurationToEndDate(clientId, tourStartDate, tourDetails.duration, tourStartTime);
        tourEndDateVal = endTimeAndDate.endDate;
    };
    return tourEndDateVal ;
};

//Function to handle passenger counts
async function handlePassengerCounts(passangers){
    let adult = 0;
    let child = 0;
    let infant = 0;
    let traveler = 0;
    if(!Array.isArray(passangers)){
        let {adultVal, childVal, infantVal, travelerVal } = await setPassengerCounts(passangers);
        adult = adultVal;
        child = childVal;
        infant = infantVal;
        traveler = travelerVal;
    }
    else{
        let {adultVal, childVal, infantVal, travelerVal } = await setPassengerCountValues(passangers);
        adult = adultVal;
        child = childVal;
        infant = infantVal;
        traveler = travelerVal;
    };
    return { "adult":adult, "child":child, "infant":infant, "traveler":traveler}
};

//Function to set passenger counts
async function setPassengerCounts(passangers){
    let adult = 0;
    let child = 0;
    let infant = 0;
    let traveler = 0;
    if(passangers.adult){
        adult = passangers.adult;
    };
    if(passangers.child){
        child = passangers.child;
    };
    if(passangers.infant){
        infant = passangers.infant;
    };
    if(passangers.traveler){
        traveler = passangers.traveler;
    };
    return {"adultVal": adult, "childVal": child, "infantVal": infant, "travelerVal": traveler };
};

//Function to set passenger counts
async function setPassengerCountValues(passangers){
    let adult = 0;
    let child = 0;
    let infant = 0;
    let traveler = 0;
    for(let passengerData of passangers){
        switch(passengerData.ageBand){
            case "ADULT":
                adult = passengerData.numberOfTravelers;
                break;
            case "CHILD" : 
                child = passengerData.numberOfTravelers;
                break;
            case "INFANT":
                infant = passengerData.numberOfTravelers;
                break;
            case "TRAVELER" : 
                traveler = passengerData.numberOfTravelers;
                break;
            case "YOUTH":
            case "SENIOR" : 
                if(adult != 0){
                    adult = adult + passengerData.numberOfTravelers;
                }
                else{
                    adult = passengerData.numberOfTravelers;
                }
                break;
            default:
                break
        };
    };
    return {"adultVal": adult, "childVal": child, "infantVal": infant, "travelerVal": traveler };
};

//Function to handle supplier cost
async function handleSupplierCost(priceSummary){
    let SupplierCost = 0;
    if(priceSummary.partnerTotalPrice){
        SupplierCost = priceSummary.partnerTotalPrice;
        return SupplierCost;
    }
    else if(priceSummary.fromPrice){
        SupplierCost = priceSummary.fromPrice;
        return SupplierCost;
    }
    else if(priceSummary.Total){
        SupplierCost = priceSummary.Total._attributes
        return SupplierCost;
    }
    else if(priceSummary.AmountAfterTax){
        SupplierCost = priceSummary.AmountAfterTax
        return SupplierCost;
    }           
    else if(priceSummary._attributes){
        SupplierCost = priceSummary._attributes.AmountAfterTax
        return SupplierCost;
    }else{
        return SupplierCost;
    }
};

//Function to handle fixed and percentage markup
async function handleFixedAndPercentageMarkup(markupcategoryidwisecompanyagent,tourDetails, CompanyMarkup, UPBSupplierConvertedCost ){
    let CompanyMarkupInput = CompanyMarkup;
    // Find Fix Markup
    if (markupcategoryidwisecompanyagent[0].valuetype.trim() === "F") {  
        // Get fixed markup value
        let findfixmarkup = markupAndCommission.findfixmarkup(markupcategoryidwisecompanyagent, tourDetails);

        CompanyMarkupInput = findfixmarkup;
        return CompanyMarkupInput;
    }
    // Find Percentage Markup
    else if (markupcategoryidwisecompanyagent[0].valuetype.trim() === "P") {  
        // Get percentage markup value.
        let findpercentagemarkup = markupAndCommission.findpercentagemarkup(markupcategoryidwisecompanyagent, tourDetails, UPBSupplierConvertedCost);
        
        CompanyMarkupInput = findpercentagemarkup;
        return CompanyMarkupInput;
    } else {
        return CompanyMarkupInput;
    }

};

//Function to hanldle markup
async function handlePercentageAndFixMarkup(markupcategoryidwisecompanyagent, CompanyMarkup, tourDetails, PPBSupplierConvertedCost){
    let CompanyMarkupInput = CompanyMarkup;
    // Find Fix Markup
    if (markupcategoryidwisecompanyagent[0].valuetype.trim() === "F") {
        let findpaxwisefixmarkup = markupAndCommission.findpaxwisefixmarkup(markupcategoryidwisecompanyagent, tourDetails);
        CompanyMarkupInput = findpaxwisefixmarkup;
        return CompanyMarkupInput;
    }
    // Find Percentage Markup
    else if (markupcategoryidwisecompanyagent[0].valuetype.trim() === "P") {
        let findpaxwisepercentagemarkup = markupAndCommission.findpaxwisepercentagemarkup(markupcategoryidwisecompanyagent, tourDetails, PPBSupplierConvertedCost);
        CompanyMarkupInput = findpaxwisepercentagemarkup;
        return CompanyMarkupInput;
    } else {
        return CompanyMarkupInput;
    }
};

//Function to handle agent markup
async function handleAgentMarkup(markupcategoryidwiseagent,AgentMarkup, tourDetails, UPBagentSupplierCostAfterCompanyMarkup ){
    let AgentMarkupInput = AgentMarkup;
    // Find fixed value
    if (markupcategoryidwiseagent[0].valuetype.trim() === "F") {

        let findfixmarkup = markupAndCommission.findfixmarkup(markupcategoryidwiseagent, tourDetails);
        AgentMarkupInput = findfixmarkup;
        return AgentMarkupInput;

    }
    // Find percentage value.
    else if (markupcategoryidwiseagent[0].valuetype.trim() === "P") {

        let findpercentagemarkup = markupAndCommission.findpercentagemarkup(markupcategoryidwiseagent, tourDetails, UPBagentSupplierCostAfterCompanyMarkup);                    
        AgentMarkupInput = findpercentagemarkup;
        return AgentMarkupInput;
    } else {
        return AgentMarkupInput;
    }
};

//Function to handle agent fixed and percentage markup
async function setAgentFixedAndPercentageMarkup(markupcategoryidwiseagent,AgentMarkup,tourDetails, PPBagentSupplierCostAfterCompanyMarkup){
    let AgentMarkupInput = AgentMarkup;
    // Find the fixed value
    if (markupcategoryidwiseagent[0].valuetype.trim() === "F") {

        let findpaxwisefixmarkup = markupAndCommission.findpaxwisefixmarkup(markupcategoryidwiseagent, tourDetails);
        AgentMarkupInput = findpaxwisefixmarkup;
        return AgentMarkupInput;
    }
    // Find the percentage value
    else if (markupcategoryidwiseagent[0].valuetype.trim() === "P") {

        let findpaxwisepercentagemarkup = markupAndCommission.findpaxwisepercentagemarkup(markupcategoryidwiseagent, tourDetails, PPBagentSupplierCostAfterCompanyMarkup);
        AgentMarkupInput = findpaxwisepercentagemarkup;
        return AgentMarkupInput;
    } else {
        return AgentMarkupInput;
    }
};

//Function to handle agent markup
async function handleAgentCommission(AgentCommission, markupcategoryidofcommissionwiseagent, tourDetails, UPBagentcommissionSupplierCostAfterAgentmarkup){
    let AgentCommissionInput = AgentCommission;
    // Find the fixed value
    if (markupcategoryidofcommissionwiseagent[0].valuetype.trim() === "F") {
        let findfixmarkup = markupAndCommission.findfixmarkup(markupcategoryidofcommissionwiseagent, tourDetails);
        AgentCommissionInput = findfixmarkup;
        return AgentCommissionInput;
    }
    // Find the percentage value
    else if (markupcategoryidofcommissionwiseagent[0].valuetype.trim() === "P") {
        let findpercentagemarkup = markupAndCommission.findpercentagemarkup(markupcategoryidofcommissionwiseagent, tourDetails, UPBagentcommissionSupplierCostAfterAgentmarkup);
        AgentCommissionInput = findpercentagemarkup;
        return AgentCommissionInput;
    } else {
        return AgentCommissionInput;
    }
};

//Function to handle agent commission
async function setAgentCommissionData(AgentCommission, markupcategoryidofcommissionwiseagent,tourDetails, PPBagentcommissionSupplierCostAfterAgentmarkup){
    let AgentCommissionInput = AgentCommission;
    // Fixed value
    if (markupcategoryidofcommissionwiseagent[0].valuetype.trim() === "F") {

        let findpaxwisefixmarkup = markupAndCommission.findpaxwisefixmarkup(markupcategoryidofcommissionwiseagent, tourDetails);
        AgentCommissionInput = findpaxwisefixmarkup;
        return AgentCommissionInput;
    }
    else if (markupcategoryidofcommissionwiseagent[0].valuetype.trim() === "P") {

        let findpaxwisepercentagemarkup = markupAndCommission.findpaxwisepercentagemarkup(markupcategoryidofcommissionwiseagent, tourDetails, PPBagentcommissionSupplierCostAfterAgentmarkup);
        AgentCommissionInput = findpaxwisepercentagemarkup;
        return AgentCommissionInput;
    } else {
        return AgentCommissionInput;
    }
};

//Function to handle unit per booking converted cost
async function handleUPBSupplierConvertedCost(companymarkupconfigurationcalculationmethod, SupplierConvertedCost, NumberOfNights){
    let UPBSupplierConvertedCost = 0;
    if (companymarkupconfigurationcalculationmethod === "UPB") {    
        UPBSupplierConvertedCost = SupplierConvertedCost;
        return UPBSupplierConvertedCost;
    }
    // Convert Per Unit Per Night wise price
    else if (companymarkupconfigurationcalculationmethod === "UPN") {   
        UPBSupplierConvertedCost = SupplierConvertedCost / NumberOfNights;
        return UPBSupplierConvertedCost;
    } else {
        return UPBSupplierConvertedCost;
    }
};

//Function to handle UPB Supplier cost
async function  handleUPBSupplierCostAfterCompanyMarkup(flagignorecompanymarkup, UPBSupplierConvertedCost, CompanyMarkup){
    let UPBSupplierCostAfterCompanyMarkup;
    if (flagignorecompanymarkup === false) { 
        // Adding   UPB Supplier Converted Cost + company markup
        UPBSupplierCostAfterCompanyMarkup = UPBSupplierConvertedCost + CompanyMarkup;
        return UPBSupplierCostAfterCompanyMarkup;
    }
    else {
        UPBSupplierCostAfterCompanyMarkup = UPBSupplierConvertedCost;
        return UPBSupplierCostAfterCompanyMarkup;
    };
};

// Function to handle supplier cost after company markup
async function handleSupplierCostAfterCompanyMarkup(companymarkupconfigurationcalculationmethod, UPBSupplierCostAfterCompanyMarkup, NumberOfNights ){
    let SupplierCostAfterCompanyMarkup = 0;
    // Calculating supplier coast after comapny markup in UPB 
    if (companymarkupconfigurationcalculationmethod === "UPB") {
        SupplierCostAfterCompanyMarkup = UPBSupplierCostAfterCompanyMarkup;
        return SupplierCostAfterCompanyMarkup;
    }
    // If UPN cheking with number of nights.
    else if (companymarkupconfigurationcalculationmethod === "UPN") {
        SupplierCostAfterCompanyMarkup = UPBSupplierCostAfterCompanyMarkup * NumberOfNights;
        return SupplierCostAfterCompanyMarkup;
    }else{
        return SupplierCostAfterCompanyMarkup;
    }
};

//Function to convert per person wise booking price
async function handleperpersonwisevalu1(companymarkupconfigurationcalculationmethod, SupplierConvertedCost, NumberOfTravellers, NumberOfNights){
    let perpersonwisevalu1;
    if (companymarkupconfigurationcalculationmethod === "PPB") {    
        perpersonwisevalu1 = SupplierConvertedCost / NumberOfTravellers;
        return perpersonwisevalu1;
    }
    // Convert Per Person Per Night wise price
    else if (companymarkupconfigurationcalculationmethod === "PPN") {   
        perpersonwisevalu1 = SupplierConvertedCost / NumberOfTravellers / NumberOfNights;
        return perpersonwisevalu1;
    } else {
        return perpersonwisevalu1;
    }
};

//Function to handle individual traveler price
async function handleIndividualTravelerPrice(NumberOfadult,NumberOfchild,NumberOfinfant, perpersonwisevalu1){
    let adultvalue1 = 0;
    let childvalue1 = 0;
    let infantvalue1 = 0;
    if (NumberOfadult > 0) {
        adultvalue1 = perpersonwisevalu1;
    };
    if (NumberOfchild > 0) {
        childvalue1 = perpersonwisevalu1;
    };
    if (NumberOfinfant > 0) {
        infantvalue1 = perpersonwisevalu1;
    };
    return { "adultvalue1":adultvalue1,"childvalue1":childvalue1,"infantvalue1":infantvalue1 };
};

//Function to handle PPB supplier cost after company markup
async function handlePPBSupplierCostAfterCompanyMarkup(flagignorecompanymarkup, NumberOfadult,NumberOfchild,NumberOfinfant,PPBSupplierConvertedCost,CompanyMarkup ){
    let PPBSupplierCostAfterCompanyMarkup;
    if (flagignorecompanymarkup === false) {    
        // Taking each passangers value individually.
        let adultvalue = 0;
        let childvalue = 0;
        let infantvalue = 0;

        if (NumberOfadult > 0) {
            adultvalue = PPBSupplierConvertedCost.adultvalue + CompanyMarkup.adultvalue;
        };
        if (NumberOfchild > 0) {
            childvalue = PPBSupplierConvertedCost.childvalue + CompanyMarkup.childvalue;
        };
        if (NumberOfinfant > 0) {
            infantvalue = PPBSupplierConvertedCost.infantvalue + CompanyMarkup.infantvalue;
        };
        // Each passanger total value as an object
        PPBSupplierCostAfterCompanyMarkup = {
            adultvalue: adultvalue,
            childvalue: childvalue,
            infantvalue: infantvalue,
            total: adultvalue + childvalue + infantvalue
        };
        return PPBSupplierCostAfterCompanyMarkup;
    }
    else {
        PPBSupplierCostAfterCompanyMarkup = PPBSupplierConvertedCost;
        return PPBSupplierCostAfterCompanyMarkup;
    };
};

//Function to hanlde per person cost
async function handlePerPersonCost(companymarkupconfigurationcalculationmethod,adultvalue2,childvalue2, infantvalue2){
    let SupplierCostAfterCompanyMarkup = 0;
    if (companymarkupconfigurationcalculationmethod === "PPB") {
        // Person per booking price object
        SupplierCostAfterCompanyMarkup = {
            adultvalue: adultvalue2,
            childvalue: childvalue2,
            infantvalue: infantvalue2
        };
        return SupplierCostAfterCompanyMarkup;
    }
    else if (companymarkupconfigurationcalculationmethod === "PPN") {
        // Per person per night values
        SupplierCostAfterCompanyMarkup = {
            adultvalue: adultvalue2 * NumberOfNights,
            childvalue: childvalue2 * NumberOfNights,
            infantvalue: infantvalue2 * NumberOfNights
        };
        return SupplierCostAfterCompanyMarkup;
    } else {
        return SupplierCostAfterCompanyMarkup;
    }
};

//Function to handle UPB agent cost
async function handleUPBagentSupplierCostAfterCompanyMarkup(markupconfigurationcalculationmethod, companymarkupconfigurationcalculationmethod, SupplierCostAfterCompanyMarkup, NumberOfNights){
    let UPBagentSupplierCostAfterCompanyMarkup = 0;
    if (markupconfigurationcalculationmethod === "UPB") {
        // Calculating UPB value
        if (companymarkupconfigurationcalculationmethod === "UPB" || companymarkupconfigurationcalculationmethod === "UPN") {
            UPBagentSupplierCostAfterCompanyMarkup = SupplierCostAfterCompanyMarkup;
            return UPBagentSupplierCostAfterCompanyMarkup;
        }
        else {
            UPBagentSupplierCostAfterCompanyMarkup = SupplierCostAfterCompanyMarkup.adultvalue + SupplierCostAfterCompanyMarkup.childvalue + SupplierCostAfterCompanyMarkup.infantvalue;
            return UPBagentSupplierCostAfterCompanyMarkup;
        }
    }
    else if (markupconfigurationcalculationmethod === "UPN") {
        // Calculating unit per night price.
        if (companymarkupconfigurationcalculationmethod === "UPB" || companymarkupconfigurationcalculationmethod === "UPN") {
            UPBagentSupplierCostAfterCompanyMarkup = SupplierCostAfterCompanyMarkup / NumberOfNights;
            return UPBagentSupplierCostAfterCompanyMarkup;
        }
        else {
            UPBagentSupplierCostAfterCompanyMarkup = (SupplierCostAfterCompanyMarkup.adultvalue + SupplierCostAfterCompanyMarkup.childvalue + SupplierCostAfterCompanyMarkup.infantvalue) / NumberOfNights;
            return UPBagentSupplierCostAfterCompanyMarkup;
        };
    } else {
        return UPBagentSupplierCostAfterCompanyMarkup;
    }
};

//Function to hanlde supplier cost after agent markup
async function handleSupplierCostAfterAgentMarkup(markupconfigurationcalculationmethod, UPBSupplierCostAfterAgentMarkup, NumberOfNights ){
    let SupplierCostAfterAgentMarkup = 0;
    // UPB
    if (markupconfigurationcalculationmethod === "UPB") {
        SupplierCostAfterAgentMarkup = UPBSupplierCostAfterAgentMarkup;
        return SupplierCostAfterAgentMarkup;
    }
    // UPN
    else if (markupconfigurationcalculationmethod === "UPN") {
        SupplierCostAfterAgentMarkup = UPBSupplierCostAfterAgentMarkup * NumberOfNights;
        return SupplierCostAfterAgentMarkup;
    } else {
        return SupplierCostAfterAgentMarkup;
    }
};

//Function to handle the per person or person per night cost
async function handlePersonPerBookingAndNight({markupconfigurationcalculationmethod, companymarkupconfigurationcalculationmethod,SupplierCostAfterCompanyMarkup,NumberOfadult,NumberOfchild,NumberOfinfant,NumberOfTravellers,NumberOfNights }){
    let adultvalue1 = 0;
    let childvalue1 = 0;
    let infantvalue1 = 0;
    if (markupconfigurationcalculationmethod === "PPB") {
        let { adultValRes, chidValRes, infantValRes } = await setPPBPassengerCount(companymarkupconfigurationcalculationmethod,SupplierCostAfterCompanyMarkup,NumberOfadult, NumberOfchild, NumberOfinfant,NumberOfTravellers);
        adultvalue1= adultValRes;
        childvalue1= chidValRes;
        infantvalue1= infantValRes;
        return {"adultvalue1":adultvalue1, "childvalue1":childvalue1, "infantvalue1":infantvalue1};
    }
    else if (markupconfigurationcalculationmethod === "PPN") {
        let { adultValRes, chidValRes, infantValRes } = await setPPNPassengerCount(companymarkupconfigurationcalculationmethod, NumberOfadult, NumberOfchild, NumberOfinfant, SupplierCostAfterCompanyMarkup, NumberOfNights,NumberOfTravellers);
        adultvalue1= adultValRes;
        childvalue1= chidValRes;
        infantvalue1= infantValRes;   
        return {"adultvalue1":adultvalue1, "childvalue1":childvalue1, "infantvalue1":infantvalue1};   
    } else {
        return {"adultvalue1":adultvalue1, "childvalue1":childvalue1, "infantvalue1":infantvalue1};
    }
};

//Function to handle PPB passenger count
async function setPPBPassengerCount(companymarkupconfigurationcalculationmethod,SupplierCostAfterCompanyMarkup,NumberOfadult, NumberOfchild, NumberOfinfant,NumberOfTravellers){
    let adultvalue1 = 0;
    let childvalue1 = 0;
    let infantvalue1 = 0;
    if (NumberOfadult > 0) {
        adultvalue1 = SupplierCostAfterCompanyMarkup / NumberOfTravellers;
    };
    if (NumberOfchild > 0) {
        childvalue1 = SupplierCostAfterCompanyMarkup / NumberOfTravellers;
    };
    if (NumberOfinfant > 0) {
        infantvalue1 = SupplierCostAfterCompanyMarkup / NumberOfTravellers;
    };
    if (companymarkupconfigurationcalculationmethod === "PPB" || companymarkupconfigurationcalculationmethod === "PPN") {
        if (NumberOfadult > 0) {
            adultvalue1 = SupplierCostAfterCompanyMarkup.adultvalue / NumberOfadult;
        };
        if (NumberOfchild > 0) {
            childvalue1 = SupplierCostAfterCompanyMarkup.childvalue / NumberOfchild;
        };
        if (NumberOfinfant > 0) {
            infantvalue1 = SupplierCostAfterCompanyMarkup.infantvalue / NumberOfinfant;
        };
    };    
    return {"adultValRes" : adultvalue1, "chidValRes":childvalue1, "infantValRes" :infantvalue1};
};

//Function to handle PPN Passenger count
async function setPPNPassengerCount(companymarkupconfigurationcalculationmethod, NumberOfadult, NumberOfchild, NumberOfinfant, SupplierCostAfterCompanyMarkup, NumberOfNights,NumberOfTravellers){
    let adultvalue1 = 0;
    let childvalue1 = 0;
    let infantvalue1 = 0;
    // Person per night calculation
    if (NumberOfadult > 0) {
        adultvalue1 = SupplierCostAfterCompanyMarkup / NumberOfTravellers / NumberOfNights;
    };
    if (NumberOfchild > 0) {
        childvalue1 = SupplierCostAfterCompanyMarkup / NumberOfTravellers / NumberOfNights;
    };
    if (NumberOfinfant > 0) {
        infantvalue1 = SupplierCostAfterCompanyMarkup / NumberOfTravellers / NumberOfNights;
    };
    if (companymarkupconfigurationcalculationmethod === "PPB" || companymarkupconfigurationcalculationmethod === "PPN") {
        if (NumberOfadult > 0) {
            adultvalue1 = SupplierCostAfterCompanyMarkup.adultvalue / NumberOfadult / NumberOfNights;
        };
        if (NumberOfchild > 0) {
            childvalue1 = SupplierCostAfterCompanyMarkup.childvalue / NumberOfchild / NumberOfNights;
        };
        if (NumberOfinfant > 0) {
            infantvalue1 = SupplierCostAfterCompanyMarkup.infantvalue / NumberOfinfant / NumberOfNights;
        };
    };
   
    return {"adultValRes" : adultvalue1, "chidValRes":childvalue1, "infantValRes" :infantvalue1};
};

//Function to handle passengers values
async function handlePassengersValues(NumberOfadult, NumberOfchild, NumberOfinfant, PPBagentSupplierCostAfterCompanyMarkup,AgentMarkup){
    let adultvalue = 0;
    let childvalue = 0;
    let infantvalue = 0;
    if (NumberOfadult > 0) {
        adultvalue = PPBagentSupplierCostAfterCompanyMarkup.adultvalue + AgentMarkup.adultvalue;
    };
    if (NumberOfchild > 0) {
        childvalue = PPBagentSupplierCostAfterCompanyMarkup.childvalue + AgentMarkup.childvalue;
    };
    if (NumberOfinfant > 0) {
        infantvalue = PPBagentSupplierCostAfterCompanyMarkup.infantvalue + AgentMarkup.infantvalue;
    };
    return {"adultvalue":adultvalue,"childvalue":childvalue, "infantvalue":infantvalue};
};

//Function to handle supplier cost after agent markup based on PPB and PPN
async function handlePerPersonSupplierCostAfterAgentMarkup(SupplierCostAfterAgentMarkup,markupconfigurationcalculationmethod,adultvalue2,childvalue2,infantvalue2,NumberOfNights ){
    let cost = SupplierCostAfterAgentMarkup;
    // Person per booking
    if (markupconfigurationcalculationmethod === "PPB") {
        cost = {
            adultvalue: adultvalue2,
            childvalue: childvalue2,
            infantvalue: infantvalue2
        };
        return cost;
    }
    // Person per night
    else if (markupconfigurationcalculationmethod === "PPN") {
        cost = {
            adultvalue: adultvalue2 * NumberOfNights,
            childvalue: childvalue2 * NumberOfNights,
            infantvalue: infantvalue2 * NumberOfNights
        };
        return cost;
    } else {
        return cost;
    }
};

//Function to handle UPBagentcommission
async function handleUPBagentcommissionSupplierCostAfterAgentmarkup(commissionconfigurationcalculationmethod,markupconfigurationcalculationmethod,SupplierCostAfterAgentMarkup,NumberOfNights ){
    let UPBagentcommissionSupplierCostAfterAgentmarkup = 0;
    if (commissionconfigurationcalculationmethod === "UPB") {
        // Calculating UPB
        if (markupconfigurationcalculationmethod === "UPB" || markupconfigurationcalculationmethod === "UPN") {

            UPBagentcommissionSupplierCostAfterAgentmarkup = SupplierCostAfterAgentMarkup;
            return UPBagentcommissionSupplierCostAfterAgentmarkup;
        }
        else {
            UPBagentcommissionSupplierCostAfterAgentmarkup = SupplierCostAfterAgentMarkup.adultvalue + SupplierCostAfterAgentMarkup.childvalue + SupplierCostAfterAgentMarkup.infantvalue;
            return UPBagentcommissionSupplierCostAfterAgentmarkup;
        }
    }
    else if (commissionconfigurationcalculationmethod === "UPN") {
        // Unit per night
        if (markupconfigurationcalculationmethod === "UPB" || markupconfigurationcalculationmethod === "UPN") {

            UPBagentcommissionSupplierCostAfterAgentmarkup = SupplierCostAfterAgentMarkup / NumberOfNights;
            return UPBagentcommissionSupplierCostAfterAgentmarkup;
        }
        else {
            UPBagentcommissionSupplierCostAfterAgentmarkup = (SupplierCostAfterAgentMarkup.adultvalue + SupplierCostAfterAgentMarkup.childvalue + SupplierCostAfterAgentMarkup.infantvalue) / NumberOfNights;
            return UPBagentcommissionSupplierCostAfterAgentmarkup;
        }
    } else {
        return UPBagentcommissionSupplierCostAfterAgentmarkup;
    }
};

//Function to handle supplire cost after agent commission
async function handleSupplierCostAfterAgentCommission(SupplierCostAfterAgentCommission, commissionconfigurationcalculationmethod,UPBSupplierCostAfterAgentCommission,NumberOfNights ){
    let  cost = SupplierCostAfterAgentCommission;
     // UPB
     if (commissionconfigurationcalculationmethod === "UPB") {
        cost = UPBSupplierCostAfterAgentCommission;
        return cost;
    }
    // UPN
    else if (commissionconfigurationcalculationmethod === "UPN") {
        cost = UPBSupplierCostAfterAgentCommission * NumberOfNights;
        return cost;
    } else {
        return cost;
    }
};

//Function to handle  PPB and PPN
async function handlePerPersonAndPerNightBooking({commissionconfigurationcalculationmethod,markupconfigurationcalculationmethod,SupplierCostAfterAgentMarkup,NumberOfadult,NumberOfchild,NumberOfinfant,NumberOfNights,NumberOfTravellers }){
    let adultvalue1 = 0;
    let childvalue1 = 0;
    let infantvalue1 = 0;
    // Person per booking
    if (commissionconfigurationcalculationmethod === "PPB") {
        let {adultvalueRes, chidValRes, infantValRes } = await handlePPBAgentMarkupPassengerCounts(markupconfigurationcalculationmethod,NumberOfadult,NumberOfchild, NumberOfinfant, SupplierCostAfterAgentMarkup,NumberOfTravellers );
        adultvalue1 = adultvalueRes;
        childvalue1 = chidValRes;
        infantvalue1= infantValRes; 
        return {"adultvalue1":adultvalue1,"childvalue1":childvalue1, "infantvalue1":infantvalue1 };      
    }
    // Person per night
    else if (commissionconfigurationcalculationmethod === "PPN") {
        let {adultvalueRes, chidValRes, infantValRes } = await handlePPNAgentMarkupPassengerCounts(markupconfigurationcalculationmethod,NumberOfadult,NumberOfchild,NumberOfinfant,SupplierCostAfterAgentMarkup,NumberOfTravellers, NumberOfNights );
        adultvalue1 = adultvalueRes;
        childvalue1 = chidValRes;
        infantvalue1= infantValRes;  
        return {"adultvalue1":adultvalue1,"childvalue1":childvalue1, "infantvalue1":infantvalue1 };       
    } else {
        return {"adultvalue1":adultvalue1,"childvalue1":childvalue1, "infantvalue1":infantvalue1 };
    }
};

//Function to handle PPB passenger counts
async function handlePPBAgentMarkupPassengerCounts(markupconfigurationcalculationmethod,NumberOfadult,NumberOfchild, NumberOfinfant, SupplierCostAfterAgentMarkup,NumberOfTravellers ){
    let adultvalue1 = 0;
    let childvalue1 = 0;
    let infantvalue1 = 0;

    if (markupconfigurationcalculationmethod === "PPB" || markupconfigurationcalculationmethod === "PPN") {
        if (NumberOfadult > 0) {
            adultvalue1 = SupplierCostAfterAgentMarkup.adultvalue / NumberOfadult;
        };
        if (NumberOfchild > 0) {
            childvalue1 = SupplierCostAfterAgentMarkup.childvalue / NumberOfchild;
        };
        if (NumberOfinfant > 0) {
            infantvalue1 = SupplierCostAfterAgentMarkup.infantvalue / NumberOfinfant;
        };
    }
    else {
        if (NumberOfadult > 0) {
            adultvalue1 = SupplierCostAfterAgentMarkup / NumberOfTravellers;
        };
        if (NumberOfchild > 0) {
            childvalue1 = SupplierCostAfterAgentMarkup / NumberOfTravellers;
        };
        if (NumberOfinfant > 0) {
            infantvalue1 = SupplierCostAfterAgentMarkup / NumberOfTravellers;
        };
    };
    return {"adultvalueRes": adultvalue1, "chidValRes":childvalue1, "infantValRes":infantvalue1 }
};

//Function to handle PPN passenger counts
async function handlePPNAgentMarkupPassengerCounts(markupconfigurationcalculationmethod,NumberOfadult,NumberOfchild,NumberOfinfant,SupplierCostAfterAgentMarkup,NumberOfTravellers, NumberOfNights ){
    let adultvalue1 = 0;
    let childvalue1 = 0;
    let infantvalue1 = 0;
    if (NumberOfadult > 0) {
        adultvalue1 = SupplierCostAfterAgentMarkup / NumberOfTravellers / NumberOfNights;
    };
    if (NumberOfchild > 0) {
        childvalue1 = SupplierCostAfterAgentMarkup / NumberOfTravellers / NumberOfNights;
    };
    if (NumberOfinfant > 0) {
        infantvalue1 = SupplierCostAfterAgentMarkup / NumberOfTravellers / NumberOfNights;
    };
    if (markupconfigurationcalculationmethod === "PPB" || markupconfigurationcalculationmethod === "PPN") {
        if (NumberOfadult > 0) {
            adultvalue1 = SupplierCostAfterAgentMarkup.adultvalue / NumberOfadult / NumberOfNights;
        };
        if (NumberOfchild > 0) {
            childvalue1 = SupplierCostAfterAgentMarkup.childvalue / NumberOfchild / NumberOfNights;
        };
        if (NumberOfinfant > 0) {
            infantvalue1 = SupplierCostAfterAgentMarkup.infantvalue / NumberOfinfant / NumberOfNights;
        };
    };
   
    return {"adultvalueRes" : adultvalue1, "chidValRes": childvalue1, "infantValRes": infantvalue1} ;
};

//Function to handle the  passenger count values
async function handleAdultChildInfantValue(NumberOfadult,NumberOfchild,NumberOfinfant,PPBagentcommissionSupplierCostAfterAgentmarkup,AgentCommission ){
    let adultvalue = 0;
    let childvalue = 0;
    let infantvalue = 0;
    if (NumberOfadult > 0) {
        adultvalue = PPBagentcommissionSupplierCostAfterAgentmarkup.adultvalue - AgentCommission.adultvalue;
    };
    if (NumberOfchild > 0) {
        childvalue = PPBagentcommissionSupplierCostAfterAgentmarkup.childvalue - AgentCommission.childvalue;
    };
    if (NumberOfinfant > 0) {
        infantvalue = PPBagentcommissionSupplierCostAfterAgentmarkup.infantvalue - AgentCommission.infantvalue;
    };
    return {"adultvalue":adultvalue,"childvalue":childvalue,"infantvalue":infantvalue};
};

//Function to handle the supplier cost
async function handleSupplierCommission(adultvalue2,childvalue2,infantvalue2, commissionconfigurationcalculationmethod,SupplierCostAfterAgentCommission,NumberOfNights ){
    let cost = SupplierCostAfterAgentCommission;
    // Person per booking supplier coast after agent commission
    if (commissionconfigurationcalculationmethod === "PPB") {
        cost = {
            adultvalue: adultvalue2,
            childvalue: childvalue2,
            infantvalue: infantvalue2
        }
        return cost;
    }
    // Person per night supplier coast after agent commission
    else if (commissionconfigurationcalculationmethod === "PPN") {
        cost = {
            adultvalue: adultvalue2 * NumberOfNights,
            childvalue: childvalue2 * NumberOfNights,
            infantvalue: infantvalue2 * NumberOfNights
        }
        return cost;
    } else {
        return cost;
    }
};

// Function for set total supplier cost after company markup
async function setTotalSupplierCostAfterCompanyMarkupData({TotalSupplierCostAfterCompanyMarkup, SupplierCostAfterCompanyMarkup, NumberOfinfant, NumberOfchild, NumberOfadult, NumberOfTravellers, SupplierConvertedCost, NumberOfNights, flagignorecompanymarkup, tourDetails, CompanyMarkup, markupcategoryidwisecompanyagent, companymarkupconfigurationcalculationmethod}){

    if (companymarkupconfigurationcalculationmethod === "UPB" || companymarkupconfigurationcalculationmethod === "UPN") {
        let UPBSupplierConvertedCost = await handleUPBSupplierConvertedCost(companymarkupconfigurationcalculationmethod, SupplierConvertedCost, NumberOfNights);
        let valueType = markupcategoryidwisecompanyagent[0].valuetype.trim();
        let valueTypeList= ["F","P"];
        if(!valueTypeList.includes(valueType)){
            return ({ "Error": "valuetype is not valid. valuetype must be 'P' or 'F'." });
        };
        let CompanyMarkupRes = await handleFixedAndPercentageMarkup(markupcategoryidwisecompanyagent,tourDetails, CompanyMarkup, UPBSupplierConvertedCost );
        CompanyMarkup = CompanyMarkupRes;               

        // If flagignorecompanymarkup = false then and only then add company markup                
        let UPBSupplierCostAfterCompanyMarkup = await handleUPBSupplierCostAfterCompanyMarkup(flagignorecompanymarkup, UPBSupplierConvertedCost, CompanyMarkup);                

        // Final value of supplier coast after company markup value.                     
        SupplierCostAfterCompanyMarkup = await handleSupplierCostAfterCompanyMarkup(companymarkupconfigurationcalculationmethod,UPBSupplierCostAfterCompanyMarkup, NumberOfNights );
        TotalSupplierCostAfterCompanyMarkup = SupplierCostAfterCompanyMarkup;
        return {
            CompanyMarkup,
            SupplierCostAfterCompanyMarkup,
            TotalSupplierCostAfterCompanyMarkup
        }
        
    }
    else if (companymarkupconfigurationcalculationmethod === "PPB" || companymarkupconfigurationcalculationmethod === "PPN") {
        // Convert Per Person Per Booking wise price
        let perpersonwisevalu1 = await handleperpersonwisevalu1(companymarkupconfigurationcalculationmethod, SupplierConvertedCost, NumberOfTravellers, NumberOfNights);
       
        // Checking price for individual travelers.                                
        let {adultvalue1, childvalue1, infantvalue1 } = await handleIndividualTravelerPrice(NumberOfadult,NumberOfchild,NumberOfinfant, perpersonwisevalu1);

        // Each passanger wise value as an object.
        let PPBSupplierConvertedCost = {
            adultvalue: adultvalue1,
            childvalue: childvalue1,
            infantvalue: infantvalue1
        };

        let companyMarkupResponse = await handlePercentageAndFixMarkup(markupcategoryidwisecompanyagent, CompanyMarkup, tourDetails, PPBSupplierConvertedCost);
        CompanyMarkup = companyMarkupResponse;               

        // If flagignorecompanymarkup = false then and only then add company markup                
        let PPBSupplierCostAfterCompanyMarkup = await handlePPBSupplierCostAfterCompanyMarkup(flagignorecompanymarkup, NumberOfadult,NumberOfchild,NumberOfinfant,PPBSupplierConvertedCost,CompanyMarkup );              

        // Getting each passanger value.
        let adultvalue2 = PPBSupplierCostAfterCompanyMarkup.adultvalue * NumberOfadult;
        let childvalue2 = PPBSupplierCostAfterCompanyMarkup.childvalue * NumberOfchild;
        let infantvalue2 = PPBSupplierCostAfterCompanyMarkup.infantvalue * NumberOfinfant;

        SupplierCostAfterCompanyMarkup = await handlePerPersonCost(companymarkupconfigurationcalculationmethod,adultvalue2,childvalue2, infantvalue2);                
        TotalSupplierCostAfterCompanyMarkup = SupplierCostAfterCompanyMarkup.adultvalue + SupplierCostAfterCompanyMarkup.childvalue + SupplierCostAfterCompanyMarkup.infantvalue;
        return {
            CompanyMarkup,
            SupplierCostAfterCompanyMarkup,
            TotalSupplierCostAfterCompanyMarkup
        }
    }
    else {
        return {
            CompanyMarkup,
            SupplierCostAfterCompanyMarkup,
            TotalSupplierCostAfterCompanyMarkup
        }
    }
}

// function for set set supplier cost after agent commission
async function setSupplierCostAfterAgentCommission({SupplierCostAfterCompanyMarkup, TotalSupplierCostAfterCompanyMarkup, AgentMarkup, tourDetails, TotalSupplierCostAfterAgentCommission, SupplierCostAfterAgentCommission, AgentCommission, NumberOfNights, markupconfigurationcalculationmethod, AgentWiseData, flagsharemarkupascommission, SupplierCostAfterAgentMarkup, NumberOfadult, NumberOfchild, NumberOfinfant, NumberOfTravellers, TotalSupplierCostAfterAgentMarkup, iscommissionable}){
    if (flagsharemarkupascommission === false) {
        // If the markup category id is 5 then calculate the agent commission value
        let markupcategoryidofcommissionwiseagent = AgentWiseData[0].markupcategory.filter(item => item.markupcategoryid === "5");
        // If the markupcategoryidofcommissionwiseagent is > than 0 then only execute.
        if (markupcategoryidofcommissionwiseagent.length > 0) {

            let commissionconfigurationcalculationmethod = markupcategoryidofcommissionwiseagent[0].markupconfigurationcalculationmethod;

            iscommissionable = markupcategoryidofcommissionwiseagent[0].iscommissionable;
            // UPB and UPN
            if (commissionconfigurationcalculationmethod === "UPB" || commissionconfigurationcalculationmethod === "UPN") {

                // Calculating UPB and UPN                        
                let UPBagentcommissionSupplierCostAfterAgentmarkup = await handleUPBagentcommissionSupplierCostAfterAgentmarkup(commissionconfigurationcalculationmethod,markupconfigurationcalculationmethod,SupplierCostAfterAgentMarkup,NumberOfNights );
            
                let AgentCommissionRes = await handleAgentCommission(AgentCommission, markupcategoryidofcommissionwiseagent, tourDetails, UPBagentcommissionSupplierCostAfterAgentmarkup);
                AgentCommission = AgentCommissionRes;                        

                // UPB supplier coast after agent commission 
                let UPBSupplierCostAfterAgentCommission = UPBagentcommissionSupplierCostAfterAgentmarkup - AgentCommission;
                SupplierCostAfterAgentCommission = await handleSupplierCostAfterAgentCommission(SupplierCostAfterAgentCommission, commissionconfigurationcalculationmethod,UPBSupplierCostAfterAgentCommission,NumberOfNights );
                
                // Total supplier coast after agent markup commission value
                TotalSupplierCostAfterAgentCommission = SupplierCostAfterAgentCommission;
                let returnObj = {
                    "AgentCommission" : AgentCommission,
                    "SupplierCostAfterAgentCommission" : SupplierCostAfterAgentCommission,
                    "TotalSupplierCostAfterAgentCommission" : TotalSupplierCostAfterAgentCommission,
                    "iscommissionable" : iscommissionable
                }
                return returnObj

            }
            // PPB and PPN
            else if (commissionconfigurationcalculationmethod === "PPB" || commissionconfigurationcalculationmethod === "PPN") {
                // Each traveler values
                let reqParameters = {
                    commissionconfigurationcalculationmethod,
                    markupconfigurationcalculationmethod,
                    SupplierCostAfterAgentMarkup,
                    NumberOfadult,
                    NumberOfchild,
                    NumberOfinfant,
                    NumberOfNights,
                    NumberOfTravellers 
                }
                let {adultvalue1,childvalue1, infantvalue1 } = await handlePerPersonAndPerNightBooking(reqParameters);                

                // Person per booking agent commission supplier coast after agent markup
                let PPBagentcommissionSupplierCostAfterAgentmarkup = {
                    adultvalue: adultvalue1,
                    childvalue: childvalue1,
                    infantvalue: infantvalue1
                };

                let AgentCommissionResponse = await setAgentCommissionData(AgentCommission, markupcategoryidofcommissionwiseagent,tourDetails, PPBagentcommissionSupplierCostAfterAgentmarkup);
                AgentCommission = AgentCommissionResponse;                       

                // Each traveler vlaue seperate                      
                let {adultvalue,childvalue,infantvalue} = await handleAdultChildInfantValue(NumberOfadult,NumberOfchild,NumberOfinfant,PPBagentcommissionSupplierCostAfterAgentmarkup,AgentCommission );
               
                // Person per booking suppplier coast after agent commission.
                let PPBSupplierCostAfterAgentCommission = {
                    adultvalue: adultvalue,
                    childvalue: childvalue,
                    infantvalue: infantvalue,
                    total: adultvalue + childvalue + infantvalue
                }

                let adultvalue2 = PPBSupplierCostAfterAgentCommission.adultvalue * NumberOfadult;
                let childvalue2 = PPBSupplierCostAfterAgentCommission.childvalue * NumberOfchild;
                let infantvalue2 = PPBSupplierCostAfterAgentCommission.infantvalue * NumberOfinfant;

                SupplierCostAfterAgentCommission = await handleSupplierCommission(adultvalue2,childvalue2,infantvalue2, commissionconfigurationcalculationmethod,SupplierCostAfterAgentCommission,NumberOfNights );
                
                // Total supplier coast after agent commission 
                TotalSupplierCostAfterAgentCommission = SupplierCostAfterAgentCommission.adultvalue + SupplierCostAfterAgentCommission.childvalue + SupplierCostAfterAgentCommission.infantvalue;
                let returnObj = {
                    "AgentCommission" : AgentCommission,
                    "SupplierCostAfterAgentCommission" : SupplierCostAfterAgentCommission,
                    "TotalSupplierCostAfterAgentCommission" : TotalSupplierCostAfterAgentCommission
                }
                return returnObj
            }
            else {
                let returnObj = {
                    "AgentCommission" : AgentCommission,
                    "SupplierCostAfterAgentCommission" : SupplierCostAfterAgentCommission,
                    "TotalSupplierCostAfterAgentCommission" : TotalSupplierCostAfterAgentCommission,
                    "iscommissionable" : iscommissionable
                }
                return returnObj
            }
        }
        else {
            let returnObj = {
                "AgentCommission" : AgentCommission,
                "SupplierCostAfterAgentCommission" : TotalSupplierCostAfterAgentMarkup,
                "TotalSupplierCostAfterAgentCommission" : TotalSupplierCostAfterAgentMarkup,
                "iscommissionable" : iscommissionable
            }
            return returnObj
        }
    }

    // If flagsharemarkupascommission if true then need to take Agent markup as a commission
    else {  
        let returnObj = {
            "AgentCommission" : AgentMarkup,
            "SupplierCostAfterAgentCommission" : SupplierCostAfterCompanyMarkup,
            "TotalSupplierCostAfterAgentCommission" : TotalSupplierCostAfterCompanyMarkup,
            "iscommissionable" : iscommissionable
        }
        return returnObj
    }
}

// Function for set total supplier cost after agent markup
async function setTotalSupplierCostAfterAgentMarkup({NumberOfadult, NumberOfchild, NumberOfinfant, NumberOfTravellers, tourDetails, markupcategoryidwiseagent, NumberOfNights, SupplierCostAfterCompanyMarkup, companymarkupconfigurationcalculationmethod, markupconfigurationcalculationmethod,TotalSupplierCostAfterAgentMarkup, AgentMarkup, SupplierCostAfterAgentMarkup}){
    if (markupconfigurationcalculationmethod === "UPB" || markupconfigurationcalculationmethod === "UPN") {

        // This case is for agent markup calculationmethod Unit wise
        // Here, Below if company markup calculationmethod is Unit wise then use SupplierCostAfterCompanyMarkup as it is.
        // If company markup calculationmethod is person wise then combine adult, child and infant cost.                
        let UPBagentSupplierCostAfterCompanyMarkup = await handleUPBagentSupplierCostAfterCompanyMarkup(markupconfigurationcalculationmethod,companymarkupconfigurationcalculationmethod,SupplierCostAfterCompanyMarkup,NumberOfNights);                

        let AgentMarkupRes = await handleAgentMarkup(markupcategoryidwiseagent, AgentMarkup, tourDetails, UPBagentSupplierCostAfterCompanyMarkup );
        AgentMarkup = AgentMarkupRes;               

        // UPB supplier coast after adding markup value
        let UPBSupplierCostAfterAgentMarkup = UPBagentSupplierCostAfterCompanyMarkup + AgentMarkup;
        SupplierCostAfterAgentMarkup = await handleSupplierCostAfterAgentMarkup(markupconfigurationcalculationmethod,UPBSupplierCostAfterAgentMarkup,NumberOfNights );

        // Total supplier coast after adding agent markup
        TotalSupplierCostAfterAgentMarkup = SupplierCostAfterAgentMarkup;
        let returnObj = {
            "AgentMarkup" : AgentMarkup,
            "SupplierCostAfterAgentMarkup" : SupplierCostAfterAgentMarkup,
            "TotalSupplierCostAfterAgentMarkup" : TotalSupplierCostAfterAgentMarkup
        }
        return returnObj
    }
    else if (markupconfigurationcalculationmethod === "PPB" || markupconfigurationcalculationmethod === "PPN") {

        // This case is for agent markup calculationmethod Person wise
        // Here, Below if company markup calculationmethod is Person wise then divide SupplierCostAfterCompanyMarkup peson wise.
        // If company markup calculationmethod is person wise then combine divide Total number of traveller wise.

        let reqParameter ={
            markupconfigurationcalculationmethod, 
            companymarkupconfigurationcalculationmethod,
            SupplierCostAfterCompanyMarkup,
            NumberOfadult,
            NumberOfchild,
            NumberOfinfant,
            NumberOfTravellers,
            NumberOfNights 
        }
        let {adultvalue1, childvalue1, infantvalue1 } = await handlePersonPerBookingAndNight(reqParameter);
       
        // Person per booking supplier coast after comnpany markup value
        let PPBagentSupplierCostAfterCompanyMarkup = {
            adultvalue: adultvalue1,
            childvalue: childvalue1,
            infantvalue: infantvalue1
        };

        let agentMarkupResponse = await setAgentFixedAndPercentageMarkup(markupcategoryidwiseagent,AgentMarkup,tourDetails, PPBagentSupplierCostAfterCompanyMarkup);
        AgentMarkup = agentMarkupResponse;
      
        // Taking each passengers value
        let {adultvalue,childvalue, infantvalue} = await handlePassengersValues(NumberOfadult, NumberOfchild, NumberOfinfant, PPBagentSupplierCostAfterCompanyMarkup,AgentMarkup);
       
        // Person per booking suppier coast after agent markup and total value.
        let PPBSupplierCostAfterAgentMarkup = {
            adultvalue: adultvalue,
            childvalue: childvalue,
            infantvalue: infantvalue,
            total: adultvalue + childvalue + infantvalue
        }

        let adultvalue2 = PPBSupplierCostAfterAgentMarkup.adultvalue * NumberOfadult;
        let childvalue2 = PPBSupplierCostAfterAgentMarkup.childvalue * NumberOfchild;
        let infantvalue2 = PPBSupplierCostAfterAgentMarkup.infantvalue * NumberOfinfant;

        SupplierCostAfterAgentMarkup = await handlePerPersonSupplierCostAfterAgentMarkup(SupplierCostAfterAgentMarkup,markupconfigurationcalculationmethod,adultvalue2,childvalue2,infantvalue2,NumberOfNights );
       
        // Final value of supplier coast after agent markup .
        TotalSupplierCostAfterAgentMarkup = SupplierCostAfterAgentMarkup.adultvalue + SupplierCostAfterAgentMarkup.childvalue + SupplierCostAfterAgentMarkup.infantvalue;
        let returnObj = {
            "AgentMarkup" : AgentMarkup,
            "SupplierCostAfterAgentMarkup" : SupplierCostAfterAgentMarkup,
            "TotalSupplierCostAfterAgentMarkup" : TotalSupplierCostAfterAgentMarkup
        }
        return returnObj
    } else {
        let returnObj = {
            "AgentMarkup" : AgentMarkup,
            "SupplierCostAfterAgentMarkup" : SupplierCostAfterAgentMarkup,
            "TotalSupplierCostAfterAgentMarkup" : TotalSupplierCostAfterAgentMarkup
        }
        return returnObj
    }

}   

/**
 * 
company markup
===========
supplier total cost = 100
company markup = 10
agent markup  = 15
 
1) 
flagignorecompanymarkup
 if True -> take only supplier coast as company markup  (100)
total company markup  = 100
 
if False -> total cost + company markup ( 100 + 10 ) = 110
total company markup = 110
 
Agent markup 
=========
total  agent markup =  total company markup + agent markup (100 + 15)
total agent markup = 115
 
Agent commission 
============
total company markup  = 100
total agent markup = 115
 
if flagsharemarkupascommission == true =>
  agentCommission =  agent markup ( 15 )
  total supplier cost after agent commission = 100
 
flagsharemarkupascommission == false 
agentCommission = get value from api (F or P -> 15 or 15%)
total cost after agentCommission  = total  agent markup - agent commission (115 - 15)
 * 
=======================================
recommendedRetailPrice : Total Price from 1way2itally
partnerNetPrice : 0  // We are not using for 1way2itally
bookingFee : ( if booking there 1way2itally will give )
partnerTotalPrice :  Total Price from 1way2itally + partnerNetPrice + bookingFee + CompanyMarkup (AS per discussion made like this  here company markup will be added acoording to label IgnoreCompanmyMakrup : true /flase  it should add on false statement)
TotalSupplierCostAfterAgentMarkup : partnerTotalPrice + markupPrice  
markupPrice : from moonstride ( Denotes markup )
CompanyMarkup :  from moonstride
TotalSupplierCostAfterCompanyMarkup:  partnerTotalPrice  
AgentCommission : (fom moonstride ) 
TotalSupplierCostAfterAgentCommission : TotalSupplierCostAfterAgentMarkup- AgentCommission 
 */

module.exports = markupAndCommission;