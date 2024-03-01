"use strict";
const moment = require('moment');
const config = require("../../../../Config.js");
const axios = require("axios")
const apiCommonController = require("../../../../Utility/APICommonController");
const fs = require("fs");

module.exports = async (app) => {
    app.post("/:id/Tour/1way2italy/AddBooking", async function (request, response, next){
        // Validating request fields. 
        await apiCommonController.addBookingValidation(request, response, next);
    }, async function (request, response) {

        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "Add_Booking_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_ADD_BOOKING_PROVIDER_ADD_BOOKING_FILE_PATH, config.Provider_Code_OWT);

        try{
            // Checking the request and and some times it has more than one data.
            if( requestObj.cartData != undefined && requestObj.cartData.length > 0){
                let cartData = requestObj.cartData;
                // Final data for booking json.
                let Booking = {};
                let Services = {};
                let tourserviceArr = [];
                for(let cart = 0; cart < cartData.length; cart++){
                    let bookingData = await bookingDetails(cart, cartData, Booking, clientId, requestObj)
                    // Taking a single data obj to variable 
                    tourserviceArr.push(bookingData);                    

                }
                let ServicesArrObject = {
                    "HotelServices": [],
                    "FlightServices": [],
                    "TourServices" : tourserviceArr
                };
                Services = ServicesArrObject
                Booking.Services = Services
                let bookingJSON = {
                    Booking                  
                    
                }
                response.status(200).send({
                    "Result": bookingJSON
                });

            }
            else{
                throw new Error("No cart data found.")
            }
        }
        catch(error){
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

// Function to handle multiple passengers
async function handleMultiplePassengers(passangerCount){
    // Multiple passanger details
    let NumberOfPassengers = {
        "Adult" : 0,
        "Child" : 0,
        "Infant" : 0
    };
    for(const passangerCountObj of passangerCount){
        let ageBand = passangerCountObj.ageBand;
        let passangerLimit = passangerCountObj.numberOfTravelers;
        switch(ageBand){
            case "ADULT" : 
                // if the same age band have different aged pax then calculating it.
                NumberOfPassengers.Adult = NumberOfPassengers.Adult += passangerLimit;
                break;
            case "CHILD" : 
                NumberOfPassengers.Child = NumberOfPassengers.Child += passangerLimit;
                break;
            case "INFANT" :
                NumberOfPassengers.Infant = NumberOfPassengers.Infant += passangerLimit;
                break;
            case "TRAVELER" : 
                NumberOfPassengers.Traveler = passangerLimit;
                break;
            case "YOUTH" :
                NumberOfPassengers.Youth = passangerLimit;
                break;
            case "SENIOR" : 
                NumberOfPassengers.Senior = passangerLimit;
                break;
            default:
                break;        
        }
    };
    return NumberOfPassengers;
};

//Function to handle booking passengers
async function handleBookingPassengers(passengerDetails ){
    let bookingPassengersNode = [];
    let PassengerDetailObj = {
        "Adult": {
            "Count": 0,
            "Passengers": []
        },
        "Child": {
            "Count": 0,
            "Passengers": []
        },
        "Infant": {
            "Count": 0,
            "Passengers": []
        }
    };
    for(let passengerDetailsData of passengerDetails){
        if(passengerDetailsData.passengerinformationguid != undefined){
            // Booking passengers details object.
            let passengerBasicInfo = {
                "PassengerId":  passengerDetailsData.passengerinformationguid ?? "",
                "Title": passengerDetailsData.title ?? "Mr",
                "FirstName": passengerDetailsData.firstname ?? "",
                "MiddleName":  passengerDetailsData.middelname ?? "",
                "LastName":  passengerDetailsData.lastname ?? "",
                "Gender":  passengerDetailsData.gender ?? "",
                "Type":  passengerDetailsData.type ?? "",
                "DateOfBirth": passengerDetailsData.dateofbirth ?? "",
                "Age": passengerDetailsData.age ?? "",
                "ContactDetail": {
                    "MobileNo": "",
                    "Email": "",
                    "Fax": ""
                },
                "Address": {
                    "Address1": "xxxxxxxx",
                    "Address2": "xxxxxxxx",
                    "City": "xxxxxxxx",
                    "State": "xxxxxxxx",
                    "Country": "xxxxxxxx",
                    "PostCode": "xxxxxxxx"
                },
                "IsLeadPassenger": (passengerDetailsData?.isleadpassenger)? passengerDetailsData?.isleadpassenger : false
            }
            bookingPassengersNode.push(passengerBasicInfo);

            let passangerDetail = await passengerDetail(passengerDetailsData, PassengerDetailObj)
            PassengerDetailObj = passangerDetail                                 
        }                            
    };
    return {"bookingPassengersNode":bookingPassengersNode, "PassengerDetailObj":PassengerDetailObj};
};

//Function to handle tour detail ageband
async function handleTourDetailAgeBandFromandTo(cartDataObj){
    let ageBandResult = [];
    if(cartDataObj.availabilityTypePerPerson != undefined){
        let AgeBandFromAndTo = cartDataObj.availabilityTypePerPerson.ageBands;
        for (const item of AgeBandFromAndTo) {
            for (const key in item) {
                if (item.hasOwnProperty(key)) {
                    const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                    item[capitalizedKey] = item[key];
                    delete item[key];
                }
            }
        };
        ageBandResult = AgeBandFromAndTo;
    }; 
    return ageBandResult;
};

//Function to handle cancel policy object
async function handleTourDetailCancelPolicy(CancellationPolicy){
    let cancelPolicyObj = CancellationPolicy;
    for (const item of cancelPolicyObj.RefundEligibility) {
        for (const key in item) {
            if (item.hasOwnProperty(key)) {
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
            item[capitalizedKey] = item[key];
            delete item[key];
            };
        };
    };
    return cancelPolicyObj;
};

// Function to hanldle inclusions
async function handleInclusions(tourDetails){
    let Inclusions = [];
    if(tourDetails.Inclusions){
        let inclusions = tourDetails.Inclusions;
        for(const inclusionsItem of inclusions){
            let incObj = {
                "Description" : inclusionsItem
            }
            Inclusions.push(incObj);
        };
    };
    return Inclusions;
};

//Function to hanlde exclusions
async function handleExclusions(tourDetails){
    let Exclusions = [];
    if(tourDetails.exclusions){
        let exclusions = tourDetails.exclusions;
        for(const exclusionsObj of exclusions){
            let exeObj = {
                "Description" : exclusionsObj
            }
            Exclusions.push(exeObj);
        };
    };
    return Exclusions;
};

//Function to handle highlights
async function handleHighLigths(tourDetails){
    let Highlights = [];
    if(tourDetails.highlights){
        let highlights = tourDetails.highlights;
        for(const highlightsItem of highlights){
            let higObj = {
                "Description" : highlightsItem
            }
            Highlights.push(higObj);
        }
    };
    return Highlights;
};

//Function to handle other descriptions
async function handleOtherDescriptions(tourDetails){
    let OtherDescriptions = [];
    if(tourDetails.otherDescriptions){
        let otherDescription = tourDetails.otherDescription;
        for(const otherDescriptionItem of otherDescription){
            let othObj = {
                "Title": "",
                "Description": otherDescriptionItem
            }
            OtherDescriptions.push(othObj);
        };
    };
    return OtherDescriptions;
};

//Function to handle tourdetail images
async function handleTourDetailImages(tourDetails){
    let Images = [];
    if(tourDetails.images){
        let images = tourDetails.images;
        for(const imagesItem of images){
            let imagObj = {
                "Name": imagesItem.Name ?? "",
                "Url": imagesItem ?? "",
                "IsDefault": imagesItem.IsDefault ?? ""
            }
            Images.push(imagObj);
        };
    };
    return Images;
};

//Function to handle supplier details
async function handleTourSupplierDetail(requestObj){
    let SupplierDetail = {};
    if(requestObj.provider){
        let provider = requestObj.provider;
        if(provider[0] == config.Provider_Code_OWT){
            let providerObj = {
                "Code" : provider[0],
                "Name" : "1way2italy",
                "Provider" : provider[0]
            }
            SupplierDetail = providerObj;
        };
    };
    return SupplierDetail;
};

//Function to handle location of tourdetail
async function handleTourDetailLocation(cartDataObj){
    let Location = {};
    let locationsData = fs.readFileSync(process.cwd()+ config.OneWay2italy_Destination_File_Path, 'utf-8')
    let jsonData = JSON.parse(locationsData).Data
    let locationsDetails = jsonData.filter(item => item.CityCode == cartDataObj.searchItems.searchDestinationId)[0]
    if(cartDataObj.searchItems != undefined){  
        if(locationsDetails.AreaID){
            Location.LocationId = "";
            Location.ProviderLocationId = locationsDetails.AreaID;
            Location.Name = locationsDetails.AreaName;
            Location.LocationType = {
                "Code": "SA1",
                "Name": "Sub Area 1"
            }
            Location.City = {
                "CityId": "",
                "ProviderCityId" : locationsDetails.CityCode,
                "Name": locationsDetails.CityName
            }
        } else {
            Location.LocationId = ""
            Location.ProviderLocationId = locationsDetails.CityCode
            Location.Name = locationsDetails.CityName
            Location.LocationType = {
                "Code": "CIT",
                "Name": "City"
            }
        }  
        if(locationsDetails.RegionCode){
            Location.State = {
                "StateId": "",
                "ProviderStateId" : locationsDetails.RegionCode,
                "Name": locationsDetails.RegionName
            }
        }
        if(locationsDetails.CountryISOCode){
            Location.Country = {
                "CountryId": "",
                "Code": locationsDetails.CountryISOCode,
                "Name": locationsDetails.CountryName
            }
        }
        Location.Latitude = "";
        Location.Longitude = "";
    };
    // Convert all "Name" properties to sentence case
    Location = await convertToSentenceCase(Location);
    return Location;
};

// Recursive function to convert strings to sentence case
async function convertToSentenceCase(obj) {
    for (const key in obj) {
        
        if (typeof obj[key] === 'string' && key === 'Name') {
            obj[key] = obj[key].toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                return a.toUpperCase();
            });
        } else if (typeof obj[key] === 'object') {
            await convertToSentenceCase(obj[key]);
        }
    }
    return obj;
}

// Funtion to handle cost breakdown aftera tax
async function handleCostBreakDownAfterTax(pricePerTraveler){
    let CostBreakDownAfterTax = {
        "Adult": 0,
        "Child": 0,
        "Infant": 0
    };
    for(const pricePerTravelerObj of pricePerTraveler){
        let ageBand = pricePerTravelerObj.ageBand;
        let subtotalPrice = pricePerTravelerObj.subtotalPrice;
        let minPrice = 0;
        switch(ageBand){
            case "ADULT":
                if(pricePerTravelerObj.numberOfTravelers != 0){
                    minPrice = parseFloat(subtotalPrice.partnerNetPrice / pricePerTravelerObj.numberOfTravelers);
                }
                CostBreakDownAfterTax.Adult = minPrice;
                break;
            case "CHILD":
                if(pricePerTravelerObj.numberOfTravelers != 0){
                    minPrice = parseFloat(subtotalPrice.partnerNetPrice / pricePerTravelerObj.numberOfTravelers);
                }
                CostBreakDownAfterTax.Child = minPrice;
                    
                break;
            case "INFANT":
                if(pricePerTravelerObj.numberOfTravelers != 0){
                    minPrice = parseFloat(subtotalPrice.partnerNetPrice / pricePerTravelerObj.numberOfTravelers);
                }
                CostBreakDownAfterTax.Infant = minPrice;

                break;
            case "TRAVELER":   
                if(pricePerTravelerObj.numberOfTravelers != 0){
                    minPrice = parseFloat(subtotalPrice.partnerNetPrice / pricePerTravelerObj.numberOfTravelers);
                }
                CostBreakDownAfterTax.Traveler = minPrice;                    
                break;

            default:
                break;
        };
    };
    return CostBreakDownAfterTax;
};

// Funtion to handle passenger details based on the ageband
async function passengerDetail(passengerDetails, PassengerDetailObj){
    if (passengerDetails.type === "A") {
        PassengerDetailObj.Adult.Passengers.push({ PassengerId: passengerDetails.passengerinformationguid });
        PassengerDetailObj.Adult.Count++;
        return PassengerDetailObj
    }
    else if (passengerDetails.type === "C") {
        PassengerDetailObj.Child.Passengers.push({ PassengerId: passengerDetails.passengerinformationguid });
        PassengerDetailObj.Child.Count++;
        return PassengerDetailObj
    }
    else if (passengerDetails.type === "I") {
        PassengerDetailObj.Infant.Passengers.push({ PassengerId: passengerDetails.passengerinformationguid });
        PassengerDetailObj.Infant.Count++;
        return PassengerDetailObj
    } else {
        return PassengerDetailObj
    }
}

// Function for booking details
async function bookingDetails(cart, cartData, Booking, clientId, requestObj){
    let cartDataObj = cartData[cart];
    let addCart = await addCartData(cartDataObj, Booking)
    Booking = addCart
    //----------------------------------------------------------//
    // Booking object for storing booking id and ReferenceNo
    

    //----------------------------------------------------------------//
    // BookingPassengers details like NumberOfPassengers etc..
    // Passanger details is an array that contain all the passanger details.
    let passangerCount = cartDataObj.passengerDetails;

    //Adding multiple passenger details
    let NumberOfPassengers = await handleMultiplePassengers(passangerCount);
    
    let BookingPassengers = {
        NumberOfPassengers : NumberOfPassengers,
        Passengers : []
    };

    // Get passanger details from moonstride
    
    let passengerDetails = cartDataObj.Passengers;
    // Passanger details
    let PassengerDetail = {
        "Adult": {
            "Count": 0,
            "Passengers": []
        },
        "Child": {
            "Count": 0,
            "Passengers": []
        },
        "Infant": {
            "Count": 0,
            "Passengers": []
        }
    }
    //================== New changes in passenges ===============//                    

    //================================ New changes in passenger ===============//                    
    if(passengerDetails != undefined && passengerDetails.length != 0){
        
        let {bookingPassengersNode, PassengerDetailObj } = await handleBookingPassengers(passengerDetails);
        BookingPassengers.Passengers = bookingPassengersNode ;
        PassengerDetail = PassengerDetailObj;                        
    };
    // PassengerDetail.PassengerDetail
    Booking.BookingPassengers = BookingPassengers;
    // Tour details
    let tourDetails = cartDataObj.tourDetails
    // Start date and time.
    let StartDate = initializeStartDate(tourDetails);
    Booking.TravelStartDate = StartDate.Date;

    // EndDate
    let EndDate = {
        "Date": "0000-00-00",
        "Time": "00:00"
    };
    let tourTime = await timeDetails(tourDetails, clientId)
    EndDate.Date = tourTime;
    Booking.TravelEndDate = tourTime ;
    

    // Duration
    let Duration = {
        "Value": "24",
        "Interval": "Hours"
    }
    if(tourDetails.duration && tourDetails.duration != "Null"){
        if(typeof tourDetails.duration == "string"){ 
            Duration.Value = parseInt(tourDetails.duration);
            Duration.Interval = "Days"
        }
        else{
            let durationData = tourDetails.duration;
            Duration.Value = Math.round(durationData / 60);
            Duration.Interval = "Hours"
        }
        
    }

    //--------------------------------------------------//
    // TourDetail
    let TourDetail = {
        "TourId" : ""
    };

    let tripDetails = await tripDetail(TourDetail, tourDetails)

    TourDetail = tripDetails

    // Supplier chain code
    TourDetail.OptionCode = await apiCommonController.productOptionCodeSplittingKeyAdding(cartDataObj.chainCode, TourDetail.Code);
    // check if the tour name and option name are same then no need to set option name. 
    TourDetail.OptionName = await handleOptionName(tourDetails); 
  
    // Tour address
    TourDetail.TourAddress = {
        "Address1": "",
        "Address2": "",
        "City": "",
        "State": "",
        "Country": "",
        "PostCode": "",
        "Latitude": "",
        "Longitude": ""
    };

    // Availability per person age , in tour details                    
    TourDetail.AgeBandFromAndTo = await handleTourDetailAgeBandFromandTo(cartDataObj);        

    // Tour Inclusions                                     
    TourDetail.Inclusions = await handleInclusions(tourDetails);                    

    // Exclusions                    
    TourDetail.Exclusions = await handleExclusions(tourDetails);                                                          

    // Highlights                    
    TourDetail.Highlights = await handleHighLigths(tourDetails);                                    

    // OtherDescriptions                    
    TourDetail.OtherDescriptions = await handleOtherDescriptions(tourDetails);                    

    // Tour Images                    
    TourDetail.Images = await handleTourDetailImages(tourDetails);                

    // Tour Currency                    
    TourDetail.Currency = (tourDetails.Currency)? tourDetails.Currency : "EUR";

    // Tour SupplierDetail or provider details                    
    TourDetail.SupplierDetail = await handleTourSupplierDetail(requestObj);                

    // Location                    
    TourDetail.Location = await handleTourDetailLocation(cartDataObj);                    
    
    //----------------------------------------------------------//
    
    // Price from request object
    let pricingInfo = cartDataObj.pricingInfo;

    TourDetail.providerPriceDetails = pricingInfo;
    // Supplier NetCost
    let SupplierCost = initializeSupplierCost(tourDetails, pricingInfo);

    //--------------------------------------------------------------//
    // Supplier coast net coast and gross coast classification
    let priceSummary = pricingInfo.priceSummary;
    
    let Amount = {
        "BeforeTax": 0,
        "AfterTax": priceSummary.partnerNetPrice ?? 0,
        "Tax": 0,
    };
                        
    let TaxBreakDown = {
        "Adult": 0,
        "Child": 0,
        "Infant": 0
    };
    let TaxDetail = {
        "AccountCode": 0,
        "TaxRate": {
            "Name": "",
            "EffectiveTax": ""
        },
        "Type": ""
    };
    // Coast breakdown for each traveler like adult, child, infant etc.
    let CostBreakDownBeforeTax = {
        "Adult": 0,
        "Child": 0,
        "Infant": 0
    };
    
    let pricePerTraveler = pricingInfo.travelers;

    let CostBreakDownAfterTax = await handleCostBreakDownAfterTax(pricePerTraveler);                   

    // Amount coast
    Amount.CostBreakDownBeforeTax = CostBreakDownBeforeTax;
    Amount.CostBreakDownAfterTax = CostBreakDownAfterTax;
    Amount.TaxBreakDown = TaxBreakDown;
    Amount.TaxDetail = TaxDetail;                    
    
    // Adding to supplierCoast object
    SupplierCost.Amount = Amount;                    
    //---------------------------------------------//

    //------------ supplier payment due date -----------//
    let SupplierPaymentDueDate = await apiCommonController.calculateServiceSupplierDueDate(Booking.BookingDate, Booking.TravelStartDate)
    //--------------------------------------------------//

    //------------------------ No need to edit now ---------------//
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
    };
    let SupplierDeposit = {
        "Type": "",
        "Value": 0,
        "Amount": 0
    };
    //--------------------------------------------------------------//
    // Customer price and netCoast details                   
    let CustomerPrice = {
        "Currency":  tourDetails.Currency ?? "EUR",
        "ExchangeRate": priceSummary?.ExchangeRate ?? 0,
        "CalculationMethod": pricingInfo.CalculationMethod ?? "",
        "Amount": {
            "BeforeTax": 0,
            "AfterTax": priceSummary.TotalSupplierCostAfterAgentMarkup || priceSummary.partnerTotalPrice,
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

    let PricetBreakDownAfterTax = {
        "Adult": 0,
        "Child": 0,
        "Infant": 0
    }    

    let totalPartnerPrice = priceSummary.TotalSupplierCostAfterAgentMarkup;

    PricetBreakDownAfterTax  = await customerPriceCalculationperPassenger(totalPartnerPrice, NumberOfPassengers, PricetBreakDownAfterTax);    

    CustomerPrice.Amount.PricetBreakDownAfterTax = PricetBreakDownAfterTax;

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
    };
    let DepositReceivable = {
        "Type": "",
        "Value": 0,
        "Amount": 0
    };
    let Fees = {
        "TotalAdditionalFeesAfterTax": (pricingInfo.priceSummary.bookingFee) ? pricingInfo.priceSummary.bookingFee : "00",
        "Fee": [
            {
                "Code": "",
                "Name": "",
                "SupplierCost": {
                    "Currency": "",
                    "CalculationMethod": "Per Person",
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
                    "CalculationMethod": "Per Person",
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
    // Markup price 
    let MarkupPrice = {
     "MarkupFee" :  getMarkupFee(priceSummary)
    }
    // Booking questions
    let bookingQuestions = await bookingQuestion(tourDetails);

    TourDetail.BookingRequiredQuestions = bookingQuestions;

    // Booking cancel reasons.
    let bookingCanceQuestions = [
        {
            "cancellationReasonText": "Significant global event",
            "cancellationReasonCode": "Customer_Service.Significant_global_event"
        },
        {
            "cancellationReasonText": "Weather",
            "cancellationReasonCode": "Customer_Service.Weather"
        },
        {
            "cancellationReasonText": "Duplicate Booking",
            "cancellationReasonCode": "Customer_Service.Duplicate_Booking"
        },
        {
            "cancellationReasonText": "Booked wrong tour date",
            "cancellationReasonCode": "Customer_Service.Booked_wrong_tour_date"
        },
        {
            "cancellationReasonText": "Chose a different/cheaper tour",
            "cancellationReasonCode": "Customer_Service.Chose_a_different_cheaper_tour"
        },
        {
            "cancellationReasonText": "The guide or driver didn't show up",
            "cancellationReasonCode": "Customer_Service.Supplier_no_show"
        },
        {
            "cancellationReasonText": "Unexpected medical circumstances",
            "cancellationReasonCode": "Customer_Service.Unexpected_medical_circumstances"
        },
        {
            "cancellationReasonText": "I canceled my entire trip",
            "cancellationReasonCode": "Customer_Service.I_canceled_my_entire_trip"
        }
    ];
    TourDetail.BookingCancelReasons = bookingCanceQuestions;

    let SupplierDetail = await supplierDetails(requestObj);
    
    let BookingPolicy = {
        "QuestionOnConfirmation":"Required"
    }

    // Cancellationn policy object
    let CancellationPolicy = {};
    if(tourDetails.cancellationPolicy != undefined){

        let cancellationPolicy = await capitalizeObjectKeys(tourDetails.cancellationPolicy);

        let tourdetailCancelPolicyObj = await handleTourDetailCancelPolicy(cancellationPolicy);                      

        CancellationPolicy = tourdetailCancelPolicyObj;                        
    };

    // Language guides.
    let languageGuide = cartDataObj?.languageGuide ?? []
    
    let tourServiceObject = {       
        PassengerDetail : PassengerDetail,
        StartDate : StartDate,
        EndDate : EndDate,
        Duration : Duration,
        BookingPolicy : BookingPolicy,
        TourDetail : TourDetail,
        CancellationPolicy : CancellationPolicy,
        languageGuide : languageGuide,
        SupplierDetail : SupplierDetail,
        SupplierCost : SupplierCost,        
        SupplierCommission : SupplierCommission,
        SupplierPaymentDueDate : SupplierPaymentDueDate,
        SupplierDeposit : SupplierDeposit,
        CustomerPrice : CustomerPrice,
        CommissionPayable : CommissionPayable,
        DepositReceivable : DepositReceivable,
        Fees : Fees,
        MarkupPrice : MarkupPrice
    }

    return tourServiceObject;
}

// Get end date based on duration duration take here as minutes.      
async function convertDurationToEndDate(clientId, startDate, duration){
    let fName = "Add_Booking_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_ADD_BOOKING_PROVIDER_ADD_BOOKING_FILE_PATH, config.Provider_Code_OWT);
    try{
        let endDate = "0000-00-00";
        let travelDate = moment(startDate);
        if(typeof duration == "string"){
            let durationArray = duration.split(' '); // Split the string into ['5', 'Days']
            if (durationArray.length === 2 && !isNaN(durationArray[0])) {
                let durationValue = parseInt(durationArray[0]);
                let durationUnit = durationArray[1].toLowerCase(); // Convert to lowercase for consistency

                if (['day', 'days'].includes(durationUnit)) {
                    endDate = travelDate.clone().add(durationValue, 'days').format('YYYY-MM-DD');
                } else {
                    console.error('Unsupported duration unit. Please use "days".');
                }
            }
        }
        else{
            const durationMinutes = duration;
            endDate = travelDate.clone().add(durationMinutes, 'minutes').format('YYYY-MM-DD');
        }
       
        return endDate
    }
    catch(error){
        apiCommonController.getError(error, fName, fPath, request);

        // Send Error response
        return({
            STATUS: "ERROR",
            RESPONSE: {
                text: error.message
            }
        });
    }
    
}

// Function for set capitalize objext keys
async function capitalizeObjectKeys(obj) {
    const newObj = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
        const newKey = key.charAt(0).toUpperCase() + key.slice(1);
        newObj[newKey] = obj[key];
        }
    }
    return newObj;
}

// Function for set time details
async function timeDetails(tourDetails, clientId){
    let endDate = "0000-00-00";
    if(!tourDetails.EndDate && !tourDetails.EndTime){
        if(tourDetails.startDate != undefined && tourDetails.duration != undefined){
            let EndDateTime = await convertDurationToEndDate(clientId, tourDetails.startDate, tourDetails.duration);
            if(EndDateTime){
                endDate = EndDateTime ?? "0000-00-00";
            }
        }
    };
    return endDate;
}

// Function for set add cart data
async function addCartData(cartDataObj, Booking){
    if(cartDataObj.BookingGUID){
        Booking.BookingId =  cartDataObj.BookingGUID ?? "";
        Booking.ReferenceNo = cartDataObj.ReferenceNo ?? "";
        Booking.Title = "";
        Booking.BookingDate = new Date();
        Booking.TravelStartDate = "";
        Booking.TravelEndDate = "";
        Booking.CreatedDate = ""
        Booking.BookingStatus = "";
        Booking.BookingPassengers = {};
    }
    return await Booking;
}

// Function for set supplier details
async function supplierDetails(requestObj){
    let SupplierDetail = {}
    if(requestObj.provider){
        let provider = requestObj.provider;
        if(provider[0] == config.Provider_Code_OWT){                            
            SupplierDetail.Code = provider[0];
            SupplierDetail.Name = "1way2italy";
            SupplierDetail.Provider = provider[0];

        }
    }
    return SupplierDetail;
}

// Function for set booking question
async function bookingQuestion(tourDetails){
    let bookingQuestions = [];
    if(tourDetails.bookingQuestions != undefined && tourDetails.bookingQuestions.length !=0){
        bookingQuestions.push(...tourDetails.bookingQuestions)
    }
    return bookingQuestions;
}

// Function for set trip details
async function tripDetail(TourDetail, tourDetails){
    // Tour title 
    TourDetail.Name = (tourDetails.tourName) ? tourDetails.tourName : tourDetails.title;
    // Tour Code
    TourDetail.Code = tourDetails.bookingCode ?? "";    
    // Tour Description
    TourDetail.Description = {
        "ShortDescription": "",
        "LongDescription": tourDetails.description ?? "", 
        "ImportantInformation": "",
        "WeatherDetails": ""
    }
    return await TourDetail;

}
//Function for get markup fee
function getMarkupFee(priceSummary) {
    return priceSummary?.markupPrice || 0;
}
//Function for get supplier cost
function initializeSupplierCost(tourDetails, pricingInfo) {
    return {
        "Currency": tourDetails.Currency ?? "EUR",
        "CalculationMethod": pricingInfo.CalculationMethod || "",
    };
}
//Function for get start date and time 
function initializeStartDate(tourDetails) {
    return {
        "Date": (tourDetails.startDate != undefined) ? tourDetails.startDate : "0000-00-00",
        "Time": (tourDetails.startTime != undefined) ? tourDetails.startTime : "00:00",
    };
}

async function customerPriceCalculationperPassenger(totalPartnerPrice, NumberOfPassengers, PricetBreakDownAfterTax){
    let totalNumberOfTravelers = parseInt(NumberOfPassengers.Adult) + parseInt(NumberOfPassengers.Child) +parseInt(NumberOfPassengers.Infant);
    if(NumberOfPassengers.Adult != 0){
        PricetBreakDownAfterTax.Adult = totalPartnerPrice / totalNumberOfTravelers;
    }
    if(NumberOfPassengers.Child != 0){
        PricetBreakDownAfterTax.Child = totalPartnerPrice / totalNumberOfTravelers;
    }
    if(NumberOfPassengers.Infant != 0){
        PricetBreakDownAfterTax.Infant =totalPartnerPrice / totalNumberOfTravelers;
    }
    return PricetBreakDownAfterTax;
}

// Adding option name for product option.
async function handleOptionName(tourDetails){
    let Option = "";
    if(tourDetails.title){
        
        let tourName = (tourDetails.tourName)? tourDetails.tourName.toLowerCase() : "";
        let OptionName = (tourDetails.title)? tourDetails.title.toLowerCase() : "";

        if(tourName !== OptionName){
            Option = (tourDetails.title) ? tourDetails.title : "";
        }
    }
    return Option;
}