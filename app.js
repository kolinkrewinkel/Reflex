var fs = require('fs');

var express = require('express');
var app = express();

var Bitstamp = require('bitstamp');
var bitstampClient = null;

// Finances 
var startingOrderRequired = true;
var orderRequired = false;
var entryPrice = null;
var lastPriceObserved = null;
var positiveVarianceThreshold = 0.015;
var reEntryThreshold = 0.0075;
var dropExitThreshold = 0.075;

app.listen(5001);
init();

function init()
{

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
		console.log("Ticker update failed: " + error);
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
		var maximumPriceToBuy = entryPrice * (1.00 - reEntryThreshold);
		var dropExitThreshold = 0.075;

		var change = currentUSDValue - entryPrice;

		if (!orderRequired)
		{
			console.log("     Entry: $" + entryPrice + "\n   Current: $" + currentUSDValue + "\n    Change: $" + change + "\nChange (%): " + (change/entryPrice) * 100 + "%\n");
		}

		var demandVariance = 0.01;

		if (currentUSDValue >= minimumPriceToSell && !orderRequired)
		{
			sellAtPrice(currentUSDValue * (1.00 + demandVariance));
		}
		else if (currentUSDValue <= maximumPriceToBuy && orderRequired)
		{
			enterAtPrice(currentUSDValue * (1.00 - demandVariance));
		}
		else if (currentUSDValue <= entryPrice * (1.00 - dropExitThreshold))
		{
			sellAtPrice(currentUSDValue * (1.00 + demandVariance));
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

	console.log("\n<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nEntered at price: " + entryPrice + "\n<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n");	               
}

function sellAtPrice(price)
{
	if (price >= entryPrice)
	{
		console.log("\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\nSold at price: " + price + " @ profit of " + (price - entryPrice) + "(" + (((price - entryPrice)/entryPrice) * 100) + "%)\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n");
	}
	else
	{
		console.log("\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\nSold at price: " + price + " @ loss of " + (price - entryPrice) + "(" + (((price - entryPrice)/entryPrice) * 100) + "%)\nRe-entering at " + (price * (1.00 - reEntryThreshold)) + "\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n");
	}

	orderRequired = true;
	entryPrice = price;
}
