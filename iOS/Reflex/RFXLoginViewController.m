//
//  RFXLoginViewController.m
//  Reflex
//
//  Created by Kolin Krewinkel on 11/24/13.
//  Copyright (c) 2013 Kolin Krewinkel. All rights reserved.
//

#import "RFXLoginViewController.h"
#import "RFXLoginViewCell.h"
#import "RFXOverviewViewController.h"

static NSString *RFXLoginCellIdentifier = @"FieldCell";
static NSString *RFXFooterCellIdentifier = @"DoneCell";

@interface RFXLoginViewController ()

@end

@implementation RFXLoginViewController

- (void)viewDidLoad
{
    [super viewDidLoad];

    self.title = NSLocalizedString(@"Log In", @"Login view title.");
    self.navigationItem.rightBarButtonItem = [[UIBarButtonItem alloc] initWithTitle:@"Done" style:UIBarButtonItemStylePlain target:self action:@selector(done:)];

    self.view.backgroundColor = [UIColor colorWithWhite:0.205 alpha:1.000];

    self.tableView.alwaysBounceVertical = YES;
    [self.tableView registerClass:[RFXLoginViewCell class] forCellReuseIdentifier:RFXLoginCellIdentifier];
    [self.tableView registerClass:[UITableViewCell class] forCellReuseIdentifier:RFXFooterCellIdentifier];
}

- (void)didReceiveMemoryWarning
{
    [super didReceiveMemoryWarning];
    // Dispose of any resources that can be recreated.
}

#pragma mark - Actions

- (void)done:(id)sender
{
    NSString *server = ((RFXLoginViewCell *)[self.tableView cellForRowAtIndexPath:[NSIndexPath indexPathForRow:0 inSection:0]]).textField.text;
    NSString *username = ((RFXLoginViewCell *)[self.tableView cellForRowAtIndexPath:[NSIndexPath indexPathForRow:1 inSection:0]]).textField.text;
    NSString *password = ((RFXLoginViewCell *)[self.tableView cellForRowAtIndexPath:[NSIndexPath indexPathForRow:2 inSection:0]]).textField.text;

    if (!server || !username || !password)
    {
        return;
    }

    [[NSUserDefaults standardUserDefaults] setObject:server forKey:@"server"];
    [[NSUserDefaults standardUserDefaults] setObject:username forKey:@"username"];
    [SSKeychain setPassword:password forService:server account:username];

    [self.navigationController setViewControllers:@[[[RFXOverviewViewController alloc] initWithStyle:UITableViewStyleGrouped]] animated:YES];
}

#pragma mark - UITableViewDataSource

- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView
{
    return 1;
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section
{
    return 3;
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath
{
    RFXLoginViewCell *cell = [tableView dequeueReusableCellWithIdentifier:RFXLoginCellIdentifier forIndexPath:indexPath];
    cell.backgroundColor = [UIColor blackColor];

    if (indexPath.row == 0)
    {
        cell.textField.placeholder = @"Server Address";
        cell.textField.keyboardType = UIKeyboardTypeURL;
    }
    else if (indexPath.row == 1)
    {
        cell.textField.placeholder = @"Username";
    }
    else if (indexPath.row == 2)
    {
        cell.textField.placeholder = @"Password";
        cell.textField.secureTextEntry = YES;
    }

    return cell;
}

@end
