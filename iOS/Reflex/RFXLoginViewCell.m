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
        self.textField.tintColor = [UIColor whiteColor];
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

    self.textField.frame = UIEdgeInsetsInsetRect(self.bounds, self.separatorInset);
}

@end

@implementation RFXLoginTextField

- (void)drawPlaceholderInRect:(CGRect)rect
{
    NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
    paragraphStyle.lineHeightMultiple = 1.5f;

    [self.placeholder drawInRect:rect withAttributes:@{NSForegroundColorAttributeName: [UIColor colorWithWhite:1.f alpha:0.8f], NSFontAttributeName: [UIFont systemFontOfSize:16.f], NSParagraphStyleAttributeName: paragraphStyle}];
}

@end
