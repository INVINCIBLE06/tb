const mongoose = require('mongoose');
const ClientSchema = new mongoose.Schema({
	id: {
		type: String,
		default: null
	},
	clientId: {
		type: String,
		default: null
	},
	clientSecret: {
		type: String,
		default: null
	},
	grants: {
		type: Array,
		default: null
	},
	redirectUris: {
		type: Array,
		default: null
	}
}, { collection: "Tour_Client" });
module.exports = mongoose.model('Tour_Client', ClientSchema);