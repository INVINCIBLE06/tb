let clientSchema = require('../../DAL/Mongo/Schemas/TourClient');
let tokenSchema = require('../../DAL/Mongo/Schemas/TourToken');
let userSchema = require('../../DAL/Mongo/Schemas/TourUser');

/*
 * Methods used by all grant types.
 */

function getAccessToken(token) {
	try {
		const Token = tokenSchema.findOne({accessToken: token}).lean().exec();

		if (!Token) {
			console.log('Token not found');
		}
		return Token
	} catch (err) {
		console.log(err);
	}
};

async function getClient(clientId, clientSecret) {
	try {
		const client = await clientSchema.findOne({clientId, clientSecret}).lean().exec()
		if (!client) {
			console.error('Client not found');
		}
		return client
	} catch (err) {
		console.log(err);
	}
};

async function saveToken(token, client, user) {
	try {
		token.client = {
			id: client.clientId
		};

		token.user = {
			userid: user.userid,
			id: user.id
		};

		const tokenInstance = new tokenSchema(token);
		let responseToken = await tokenInstance.save()

		if (!responseToken) {
			console.error('Token not saved');
		} else {
			responseToken = responseToken.toObject();
			delete responseToken._id;
			delete responseToken.__v;
		}
		return token
	} catch (err) {
		console.log(err);
	}
};

/*
 * Method used only by password grant type.
 */

async function getUser(userid, password) {
	try {
		const user = await userSchema.findOne({userid, password}).lean().exec()

		if (!user) {
			console.error('User not found');
		}
		return user
	} catch (err) {
		console.log(err);
	}
};

/*
 * Method used only by client_credentials grant type.
 */

async function getUserFromClient(client) {
	try {

		const responseClient = await clientSchema.findOne({clientId: client.clientId, clientSecret: client.clientSecret,grants: 'client_credentials'}).lean().exec();
		if (!responseClient) {
			console.error('Client not found');
		}
		return responseClient
		
	} catch (err) {
		console.log(err);
	}
};

/*
 * Methods used only by refresh_token grant type.
 */

async function getRefreshToken(refreshTokens) {
	try {
		const token = await tokenSchema.findOne({ "refreshToken" : refreshTokens}).lean().exec()
		if (!token) {
			console.error('Token not found');
		}

		return token;
	} catch (err) {
		console.log(err);
	}
};

async function revokeToken(token) {
	try {

		const results = await tokenSchema.deleteOne({ refreshToken: token.refreshToken}).exec()
		const deleteSuccess = results && results.deletedCount === 1;
		if (!deleteSuccess) {
			console.error('Token not deleted');
		}
		return deleteSuccess
	} catch (err) {
		console.log(err);
	}
};

/**
 * Export model definition object.
 */

module.exports = {
	getAccessToken: getAccessToken,
	getClient: getClient,
	saveToken: saveToken,
	getUser: getUser,
	getUserFromClient: getUserFromClient,
	getRefreshToken: getRefreshToken,
	revokeToken: revokeToken
};