const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
	userid: {
		type: String,
		default: null
	},
	password: {
		type: String,
		default: null
	},
	id: {
		type: String,
		default: null
	}
}, { collection: "Tour_User" });
module.exports = mongoose.model('Tour_User', UserSchema);