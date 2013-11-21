var express = require('express');
var app = express();

var Bitstamp = require('bitstamp');
var bitstampClient = UNDEFINED;

// Finances 
var entryPrice = UNDEFINED;
var positiveVarianceThreshold = 0.05;
var negativeVarianceThreshold = 0.05;


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

	intializeBitstampClient(config.api_key, config.secret, config.client_id);
}

function intializeBitstampClient(key, secret, client_id)
{
	bitstampClient = new Bitstamp(key, secret, client_id);
	enterAtMarket();
}

function beginRefreshingWithInterval(seconds)
{	
	setInterval(function() {
		bitstampClient.ticker(tickerUpdated);
	}, seconds * 1000);
}

function tickerUpdated(results)
{
	var currentUSDValue = results;
	var minimumPriceToSell = entryPrice * (1.00 + positiveVarianceThreshold);
	var maximumPriceToBuy = entryPrice * (1.00 - negativeVarianceThreshold);

	if (currentUSDValue >= minimumPriceToSell)
	{
		sellAtMarket();
	}
	else if (currentUSDValue <= maximumPriceToBuy)
	{
		enterAtMarket();shit
	}
}

function enterAtMarket()
{
	bitstampClient.buy(1, null, marketEntered);
}

function marketEntered(result)
{
	entryPrice = result;

	beginRefreshingWithInterval(0.5);
}

app.listen(5001);
