var MtGoxClient = require("mtgox-apiv2");
var client;

init();

function init()
{
	var fs = require('fs');

	var data = fs.readFileSync('./config.json'), config;

	try {
		config = JSON.parse(data);
		console.log('Successfully read configuration file...')
	}
	catch (err) {
		console.log('Configuration file could not be read.');
		console.log(err);

		return;
	}

	loadClientWithKeyAndSecret(config.api_key, config.secret);
}

function loadClientWithKeyAndSecret(key, secret)
{
	client = new MtGoxClient(key, secret);
	handleInitializedClient();

	console.log('Initialized client with key:' + key + ' and secret:' + secret);
}

function handleInitializedClient()
{
	client.ticker(function(err, json) {
	    if (err) { throw err; }
	    console.log("---------------Ticker:--------------");
	    console.log(json);
	});
}