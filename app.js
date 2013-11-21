var express = require('express');
var app = express();

var Bitstamp = require('bitstamp');
var bitstampClient = null;

// Finances 
var orderRequired = true;
var entryPrice = null;
var lastPriceObserved = null;
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

	console.log("Initialized client with key: " + key + " secret: " + secret + " client ID: " + client_id);

	beginRefreshingWithInterval(0.5);
}

function beginRefreshingWithInterval(seconds)
{	
	setInterval(function() {
		bitstampClient.ticker(tickerUpdated);
	}, seconds * 1000);
}

function tickerUpdated(error, results)
{
	var currentUSDValue = results["last"];

	if (entryPrice == null && orderRequired)
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
		console.log("     Entry: $" + entryPrice + "\n   Current: $" + currentUSDValue + "\n    Change: $" + change + "\nChange (%): " + (change/entryPrice) * 100 + "%\n");

		// if (currentUSDValue >= minimumPriceToSell)
		// {
		// 	sellAtMarket();
		// }
		// else if (currentUSDValue <= maximumPriceToBuy)
		// {
		// 	enterAtMarket();
		// }

		lastPriceObserved = currentUSDValue;
	}
}

function enterAtPrice(price)
{
	orderRequired = false;
	// bitstampClient.buy(1, price, marketEntered);

	marketEntered(null, {"price": price});
}

function marketEntered(error, result)
{
	entryPrice = result["price"];
	orderRequired = false;
}

function sellAtMarket()
{

}

app.listen(5001);
