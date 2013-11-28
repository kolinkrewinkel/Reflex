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

@property (nonatomic, strong) UILabel *profitLabel;
@property (nonatomic, strong) UILabel *lastPriceLabel;
@property (nonatomic, strong) UILabel *buyPriceLabel;
@property (nonatomic, strong) UILabel *entryPriceLabel;

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

    self.title = @"Reflex";
    [self.tableView registerClass:[UITableViewCell class] forCellReuseIdentifier:@"Cell"];

    self.profitLabel = [[UILabel alloc] initWithFrame:CGRectMake(0.f, 88.f, 90.f, 34.f)];
    self.profitLabel.font = [UIFont systemFontOfSize:[UIFont labelFontSize]];

    self.entryPriceLabel = [[UILabel alloc] initWithFrame:CGRectMake(0.f, CGRectGetMaxY(self.profitLabel.frame), 90.f, 34.f)];
    self.entryPriceLabel.font = [UIFont systemFontOfSize:[UIFont labelFontSize]];

    self.buyPriceLabel = [[UILabel alloc] initWithFrame:CGRectMake(0.f, CGRectGetMaxY(self.entryPriceLabel.frame), 90.f, 34.f)];
    self.buyPriceLabel.font = [UIFont systemFontOfSize:[UIFont labelFontSize]];

    self.lastPriceLabel = [[UILabel alloc] initWithFrame:CGRectMake(0.f, CGRectGetMaxY(self.buyPriceLabel.frame), 90.f, 34.f)];
    self.lastPriceLabel.font = [UIFont systemFontOfSize:[UIFont labelFontSize]];

    for (UILabel *label in [self labels])
    {
        label.backgroundColor = [UIColor clearColor];;
        label.textColor = [UIColor darkTextColor];
        label.textAlignment = NSTextAlignmentLeft;
        label.tag = 917;
    }

    self.refreshControl = [[UIRefreshControl alloc] init];
    [self.refreshControl addTarget:self action:@selector(fetchData) forControlEvents:UIControlEventValueChanged];

    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationBecameActive:) name:UIApplicationDidBecomeActiveNotification object:nil];

    [self fetchData];
}

#pragma mark - UI

- (NSArray *)labels
{
    return @[self.profitLabel, self.entryPriceLabel, self.buyPriceLabel, self.lastPriceLabel];
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

    NSArray *textLabels = [[self labels] valueForKey:@"text"];

    self.profitLabel.text = [numberFormatter stringFromNumber:JSON[@"profit"]];
    self.entryPriceLabel.text = [numberFormatter stringFromNumber:JSON[@"recentEntry"]];
    self.buyPriceLabel.text = [numberFormatter stringFromNumber:ticker[@"buy"]];
    self.lastPriceLabel.text = [numberFormatter stringFromNumber:ticker[@"last"]];

    NSArray *newTextLabels = [[self labels] valueForKey:@"text"];

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
            UILabel *label = [self labels][index];
            double oldValue = [[oldString stringByReplacingOccurrencesOfString:@"$" withString:@""] doubleValue];
            double newValue = [[newString stringByReplacingOccurrencesOfString:@"$" withString:@""] doubleValue];

            if (newValue > oldValue)
            {
                label.textColor = [UIColor greenColor];
            }
            else if (newValue < oldValue)
            {
                label.textColor = [UIColor redColor];
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
            label.textColor = [UIColor darkTextColor];

            CATransition *transition = [CATransition animation];
            transition.duration = 0.35;
            transition.type = kCATransitionFade;

            [label.layer addAnimation:transition forKey:nil];
        }
    });

    [self.refreshControl endRefreshing];
}

#pragma mark - UITableViewDataSource

- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView
{
    return 2;
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section
{
    return 2;
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

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath
{
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"Cell"];
    if (!cell)
    {
        cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleValue1 reuseIdentifier:@"Cell"];
    }

    if (![cell viewWithTag:917])
    {
        if (indexPath.section == 0)
        {
            if (indexPath.row == 0)
            {
                cell.textLabel.text = @"Profit";
                cell.accessoryView = self.profitLabel;
            }
            else if (indexPath.row == 1)
            {
                cell.textLabel.text = @"Entry";
                cell.accessoryView = self.entryPriceLabel;
            }
        }
        else
        {
            if (indexPath.row == 0)
            {
                cell.textLabel.text = @"Bid";
                cell.accessoryView = self.buyPriceLabel;
            }
            else if (indexPath.row == 1)
            {
                cell.textLabel.text = @"Last";
                cell.accessoryView = self.lastPriceLabel;
            }
        }
    }

    return cell;
}

@end
