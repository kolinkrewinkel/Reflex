var express = require('express');
var app = express();

var MtGoxRESTClient = require('mtgox-apiv2');
var MtGoxStreaming = require('node-mtgox-client-streaming');
var restClient;
var streamingClient;

app.listen(5001);

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
	restClient = new MtGoxRESTClient(key, secret);
	streamingClient = new MtGoxStreaming.MtGox(key, secret);

	handleInitializedClient();

	console.log('Initialized client with key:' + key + ' and secret:' + secret);
}

function handleInitializedClient()
{
	// restClient.ticker(function(err, json) {
	//     if (err) { throw err; }
	//     console.log("---------------Ticker:--------------");
	//     console.log(json);
	// });
	// streamingClient.subscribe('ticker');

	// streamingClient.onMessage(function(data) {
	// 	console.log("Message: " + data);
	// });

	// streamingClient.authEmit({
	// 	call: 'private/info'
	// });
	
	console.log(streamingClient);
}

