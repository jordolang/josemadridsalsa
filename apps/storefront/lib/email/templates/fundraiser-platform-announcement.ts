/**
 * Fundraiser Platform Announcement Email Template
 * Marketing email to fundraising accounts announcing the new website, the new
 * fundraising system that follows it, and the José Madrid mobile apps.
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const fundraiserPlatformAnnouncementTemplate: EmailTemplateDefinition = {
  key: 'fundraiser_platform_announcement',
  name: 'Fundraiser Platform Announcement',
  subject: 'A New Website — and a New Fundraising System — from José Madrid Salsa',
  category: 'MARKETING',
  description:
    'Announces the new website launch, the fundraising system coming after it, the iOS and Android apps, and further additions over the coming months',
  variables: {
    contactName: 'string',
    organizationName: 'string',
    websiteUrl: 'string',
    fundraisingTimeframe: 'string',
    bookingUrl: 'string',
    supportEmail: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Something big is coming to José Madrid Salsa fundraising</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('fundraiser-kickoff.png', 'José Madrid Salsa Fundraising')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{contactName}},</p>

      <p style="margin-bottom:20px;">We have some news we've been excited to share for a while. José Madrid Salsa is <strong>launching a brand-new website</strong> — and right behind it, an <strong>all-new fundraising system</strong> built specifically for groups like {{organizationName}}.</p>

      <p style="margin-bottom:20px;">We've been running fundraisers out of our Zanesville kitchen since 1988 with order forms, phone calls, and a lot of paperwork. It works — but you deserve better tools, and so do your sellers.</p>

      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:24px;margin:32px 0;border-radius:6px;">
        <p style="margin:0 0 12px;color:#991b1b;font-weight:700;font-size:18px;">First: the new website</p>
        <p style="margin:0;color:#991b1b;">A faster, cleaner store that works properly on a phone — every flavor, every heat level, real-time stock, and a checkout that doesn't fight you. It's the foundation everything else is being built on.</p>
      </div>

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">Next: the new fundraising system</h3>
      <p style="margin-bottom:15px;">Once the site is live, we'll be rolling out a fundraising platform designed around how your group actually runs a campaign:</p>
      <ul style="padding-left:20px;margin:0 0 30px;">
        <li style="margin-bottom:10px;"><strong>Your own campaign page.</strong> Your group's name, logo, photo, and mission — a real page you can share instead of a paper form.</li>
        <li style="margin-bottom:10px;"><strong>A personal link for every seller.</strong> Each participant gets their own link, so every order they bring in is credited to them automatically.</li>
        <li style="margin-bottom:10px;"><strong>Supporters can order online.</strong> Out-of-town family and friends can buy and have salsa shipped straight to their door — no one has to be standing in your gym to help.</li>
        <li style="margin-bottom:10px;"><strong>Live totals.</strong> See what your group has raised and how close you are to goal, updated as orders come in — no more waiting until the end to add it all up.</li>
        <li style="margin-bottom:10px;"><strong>Less work for coordinators.</strong> Order tracking, participant lists, and reporting in one place instead of a shoebox and a spreadsheet.</li>
        <li style="margin-bottom:10px;"><strong>Something fun for the kids.</strong> We're building a friendly team competition into the campaign pages — every sale moves your team forward. More on that soon.</li>
      </ul>

      <div style="background:#f0f9ff;border-left:4px solid #0284c7;padding:24px;margin:32px 0;border-radius:6px;">
        <p style="margin:0 0 12px;color:#075985;font-weight:700;font-size:18px;">And yes — there's an app coming</p>
        <p style="margin:0 0 12px;color:#075985;">A <strong>José Madrid app</strong> is on the way to both the <strong>Apple App Store</strong> and <strong>Google Play</strong>, so ordering, sharing, and following along with your fundraiser all fit in a pocket.</p>
        <p style="margin:0;color:#075985;font-size:14px;">We'll email you the download links the day it's available.</p>
      </div>

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">There's more coming after that</h3>
      <p style="margin-bottom:30px;">Over the next few months you'll see new flavors and bundles, easier reordering, rewards for repeat supporters, and better tools for the people who run campaigns year after year. We'll keep you posted as each piece lands.</p>

      <hr style="${baseStyles.divider}">

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">What this means for you right now</h3>
      <p style="margin-bottom:12px;"><strong>Nothing changes today.</strong> If {{organizationName}} wants to run a fundraiser this season, we'll book it the same way we always have — and you'll be among the first moved onto the new system when it's ready.</p>
      <p style="margin-bottom:20px;">We're expecting the new fundraising tools to be in your hands <strong>{{fundraisingTimeframe}}</strong>. Groups already on our books get first access.</p>

      <div style="text-align:center;margin:30px 0;">
        <a href="{{bookingUrl}}" style="${baseStyles.button}">Book a Fundraiser</a>
      </div>

      <p style="margin-bottom:12px;">Questions, ideas, or something you wish a fundraising system did? We're building this for you — tell us:</p>
      <ul style="padding-left:20px;margin:0 0 24px;">
        <li style="margin-bottom:8px;">Reply directly to this email</li>
        <li style="margin-bottom:8px;">Email us at <a href="mailto:{{supportEmail}}" style="color:#dc2626;">{{supportEmail}}</a></li>
        <li style="margin-bottom:8px;">Call or text <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a></li>
        <li style="margin-bottom:8px;">Visit <a href="{{websiteUrl}}" style="color:#dc2626;">{{websiteUrl}}</a></li>
      </ul>

      <p style="margin-top:30px;">Thank you for fundraising with us. The best part is still ahead.</p>
      <p style="margin-top:10px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{contactName}},

We have some news we've been excited to share for a while. Jose Madrid Salsa is launching a brand-new website -- and right behind it, an all-new fundraising system built specifically for groups like {{organizationName}}.

We've been running fundraisers out of our Zanesville kitchen since 1988 with order forms, phone calls, and a lot of paperwork. It works -- but you deserve better tools, and so do your sellers.

FIRST: THE NEW WEBSITE
A faster, cleaner store that works properly on a phone -- every flavor, every heat level, real-time stock, and a checkout that doesn't fight you. It's the foundation everything else is being built on.

NEXT: THE NEW FUNDRAISING SYSTEM
Once the site is live, we'll be rolling out a fundraising platform designed around how your group actually runs a campaign:
- Your own campaign page. Your group's name, logo, photo, and mission -- a real page you can share instead of a paper form.
- A personal link for every seller, so every order they bring in is credited to them automatically.
- Supporters can order online and have salsa shipped straight to their door.
- Live totals, updated as orders come in.
- Less work for coordinators: order tracking, participant lists, and reporting in one place.
- Something fun for the kids: a friendly team competition built into the campaign pages.

AND YES -- THERE'S AN APP COMING
A Jose Madrid app is on the way to both the Apple App Store and Google Play, so ordering, sharing, and following along with your fundraiser all fit in a pocket. We'll email you the download links the day it's available.

THERE'S MORE COMING AFTER THAT
Over the next few months you'll see new flavors and bundles, easier reordering, rewards for repeat supporters, and better tools for the people who run campaigns year after year.

WHAT THIS MEANS FOR YOU RIGHT NOW
Nothing changes today. If {{organizationName}} wants to run a fundraiser this season, we'll book it the same way we always have -- and you'll be among the first moved onto the new system when it's ready. We're expecting the new fundraising tools to be in your hands {{fundraisingTimeframe}}. Groups already on our books get first access.

Book a fundraiser: {{bookingUrl}}

Questions, ideas, or something you wish a fundraising system did? Tell us:
- Reply directly to this email
- Email us at {{supportEmail}}
- Call or text 740-521-4304
- Visit {{websiteUrl}}

Thank you for fundraising with us. The best part is still ahead.

The Jose Madrid Salsa Team`,
}
