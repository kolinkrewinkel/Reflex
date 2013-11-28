//
//  RFXLoginViewCell.m
//  Reflex
//
//  Created by Kolin Krewinkel on 11/24/13.
//  Copyright (c) 2013 Kolin Krewinkel. All rights reserved.
//

#import "RFXLoginViewCell.h"

@implementation RFXLoginViewCell

- (id)initWithStyle:(UITableViewCellStyle)style reuseIdentifier:(NSString *)reuseIdentifier
{
    self = [super initWithStyle:style reuseIdentifier:reuseIdentifier];
    if (self)
    {
        self.textField = [[RFXLoginTextField alloc] init];
        self.textField.textColor = [UIColor whiteColor];
        self.textField.autocorrectionType = UITextAutocorrectionTypeNo;
        self.textField.autocapitalizationType = UITextAutocapitalizationTypeNone;

        [self addSubview:self.textField];
    }

    return self;
}

#pragma mark - UIView

- (void)layoutSubviews
{
    [super layoutSubviews];

    if ([self respondsToSelector:@selector(separatorInset)])
    {
        self.textField.frame = UIEdgeInsetsInsetRect(self.bounds, self.separatorInset);
    }
    else
    {
        self.textField.frame = CGRectInset(self.bounds, 16.f, 4.f);
    }
}

@end

@implementation RFXLoginTextField

- (void)drawPlaceholderInRect:(CGRect)rect
{
    NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
    paragraphStyle.lineHeightMultiple = 1.62f;

    if ([self respondsToSelector:@selector(separatorInset)])
    {
        [self.placeholder drawInRect:rect withAttributes:@{(NSString *)NSForegroundColorAttributeName: [UIColor colorWithWhite:1.f alpha:0.8f], (NSString *)NSFontAttributeName: [UIFont systemFontOfSize:16.f], (NSString *)NSParagraphStyleAttributeName: paragraphStyle}];
    }
    else
    {
        [[UIColor colorWithWhite:1.f alpha:0.8f] set];
        [self.placeholder drawAtPoint:CGPointMake(0.f, 0.f) withFont:[UIFont systemFontOfSize:16.f]];
    }
}

@end
