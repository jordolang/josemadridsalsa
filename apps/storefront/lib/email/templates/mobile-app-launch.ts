/**
 * Mobile App Launch Email Template
 * Marketing email announcing the José Madrid app on the App Store and Google Play.
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const mobileAppLaunchTemplate: EmailTemplateDefinition = {
  key: 'mobile_app_launch',
  name: 'Mobile App Launch',
  subject: 'The José Madrid App Is Here — iPhone and Android',
  category: 'MARKETING',
  description:
    'Announces the José Madrid mobile app with App Store and Google Play download links and the features it ships with',
  variables: {
    firstName: 'string',
    appStoreUrl: 'string',
    googlePlayUrl: 'string',
    websiteUrl: 'string',
    supportEmail: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>The José Madrid app is here</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('email-header.png', 'José Madrid Salsa')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{firstName}},</p>

      <p style="margin-bottom:20px;">We promised you an app. <strong>It's live.</strong> The José Madrid app is now available on the Apple App Store and Google Play — free, and about the size of one good jar of salsa.</p>

      <div style="text-align:center;margin:30px 0;">
        <a href="{{appStoreUrl}}" style="${baseStyles.button}">Download for iPhone</a>
      </div>
      <div style="text-align:center;margin:0 0 30px;">
        <a href="{{googlePlayUrl}}" style="display:inline-block;padding:14px 32px;background-color:#1f2937;color:#ffffff !important;text-decoration:none;border-radius:6px;font-weight:600;">Download for Android</a>
      </div>

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">What you can do with it</h3>
      <ul style="padding-left:20px;margin:0 0 30px;">
        <li style="margin-bottom:10px;"><strong>Reorder in two taps.</strong> Your favorites are waiting on the home screen — no hunting, no retyping your address.</li>
        <li style="margin-bottom:10px;"><strong>Track every box.</strong> Live shipping updates from our kitchen to your porch.</li>
        <li style="margin-bottom:10px;"><strong>Find us nearby.</strong> See which stores and markets near you carry José Madrid Salsa.</li>
        <li style="margin-bottom:10px;"><strong>Recipes in your pocket.</strong> What to do with that jar beyond chips — right there while you're standing in the kitchen.</li>
        <li style="margin-bottom:10px;"><strong>First word on new flavors.</strong> Small batches sell out. App users hear first.</li>
        <li style="margin-bottom:10px;"><strong>Follow a fundraiser.</strong> Supporting a school or team? Watch their progress and order right from your phone.</li>
      </ul>

      <div style="background:#f0f9ff;border-left:4px solid #0284c7;padding:24px;margin:32px 0;border-radius:6px;">
        <p style="margin:0 0 12px;color:#075985;font-weight:700;font-size:18px;">Your account comes with you</p>
        <p style="margin:0;color:#075985;">Sign in with the same email you use on <a href="{{websiteUrl}}" style="color:#075985;text-decoration:underline;">our website</a> and your addresses, order history, and saved favorites are already there.</p>
      </div>

      <p style="margin-bottom:20px;">The app is new, and we'd rather hear about a rough edge than have you live with it. Tell us what's missing at <a href="mailto:{{supportEmail}}" style="color:#dc2626;">{{supportEmail}}</a> — and if you like it, a review on the store helps a small Ohio salsa company more than you'd think.</p>

      <p style="margin-top:30px;">Thanks for being here since the beginning.</p>
      <p style="margin-top:10px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{firstName}},

We promised you an app. It's live. The Jose Madrid app is now available on the Apple App Store and Google Play -- free, and about the size of one good jar of salsa.

Download for iPhone: {{appStoreUrl}}
Download for Android: {{googlePlayUrl}}

WHAT YOU CAN DO WITH IT
- Reorder in two taps. Your favorites are waiting on the home screen.
- Track every box, with live shipping updates from our kitchen to your porch.
- Find us nearby: which stores and markets near you carry Jose Madrid Salsa.
- Recipes in your pocket, right there while you're standing in the kitchen.
- First word on new flavors. Small batches sell out; app users hear first.
- Follow a fundraiser you're supporting and order right from your phone.

YOUR ACCOUNT COMES WITH YOU
Sign in with the same email you use on {{websiteUrl}} and your addresses, order history, and saved favorites are already there.

The app is new, and we'd rather hear about a rough edge than have you live with it. Tell us what's missing at {{supportEmail}} -- and if you like it, a review on the store helps a small Ohio salsa company more than you'd think.

Thanks for being here since the beginning.

The Jose Madrid Salsa Team`,
}
