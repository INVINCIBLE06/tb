"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const markupPrice = require("../markupCommission/tourMarkup.js");
const markupMoonstrideData = require("../markupCommission/Response.js");
const config = require("../../../../Config.js")
const crypto = require("crypto");
let travelers = [];
let providerPriceDetails = {};

module.exports = async (app) =>{
    app.post("/:id/Tour/1way2italy/PriceCheck", async function(request, response, next){
        // Validating request fields. 
        await apiCommonController.viatorProductpriceCheck(request, response, next);
    }, async function(request, response){
        const requestObj = request.body;

        let productCode = (requestObj.productCode).split('|')
        requestObj.productCode = productCode[0]
        requestObj.chainCode = requestObj.productOptionCode[0]
        requestObj.productOptionCode = productCode[1]
        const clientId = request.params.id;
        let fName = "Price_Check_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_PRICE_CHECK_PROVIDER_PRICE_CHECK_FILE_PATH, config.Provider_Code_OWT);
        try{
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "OneWay2Italy");
            if (!providerDetails.Requestor_ID && !providerDetails.Password) {
                throw new Error(config.OWTApiKeyErrorMessage);
            }
            await managePassengersAge(requestObj);
            let result;
            // Getting the availability response
            result = await apiResponse.getPriceCheckApiReponse(clientId, requestObj, 'tourActivityavail', providerDetails, request);
            // Checking if the response is success or error.                    
            if(result != undefined && result.Activities != undefined){
                let formatedResult = await resultObjectFormatter(result?.Activities, requestObj, request, fName, fPath, clientId, providerDetails);
                if(formatedResult != undefined && formatedResult.available){
                    response.status(200).send({
                        "Result": formatedResult
                    });
                }
                else{
                    response.status(200).send({
                        "Result": {
                            "Code": 400,
                            "Error": {
                                "Message": formatedResult?.RESPONSE?.text || "Product is Not Available Right Now."
                            }
                        }
                    });
                }
            } else {
                response.status(200).send({
                    "Result": {
                        "Code": 400,
                        "Error": {
                            "Message": result.message ?? "No data found"
                        }
                    }
                });
            };

        }
        catch(error){
            // Handle error safely and add logs
            const errorObject = {
                "STATUS": "ERROR",
                "RESPONSE": {
                    "text": error.message
                }
            };
            apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
            response.send(errorObject);
        }
    });
};

// checking age is availabe otherwise taking a default age by ageband.
async function managePassengersAge(requestObj){
    let passenger = requestObj.passengerDetails
    for(let pax of passenger){
        if(!pax.age || pax.age == ""){
            switch(pax.ageBand){
                case "ADULT":
                    pax.age = 18 + Math.floor(crypto.randomBytes(4).readUInt32LE(0) / 0xFFFFFFFF * 62);
                    break;
                case "CHILD":
                    pax.age = 2 + Math.floor(crypto.randomBytes(4).readUInt32LE(0) / 0xFFFFFFFF * 16);
                    break;
                case "INFANT":
                    pax.age = 2;
                    break;
                default:
                    break;
            }
        }
    }
    return passenger;
}

// Function to format result object
async function resultObjectFormatter(result, requestObj, request, fName, fPath, clientId, providerDetails){
    try{
        if (!result) {
            throw new Error("No data found.");
        }
            // Final data for return
            let finalData = {
            "productCode" : requestObj.productCode,
            "travelDate" : requestObj.travelDate,
            "currency" : "EUR",
        };
        // Get the subproducts.
        let productOptions = result?.Activity;
        if(!Array.isArray(productOptions)){
            productOptions = [productOptions]
        };

        let matchingProduct = productOptions.find(item => item?.BasicPropertyInfo?._attributes?.TourActivityCode  === requestObj?.productCode);
    
        if (!matchingProduct) {
            throw new Error("Given Product is Not Available Right Now.");
        }
        
        //Handle availablity status
        finalData.available = await handleAvailabilityStatus(matchingProduct);

        const { productOptionCode, starTime } = getProductOptionCodeAndStartTime(matchingProduct);
        finalData.productOptionCode = productOptionCode;
        finalData.starTime = starTime;

        let lineItems = await handleLineItems(matchingProduct, requestObj);      
        finalData = await travelersData(lineItems, finalData);
                        
        // Adding markup price
        let accessToken = "";
        requestObj.pricingInfo = matchingProduct?.ActivityRates?.ActivityRate?.Total;

        // Checking the response has Activity object.
        let token = requestObj?.msToken;
        let agentID = requestObj?.agentGuid;

        const markupResponse = await getMarkupResponse(clientId, requestObj, agentID, token, request, providerDetails, accessToken);
        
            //===================== Supplier coast ==============================//                        
        // Price classification objects.
        let SupplierCost = {
            "Currency": "EUR",
            "CalculationMethod": "PER_PERSON",
            "Amount": {
                "BeforeTax": 0,
                // Total partnerNetPrice.
                "AfterTax": matchingProduct?.ActivityRates?.ActivityRate?.Total?._attributes?.AmountAfterTax || 0,
                "Tax": 0,
                "CostBreakDownBeforeTax": {
                    "Adult": 0,
                    "Child": 0,
                    "Infant": 0
                },
                // All individual price
                "CostBreakDownAfterTax": {
                    "Adult": 0,
                    "Child": 0,
                    "Infant": 0
                },
                "TaxBreakDown": {
                    "Adult": 0,
                    "Child": 0,
                    "Infant": 0
                },
                "TaxDetail": {
                    "AccountCode": 0,
                    "TaxRate": {
                        "Name": "",
                        "EffectiveTax": ""
                    },
                    "Type": ""
                }
            }
        };
        
        // Supplier cost for each traveler.
        let totalNumberOftravelers = await numberOfTravelers(travelers)

        if(lineItems.length != 0){

            let totalSupplierPrice = providerPriceDetails.priceSummary.partnerTotalPrice;
            

            let minimumPrice = (totalSupplierPrice / totalNumberOftravelers);

            // Handle supplier cost
            let { AdultSupplierCost, ChildSupplierCost, InfantSupplierCost } = await handleSupplierCost(lineItems, minimumPrice );
            SupplierCost.Amount.CostBreakDownAfterTax.Adult = AdultSupplierCost;
            SupplierCost.Amount.CostBreakDownAfterTax.Child= ChildSupplierCost ;
            SupplierCost.Amount.CostBreakDownAfterTax.Infant = InfantSupplierCost;

        }
        
        // Supplier cosat                
        finalData.SupplierCost = SupplierCost;      
        // ============= Supplier coast end =============================//
        // ============ SupplierCommission ==========================//
        let SupplierCommission = {
            "CommissionBeforeTax": 0,
            "CommissionAfterTax": 0,
            "TaxDetail": {
                "AccountCode": 0,
                "TaxRate": {
                    "Name": "",
                    "EffectiveTax": ""
                },
                "Type": ""
            },
            "CommissionPayable": 0
        }
        finalData.SupplierCommission = SupplierCommission;
        // =============== SupplierCommission ends ===================//
        //================== SupplierDeposit =======================//
        let SupplierDeposit = {
            "Type": "",
            "Value": 0,
            "Amount": 0
        }
        finalData.SupplierDeposit = SupplierDeposit;
        // ==================== SupplierDeposit =====================//
        // ================== CustomerPrice =======================//
        let CustomerPrice = {
            "Currency": markupResponse?.AgentCurrencyCode || "EUR",
            "ExchangeRate": 0,
            "CalculationMethod": "PER_PERSON",
            "Amount": {
                "BeforeTax": 0,
                "AfterTax":  markupResponse?.TotalSupplierCostAfterAgentMarkup ?? matchingProduct?.ActivityRates?.ActivityRate?.Total?._attributes?.AmountAfterTax,
                "Tax": 0,
                "PriceBreakDownBeforeTax": {
                    "Adult": 0,
                    "Child": 0,
                    "Infant": 0
                },
                "PriceBreakDownAfterTax": {
                    "Adult": 0,
                    "Child": 0,
                    "Infant": 0
                },
                "TaxBreakDown": {
                    "Adult": 0,
                    "Child": 0,
                    "Infant": 0
                },
                "TaxDetail": {
                    "AccountCode": 0,
                    "TaxRate": {
                        "Name": "",
                        "EffectiveTax": ""
                    },
                    "Type": ""
                }
            }
        }
        if(lineItems.length != 0){
            let totalCustomerPrice = markupResponse?.TotalSupplierCostAfterAgentMarkup ?? matchingProduct?.ActivityRates?.ActivityRate?.Total?._attributes?.AmountAfterTax;                    

            let minimumPrice = (totalCustomerPrice / totalNumberOftravelers);
            // Function to handle customer price
            let { AdultCustomerPrice, ChildCustomerPrice, InfantCustomerPrice } = await handleCustomerCost(lineItems, minimumPrice );
            CustomerPrice.Amount.PriceBreakDownAfterTax.Adult = AdultCustomerPrice;
            CustomerPrice.Amount.PriceBreakDownAfterTax.Child = ChildCustomerPrice;
            CustomerPrice.Amount.PriceBreakDownAfterTax.Infant = InfantCustomerPrice;

        }
            
        finalData.CustomerPrice = CustomerPrice;
        //======================= CustomerPrice ======================//
        //====================== CommissionPayable ===================//
        let CommissionPayable = {
            "CommissionBeforeTax": 0,
            "CommissionAfterTax": 0,
            "TaxDetail": {
                "AccountCode": 0,
                "TaxRate": {
                    "Name": "",
                    "EffectiveTax": ""
                },
                "Type": ""
            },
            "CommissionPayable": 0
        }
        finalData.CommissionPayable = CommissionPayable;
        //================ CommissionPayable ends =========================//

        //================ DepositReceivable =====================//
        let DepositReceivable = {
            "Type": "",
            "Value": 0,
            "Amount": 0
        }
        finalData.DepositReceivable = DepositReceivable;
        //===================== DepositReceivable ends ================//
        //================== Fees ==============================//
        let Fees = {
            "TotalAdditionalFeesAfterTax": 0,
            "Fee": [
                {
                    "Code": "",
                    "Name": "",
                    "SupplierCost": {
                        "Currency": "",
                        "CalculationMethod": "",
                        "Amount": {
                            "BeforeTax": 0,
                            "AfterTax": 0,
                            "Tax": 0,
                            "CostBreakDownBeforeTax": {
                                "Adult": 0,
                                "Child": 0,
                                "Infant": 0
                            },
                            "CostBreakDownAfterTax": {
                                "Adult": 0,
                                "Child": 0,
                                "Infant": 0
                            },
                            "TaxBreakDown": {
                                "Adult": 0,
                                "Child": 0,
                                "Infant": 0
                            },
                            "TaxDetail": {
                                "AccountCode": 0,
                                "TaxRate": {
                                    "Name": "",
                                    "EffectiveTax": ""
                                },
                                "Type": ""
                            }
                        }
                    },
                    "SupplierCommission": {
                        "CommissionBeforeTax": 0,
                        "CommissionAfterTax": 0,
                        "TaxDetail": {
                            "AccountCode": 0,
                            "TaxRate": {
                                "Name": "",
                                "EffectiveTax": ""
                            },
                            "Type": ""
                        },
                        "CommissionPayable": 0
                    },
                    "CustomerPrice": {
                        "Currency": "",
                        "ExchangeRate": 0,
                        "CalculationMethod": "",
                        "Amount": {
                            "BeforeTax": 0,
                            "AfterTax": 0,
                            "Tax": 0,
                            "PriceBreakDownBeforeTax": {
                                "Adult": 0,
                                "Child": 0,
                                "Infant": 0
                            },
                            "PriceBreakDownAfterTax": {
                                "Adult": 0,
                                "Child": 0,
                                "Infant": 0
                            },
                            "TaxBreakDown": {
                                "Adult": 0,
                                "Child": 0,
                                "Infant": 0
                            },
                            "TaxDetail": {
                                "AccountCode": 0,
                                "TaxRate": {
                                    "Name": "",
                                    "EffectiveTax": ""
                                },
                                "Type": ""
                            }
                        }
                    },
                    "CommissionPayable": {
                        "CommissionBeforeTax": 0,
                        "CommissionAfterTax": 0,
                        "TaxDetail": {
                            "AccountCode": 0,
                            "TaxRate": {
                                "Name": "",
                                "EffectiveTax": ""
                            },
                            "Type": ""
                        },
                        "CommissionPayable": 0
                    }
                }
            ]
        }
        finalData.Fees = Fees;
        //================== Fees end ==============================//
        //============================= Markup =========================//

        let MarkupPrice = {
            "MarkupFee": markupResponse?.AgentMarkup ?? 0
        }
        finalData.MarkupPrice = MarkupPrice;

        return finalData;

    }
    catch(error){
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error.message
            }
        }
        apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
        return(errorObject);
    }

};

// Function to handle line items
async function handleLineItems(matchingProduct, requestObj){
    let lineItemList = [];   
    let guestList = matchingProduct?.ActivityRates?.ActivityRate?.Rates?.Rate?.TPA_Extensions?.GuestRates?.GuestRate || [];        
    lineItemList = await lineItemListData(guestList, lineItemList, requestObj)
    // Create an object to store merged items
    let mergedItems = {}; // For travelers    
    if(lineItemList?.length){        
        // Iterate through the lineItems array
        lineItemList.forEach((item) => {
            const { ageBand, numberOfTravelers, subtotalPrice } = item;

            // Create a unique key based on the ageBand
            const key = ageBand;

            if (!mergedItems[key]) {
                // If the key doesn't exist in mergedItems, create it
                mergedItems[key] = {
                ageBand,
                numberOfTravelers: 0,
                subtotalPrice: {
                    price: {
                    recommendedRetailPrice: 0,
                    partnerNetPrice: 0,
                    },
                },
                };
            };        

            // Sum the values for the same ageBand
            mergedItems[key].numberOfTravelers += numberOfTravelers;
            mergedItems[key].subtotalPrice.price.recommendedRetailPrice += subtotalPrice.price.recommendedRetailPrice;
            mergedItems[key].subtotalPrice.price.partnerNetPrice += subtotalPrice.price.partnerNetPrice;        
        });   
    };
     // Convert the mergedItems object back to an array
     const mergedLineItems = Object.values(mergedItems);
    return mergedLineItems;
};

//Function to handle availability status
async function handleAvailabilityStatus(matchingProduct){
    let available = false ;
    if(matchingProduct?._attributes?.AvailabilityStatus == 'AvailableForSale'){
        available = true;
    };
    return available;
};

//Function to handle handleSupplierCustomerCost
async function handleSupplierCost(lineItems, minimumPrice ){
    let AdultSupplierCost = 0;
    let ChildSupplierCost = 0;
    let InfantSupplierCost = 0;
    for(const lineItemsObj of lineItems){
        let price = (minimumPrice * lineItemsObj.numberOfTravelers)
        if(lineItemsObj.ageBand == "ADULT"){
            AdultSupplierCost = parseFloat(price).toFixed(2);
        }
        else if(lineItemsObj.ageBand == "CHILD"){
            ChildSupplierCost = parseFloat(price).toFixed(2);
        }
        else if(lineItemsObj.ageBand == "INFANT"){
            InfantSupplierCost = parseFloat(price).toFixed(2);
        }
    };
    return({"AdultSupplierCost":AdultSupplierCost, "ChildSupplierCost":ChildSupplierCost, "InfantSupplierCost":InfantSupplierCost });
}


//Function to handle CustomerCost
async function handleCustomerCost(lineItems, minimumPrice ){
    let AdultCustomerPrice = 0;
    let ChildCustomerPrice = 0;
    let InfantCustomerPrice = 0;
    for(const lineItemsObj of lineItems){
        let price = (minimumPrice * lineItemsObj.numberOfTravelers);
        if(lineItemsObj.ageBand == "ADULT"){           
            AdultCustomerPrice = parseFloat(price).toFixed(2);
        }
        else if(lineItemsObj.ageBand == "CHILD"){            
            ChildCustomerPrice = parseFloat(price).toFixed(2);
        }
        else if(lineItemsObj.ageBand == "INFANT"){            
            InfantCustomerPrice = parseFloat(price).toFixed(2);
        }
    };
    return {"AdultCustomerPrice":AdultCustomerPrice, "ChildCustomerPrice":ChildCustomerPrice,"InfantCustomerPrice": InfantCustomerPrice };
}

// Function for set travelers complete data
async function travelersData(lineItems, finalData){
    if(lineItems != undefined && lineItems?.length){       
        let travelerlist = [];
        let partnerNetPriceAmnt = 0 ;
        for(let i = 0; i < lineItems.length; i++){
            let travelerDetail = await travelerDetails(i, lineItems)
            
            travelerlist.push(travelerDetail);
            
            partnerNetPriceAmnt = partnerNetPriceAmnt + lineItems[i]?.subtotalPrice?.price?.partnerNetPrice;
        }
        providerPriceDetails.travelers = travelerlist;
        providerPriceDetails.priceSummary = {
            "recommendedRetailPrice": partnerNetPriceAmnt,
            "partnerNetPrice": partnerNetPriceAmnt,
            "bookingFee": 0,
            "partnerTotalPrice": partnerNetPriceAmnt
        }
        finalData.travelers = travelers;
        finalData.providerPriceDetails = providerPriceDetails;
        return await finalData
    }
    else{
        finalData.travelers = travelers;
        return await finalData
    }; 
}

// Function for set number of travelers
async function numberOfTravelers(travelers){
    let travelerCount = 0
    travelers.forEach(traveler => {
        if (traveler.numberOfTravelers) {
            travelerCount += traveler.numberOfTravelers;
        }
    });
    return travelerCount;
}

// Function for set line items list data
async function lineItemListData(guestList, lineItemList, requestObj){
    if(guestList?.length){
        guestList.forEach((item,index) =>{                         
            if(item?._attributes?.GuestAge && requestObj?.passengerDetails){                  
                for(let passenger of requestObj?.passengerDetails){                    
                    if(String(passenger?.age) === item?._attributes?.GuestAge){                        
                        lineItemList.push({
                            "ageBand": passenger?.ageBand,
                            "numberOfTravelers": 1,
                            "subtotalPrice": {
                                "price": {
                                    "recommendedRetailPrice": 0,
                                    "partnerNetPrice": parseFloat(item?._attributes?.AmountAfterTax)
                                }
                            }
                        });                        
                    };
                }                  
               
            };              
            
        });
        return await lineItemList;
    } else {
        return await lineItemList;
    }
}

// Function for set traveler details
async function travelerDetails(i, lineItems){
    let travelerObj = {};
    let travelerSubtotalPrice = {};                        
    travelerObj.ageBand = (lineItems[i].ageBand) ? lineItems[i].ageBand : "";
    travelerObj.numberOfTravelers = (lineItems[i].numberOfTravelers) ? lineItems[i].numberOfTravelers : "";                                                
    travelers.push(travelerObj);
    travelerSubtotalPrice.ageBand = (lineItems[i].ageBand) ? lineItems[i].ageBand : "";
    travelerSubtotalPrice.numberOfTravelers =  (lineItems[i].numberOfTravelers) ? lineItems[i].numberOfTravelers : "";
    travelerSubtotalPrice.subtotalPrice = {
        "price": {
            "recommendedRetailPrice": lineItems[i]?.subtotalPrice?.price?.partnerNetPrice || 0,
            "partnerNetPrice": lineItems[i]?.subtotalPrice?.price?.partnerNetPrice || 0
        }
    };
    return travelerSubtotalPrice
}

/** */
// Function for get product option code and start time 
function getProductOptionCodeAndStartTime(matchingProduct){
    const productOptionCode = matchingProduct?.ActivityTypes?.ActivityType?._attributes?.ActivityTypeCode || "";
    const starTime = matchingProduct?.TPA_Extensions?.OpeningTimes?.OpeningTime?._attributes?.FromTime || "";
    return { productOptionCode, starTime}
}

//Function for get markup response
async function getMarkupResponse(clientId, requestObj, agentID, token, request, providerDetails, accessToken) {
    try{

    let DBMarkupCommissionDataTest = false;
    let markupResponse = {};

    if (agentID && agentID !== "") {
        DBMarkupCommissionDataTest = await markupMoonstrideData.getMarkupDbApiReponse(clientId, agentID, token, requestObj.currency, request, providerDetails);
        if(DBMarkupCommissionDataTest?.comapnyMarkup?.hasOwnProperty('Error') || DBMarkupCommissionDataTest?.agentmarkup?.hasOwnProperty('Error') || DBMarkupCommissionDataTest?.Error){
            DBMarkupCommissionDataTest = false;
        }

        if (DBMarkupCommissionDataTest) {
            markupResponse = await markupPrice.findAgentMarkupAndCommission(clientId, requestObj, accessToken, request, DBMarkupCommissionDataTest);
        }
    }

    return markupResponse;
    }catch(err){
        console.log(err);
    }
}
