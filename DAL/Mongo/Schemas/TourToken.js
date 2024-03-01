const mongoose = require('mongoose');
const TokenSchema = new mongoose.Schema({
	accessToken: {
		type: String,
		default: null
	},
	accessTokenExpiresAt: {
		type: Date,
		default: null
	},
	refreshToken: {
		type: String,
		default: null
	},
	refreshTokenExpiresAt: {
		type: Date,
		default: null
	},
	client: {
		type: { id: String },
		default: null
	},
	user: {
		type: JSON,
		default: null
	}
}, { collection: "Tour_Token" });
module.exports = mongoose.model('Tour_Token', TokenSchema);