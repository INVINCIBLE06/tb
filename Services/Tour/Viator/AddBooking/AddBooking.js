"use strict";
const moment = require('moment');
const config = require("../../../../Config");
const apiCommonController = require("../../../../Utility/APICommonController");
const fs = require('fs');

module.exports = async (app) => {
    app.post("/:id/Tour/Viator/AddBooking", async function (request, response, next){
        // Validating request fields. 
        await apiCommonController.addBookingValidation(request, response, next);
    }, async function (request, response) {

        const requestObj = request.body;
        const clientId = request.params.id;
        let fName = "Add_Booking_";
        let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_ADD_BOOKING_PROVIDER_ADD_BOOKING_FILE_PATH, config.Provider_Code_VTR);
        try{
            // Checking the request and and some times it has more than one data.
            if( requestObj.cartData != undefined && requestObj.cartData.length > 0){
                let cartData = requestObj.cartData;
                // Final data for booking json.
                let Booking = {};
                let Services = {};
                let tourserviceArr = [];
                for(let cart = 0; cart < cartData.length; cart++){
                    // Taking a single data obj to variable 
                    let seprateCartItem = await seprateCartItemData(cart, Booking, tourserviceArr, cartData, requestObj, clientId);
                    Booking = seprateCartItem.Booking;
                    tourserviceArr = seprateCartItem.tourserviceArr
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
    
    })
}

// Get end date based on duration duration take here as minutes. 
async function convertDurationToEndDate(clientId, startDate, duration){
    let fName = "Add_Booking_";
    let fPath = await apiCommonController.logsFolderStructureBuilder(clientId, config.SERVICE_ADD_BOOKING_PROVIDER_ADD_BOOKING_FILE_PATH, config.Provider_Code_VTR);
    try{
        if(typeof duration == "string"){
            duration = (parseInt(duration)) * 24 * 60
        }
        const travelDate = moment(startDate);
        const durationMinutes = duration;
        const endDate = travelDate.clone().add(durationMinutes, 'minutes').format('YYYY-MM-DD');
        return endDate
    }
    catch(error){
        console.log(error);
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

// Function for capitalize object keys
async function capitalizeObjectKeys(obj) {
    try{
        const newObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
            const newKey = key.charAt(0).toUpperCase() + key.slice(1);
            newObj[newKey] = obj[key];
            }
        }
        return newObj;
    }
    catch(error){
        console.log(error);
    }        
}

// Function for set seprate cart items
async function seprateCartItemData(cart, Booking, tourserviceArr, cartData, requestObj, clientId){
    try {
        let cartDataObj = cartData[cart];

        //----------------------------------------------------------------//
        // BookingPassengers details like NumberOfPassengers etc..
        // Passanger details is an array that contain all the passanger details.
        let passangerCount = cartDataObj.passengerDetails;
        // Multiple passanger details
        let NumberOfPassengers = {
            "Adult" : 0,
            "Child" : 0,
            "Infant" : 0
        };

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

        // Tour details
        let tourDetails = cartDataObj.tourDetails

        let basicBookingData = await setBasicBookingData(cartDataObj, Booking, NumberOfPassengers, passengerDetails, PassengerDetail, tourDetails, passangerCount);
        Booking = basicBookingData.Booking        

        PassengerDetail = basicBookingData.PassengerDetail
        let StartDate = basicBookingData.StartDate
        Booking.TravelStartDate = StartDate.Date;


        // EndDate
        let EndDate = {
            "Date": "0000-00-00",
            "Time": "00:00"
        };

        let dateDetails = await setDateDetails(tourDetails, Booking, clientId, EndDate)
        Booking = dateDetails;

        // Duration        
        let Duration = {
            "Value": "24",
            "Interval": "Hours"
        }
        let setDurationData = setDuration(tourDetails, Duration)
        Duration = setDurationData
        

        //--------------------------------------------------//
        // TourDetail
        let TourDetail = {
            "TourId" : ""
        };

        let basicTourDetails = await basicTourDetailsData(tourDetails, cartDataObj, requestObj, TourDetail);
        TourDetail = basicTourDetails
        // Cancellation policy
        let cancellationPolicy = await setCancellationPolicy(tourDetails)
        let CancellationPolicy = cancellationPolicy;

        let languageGuide = cartDataObj?.languageGuide ?? []
        //----------------------------------------------------------//
        // Price and tax details 

        // Price from request object
        let pricingInfo = cartDataObj.pricingInfo;                    
        TourDetail.Currency = cartDataObj?.searchItems.currency;
        TourDetail.providerPriceDetails = pricingInfo;
        
        
        // Supplier NetCost
        let SupplierCost = {
            "Currency": (cartDataObj?.searchItems.currency)? cartDataObj?.searchItems.currency : "",
            "CalculationMethod": (pricingInfo.CalculationMethod) ? pricingInfo.CalculationMethod : "",
        };
        
        //--------------------------------------------------------------//
        // Supplier coast classification
        let priceSummary = pricingInfo.priceSummary;

        let Amount = {
            "BeforeTax": 0,
            "AfterTax": (priceSummary.partnerTotalPrice)? priceSummary.partnerTotalPrice : 0,
            "Tax": 0,
        }
        // Coast breakdown for each traveler like adult, child, infant etc.
        let CostBreakDownBeforeTax = {
            "Adult": 0,
            "Child": 0,
            "Infant": 0
        }
        let CostBreakDownAfterTax = {
            "Adult": 0,
            "Child": 0,
            "Infant": 0
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

        let pricePerTraveler = pricingInfo.travelers;
        let totalNumberOftravelers = 0

        pricePerTraveler.forEach(traveler => {
            if (traveler.numberOfTravelers) {
                totalNumberOftravelers += traveler.numberOfTravelers;
            }
        });

        let totoalPartnerPrice = pricingInfo.priceSummary.partnerTotalPrice
        let minumumPrice = (totoalPartnerPrice / totalNumberOftravelers);

        let minAgeband = await setAgeBreakDowns(minumumPrice, CostBreakDownAfterTax, pricePerTraveler);
        CostBreakDownAfterTax = minAgeband

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
        let CustomerPrice = setCustomerPrice(cartDataObj, pricingInfo, priceSummary)
        
        let PricetBreakDownAfterTax = {
            "Adult": 0,
            "Child": 0,
            "Infant": 0
        }
        let totoalMarkupPrice = pricingInfo.priceSummary.TotalSupplierCostAfterAgentMarkup

        let MarkupminumumPrice = (totoalMarkupPrice / totalNumberOftravelers);

        let ageband = await setAgeBreakDowns(MarkupminumumPrice, PricetBreakDownAfterTax, pricePerTraveler);

        PricetBreakDownAfterTax = ageband
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
            "TotalAdditionalFeesAfterTax": 0,
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
            "MarkupFee" : pricingInfo.priceSummary.markupPrice,                        
        }
        // Booking questions
        let bookingQuestions = [];
        if(tourDetails.bookingQuestions != undefined && tourDetails.bookingQuestions.length !=0){
            bookingQuestions.push(...tourDetails.bookingQuestions)
        }
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

        let SupplierDetail = {};
        if(requestObj.provider){
            let provider = requestObj.provider;
            if(provider[0] == config.Provider_Code_VTR){                            
                SupplierDetail.Code = provider[0];
                SupplierDetail.Name = "Viator";
                SupplierDetail.Provider = provider[0];

            }
        }
        
        let BookingPolicy = {
            "QuestionOnConfirmation":"Required"
        }


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
        
        tourserviceArr.push(tourServiceObject);
        return {
            "Booking" : await Booking,
            "tourserviceArr" : await tourserviceArr
        }    
    }
    catch (error) {
        console.log(error);        
    }
}

// Function for basic booking data 
async function setBasicBookingData(cartDataObj, Booking, NumberOfPassengers, passengerDetails, PassengerDetail, tourDetails, passangerCount){
    try {
        //----------------------------------------------------------//
        // Booking object for storing booking id and ReferenceNo
        if(cartDataObj.BookingGUID){
            Booking.BookingId = (cartDataObj.BookingGUID != undefined) ? cartDataObj.BookingGUID : "";
            Booking.ReferenceNo = (cartDataObj.ReferenceNo != undefined) ? cartDataObj.ReferenceNo : "";
            Booking.Title = "";
            Booking.BookingDate = new Date();
            Booking.TravelStartDate = "";
            Booking.TravelEndDate = "";
            Booking.CreatedDate = ""
            Booking.BookingStatus = "";
            Booking.BookingPassengers = {};
        }

        
        for(let pax of passangerCount){
            let ageBand = pax.ageBand;
            switch(ageBand){
                case "ADULT" : 
                    NumberOfPassengers.Adult = pax.numberOfTravelers;
                    break;
                case "CHILD" : 
                    NumberOfPassengers.Child = pax.numberOfTravelers;
                    break;
                case "INFANT" :
                    NumberOfPassengers.Infant = pax.numberOfTravelers;
                    break;
                case "TRAVELER" : 
                    NumberOfPassengers.Traveler = pax.numberOfTravelers;
                    break;
                case "YOUTH" :
                    NumberOfPassengers.Youth = pax.numberOfTravelers;
                    break;
                case "SENIOR" : 
                    NumberOfPassengers.Senior = pax.numberOfTravelers;
                    break;
                default:
                    break;
            
            }
        }
        let BookingPassengers = {
            NumberOfPassengers : NumberOfPassengers,
            Passengers : []
        };

        

        if(passengerDetails != undefined && passengerDetails.length != 0){
            for(let passengerDetailsData of passengerDetails){
                let bookingPassengerDetail = await bookingPassengerDetails(passengerDetailsData, PassengerDetail, passengerDetails, BookingPassengers)
                PassengerDetail = bookingPassengerDetail.PassengerDetail
                passengerDetails = bookingPassengerDetail.passengerDetails
                BookingPassengers = bookingPassengerDetail.BookingPassengers                          
            }                        
        }

        Booking.BookingPassengers = BookingPassengers;

        
        // Start date and time.
        let StartDate = {
            "Date": (tourDetails.startDate != undefined) ? tourDetails.startDate : "0000-00-00",
            "Time": (tourDetails.startTime != undefined) ? tourDetails.startTime : "00:00"
        }
        let basicTourDetails = {
            "Booking" : await Booking,
            "passengerDetails" : await passengerDetails,
            "PassengerDetail" : await PassengerDetail,
            "StartDate" : StartDate

        }
        return basicTourDetails;
    }
    catch (error) {
        console.log(error);    
    }    
}

// Function for add age breakdowns in tax
async function setAgeBreakDowns(price, breakDown, pricePerTraveler){
    try {
        for(let pricePerTravelerData of pricePerTraveler){
            let ageBand = pricePerTravelerData.ageBand;                        
    
            switch(ageBand){
                case "ADULT":
                    breakDown.Adult = price || 0;
                    break;
                case "CHILD":
                    breakDown.Child = price || 0;
                        
                    break;
                case "INFANT":
                    breakDown.Infant = price || 0;
    
                    break;
                case "TRAVELER":   
                    breakDown.Traveler = price || 0;
                    break;
                default:
                    break;
    
            }
        }
        return await breakDown;
    }
    catch (error) {
        console.log(error);    
    }
    
}

// Function for add date details in booking data
async function setDateDetails(tourDetails, Booking, clientId, EndDate){
    try {
        if(!tourDetails.EndDate && !tourDetails.EndTime){
            if(tourDetails.startDate != undefined && tourDetails.duration != undefined){
                let EndDateTime = await convertDurationToEndDate(clientId, tourDetails.startDate, tourDetails.duration);
                if(EndDateTime){
                    EndDate.Date = (EndDateTime) ? EndDateTime : "0000-00-00";
                    Booking.TravelEndDate = EndDate.Date;
                    EndDate.Time = "00:00";
                }
            }
        }
        return await Booking;
    }
    catch (error) {
        console.log(error);    
    }
    
}

// Booking passengers details object.
async function passangerDetailsObject(passengerDetailsData){
    try {
        let passengerBasicInfo = {
            "PassengerId": (passengerDetailsData.passengerinformationguid) ? passengerDetailsData.passengerinformationguid : "",
            "Title": (passengerDetailsData.title) ? passengerDetailsData.title : "Mr",
            "FirstName": (passengerDetailsData.firstname) ? passengerDetailsData.firstname : "",
            "MiddleName": (passengerDetailsData.middelname) ? passengerDetailsData.middelname : "",
            "LastName": (passengerDetailsData.lastname) ? passengerDetailsData.lastname : "",
            "Gender": (passengerDetailsData.gender) ? passengerDetailsData.gender : "",
            "Type": (passengerDetailsData.type) ? passengerDetailsData.type : "",
            "DateOfBirth": (passengerDetailsData.dateofbirth) ? passengerDetailsData.dateofbirth : "",
            "Age": (passengerDetailsData.age) ? passengerDetailsData.age : "",
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
        return passengerBasicInfo;
    }
    catch (error) {
        console.log(error);    
    }
    
}

// Function for adding passenger information
async function bookingPassengerDetails(passengerDetailsData, PassengerDetail, passengerDetails, BookingPassengers){
    try {
        if(passengerDetailsData.passengerinformationguid != undefined){
            // Booking passengers details object.
            let passengerBasicInfo = await passangerDetailsObject(passengerDetailsData)
            BookingPassengers.Passengers.push(passengerBasicInfo)
            
            if (passengerDetailsData.type === "A") {
                PassengerDetail.Adult.Passengers.push({ PassengerId: passengerDetailsData.passengerinformationguid });
                PassengerDetail.Adult.Count++;
            }
            else if (passengerDetailsData.type === "C") {
                PassengerDetail.Child.Passengers.push({ PassengerId: passengerDetailsData.passengerinformationguid });
                PassengerDetail.Child.Count++;
            }
            else if (passengerDetailsData.type === "I") {
                PassengerDetail.Infant.Passengers.push({ PassengerId: passengerDetailsData.passengerinformationguid });
                PassengerDetail.Infant.Count++;
            }                                
        }  
        return {
            "PassengerDetail" : await PassengerDetail,
            "passengerDetails" : await passengerDetails,
            "BookingPassengers" : await BookingPassengers  
        }
    }
    catch (error) {
        console.log(error);    
    }
    
}

// Function for adding basic tour details
async function basicTourDetailsData(tourDetails, cartDataObj, requestObj, TourDetail){
    try {
        // Tour title 
        TourDetail.Name = (tourDetails.tourName) ? tourDetails.tourName : "";

        // Tour Code
        TourDetail.Code = (tourDetails.productCode) ? tourDetails.productCode : "";

        // Tour product option code
        TourDetail.OptionCode = (tourDetails.productOptionCode) ? tourDetails.productOptionCode : "";

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

        // Tour Description
        TourDetail.Description = {
            "ShortDescription": "",
            "LongDescription": (tourDetails.description) ? tourDetails.description : "", 
            "ImportantInformation": "",
            "WeatherDetails": ""
        }

        // Availability per person age , in tour details
        let availabilityPerPerson = await setAvailabilityPerPerson(cartDataObj, TourDetail)
        TourDetail = availabilityPerPerson;

        let additionalTourDetails = await additionalTourDetail(tourDetails, TourDetail)
        TourDetail = additionalTourDetails;

        // Tour Images
        let Images = await setTourImages(tourDetails);
        TourDetail.Images = Images;

        // Tour Currency
        TourDetail.Currency = (cartDataObj?.searchItems.currency)? cartDataObj?.searchItems.currency : "GBP";

        // Tour SupplierDetail or provider details
        if(requestObj.provider){
            let provider = requestObj.provider;
            if(provider[0] == config.Provider_Code_VTR){
                let providerObj = {
                    "Code" : provider[0],
                    "Name" : "Viator",
                    "Provider" : provider[0]
                }
                TourDetail.SupplierDetail = providerObj;

            }
        }
        else{
            TourDetail.SupplierDetail = {};
        }
        
        // Location;
        TourDetail.Location = await handleLocationDetails(cartDataObj)

        return await TourDetail;
    }
    catch (error) {
        console.log(error);    
    }
    
}

// Function for adding additional tour details
async function additionalTourDetail(tourDetails, TourDetail){
    try {
        // Tour Inclusions
        let Inclusions = [];
        if(tourDetails.Inclusions){
            let inclusions = tourDetails.Inclusions;
            for(let inclusionsData of inclusions){
                let incObj = {
                    "Description" : inclusionsData
                }
                Inclusions.push(incObj);
            }
        }
        TourDetail.Inclusions = Inclusions;

        // Exclusions
        let Exclusions = [];
        if(tourDetails.exclusions){
            let exclusions = tourDetails.exclusions;
            for(let exclusionsData of exclusions){
                let exeObj = {
                    "Description" : exclusionsData
                }
                Exclusions.push(exeObj);
            }
        }
        TourDetail.Exclusions = Exclusions;

        // Highlights
        let Highlights = []
        if(tourDetails.highlights){
            let highlights = tourDetails.highlights;
            for(let highlightsData of highlights){
                let higObj = {
                    "Description" : highlightsData
                }
                Highlights.push(higObj);
            }
        }
        TourDetail.Highlights = Highlights;

        // OtherDescriptions
        let OtherDescriptions = [];
        if(tourDetails.otherDescriptions){
            let otherDescription = tourDetails.otherDescription;
            for(let otherDescriptionData of otherDescription){
                let othObj = {
                    "Title": "",
                    "Description": otherDescriptionData
                }
                OtherDescriptions.push(othObj);
            }
        }
        TourDetail.OtherDescriptions = OtherDescriptions; 
        return await TourDetail;
    }
    catch (error) {
        console.log(error);    
    }
    
}
// Location object builder
async function handleLocationDetails(cartDataObj){
    // Location
    let LocationObj = {}
    if(cartDataObj.searchItems){
        // Taking primary destination id for getting product destination or get destination id from search data. 
        let destinationId = cartDataObj?.tourDetails?.PrimaryDestination?.ref ?? cartDataObj?.searchItems?.searchDestinationId;
        
        let locationsData = fs.readFileSync(process.cwd()+ config.viator_Destination_File_Path, 'utf-8')
        let jsonData = JSON.parse(locationsData).data
        
        let locationsDetails = jsonData.filter(item => item.destinationId == destinationId)[0]
        
        let lookupId = locationsDetails.lookupId.split('.')
        
        
        for (let i = lookupId.length-1; i > 0; i--) {
            let data = jsonData.filter(item => item.destinationId === parseInt(lookupId[i]))[0]
            let type = data.destinationType == 'REGION'? 'State': data.destinationType.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

            let index;
            
            switch (data.destinationType) {
                case 'COUNTRY':
                    index = 7
                    break;
                case 'REGION':
                    index = 6
                    break;
                case 'CITY':
                    index = 5
                    break;
            }
            
            
            if(i == lookupId.length -1){
                LocationObj.LocationId = "";
                LocationObj.ProviderLocationId = lookupId[i]
                LocationObj.Name = locationsDetails.destinationName;
                LocationObj.LocationType = {
                    Code : config.locationTypeCodes[index].code,
                    Name : config.locationTypeCodes[index].locationtypevalue
                }
                
            }else{
                LocationObj = await functionIfNotTheFirstIteration(index, LocationObj, type, data);
            } 
            
        }
        LocationObj.Latitude = locationsDetails.latitude
        LocationObj.Longitude = locationsDetails.longitude        
    }
    return LocationObj;
}

// function to execute when the its is not the first iteration of the lookupId array loop
async function functionIfNotTheFirstIteration(index, LocationObj, type, data){
    if(index == 7 ){         
        // find country details from country list in config
        let country = config.countryList.find(item => item.name === data?.destinationName || item.shortName === data?.destinationName);    
        LocationObj[`${type}`] = {
            [`${type}Id`] : "",
            // get contry code from pacakge 
            Code : country.iso2,
            Name : data.destinationName
        }
    }else {
        
        LocationObj[`${type}`] = {
            [`${type}Id`] : "",
            ProviderStateId : data.destinationId,
            Name : data.destinationName
        }
    }
    return LocationObj;
}


// Function for cancellationn policy object
async function setCancellationPolicy(tourDetails){
    try {
        let CancellationPolicy = {};
        if(tourDetails.cancellationPolicy != undefined){
            let cancellationPolicy = await capitalizeObjectKeys(tourDetails.cancellationPolicy);
            for (const item of cancellationPolicy.RefundEligibility) {
                for (const key in item) {
                    if (item.hasOwnProperty(key)) {
                    const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                    item[capitalizedKey] = item[key];
                    delete item[key];
                    }
                }
            }
            CancellationPolicy = cancellationPolicy;        
        }
        return CancellationPolicy;
    }
    catch (error) {
        console.log(error);    
    }
    
}

// Function for availability per person age , in tour details
async function setAvailabilityPerPerson(cartDataObj, TourDetail){
    try {
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
            }
            TourDetail.AgeBandFromAndTo = AgeBandFromAndTo;
        }
        else{
            TourDetail.AgeBandFromAndTo = [];
        }
        return await TourDetail; 
    }
    catch (error) {
        console.log(error);    
    }
}

// Function for set tour images
async function setTourImages(tourDetails){
    try {
        let Images = [];
        if(tourDetails.images){
            let images = tourDetails.images;
            for(let imagesData of images){
                let imagObj = {
                    "Name": (imagesData.Name) ? imagesData.Name : "",
                    "Url": (imagesData.url) ? imagesData.url : "",
                    "IsDefault": (imagesData.IsDefault) ? imagesData.IsDefault : ""
                }
                Images.push(imagObj);
            }
        }
        return Images;
    }
    catch (error) {
        console.log(error);    
    }
    
}

// Function for set customer price
function setCustomerPrice(cartDataObj, pricingInfo, priceSummary){
    try {
        let responseData = {
            "Currency": (cartDataObj?.searchItems.currency)? cartDataObj?.searchItems.currency : "",
            "ExchangeRate": priceSummary?.ExchangeRate ?? 0,
            "CalculationMethod": (pricingInfo.CalculationMethod) ? pricingInfo.CalculationMethod : "",
            "Amount": {
                "BeforeTax": 0,
                "AfterTax": (priceSummary.TotalSupplierCostAfterAgentMarkup)? priceSummary.TotalSupplierCostAfterAgentMarkup : priceSummary.partnerTotalPrice || 0,
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
        return responseData;
    }
    catch (error) {
        console.log(error);    
    }
    
}

// Function for set duration
function setDuration(tourDetails, Duration){
    if(tourDetails.duration != "Null"){
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
    return Duration
}

//Tour option name adding.
async function handleOptionName(tourDetails){
    let Option = ""
    if(tourDetails.title){
    
        let tourName = tourDetails.tourName.toLowerCase()
        let OptionName = tourDetails.title.toLowerCase();

        if(tourName !== OptionName){
            Option = (tourDetails.title) ? tourDetails.title : "";
        }
    }
    return Option;
}