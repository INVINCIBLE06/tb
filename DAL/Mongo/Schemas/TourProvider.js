const mongoose = require('mongoose');

function tourProviderSchema(prefix) {
    return new mongoose.Schema({
        appid: {
            type: String,
            default: null
        },
        Viator: {
            type: Object,
            default: null
        },
        OneWay2Italy : {
            type: Object,
            default: null
        },
        MoonstrideConfiguration : {
            type: Object,
            default: null
        },
        createdatetime: {
            type: Date,
            default: Date.now()
        },
        modifydatetime: {
            type: Date,
            default: null
        }
    }, { collection: "Tour-" + prefix + "-Provider" });

};

let models = {};
function tourProvider(prefix) {
    const collectionName = "Tour-" + prefix + "-Provider";
    try {
        if (!(collectionName in models)) {
            models[collectionName] = mongoose.model(collectionName, tourProviderSchema(prefix));
        }
        return models[collectionName];
    } catch (error) {
        console.log(error);
    }
}

module.exports = tourProvider;