"use strict";
const apiCommonController = require("../../../../Utility/APICommonController.js");
const apiResponse = require("./Response.js");
const markupPrice = require("../markupCommission/tourMarkup.js")
const markupMoonstrideData = require("../markupCommission/Response.js");
const config = require("../../../../Config.js");

module.exports = async (app) => {
    app.post("/:id/Tour/Viator/PriceCheck", async function (request, response, next) {
        // Validating request fields. 
        await apiCommonController.viatorProductpriceCheck(request, response, next);
    }, async function (request, response) {
        const requestObj = request.body;
        requestObj.productOptionCode = requestObj.productOptionCode[1];
        const clientId = request.params.id;
        let fName = "Price_Check_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_PRICE_CHECK_PROVIDER_PRICE_CHECK_FILE_PATH, config.Provider_Code_VTR);
        try {
            // Get and Validate Provider Credentials
            const providerDetails = await apiCommonController.providerDetail(clientId, "Viator");
            if (!providerDetails.Viator_apiKey) {
                throw new Error(config.VTRApiKeyErrorMessage);
            }
            let result;
    
            // Defined url for viator price check api.
            let PriceCheck = {
                "priceCheckUrl" : 'availability/check',
            }
            // Get the api response.
            // Waiting for all the three api results.
            result = await apiResponse.getPriceCheckApiReponse(clientId, providerDetails, PriceCheck, requestObj, request, fPath);
            if(result != undefined && result.bookableItems != undefined){
                let parameter = {
                    result,
                    option :  requestObj.productOptionCode,
                    request,
                    clientId,
                    requestObj,
                    fName, 
                    fPath, 
                    providerDetails
                }
                let formatedResult = await resultObjectFormater(parameter);
                
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
            }
            else {
                response.status(200).send({
                    "Result": {
                        "Code": 400,
                        "Error": {
                            "Message": "No data found"
                        }
                    }
                });
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
       
    });    
}

// Function for result object format
async function resultObjectFormater({result, option, request, clientId, requestObj, fName, fPath, providerDetails}){
    try{
        if(result == undefined || result.bookableItems == undefined){
            throw new Error("No data found.")
        }
        
        // Final data for return
        let finalData = {
            "provider" : "VTR",
            "productCode" : result.productCode,
            "travelDate" : result.travelDate,
            "currency" : result.currency,
        };
        // Get the subproducts.
        let productOptions = result.bookableItems;
        let matchingProduct = productOptions.find(item => item.productOptionCode  === option);

        if(matchingProduct == undefined){
            matchingProduct = await findBookedProductUsingStartTimeOrLanguageGuide(productOptions, requestObj, fName, fPath, providerDetails);
        }

        if(matchingProduct){

            let basicDetailsFunctionResponse = await functionForFindProductAvailabilityAndOtherBasicDetails(finalData, matchingProduct);

            finalData = basicDetailsFunctionResponse.finalData;                

            // Travaler object;
            let travelers = basicDetailsFunctionResponse.travelers;
            finalData.travelers = travelers;
                                    
            let providerPriceDetails = basicDetailsFunctionResponse.providerPriceDetails;
            
            let token = requestObj.msToken;
            let agentID = requestObj.agentGuid;
            // find markup api response. 
            let DBMarkupCommissionDataTest = await functionForGetMarkupApiresponseFromMoonstride(clientId, agentID, token, requestObj.currency, request, providerDetails)
            
            // Adding markup price
            let accessToken = "";
            requestObj.pricingInfo = matchingProduct?.totalPrice;
            let markupResponse = {};
            if(DBMarkupCommissionDataTest){
                markupResponse = await markupPrice.findAgentMarkupAndCommission(clientId, requestObj, accessToken, request, DBMarkupCommissionDataTest);
            }
                
            let totalNumberOftravelers = await travellerCount(travelers);

            // Adding markup total price with response.

            providerPriceDetails.priceSummary.TotalSupplierCostAfterAgentMarkup = markupResponse.TotalSupplierCostAfterAgentMarkup ?? matchingProduct?.totalPrice?.price?.partnerTotalPrice;

            finalData.providerPriceDetails = providerPriceDetails;

            //===================== Supplier coast ==============================//                        
            // Price classification objects.
            let SupplierCost = {
                "Currency": result.currency,
                "CalculationMethod": "PER_PERSON",
                "Amount" : {
                    "BeforeTax": 0,
                    "AfterTax": matchingProduct?.totalPrice?.price?.partnerTotalPrice || 0,
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

            }      
            // Supplier cosat
            let SupplierCostNew = supplierCost(matchingProduct, SupplierCost, totalNumberOftravelers)

            finalData.SupplierCost = await SupplierCostNew;
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
                "Currency": result.currency,
                "ExchangeRate": 0,
                "CalculationMethod": "PER_PERSON",
                "Amount": {
                    "BeforeTax": 0,
                    "AfterTax": markupResponse.TotalSupplierCostAfterAgentMarkup ?? matchingProduct?.totalPrice?.price?.partnerTotalPrice,
                    "Tax": 0,
                    "PriceBreakDownBeforeTax": {
                        "Adult": 0,
                        "Child": 0,
                        "Infant": 0
                    },
                    "PricetBreakDownAfterTax": {
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

            let CustomerPriceNew = await customerPrice(CustomerPrice, matchingProduct, totalNumberOftravelers, markupResponse)
            
            finalData.CustomerPrice = CustomerPriceNew;
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
                                "PricetBreakDownAfterTax": {
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
                "MarkupFee": markupResponse.AgentMarkup  || 0                   
            }
            finalData.MarkupPrice = MarkupPrice;

            return finalData;
            
        }
        else{
            throw new Error("Given Product is Not Available Right Now.");
        }              
    }
    catch(error){
        console.log(error);
        const errorObject = {
            "STATUS": "ERROR",
            "RESPONSE": {
                "text": error.message
            }
        }
        apiCommonController.getError(errorObject, fName, fPath, JSON.stringify(request.body));
        return(errorObject);
    }
    
}

// function for find product using start time or language guide
async function findBookedProductUsingStartTimeOrLanguageGuide(productOptions, requestObj, fName, fPath, providerDetails){
    try {
        let selectedOption = {}
        // checking if the product match with start time. else return the first elecment by default.
        if(requestObj.starTime && requestObj.starTime != ""){
            selectedOption = productOptions.find(item => item.startTime === requestObj.starTime);

        }
        else {
            selectedOption = productOptions[0];
        }

        selectedOption.productOptionCode = await apiCommonController.productOptionCodeGenerator('');

        return selectedOption;

    }
    catch (error) {
        console.log(error);    
    }
}

// function for get markup response from moonstride api
async function functionForGetMarkupApiresponseFromMoonstride(clientId, agentID, token, currency, request, providerDetails){
    try {
        let DBMarkupCommissionDataTest = false;
        if(agentID && agentID != ""){
            DBMarkupCommissionDataTest = await markupMoonstrideData.getMarkupDbApiReponse(clientId, agentID, token, currency, request, providerDetails);                                        
            
        }
        if(DBMarkupCommissionDataTest){
            if(DBMarkupCommissionDataTest.comapnyMarkup.hasOwnProperty('Error') || DBMarkupCommissionDataTest.agentmarkup.hasOwnProperty('Error') || DBMarkupCommissionDataTest.Error){                    
                DBMarkupCommissionDataTest = false;
            }
        }
        return DBMarkupCommissionDataTest;
    }
    catch (error) {
        console.log(error);    
    }
}

// function for get basic details.
async function functionForFindProductAvailabilityAndOtherBasicDetails(finalData, matchingProduct){
    try {
        finalData.productOptionCode = await apiCommonController.productOptionCodeSplittingKeyAdding(finalData.productCode , matchingProduct?.productOptionCode);
        finalData.available = matchingProduct?.available || "";
        finalData.starTime = matchingProduct?.startTime || "";

        // Travaler object;
        let travelers = setTravelers(matchingProduct)
        finalData.travelers = travelers;
                                
        let providerPriceDetails = {
            "travelers" : matchingProduct?.lineItems || [],
            "priceSummary" : matchingProduct?.totalPrice?.price || {}
        }
        return ({
            "finalData" : finalData,
            "providerPriceDetails" : providerPriceDetails,
            "travelers" : travelers
        })
    }
    catch (error) {
        console.log(error);    
    }
}

// Function for set travellers
function setTravelers(matchingProduct){
    let travelers = [];
    if(matchingProduct.lineItems != undefined){
        let lineItems = matchingProduct.lineItems;
        for(let lineItemsData of lineItems){
            let travelerObj = {}
            
            travelerObj.ageBand = (lineItemsData.ageBand) ? lineItemsData.ageBand : "";

            travelerObj.numberOfTravelers = (lineItemsData.numberOfTravelers) ? lineItemsData.numberOfTravelers : "";                                
            
            travelers.push(travelerObj);
        }
        return travelers;
    }
    else{
        return travelers;
    }
    
}

// Function for set supplier cost
async function supplierCost(matchingProduct, SupplierCost, totalNumberOftravelers){
    if(matchingProduct.lineItems != undefined){            
        let lineItems = matchingProduct.lineItems;                            

        let totalSupplierPrice = matchingProduct?.totalPrice?.price?.partnerTotalPrice;

        let minimumPrice = (totalSupplierPrice / totalNumberOftravelers);

        for(let lineItemsData of lineItems){

            switch(lineItemsData.ageBand){
                case "ADULT" : 
                     
                    SupplierCost.Amount.CostBreakDownAfterTax.Adult = +(parseFloat(minimumPrice * lineItemsData.numberOfTravelers).toFixed(2));
                    break;
                case "CHILD" : 
                
                    SupplierCost.Amount.CostBreakDownAfterTax.Child = +(parseFloat(minimumPrice * lineItemsData.numberOfTravelers).toFixed(2));
                    break;
                case "INFANT" : 
                    SupplierCost.Amount.CostBreakDownAfterTax.Infant = +(parseFloat(minimumPrice * lineItemsData.numberOfTravelers).toFixed(2));
                    break;
                default:
                    break;
            }                                
        }                   
    }
    return await SupplierCost 
}

// Function for set customer price
async function customerPrice(CustomerPrice, matchingProduct, totalNumberOftravelers, markupResponse){
    if(matchingProduct.lineItems != undefined){     
        let lineItems = matchingProduct.lineItems;                            

        let totalCustomerPrice = markupResponse.TotalSupplierCostAfterAgentMarkup ?? matchingProduct?.totalPrice?.price?.partnerTotalPrice;

        let minimumPrice = (totalCustomerPrice / totalNumberOftravelers);

        for(let lineItemsData of lineItems){

            switch(lineItemsData.ageBand){
                case "ADULT" : 
                     
                    CustomerPrice.Amount.PricetBreakDownAfterTax.Adult = +(parseFloat(minimumPrice * lineItemsData.numberOfTravelers).toFixed(2));
                    break;
                case "CHILD" : 
                
                    CustomerPrice.Amount.PricetBreakDownAfterTax.Child = +(parseFloat(minimumPrice * lineItemsData.numberOfTravelers).toFixed(2));
                    break;
                case "INFANT" : 
                    CustomerPrice.Amount.PricetBreakDownAfterTax.Infant = +(parseFloat(minimumPrice * lineItemsData.numberOfTravelers).toFixed(2));
                    break;
                default:
                    break;
            }                                
        }                           
    }
    return await CustomerPrice
}

// Function for set traveller count
async function travellerCount(travelers){
    let totalNumberOftravelers = 0;
    travelers.forEach(traveler => {
        if (traveler.numberOfTravelers) {
            totalNumberOftravelers += (traveler.numberOfTravelers);
        }
    });
    return totalNumberOftravelers;
}