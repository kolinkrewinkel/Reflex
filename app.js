/* 
 * Node Dependencies
 */

var fs = require('fs');
var http = require('http')

/* 
 * App
 */

var express = require('express');
var app = express();

var externalAccessUser = null;
var externalAccessToken = null;

server.use(express.basicAuth(function(username, password)
{
	return (username == externalAccessUser && password == externalAccessToken);
}));

var redis = require('redis');
var client = redis.createClient();

/* 
 * Broker API
 */

var bitstamp = require('bitstamp');
var bitstampClient = null;

/*
 * Miscellaneous Dependencies
 */

 var moment = require('moment');

/* 
 * Trading Implementation
 */

var activeBitcoinQuantity = 1;

var startingOrderRequired = true;
var orderRequired = false;
var pendingTransaction = false;

var recentTicker = null;
var entryPrice = null;
var lastPriceObserved = null;
var positiveVarianceThreshold = 0.015;
var reEntryThreshold = 0.0075;
var dropExitThreshold = 0.03333;
var profit = 0.00;

app.listen(1948);
init();

/*
 * External Fetching
 */

app.get('/overview', function(request, response)
{
	response.json({'sup': 'test'});
});

/*
 * Trading Implementation
 */

function init()
{
	var data = fs.readFileSync('./config.json');
	var config = null;

	try
	{
		config = JSON.parse(data);	
	}
	catch (err)
	{
		console.log('Configuration file could not be read. (' + err + ')');

		return;
	}

	if (config !== null)
	{
		console.log('Successfully read configuration file...');
	}

	externalAccessUser = config.access_user;
	externalAccessToken = config.access_token;

	client.select(356, function(error, result)
	{
		if (error)
		{
			console.log('Failed to select database. (' + error + ')')
			return;
		}

		intializeBitstampClient(config.api_key, config.secret, config.client_id);
	});
}

function intializeBitstampClient(key, secret, client_id)
{
	bitstampClient = new bitstamp(key, secret, client_id);

	console.log('Initialized client.');

	beginRefreshingWithInterval(2.00);
}

function beginRefreshingWithInterval(seconds)
{	
	console.log('Ticker started.')
	setInterval(function() {
		bitstampClient.ticker(tickerUpdated);
	}, seconds * 1000);
}

function tickerUpdated(error, ticker)
{
	if (error || ticker === undefined || ticker === null)
	{
		console.log("\nTicker update failed: (" + error + ")\nGot: " + ticker + "\n");
		return;
	}

	/*  Ticker Definition
	 *
	 *   last - last BTC price
	 *   high - last 24 hours price high
	 *    low - last 24 hours price low
	 * volume - last 24 hours volume
	 *    bid - highest buy order
	 *    ask - lowest sell order
	 *
	 */

	var lastPrice = ticker["last"];
	var recentHigh = ticker["high"];
	var recentLow = ticker["low"];
	var recentVolume = ticker["volume"];
	var askPrice = ticker["ask"];
	var bidPrice = ticker["bid"]

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
//	bitstampClient.buy(activeBitcoinQuantity, price, marketEntered);

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
