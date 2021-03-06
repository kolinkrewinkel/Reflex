//
//  RFXOverviewViewController.m
//  Reflex
//
//  Created by Kolin Krewinkel on 11/24/13.
//  Copyright (c) 2013 Kolin Krewinkel. All rights reserved.
//

#import "RFXOverviewViewController.h"

@interface RFXOverviewViewController () <NSURLConnectionDelegate, NSURLConnectionDataDelegate>

@property (nonatomic, strong) NSTimer *refreshTimer;

@property (nonatomic, copy) NSString *totalProfit;
@property (nonatomic, copy) NSString *entryPrice;
@property (nonatomic, copy) NSString *bitcoinCount;
@property (nonatomic, strong) UIStepper *quantityStepper;

@property (nonatomic, copy) NSString *buyPrice;
@property (nonatomic, copy) NSString *lastPrice;
@property (nonatomic, copy) NSString *sellPrice;
@property (nonatomic, copy) NSString *recentHigh;
@property (nonatomic, copy) NSString *recentLow;
@property (nonatomic, copy) NSString *volume;


@end

@implementation RFXOverviewViewController

#pragma mark - UIViewController

- (void)viewDidLoad
{
    [super viewDidLoad];

    self.totalProfit = @"";
    self.entryPrice = @"";
    self.bitcoinCount = @"";

    self.buyPrice = @"";
    self.lastPrice = @"";
    self.sellPrice = @"";
    self.recentHigh = @"";
    self.recentLow = @"";
    self.volume = @"";

    self.quantityStepper = [[UIStepper alloc] init];
    self.quantityStepper.maximumValue = 100;
    self.quantityStepper.minimumValue = 0.1;
    self.quantityStepper.stepValue = 0.05;
    [self.quantityStepper addTarget:self action:@selector(stepperChanged:) forControlEvents:UIControlEventValueChanged];

    self.title = @"Reflex";
    self.view.backgroundColor = [UIColor colorWithWhite:0.205 alpha:1.000];
    self.tableView.backgroundView = nil;
    self.tableView.separatorStyle = UITableViewCellSeparatorStyleSingleLine;
    self.tableView.allowsSelection = NO;
    [self.tableView registerClass:[UITableViewCell class] forCellReuseIdentifier:@"Cell"];

    self.refreshControl = [[UIRefreshControl alloc] init];
    [self.refreshControl addTarget:self action:@selector(fetchData) forControlEvents:UIControlEventValueChanged];

    if (![self respondsToSelector:@selector(setTintColor:)])
    {
        self.refreshControl.tintColor = [UIColor blackColor];
    }

    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationBecameActive:) name:UIApplicationDidBecomeActiveNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationResignedActive:) name:UIApplicationDidEnterBackgroundNotification object:nil];

    [self fetchData];

    if ([AFNetworkReachabilityManager sharedManager].reachableViaWiFi)
    {
        self.refreshTimer = [NSTimer timerWithTimeInterval:2.5 target:self selector:@selector(fetchData) userInfo:nil repeats:YES];
        [[NSRunLoop mainRunLoop] addTimer:self.refreshTimer forMode:NSRunLoopCommonModes];
    }
}

#pragma mark - UI

- (NSArray *)labels
{
    return @[self.totalProfit, self.entryPrice, self.bitcoinCount, self.buyPrice, self.lastPrice, self.sellPrice, self.recentHigh, self.recentLow, self.volume];
}

#pragma mark - NSNotification

- (void)applicationBecameActive:(NSNotification *)notification
{
    if ([AFNetworkReachabilityManager sharedManager].reachableViaWiFi && !self.refreshTimer.isValid)
    {
        self.refreshTimer = [NSTimer timerWithTimeInterval:2.5 target:self selector:@selector(fetchData) userInfo:nil repeats:YES];
        [[NSRunLoop mainRunLoop] addTimer:self.refreshTimer forMode:NSRunLoopCommonModes];
    }

    __weak typeof(self) weakSelf = self;
    double delayInSeconds = 0.5;
    dispatch_time_t popTime = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delayInSeconds * NSEC_PER_SEC));
    dispatch_after(popTime, dispatch_get_main_queue(), ^(void){
        [weakSelf fetchData];
    });
}

- (void)applicationResignedActive:(NSNotification *)notification
{
    [self.refreshTimer invalidate];
}

#pragma mark - API

- (void)fetchData
{
    [self.refreshControl beginRefreshing];

    [[UIApplication sharedApplication] registerForRemoteNotificationTypes:(UIRemoteNotificationTypeAlert | UIRemoteNotificationTypeSound)];

    NSURL *URL = [NSURL URLWithString:[NSString stringWithFormat:@"%@/reflex/overview", [[NSUserDefaults standardUserDefaults] objectForKey:@"server"]]];

    AFHTTPRequestOperation *op = [[AFHTTPRequestOperation alloc] initWithRequest:[NSURLRequest requestWithURL:URL]];
    op.responseSerializer = [AFJSONResponseSerializer serializer];
    op.securityPolicy.allowInvalidCertificates = YES;

    [op setCompletionBlockWithSuccess:^(AFHTTPRequestOperation *operation, id responseObject) {
        [self receivedJSON:responseObject];
    } failure:^(AFHTTPRequestOperation *operation, NSError *error) {
        NSLog(@"Error: %@", error);
        [self.refreshControl endRefreshing];
    }];

    [[NSOperationQueue mainQueue] addOperation:op];
}

- (void)receivedJSON:(NSDictionary *)JSON
{
    NSDictionary *ticker = JSON[@"ticker"];

    if (!ticker || [ticker isKindOfClass:[NSNull class]])
    {
        [self.refreshControl endRefreshing];
        return;
    }

    NSNumberFormatter *numberFormatter = [[NSNumberFormatter alloc] init];
    numberFormatter.numberStyle = NSNumberFormatterCurrencyStyle;

    NSArray *textLabels = [self labels];

    NSString *profit = [numberFormatter stringFromNumber:JSON[@"profit"]];
    if (profit)
    {
        self.totalProfit = profit;
    }

    NSString *recentEntry = [numberFormatter stringFromNumber:JSON[@"recent_entry"]];
    if (recentEntry)
    {
        self.entryPrice = recentEntry;
    }

    NSString *bitcoinCount = [JSON[@"bitcoin_count"] stringValue];
    if (bitcoinCount)
    {
        self.bitcoinCount = bitcoinCount;
    }

    self.buyPrice = [numberFormatter stringFromNumber:ticker[@"buy"]];
    self.lastPrice = [numberFormatter stringFromNumber:ticker[@"last"]];
    self.sellPrice = [numberFormatter stringFromNumber:ticker[@"sell"]];
    self.recentHigh = [numberFormatter stringFromNumber:ticker[@"high"]];
    self.recentLow = [numberFormatter stringFromNumber:ticker[@"low"]];

    [numberFormatter setCurrencySymbol:@"BTC"];
    [numberFormatter setPositiveFormat:@"#,##0.00 ¤"];
    self.volume = [numberFormatter stringFromNumber:ticker[@"vol_cur"]];

    NSArray *newTextLabels = [self labels];

    [self.refreshControl endRefreshing];

    double delayInSeconds = 0.5;
    dispatch_time_t popTime = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delayInSeconds * NSEC_PER_SEC));
    dispatch_after(popTime, dispatch_get_main_queue(), ^(void){
        NSUInteger index = 0;
        for (NSString *oldString in textLabels)
        {
            if ([oldString isKindOfClass:[NSNull class]])
            {
                index++;
                continue;
            }

            NSString *newString = newTextLabels[index];

            if (![oldString isEqualToString:newString])
            {
                NSNumberFormatter *numberFormatter = [[NSNumberFormatter alloc] init];
                numberFormatter.numberStyle = NSNumberFormatterCurrencyStyle;

                double oldValue = [[numberFormatter numberFromString:oldString] doubleValue];
                double newValue = [[numberFormatter numberFromString:newString] doubleValue];

                UITableViewCell *cell = [self.tableView cellForRowAtIndexPath:[self indexPathForIndex:index]];
                UILabel *label = (UILabel *)cell.accessoryView;

                if (newValue > oldValue)
                {
                    label.textColor = [[UIColor greenColor] colorWithAlphaComponent:0.8f];
                }
                else if (newValue < oldValue)
                {
                    label.textColor = [[UIColor redColor] colorWithAlphaComponent:0.8f];
                }
            }
            
            index++;
        }
        
        [self.tableView reloadData];
    });
}

- (NSIndexPath *)indexPathForIndex:(NSUInteger)index
{
    if (index == 0)
    {
        return [NSIndexPath indexPathForRow:0 inSection:0];
    }
    else if (index == 1)
    {
        return [NSIndexPath indexPathForRow:1 inSection:0];
    }
    else if (index == 2)
    {
        return [NSIndexPath indexPathForRow:2 inSection:0];
    }
    else if (index == 3)
    {
        return [NSIndexPath indexPathForRow:0 inSection:1];
    }
    else if (index == 4)
    {
        return [NSIndexPath indexPathForRow:1 inSection:1];
    }
    else if (index == 5)
    {
        return [NSIndexPath indexPathForRow:2 inSection:1];
    }
    else if (index == 6)
    {
        return [NSIndexPath indexPathForRow:3 inSection:1];
    }
    else if (index == 7)
    {
        return [NSIndexPath indexPathForRow:4 inSection:1];
    }
    else if (index == 8)
    {
        return [NSIndexPath indexPathForRow:5 inSection:1];
    }

    return nil;
}

#pragma mark - UITableViewDataSource

- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView
{
    return 2;
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section
{
    if (section == 0)
    {
        return 3;
    }
    else if (section == 1)
    {
        return 6;
    }

    return 0;
}

- (NSString *)tableView:(UITableView *)tableView titleForHeaderInSection:(NSInteger)section
{
    if (section == 0)
    {
        return @"Position";
    }
    else if (section == 1)
    {
        return @"Market";
    }

    return nil;
}

- (CGFloat)tableView:(UITableView *)tableView heightForHeaderInSection:(NSInteger)section
{
    return 42.f;
}

- (UIView *)tableView:(UITableView *)tableView viewForHeaderInSection:(NSInteger)section
{
    UILabel *label = [[UILabel alloc] init];
    label.text = [NSString stringWithFormat:@"   %@", [[self tableView:tableView titleForHeaderInSection:section] uppercaseString]];
    label.textColor = [[UIColor whiteColor] colorWithAlphaComponent:0.4f];
    label.font = [UIFont fontWithName:@"HelveticaNeue-Medium" size:[UIFont smallSystemFontSize] * 1.3f];
    label.backgroundColor = self.view.backgroundColor;

    return label;
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath
{
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"Cell"];
    cell.backgroundColor = [UIColor blackColor];
    cell.textLabel.textColor = [UIColor whiteColor];

    if (!cell)
    {
        cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleValue1 reuseIdentifier:@"Cell"];
    }

    UILabel *label = (UILabel *)cell.accessoryView;

    if (!label || ![label isKindOfClass:[UILabel class]])
    {
        UILabel *label = [[UILabel alloc] initWithFrame:CGRectMake(0.f, 0.f, 110.f, 40.f)];
        label.backgroundColor = cell.backgroundColor;
        label.textColor = [[UIColor whiteColor] colorWithAlphaComponent:0.7f];
        label.textAlignment = NSTextAlignmentRight;
        label.tag = 917;
        label.font = [UIFont systemFontOfSize:14.f];

        cell.accessoryView = label;
    }

    if (indexPath.section == 0)
    {
        if (indexPath.row == 0)
        {
            cell.textLabel.text = @"Total Profit";
            label.text = self.totalProfit;
        }
        else if (indexPath.row == 1)
        {
            cell.textLabel.text = @"Entry Price";
            label.text = self.entryPrice;
        }
        else if (indexPath.row == 2)
        {
            UIStepper *stepper = (UIStepper *)cell.accessoryView;
            if (![stepper isKindOfClass:[UIStepper class]])
            {
                self.quantityStepper.value = [self.bitcoinCount doubleValue];
                cell.accessoryView = self.quantityStepper;
            }

            cell.textLabel.text = [NSString stringWithFormat:@"BTC In Play (%@)", [@(self.quantityStepper.value) stringValue]];
        }
    }
    else
    {
        if (indexPath.row == 0)
        {
            cell.textLabel.text = @"Bid Price";
            label.text = self.buyPrice;
        }
        else if (indexPath.row == 1)
        {
            cell.textLabel.text = @"Last Trade";
            label.text = self.lastPrice;
        }
        else if (indexPath.row == 2)
        {
            cell.textLabel.text = @"Sell Price";
            label.text = self.sellPrice;
        }
        else if (indexPath.row == 3)
        {
            cell.textLabel.text = @"24-Hour High";
            label.text = self.recentHigh;
        }
        else if (indexPath.row == 4)
        {
            cell.textLabel.text = @"24-Hour Low";
            label.text = self.recentLow;
        }
        else if (indexPath.row == 5)
        {
            cell.textLabel.text = @"24-Hour Volume";
            label.text = self.volume;
        }
    }

    if ([label isKindOfClass:[UILabel class]])
    {
        CGFloat alpha = 0.f;
        [label.textColor getWhite:NULL alpha:&alpha];

        if (alpha != 0.7f)
        {
            double delayInSeconds = 2.0;
            dispatch_time_t popTime = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delayInSeconds * NSEC_PER_SEC));
            dispatch_after(popTime, dispatch_get_main_queue(), ^(void){
                label.textColor = [[UIColor whiteColor] colorWithAlphaComponent:0.7f];

                CATransition *transition = [CATransition animation];
                transition.type = kCATransitionFade;
                transition.duration = 0.375;

                [label.layer addAnimation:transition forKey:nil];
            });
        }
    }

    return cell;
}

#pragma mark - UIEvent

- (void)stepperChanged:(UIStepper *)stepper
{
    UITableViewCell *cell = [self.tableView cellForRowAtIndexPath:[NSIndexPath indexPathForRow:2 inSection:0]];
    cell.textLabel.text = [NSString stringWithFormat:@"BTC In Play (%@)", [@(self.quantityStepper.value) stringValue]];

    NSDictionary *JSON = @{@"bitcoin_quantity": @(self.quantityStepper.value)};

    NSMutableURLRequest *request = [[NSMutableURLRequest alloc] initWithURL:[NSURL URLWithString:[[[NSUserDefaults standardUserDefaults] objectForKey:@"server"] stringByAppendingString:@"/reflex/volume"]] cachePolicy:NSURLRequestReloadIgnoringLocalAndRemoteCacheData timeoutInterval:30];

    NSError *error = nil;
    [request setHTTPBody:[NSJSONSerialization dataWithJSONObject:JSON options:0 error:&error]];
    [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    request.HTTPMethod = @"POST";

    AFHTTPRequestOperation *operation = [[AFHTTPRequestOperation alloc] initWithRequest:request];
    [operation setCompletionBlockWithSuccess:^(AFHTTPRequestOperation *operation, id responseObject) {

    } failure:^(AFHTTPRequestOperation *operation, NSError *error) {
        NSLog(@"%@", error);
    }];

    [operation start];
}

#pragma mark - Cleanup

- (void)dealloc
{
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

@end
