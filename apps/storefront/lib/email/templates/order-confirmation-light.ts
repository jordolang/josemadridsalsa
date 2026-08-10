/**
 * Order Confirmation Email Template (Light)
 * Itemized receipt rendered on a light background
 *
 * Source: public/templates/order-confirmation-light.html
 */

import { EmailTemplateDefinition } from './index'

export const orderConfirmationLightTemplate: EmailTemplateDefinition = {
  key: 'order_confirmation_light',
  name: 'Order Confirmation - Light',
  subject: 'Your Jose Madrid Salsa order {{order_number}}',
  category: 'TRANSACTIONAL',
  description: 'Order receipt on a light background, with itemized line items',
  variables: {
    first_name: 'string',
    logo_url: 'string',
    site_url: 'string',
    events_url: 'string',
    facebook_url: 'string',
    instagram_url: 'string',
    company_address: 'string',
    preferences_url: 'string',
    unsubscribe_url: 'string',
    order_number: 'string',
    order_date: 'string',
    order_status_url: 'string',
    line_items: 'array<{ item_name, item_size, item_heat_level, item_qty, item_line_total }>',
    subtotal: 'string',
    shipping_cost: 'string',
    tax: 'string',
    total: 'string',
    shipping_method: 'string',
    payment_method: 'string',
    ship_name: 'string',
    ship_address_1: 'string',
    ship_address_2: 'string',
    ship_city: 'string',
    ship_state: 'string',
    ship_zip: 'string',
    ship_country: 'string',
    billing_name: 'string',
    billing_city: 'string',
    billing_state: 'string',
    billing_zip: 'string',
    shop_url: 'string',
    fundraiser_url: 'string',
    next_event_name: 'string',
    next_event_date: 'string',
    next_event_city: 'string',
    support_email: 'string',
    support_phone: 'string',
  },
  html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Your Jose Madrid Salsa order {{order_number}}</title>
<!--[if mso]>
<style type="text/css">
  table, td, div, p, a { font-family: Arial, Helvetica, sans-serif !important; }
</style>
<![endif]-->
<style type="text/css">
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .stack { display: block !important; width: 100% !important; }
    .h1 { font-size: 26px !important; line-height: 32px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f4f1ec; -webkit-text-size-adjust:100%;">

<span style="display:none; font-size:1px; color:#f4f1ec; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">Order {{order_number}} is confirmed — small-batch salsa from Mike's kitchen in Zanesville is on its way to you.</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f1ec;">
<tr><td align="center" style="padding:24px 12px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px; max-width:600px; background-color:#fffdf9; border:1px solid #e7ddcd;">

  <!-- MASTHEAD -->
  <tr>
    <td align="center" bgcolor="#fffdf9" style="background-color:#fffdf9; padding:28px 24px 22px 24px; border-bottom:1px solid #e7ddcd;">
      <!-- Swap src for a hosted https URL before sending -->
      <img src="{{logo_url}}" width="150" height="60" alt="Jose Madrid Salsa" style="display:block; border:0; outline:none; text-decoration:none; width:150px; height:auto; max-width:150px;">
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:3px; color:#8a5616; padding-top:12px; text-transform:uppercase;">SALSA &middot; EST. 1987</div>
    </td>
  </tr>

  <!-- TICKER / WHERE IS JOSE -->
  <tr>
    <td bgcolor="#faf5ec" style="background-color:#faf5ec; padding:11px 24px; border-bottom:1px solid #e7ddcd;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:1.6px; color:#8a5616; text-transform:uppercase; text-align:center;">
        📍 NEXT UP: {{next_event_name}} &middot; {{next_event_city}} &middot; {{next_event_date}}
      </div>
    </td>
  </tr>

  <!-- HEADLINE -->
  <tr>
    <td class="px" style="padding:36px 40px 0 40px;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:2.4px; color:#d53030; text-transform:uppercase;">ORDER CONFIRMED</div>
      <h1 class="h1" style="margin:14px 0 0 0; font-family:Georgia,'Times New Roman',serif; font-size:32px; line-height:38px; mso-line-height-rule:exactly; letter-spacing:-0.5px; color:#0f0c0a; font-weight:normal;">Thanks, {{first_name}} — we're packing your salsa.</h1>
      <p style="margin:16px 0 0 0; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:26px; mso-line-height-rule:exactly; color:#4a423b;">Your order came through and it's in the queue at our kitchen in Zanesville, Ohio. We'll email you tracking the moment it leaves the building — usually within two business days.</p>
    </td>
  </tr>

  <!-- ORDER META -->
  <tr>
    <td class="px" style="padding:28px 40px 0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:#faf5ec; border:1px solid #e7ddcd;">
        <tr>
          <td width="50%" class="stack" style="width:50%; padding:16px 20px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:18px; mso-line-height-rule:exactly; color:#8a7c6d; letter-spacing:1.2px; text-transform:uppercase;">
            Order number
            <div style="font-family:Georgia,'Times New Roman',serif; font-size:19px; line-height:24px; mso-line-height-rule:exactly; color:#0f0c0a; letter-spacing:0; text-transform:none; padding-top:4px;">{{order_number}}</div>
          </td>
          <td width="50%" class="stack" style="width:50%; padding:16px 20px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:18px; mso-line-height-rule:exactly; color:#8a7c6d; letter-spacing:1.2px; text-transform:uppercase;">
            Order date
            <div style="font-family:Georgia,'Times New Roman',serif; font-size:19px; line-height:24px; mso-line-height-rule:exactly; color:#0f0c0a; letter-spacing:0; text-transform:none; padding-top:4px;">{{order_date}}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- LINE ITEMS -->
  <tr>
    <td class="px" style="padding:32px 40px 0 40px;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:2.2px; color:#d53030; text-transform:uppercase; padding-bottom:12px;">IN THIS BOX</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">

        <!-- {{#each line_items}} -->
        <tr>
          <td width="360" style="width:360px; padding:14px 12px 14px 0; border-bottom:1px solid #ece4d7; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:22px; mso-line-height-rule:exactly; color:#0f0c0a; vertical-align:top;">
            {{item_name}}
            <div style="font-size:13px; line-height:18px; mso-line-height-rule:exactly; color:#8a7c6d; padding-top:4px;">{{item_size}} &middot; Heat: {{item_heat_level}}</div>
          </td>
          <td width="60" align="center" style="width:60px; padding:14px 8px; border-bottom:1px solid #ece4d7; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:22px; mso-line-height-rule:exactly; color:#4a423b; vertical-align:top;">&times;{{item_qty}}</td>
          <td width="100" align="right" style="width:100px; padding:14px 0 14px 8px; border-bottom:1px solid #ece4d7; font-family:Georgia,'Times New Roman',serif; font-size:16px; line-height:22px; mso-line-height-rule:exactly; color:#0f0c0a; vertical-align:top;">{{item_line_total}}</td>
        </tr>
        <!-- {{/each}} -->

        <tr>
          <td colspan="2" style="padding:14px 12px 4px 0; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:20px; mso-line-height-rule:exactly; color:#4a423b;">Subtotal</td>
          <td align="right" style="padding:14px 0 4px 8px; font-family:Georgia,'Times New Roman',serif; font-size:15px; line-height:20px; mso-line-height-rule:exactly; color:#0f0c0a;">{{subtotal}}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:4px 12px 4px 0; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:20px; mso-line-height-rule:exactly; color:#4a423b;">Shipping — {{shipping_method}}</td>
          <td align="right" style="padding:4px 0 4px 8px; font-family:Georgia,'Times New Roman',serif; font-size:15px; line-height:20px; mso-line-height-rule:exactly; color:#0f0c0a;">{{shipping_cost}}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:4px 12px 14px 0; border-bottom:2px solid #0f0c0a; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:20px; mso-line-height-rule:exactly; color:#4a423b;">Tax</td>
          <td align="right" style="padding:4px 0 14px 8px; border-bottom:2px solid #0f0c0a; font-family:Georgia,'Times New Roman',serif; font-size:15px; line-height:20px; mso-line-height-rule:exactly; color:#0f0c0a;">{{tax}}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:14px 12px 0 0; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; mso-line-height-rule:exactly; letter-spacing:1.6px; color:#0f0c0a; text-transform:uppercase;">Total</td>
          <td align="right" style="padding:14px 0 0 8px; font-family:Georgia,'Times New Roman',serif; font-size:24px; line-height:28px; mso-line-height-rule:exactly; color:#0f0c0a;">{{total}}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td class="px" align="center" style="padding:32px 40px 0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <td align="center" bgcolor="#e53e3e" style="background-color:#e53e3e; border-radius:999px; padding:15px 34px;">
            <a href="{{order_status_url}}" style="display:block; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:20px; mso-line-height-rule:exactly; font-weight:bold; color:#ffffff; text-decoration:none; letter-spacing:0.2px;">Track Your Order &rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SHIPPING ADDRESS -->
  <tr>
    <td class="px" style="padding:34px 40px 0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
        <tr>
          <td width="50%" class="stack" style="width:50%; padding:0 12px 0 0; vertical-align:top;">
            <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:2.2px; color:#8a7c6d; text-transform:uppercase; padding-bottom:10px;">SHIPPING TO</div>
            <div style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:24px; mso-line-height-rule:exactly; color:#4a423b;">
              {{ship_name}}<br>
              {{ship_address_1}}<br>
              {{ship_address_2}}<br>
              {{ship_city}}, {{ship_state}} {{ship_zip}}<br>
              {{ship_country}}
            </div>
          </td>
          <td width="50%" class="stack" style="width:50%; padding:0 0 0 12px; vertical-align:top;">
            <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:2.2px; color:#8a7c6d; text-transform:uppercase; padding-bottom:10px;">PAYMENT</div>
            <div style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:24px; mso-line-height-rule:exactly; color:#4a423b;">
              {{payment_method}}<br>
              Billed to {{billing_name}}<br>
              {{billing_city}}, {{billing_state}} {{billing_zip}}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CROSS-SELL -->
  <tr>
    <td class="px" style="padding:36px 40px 0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:#faf5ec; border:1px solid #e7ddcd;">
        <tr>
          <td style="padding:24px;">
            <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:2.2px; color:#d53030; text-transform:uppercase;">28 FLAVORS AND COUNTING</div>
            <div style="font-family:Georgia,'Times New Roman',serif; font-size:22px; line-height:28px; mso-line-height-rule:exactly; color:#0f0c0a; padding-top:10px;">Find your perfect heat level</div>
            <p style="margin:10px 0 16px 0; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:24px; mso-line-height-rule:exactly; color:#4a423b;">🌿 Mild &nbsp;&middot;&nbsp; 🌶️ Medium &nbsp;&middot;&nbsp; 🔥 Hot. Every batch is cooked by hand in small runs, so there's always something new to try.</p>
            <a href="{{shop_url}}" style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:22px; mso-line-height-rule:exactly; font-weight:bold; color:#d53030; text-decoration:none;">Shop All Salsas &rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- FUNDRAISER -->
  <tr>
    <td class="px" style="padding:16px 40px 0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:#d53030; border:1px solid #b52626;">
        <tr>
          <td style="padding:24px;">
            <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:2.2px; color:#ffd9a0; text-transform:uppercase;">EARN 50% PROFIT</div>
            <div style="font-family:Georgia,'Times New Roman',serif; font-size:22px; line-height:28px; mso-line-height-rule:exactly; color:#ffffff; padding-top:10px;">Fundraise with Jose!</div>
            <p style="margin:10px 0 16px 0; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:24px; mso-line-height-rule:exactly; color:#ffe4e4;">Over 500 schools, teams, and nonprofits have run our program — $3,500 raised on average, 96-jar minimum, ships in 10 days.</p>
            <a href="{{fundraiser_url}}" style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:22px; mso-line-height-rule:exactly; font-weight:bold; color:#ffffff; text-decoration:none;">Start Your Fundraiser &rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SUPPORT -->
  <tr>
    <td class="px" style="padding:32px 40px 36px 40px;">
      <div style="border-top:1px solid #ece4d7; padding-top:24px; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:24px; mso-line-height-rule:exactly; color:#4a423b;">
        Questions about this order? Reply to this email, write us at <a href="mailto:{{support_email}}" style="color:#d53030; text-decoration:underline;">{{support_email}}</a>, or call {{support_phone}} — you'll reach the family, not a call center.
      </div>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td bgcolor="#faf5ec" style="background-color:#faf5ec; padding:30px 40px; border-top:1px solid #e7ddcd;">
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:18px; line-height:24px; mso-line-height-rule:exactly; color:#0f0c0a;">Jose Madrid Salsa</div>
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:10px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:3px; color:#8a5616; text-transform:uppercase; padding-top:6px;">SALSA &middot; EST. 1987</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="padding-top:18px;">
        <tr>
          <td style="padding-right:18px; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; mso-line-height-rule:exactly;"><a href="{{facebook_url}}" style="color:#d53030; text-decoration:none;">Facebook</a></td>
          <td style="padding-right:18px; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; mso-line-height-rule:exactly;"><a href="{{instagram_url}}" style="color:#d53030; text-decoration:none;">Instagram</a></td>
          <td style="font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; mso-line-height-rule:exactly;"><a href="{{events_url}}" style="color:#d53030; text-decoration:none;">Where Is Jose?</a></td>
        </tr>
      </table>
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:20px; mso-line-height-rule:exactly; color:#8a7c6d; padding-top:20px;">
        {{company_address}}<br>
        You're getting this because you placed an order at {{site_url}}.<br>
        <a href="{{preferences_url}}" style="color:#8a7c6d; text-decoration:underline;">Email preferences</a> &nbsp;&middot;&nbsp; <a href="{{unsubscribe_url}}" style="color:#8a7c6d; text-decoration:underline;">Unsubscribe</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`,
  text: `Hi {{first_name}},

Thanks for your order - it's confirmed.

Order {{order_number}}
Placed {{order_date}}

{{#each line_items}}- {{item_name}} ({{item_size}}, {{item_heat_level}}) x{{item_qty}}  {{item_line_total}}
{{/each}}
Subtotal: {{subtotal}}
Shipping: {{shipping_cost}}
Tax: {{tax}}
Total: {{total}}

Shipping via {{shipping_method}} to:
{{ship_name}}
{{ship_address_1}} {{ship_address_2}}
{{ship_city}}, {{ship_state}} {{ship_zip}}
{{ship_country}}

Paid with {{payment_method}}.

Track your order: {{order_status_url}}

Questions? {{support_email}} or {{support_phone}}`,
}
