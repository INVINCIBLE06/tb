const dotenv = require("dotenv");
const path = require("path");

// Dynamic environment file configuration
dotenv.config({
    path: path.resolve(__dirname, process.env.NODE_ENV + ".env")
});
module.exports = {
    // Tour Endpoints
    Tour: process.env.Tour,
    Tour_EndPoint: process.env.Tour_EndPoint,
    Tour_Initialization: process.env.Tour_Initialization,
    Tour_Initialization_EndPoint: process.env.Tour_Initialization_EndPoint,

    // Session Age
    SessionMaxAge: process.env.SessionMaxAge,
    // Domains details
    Domains: process.env.Domains,
    Front_Domains: process.env.Front_Domains,
    // Mooncognito API details
    Callback_URL: process.env.Callback_URL,
    Enc_Algorithm: process.env.Enc_Algorithm,
    Encryption_Key: process.env.Encryption_Key,
    Mooncognito_X_Api_Key: process.env.Mooncognito_X_Api_Key,
    Database_Salt_Key: process.env.Database_Salt_Key,

    // MongoDB Connection String
    Mongo_URL: process.env.Mongo_URL,

    // Agent markup calculation database url
    Agent_Markup_URL: process.env.Agent_Markup_Url,

    // Google api base url
    Google_Api_BaseUrl : process.env.Google_Api_BaseUrl,

    // Save questions to moonstride url
    SaveQuestion_Moonstride_Url: process.env.SaveQuestion_Moonstride_Url,

    // Add booking request to moonstride crm
    Add_Booking_Request_Moonstride_Url: process.env.Add_Booking_Request_Moonstride_Url,

    // Viator destination file path
    viator_Destination_File_Path: process.env.viator_Destination_File_Path,

    // Viator language guide json file path
    viator_Language_Guide_Json: process.env.viator_Language_Guide_Json,

    // OneWay2italy destination json file path.
    OneWay2italy_Destination_File_Path: process.env.OneWay2italy_Destination_File_Path,

    // Oneway2italy supplier details details json file location.
    OneWay2italy_Supplier_Details_File_Path: process.env.OneWay2italy_Supplier_Details_File_Path,

    // viator booking questions caching location
    viator_booking_questionCaching_location: process.env.viator_booking_questionCaching_location,

    // viator attraction caching file location 
    viator_attraction_caching_location: process.env.viator_attraction_caching_location,

    // viator booking cancel reason caching file location
    viator_booking_cancel_reason_caching_file_location: process.env.viator_booking_cancel_reason_caching_file_location,

    // viator pickup location caching file location
    viator_pickup_location_caching_file_location: process.env.viator_pickup_location_caching_file_location,

    // viator supplier details caching file location
    viator_supplier_details_caching_file_location: process.env.viator_supplier_details_caching_file_location,

    // viator product user reviews caching file location
    viator_product_user_reviews_caching_file_location: process.env.viator_product_user_reviews_caching_file_location,

    //=============================== Viator Integration Endpoints ============================//

    // Viator product search endPoint
    Tour_Viator_Search: process.env.Tour_Viator_Search,
    Tour_Viator_Search_EndPoint: process.env.Tour_Viator_Search_EndPoint,
    // Viator search product details endpoint
    Tour_Viator_Product_Details: process.env.Tour_Viator_Product_Details,
    Tour_Viator_Product_Details_EndPoint: process.env.Tour_Viator_Product_Details_EndPoint,

    // Viator product availablity endPoint
    Tour_Viator_Product_Availability: process.env.Tour_Viator_Product_Availability,
    Tour_Viator_Product_Availability_EndPoint: process.env.Tour_Viator_Product_Availability_EndPoint,

    // Viator destination caching endPoint
    Tour_Viator_Destination_Cache: process.env.Tour_Viator_Destination_Cache,
    Tour_Viator_Destination_Cache_EndPoint: process.env.Tour_Viator_Destination_Cache_EndPoint,

    // Viator search destination suggestion
    Tour_Viator_Search_Suggestion: process.env.Tour_Viator_Search_Suggestion,
    Tour_Viator_Search_Suggestion_EndPoint: process.env.Tour_Viator_Search_Suggestion_EndPoint,

    // Viator product price check
    Tour_Viator_Price_Check: process.env.Tour_Viator_Price_Check,
    Tour_Viator_Price_Check_EndPoint: process.env.Tour_Viator_Price_Check_EndPoint,

    // Viator add booking to moonstride endPoint
    Tour_Viator_Book: process.env.Tour_Viator_Book,
    Tour_Viator_Book_EndPoint: process.env.Tour_Viator_Book_EndPoint,

    // Viator confirm booking
    Tour_Viator_Confirm_Book: process.env.Tour_Viator_Confirm_Book,
    Tour_Viator_Confirm_Book_EndPoint: process.env.Tour_Viator_Confirm_Book_EndPoint,

    // Viator booing status endPoint
    Tour_Viator_Book_Status: process.env.Tour_Viator_Book_Status,
    Tour_Viator_Book_Status_EndPoint: process.env.Tour_Viator_Book_Status_EndPoint,

    // Viator product related data endpoint
    Tour_Viator_Product_Related_Data: process.env.Tour_Viator_Product_Related_Data,
    Tour_Viator_Product_Related_Data_EndPoint: process.env.Tour_Viator_Product_Related_Data_EndPoint,

    // Viator booking cancel EndPoint
    Tour_Viator_Book_cancel: process.env.Tour_Viator_Book_cancel,
    Tour_Viator_Book_cancel_EndPoint: process.env.Tour_Viator_Book_cancel_EndPoint,

    // Viator attraction endpoint
    Tour_Viator_Attraction: process.env.Tour_Viator_Attraction,
    Tour_Viator_Attraction_EndPoint: process.env.Tour_Viator_Attraction_EndPoint,

    // Viator save booking to moonstride endpoint
    Tour_Viator_Save_Booking: process.env.Tour_Viator_Save_Booking,
    Tour_Viator_Save_Booking_EndPoint: process.env.Tour_Viator_Save_Booking_EndPoint,

    // viator booking questions caching
    Tour_Viator_Cache_Booking_Questions: process.env.Tour_Viator_Cache_Booking_Questions,
    Tour_Viator_Cache_Booking_Questions_EndPoint: process.env.Tour_Viator_Cache_Booking_Questions_EndPoint,

    // viator destination attractions caching
    Tour_Viator_Attraction_Caching: process.env.Tour_Viator_Attraction_Caching,
    Tour_Viator_Attraction_Caching_EndPoint: process.env.Tour_Viator_Attraction_Caching_EndPoint,

    // viator booking cancel reasons caching endpoint
    Tour_Viator_Booking_Cancel_Reason_Caching: process.env.Tour_Viator_Booking_Cancel_Reason_Caching,
    Tour_Viator_Booking_Cancel_Reason_Caching_EndPoint: process.env.Tour_Viator_Booking_Cancel_Reason_Caching_EndPoint,

    // viator products tags caching location
    Tour_Viator_Product_Tags_Caching_Location : process.env.viator_product_tags_caching_location,

    // Viator API Endpoints
    Viator_Site_URL: process.env.Viator_Site_URL,
    Viator_Base_URL: process.env.Viator_Base_URL,

    // viator common currency
    viator_Available_Currency : process.env.viator_Available_Currency,
    viator_Booking_Currency : process.env.viator_Booking_Currency,

    // viator booking voucher details 
    viator_voucherDetails: {
      "companyName": "moonstride",
      "email": "support@moonstride.com",
      "phone": "00000000000",
      "voucherText": "For any enquiries, please visit our customer support page at https://support.moonstride.com",
      "format" : "PDF"
    },

    DeleteBookingServiceCategoryCode : "TRB",

    // viator product default option code
    Default_OptionCode : process.env.Default_OptionCode,

    OptionCodeSplitter: process.env.OptionCodeSplitter,

    // viator service url
    viator_search_url : "products/search",
    viator_tags_url : "products/tags",
    viator_details_url : "products/",
    viator_supplier_url : "suppliers/search/product-codes",
    viator_reviews_url : "reviews/product",
    viator_availability_schedulr_url : "availability/schedules/",
    viator_locationBulk_url : "locations/bulk",
    viator_availability_url : "availability/check",
    viator_destination_cache_url : "v1/taxonomy/destinations",
    viator_cancel_reasons_url : "/bookings/cancel-reasons",
    viator_cancel_quote_url : "/cancel-quote",
    viator_booking_status_url : "bookings/status",
    viator_booking_hold_url : "bookings/hold",
    viator_confirm_booking_url : "bookings/book",
    viator_attrtactions_url : "v1/taxonomy/attractions",
    viator_booking_questions_url : "products/booking-questions",


    //============================= End of viator ============================================//

    //=============================== 1way2Italy Integration Endpoints ===========================//

    // 1way2italy base url and userid and passeord
    OneWay2italy_Requestor_ID: process.env.OneWay2italy_Requestor_ID,
    OneWay2italy_Requestor_MessagePassword: process.env.OneWay2italy_Requestor_MessagePassword,

    // 1way2italy base url
    OneWay2italy_Base_URL:process.env.OneWay2italy_Base_URL,
    OneWay2italy_Site_URL:process.env.OneWay2italy_Site_URL,
    
    // EndPoints
    // Destination caching
    Tour_1way2italy_Destination_Cache: process.env.Tour_1way2italy_Destination_Cache,
    Tour_1way2italy_Destination_Cache_EndPoint : process.env.Tour_1way2italy_Destination_Cache_EndPoint,

    // Search suggession
    Tour_1way2italy_Search_Suggestion: process.env.Tour_1way2italy_Search_Suggestion,
    Tour_1way2italy_Search_Suggestion_EndPoint:process.env.Tour_1way2italy_Search_Suggestion_EndPoint,

    // Search destination 
    Tour_1way2italy_Search: process.env.Tour_1way2italy_Search,
    Tour_1way2italy_Search_EndPoint: process.env.Tour_1way2italy_Search_EndPoint,

    // Destination product details
    Tour_1way2italy_Product_Details: process.env.Tour_1way2italy_Product_Details,
    Tour_1way2italy_Product_Details_EndPoint: process.env.Tour_1way2italy_Product_Details_EndPoint,

    // Product Availability for 1way2italy
    Tour_1way2italy_Product_Availability: process.env.Tour_1way2italy_Product_Availability,
    Tour_1way2italy_Product_Availability_EndPoint: process.env.Tour_1way2italy_Product_Availability_EndPoint,

    // 1way2italy booking confirm 
    Tour_1way2italy_Booking_Confirm: process.env.Tour_1way2italy_Booking_Confirm,
    Tour_1way2italy_Booking_Confirm_EndPoint: process.env.Tour_1way2italy_Booking_Confirm_EndPoint,

    // 1way2italy add booking to moonstride 
    Tour_1way2italy_Add_Booking: process.env.Tour_1way2italy_Add_Booking,
    Tour_1way2italy_Add_Booking_EndPoint: process.env.Tour_1way2italy_Add_Booking_EndPoint,

    // 1way2italy cancel booking
    Tour_1way2italy_cancel_Booking: process.env.Tour_1way2italy_cancel_Booking,
    Tour_1way2italy_cancel_Booking_EndPoint: process.env.Tour_1way2italy_cancel_Booking_EndPoint,

    // 1way2italy booing status endPoint
    Tour_1way2italy_Book_Status: process.env.Tour_1way2italy_Book_Status,
    Tour_1way2italy_Book_Status_EndPoint: process.env.Tour_1way2italy_Book_Status_EndPoint,

    // 1way2italy product price check
    Tour_1way2italy_Price_Check: process.env.Tour_1way2italy_Price_Check,
    Tour_1way2italy_Price_Check_EndPoint: process.env.Tour_1way2italy_Price_Check_EndPoint,

    // 1way2Italy save questions to moonstride
    Tour_1way2italy_Save_Booking: process.env.Tour_1way2italy_Save_Booking,
    Tour_1way2italy_Save_Booking_EndPoint:process.env.Tour_1way2italy_Save_Booking_EndPoint,

    // 1way2italy services
    OneWay2italy_search_url : "touractivityavail",
    OneWay2italy_details_url : "touractivitydescriptiveinfo",
    OneWay2italy_availability_url : "tourActivityavail",
    OneWay2italy_confirm_booking_url : "touractivityres",
    OneWay2italy_Booking_status_url : "resretrieve",
    OneWay2italy_cancel_booking_url : "cancelres",
    OneWay2italy_get_supplier_details_url : "readprofile",
    OneWay2italy_destination_caching_url : "readlocalities",

    //=============================== End of 1way2Italy ==========================================//

    // API logs
    Tour_Initialization_Logs: process.env.Tour_Initialization_Logs,
    Tour_Search_Logs: process.env.Tour_Search_Logs,
    Tour_Book_Logs: process.env.Tour_Book_Logs,
    Viator_Search_Logs: process.env.Viator_Search_Logs,
    Viator_Book_Logs: process.env.Viator_Book_Logs,
    
    // Globel provider codes
    Provider_Code_OWT: "OWT",
    Provider_Code_VTR: "VTR",
    // session secretKey
    // base64 encoded
    Session_Secret_Key:"dGhpc2lzbXlzZWNyY3Rla2V5ZmhyZ2ZncmZydHk4NGZ3aXI3Njc=",
    
    // viator api key error message 
    VTRApiKeyErrorMessage : "The user has not activated for Viator tour service, or there appears to be an issue with the configuration.",

    // 1way2italy api key error mesage
    OWTApiKeyErrorMessage : "The user has not activated for 1way2Italy tour service, or there appears to be an issue with the configuration.",

    // Add booking location object classification table 
    locationTypeCodes: [
      {
        locationtypevalue : 'Station',
        code : 'TRAIN'
      },
      {
        locationtypevalue : 'Port',
        code : 'PORT'
      },
      {
        locationtypevalue : 'Sub Area 3',
        code : 'SA3'
      },
      {
        locationtypevalue : 'Sub Area 2',
        code : 'SA2'
      },
      {
        locationtypevalue : 'Sub Area 1',
        code : 'SA1'
      },
      {
        locationtypevalue : 'City',
        code : 'CIT'
      },
      {
        locationtypevalue : 'State',
        code : 'MAS'
      },
      {
        locationtypevalue : 'Country',
        code : 'CON'
      }
    ],

    // tourengine endpoint url
    // search
    TOUR_SEARCH_VTR_ENDPOINT_URL : "/Tour/Viator/Search",
    TOUR_SEARCH_OWT_ENDPOINT_URL : "/Tour/1way2italy/Search",
    // Details
    TOUR_DETAILS_VTR_ENDPOINT_URL : "/Tour/Viator/ProductDetails",
    TOUR_DETAILS_OWT_ENDPOINT_URL : "/Tour/1way2italy/ProductDetails",
    // Availability
    TOUR_AVAILABILITY_VTR_ENDPOINT_URL : "/Tour/Viator/ProductAvailability",
    TOUR_AVAILABILITY_OWT_ENDPOINT_URL : "/Tour/1way2italy/ProductAvailability",
    // Destination Caching 
    TOUR_DESTINATION_CACHING_VTR_ENDPOINT_URL : "/Tour/Viator/DestinationCache",
    TOUR_DESTINATION_CACHING_OWT_ENDPOINT_URL : "/Tour/1way2italy/DestinationCache",
    // Location suggestion
    TOUR_SUGGESTION_VTR_ENDPOINT_URL : "/Tour/Viator/SearchSuggestion",
    TOUR_SUGGESTION_OWT_ENDPOINT_URL : "/Tour/1way2italy/SearchSuggestion",
    // Confirm booking 
    TOUR_CONFIRM_BOOKING_VTR_ENDPOINT_URL : "/Tour/Viator/Book",
    TOUR_CONFIRM_BOOKING_OWT_ENDPOINT_URL : "/Tour/1way2italy/Book",
    // Add booking 
    TOUR_ADD_BOOKING_VTR_ENDPOINT_URL : "/Tour/Viator/AddBooking",
    TOUR_ADD_BOOKING_OWT_ENDPOINT_URL : "/Tour/1way2italy/AddBooking",
    // Booking status
    TOUR_BOOKING_STATUS_VTR_ENDPOINT_URL : "/Tour/Viator/BookStatus",
    TOUR_BOOKING_STATUS_OWT_ENDPOINT_URL : "/Tour/1way2italy/BookStatus",
    // Booking Cancel quote
    TOUR_CANCEL_BOOKING_QUOTE_VTR_ENDPOINT_URL : "/Tour/Viator/bookingCancelReasons",
    TOUR_CANCEL_BOOKING_QUOTE_OWT_ENDPOINT_URL : "/Tour/1way2italy/bookingCancelReasons",
    // Booking cancel confirm
    TOUR_CANCEL_BOOKING_CONFIRM_VTR_ENDPOINT_URL : "/Tour/Viator/bookingConfirmCancel",
    TOUR_CANCEL_BOOKING_CONFIRM_OWT_ENDPOINT_URL : "/Tour/1way2italy/bookingConfirmCancel",
    // Price check
    TOUR_PRICE_CHECK_VTR_ENDPOINT_URL : "/Tour/Viator/PriceCheck",
    TOUR_PRICE_CHECK_OWT_ENDPOINT_URL : "/Tour/1way2italy/PriceCheck",
    // attractions viator
    TOUR_ATTRACTIONS_VTR_ENDPOINT_URL : "/Tour/Viator/Attractions",
    // save booking questions
    TOUR_SAVE_BOOKING_QUESTIONS_VTR_ENDPOINT_URL : "/Tour/Viator/SaveBookingQuestions",
    TOUR_SAVE_BOOKING_QUESTIONS_OWT_ENDPOINT_URL : "/Tour/1way2italy/SaveBookingQuestions",
    // Booking question caching
    TOUR_QUESTION_CACHING_VTR_ENDPOINT_URL : "/Tour/Viator/BookingQuestion",
    // Cancel reason caching 
    TOUR_CANCEL_REASON_CACHING_VTR_ENDPOINT_URL : "/Tour/Viator/CancelReasonCache",
    // save confirmed booking url moonstride
    saveConfirmBookingUrl : "/servicestatus",

    // logs folder structure constants
    //------------ tour.js --------------//
    // file path to log MSToken Response
    MSACCESSTOKEN_FILE_PATH : "/Routes/msAccessToken",
    // file path to log search api response
    SEARCH_PROVIDER_FILE_PATH : "/Routes/{{PROVIDER}}/Search",
    // file path to log product details api response 
    DETAILS_PROVIDER_FILE_PATH : "/Routes/{{PROVIDER}}/Details",
    // file path to log product availability api response
    AVAILABILITY_PROVIDER_FILE_PATH : "/Routes/{{PROVIDER}}/Availability",
    // file path to log destination caching api response
    DESTINATION_CACHING_PROVIDER_FILE_PATH : "/Routes/{{PROVIDER}}/Destination_Caching",
    // file path to log search suggestion api response
    SUGGESTION_PROVIDER_FILE_PATH : "/Routes/{{PROVIDER}}/Suggestion",
    // file path to log confirm booking api response 
    CONFIRM_BOOKING_PROVIDER_FILE_PATH : "/Routes/{{PROVIDER}}/Confirm_Booking",
    // file path to log add booking api resonse 
    ADD_BOOKING_PROVIDER_FILE_PATH : "/Routes/{{PROVIDER}}/Add_Booking",
    // file path to log booking status api response 
    BOOKING_STATUS_PROVIDER_FILE_PATH : "/Routes/{{PROVIDER}}/Booking_Status",
    // file path to log cancel booking api response 
    CANCEL_BOOKING_PROVIDER_FILE_PATH : "/Routes/{{PROVIDER}}/Cancel_Booking",
    // file path to log price check api response 
    PRICE_CHECK_PROVIDER_FILE_PATH : "/Routes/{{PROVIDER}}/Price_Check",
    // file path to log attraction api response 
    ATTRACTIONS_PROVIDER_FILE_PATH : "/Routes/{{PROVIDER}}/Attractions",
    // file path to log save booking quetions api reponse 
    SAVE_BOOKING_QUESTIONS_PROVIDER_FILE_PATH : "/Routes/{{PROVIDER}}/Save_Booking_Questions",
    // file path to log pickuplocations api response 
    PICKUP_LOCATIONS_PROVIDER_FILE_PATH : "/Routes/{{PROVIDER}}/Pickup_Locations",
    // file path to log booking questions caching api response 
    BOOKING_QUESTIONS_CACHING_PROVIDER_FILE_PATH : "Routes/{{PROVIDER}}/Booking_Question_Cache",
    // file path to log cancel reason api response
    CANCEL_REASON_CACHING_PROVIDER_FILE_PATH : "Routes/{{PROVIDER}}/Cancel_Reason_Cache",
    //-----------------------------------//

    //-------------------- service files -----------------//
    // file paths to log api response and error for search
    SERVICE_SEARCH_PROVIDER_SEARCH_FILE_PATH : "/Service/{{PROVIDER}}/Search/Errors",
    SERVICE_SEARCH_PROVIDER_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Search/Api_Response",
    // file paths to log api response and errors for product details
    SERVICE_DETAILS_PROVIDER_DETAILS_FILE_PATH : "/Service/{{PROVIDER}}/Details/Errors",
    SERVICE_DETAILS_PROVIDER_DETAILS_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Details/Details_Api_Response",
    SERVICE_DETAILS_PROVIDER_LOCATION_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Details/Location_Api_Response",
    SERVICE_DETAILS_PROVIDER_GOOGLE_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Details/Google_Api_Response",
    SERVICE_DETAILS_PROVIDER_SUPPLIER_DETAILS_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Details/SupplierDetails_Api_Response",
    SERVICE_DETAILS_PROVIDER_REVIEWS_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Details/Reviews_Api_Response",
    // file paths to log api response and errors for product availability
    SERVICE_AVAILABILITY_PROVIDER_AVAILABILITY_FILE_PATH : "/Service/{{PROVIDER}}/Availability/Errors",
    SERVICE_AVAILABILITY_PROVIDER_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Availability/Api_Response",
    // file paths to log api response and errors for Add booking
    SERVICE_ADD_BOOKING_PROVIDER_ADD_BOOKING_FILE_PATH : "/Service/{{PROVIDER}}/Add_Booking/Errors",
    // file paths to log api response and errors for confirm booking
    SERVICE_CONFIRM_BOOKING_PROVIDER_CONFIRM_BOOKING_FILE_PATH : "/Service/{{PROVIDER}}/ConfirmBooking/Errors",
    SERVICE_CONFIRM_BOOKING_PROVIDER_CONFIRM_BOOKING_HOLD_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/ConfirmBooking/ConfirmBooking_Hold_Api_Response",
    SERVICE_CONFIRM_BOOKING_PROVIDER_CONFIRM_BOOKING_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/ConfirmBooking/ConfirmBooking_Api_Response",
    // file paths to log api response and errors for attractions
    SERVICE_ATTRACTIONS_PROVIDER_ATTRACTIONS_FILE_PATH : "/Service/{{PROVIDER}}/Attraction/Errors",
    SERVICE_ATTRACTIONS_PROVIDER_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Attraction/Api_Response",
    // file paths to log api response and errors for booking Questions service
    SERVICE_BOOKING_QUESTIONS_PROVIDER_BOOKING_QUESTIONS_FILE_PATH : "/Service/{{PROVIDER}}/BookingQuestion/Errors",
    SERVICE_BOOKING_QUESTIONS_PROVIDER_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/BookingQuestion/Api_Response",
    // file paths to log api response and errors for booking status checking
    SERVICE_STATUS_CHECK_PROVIDER_STATUS_CHECK_FILE_PATH : "/Service/{{PROVIDER}}/Status_Check/Errors" ,
    SERVICE_STATUS_CHECK_PROVIDER_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Status_Check/Api_Response" ,
    // file paths to log  errors for breadcums service
    SERVICE_BREAD_CRUMS_PROVIDER_BREAD_CRUMS_FILE_PATH : "/Service/{{PROVIDER}}/BreadCrums/Errors",
    // file paths to log api response and errors for cancel booking service
    SERVICE_CANCEL_BOOKING_PROVIDER_CANCEL_BOOKING_FILE_PATH : "/Service/{{PROVIDER}}/CancelBooking/Errors",
    SERVICE_CANCEL_BOOKING_PROVIDER_CANCEL_QUOTE_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/CancelBooking/Cancel_Quote_Api_Response",
    SERVICE_CANCEL_BOOKING_PROVIDER_CANCEL_BOOKING_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/CancelBooking/Cancel_Booking_Api_Response",
    // file paths to log api response and errors for cancel reasons service
    SERVICE_CANCEL_REASONS_PROVIDER_CANCEL_REASONS_FILE_PATH : "/Service/{{PROVIDER}}/CancelReasons/Errors",
    SERVICE_CANCEL_REASONS_PROVIDER_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/CancelReasons/Api_Response",
    // file paths to log api response and errors for destination caching service
    SERVICE_DESTINATION_CACHING_PROVIDER_DESTINATION_CACHING_FILE_PATH : "/Service/{{PROVIDER}}/Destination_Caching/Errors",
    SERVICE_DESTINATION_CACHING_PROVIDER_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Destination_Caching/Api_Response",
    SERVICE_DESTINATION_CACHING_PROVIDER_SUPPLIER_CACHING_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Supplier_Caching/Api_Response",
    // file paths to log api response and errors for service pickup locations
    SERVICE_PICKUP_LOCATION_PROVIDER_PICKUP_LOCATION_FILE_PATH : "/Service/{{PROVIDER}}/PickupLocation/Errors",
    SERVICE_PICKUP_LOCATION_PROVIDER_GET_LOCATION_FROM_DETAILS_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/PickupLocation/GetLocationFromDetails_ApiResponse",
    SERVICE_PICKUP_LOCATION_PROVIDER_LOCATION_BULK_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/PickupLocation/LocationBulk_Api_Response",
    SERVICE_PICKUP_LOCATION_PROVIDER_GOOGLE_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/PickupLocation/Google_Api_Response",
    // file paths to log api response and errors for markup
    SERVICE_MARKUP_PROVIDER_MARKUP_FILE_PATH : "/Service/{{PROVIDER}}/Markup/Errors",
    SERVICE_MARKUP_PROVIDER_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Markup/Api_Response",
    // file paths to log api response and errors for price check service
    SERVICE_PRICE_CHECK_PROVIDER_PRICE_CHECK_FILE_PATH : "/Service/{{PROVIDER}}/Price_Check/Errors",
    SERVICE_PRICE_CHECK_PROVIDER_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Price_Check/Api_Response",
    // file paths to log api response and errors for sace questions
    SERVICE_SAVE_QUESTION_PROVIDER_SAVE_QUESTION_FILE_PATH : "/Service/{{PROVIDER}}/SaveQuestion/Errors",
    SERVICE_SAVE_QUESTION_PROVIDER_BOOKING_QUESTION_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/SaveQuestion/BookingQuestion_Api_Response",
    SERVICE_SAVE_QUESTION_PROVIDER_SAVE_QUESTION_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/SaveQuestion/SaveQuestion_Api_Response",
    // Save questions to moonstride
    SERVICE_SAVE_QUESTION_PROVIDER_SAVE_QUESTION_MOONSTRIDE_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/SaveQuestion_Moonstride/Api_Response",
    // file paths to log api response and errors for search suggestion service
    SERVICE_SEARCH_SUGGESTION_PROVIDER_SEARCH_SUGGESTION_FILE_PATH : "/Service/{{PROVIDER}}/Search_Suggestion/Errors", 
    // Tags paths to log api response and error
    SERVICE_SEARCH_TAGS_PROVIDER_TAGS_RESPONSE_FILE_PATH : "/Service/{{PROVIDER}}/Tags/Api_Response", 

    // confirm booking save to moonstride request format
    SaveConfirmBookingRequestObject : {
      "BookingComponentId":  "", // get from search logs
      "ServiceStatus": "", // provider response 
      "ConfirmationNumber": "", // provider confirmation ref number 
      "CancelConfirmationNumber": "", // set it empty for now
      "Note": "", // set it empty for now
      "Date": new Date() // booking date (current date)
    },


    // viator accept languages  
    languageOptions : {
      allPartners: [
        { language: 'English', acceptLanguage: ['en', 'en-US', 'en-AU', 'en-CA', 'en-GB', 'en-HK', 'en-IE', 'en-IN', 'en-MY', 'en-NZ', 'en-PH', 'en-SG', 'en-ZA'] },
        { language: 'Danish', acceptLanguage: ['da'] },
        { language: 'Dutch', acceptLanguage: ['nl', 'nl-BE'] },
        { language: 'Norwegian', acceptLanguage: ['no'] },
        { language: 'Spanish', acceptLanguage: ['es', 'es-AR', 'es-CL', 'es-CO', 'es-MX', 'es-PE', 'es-VE'] },
        { language: 'Swedish', acceptLanguage: ['sv'] },
        { language: 'French', acceptLanguage: ['fr', 'fr-BE', 'fr-CA', 'fr-CH'] },
        { language: 'Italian', acceptLanguage: ['it', 'it-CH'] },
        { language: 'German', acceptLanguage: ['de', 'de-DE'] },
        { language: 'Portuguese', acceptLanguage: ['pt', 'pt-BR'] },
        { language: 'Japanese', acceptLanguage: ['ja'] }
      ],
      merchantPartners: [
        { language: 'Chinese-traditional', acceptLanguage: ['zh-TW'] },
        { language: 'Chinese-simplified', acceptLanguage: ['zh-CN'] },
        { language: 'Korean', acceptLanguage: ['ko', 'ko-KR'] }
      ]
    },

    // viator country list for country codes.
    countryList : [
      {"iso2": "AF", "name": "Afghanistan", "shortName": "AFG"},
      {"iso2": "AL", "name": "Albania", "shortName": "ALB"},
      {"iso2": "DZ", "name": "Algeria", "shortName": "DZA"},
      {"iso2": "AD", "name": "Andorra", "shortName": "AND"},
      {"iso2": "AO", "name": "Angola", "shortName": "AGO"},
      {"iso2": "AI", "name": "Anguilla", "shortName": "AIA"},
      {"iso2": "AG", "name": "Antigua and Barbuda", "shortName": "ATG"},
      {"iso2": "AR", "name": "Argentina", "shortName": "ARG"},
      {"iso2": "AM", "name": "Armenia", "shortName": "ARM"},
      {"iso2": "AW", "name": "Aruba", "shortName": "ABW"},
      {"iso2": "AU", "name": "Australia", "shortName": "AUS"},
      {"iso2": "AT", "name": "Austria", "shortName": "AUT"},
      {"iso2": "AZ", "name": "Azerbaijan", "shortName": "AZE"},
      {"iso2": "BS", "name": "Bahamas", "shortName": "BHS"},
      {"iso2": "BH", "name": "Bahrain", "shortName": "BHR"},
      {"iso2": "BD", "name": "Bangladesh", "shortName": "BGD"},
      {"iso2": "BB", "name": "Barbados", "shortName": "BRB"},
      {"iso2": "BY", "name": "Belarus", "shortName": "BLR"},
      {"iso2": "BE", "name": "Belgium", "shortName": "BEL"},
      {"iso2": "BZ", "name": "Belize", "shortName": "BLZ"},
      {"iso2": "BJ", "name": "Benin", "shortName": "BEN"},
      {"iso2": "BM", "name": "Bermuda", "shortName": "BMU"},
      {"iso2": "BT", "name": "Bhutan", "shortName": "BTN"},
      {"iso2": "BO", "name": "Bolivia", "shortName": "BOL"},
      {"iso2": "BA", "name": "Bosnia and Herzegovina", "shortName": "BIH"},
      {"iso2": "BW", "name": "Botswana", "shortName": "BWA"},
      {"iso2": "BR", "name": "Brazil", "shortName": "BRA"},
      {"iso2": "BN", "name": "Brunei", "shortName": "BRN"},
      {"iso2": "BG", "name": "Bulgaria", "shortName": "BGR"},
      {"iso2": "BF", "name": "Burkina Faso", "shortName": "BFA"},
      {"iso2": "BI", "name": "Burundi", "shortName": "BDI"},
      {"iso2": "KH", "name": "Cambodia", "shortName": "KHM"},
      {"iso2": "CM", "name": "Cameroon", "shortName": "CMR"},
      {"iso2": "CA", "name": "Canada", "shortName": "CAN"},
      {"iso2": "CV", "name": "Cape Verde", "shortName": "CPV"},
      {"iso2": "KY", "name": "Cayman Islands", "shortName": "CYM"},
      {"iso2": "CF", "name": "Central African Republic", "shortName": "CAF"},
      {"iso2": "TD", "name": "Chad", "shortName": "TCD"},
      {"iso2": "CL", "name": "Chile", "shortName": "CHL"},
      {"iso2": "CN", "name": "China", "shortName": "CHN"},
      {"iso2": "CO", "name": "Colombia", "shortName": "COL"},
      {"iso2": "KM", "name": "Comoros", "shortName": "COM"},
      {"iso2": "CG", "name": "Congo", "shortName": "Democratic Republic of Congo"},
      {"iso2": "CR", "name": "Costa Rica", "shortName": "CRI"},
      {"iso2": "HR", "name": "Croatia", "shortName": "HRV"},
      {"iso2": "CU", "name": "Cuba", "shortName": "CUB"},
      {"iso2": "CY", "name": "Cyprus", "shortName": "CYP"},
      {"iso2": "CZ", "name": "Czech Republic", "shortName": "CZE"},
      {"iso2": "DK", "name": "Denmark", "shortName": "DNK"},
      {"iso2": "DJ", "name": "Djibouti", "shortName": "DJI"},
      {"iso2": "DM", "name": "Dominica", "shortName": "DMA"},
      {"iso2": "DO", "name": "Dominican Republic", "shortName": "DOM"},
      {"iso2": "EC", "name": "Ecuador", "shortName": "ECU"},
      {"iso2": "EG", "name": "Egypt", "shortName": "EGY"},
      {"iso2": "SV", "name": "El Salvador", "shortName": "SLV"},
      {"iso2": "GQ", "name": "Equatorial Guinea", "shortName": "GNQ"},
      {"iso2": "ER", "name": "Eritrea", "shortName": "ERI"},
      {"iso2": "EE", "name": "Estonia", "shortName": "EST"},
      {"iso2": "ET", "name": "Ethiopia", "shortName": "ETH"},
      {"iso2": "FK", "name": "Falkland Islands", "shortName": "FLK"},
      {"iso2": "FO", "name": "Faroe Islands", "shortName": "FRO"},
      {"iso2": "FJ", "name": "Fiji", "shortName": "FJI"},
      {"iso2": "FI", "name": "Finland", "shortName": "FIN"},
      {"iso2": "FR", "name": "France", "shortName": "FRA"},
      {"iso2": "GF", "name": "French Guiana", "shortName": "GUF"},
      {"iso2": "GA", "name": "Gabon", "shortName": "GAB"},
      {"iso2": "GM", "name": "Gambia", "shortName": "GMB"},
      {"iso2": "GE", "name": "Georgia", "shortName": "GEO"},
      {"iso2": "DE", "name": "Germany", "shortName": "DEU"},
      {"iso2": "GH", "name": "Ghana", "shortName": "GHA"},
      {"iso2": "GI", "name": "Gibraltar", "shortName": "GIB"},
      {"iso2": "GR", "name": "Greece", "shortName": "GRC"},
      {"iso2": "GL", "name": "Greenland", "shortName": "GRL"},
      {"iso2": "GD", "name": "Grenada", "shortName": "GRD"},
      {"iso2": "GP", "name": "Guadeloupe", "shortName": "GLP"},
      {"iso2": "GT", "name": "Guatemala", "shortName": "GTM"},
      {"iso2": "GN", "name": "Guinea", "shortName": "GIN"},
      {"iso2": "GW", "name": "Guinea-Bissau", "shortName": "GNB"},
      {"iso2": "GY", "name": "Guyana", "shortName": "GUY"},
      {"iso2": "HT", "name": "Haiti", "shortName": "HTI"},
      {"iso2": "HN", "name": "Honduras", "shortName": "HND"},
      {"iso2": "HK", "name": "Hong Kong", "shortName": "HKG"},
      {"iso2": "HU", "name": "Hungary", "shortName": "HUN"},
      {"iso2": "IS", "name": "Iceland", "shortName": "ISL"},
      {"iso2": "IN", "name": "India", "shortName": "IND"},
      {"iso2": "ID", "name": "Indonesia", "shortName": "IDN"},
      {"iso2": "IR", "name": "Iran", "shortName": "IRN"},
      {"iso2": "IQ", "name": "Iraq", "shortName": "IRQ"},
      {"iso2": "IE", "name": "Ireland", "shortName": "IRL"},
      {"iso2": "IL", "name": "Israel", "shortName": "ISR"},
      {"iso2": "IT", "name": "Italy", "shortName": "ITA"},
      {"iso2": "JM", "name": "Jamaica", "shortName": "JAM"},
      {"iso2": "JP", "name": "Japan", "shortName": "JPN"},
      {"iso2": "JO", "name": "Jordan", "shortName": "JOR"},
      {"iso2": "KZ", "name": "Kazakhstan", "shortName": "KAZ"},
      {"iso2": "KE", "name": "Kenya", "shortName": "KEN"},
      {"iso2": "KI", "name": "Kiribati", "shortName": "KIR"},
      {"iso2": "KW", "name": "Kuwait", "shortName": "KWT"},
      {"iso2": "KG", "name": "Kyrgyzstan", "shortName": "KGZ"},
      {"iso2": "LA", "name": "Laos", "shortName": "LAO"},
      {"iso2": "LV", "name": "Latvia", "shortName": "LVA"},
      {"iso2": "LB", "name": "Lebanon", "shortName": "LBN"},
      {"iso2": "LS", "name": "Lesotho", "shortName": "LSO"},
      {"iso2": "LR", "name": "Liberia", "shortName": "LBR"},
      {"iso2": "LY", "name": "Libya", "shortName": "LBY"},
      {"iso2": "LI", "name": "Liechtenstein", "shortName": "LIE"},
      {"iso2": "LT", "name": "Lithuania", "shortName": "LTU"},
      {"iso2": "LU", "name": "Luxembourg", "shortName": "LUX"},
      {"iso2": "MO", "name": "Macao", "shortName": "MAC"},
      {"iso2": "MK", "name": "North Macedonia", "shortName": "Macedonia"},
      {"iso2": "MG", "name": "Madagascar", "shortName": "MDG"},
      {"iso2": "MW", "name": "Malawi", "shortName": "MWI"},
      {"iso2": "MY", "name": "Malaysia", "shortName": "MYS"},
      {"iso2": "MV", "name": "Maldives", "shortName": "MDV"},
      {"iso2": "ML", "name": "Mali", "shortName": "MLI"},
      {"iso2": "MT", "name": "Malta", "shortName": "MLT"},
      {"iso2": "MH", "name": "Marshall Islands", "shortName": "MHL"},
      {"iso2": "MQ", "name": "Martinique", "shortName": "MTQ"},
      {"iso2": "MR", "name": "Mauritania", "shortName": "MRT"},
      {"iso2": "MU", "name": "Mauritius", "shortName": "MUS"},
      {"iso2": "MX", "name": "Mexico", "shortName": "MEX"},
      {"iso2": "FM", "name": "Micronesia", "shortName": "FSM"},
      {"iso2": "MD", "name": "Moldova", "shortName": "MDA"},
      {"iso2": "MC", "name": "Monaco", "shortName": "MCO"},
      {"iso2": "MN", "name": "Mongolia", "shortName": "MNG"},
      {"iso2": "ME", "name": "Montenegro", "shortName": "MNE"},
      {"iso2": "MS", "name": "Montserrat", "shortName": "MSR"},
      {"iso2": "MA", "name": "Morocco", "shortName": "MAR"},
      {"iso2": "MZ", "name": "Mozambique", "shortName": "MOZ"},
      {"iso2": "MM", "name": "Myanmar", "shortName": "MMR"},
      {"iso2": "NA", "name": "Namibia", "shortName": "NAM"},
      {"iso2": "NR", "name": "Nauru", "shortName": "NRU"},
      {"iso2": "NP", "name": "Nepal", "shortName": "NPL"},
      {"iso2": "NL", "name": "Netherlands", "shortName": "NLD"},
      {"iso2": "NC", "name": "New Caledonia", "shortName": "NCL"},
      {"iso2": "NZ", "name": "New Zealand", "shortName": "NZL"},
      {"iso2": "NI", "name": "Nicaragua", "shortName": "NIC"},
      {"iso2": "NE", "name": "Niger", "shortName": "NER"},
      {"iso2": "NG", "name": "Nigeria", "shortName": "NGA"},
      {"iso2": "NU", "name": "Niue", "shortName": "NIU"},
      {"iso2": "KP", "name": "North Korea", "shortName": "PRK"},
      {"iso2": "NO", "name": "Norway", "shortName": "NOR"},
      {"iso2": "OM", "name": "Oman", "shortName": "OMN"},
      {"iso2": "PK", "name": "Pakistan", "shortName": "PAK"},
      {"iso2": "PW", "name": "Palau", "shortName": "PLW"},
      {"iso2": "PS", "name": "Palestine", "shortName": "PSE"},
      {"iso2": "PA", "name": "Panama", "shortName": "PAN"},
      {"iso2": "PG", "name": "Papua New Guinea", "shortName": "PNG"},
      {"iso2": "PY", "name": "Paraguay", "shortName": "PRY"},
      {"iso2": "PE", "name": "Peru", "shortName": "PER"},
      {"iso2": "PH", "name": "Philippines", "shortName": "PHL"},
      {"iso2": "PL", "name": "Poland", "shortName": "POL"},
      {"iso2": "PT", "name": "Portugal", "shortName": "PRT"},
      {"iso2": "QA", "name": "Qatar", "shortName": "QAT"},
      {"iso2": "RE", "name": "Reunion", "shortName": "Réunion Island"},
      {"iso2": "RO", "name": "Romania", "shortName": "ROU"},
      {"iso2": "RU", "name": "Russia", "shortName": "RUS"},
      {"iso2": "RW", "name": "Rwanda", "shortName": "RWA"},
      {"iso2": "KN", "name": "Saint Kitts and Nevis", "shortName": "St Kitts and Nevis"},
      {"iso2": "LC", "name": "Saint Lucia", "shortName": "St Lucia"},
      {"iso2": "VC", "name": "Saint Vincent and the Grenadines", "shortName": "St Vincent and the Grenadines"},
      {"iso2": "WS", "name": "Samoa", "shortName": "WSM"},
      {"iso2": "SM", "name": "San Marino", "shortName": "SMR"},
      {"iso2": "ST", "name": "Sao Tome and Principe", "shortName": "São Tomé and Príncipe"},
      {"iso2": "SA", "name": "Saudi Arabia", "shortName": "SAU"},
      {"iso2": "SN", "name": "Senegal", "shortName": "SEN"},
      {"iso2": "RS", "name": "Serbia", "shortName": "SRB"},
      {"iso2": "SC", "name": "Seychelles", "shortName": "SYC"},
      {"iso2": "SL", "name": "Sierra Leone", "shortName": "SLE"},
      {"iso2": "SG", "name": "Singapore", "shortName": "SGP"},
      {"iso2": "SK", "name": "Slovakia", "shortName": "SVK"},
      {"iso2": "SI", "name": "Slovenia", "shortName": "SVN"},
      {"iso2": "SB", "name": "Solomon Islands", "shortName": "SLB"},
      {"iso2": "SO", "name": "Somalia", "shortName": "SOM"},
      {"iso2": "ZA", "name": "South Africa", "shortName": "ZAF"},
      {"iso2": "KR", "name": "South Korea", "shortName": "KOR"},
      {"iso2": "SS", "name": "South Sudan", "shortName": "SSD"},
      {"iso2": "ES", "name": "Spain", "shortName": "ESP"},
      {"iso2": "LK", "name": "Sri Lanka", "shortName": "LKA"},
      {"iso2": "SD", "name": "Sudan", "shortName": "SDN"},
      {"iso2": "SR", "name": "Suriname", "shortName": "SUR"},
      {"iso2": "SZ", "name": "Swaziland", "shortName": "Eswatini (Swaziland)"},
      {"iso2": "SE", "name": "Sweden", "shortName": "SWE"},
      {"iso2": "CH", "name": "Switzerland", "shortName": "CHE"},
      {"iso2": "SY", "name": "Syria", "shortName": "SYR"},
      {"iso2": "TW", "name": "Taiwan", "shortName": "TWN"},
      {"iso2": "TJ", "name": "Tajikistan", "shortName": "TJK"},
      {"iso2": "TZ", "name": "Tanzania", "shortName": "TZA"},
      {"iso2": "TH", "name": "Thailand", "shortName": "THA"},
      {"iso2": "TL", "name": "Timor-Leste", "shortName": "TLS"},
      {"iso2": "TG", "name": "Togo", "shortName": "TGO"},
      {"iso2": "TO", "name": "Tonga", "shortName": "TON"},
      {"iso2": "TT", "name": "Trinidad and Tobago", "shortName": "TTO"},
      {"iso2": "TN", "name": "Tunisia", "shortName": "TUN"},
      {"iso2": "TR", "name": "Turkey", "shortName": "TUR"},
      {"iso2": "TM", "name": "Turkmenistan", "shortName": "TKM"},
      {"iso2": "TC", "name": "Turks and Caicos Islands", "shortName": "Turks and Caicos"},
      {"iso2": "TV", "name": "Tuvalu", "shortName": "TUV"},
      {"iso2": "UG", "name": "Uganda", "shortName": "UGA"},
      {"iso2": "UA", "name": "Ukraine", "shortName": "UKR"},
      {"iso2": "AE", "name": "United Arab Emirates", "shortName": "ARE"},
      {"iso2": "GB", "name": "United Kingdom", "shortName": "GBR"},
      {"iso2": "US", "name": "United States", "shortName": "USA"},
      {"iso2": "UY", "name": "Uruguay", "shortName": "URY"},
      {"iso2": "UZ", "name": "Uzbekistan", "shortName": "UZB"},
      {"iso2": "VU", "name": "Vanuatu", "shortName": "VUT"},
      {"iso2": "VA", "name": "Vatican City", "shortName": "VAT"},
      {"iso2": "VE", "name": "Venezuela", "shortName": "VEN"},
      {"iso2": "VN", "name": "Vietnam", "shortName": "VNM"},
      {"iso2": "YE", "name": "Yemen", "shortName": "YEM"},
      {"iso2": "ZM", "name": "Zambia", "shortName": "ZMB"},
      {"iso2": "ZW", "name": "Zimbabwe", "shortName": "ZWE"},
      {"iso2": "CI", "name": "Côte d’Ivoire", "shortName": "CIV"},
      {"iso2": "TP", "name": "East Timor", "shortName": "TMP"},
      {"iso2": "XK", "name": "Kosovo", "shortName": "XKK"},
      {"iso2": "GU", "name": "Guam", "shortName": "GUM"},
      {"iso2": "CK", "name": "Cook Islands", "shortName": "COK"},
      {"iso2": "BQ", "name": "Bonaire", "shortName": "BES"},
      {"iso2": "BL", "name": "St Barthelemy", "shortName": "BLM"},
      {"iso2": "GB", "name": "Channel Islands", "shortName": "GBR"},
      {"iso2": "GB", "name": "Wales", "shortName": "GBR"},
      {"iso2": "YT", "name": "Mayotte", "shortName": "MYT"},
      {"iso2": "MP", "name": "Northern Mariana Islands", "shortName": "MNP"},
      {"iso2": "VG", "name": "British Virgin Islands", "shortName": "VGB"},
      {"iso2": "PF", "name": "French Polynesia", "shortName": "PYF"},
      {"iso2": "CW", "name": "Curacao", "shortName": "CUW"},
      {"iso2": "SX", "name": "St Maarten", "shortName": "SXM"},
      {"iso2": "VI", "name": "US Virgin Islands", "shortName": "VIR"},
      {"iso2": "GB", "name": "Northern Ireland", "shortName": "GBR"},
      {"iso2": "PR", "name": "Puerto Rico", "shortName": "PRI"},
      {"iso2": "GB", "name": "England", "shortName": "GBR"},
      {"iso2": "GB", "name": "Scotland", "shortName": "GBR"},
      {"iso2": "PS", "name": "Palestinian Territories", "shortName": "PSE"}      
    ],

}; 