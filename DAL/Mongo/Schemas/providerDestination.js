const mongoose = require('mongoose');

function tourProviderDestinationSchema(prefix) {
    return new mongoose.Schema(
        {}, 
        { collection: "Tour-" + prefix + "-Destination" });

};

let models = {};
function tourProvider(prefix) {
    const collectionName = "Tour-" + prefix + "-Destination";
    try {
        if (!(collectionName in models)) {
            models[collectionName] = mongoose.model(collectionName, tourProviderDestinationSchema(prefix));
        }
        return models[collectionName];
    } catch (error) {
        console.log(error);
    }
}

module.exports = tourProvider;