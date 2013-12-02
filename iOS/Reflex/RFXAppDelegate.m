//
//  RFXAppDelegate.m
//  Reflex
//
//  Created by Kolin Krewinkel on 11/24/13.
//  Copyright (c) 2013 Kolin Krewinkel. All rights reserved.
//

#import "RFXAppDelegate.h"
#import "RFXLoginViewController.h"
#import "RFXOverviewViewController.h"

#import <AFNetworking/AFNetworkActivityIndicatorManager.h>

@implementation RFXAppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
    self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];

    if ([self.window respondsToSelector:@selector(tintColor)])
    {
        self.window.tintColor = [UIColor greenColor];
    }

//    if (UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPhone)
//    {
        UINavigationController *navigationController = [[UINavigationController alloc] init];

        if ([[NSUserDefaults standardUserDefaults] objectForKey:@"server"])
        {
            [navigationController setViewControllers:@[[[RFXOverviewViewController alloc] initWithStyle:UITableViewStyleGrouped]]];
        }
        else
        {
            [navigationController setViewControllers:@[[[RFXLoginViewController alloc] initWithStyle:UITableViewStyleGrouped]]];
        }

        if ([self.window respondsToSelector:@selector(tintColor)])
        {
            navigationController.navigationBar.barStyle = UIBarStyleBlackTranslucent;
        }
        else
        {
            navigationController.navigationBar.barStyle = UIBarStyleBlackOpaque;
        }

        self.window.rootViewController = navigationController;
//    }

    [[AFNetworkActivityIndicatorManager sharedManager] setEnabled:YES];

    [self.window makeKeyAndVisible];

    return YES;
}

- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)data
{
    NSString *identifier = [[[[NSString stringWithFormat:@"%@", data] stringByReplacingOccurrencesOfString:@" " withString:@""] stringByReplacingOccurrencesOfString:@"<" withString:@""] stringByReplacingOccurrencesOfString:@">" withString:@""];
    NSDictionary *JSON = @{@"device_token": identifier};

    NSMutableURLRequest *request = [[NSMutableURLRequest alloc] initWithURL:[NSURL URLWithString:[[[NSUserDefaults standardUserDefaults] objectForKey:@"server"] stringByAppendingString:@"/reflex/register"]] cachePolicy:NSURLRequestReloadIgnoringLocalAndRemoteCacheData timeoutInterval:30];

    NSError *error = nil;
    [request setHTTPBody:[NSJSONSerialization dataWithJSONObject:JSON options:0 error:&error]];
    [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    request.HTTPMethod = @"POST";

    NSLog(@"%@", error);
    NSLog(@"%@", JSON);

    AFHTTPRequestOperation *operation = [[AFHTTPRequestOperation alloc] initWithRequest:request];
    [operation setCompletionBlockWithSuccess:^(AFHTTPRequestOperation *operation, id responseObject) {
        
    } failure:^(AFHTTPRequestOperation *operation, NSError *error) {
        NSLog(@"%@", error);
    }];
    [operation start];
}

@end
