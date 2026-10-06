/**
 * Website Launch Announcement Email Template
 * Marketing email to retail customers announcing the new josemadrid.net
 * storefront, the mobile apps, and what follows over the coming months.
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const websiteLaunchAnnouncementTemplate: EmailTemplateDefinition = {
  key: 'website_launch_announcement',
  name: 'New Website Launch Announcement',
  subject: 'Our New Website Is Here — Plus an App on the Way',
  category: 'MARKETING',
  description:
    'Announces the new storefront to retail customers, covering what changed, account and order history, the mobile apps, and upcoming additions',
  variables: {
    firstName: 'string',
    websiteUrl: 'string',
    shopUrl: 'string',
    accountUrl: 'string',
    supportEmail: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>The new José Madrid Salsa website is live</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('service-announcement.png', 'José Madrid Salsa')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{firstName}},</p>

      <p style="margin-bottom:20px;">After a lot of long nights, we're glad to say it out loud: <strong>the new José Madrid Salsa website is here.</strong></p>

      <p style="margin-bottom:20px;">Same kitchen in Zanesville, Ohio. Same small-batch recipes we've been making since 1988. A much better way to buy them.</p>

      <div style="text-align:center;margin:30px 0;">
        <a href="{{shopUrl}}" style="${baseStyles.button}">See the New Site</a>
      </div>

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">What's better</h3>
      <ul style="padding-left:20px;margin:0 0 30px;">
        <li style="margin-bottom:10px;"><strong>Built for your phone.</strong> Most of you shop from one. The old site never really did.</li>
        <li style="margin-bottom:10px;"><strong>Find your heat.</strong> Browse by flavor and heat level so you land on the right jar the first time.</li>
        <li style="margin-bottom:10px;"><strong>Honest stock.</strong> If it's on the site, it's on the shelf — no more ordering something that turns out to be sold out.</li>
        <li style="margin-bottom:10px;"><strong>Checkout that just works.</strong> Fewer steps, live shipping rates, and your order confirmation in seconds.</li>
        <li style="margin-bottom:10px;"><strong>Track your order.</strong> Shipping updates from the moment your box leaves the kitchen.</li>
      </ul>

      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:24px;margin:32px 0;border-radius:6px;">
        <p style="margin:0 0 12px;color:#92400e;font-weight:700;font-size:18px;">One small thing to do</p>
        <p style="margin:0;color:#92400e;">You'll need to set a password the first time you sign in — it takes about ten seconds, and it keeps your account secure on the new system. <a href="{{accountUrl}}" style="color:#92400e;text-decoration:underline;"><strong>Set yours up here.</strong></a></p>
      </div>

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">There's an app coming, too</h3>
      <p style="margin-bottom:30px;">A <strong>José Madrid app</strong> is on its way to the <strong>Apple App Store</strong> and <strong>Google Play</strong> — reorder your regulars in a couple of taps, track deliveries, and get first word on new flavors. We'll send you the links the day it goes live.</p>

      <hr style="${baseStyles.divider}">

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">And this is only the start</h3>
      <p style="margin-bottom:15px;">Over the next few months we're rolling out:</p>
      <ul style="padding-left:20px;margin:0 0 30px;">
        <li style="margin-bottom:10px;">A rewards program for our repeat customers</li>
        <li style="margin-bottom:10px;">Recipes and pairing ideas built right into the site</li>
        <li style="margin-bottom:10px;">Build-your-own variety boxes and gift bundles</li>
        <li style="margin-bottom:10px;">An all-new fundraising system for the schools, teams, and churches we work with</li>
      </ul>

      <p style="margin-bottom:20px;">If something looks off or doesn't work the way you'd expect, please tell us — you'll find it faster than we will. Reply to this email or write to <a href="mailto:{{supportEmail}}" style="color:#dc2626;">{{supportEmail}}</a>.</p>

      <div style="text-align:center;margin:30px 0;">
        <a href="{{websiteUrl}}" style="${baseStyles.button}">Start Shopping</a>
      </div>

      <p style="margin-top:30px;">Thanks for sticking with us. Go grab a jar.</p>
      <p style="margin-top:10px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{firstName}},

After a lot of long nights, we're glad to say it out loud: the new Jose Madrid Salsa website is here.

Same kitchen in Zanesville, Ohio. Same small-batch recipes we've been making since 1988. A much better way to buy them.

See the new site: {{shopUrl}}

WHAT'S BETTER
- Built for your phone. Most of you shop from one. The old site never really did.
- Find your heat. Browse by flavor and heat level so you land on the right jar the first time.
- Honest stock. If it's on the site, it's on the shelf.
- Checkout that just works: fewer steps, live shipping rates, confirmation in seconds.
- Track your order from the moment your box leaves the kitchen.

ONE SMALL THING TO DO
You'll need to set a password the first time you sign in -- it takes about ten seconds, and it keeps your account secure on the new system. Set yours up here: {{accountUrl}}

THERE'S AN APP COMING, TOO
A Jose Madrid app is on its way to the Apple App Store and Google Play -- reorder your regulars in a couple of taps, track deliveries, and get first word on new flavors. We'll send you the links the day it goes live.

AND THIS IS ONLY THE START
Over the next few months we're rolling out:
- A rewards program for our repeat customers
- Recipes and pairing ideas built right into the site
- Build-your-own variety boxes and gift bundles
- An all-new fundraising system for the schools, teams, and churches we work with

If something looks off or doesn't work the way you'd expect, please tell us -- you'll find it faster than we will. Reply to this email or write to {{supportEmail}}.

Start shopping: {{websiteUrl}}

Thanks for sticking with us. Go grab a jar.

The Jose Madrid Salsa Team`,
}
