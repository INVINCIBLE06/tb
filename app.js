const config = require('./Config.js');
const cmnController = require("./CommonController");
const apiCommonController = require("./Utility/APICommonController");
const connectionwithmongoDB = require("./DAL/Mongoose/Mongoose.js");

// To call the dependancy function
(async () => {
    const fName = "initiateTour";
    const methodName = "/initiateTour";
    try {
        // Tour 
        if (config.Tour === 'ON') {
            // Route API call
            cmnController.appStarted('./Routes/Tour/Tour.js', config.Tour_EndPoint, "Tour");
            // Viator Tour Methods
            await viatorTourMethodFirst()

            await viatorTourMethodSecond()

            // End Viator Tour Methods

            //========================== 1way2italy section =========================================//

            await oneWayToItalyTourMethodFirst()

            await oneWayToItalyTourMethodSecond()
            
            //============================ End 1way2italy ============================================//

            // Database connection
            connectionwithmongoDB();
        };
    } catch (err) {
        // Handle error safely and add logs
        apiCommonController.getError(err, fName, methodName, " ");
    }
})();

// Function for viator condition check
async function viatorTourMethodFirst(){
    // Viator product search.
    if (config.Tour_Viator_Search === 'ON') {
        cmnController.appStarted('./Services/Tour/Viator/Search/Search.js', config.Tour_Viator_Search_EndPoint, "Tour Viator Search");
    };
    // Viator product details
    if (config.Tour_Viator_Product_Details === 'ON') {
        cmnController.appStarted('./Services/Tour/Viator/ProductDetails/Details.js', config.Tour_Viator_Product_Details_EndPoint, "Tour Viator Search Product Details");
    };
    // Viator product availablity
    if (config.Tour_Viator_Product_Availability === 'ON') {
        cmnController.appStarted('./Services/Tour/Viator/Availablity/Availablity.js', config.Tour_Viator_Product_Availability_EndPoint, "Tour Viator Search Product Availability");
    };
    // Viator destination caching
    if (config.Tour_Viator_Destination_Cache === 'ON') {
        cmnController.appStarted('./Services/Tour/Viator/DestinationCache/Destination.js', config.Tour_Viator_Destination_Cache_EndPoint, "Tour Viator Destination Caching");
    };
    // Viator destination search suggestion
    if (config.Tour_Viator_Search_Suggestion === 'ON') {
        cmnController.appStarted('./Services/Tour/Viator/SearchSuggestion/Suggestion.js', config.Tour_Viator_Search_Suggestion_EndPoint, "Tour Viator Destination Search Suggestion");
    };
    // Viator product price check 
    if (config.Tour_Viator_Price_Check === 'ON') {
        cmnController.appStarted('./Services/Tour/Viator/PriceCheck/PriceCheck.js', config.Tour_Viator_Price_Check_EndPoint, "Tour Viator product price check");
    };
}

// Function for viator condition check
async function viatorTourMethodSecond(){
    // Viator add booking to moonstride
    if (config.Tour_Viator_Book === 'ON') {
        cmnController.appStarted('./Services/Tour/Viator/AddBooking/AddBooking.js', config.Tour_Viator_Book_EndPoint, "Tour Viator Add Booking to moonstride");
    };
    // Viator booking confirm
    if (config.Tour_Viator_Confirm_Book === 'ON') {
        cmnController.appStarted('./Services/Tour/Viator/Book/Book.js', config.Tour_Viator_Confirm_Book_EndPoint, "Tour Viator Book confirm");
    };
    // Viator booking status
    if (config.Tour_Viator_Book_Status === 'ON') {
        cmnController.appStarted('./Services/Tour/Viator/BookingStatus/Status.js', config.Tour_Viator_Book_Status_EndPoint, "Tour Viator Book Status");
    };
     // Viator product related data endpoint
    if (config.Tour_Viator_Book_cancel === 'ON') {
        cmnController.appStarted('./Services/Tour/Viator/cancelBooking/cancelBooking.js', config.Tour_Viator_Book_cancel_EndPoint, "Tour Viator Cancel Booking");
    };
    // Viator destination attraction endpoint
    if (config.Tour_Viator_Attraction === 'ON') {
        cmnController.appStarted('./Services/Tour/Viator/Attractions/Attraction.js', config.Tour_Viator_Attraction_EndPoint, "Tour Viator Attractions");
    };
    //Viator booking questions save to moonstride
    if(config.Tour_Viator_Save_Booking === 'ON') {
        cmnController.appStarted('./Services/Tour/Viator/SaveQuestions/SaveQuestions.js', config.Tour_Viator_Save_Booking_EndPoint, "Tour Viator Save Questions to moonstride");
    }
    // viator booking questions caching endpoint
    if(config.Tour_Viator_Cache_Booking_Questions === 'ON'){
        cmnController.appStarted('./Services/Tour/Viator/BookingQuestions/Questions.js', config.Tour_Viator_Cache_Booking_Questions_EndPoint, "Tour Viator Booking Questions Caching");
    }
    // viator booking cancel reasons caching endpoints
    if(config.Tour_Viator_Booking_Cancel_Reason_Caching === 'ON'){
        cmnController.appStarted('./Services/Tour/Viator/CancelReasonCache/CancelReason.js', config.Tour_Viator_Booking_Cancel_Reason_Caching_EndPoint, "Tour Viator Booking Cancel Reason Caching")
    }
}

// Function for 1way2italy condition check
async function oneWayToItalyTourMethodFirst(){
    // Destination caching 
    if(config.Tour_1way2italy_Destination_Cache === 'ON'){
                
        cmnController.appStarted('./Services/Tour/1way2italy/DestinationCache/Destination.js', config.Tour_1way2italy_Destination_Cache_EndPoint, "Tour 1way2italy Destination caching");
        
    };
    // Search suggession
    if(config.Tour_1way2italy_Search_Suggestion === 'ON'){
        
        cmnController.appStarted('./Services/Tour/1way2italy/SearchSuggestion/Suggestion.js', config.Tour_1way2italy_Search_Suggestion_EndPoint, "Tour 1way2italy Search Suggestion");
        
    };
    // Search destination
    if(config.Tour_1way2italy_Search === 'ON'){
        
        cmnController.appStarted('./Services/Tour/1way2italy/Search/Search.js', config.Tour_1way2italy_Search_EndPoint, "Tour 1way2italy Search Destination");
        
    };
    // Destination product details
    if(config.Tour_1way2italy_Product_Details === 'ON'){
        
        cmnController.appStarted('./Services/Tour/1way2italy/ProductDetails/Details.js', config.Tour_1way2italy_Product_Details_EndPoint, "Tour 1way2italy product Details");
        
    };
    // Destination product Availability
    if(config.Tour_1way2italy_Product_Availability === 'ON'){
        
        cmnController.appStarted('./Services/Tour/1way2italy/Availablity/Availablity.js', config.Tour_1way2italy_Product_Availability_EndPoint, "Tour 1way2italy product Availability");
        
    };
    // 1way2italy product confirm booking.
    if(config.Tour_1way2italy_Booking_Confirm === 'ON'){
        
        cmnController.appStarted('./Services/Tour/1way2italy/booking/Booking.js', config.Tour_1way2italy_Booking_Confirm_EndPoint, "Tour 1way2italy Booking confirm");
        
    };
}

// Function for 1way2italy condition check
async function oneWayToItalyTourMethodSecond(){
    
    // 1way2italy product add booking to moonstride.
    if(config.Tour_1way2italy_Add_Booking === 'ON'){
        
        cmnController.appStarted('./Services/Tour/1way2italy/AddBooking/AddBooking.js', config.Tour_1way2italy_Add_Booking_EndPoint, "Tour 1way2italy Add Booking to moonstride");
        
    };
    // 1way2italy cancel booking.
    if(config.Tour_1way2italy_cancel_Booking === 'ON'){
                
        cmnController.appStarted('./Services/Tour/1way2italy/cancelBooking/cancelBooking.js', config.Tour_1way2italy_cancel_Booking_EndPoint, "Tour 1way2italy cancel booking");
        
    };
    // 1way2italy Booking Status
    if(config.Tour_1way2italy_Book_Status === 'ON'){
        cmnController.appStarted('./Services/Tour/1way2italy/BookingStatus/Status.js', config.Tour_1way2italy_Book_Status_EndPoint, "Tour 1way2italy Book Status");
    };
    // 1way2italy price check
    if(config.Tour_1way2italy_Price_Check === 'ON'){
        cmnController.appStarted('./Services/Tour/1way2italy/PriceCheck/PriceCheck.js', config.Tour_1way2italy_Price_Check_EndPoint, "Tour 1way2italy price check");
    };
    //1way2italy booking questions save to moonstride
    if(config.Tour_1way2italy_Save_Booking === 'ON') {
        cmnController.appStarted('./Services/Tour/1way2italy/saveQuestions/SaveQuestions.js', config.Tour_1way2italy_Save_Booking_EndPoint, "Tour 1way2italy Save Questions to moonstride");
    }
}