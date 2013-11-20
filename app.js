var MtGoxClient = require("./mtgox");
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

	client = new MtGoxClient(config.api_key, config.secret);

	console.log('Initialized client with key:' + config.api_key + ' and secret:' + config.secret);
}