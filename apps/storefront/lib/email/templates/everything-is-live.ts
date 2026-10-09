/**
 * "Everything is live" launch email.
 * Marketing email to every mailing list announcing that the new storefront and
 * the new fundraising site are both live, inviting an order through the new
 * interface, and asking for reviews and site feedback.
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

const SHOP_URL = 'https://www.josemadridsalsa.com/products'
const SITE_URL = 'https://www.josemadridsalsa.com'
const FUNDRAISING_URL = 'https://fundraising.josemadridsalsa.com'
const FEEDBACK_URL = 'https://www.josemadridsalsa.com/feedback'
const ARENA_URL = 'https://www.josemadridsalsa.com/battle-arena'

export const everythingIsLiveTemplate: EmailTemplateDefinition = {
  key: 'everything_is_live',
  name: 'Everything Is Live (Store + Fundraising Launch)',
  subject: "We're live! Our new website and fundraising site are open",
  category: 'MARKETING',
  description:
    'Tells every customer the new storefront and fundraising site are live, invites them to order through the new interface, and asks for reviews and site feedback',
  variables: {
    firstName: 'string',
    googleReviewUrl: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Everything is live at José Madrid Salsa</title></head>
<body style="${baseStyles.container}">
  <div style="display:none;max-height:0;overflow:hidden;">Order through our brand-new site, check out the new fundraising site, and tell us what you think.</div>
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('service-announcement.png', 'José Madrid Salsa')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">{{#if firstName}}Hi {{firstName}},{{else}}Hi there,{{/if}}</p>

      <p style="margin-bottom:20px;"><strong>It's official: everything is live.</strong> Our brand-new José Madrid Salsa website and our all-new fundraising site are both up and running, and we'd love for you to be one of the first to try them.</p>

      <p style="margin-bottom:20px;">Same Zanesville kitchen. Same small-batch salsa. A whole new way to order it.</p>

      <div style="text-align:center;margin:30px 0;">
        <a href="${SHOP_URL}" style="${baseStyles.button}">Place Your Order</a>
      </div>

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">What's new at josemadridsalsa.com</h3>
      <ul style="padding-left:20px;margin:0 0 30px;">
        <li style="margin-bottom:10px;"><strong>A cleaner, faster store</strong> that works just as well on your phone as on your computer.</li>
        <li style="margin-bottom:10px;"><strong>Shop by heat level and flavor</strong> so you land on the right jar the first time.</li>
        <li style="margin-bottom:10px;"><strong>Quicker checkout</strong> with live shipping rates and instant order confirmation.</li>
        <li style="margin-bottom:10px;"><strong>Order tracking</strong> from the moment your box leaves our kitchen.</li>
      </ul>

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">A new home for fundraising</h3>
      <p style="margin-bottom:15px;">Schools, teams, churches and clubs now have a fundraising site of their own. Groups keep 50% of every jar, every fundraiser gets its own page to share, and supporters can order online and have salsa shipped straight to their door.</p>
      <p style="margin-bottom:30px;">And anyone can jump into the <a href="${ARENA_URL}" style="color:#dc2626;"><strong>Battle Arena</strong></a>, our free 3D fighting game, where fundraising groups also go head to head in tournaments.</p>

      <div style="text-align:center;margin:0 0 30px;">
        <a href="${FUNDRAISING_URL}" style="${baseStyles.button}">Visit the Fundraising Site</a>
      </div>

      <hr style="${baseStyles.divider}">

      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:24px;margin:32px 0;border-radius:6px;">
        <p style="margin:0 0 12px;color:#92400e;font-weight:700;font-size:18px;">Would you leave us a review?</p>
        <p style="margin:0 0 12px;color:#92400e;">Reviews are how a small family business like ours gets found. If you've enjoyed our salsa, a few words on Google means the world to us. <a href="{{googleReviewUrl}}" style="color:#92400e;text-decoration:underline;"><strong>Leave a Google review.</strong></a></p>
        <p style="margin:0;color:#92400e;">Have a favorite flavor? You can now review it right on its product page at <a href="${SITE_URL}" style="color:#92400e;text-decoration:underline;">josemadridsalsa.com</a>.</p>
      </div>

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">Tell us how we did</h3>
      <p style="margin-bottom:20px;">We built these sites for you, so we want to hear what works and what doesn't. Our quick feedback form lets you rate the layout, accessibility, ordering, finding what you need, the Battle Arena game, social sharing and more on a scale of 1 to 10. It takes about a minute.</p>

      <div style="text-align:center;margin:30px 0;">
        <a href="${FEEDBACK_URL}" style="${baseStyles.button}">Rate the New Site</a>
      </div>

      <p style="margin-bottom:20px;">Spot something broken? Just reply to this email and it will come straight to us.</p>

      <p style="margin-top:30px;">Thanks for sticking with us through the move. We can't wait to fill your next order.</p>
      <p style="margin-top:10px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `{{#if firstName}}Hi {{firstName}},{{else}}Hi there,{{/if}}

It's official: everything is live. Our brand-new Jose Madrid Salsa website and our all-new fundraising site are both up and running, and we'd love for you to be one of the first to try them.

Same Zanesville kitchen. Same small-batch salsa. A whole new way to order it.

Place your order: ${SHOP_URL}

WHAT'S NEW AT JOSEMADRIDSALSA.COM
- A cleaner, faster store that works just as well on your phone as on your computer.
- Shop by heat level and flavor so you land on the right jar the first time.
- Quicker checkout with live shipping rates and instant order confirmation.
- Order tracking from the moment your box leaves our kitchen.

A NEW HOME FOR FUNDRAISING
Schools, teams, churches and clubs now have a fundraising site of their own. Groups keep 50% of every jar, every fundraiser gets its own page to share, and supporters can order online and have salsa shipped straight to their door. And anyone can jump into the Battle Arena, our free 3D fighting game, where fundraising groups also go head to head in tournaments: ${ARENA_URL}

Visit the fundraising site: ${FUNDRAISING_URL}

WOULD YOU LEAVE US A REVIEW?
Reviews are how a small family business like ours gets found. If you've enjoyed our salsa, a few words on Google means the world to us: {{googleReviewUrl}}
Have a favorite flavor? You can now review it right on its product page at ${SITE_URL}.

TELL US HOW WE DID
Rate the layout, accessibility, ordering, finding what you need, the Battle Arena game, social sharing and more on a scale of 1 to 10. It takes about a minute: ${FEEDBACK_URL}

Spot something broken? Just reply to this email and it will come straight to us.

Thanks for sticking with us through the move. We can't wait to fill your next order.

The Jose Madrid Salsa Team

Unsubscribe: {{UNSUBSCRIBE_URL}}`,
}
