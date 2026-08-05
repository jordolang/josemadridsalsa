/**
 * Announcement Newsletter Email Template
 * Marketing newsletter with multiple stacked story sections
 *
 * Source: public/templates/announcement-newsletter.html
 */

import { EmailTemplateDefinition } from './index'

export const announcementNewsletterTemplate: EmailTemplateDefinition = {
  key: 'announcement_newsletter',
  name: 'Announcement - Newsletter',
  subject: 'News from Mike\'s kitchen',
  category: 'MARKETING',
  description: 'Multi-story newsletter announcement with stacked sections',
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
  },
  html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>News from Mike's kitchen</title>
<!--[if mso]>
<style type="text/css">
  table, td, div, p, a { font-family: Arial, Helvetica, sans-serif !important; }
</style>
<![endif]-->
<style type="text/css">
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .stack { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
    .h1 { font-size: 28px !important; line-height: 34px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f4f1ec; -webkit-text-size-adjust:100%;">

<!-- EDIT: preheader, ~85 characters, shows next to the subject line -->
<span style="display:none; font-size:1px; color:#f4f1ec; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">A quick note from Zanesville about what's new on the shelf this month.</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f1ec;">
<tr><td align="center" style="padding:24px 12px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px; max-width:600px; background-color:#fffdf9; border:1px solid #e7ddcd;">

  <!-- MASTHEAD -->
  <tr>
    <td align="center" bgcolor="#050505" style="background-color:#050505; padding:26px 24px 20px 24px;">
      <img src="{{logo_url}}" width="150" height="60" alt="Jose Madrid Salsa" style="display:block; border:0; outline:none; text-decoration:none; width:150px; height:auto; max-width:150px;">
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:3px; color:#d9a235; padding-top:12px; text-transform:uppercase;">SALSA &middot; EST. 1987</div>
    </td>
  </tr>

  <!-- ============ BLOCK A · HEADLINE ============ -->
  <tr>
    <td class="px" style="padding:38px 40px 0 40px;">
      <!-- EDIT: eyebrow, 2-4 words, ALL CAPS -->
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:2.4px; color:#d53030; text-transform:uppercase;">FROM THE KITCHEN</div>
      <!-- EDIT: headline, short and warm -->
      <h1 class="h1" style="margin:14px 0 0 0; font-family:Georgia,'Times New Roman',serif; font-size:34px; line-height:40px; mso-line-height-rule:exactly; letter-spacing:-0.5px; color:#0f0c0a; font-weight:normal;">A big month at the copper kettles</h1>
      <!-- EDIT: opening paragraph, 2-3 sentences -->
      <p style="margin:18px 0 0 0; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:27px; mso-line-height-rule:exactly; color:#4a423b;">Hi {{first_name}} — we've been busy in Zanesville. Two new batches came off the line, the market schedule filled up through the fall, and our fundraising families have had their best season yet. Here's the short version.</p>
    </td>
  </tr>

  <!-- ============ BLOCK B · DIVIDER ============ -->
  <tr>
    <td class="px" style="padding:32px 40px 0 40px;">
      <div style="height:1px; line-height:1px; font-size:0; background-color:#ece4d7;">&nbsp;</div>
    </td>
  </tr>

  <!-- ============ BLOCK C · STORY (duplicate this whole <tr> for each item) ============ -->
  <tr>
    <td class="px" style="padding:30px 40px 0 40px;">
      <!-- EDIT: kicker -->
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:2.2px; color:#8a5616; text-transform:uppercase;">NEW ON THE SHELF</div>
      <!-- EDIT: story title -->
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:23px; line-height:30px; mso-line-height-rule:exactly; color:#0f0c0a; padding-top:9px;">Roasted Garlic &amp; Olive is back</div>
      <!-- EDIT: story body -->
      <p style="margin:10px 0 0 0; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:27px; mso-line-height-rule:exactly; color:#4a423b;">It sold out in three weeks last time, so we doubled the batch. Mild, deeply savory, and the one our wholesale accounts ask for by name. Jars are on the site now.</p>
      <!-- EDIT: link -->
      <div style="padding-top:12px;">
        <a href="#" style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:22px; mso-line-height-rule:exactly; font-weight:bold; color:#d53030; text-decoration:none;">Shop This Flavor &rarr;</a>
      </div>
    </td>
  </tr>

  <!-- ============ BLOCK C (copy) ============ -->
  <tr>
    <td class="px" style="padding:28px 40px 0 40px;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:2.2px; color:#8a5616; text-transform:uppercase;">ON THE MOVE</div>
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:23px; line-height:30px; mso-line-height-rule:exactly; color:#0f0c0a; padding-top:9px;">Come find us this fall</div>
      <p style="margin:10px 0 0 0; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:27px; mso-line-height-rule:exactly; color:#4a423b;">Mike is out at markets and demos most weekends between now and November. Free tasting, no obligation — bring a friend who says they don't like salsa.</p>
      <div style="padding-top:12px;">
        <a href="#" style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:22px; mso-line-height-rule:exactly; font-weight:bold; color:#d53030; text-decoration:none;">View Full Schedule &rarr;</a>
      </div>
    </td>
  </tr>

  <!-- ============ BLOCK D · PRIMARY CTA ============ -->
  <tr>
    <td class="px" align="center" style="padding:36px 40px 0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <td align="center" bgcolor="#e53e3e" style="background-color:#e53e3e; border-radius:999px; padding:15px 34px;">
            <!-- EDIT: button label + href -->
            <a href="#" style="display:block; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:20px; mso-line-height-rule:exactly; font-weight:bold; color:#ffffff; text-decoration:none;">Shop All Salsas &rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ============ BLOCK E · THREE STATS (optional — delete the <tr> if unused) ============ -->
  <tr>
    <td class="px" style="padding:36px 40px 0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:#faf5ec; border:1px solid #e7ddcd;">
        <tr>
          <td width="33.33%" class="stack" align="center" style="width:33.33%; padding:22px 12px;">
            <div style="font-family:Georgia,'Times New Roman',serif; font-size:28px; line-height:32px; mso-line-height-rule:exactly; color:#0f0c0a;">28</div>
            <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:1.6px; color:#8a7c6d; text-transform:uppercase; padding-top:6px;">FLAVORS</div>
          </td>
          <td width="33.33%" class="stack" align="center" style="width:33.33%; padding:22px 12px; border-left:1px solid #e7ddcd; border-right:1px solid #e7ddcd;">
            <div style="font-family:Georgia,'Times New Roman',serif; font-size:28px; line-height:32px; mso-line-height-rule:exactly; color:#0f0c0a;">500+</div>
            <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:1.6px; color:#8a7c6d; text-transform:uppercase; padding-top:6px;">ORGANIZATIONS</div>
          </td>
          <td width="33.33%" class="stack" align="center" style="width:33.33%; padding:22px 12px;">
            <div style="font-family:Georgia,'Times New Roman',serif; font-size:28px; line-height:32px; mso-line-height-rule:exactly; color:#0f0c0a;">1987</div>
            <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:1.6px; color:#8a7c6d; text-transform:uppercase; padding-top:6px;">EST.</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ============ BLOCK F · FUNDRAISER ============ -->
  <tr>
    <td class="px" style="padding:16px 40px 0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:#110b07; border:1px solid #8a5616;">
        <tr>
          <td style="padding:24px;">
            <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:2.2px; color:#f0c46a; text-transform:uppercase;">EARN 50% PROFIT</div>
            <div style="font-family:Georgia,'Times New Roman',serif; font-size:22px; line-height:28px; mso-line-height-rule:exactly; color:#ffffff; padding-top:10px;">Fundraise with Jose!</div>
            <p style="margin:10px 0 16px 0; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:24px; mso-line-height-rule:exactly; color:#d8cbb9;">$3,500 raised on average, 96-jar minimum, ships in 10 days. Looking for a fundraiser people actually want to buy?</p>
            <a href="#" style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:22px; mso-line-height-rule:exactly; font-weight:bold; color:#f0c46a; text-decoration:none;">Start Your Fundraiser &rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ============ BLOCK G · SIGN-OFF ============ -->
  <tr>
    <td class="px" style="padding:32px 40px 36px 40px;">
      <div style="border-top:1px solid #ece4d7; padding-top:24px; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:27px; mso-line-height-rule:exactly; color:#4a423b;">
        <!-- EDIT: sign-off -->
        Thanks for reading — and for keeping a family business in business since 1987.<br><br>
        <span style="font-family:Georgia,'Times New Roman',serif; font-size:18px; color:#0f0c0a;">Mike &amp; the Jose Madrid Salsa family</span>
      </div>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td bgcolor="#050505" style="background-color:#050505; padding:30px 40px;">
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:18px; line-height:24px; mso-line-height-rule:exactly; color:#ffffff;">Jose Madrid Salsa</div>
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:10px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:3px; color:#d9a235; text-transform:uppercase; padding-top:6px;">SALSA &middot; EST. 1987</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="padding-top:18px;">
        <tr>
          <td style="padding-right:18px; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; mso-line-height-rule:exactly;"><a href="{{facebook_url}}" style="color:#f0c46a; text-decoration:none;">Facebook</a></td>
          <td style="padding-right:18px; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; mso-line-height-rule:exactly;"><a href="{{instagram_url}}" style="color:#f0c46a; text-decoration:none;">Instagram</a></td>
          <td style="font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; mso-line-height-rule:exactly;"><a href="{{events_url}}" style="color:#f0c46a; text-decoration:none;">Where Is Jose?</a></td>
        </tr>
      </table>
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:20px; mso-line-height-rule:exactly; color:#8f8577; padding-top:20px;">
        {{company_address}}<br>
        You're getting this because you signed up for news at {{site_url}}.<br>
        <a href="{{preferences_url}}" style="color:#8f8577; text-decoration:underline;">Email preferences</a> &nbsp;&middot;&nbsp; <a href="{{unsubscribe_url}}" style="color:#8f8577; text-decoration:underline;">Unsubscribe</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`,
  text: `Hi {{first_name}},

Read the full announcement on the site: {{site_url}}

See where we'll be next: {{events_url}}

-
Jose Madrid Salsa
{{company_address}}

Update your preferences: {{preferences_url}}
Unsubscribe: {{unsubscribe_url}}`,
}
