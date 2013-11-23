var fs = require('fs');

var express = require('express');
var app = express();

var Bitstamp = require('bitstamp');
var bitstampClient = null;

// Finances 
var bitcoinQuantity = 1;

var startingOrderRequired = true;
var orderRequired = false;
var pendingTransaction = false;

var entryPrice = null;
var lastPriceObserved = null;
var positiveVarianceThreshold = 0.015;
var reEntryThreshold = 0.0075;
var dropExitThreshold = 0.03333;
var profit = 0.00;

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

	/* Ticker Definition
	 *
	 * last - last BTC price
	 * high - last 24 hours price high
	 * low - last 24 hours price low
	 * volume - last 24 hours volume
	 * bid - highest buy order
	 * ask - lowest sell order
	 *
	 */

	var lastPrice = results["last"];
	var recentHigh = results["high"];
	var recentLow = results["low"];
	var recentVolume = results["volume"];
	var askPrice = results["ask"];
	var bidPrice = results[""]

	if (entryPrice == null && startingOrderRequired)
	{
		enterAtPrice(lastTradePrice);
	}
	else if (entryPrice != null)
	{
		if (lastPriceObserved != null)
		{
			if (lastTradePrice === lastPriceObserved)
			{
				return;
			}
		}

		var minimumPriceToSell = entryPrice * (1.00 + positiveVarianceThreshold);
		var maximumPriceToBuy = entryPrice * (1.00 - reEntryThreshold);		

		var change = lastTradePrice - entryPrice;

		if (!orderRequired)
		{
			console.log("     Entry: $" + entryPrice + "\n   Current: $" + lastTradePrice + "\n    Change: $" + change + "\nChange (%): " + (change/entryPrice) * 100 + "%\n");
		}

		var demandVariance = 0.0025;

		if (lastTradePrice >= minimumPriceToSell && !orderRequired)
		{
			sellAtPrice(lastTradePrice * (1.00 + demandVariance));
		}
		else if (lastTradePrice <= maximumPriceToBuy && orderRequired)
		{
			enterAtPrice(lastTradePrice * 1.00);
		}
		else if (lastTradePrice <= entryPrice * (1.00 - dropExitThreshold))
		{
			sellAtPrice(lastTradePrice * (1.00 + demandVariance));
		}

		lastPriceObserved = lastTradePrice;
	}
}

function enterAtPrice(price)
{	
	startingOrderRequired = false;
	orderRequired = false;
//	bitstampClient.buy(bitcoinQuantity, price, marketEntered);

	marketEntered(null, {"price": price});

	commissionedEventOccurred(price);
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

	profit += price - entryPrice;

	orderRequired = true;
	entryPrice = price;

	commissionedEventOccurred(price);
}

function commissionedEventOccurred(price)
{
	profit -= price * 0.005;

	console.log("\n===================\nTotal Profit: $" + profit + "\n===================\n")
}
