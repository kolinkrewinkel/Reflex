var express = require('express');
var app = express();

var Bitstamp = require('bitstamp');
var bitstampClient = null;

// Finances 
var startingOrderRequired = true;
var orderRequired = false;
var entryPrice = null;
var lastPriceObserved = null;
var positiveVarianceThreshold = 0.0125;
var negativeVarianceThreshold = 0.005;


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

	console.log("Initialized client with key: " + key + " secret: " + secret + " client ID: " + client_id);

	beginRefreshingWithInterval(1.5);
}

function beginRefreshingWithInterval(seconds)
{	
	setInterval(function() {
		bitstampClient.ticker(tickerUpdated);
	}, seconds * 1000);
}

function tickerUpdated(error, results)
{
	if (error || results === undefined)
	{
		console.log("Ticker update failed.");
		return;
	}

	var currentUSDValue = results["last"];

	if (entryPrice == null && startingOrderRequired)
	{
		enterAtPrice(currentUSDValue);
	}
	else if (entryPrice != null)
	{
		if (lastPriceObserved != null)
		{
			if (currentUSDValue === lastPriceObserved)
			{
				return;
			}
		}

		var minimumPriceToSell = entryPrice * (1.00 + positiveVarianceThreshold);
		var maximumPriceToBuy = entryPrice * (1.00 - negativeVarianceThreshold);

		var change = currentUSDValue - entryPrice;

		if (!orderRequired)
		{
			console.log("     Entry: $" + entryPrice + "\n   Current: $" + currentUSDValue + "\n    Change: $" + change + "\nChange (%): " + (change/entryPrice) * 100 + "%\n");
		}

		if (currentUSDValue >= minimumPriceToSell && !orderRequired)
		{
			sellAtPrice(currentUSDValue);
		}
		else if (currentUSDValue <= maximumPriceToBuy && orderRequired)
		{
			enterAtPrice(currentUSDValue);
		}

		lastPriceObserved = currentUSDValue;
	}
}

function enterAtPrice(price)
{
	startingOrderRequired = false;
	orderRequired = false;
	// bitstampClient.buy(1, price, marketEntered);

	marketEntered(null, {"price": price});
}

function marketEntered(error, result)
{
	entryPrice = result["price"];
	startingOrderRequired = false;

	console.log("\n<<<<<<<<<<<<<<<<<<\nEntered at price: " + entryPrice + "\n<<<<<<<<<<<<<<<<<<\n");
}

function sellAtPrice(price)
{
	console.log("\n>>>>>>>>>>>>>>>>>>\nSold at price: " + price + " @ profit of " + (price - entryPrice) + " with gain of " + (((price - entryPrice)/entryPrice) * 100) + "%\n>>>>>>>>>>>>>>>>>>\n");

	orderRequired = true;
	entryPrice = price;
}

app.listen(5001);
