//
//  RFXOverviewViewController.m
//  Reflex
//
//  Created by Kolin Krewinkel on 11/24/13.
//  Copyright (c) 2013 Kolin Krewinkel. All rights reserved.
//

#import "RFXOverviewViewController.h"

@interface RFXOverviewViewController () <NSURLConnectionDelegate, NSURLConnectionDataDelegate>

@property (nonatomic, strong) NSMutableData *downloadedData;

@property (nonatomic, copy) NSString *totalProfit;
@property (nonatomic, copy) NSString *entryPrice;
@property (nonatomic, copy) NSString *bitcoinCount;

@property (nonatomic, copy) NSString *lastPrice;
@property (nonatomic, copy) NSString *buyPrice;


@end

@implementation RFXOverviewViewController

- (id)initWithNibName:(NSString *)nibNameOrNil bundle:(NSBundle *)nibBundleOrNil
{
    self = [super initWithNibName:nibNameOrNil bundle:nibBundleOrNil];
    if (self) {
        // Custom initialization
    }
    return self;
}

- (void)viewDidLoad
{
    [super viewDidLoad];

    self.totalProfit = @"";
    self.entryPrice = @"";
    self.bitcoinCount = @"";
    self.buyPrice = @"";
    self.lastPrice = @"";

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

    [self fetchData];
}

#pragma mark - UI

- (NSArray *)labels
{
    return @[self.totalProfit, self.entryPrice, self.bitcoinCount, self.buyPrice, self.lastPrice];
}

#pragma mark - NSNotification

- (void)applicationBecameActive:(NSNotification *)notification
{
    __weak typeof(self) weakSelf = self;
    double delayInSeconds = 0.5;
    dispatch_time_t popTime = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delayInSeconds * NSEC_PER_SEC));
    dispatch_after(popTime, dispatch_get_main_queue(), ^(void){
        [weakSelf fetchData];
    });
}

#pragma mark - API

- (void)fetchData
{
    [self.refreshControl beginRefreshing];

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

    NSNumberFormatter *numberFormatter = [[NSNumberFormatter alloc] init];
    numberFormatter.numberStyle = NSNumberFormatterCurrencyStyle;

    NSArray *textLabels = [self labels];

    self.totalProfit = [numberFormatter stringFromNumber:JSON[@"profit"]];
    self.entryPrice = [numberFormatter stringFromNumber:JSON[@"recent_entry"]];
    self.bitcoinCount = JSON[@"bitcoin_count"];
    self.buyPrice = [numberFormatter stringFromNumber:ticker[@"buy"]];
    self.lastPrice = [numberFormatter stringFromNumber:ticker[@"last"]];

    NSArray *newTextLabels = [self labels];

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


    __weak typeof(self) weakSelf = self;
    double delayInSeconds = 3.0;
    dispatch_time_t popTime = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delayInSeconds * NSEC_PER_SEC));
    dispatch_after(popTime, dispatch_get_main_queue(), ^(void){
        for (UILabel *label in [weakSelf labels])
        {
            label.textColor = [[UIColor whiteColor] colorWithAlphaComponent:0.8f];

            CATransition *transition = [CATransition animation];
            transition.duration = 0.35;
            transition.type = kCATransitionFade;

            [label.layer addAnimation:transition forKey:nil];
        }
    });

    [self.refreshControl endRefreshing];
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
        return 2;
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

        UILabel *label = [[UILabel alloc] init];
        label.backgroundColor = [UIColor clearColor];;
        label.textColor = [[UIColor whiteColor] colorWithAlphaComponent:0.8f];
        label.textAlignment = NSTextAlignmentLeft;
        label.tag = 917;
        label.font = [UIFont systemFontOfSize:cell.textLabel.font.pointSize];

        cell.accessoryView = label;
    }

    UILabel *label = (UILabel *)[cell viewWithTag:917];
    if (label)
    {
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
                cell.textLabel.text = @"BTC In-Play";
                label.text = self.bitcoinCount;
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
        }
    }

    return cell;
}

@end
