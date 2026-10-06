/**
 * Fundraiser Monthly Outreach Email Template
 * Marketing email sent monthly to fundraising accounts: we book fundraisers
 * year-round, and accounts inactive for 12+ months qualify for the $10 split.
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const fundraiserMonthlyOutreachTemplate: EmailTemplateDefinition = {
  key: 'fundraiser_monthly_outreach',
  name: 'Fundraiser Monthly Outreach',
  subject: "We're Booking Fundraisers Year-Round — Is {{organizationName}} Ready?",
  category: 'MARKETING',
  description:
    'Monthly outreach to fundraising accounts: year-round booking plus the $10 split offer for groups inactive 12+ months',
  variables: {
    contactName: 'string',
    organizationName: 'string',
    lastFundraiserDate: 'string',
    bookingUrl: 'string',
    supportEmail: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Fundraising Year-Round with José Madrid Salsa</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('fundraiser-kickoff.png', 'José Madrid Salsa Fundraising')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{contactName}},</p>

      <p style="margin-bottom:20px;">Thank you for being part of the José Madrid Salsa fundraising family. We wanted to reach out with a quick reminder for {{organizationName}}: <strong>we accept new fundraising accounts all year long</strong> — there is no seasonal window and no waiting list. Whenever your group is ready, we are.</p>

      <p style="margin-bottom:20px;">Groups run with us in every season: fall sports, winter band and choir, spring clubs, and summer travel teams. Pick the dates that work for your calendar and we'll build the fundraiser around them.</p>

      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:24px;margin:32px 0;border-radius:6px;">
        <p style="margin:0 0 12px;color:#92400e;font-weight:700;font-size:18px;">Has it been over a year since your last fundraiser?</p>
        <p style="margin:0 0 12px;color:#92400e;">If it's been longer than a year since {{organizationName}} last fundraised with us, you're eligible for our <strong>$10 split</strong> — <strong>$5 to your organization and $5 to us</strong> on every jar sold.</p>
        <p style="margin:0;color:#92400e;font-size:14px;">Our records show your most recent fundraiser with us was <strong>{{lastFundraiserDate}}</strong>. Reach out and we'll confirm your eligibility right away.</p>
      </div>

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">Why groups keep coming back</h3>
      <ul style="padding-left:20px;margin:0 0 30px;">
        <li style="margin-bottom:10px;"><strong>No upfront cost.</strong> You never pay to start, and you never carry inventory risk.</li>
        <li style="margin-bottom:10px;"><strong>A product people actually want.</strong> Award-winning, small-batch gourmet salsa made in Zanesville, Ohio since 1988 — not another candy bar or catalog.</li>
        <li style="margin-bottom:10px;"><strong>Simple to run.</strong> We provide the order forms, materials, and support your volunteers need.</li>
        <li style="margin-bottom:10px;"><strong>Repeat buyers.</strong> Supporters come back year after year because they love the salsa.</li>
      </ul>

      <div style="text-align:center;margin:30px 0;">
        <a href="{{bookingUrl}}" style="${baseStyles.button}">Start Your Fundraiser</a>
      </div>

      <hr style="${baseStyles.divider}">

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">Reach out however works best for you</h3>
      <p style="margin-bottom:12px;">There's no formal application to get the conversation started. Any of these works:</p>
      <ul style="padding-left:20px;margin:0 0 24px;">
        <li style="margin-bottom:8px;">Reply directly to this email</li>
        <li style="margin-bottom:8px;">Email us at <a href="mailto:{{supportEmail}}" style="color:#dc2626;">{{supportEmail}}</a></li>
        <li style="margin-bottom:8px;">Call or text <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a></li>
        <li style="margin-bottom:8px;">Message us through <a href="https://josemadridsalsafundraising.com" style="color:#dc2626;">josemadridsalsafundraising.com</a></li>
      </ul>

      <p style="margin-bottom:20px;">Tell us your group, your timeframe, and roughly how many sellers you expect — we'll take it from there and send back everything you need.</p>

      <p style="margin-top:30px;">We'd love to help {{organizationName}} raise more this year.</p>
      <p style="margin-top:10px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{contactName}},

Thank you for being part of the Jose Madrid Salsa fundraising family. A quick reminder for {{organizationName}}: we accept new fundraising accounts all year long. There is no seasonal window and no waiting list -- whenever your group is ready, we are.

HAS IT BEEN OVER A YEAR SINCE YOUR LAST FUNDRAISER?
If it's been longer than a year since {{organizationName}} last fundraised with us, you're eligible for our $10 split -- $5 to your organization and $5 to us on every jar sold. Our records show your most recent fundraiser with us was {{lastFundraiserDate}}. Reach out and we'll confirm your eligibility right away.

WHY GROUPS KEEP COMING BACK
- No upfront cost. You never pay to start, and you never carry inventory risk.
- A product people actually want: award-winning, small-batch gourmet salsa made in Zanesville, Ohio since 1988.
- Simple to run. We provide the order forms, materials, and support your volunteers need.
- Repeat buyers. Supporters come back year after year because they love the salsa.

Start your fundraiser: {{bookingUrl}}

REACH OUT HOWEVER WORKS BEST FOR YOU
- Reply directly to this email
- Email us at {{supportEmail}}
- Call or text 740-521-4304
- Message us through https://josemadridsalsafundraising.com

Tell us your group, your timeframe, and roughly how many sellers you expect -- we'll take it from there.

We'd love to help {{organizationName}} raise more this year.

The Jose Madrid Salsa Team`,
}
