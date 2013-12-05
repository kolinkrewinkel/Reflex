/*
 * Shell
 */

var args = process.argv.splice(2);

var shouldReset = false;

for (var idx = 0, len = args.length; idx < len; idx++)
{
	var arg = args[idx];

	if (arg === '--clear')
	{
		shouldReset = true;
	}
}

/* 
 * Node Dependencies
 */

var fs = require('fs');
var http = require('http')

/* 
 * App
 */

var express = require('express');
var redis = require('redis');
var apns = require('apn');

var options = {};
var app = express(options);
app.use(express.bodyParser());

var config = null;

var client = redis.createClient();

var apnsConnection = null;

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

var activeBitcoinQuantity = 0.4;
var replacementBitcoinQuantity = null;

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
var lastProfitNotified = profit;
var commissionRate = 0.002;

var saleInProgress = false;
var buyInProgress = false;

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
	var deviceToken = request.body.device_token;
	
	response.writeHead(201, {'Content-Type': 'application/json'});
	response.end();

	console.log('Device registered with ID: ' + deviceToken);

	client.sadd("device_ids", deviceToken);
});

app.post('/reflex/volume', function(request, response)
{
	replacementBitcoinQuantity = request.body.bitcoin_quantity;

	response.writeHead(201, {'Content-Type': 'application/json'});
	response.end();

	console.log('Set replacement Bitcoin quantity to ' + replacementBitcoinQuantity + '.');

	sendNotificationWithText('Staged Bitcoin volume change to ' + replacementBitcoinQuantity + '.');
});

/*
 * Push Notifications
 */

function sendNotificationWithText(text)
{
	client.smembers("device_ids", 0, -1, function(err, identifiers)
	{
		if (err || identifiers == null)
		{
			return;
		}

		var expiration = Math.floor(Date.now() / 1000) + 3600;

		for (var idx = 0, len = identifiers.length; idx < len; idx++)
		{
			var identifier = identifiers[idx];

			if (err || identifier == null)
			{
				return;
			}

			var device = new apns.Device(identifier);
			
			var notification = new apns.Notification();
			notification.expiry = expiration; // Expires 1 hour from now.
			notification.alert = text;

			apnsConnection.pushNotification(notification, device);
		}
	});
}

/*
 * Trading Implementation
 */

function init()
{
	loadConfig();

	client.select(config.redis_id, function(error, result)
	{
		if (error)
		{
			console.log('Failed to select database. (' + error + ')')
			return;
		}

		client.get('first_entry', function(error, result)
		{
			firstEntry = result;
		});

		client.get('active_bitcoin_quantity', function(err, reply)
		{
			if (err || reply == null)
			{
				return;
			}

			activeBitcoinQuantity = reply;
		});

		client.get('profit', function(err, reply)
		{
			if (reply == null || isNaN(reply) || reply == false || reply < 0 || shouldReset)
			{
				client.del('profit', 'active_bitcoin_quantity', 'first_entry', 'device_ids');
								
				var reason = shouldReset ? '(Instructed to reset profit.)' : '(NaN or nonexistant.)';
				console.log('Clearing profit. ' + reason);

				if (shouldReset)
				{
					process.exit(code=0);
				}
			}

			storedProfit = reply;
		    profit += storedProfit;
		    lastProfitNotified = profit;

			console.log('Restoring profit to $' + profit + ' from disk.');
		});
		
		if (!shouldReset)
		{
			initializeClient(config.api_key, config.secret);
		}
	});

	var apnsOptions = {
		cert: config.certificate_file_path,			/* Certificate file path */
		key:  config.key_file_path,					/* Key file path */
		passphrase: config.key_passphrase,  	 	/* A passphrase for the Key file */
		gateway: 'gateway.sandbox.push.apple.com',	/* gateway address */
		port: 2195,                       			/* gateway port */
		enhanced: true,                   			/* enable enhanced format */
		cacheLength: 5                  			/* Number of notifications to cache for error purposes */
	};

	if (!shouldReset)
	{
		apnsConnection = new apns.Connection(apnsOptions);
		sendNotificationWithText('Node app initialized…');

		app.listen(config.port_number);
	}
}

function loadConfig()
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
	var buyPrice = ticker['buy'];

	var likelyPriceToBuy = sellPrice + 0.50;
	var likelyPriceToSell = buyPrice - 0.50;

	if (entryPrice == null && startingOrderRequired)
	{
		console.log('Placing initial order...');
		sendNotificationWithText('Placing initial order…')

		enterAtPrice(likelyPriceToBuy); // Place the initial order.
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

		if (likelyPriceToBuy >= minimumPriceToSell && !orderRequired)
		{
			sellAtPrice(likelyPriceToSell);
		}
		else if (likelyPriceToSell <= maximumPriceToBuy && orderRequired)
		{
			enterAtPrice(likelyPriceToBuy);
		}
		else if (likelyPriceToBuy <= entryPrice * (1.00 - dropExitThreshold))
		{
			sellAtPrice(likelyPriceToSell);
		}
		else if (likelyPriceToBuy >= entryPrice * (1.00 + positiveVarianceThreshold))
		{
			console.log("Run is occurring; re-basing entry price to " + likelyPriceToBuy + ".");
			sendNotificationWithText('Run may be occurring. Entry price is being reset.');

			entryPrice = buyPrice;
		}

		lastPriceObserved = lastPrice;
	}
}

function enterAtPrice(price)
{
	if (replacementBitcoinQuantity != null)
	{
		setActiveBitcoinQuantity(replacementBitcoinQuantity);
		replacementBitcoinQuantity = null;
	}

	if (config.live)
	{
		console.log('Buying...');

		btceClient.trade({'pair': 'btc_usd', 'type': 'buy', 'rate': price, 'amount': activeBitcoinQuantity}, function(err, data)
		{
			if (err || data == null)
			{
				console.log(err);
				return;
			}
			else if (data['success'] === 0)
			{
				console.log('Error trading: ' + data['error']);
				return;
			}

			console.log(data);

			var response = data['return'];
			var orderID = response['order_id'];

			if (response['received'] >= (0.5 * activeBitcoinQuantity) || orderID === 0)
			{
				boughtSuccessfully(price);
			}
			else
			{
				console.log('Cancelling...');

				btceClient.cancelOrder(orderID, function(err, data)
				{
					if (err)
					{
						console.log(err);
						return;
					}

					console.log('Cancelled.');
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

	sendNotificationWithText('Bought ' + activeBitcoinQuantity + ' BTC successfully at $' + price + '.');
}

function marketEntered(error, result)
{
	entryPrice = result["price"];
	startingOrderRequired = false;

	console.log("\n<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nEntered at price: " + entryPrice + "\n<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n");

	client.get('first_entry', function(error, result)
	{
		if (result == null)
		{
			setFirstEntry(entryPrice);
		}
	});
}

function sellAtPrice(price)
{
	if (config.live)
	{
		console.log('Selling...');

		btceClient.trade({'pair': 'btc_usd', 'type': 'sell', 'rate': price, 'amount': activeBitcoinQuantity}, function(err, data)
		{
			if (err || data == null)
			{
				console.log(err);
				return;
			}
			else if (data['success'] === 0)
			{
				console.log('Error trading: ' + data['error']);
				return;
			}

			console.log(data);

			var response = data['return'];
			var orderID = response['order_id'];

			if (response['received'] >= (activeBitcoinQuantity * 0.5 * price) || orderID === 0)
			{
				soldSuccessfully(price);
			}
			else
			{
				console.log('Cancelling...');

				btceClient.cancelOrder(orderID, function(err, data)
				{
					console.log('Cancelled.');

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

	sendNotificationWithText('Sold ' + activeBitcoinQuantity + ' BTC successfully at $' + price + '.');
}

function commissionedEventOccurred(price)
{
	profit -= ((price * commissionRate) * activeBitcoinQuantity);

	client.set("profit", profit);

	console.log("\n===================\nTotal Profit: $" + profit + "\n===================\n");

	var percentageChange = (Math.abs((lastProfitNotified - profit) / profit)) * 100;
	if (percentageChange > 5.0)
	{
		var roundedProfit = Math.round(profit * 100) / 100;
		var roundedLastProfit = Math.round(lastProfitNotified * 100) / 100;
		var roundedChange = Math.round(percentageChange * 100) / 100;

		sendNotificationWithText("Profit is now $" + roundedProfit + ', a ' + roundedChange + '% change from last ($' + roundedLastProfit + ').');

		lastProfitNotified = profit;
	}
}

function setFirstEntry(newFirstEntry)
{
	client.set('first_entry', newFirstEntry);
	firstEntry = newFirstEntry;
}

function setActiveBitcoinQuantity(quantity)
{
	activeBitcoinQuantity = quantity;
	client.set('active_bitcoin_quantity', activeBitcoinQuantity);

	console.log('Set active Bitcoin quantity to: ' + activeBitcoinQuantity);
}
