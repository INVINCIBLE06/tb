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
const moment = require("moment")
const config = require("../../../../Config.js");
const markupAndCommission = {
    findAgentMarkupAndCommission : async (clientId, RequestParameters, accessToken, request, DBMarkupCommissionDataTest) =>{
        let responseData = await setFindAgentMarkupAndCommission(clientId, RequestParameters, accessToken, request, DBMarkupCommissionDataTest)
        return responseData;
    },

    findfixmarkup: async (markupcategoryidwisecompanyagent, RequestParameters) => {
        let responseData = await setFindfixmarkup(markupcategoryidwisecompanyagent, RequestParameters)
        return responseData;
    },

    findpercentagemarkup: async (markupcategoryidwisecompanyagent, RequestParameters, Cost) => {
        let responseData = await setFindpercentagemarkup(markupcategoryidwisecompanyagent, RequestParameters, Cost)
        return responseData;
    },

    findpaxwisefixmarkup: async (markupcategoryidwisecompanyagent, RequestParameters) => {
        let responseData = await setFindpaxwisefixmarkup(markupcategoryidwisecompanyagent, RequestParameters)
        return responseData;
    },

    findpaxwisepercentagemarkup: async (markupcategoryidwisecompanyagent, RequestParameters, Cost, NumberOfadult, NumberOfchild, NumberOfinfant) => {

        let responseData = await setFindpaxwisepercentagemarkup(markupcategoryidwisecompanyagent, RequestParameters, Cost, NumberOfadult, NumberOfchild, NumberOfinfant)       
        return responseData;
    },

    convertDurationToEndDate : async function(clientId, startDate, duration, startTime){
        let responseData = await setConvertDurationToEndDate(clientId, startDate, duration, startTime)
        return responseData;
    },

    getNumberOfNights : async function(clientId, StartDate, EndDate, duration){
        let responseData = await setGetNumberOfNights(clientId, StartDate, EndDate, duration)
        return responseData;
    }
    
}

// Function for agent marup and commission
async function setFindAgentMarkupAndCommission(clientId, RequestParameters, accessToken, request, DBMarkupCommissionDataTest){    
    let fName = "markup_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_MARKUP_PROVIDER_MARKUP_FILE_PATH, config.Provider_Code_VTR);
    try{
        //------------------------------------------------------------//

        let requestParameters;
        let tourDetails;
        // Taking the request data.
        if(RequestParameters){
            requestParameters = RequestParameters;
            tourDetails = RequestParameters
        }
        
        //-------------- Get markup data from database or api ----------------//
                    
        let comapnyMarkupData = {};
        let agentMarkupData = {};
        let agentcommission = {};

        if(DBMarkupCommissionDataTest != undefined && !DBMarkupCommissionDataTest.Error){
            // Setting up the company markup response data.
            comapnyMarkupData = DBMarkupCommissionDataTest.comapnyMarkup;
            // Setting up the agent markup response data.
            agentMarkupData = DBMarkupCommissionDataTest.agentmarkup;
            // Setting agent commission.
            agentcommission = DBMarkupCommissionDataTest.agentcommission;
        }
        else{
            return (DBMarkupCommissionDataTest);
        }            

        // Creating an array format.
        let comapnyMarkupDataArr = [comapnyMarkupData];
        let agentMarkupDataArr = [agentMarkupData, agentcommission];
        let DBMarkupCommissionData = {
            "comapnyMarkupData" : comapnyMarkupDataArr,
            "agentMarkupData" : agentMarkupDataArr
        }

        //----------------------------------------//
        // tour start date and start time function 
        let startDateAndTime = await findTourStartDateAndTimeFunction(tourDetails, RequestParameters);

        // Taking tour start date from tour details 
        let tourStartDate = startDateAndTime.tourStartDate;
       
        // Tour start time from availability.
        let tourStartTime = startDateAndTime.tourStartTime;
        // Tour end date.
        let tourEndDate = startDateAndTime.tourEndDate;

        // Checking the duration is not empty then getting the end date and end time.
        if(tourDetails.duration && tourDetails.duration != "00" && tourEndDate != ""){

            let endTimeAndDate = await markupAndCommission.convertDurationToEndDate(clientId, tourStartDate, tourDetails.duration, tourStartTime);
            tourEndDate = endTimeAndDate.endDate;            
        }
        
        // Get the number of nights from start date and end date.
        let NumberOfNights = await markupAndCommission.getNumberOfNights(clientId, tourStartDate, tourEndDate, tourDetails.duration);
        // Get travelers details like how many trvelers where going;
        let NumberOfTravellers = 0;
        let adult = 0;
        let child = 0;
        let infant = 0;
        let traveler = 0;
        
        // Calculating the travelers;
        let passangers = requestParameters.passengerDetails;

        // Checking if the passenger details is array or object then get values.
        let passangerDetailData = await setPassangerDetailData(passangers);
        
        adult = passangerDetailData.adult
        child = passangerDetailData.child 
        infant = passangerDetailData.infant
        //traveler = passangerDetailData.traveler 
        
        // Total number of travelers
        NumberOfTravellers = adult + child + infant + traveler;
        let NumberOfadult = parseInt(adult);
        let NumberOfchild = parseInt(child);
        let NumberOfinfant = parseInt(infant);

        // Supplier coast           
        let priceSummary = tourDetails?.pricingInfo?.summary ?? tourDetails?.pricingInfo?.price;

        // Supplier price which is partnerTotalPrice
        //Take price from request object function.
        let SupplierCost = await findPriceFromRequestObjectFunction(priceSummary);        
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
        }

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
        let TotalSupplierCostAfterCompanyMarkup = 0;
        let companyMarkupObject = {
            companymarkupconfigurationcalculationmethod,
            SupplierConvertedCost,
            NumberOfNights,
            markupcategoryidwisecompanyagent,
            tourDetails,
            CompanyMarkup,
            TotalSupplierCostAfterCompanyMarkup,
            SupplierCostAfterCompanyMarkup,
            flagignorecompanymarkup,
            NumberOfadult,
            NumberOfchild,
            NumberOfinfant,
            NumberOfTravellers
            
        }

        let companyMarkupResponse = await findCompanyMarkupFunction(companyMarkupObject);
        CompanyMarkup = companyMarkupResponse.CompanyMarkup;
        SupplierCostAfterCompanyMarkup = companyMarkupResponse.SupplierCostAfterCompanyMarkup;
        TotalSupplierCostAfterCompanyMarkup = companyMarkupResponse.TotalSupplierCostAfterCompanyMarkup;
        

        //-------------------------- End Comapny Markup ---------------------------------------------//

        //---------------------------- Find Agent Markup --------------------------------------------//
        let SupplierCostAfterAgentMarkup = 0;
        let AgentMarkup = 0;
        let TotalSupplierCostAfterAgentMarkup;

        let agentMarkupObject = {
            markupconfigurationcalculationmethod,
            companymarkupconfigurationcalculationmethod,
            SupplierCostAfterCompanyMarkup,
            NumberOfNights,
            markupcategoryidwiseagent,
            AgentMarkup,
            SupplierCostAfterAgentMarkup,
            TotalSupplierCostAfterAgentMarkup,
            tourDetails,
            NumberOfadult,
            NumberOfchild,
            NumberOfinfant,
            NumberOfTravellers
        }
        let {TotalSupplierCostAfterAgentMarkupTemp, AgentMarkupTemp, SupplierCostAfterAgentMarkupTemp} = await findTotalSupplierCostAfterAgentMarkup( agentMarkupObject)
        SupplierCostAfterAgentMarkup = SupplierCostAfterAgentMarkupTemp
        AgentMarkup = AgentMarkupTemp;
        TotalSupplierCostAfterAgentMarkup = TotalSupplierCostAfterAgentMarkupTemp;
        
        //------------------------------ End Agent Markup ----------------------------------------------//

        //----------------------------- Find Agent Commission ------------------------------------------//

        let SupplierCostAfterAgentCommission = 0;
        let AgentCommission = 0;
        let TotalSupplierCostAfterAgentCommission;

        let agentCommissionObject = {
            AgentCommission,
            iscommissionable,
            flagsharemarkupascommission,
            SupplierCostAfterAgentCommission,
            markupconfigurationcalculationmethod,
            companymarkupconfigurationcalculationmethod,
            SupplierCostAfterCompanyMarkup,
            TotalSupplierCostAfterCompanyMarkup,
            NumberOfNights,
            markupcategoryidwiseagent,
            AgentMarkup,
            AgentWiseData,
            SupplierCostAfterAgentMarkup,
            TotalSupplierCostAfterAgentMarkup,
            tourDetails,
            NumberOfadult,
            NumberOfchild,
            NumberOfinfant,
            NumberOfTravellers,
            TotalSupplierCostAfterAgentCommission
        }

        const supplierCostAgentMarkup = await findTotalSupplierCostAfterAgentCommission(agentCommissionObject)

        AgentCommission = supplierCostAgentMarkup.AgentCommission;
        TotalSupplierCostAfterAgentCommission = supplierCostAgentMarkup.TotalSupplierCostAfterAgentCommission;
        iscommissionable = supplierCostAgentMarkup.iscommissionable;

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
            TotalSupplierCostAfterAgentCommission : TotalSupplierCostAfterAgentCommission
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
            apiCommonController.getError(errorObject, fName, fPath, errorObject);
            return(errorObject);             
    }
}

async function findTotalSupplierCostAfterAgentMarkup(agentMarkupObject){
    

    let {
        markupconfigurationcalculationmethod,
        AgentMarkup,
        SupplierCostAfterAgentMarkup,
        TotalSupplierCostAfterAgentMarkup
    } = agentMarkupObject

    

    if (markupconfigurationcalculationmethod === "UPB" || markupconfigurationcalculationmethod === "UPN") {
        
        let result = await perUnitMarkupCalculation(agentMarkupObject)
        
        // This case is for agent markup calculationmethod Unit wise
        // Here, Below if company markup calculationmethod is Unit wise then use SupplierCostAfterCompanyMarkup as it is.
        // If company markup calculationmethod is person wise then combine adult, child and infant cost.
        
        TotalSupplierCostAfterAgentMarkup = result.TotalSupplierCostAfterAgentMarkup
        AgentMarkup = result.AgentMarkup
        SupplierCostAfterAgentMarkup = result.SupplierCostAfterAgentMarkup
           
    }
    else if (markupconfigurationcalculationmethod === "PPB" || markupconfigurationcalculationmethod === "PPN") {

        // This case is for agent markup calculationmethod Person wise
        // Here, Below if company markup calculationmethod is Person wise then divide SupplierCostAfterCompanyMarkup peson wise.
        // If company markup calculationmethod is person wise then combine divide Total number of traveller wise.

        let result = await perPersonMarkupCalculation(agentMarkupObject)
        TotalSupplierCostAfterAgentMarkup = result.TotalSupplierCostAfterAgentMarkup
        AgentMarkup = result.AgentMarkup
        SupplierCostAfterAgentMarkup = result.SupplierCostAfterAgentMarkup

        
        
        
    }
  
    return {
        "TotalSupplierCostAfterAgentMarkupTemp": TotalSupplierCostAfterAgentMarkup,
        "AgentMarkupTemp": AgentMarkup , 
        "SupplierCostAfterAgentMarkupTemp": SupplierCostAfterAgentMarkup
    }
}

async function findTotalSupplierCostAfterAgentCommission(agentCommissionObject){
    let {
        iscommissionable,
        AgentCommission,
        flagsharemarkupascommission,
        AgentMarkup,
        AgentWiseData,
        TotalSupplierCostAfterAgentCommission,
        TotalSupplierCostAfterAgentMarkup,
        TotalSupplierCostAfterCompanyMarkup
    } = agentCommissionObject


    // If flag sharemarkup as commission is false then only calculate agent Commission
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
                TotalSupplierCostAfterAgentCommission = await UnitWiseTotalSupplierCostAfterAgentCommission(agentCommissionObject, commissionconfigurationcalculationmethod, markupcategoryidofcommissionwiseagent)

            }
            // PPB and PPN
            else if (commissionconfigurationcalculationmethod === "PPB" || commissionconfigurationcalculationmethod === "PPN") {
                
                TotalSupplierCostAfterAgentCommission = await personWiseTotalSupplierCostAfterAgentCommission(agentCommissionObject, commissionconfigurationcalculationmethod)
                
                
            }
        }
        else {
            TotalSupplierCostAfterAgentCommission = TotalSupplierCostAfterAgentMarkup
        }
    }

    // If flagsharemarkupascommission if true then need to take Agent markup as a commission
    else {  
        AgentCommission = AgentMarkup;
        TotalSupplierCostAfterAgentCommission = TotalSupplierCostAfterCompanyMarkup
    }
    return {
        "AgentCommission" : AgentCommission,
        "TotalSupplierCostAfterAgentCommission" : TotalSupplierCostAfterAgentCommission,
        "iscommissionable" : iscommissionable
    }
}

async function UnitWiseTotalSupplierCostAfterAgentCommission(agentCommissionObject, commissionconfigurationcalculationmethod, markupcategoryidofcommissionwiseagent){

    let {
        AgentCommission,
        SupplierCostAfterAgentCommission,
        markupconfigurationcalculationmethod,
        TotalSupplierCostAfterAgentCommission,
        NumberOfNights,
        SupplierCostAfterAgentMarkup,
        tourDetails
    } = agentCommissionObject

    let UPBagentcommissionSupplierCostAfterAgentmarkup = 0;
    if (commissionconfigurationcalculationmethod === "UPB") {
        // Calculating UPB
        if (markupconfigurationcalculationmethod === "UPB" || markupconfigurationcalculationmethod === "UPN") {

            UPBagentcommissionSupplierCostAfterAgentmarkup = SupplierCostAfterAgentMarkup;
        }
        else {
            UPBagentcommissionSupplierCostAfterAgentmarkup = SupplierCostAfterAgentMarkup.adultvalue + SupplierCostAfterAgentMarkup.childvalue + SupplierCostAfterAgentMarkup.infantvalue;
        }
    }
    else if (commissionconfigurationcalculationmethod === "UPN") {
        // Unit per night
        if (markupconfigurationcalculationmethod === "UPB" || markupconfigurationcalculationmethod === "UPN") {            
            UPBagentcommissionSupplierCostAfterAgentmarkup = SupplierCostAfterAgentMarkup / NumberOfNights;
        }
        else {
            UPBagentcommissionSupplierCostAfterAgentmarkup = (SupplierCostAfterAgentMarkup.adultvalue + SupplierCostAfterAgentMarkup.childvalue + SupplierCostAfterAgentMarkup.infantvalue) / NumberOfNights;
        }
    }
    // Find the fixed value
    if (markupcategoryidofcommissionwiseagent[0].valuetype.trim() === "F") {

        let findfixmarkup = await markupAndCommission.findfixmarkup(markupcategoryidofcommissionwiseagent, tourDetails);
        AgentCommission = findfixmarkup;

    }
    // Find the percentage value
    else if (markupcategoryidofcommissionwiseagent[0].valuetype.trim() === "P") {
        let findpercentagemarkup = await markupAndCommission.findpercentagemarkup(markupcategoryidofcommissionwiseagent, tourDetails, UPBagentcommissionSupplierCostAfterAgentmarkup);
        AgentCommission = findpercentagemarkup;

    }
    // UPB supplier coast after agent commission 
    let UPBSupplierCostAfterAgentCommission = UPBagentcommissionSupplierCostAfterAgentmarkup - AgentCommission;
    // UPB
    if (commissionconfigurationcalculationmethod === "UPB") {
        SupplierCostAfterAgentCommission = UPBSupplierCostAfterAgentCommission;

    }
    // UPN
    else if (commissionconfigurationcalculationmethod === "UPN") {
        SupplierCostAfterAgentCommission = UPBSupplierCostAfterAgentCommission * NumberOfNights;

    }
    // Total supplier coast after agent markup commission value
    TotalSupplierCostAfterAgentCommission = SupplierCostAfterAgentCommission;

    return  {TotalSupplierCostAfterAgentCommission, AgentCommission}

}

async function personWiseTotalSupplierCostAfterAgentCommission(agentCommissionObject, commissionconfigurationcalculationmethod){
   
    let {
        AgentCommission,
        SupplierCostAfterAgentCommission,
        NumberOfNights,
        TotalSupplierCostAfterAgentCommission,
        tourDetails,
        NumberOfadult,
        NumberOfchild,
        NumberOfinfant
    } = agentCommissionObject
   
   
   
    // Each traveler values
    let adultvalue1 = 0;
    let childvalue1 = 0;
    let infantvalue1 = 0;
    // Person per booking
    const result = await findPersonPerBookingValue(agentCommissionObject, commissionconfigurationcalculationmethod, adultvalue1, childvalue1, infantvalue1)
    adultvalue1 = result.adultvalue1;
    childvalue1 = result.childvalue1;
    infantvalue1 = result.infantvalue1;

    // Person per booking agent commission supplier coast after agent markup
    let PPBagentcommissionSupplierCostAfterAgentmarkup = {
        adultvalue: adultvalue1,
        childvalue: childvalue1,
        infantvalue: infantvalue1
    };
    // Fixed value
    if (markupcategoryidofcommissionwiseagent[0].valuetype.trim() === "F") {

        let findpaxwisefixmarkup = await markupAndCommission.findpaxwisefixmarkup(markupcategoryidofcommissionwiseagent, tourDetails);
        AgentCommission = findpaxwisefixmarkup;

    }
    else if (markupcategoryidofcommissionwiseagent[0].valuetype.trim() === "P") {

        let findpaxwisepercentagemarkup = await markupAndCommission.findpaxwisepercentagemarkup(markupcategoryidofcommissionwiseagent, tourDetails, PPBagentcommissionSupplierCostAfterAgentmarkup, NumberOfadult, NumberOfchild, NumberOfinfant);
        AgentCommission = findpaxwisepercentagemarkup;

    }
    // Each traveler vlaue seperate
    let adultvalue = 0;
    let childvalue = 0;
    let infantvalue = 0;

    if (NumberOfadult > 0) {
        adultvalue = PPBagentcommissionSupplierCostAfterAgentmarkup.adultvalue - AgentCommission.adultvalue;
    }
    if (NumberOfchild > 0) {
        childvalue = PPBagentcommissionSupplierCostAfterAgentmarkup.childvalue - AgentCommission.childvalue;
    }
    if (NumberOfinfant > 0) {
        infantvalue = PPBagentcommissionSupplierCostAfterAgentmarkup.infantvalue - AgentCommission.infantvalue;
    }
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
    // Person per booking supplier coast after agent commission
    if (commissionconfigurationcalculationmethod === "PPB") {
        SupplierCostAfterAgentCommission = {
            adultvalue: adultvalue2,
            childvalue: childvalue2,
            infantvalue: infantvalue2
        }

    }
    // Person per night supplier coast after agent commission
    else if (commissionconfigurationcalculationmethod === "PPN") {
        SupplierCostAfterAgentCommission = {
            adultvalue: adultvalue2 * NumberOfNights,
            childvalue: childvalue2 * NumberOfNights,
            infantvalue: infantvalue2 * NumberOfNights
        }

    }
    // Total supplier coast after agent commission 
    TotalSupplierCostAfterAgentCommission = SupplierCostAfterAgentCommission.adultvalue + SupplierCostAfterAgentCommission.childvalue + SupplierCostAfterAgentCommission.infantvalue;
    return TotalSupplierCostAfterAgentCommission;

}

async function findPersonPerBookingValue(agentCommissionObject, commissionconfigurationcalculationmethod, adultvalue1, childvalue1, infantvalue1){

    let {
        markupconfigurationcalculationmethod,
        NumberOfNights,
        SupplierCostAfterAgentMarkup,
        NumberOfadult,
        NumberOfchild,
        NumberOfinfant,
        NumberOfTravellers
    } = agentCommissionObject

    if (commissionconfigurationcalculationmethod === "PPB") {
        let setTravellerWithPPBFunctionObject = {
            adultvalue1,
            childvalue1,
            infantvalue1,
            NumberOfadult,
            NumberOfchild,
            NumberOfinfant,
            markupconfigurationcalculationmethod,
            SupplierCostAfterAgentMarkup
        }
        let travellerWithPPB = setTravellerWithPPB(setTravellerWithPPBFunctionObject)
        adultvalue1 = travellerWithPPB.adultvalue1
        childvalue1 = travellerWithPPB.childvalue1
        infantvalue1 = travellerWithPPB.infantvalue1
        
    }
    // Person per night
    else if (commissionconfigurationcalculationmethod === "PPN") {
        const result = await priceValueForPersonPerNight(markupconfigurationcalculationmethod, SupplierCostAfterAgentMarkup, NumberOfadult, NumberOfchild, NumberOfinfant, NumberOfNights, NumberOfTravellers)
        adultvalue1 = result.adultvalue1;
        childvalue1 = result.childvalue1;
        infantvalue1 = result.infantvalue1;
    }

    return {
        adultvalue1,
        childvalue1,
        infantvalue1
    }
}

async function priceValueForPersonPerNight(markupconfigurationcalculationmethod, SupplierCostAfterAgentMarkup,  NumberOfadult, NumberOfchild, NumberOfinfant, NumberOfNights, NumberOfTravellers){
    let adultvalue1;
    let childvalue1;
    let infantvalue1;
    if (markupconfigurationcalculationmethod === "PPB" || markupconfigurationcalculationmethod === "PPN") {

        if (NumberOfadult > 0) {
            adultvalue1 = SupplierCostAfterAgentMarkup.adultvalue / NumberOfadult / NumberOfNights;
        }
        if (NumberOfchild > 0) {
            childvalue1 = SupplierCostAfterAgentMarkup.childvalue / NumberOfchild / NumberOfNights;
        }
        if (NumberOfinfant > 0) {
            infantvalue1 = SupplierCostAfterAgentMarkup.infantvalue / NumberOfinfant / NumberOfNights;
        }

    }
    else {

        if (NumberOfadult > 0) {
            adultvalue1 = SupplierCostAfterAgentMarkup / NumberOfTravellers / NumberOfNights;
        }
        if (NumberOfchild > 0) {
            childvalue1 = SupplierCostAfterAgentMarkup / NumberOfTravellers / NumberOfNights;
        }
        if (NumberOfinfant > 0) {
            infantvalue1 = SupplierCostAfterAgentMarkup / NumberOfTravellers / NumberOfNights;
        }

    }
    return {
        adultvalue1,
        childvalue1,
        infantvalue1
    }
}


// find TotalSupplierCostAfterAgentMarkupTemp for unit wise
async function perUnitMarkupCalculation(agentMarkupObject){

    let {
        markupconfigurationcalculationmethod,
        companymarkupconfigurationcalculationmethod,
        SupplierCostAfterCompanyMarkup,
        NumberOfNights,
        markupcategoryidwiseagent,
        AgentMarkup,
        SupplierCostAfterAgentMarkup,
        TotalSupplierCostAfterAgentMarkup,
        tourDetails
    } = agentMarkupObject

    

    let UPBagentSupplierCostAfterCompanyMarkup = 0;
    if (markupconfigurationcalculationmethod === "UPB") {
        // Calculating UPB value

        if (companymarkupconfigurationcalculationmethod === "UPB" || companymarkupconfigurationcalculationmethod === "UPN") {                       
            UPBagentSupplierCostAfterCompanyMarkup = SupplierCostAfterCompanyMarkup;

        }
        else {
            UPBagentSupplierCostAfterCompanyMarkup = SupplierCostAfterCompanyMarkup.adultvalue + SupplierCostAfterCompanyMarkup.childvalue + SupplierCostAfterCompanyMarkup.infantvalue;

        }
    }
    else if (markupconfigurationcalculationmethod === "UPN") {
        // Calculating unit per night price.
        if (companymarkupconfigurationcalculationmethod === "UPB" || companymarkupconfigurationcalculationmethod === "UPN") {
            UPBagentSupplierCostAfterCompanyMarkup = SupplierCostAfterCompanyMarkup / NumberOfNights;
        }
        else {
            UPBagentSupplierCostAfterCompanyMarkup = (SupplierCostAfterCompanyMarkup.adultvalue + SupplierCostAfterCompanyMarkup.childvalue + SupplierCostAfterCompanyMarkup.infantvalue) / NumberOfNights;
        }
    }

    // Find fixed value
    if (markupcategoryidwiseagent[0].valuetype.trim() === "F") {

        let findfixmarkup = await markupAndCommission.findfixmarkup(markupcategoryidwiseagent, tourDetails);
        AgentMarkup = findfixmarkup;
        
    }
    // Find percentage value.
    else if (markupcategoryidwiseagent[0].valuetype.trim() === "P") {

        let findpercentagemarkup = await markupAndCommission.findpercentagemarkup(markupcategoryidwiseagent, tourDetails, UPBagentSupplierCostAfterCompanyMarkup);
        AgentMarkup = findpercentagemarkup;
        
    }                
    // UPB supplier coast after adding markup value
    let UPBSupplierCostAfterAgentMarkup = UPBagentSupplierCostAfterCompanyMarkup + AgentMarkup;
    // UPB
    if (markupconfigurationcalculationmethod === "UPB") {
        SupplierCostAfterAgentMarkup = UPBSupplierCostAfterAgentMarkup;
    }
    // UPN
    else if (markupconfigurationcalculationmethod === "UPN") {
        SupplierCostAfterAgentMarkup = UPBSupplierCostAfterAgentMarkup * NumberOfNights;
    }
    // Total supplier coast after adding agent markup
    TotalSupplierCostAfterAgentMarkup = SupplierCostAfterAgentMarkup;

    return {
        TotalSupplierCostAfterAgentMarkup,
        AgentMarkup,
        SupplierCostAfterAgentMarkup
    }
}

// find TotalSupplierCostAfterAgentMarkupTemp for person wise
async function perPersonMarkupCalculation(agentMarkupObject){
    let {
        markupconfigurationcalculationmethod,
        NumberOfNights,
        markupcategoryidwiseagent,
        AgentMarkup,
        SupplierCostAfterAgentMarkup,
        TotalSupplierCostAfterAgentMarkup,
        tourDetails,
        NumberOfadult,
        NumberOfchild,
        NumberOfinfant
    } = agentMarkupObject

    let adultvalue1 = 0;
    let childvalue1 = 0;
    let infantvalue1 = 0;

    if (markupconfigurationcalculationmethod === "PPB") {
        // Calculating person per booking price

        const result = await personPerBookingpriceCalculation(agentMarkupObject, adultvalue1, childvalue1, infantvalue1)
        adultvalue1 = result.adultvalue1;
        childvalue1 = result.childvalue1;
        infantvalue1 = result.infantvalue1;
    }
    else if (markupconfigurationcalculationmethod === "PPN") {
        // Person per night calculation

        const result = await personPerNightpriceCalculation(agentMarkupObject, adultvalue1, childvalue1, infantvalue1)
        adultvalue1 = result.adultvalue1;
        childvalue1 = result.childvalue1;
        infantvalue1 = result.infantvalue1;
        

    }
    // Person per booking supplier coast after comnpany markup value
    let PPBagentSupplierCostAfterCompanyMarkup = {
        adultvalue: adultvalue1,
        childvalue: childvalue1,
        infantvalue: infantvalue1
    };
    // Find the fixed value
    if (markupcategoryidwiseagent[0].valuetype.trim() === "F") {

        let findpaxwisefixmarkup = await markupAndCommission.findpaxwisefixmarkup(markupcategoryidwiseagent, tourDetails);
        AgentMarkup = findpaxwisefixmarkup;
        
    }
    // Find the percentage value
    else if (markupcategoryidwiseagent[0].valuetype.trim() === "P") {

        let findpaxwisepercentagemarkup = await markupAndCommission.findpaxwisepercentagemarkup(markupcategoryidwiseagent, tourDetails, PPBagentSupplierCostAfterCompanyMarkup, NumberOfadult, NumberOfchild, NumberOfinfant);
        AgentMarkup = findpaxwisepercentagemarkup;
        
    }
    // Taking each passengers value 
    let adultvalue = 0;
    let childvalue = 0;
    let infantvalue = 0;

    if (NumberOfadult > 0) {
        adultvalue = PPBagentSupplierCostAfterCompanyMarkup.adultvalue + AgentMarkup.adultvalue;
    }
    if (NumberOfchild > 0) {
        childvalue = PPBagentSupplierCostAfterCompanyMarkup.childvalue + AgentMarkup.childvalue;
    }
    if (NumberOfinfant > 0) {
        infantvalue = PPBagentSupplierCostAfterCompanyMarkup.infantvalue + AgentMarkup.infantvalue;
    }
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
    // Person per booking
    if (markupconfigurationcalculationmethod === "PPB") {
        SupplierCostAfterAgentMarkup = {
            adultvalue: adultvalue2,
            childvalue: childvalue2,
            infantvalue: infantvalue2
        }

    }
    // Person per night
    else if (markupconfigurationcalculationmethod === "PPN") {
        SupplierCostAfterAgentMarkup = {
            adultvalue: adultvalue2 * NumberOfNights,
            childvalue: childvalue2 * NumberOfNights,
            infantvalue: infantvalue2 * NumberOfNights
        }

    }
    // Final value of supplier coast after agent markup .
    TotalSupplierCostAfterAgentMarkup = SupplierCostAfterAgentMarkup.adultvalue + SupplierCostAfterAgentMarkup.childvalue + SupplierCostAfterAgentMarkup.infantvalue;
    return {
        TotalSupplierCostAfterAgentMarkup,
        AgentMarkup,
        SupplierCostAfterAgentMarkup
    }
}

// find price per person per booking
async function personPerBookingpriceCalculation(agentMarkupObject, adultvalue1, childvalue1, infantvalue1){
    let {
        companymarkupconfigurationcalculationmethod,
        SupplierCostAfterCompanyMarkup,
        NumberOfadult,
        NumberOfchild,
        NumberOfinfant,
        NumberOfTravellers
    } = agentMarkupObject
    if (companymarkupconfigurationcalculationmethod === "PPB" || companymarkupconfigurationcalculationmethod === "PPN") {
        if (NumberOfadult > 0) {
            adultvalue1 = SupplierCostAfterCompanyMarkup.adultvalue / NumberOfadult;
        }
        if (NumberOfchild > 0) {
            childvalue1 = SupplierCostAfterCompanyMarkup.childvalue / NumberOfchild;
        }
        if (NumberOfinfant > 0) {
            infantvalue1 = SupplierCostAfterCompanyMarkup.infantvalue / NumberOfinfant;
        }

    }
    else {
        if (NumberOfadult > 0) {
            adultvalue1 = SupplierCostAfterCompanyMarkup / NumberOfTravellers;
        }
        if (NumberOfchild > 0) {
            childvalue1 = SupplierCostAfterCompanyMarkup / NumberOfTravellers;
        }
        if (NumberOfinfant > 0) {
            infantvalue1 = SupplierCostAfterCompanyMarkup / NumberOfTravellers;
        }

    }

    return {
        adultvalue1,
        childvalue1,
        infantvalue1
    }
}

// find price per person per night
async function personPerNightpriceCalculation(agentMarkupObject, adultvalue1, childvalue1, infantvalue1){
    
    let {
        companymarkupconfigurationcalculationmethod,
        SupplierCostAfterCompanyMarkup,
        NumberOfNights,
        NumberOfadult,
        NumberOfchild,
        NumberOfinfant,
        NumberOfTravellers
    } = agentMarkupObject
    
    if (companymarkupconfigurationcalculationmethod === "PPB" || companymarkupconfigurationcalculationmethod === "PPN") {

        if (NumberOfadult > 0) {
            adultvalue1 = SupplierCostAfterCompanyMarkup.adultvalue / NumberOfadult / NumberOfNights;
        }
        if (NumberOfchild > 0) {
            childvalue1 = SupplierCostAfterCompanyMarkup.childvalue / NumberOfchild / NumberOfNights;
        }
        if (NumberOfinfant > 0) {
            infantvalue1 = SupplierCostAfterCompanyMarkup.infantvalue / NumberOfinfant / NumberOfNights;
        }

    }
    else {

        if (NumberOfadult > 0) {
            adultvalue1 = SupplierCostAfterCompanyMarkup / NumberOfTravellers / NumberOfNights;
        }
        if (NumberOfchild > 0) {
            childvalue1 = SupplierCostAfterCompanyMarkup / NumberOfTravellers / NumberOfNights;
        }
        if (NumberOfinfant > 0) {
            infantvalue1 = SupplierCostAfterCompanyMarkup / NumberOfTravellers / NumberOfNights;
        }

    }
    return {
        adultvalue1,
        childvalue1,
        infantvalue1
    }
}

// find Company markup value 
async function findCompanyMarkupFunction(companyMarkupObject){
    let {
        companymarkupconfigurationcalculationmethod,        
        CompanyMarkup,
        TotalSupplierCostAfterCompanyMarkup,
        SupplierCostAfterCompanyMarkup,        
        
    } = companyMarkupObject;

    if (companymarkupconfigurationcalculationmethod === "UPB" || companymarkupconfigurationcalculationmethod === "UPN") {
        let UPB_UPN_companyMarkupConfigurationCalculationMethod = await set_UPB_UPN_companyMarkupConfigurationCalculationMethod(companyMarkupObject)
        CompanyMarkup = UPB_UPN_companyMarkupConfigurationCalculationMethod.CompanyMarkup;
        SupplierCostAfterCompanyMarkup = UPB_UPN_companyMarkupConfigurationCalculationMethod.SupplierCostAfterCompanyMarkup;
        TotalSupplierCostAfterCompanyMarkup = UPB_UPN_companyMarkupConfigurationCalculationMethod.TotalSupplierCostAfterCompanyMarkup;
    }
    else if (companymarkupconfigurationcalculationmethod === "PPB" || companymarkupconfigurationcalculationmethod === "PPN") {
        // Convert Per Person Per Booking wise price
        let PPB_PPN_companyMarkupConfigurationCalculationMethod = await set_PPB_PPN_companyMarkupConfigurationCalculationMethod(companyMarkupObject)
        CompanyMarkup = PPB_PPN_companyMarkupConfigurationCalculationMethod.CompanyMarkup;
        SupplierCostAfterCompanyMarkup = PPB_PPN_companyMarkupConfigurationCalculationMethod.SupplierCostAfterCompanyMarkup;
        TotalSupplierCostAfterCompanyMarkup = PPB_PPN_companyMarkupConfigurationCalculationMethod.TotalSupplierCostAfterCompanyMarkup;
           
    }
    return ({
        CompanyMarkup,
        SupplierCostAfterCompanyMarkup,
        TotalSupplierCostAfterCompanyMarkup
    })
}

// find price from request object 
async function findPriceFromRequestObjectFunction(priceSummary){
    let SupplierCost = 0;
    if(priceSummary?.partnerTotalPrice){
        SupplierCost = priceSummary.partnerTotalPrice;
    }
    else if(priceSummary?.fromPrice){
        SupplierCost = priceSummary.fromPrice;
    }
    return SupplierCost;
}

// find tour start date and start time function 
async function findTourStartDateAndTimeFunction(tourDetails, RequestParameters){
    // Taking tour start date from tour details 
    let tourStartDate = new Date();
    if(tourDetails?.startDate){
        tourStartDate = new Date(tourDetails.startDate);
    }        
    else if(tourDetails?.travelDate){
        tourStartDate = new Date(tourDetails.travelDate);
    }
    // Tour start time from availability.
    let tourStartTime = tourDetails?.startTime || "";
    // Tour end date.
    let tourEndDate = RequestParameters?.endDate || "";

    return ({
        tourStartDate,
        tourStartTime,
        tourEndDate
    })
}

// Function for find fix markup
async function setFindfixmarkup(markupcategoryidwisecompanyagent, RequestParameters){
    try {
        let fixmarkup = 0;
        let BookingDate = new Date();
    
        let tourStartDate;
        if(RequestParameters?.travelDate){
            tourStartDate = new Date(RequestParameters.travelDate);
        }
        else{
            tourStartDate = new Date(RequestParameters.startDate);
        }
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
}

// Function for find percentage markup
async function setFindpercentagemarkup(markupcategoryidwisecompanyagent, RequestParameters, Cost){
    try {
        let percentagemarkup = "";
        let BookingDate = new Date();
        let CheckInDate
        if(RequestParameters?.travelDate){
            CheckInDate = new Date(RequestParameters.travelDate);
        }
        else{
            CheckInDate = new Date(RequestParameters.startDate);
        }
        
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
}

// Function for find paxwise fix markup
async function setFindpaxwisefixmarkup(markupcategoryidwisecompanyagent, RequestParameters){
    try {
        let paxwisefixmarkup = "";
        let BookingDate = new Date();
        let CheckInDate;
        if(RequestParameters?.travelDate){
            CheckInDate = new Date(RequestParameters.travelDate);
        }
        else{
            CheckInDate = new Date(RequestParameters.startDate);
        }
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
}

// Function for find paxwise percentage markup
async function setFindpaxwisepercentagemarkup(markupcategoryidwisecompanyagent, RequestParameters, Cost, NumberOfadult, NumberOfchild, NumberOfinfant){
    try {
        let percentagemarkup = {};
        let BookingDate = new Date();
        let CheckInDate;
        if(RequestParameters?.travelDate){
            CheckInDate = new Date(RequestParameters.travelDate);
        }
        else{
            CheckInDate = new Date(RequestParameters.startDate);
        }

        let bookingfromdate = new Date(markupcategoryidwisecompanyagent[0].bookingfromdate);
        let bookingtodate = new Date(markupcategoryidwisecompanyagent[0].bookingtodate);
        let servicefromdate = new Date(markupcategoryidwisecompanyagent[0].servicefromdate);
        let servicetodate = new Date(markupcategoryidwisecompanyagent[0].servicetodate);
                    
        
        if (BookingDate >= bookingfromdate && BookingDate <= bookingtodate && CheckInDate >= servicefromdate && CheckInDate <= servicetodate) {            

            if (markupcategoryidwisecompanyagent[0].markupconfigurationdetailcalculationmethod === "MKU") {

                let percentagemarkupCountMKU = setPercentagemarkupCountMKU(NumberOfadult, NumberOfchild, NumberOfinfant, Cost, markupcategoryidwisecompanyagent);
                
                percentagemarkup = percentagemarkupCountMKU;
            }
            else if (markupcategoryidwisecompanyagent[0].markupconfigurationdetailcalculationmethod === "MRG") {
                let percentagemarkupCountMRG = setPercentagemarkupCountMRG(NumberOfadult, NumberOfchild, NumberOfinfant, Cost, markupcategoryidwisecompanyagent);
                percentagemarkup = percentagemarkupCountMRG;

            }
        }
        else {
            percentagemarkup = {
                adultvalue: 0,
                childvalue: 0,
                infantvalue: 0
            };
        }
        return percentagemarkup;
    }
    catch (err) {
        console.log(err);
        throw (err);
    }
}

// Function for convert duration to end date
async function setConvertDurationToEndDate(clientId, startDate, duration, startTime){
    
    try{            
        let travelDate = moment(startDate);

        let durationMinutes = duration;

        // Find the end date and end time 
        //---------------------------------------//
        if (startTime != "") {
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
        console.log(error);                   
        // Send Error response
        return error;
    }
}

// Function for getting number of nights in trip
async function setGetNumberOfNights(clientId, StartDate, EndDate, duration){
    
    try{            
        // Step 1: Parse the start date and end date using moment.js
        let startDate = moment(StartDate);
        let endDate = moment(EndDate);
        let NumberOfNights = 1;
        // Compare two date and if the both dates are same return 1 night
        if (!startDate.isSame(endDate, 'day')) {
            // Calculate the duration in seconds
            let durationInSeconds = endDate.diff(startDate, 'seconds');

            // Convert the duration to days
            let durationInDays = durationInSeconds / (60 * 60 * 24);
            NumberOfNights = Math.ceil(durationInDays);
        }                                                                              

        return NumberOfNights;
    }
    catch(error){
        console.log(error);
        // Send Error response
        return error;
    }
}

// Function for Percentage markup MKU
function setPercentagemarkupCountMKU(NumberOfadult, NumberOfchild, NumberOfinfant, Cost, markupcategoryidwisecompanyagent){

    let adultvalue = 0;
    let childvalue = 0;
    let infantvalue = 0;

    if (NumberOfadult > 0) {
        adultvalue = (Cost.adultvalue * parseFloat(markupcategoryidwisecompanyagent[0].adultvalue)) / 100;
    }
    if (NumberOfchild > 0) {
        childvalue = (Cost.childvalue * parseFloat(markupcategoryidwisecompanyagent[0].childvalue)) / 100;
    }
    if (NumberOfinfant > 0) {
        infantvalue = (Cost.infantvalue * parseFloat(markupcategoryidwisecompanyagent[0].infantvalue)) / 100;
    }

    let responseData = {
        adultvalue: adultvalue,
        childvalue: childvalue,
        infantvalue: infantvalue
    };

    return responseData
}

// Function for Percentage markup MRG
function setPercentagemarkupCountMRG(NumberOfadult, NumberOfchild, NumberOfinfant, Cost, markupcategoryidwisecompanyagent){
    let adultvalue = 0;
    let childvalue = 0;
    let infantvalue = 0;
    if (NumberOfadult > 0) {
        adultvalue = (Cost.adultvalue * parseFloat(markupcategoryidwisecompanyagent[0].adultvalue)) / (100 - parseFloat(markupcategoryidwisecompanyagent[0].adultvalue));
    }
    if (NumberOfchild > 0) {
        childvalue = (Cost.childvalue * parseFloat(markupcategoryidwisecompanyagent[0].childvalue)) / (100 - parseFloat(markupcategoryidwisecompanyagent[0].childvalue));
    }
    if (NumberOfinfant > 0) {
        infantvalue = (Cost.infantvalue * parseFloat(markupcategoryidwisecompanyagent[0].infantvalue)) / (100 - parseFloat(markupcategoryidwisecompanyagent[0].infantvalue));
    }
    let responseData = {
        adultvalue: adultvalue,
        childvalue: childvalue,
        infantvalue: infantvalue
    }
    return responseData
}

// Function for set passanger details
async function setPassangerDetailData(passangers){
    let adult = 0;
    let child = 0;
    let infant = 0;

    if(!Array.isArray(passangers)){

        if(passangers.adult){
            adult = passangers.adult;
        }
        if(passangers.child || passangers.children){
            child = passangers.child ?? passangers.children;
        }
        if(passangers.infant){
            infant = passangers.infant;
        }        
        let responseData = {
            "adult" : adult,
            "child" : child, 
            "infant" : infant            
        }
        return responseData;
    }
    else{
        let responseData = {
            "adult" : adult,
            "child" : child, 
            "infant" : infant            
        }
        for(let passangersData of passangers){
            let passangerDetails = await setPassangerDetailsAsArray(passangersData, responseData)
            responseData = passangerDetails
        }
        return responseData;
    }
}

// Function for set passanger details if it is an array
async function setPassangerDetailsAsArray(passangers, responseData){
    
    switch(passangers.ageBand){
        case "ADULT":
            responseData.adult = passangers.numberOfTravelers;
            break;
        case "CHILD" : 
            responseData.child = passangers.numberOfTravelers;
            break;
        case "INFANT":
            responseData.infant = passangers.numberOfTravelers;
            break;
        case "TRAVELER" : 
            responseData.traveler = passangers.numberOfTravelers;
            break;
        case "YOUTH":
        case "SENIOR" : 
            if(responseData.adult != 0){
                responseData.adult = responseData.adult + passangers.numberOfTravelers;
            }
            else{
                responseData.adult = passangers.numberOfTravelers;
            }
            break;        
        default:
            break
    }
    return responseData;
}

// Function for set  travellers having commissionconfigurationcalculationmethod === "PPB"
function setTravellerWithPPB(setTravellerWithPPBObject){

    let {
        adultvalue1,
        childvalue1,
        infantvalue1,
        NumberOfadult,
        NumberOfchild,
        NumberOfinfant,
        markupconfigurationcalculationmethod,
        SupplierCostAfterAgentMarkup
    } = setTravellerWithPPBObject;

    if (markupconfigurationcalculationmethod === "PPB" || markupconfigurationcalculationmethod === "PPN") {

        if (NumberOfadult > 0) {
            adultvalue1 = SupplierCostAfterAgentMarkup.adultvalue / NumberOfadult;
        }
        if (NumberOfchild > 0) {
            childvalue1 = SupplierCostAfterAgentMarkup.childvalue / NumberOfchild;
        }
        if (NumberOfinfant > 0) {
            infantvalue1 = SupplierCostAfterAgentMarkup.infantvalue / NumberOfinfant;
        }
        let responseData = {
            "adultvalue1" : adultvalue1,
            "childvalue1" : childvalue1,
            "infantvalue1" : infantvalue1
        }
        return responseData

    }
    else {

        if (NumberOfadult > 0) {
            adultvalue1 = SupplierCostAfterAgentMarkup / NumberOfTravellers;
        }
        if (NumberOfchild > 0) {
            childvalue1 = SupplierCostAfterAgentMarkup / NumberOfTravellers;
        }
        if (NumberOfinfant > 0) {
            infantvalue1 = SupplierCostAfterAgentMarkup / NumberOfTravellers;
        }
        let responseData = {
            "adultvalue1" : adultvalue1,
            "childvalue1" : childvalue1,
            "infantvalue1" : infantvalue1
        }
        return responseData

    }

}

// Function for set UPB and UPN company markup configuration method
async function set_UPB_UPN_companyMarkupConfigurationCalculationMethod(parmasObject){
    let {
        companymarkupconfigurationcalculationmethod,
        SupplierConvertedCost,
        NumberOfNights,
        markupcategoryidwisecompanyagent,
        tourDetails,
        TotalSupplierCostAfterCompanyMarkup,
        SupplierCostAfterCompanyMarkup,
        flagignorecompanymarkup        
    } = parmasObject;

    let UPBSupplierConvertedCost = 0;
    let TotalSupplierCost = TotalSupplierCostAfterCompanyMarkup
    let CompanyMarkupData = 0
    // Convert Per Unit Per Booking wise price
    if (companymarkupconfigurationcalculationmethod === "UPB") {    
        UPBSupplierConvertedCost = SupplierConvertedCost;
    }
    // Convert Per Unit Per Night wise price
    else if (companymarkupconfigurationcalculationmethod === "UPN") {   
        UPBSupplierConvertedCost = SupplierConvertedCost / NumberOfNights;
    }

    // Find Fix Markup
    if (markupcategoryidwisecompanyagent[0].valuetype.trim() === "F") {  
        // Get fixed markup value
        let findfixmarkup = await markupAndCommission.findfixmarkup(markupcategoryidwisecompanyagent, tourDetails);
        CompanyMarkupData = findfixmarkup;

    }

    // Find Percentage Markup
    else if (markupcategoryidwisecompanyagent[0].valuetype.trim() === "P") {  

        // Get percentage markup value.
        let findpercentagemarkup = await markupAndCommission.findpercentagemarkup(markupcategoryidwisecompanyagent, tourDetails, UPBSupplierConvertedCost);
        CompanyMarkupData = findpercentagemarkup;


    }
    else {
        return ({ "Error": "valuetype is not valid. valuetype must be 'P' or 'F'." });
    }

    // If flagignorecompanymarkup = false then and only then add company markup 
    let UPBSupplierCostAfterCompanyMarkup;
    if (flagignorecompanymarkup === false) { 
        // Adding   UPB Supplier Converted Cost + company markup
        UPBSupplierCostAfterCompanyMarkup = UPBSupplierConvertedCost + CompanyMarkupData;
    }
    else {
        UPBSupplierCostAfterCompanyMarkup = UPBSupplierConvertedCost;
    }

    // Calculating supplier coast after comapny markup in UPB 
    if (companymarkupconfigurationcalculationmethod === "UPB") {
        SupplierCostAfterCompanyMarkup = UPBSupplierCostAfterCompanyMarkup;


    }
    // If UPN cheking with number of nights.
    else if (companymarkupconfigurationcalculationmethod === "UPN") {
        SupplierCostAfterCompanyMarkup = UPBSupplierCostAfterCompanyMarkup * NumberOfNights;
    }
    // Final value of supplier coast after company markup value.
    TotalSupplierCost = SupplierCostAfterCompanyMarkup;   
    
    let responseData = {
        "CompanyMarkup" : CompanyMarkupData,
        "SupplierCostAfterCompanyMarkup" : await SupplierCostAfterCompanyMarkup,
        "TotalSupplierCostAfterCompanyMarkup" : await TotalSupplierCost
    }
    return responseData
}

// Function for set PPB and PPN company markup configuration calculation method
async function set_PPB_PPN_companyMarkupConfigurationCalculationMethod(parmasObject){

    let {
        companymarkupconfigurationcalculationmethod,
        SupplierConvertedCost,
        NumberOfNights,
        markupcategoryidwisecompanyagent,
        tourDetails,
        CompanyMarkup,
        TotalSupplierCostAfterCompanyMarkup,
        SupplierCostAfterCompanyMarkup,
        flagignorecompanymarkup,
        NumberOfadult,
        NumberOfchild,
        NumberOfinfant,
        NumberOfTravellers
    } = parmasObject;

    let perpersonwisevalu1 = 0;
    let TotalSupplierCost = TotalSupplierCostAfterCompanyMarkup
    if (companymarkupconfigurationcalculationmethod === "PPB") { 
        
        perpersonwisevalu1 = SupplierConvertedCost / NumberOfTravellers;
        
    }
    // Convert Per Person Per Night wise price
    else if (companymarkupconfigurationcalculationmethod === "PPN") {   
        perpersonwisevalu1 = SupplierConvertedCost / NumberOfTravellers / NumberOfNights;
    }
    // Checking price for individual travelers.
    let adultvalue1 = 0;
    let childvalue1 = 0;
    let infantvalue1 = 0;

    if (NumberOfadult > 0) {
        adultvalue1 = perpersonwisevalu1;
    }
    if (NumberOfchild > 0) {
        childvalue1 = perpersonwisevalu1;
    }
    if (NumberOfinfant > 0) {
        infantvalue1 = perpersonwisevalu1;
    }
    // Each passanger wise value as an object.
    let PPBSupplierConvertedCost = {
        adultvalue: adultvalue1,
        childvalue: childvalue1,
        infantvalue: infantvalue1
    };

    // Find Fix Markup
    if (markupcategoryidwisecompanyagent[0].valuetype.trim() === "F") {   

        let findpaxwisefixmarkup = await markupAndCommission.findpaxwisefixmarkup(markupcategoryidwisecompanyagent, tourDetails);
        CompanyMarkup = findpaxwisefixmarkup;
    }
    // Find Percentage Markup
    else if (markupcategoryidwisecompanyagent[0].valuetype.trim() === "P") {  

        let findpaxwisepercentagemarkup = await markupAndCommission.findpaxwisepercentagemarkup(markupcategoryidwisecompanyagent, tourDetails, PPBSupplierConvertedCost, NumberOfadult, NumberOfchild, NumberOfinfant);
        CompanyMarkup = findpaxwisepercentagemarkup;
    }

    // If flagignorecompanymarkup = false then and only then add company markup
    let PPBSupplierCostAfterCompanyMarkup;

    if (flagignorecompanymarkup === false) {   
        
        // Taking each passangers value individually.
        let takingPassangersIndividually = setPassangersIndividually(PPBSupplierConvertedCost, CompanyMarkup, NumberOfadult, NumberOfchild, NumberOfinfant);

        PPBSupplierCostAfterCompanyMarkup = takingPassangersIndividually
    }
    else {
        PPBSupplierCostAfterCompanyMarkup = PPBSupplierConvertedCost;
    }
    
    // Getting each passanger value.
    let adultvalue2 = PPBSupplierCostAfterCompanyMarkup.adultvalue * NumberOfadult;
    let childvalue2 = PPBSupplierCostAfterCompanyMarkup.childvalue * NumberOfchild;
    let infantvalue2 = PPBSupplierCostAfterCompanyMarkup.infantvalue * NumberOfinfant;
    
    if (companymarkupconfigurationcalculationmethod === "PPB") {

        // Person per booking price object
        SupplierCostAfterCompanyMarkup = {
            adultvalue: adultvalue2,
            childvalue: childvalue2,
            infantvalue: infantvalue2
        }

    }
    else if (companymarkupconfigurationcalculationmethod === "PPN") {
        // Per person per night values
        SupplierCostAfterCompanyMarkup = {
            adultvalue: adultvalue2 * NumberOfNights,
            childvalue: childvalue2 * NumberOfNights,
            infantvalue: infantvalue2 * NumberOfNights
        }

    }
    
    TotalSupplierCost = SupplierCostAfterCompanyMarkup.adultvalue + SupplierCostAfterCompanyMarkup.childvalue + SupplierCostAfterCompanyMarkup.infantvalue;
    
    let responseData = {
        "CompanyMarkup" : await CompanyMarkup,
        "SupplierCostAfterCompanyMarkup" : await SupplierCostAfterCompanyMarkup,
        "TotalSupplierCostAfterCompanyMarkup" : await TotalSupplierCost
    }
    return responseData;
}

// Function for set passangers individually
function setPassangersIndividually(PPBSupplierConvertedCost, CompanyMarkup, NumberOfadult, NumberOfchild, NumberOfinfant){

    let adultvalue = 0;
    let childvalue = 0;
    let infantvalue = 0;
    
    if (NumberOfadult > 0) {
        adultvalue = PPBSupplierConvertedCost.adultvalue + CompanyMarkup.adultvalue;
    }
    if (NumberOfchild > 0) {
        childvalue = PPBSupplierConvertedCost.childvalue + CompanyMarkup.childvalue;
    }
    if (NumberOfinfant > 0) {
        infantvalue = PPBSupplierConvertedCost.infantvalue + CompanyMarkup.infantvalue;
    }
    // Each passanger total value as an object
    let responseData = {
        adultvalue: adultvalue,
        childvalue: childvalue,
        infantvalue: infantvalue,
        total: adultvalue + childvalue + infantvalue
    };
    
    return responseData;
}

module.exports = markupAndCommission;