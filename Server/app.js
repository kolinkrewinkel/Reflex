/* 
 * Node Dependencies
 */

var fs = require('fs');
var http = require('http')

/* 
 * App
 */

var express = require('express');

var externalAccessUser = null;
var externalAccessToken = null;

// var hskey = fs.readFileSync('./ssl/server.key');
// var hscert = fs.readFileSync('./ssl/server.crt');

var options = {
	// key: hskey,
	// cert: hscert
};

var app = express(options);

// app.use(express.basicAuth(function(username, password)
// {
// 	return (username === externalAccessUser && password === externalAccessToken);
// }));

var redis = require('redis');
var client = redis.createClient();
var config = null;
var apns = require('apn');

/* 
 * Broker API
 */

var btce = require('btce');
var btceClient = null;

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
var positiveVarianceThreshold = 0.0065;
var reEntryThreshold = 0.0075;
var dropExitThreshold = 0.025;
var profit = 0.00;
var commissionRate = 0.002;

var saleInProgress = false;
var buyInProgress = false;

app.listen(8970);
init();

/*
 * External Fetching
 */

app.get('/reflex/', function(request, response)
{
	response.redirect('http://kolinkrewinkel.com/');
});

app.get('/reflex/overview', function(request, response)
{
	response.json({'profit': profit, 'ticker': recentTicker, 'recent_entry': entryPrice, 'bitcoin_count': activeBitcoinQuantity});
	response.end();
});

app.post('/reflex/register', function(request, response)
{
	var deviceToken = request.body.registration.device_token;
	
	response.writeHead(201, {'Content-Type': 'application/json'});
	response.end();

	client.rpush("device_ids", deviceToken);
});

/*
 * Trading Implementation
 */

function init()
{
	var data = fs.readFileSync('./config.json');

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

	client.select(config.redis_id, function(error, result)
	{
		if (error)
		{
			console.log('Failed to select database. (' + error + ')')
			return;
		}

		client.get("profit", function(err, reply) {
			if (reply == null || isNaN(reply) || reply == false || reply < 0)
			{
				client.set("profit", 0);
				console.log("Setting profit to 0 (NaN or nonexistant.)");

				return;
			}

			storedProfit = reply;
		    profit += storedProfit;
			console.log("Previous profit was " + storedProfit);
		});
		
		// initializeClient(config.api_key, config.secret);
	});

	var apnsOptions = {
		cert: config.certificate_file_path,			/* Certificate file path */
		key:  config.key_file_path,					/* Key file path */
		passphrase: config.key_passphrase,  	 	/* A passphrase for the Key file */
		gateway: 'gateway.sandbox.push.apple.com',	/* gateway address */
		port: 2195,                       			/* gateway port */
		enhanced: true,                   			/* enable enhanced format */
	 // errorCallback: pushError,         			/* Callback when error occurs function(err,notification) */
		cacheLength: 10                  			/* Number of notifications to cache for error purposes */
	};

	var apnsConnection = new apns.Connection(apnsOptions);

	var expiration = Math.floor(Date.now() / 1000) + 3600;
	client.hgetall("device_ids" , function(err, identifier) {
		var device = new apn.Device(token);
		
		var notification = new apn.Notification();

		notification.expiry = expiration; // Expires 1 hour from now.
		notification.alert = "Testing!";

		apnConnection.pushNotification(notification, device);
	});
}

function initializeClient(key, secret)
{
	btceClient = new btce(key, secret);

	console.log('Initialized client.');

	beginRefreshingWithInterval(1.00);
}

function beginRefreshingWithInterval(seconds)
{	
	console.log('Ticker started.')
	setInterval(function() {
		btceClient.ticker({ pair: 'btc_usd' }, tickerUpdated);
	}, seconds * 1000);
}

function tickerUpdated(error, data)
{
	if (error || data === undefined || data === null)
	{
		console.log("\nTicker update failed: (" + error + ")\nGot: " + data + "\n");
		return;
	}

	/*  Ticker Definition
	 *
	 *   last - last BTC price
	 *   high - last 24 hours price high
	 *    low - last 24 hours price low
	 * volume - last 24 hours volume
	 *   sell - lowest sell order
	 *    buy - highest buy order
	 *
	 */

	var ticker = data['ticker'];
	recentTicker = ticker;

	var lastPrice = ticker['last'];
	var recentHigh = ticker['high'];
	var recentLow = ticker['low'];
	var recentVolume = ticker['volume'];
	var sellPrice = ticker['sell'];
	var buyPrice = ticker['buy']

	if (entryPrice == null && startingOrderRequired)
	{
		enterAtPrice(lastPrice); // Place the initial order.
	}
	else if (entryPrice != null)
	{
		if (lastPriceObserved != null)
		{
			if (lastPrice === lastPriceObserved)
			{
				return; // No change noted.
			}
		}

		var minimumPriceToSell = entryPrice * (1.00 + positiveVarianceThreshold);
		var maximumPriceToBuy = entryPrice * (1.00 - reEntryThreshold);		

		var change = lastPrice - entryPrice;

		if (!orderRequired)
		{
			console.log("     Entry: $" + entryPrice + "\n   Current: $" + buyPrice + "\n    Change: $" + change + "\nChange (%): " + (change/entryPrice) * 100 + "%\n");
		}

		if (buyPrice >= minimumPriceToSell && !orderRequired)
		{
			sellAtPrice(buyPrice);
		}
		else if (sellPrice <= maximumPriceToBuy && orderRequired)
		{
			enterAtPrice(sellPrice + 0.01);
		}
		else if (buyPrice <= entryPrice * (1.00 - dropExitThreshold))
		{
			sellAtPrice(buyPrice - 0.01);
		}
		else if (buyPrice >= entryPrice * (1.00 + positiveVarianceThreshold))
		{
			console.log("Run is occurring; re-basing entry price to " + buyPrice + ".");

			entryPrice = buyPrice;
		}

		lastPriceObserved = lastPrice;
	}
}

function enterAtPrice(price)
{	
	if (config.live)
	{
		btceClient.trade({'pair': 'btc_usd', 'type': 'buy', 'rate': price, 'amount': activeBitcoinQuantity}, function(err, data)
		{
			if (err || data == null)
			{
				console.log(err);
				return;
			}

			var response = data['return'];
			var orderID = resposne['order_id'];

			if (orderID === 0)
			{
				boughtSuccessfully(price);
			}
			else
			{
				btceClient.cancelOrder(orderID, function(err, data)
				{
					if (err)
					{
						console.log(err);
						return;
					}
				});
			}
		});
	}
	else
	{
		boughtSuccessfully(price);
	}
}

function boughtSuccessfully(price)
{
	startingOrderRequired = false;
	orderRequired = false;
	buyInProgress = false;
	
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
	if (config.live)
	{
		btceClient.trade({'pair': 'btc_usd', 'type': 'sell', 'rate': price, 'amount': activeBitcoinQuantity}, function(err, data) {
					if (err || data == null)
					{
						console.log(err);
						return;
					}

					var response = data['return'];
					var orderID = resposne['order_id'];

					if (orderID === 0)
					{
						soldSuccessfully(price);
					}
					else
					{
						btceClient.cancelOrder(orderID, function(err, data)
						{
							if (err)
							{
								console.log(err);
								return;
							}
						});
					}
			});
	}
	else
	{
		soldSuccessfully(price);
	}
}

function soldSuccessfully(price)
{
	if (price >= entryPrice)
	{
		console.log("\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\nSold at price: " + price + " @ profit of " + (price - entryPrice) + "(" + (((price - entryPrice)/entryPrice) * 100) + "%)\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n");
	}
	else
	{
		console.log("\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\nSold at price: " + price + " @ loss of " + (price - entryPrice) + "(" + (((price - entryPrice)/entryPrice) * 100) + "%)\nRe-entering at " + (price * (1.00 - reEntryThreshold)) + "\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n");
	}

	profit += ((price - entryPrice) * activeBitcoinQuantity);

	orderRequired = true;
	entryPrice = price;
	saleInProgress = true;

	commissionedEventOccurred(price);
}

function commissionedEventOccurred(price)
{
	profit -= ((price * commissionRate) * activeBitcoinQuantity);

	client.set("profit", profit);

	console.log("\n===================\nTotal Profit: $" + profit + "\n===================\n")
}

function adjustPrice(amount, positive, includeCommission)
{

}
