/**
 * Single Announcement Email Template
 * One headline, one call to action
 *
 * Source: public/templates/announcement-single.html
 */

import { EmailTemplateDefinition } from './index'

export const announcementSingleTemplate: EmailTemplateDefinition = {
  key: 'announcement_single',
  name: 'Announcement - Single Story',
  subject: 'Something new from Jose Madrid Salsa',
  category: 'MARKETING',
  description: 'Single-announcement email with one headline and one call to action',
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
<title>Something new from Jose Madrid Salsa</title>
<!--[if mso]>
<style type="text/css">
  table, td, div, p, a { font-family: Arial, Helvetica, sans-serif !important; }
</style>
<![endif]-->
<style type="text/css">
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; }
    .px { padding-left: 22px !important; padding-right: 22px !important; }
    .stack { display: block !important; width: 100% !important; }
    .h1 { font-size: 32px !important; line-height: 38px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f4f1ec; -webkit-text-size-adjust:100%;">

<!-- EDIT: preheader, ~85 characters -->
<span style="display:none; font-size:1px; color:#f4f1ec; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">One announcement, one link — here's what just landed at the kitchen.</span>

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

  <!-- ============ DARK ANNOUNCEMENT PANEL ============ -->
  <tr>
    <td class="px" bgcolor="#110b07" style="background-color:#110b07; padding:44px 40px 44px 40px; border-bottom:1px solid #8a5616;">
      <!-- EDIT: eyebrow -->
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:2.6px; color:#f0c46a; text-transform:uppercase;">JUST ANNOUNCED</div>
      <!-- EDIT: the announcement, one line if you can -->
      <h1 class="h1" style="margin:16px 0 0 0; font-family:Georgia,'Times New Roman',serif; font-size:40px; line-height:46px; mso-line-height-rule:exactly; letter-spacing:-0.6px; color:#ffffff; font-weight:normal;">Black Bean &amp; Corn, back for the season</h1>
      <!-- EDIT: one supporting sentence -->
      <p style="margin:18px 0 0 0; font-family:Arial,Helvetica,sans-serif; font-size:17px; line-height:28px; mso-line-height-rule:exactly; color:#d8cbb9;">Cooked in the same copper kettles Mike has used since 1987, in a batch small enough that we can only make it once a year.</p>
      <!-- EDIT: button label + href -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
        <tr>
          <td align="center" bgcolor="#d9a235" style="background-color:#d9a235; border-radius:999px; padding:15px 32px;">
            <a href="#" style="display:block; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:20px; mso-line-height-rule:exactly; font-weight:bold; color:#110b07; text-decoration:none;">Shop It Now &rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ============ BODY COPY ============ -->
  <tr>
    <td class="px" style="padding:38px 40px 0 40px;">
      <p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:17px; line-height:29px; mso-line-height-rule:exactly; color:#3a332d;">Hi {{first_name}},</p>
      <!-- EDIT: body — as many paragraphs as you need -->
      <p style="margin:18px 0 0 0; font-family:Arial,Helvetica,sans-serif; font-size:17px; line-height:29px; mso-line-height-rule:exactly; color:#4a423b;">Every year the sweet corn comes in from the farms around Zanesville and we clear a week to cook this one. It's mild, a little sweet, thick enough to hold on a chip, and it's the jar our customers ask about more than any other when it's off the shelf.</p>
      <p style="margin:18px 0 0 0; font-family:Arial,Helvetica,sans-serif; font-size:17px; line-height:29px; mso-line-height-rule:exactly; color:#4a423b;">We made 900 jars. Last year they were gone by the end of the month.</p>
    </td>
  </tr>

  <!-- ============ DETAIL LIST (optional — delete the <tr> if unused) ============ -->
  <tr>
    <td class="px" style="padding:30px 40px 0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:#faf5ec; border-left:3px solid #d9a235;">
        <tr>
          <td style="padding:22px 24px;">
            <!-- EDIT: 2-4 short facts, one per row -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:24px; mso-line-height-rule:exactly;">
              <tr>
                <td width="120" style="width:120px; padding:5px 12px 5px 0; color:#8a7c6d; letter-spacing:1.2px; font-size:11px; text-transform:uppercase; vertical-align:top;">HEAT</td>
                <td style="padding:5px 0; color:#3a332d;">🌿 Mild — great for kids and mild palates</td>
              </tr>
              <tr>
                <td width="120" style="width:120px; padding:5px 12px 5px 0; color:#8a7c6d; letter-spacing:1.2px; font-size:11px; text-transform:uppercase; vertical-align:top;">SIZE</td>
                <td style="padding:5px 0; color:#3a332d;">16 oz glass jar</td>
              </tr>
              <tr>
                <td width="120" style="width:120px; padding:5px 12px 5px 0; color:#8a7c6d; letter-spacing:1.2px; font-size:11px; text-transform:uppercase; vertical-align:top;">AVAILABLE</td>
                <td style="padding:5px 0; color:#3a332d;">Online and at all Midwest retail partners</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ============ SECOND CTA ============ -->
  <tr>
    <td class="px" align="center" style="padding:34px 40px 0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <td align="center" bgcolor="#e53e3e" style="background-color:#e53e3e; border-radius:999px; padding:15px 34px;">
            <a href="#" style="display:block; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:20px; mso-line-height-rule:exactly; font-weight:bold; color:#ffffff; text-decoration:none;">Shop All Salsas &rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ============ WHERE IS JOSE ============ -->
  <tr>
    <td class="px" style="padding:36px 40px 0 40px;">
      <div style="border-top:1px solid #ece4d7; padding-top:26px;">
        <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:2.2px; color:#8a5616; text-transform:uppercase;">ON THE MOVE</div>
        <div style="font-family:Georgia,'Times New Roman',serif; font-size:22px; line-height:28px; mso-line-height-rule:exactly; color:#0f0c0a; padding-top:9px;">Where is Jose this week?</div>
        <p style="margin:10px 0 14px 0; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:25px; mso-line-height-rule:exactly; color:#4a423b;">📍 Taste it before you buy it — Mike is at markets and in-store demos across Ohio most weekends.</p>
        <a href="{{events_url}}" style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:22px; mso-line-height-rule:exactly; font-weight:bold; color:#d53030; text-decoration:none;">View Full Schedule &rarr;</a>
      </div>
    </td>
  </tr>

  <!-- ============ SIGN-OFF ============ -->
  <tr>
    <td class="px" style="padding:30px 40px 36px 40px;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:27px; mso-line-height-rule:exactly; color:#4a423b;">
        <!-- EDIT: sign-off -->
        See you at the table,<br>
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
