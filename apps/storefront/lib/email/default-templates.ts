interface DefaultTemplate {
  name: string
  subject: string
  htmlContent: string
}

export const SCHOOL_FUNDRAISING_TEMPLATE: DefaultTemplate = {
  name: 'Fundraising Platform Pitch — Schools',
  subject: 'Earn 50% Profit for {{school_name}} {{sport}} — Zero Risk, Zero Cost',
  htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fundraising Opportunity — Jose Madrid Salsa</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6">
  <tr><td align="center" style="padding:30px 12px;">

    <!-- Card -->
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10);">

      <!-- HERO -->
      <tr>
        <td bgcolor="#b91c1c" style="padding:44px 40px 36px;text-align:center;">
          <p style="margin:0 0 8px;color:#fde68a;font-size:11px;letter-spacing:3px;font-weight:700;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">&#127798;&#65039; Jose Madrid Salsa</p>
          <h1 style="margin:0 0 10px;color:#ffffff;font-size:28px;font-weight:800;line-height:1.25;font-family:Arial,Helvetica,sans-serif;">Raise Money for<br>{{school_name}} {{sport}}</h1>
          <p style="margin:0 0 22px;color:rgba(255,255,255,0.88);font-size:16px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">Keep <strong style="color:#fde68a;">50% of every sale.</strong> No upfront cost. Ever.</p>
          <table cellpadding="0" cellspacing="0" border="0" align="center">
            <tr><td bgcolor="#f59e0b" style="border-radius:50px;padding:11px 30px;">
              <span style="color:#7c2d12;font-size:17px;font-weight:900;font-family:Arial,Helvetica,sans-serif;">&#128293; 50% PROFIT — HIGHEST IN THE INDUSTRY</span>
            </td></tr>
          </table>
        </td>
      </tr>

      <!-- GREETING -->
      <tr>
        <td style="padding:32px 40px 4px;">
          <p style="margin:0 0 14px;color:#111827;font-size:16px;font-family:Arial,Helvetica,sans-serif;">Hi {{contact_name}},</p>
          <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">I'm reaching out because {{sport_pitch}} — and Jose Madrid Salsa has a fundraising platform purpose-built to help athletic programs like yours generate <strong>serious, consistent revenue</strong> without the usual candy bars, cookie dough, or door-to-door grind.</p>
          <p style="margin:0;color:#374151;font-size:15px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">We make <strong>nationally recognized, small-batch artisan salsas</strong> people genuinely love — and we put <strong>half of every dollar sold</strong> straight into your program.</p>
        </td>
      </tr>

      <!-- WHY TEAMS LOVE US -->
      <tr>
        <td style="padding:24px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fefce8" style="border-radius:10px;border:1px solid #fde68a;">
            <tr><td style="padding:24px 28px;">
              <p style="margin:0 0 16px;color:#92400e;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">WHY ATHLETIC PROGRAMS CHOOSE US</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:5px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="color:#dc2626;font-size:16px;font-weight:700;padding-right:10px;vertical-align:top;line-height:22px;font-family:Arial,Helvetica,sans-serif;">&#10003;</td>
                    <td style="color:#1f2937;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;"><strong>50% profit to your program</strong> — the highest split in the fundraising industry, guaranteed in writing</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:5px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="color:#dc2626;font-size:16px;font-weight:700;padding-right:10px;vertical-align:top;line-height:22px;font-family:Arial,Helvetica,sans-serif;">&#10003;</td>
                    <td style="color:#1f2937;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;"><strong>Zero upfront cost</strong> — we front all product costs; you collect orders and we send you a check</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:5px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="color:#dc2626;font-size:16px;font-weight:700;padding-right:10px;vertical-align:top;line-height:22px;font-family:Arial,Helvetica,sans-serif;">&#10003;</td>
                    <td style="color:#1f2937;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;"><strong>Fully online platform</strong> — custom fundraiser page, shareable links per athlete, real-time sales dashboard</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:5px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="color:#dc2626;font-size:16px;font-weight:700;padding-right:10px;vertical-align:top;line-height:22px;font-family:Arial,Helvetica,sans-serif;">&#10003;</td>
                    <td style="color:#1f2937;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;"><strong>Award-winning product</strong> — family recipe, nationally recognized, customers become repeat buyers</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:5px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="color:#dc2626;font-size:16px;font-weight:700;padding-right:10px;vertical-align:top;line-height:22px;font-family:Arial,Helvetica,sans-serif;">&#10003;</td>
                    <td style="color:#1f2937;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;"><strong>Direct-to-door shipping</strong> — every order ships straight to the customer, no inventory headaches for you</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:5px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="color:#dc2626;font-size:16px;font-weight:700;padding-right:10px;vertical-align:top;line-height:22px;font-family:Arial,Helvetica,sans-serif;">&#10003;</td>
                    <td style="color:#1f2937;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;"><strong>Dedicated fundraising coordinator</strong> — real person, fast payouts, full support start to finish</td>
                  </tr></table>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td>
      </tr>

      <!-- HOW IT WORKS -->
      <tr>
        <td style="padding:4px 40px 28px;">
          <h2 style="margin:0 0 20px;color:#111827;font-size:18px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">How It Works — 3 Steps</h2>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding-bottom:16px;">
              <table cellpadding="0" cellspacing="0" width="100%"><tr>
                <td style="width:46px;vertical-align:top;">
                  <table cellpadding="0" cellspacing="0"><tr><td bgcolor="#b91c1c" style="width:34px;height:34px;border-radius:50%;text-align:center;line-height:34px;">
                    <span style="color:#fff;font-size:15px;font-weight:800;font-family:Arial,Helvetica,sans-serif;">1</span>
                  </td></tr></table>
                </td>
                <td style="vertical-align:top;">
                  <p style="margin:4px 0 2px;color:#111827;font-size:14px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Sign Up — We Go Live in 24 Hours</p>
                  <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">Reply to this email. We build a custom branded fundraiser page for {{school_name}} {{sport}} — no paperwork, no contracts, no risk.</p>
                </td>
              </tr></table>
            </td></tr>
            <tr><td style="padding-bottom:16px;">
              <table cellpadding="0" cellspacing="0" width="100%"><tr>
                <td style="width:46px;vertical-align:top;">
                  <table cellpadding="0" cellspacing="0"><tr><td bgcolor="#b91c1c" style="width:34px;height:34px;border-radius:50%;text-align:center;line-height:34px;">
                    <span style="color:#fff;font-size:15px;font-weight:800;font-family:Arial,Helvetica,sans-serif;">2</span>
                  </td></tr></table>
                </td>
                <td style="vertical-align:top;">
                  <p style="margin:4px 0 2px;color:#111827;font-size:14px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Share the Link — Watch Orders Roll In</p>
                  <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">Athletes share their personal link with family, friends, and fans. Online checkout handles everything — no cash, no forms, no chasing people down.</p>
                </td>
              </tr></table>
            </td></tr>
            <tr><td>
              <table cellpadding="0" cellspacing="0" width="100%"><tr>
                <td style="width:46px;vertical-align:top;">
                  <table cellpadding="0" cellspacing="0"><tr><td bgcolor="#b91c1c" style="width:34px;height:34px;border-radius:50%;text-align:center;line-height:34px;">
                    <span style="color:#fff;font-size:15px;font-weight:800;font-family:Arial,Helvetica,sans-serif;">3</span>
                  </td></tr></table>
                </td>
                <td style="vertical-align:top;">
                  <p style="margin:4px 0 2px;color:#111827;font-size:14px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">We Ship, You Get Paid</p>
                  <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">Every order ships directly to the customer's door. We send your program a check for <strong>50% of total sales</strong>. Zero inventory, all profit.</p>
                </td>
              </tr></table>
            </td></tr>
          </table>
        </td>
      </tr>

      <!-- STATS BAR -->
      <tr>
        <td style="padding:0 40px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1f2937" style="border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:22px 0;text-align:center;border-right:1px solid rgba(255,255,255,0.08);" width="25%">
                <p style="margin:0 0 4px;color:#fbbf24;font-size:28px;font-weight:900;font-family:Arial,Helvetica,sans-serif;">50%</p>
                <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">Profit to<br>Your Program</p>
              </td>
              <td style="padding:22px 0;text-align:center;border-right:1px solid rgba(255,255,255,0.08);" width="25%">
                <p style="margin:0 0 4px;color:#fbbf24;font-size:28px;font-weight:900;font-family:Arial,Helvetica,sans-serif;">$0</p>
                <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">Upfront<br>Cost to You</p>
              </td>
              <td style="padding:22px 0;text-align:center;border-right:1px solid rgba(255,255,255,0.08);" width="25%">
                <p style="margin:0 0 4px;color:#fbbf24;font-size:28px;font-weight:900;font-family:Arial,Helvetica,sans-serif;">24h</p>
                <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">From Signup<br>to Live</p>
              </td>
              <td style="padding:22px 0;text-align:center;" width="25%">
                <p style="margin:0 0 4px;color:#fbbf24;font-size:28px;font-weight:900;font-family:Arial,Helvetica,sans-serif;">100%</p>
                <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">Online &amp;<br>Hands-Free</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- TESTIMONIAL -->
      <tr>
        <td style="padding:0 40px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f9fafb" style="border-radius:10px;border-left:4px solid #b91c1c;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.7;font-style:italic;font-family:Arial,Helvetica,sans-serif;">"We raised over $2,400 in three weeks — more than we made all of last year with our old fundraiser. The platform was dead simple and every parent kept asking where to reorder."</p>
              <p style="margin:0;color:#6b7280;font-size:12px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">— Athletic Director, High School Baseball Program</p>
            </td></tr>
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="padding:0 40px 40px;text-align:center;">
          <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
            Ready to give <strong>{{school_name}} {{sport}}</strong> a financial boost this season?<br><strong>Simply reply to this email</strong> and we'll have your fundraiser page live within 24 hours.
          </p>
          <table cellpadding="0" cellspacing="0" border="0" align="center">
            <tr><td bgcolor="#b91c1c" style="border-radius:8px;padding:14px 36px;">
              <a href="mailto:mike@josemadridsalsa.com" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Start Raising Money Today &#8594;</a>
            </td></tr>
          </table>
          <p style="margin:16px 0 0;color:#9ca3af;font-size:13px;font-family:Arial,Helvetica,sans-serif;">No contracts. No minimums. No risk.</p>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td bgcolor="#f3f4f6" style="border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
          <p style="margin:0 0 4px;color:#374151;font-size:14px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">&#127798;&#65039; Jose Madrid Salsa</p>
          <p style="margin:0 0 6px;color:#9ca3af;font-size:12px;font-family:Arial,Helvetica,sans-serif;">Award-winning artisan salsas &middot; Family recipe &middot; Nationally recognized &middot; josemadridsalsa.com</p>
          <p style="margin:0;color:#d1d5db;font-size:11px;font-family:Arial,Helvetica,sans-serif;">You're receiving this because your athletic program may benefit from our fundraising platform. Reply "unsubscribe" to opt out.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
}

export const BUSINESS_OUTREACH_TEMPLATE: DefaultTemplate = {
  name: 'Wholesale & Partnership Outreach — Business',
  subject: 'Wholesale Partnership Opportunity — {{business_name}}',
  htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Partnership Opportunity — Jose Madrid Salsa</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6">
  <tr><td align="center" style="padding:30px 12px;">

    <!-- Card -->
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10);">

      <!-- HERO -->
      <tr>
        <td bgcolor="#b91c1c" style="padding:44px 40px 36px;text-align:center;">
          <p style="margin:0 0 8px;color:#fde68a;font-size:11px;letter-spacing:3px;font-weight:700;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">&#127798;&#65039; Jose Madrid Salsa</p>
          <h1 style="margin:0 0 10px;color:#ffffff;font-size:28px;font-weight:800;line-height:1.25;font-family:Arial,Helvetica,sans-serif;">A Partnership Built to<br>Boost Your Bottom Line</h1>
          <p style="margin:0 0 22px;color:rgba(255,255,255,0.88);font-size:16px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">Carry award-winning artisan salsa in your store — <strong style="color:#fde68a;">high margins, fast turns, repeat buyers</strong></p>
          <table cellpadding="0" cellspacing="0" border="0" align="center">
            <tr><td bgcolor="#f59e0b" style="border-radius:50px;padding:11px 30px;">
              <span style="color:#7c2d12;font-size:17px;font-weight:900;font-family:Arial,Helvetica,sans-serif;">&#128293; NATIONALLY RECOGNIZED &middot; LOCALLY MADE</span>
            </td></tr>
          </table>
        </td>
      </tr>

      <!-- GREETING -->
      <tr>
        <td style="padding:32px 40px 4px;">
          <p style="margin:0 0 14px;color:#111827;font-size:16px;font-family:Arial,Helvetica,sans-serif;">Hi {{contact_name}},</p>
          <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">I came across <strong>{{business_name}}</strong> and thought there might be a great fit between our brands. Jose Madrid Salsa is an award-winning, small-batch artisan salsa line with a passionate local following — and we're actively expanding our retail and wholesale network in {{city}}, {{state}}.</p>
          <p style="margin:0;color:#374151;font-size:15px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">Our wholesale partners consistently tell us our products are among the fastest-moving specialty items on their shelves — because people actually know and love the brand.</p>
        </td>
      </tr>

      <!-- WHY PARTNER -->
      <tr>
        <td style="padding:24px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fefce8" style="border-radius:10px;border:1px solid #fde68a;">
            <tr><td style="padding:24px 28px;">
              <p style="margin:0 0 16px;color:#92400e;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">WHY RETAILERS PARTNER WITH US</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:5px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="color:#dc2626;font-size:16px;font-weight:700;padding-right:10px;vertical-align:top;line-height:22px;font-family:Arial,Helvetica,sans-serif;">&#10003;</td>
                    <td style="color:#1f2937;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;"><strong>High retail margin</strong> — competitive wholesale pricing with strong sell-through rates</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:5px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="color:#dc2626;font-size:16px;font-weight:700;padding-right:10px;vertical-align:top;line-height:22px;font-family:Arial,Helvetica,sans-serif;">&#10003;</td>
                    <td style="color:#1f2937;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;"><strong>Award-winning product line</strong> — nationally recognized, family recipe, premium shelf appeal</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:5px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="color:#dc2626;font-size:16px;font-weight:700;padding-right:10px;vertical-align:top;line-height:22px;font-family:Arial,Helvetica,sans-serif;">&#10003;</td>
                    <td style="color:#1f2937;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;"><strong>Built-in local brand recognition</strong> — customers in {{city}} already know and seek out Jose Madrid Salsa</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:5px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="color:#dc2626;font-size:16px;font-weight:700;padding-right:10px;vertical-align:top;line-height:22px;font-family:Arial,Helvetica,sans-serif;">&#10003;</td>
                    <td style="color:#1f2937;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;"><strong>Co-marketing opportunities</strong> — social shoutouts, cross-promotion, and community fundraising tie-ins</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:5px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="color:#dc2626;font-size:16px;font-weight:700;padding-right:10px;vertical-align:top;line-height:22px;font-family:Arial,Helvetica,sans-serif;">&#10003;</td>
                    <td style="color:#1f2937;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;"><strong>Flexible minimums</strong> — we work with retailers of all sizes, from boutiques to grocery chains</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:5px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="color:#dc2626;font-size:16px;font-weight:700;padding-right:10px;vertical-align:top;line-height:22px;font-family:Arial,Helvetica,sans-serif;">&#10003;</td>
                    <td style="color:#1f2937;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;"><strong>Community fundraising program</strong> — earn 50% profit supporting local schools and sports teams through our platform</td>
                  </tr></table>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td>
      </tr>

      <!-- STATS BAR -->
      <tr>
        <td style="padding:0 40px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1f2937" style="border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:22px 0;text-align:center;border-right:1px solid rgba(255,255,255,0.08);" width="33%">
                <p style="margin:0 0 4px;color:#fbbf24;font-size:28px;font-weight:900;font-family:Arial,Helvetica,sans-serif;">50%</p>
                <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">Fundraising Profit<br>to Partners</p>
              </td>
              <td style="padding:22px 0;text-align:center;border-right:1px solid rgba(255,255,255,0.08);" width="33%">
                <p style="margin:0 0 4px;color:#fbbf24;font-size:28px;font-weight:900;font-family:Arial,Helvetica,sans-serif;">&#9733;&#9733;&#9733;&#9733;&#9733;</p>
                <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">Customer<br>Ratings</p>
              </td>
              <td style="padding:22px 0;text-align:center;" width="33%">
                <p style="margin:0 0 4px;color:#fbbf24;font-size:28px;font-weight:900;font-family:Arial,Helvetica,sans-serif;">Local</p>
                <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">{{city}}-Based<br>Brand</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="padding:0 40px 40px;text-align:center;">
          <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
            Interested in carrying Jose Madrid Salsa at <strong>{{business_name}}</strong> or exploring our co-marketing and fundraising programs?<br><strong>Simply reply to this email</strong> and we'll send over our wholesale catalog and pricing.
          </p>
          <table cellpadding="0" cellspacing="0" border="0" align="center">
            <tr><td bgcolor="#b91c1c" style="border-radius:8px;padding:14px 36px;">
              <a href="mailto:mike@josemadridsalsa.com" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Request Wholesale Pricing &#8594;</a>
            </td></tr>
          </table>
          <p style="margin:16px 0 0;color:#9ca3af;font-size:13px;font-family:Arial,Helvetica,sans-serif;">No commitment required. Just a conversation.</p>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td bgcolor="#f3f4f6" style="border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
          <p style="margin:0 0 4px;color:#374151;font-size:14px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">&#127798;&#65039; Jose Madrid Salsa</p>
          <p style="margin:0 0 6px;color:#9ca3af;font-size:12px;font-family:Arial,Helvetica,sans-serif;">Award-winning artisan salsas &middot; Family recipe &middot; Nationally recognized &middot; josemadridsalsa.com</p>
          <p style="margin:0;color:#d1d5db;font-size:11px;font-family:Arial,Helvetica,sans-serif;">You're receiving this because your business may be a great fit for our wholesale or co-marketing program. Reply "unsubscribe" to opt out.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
}

export function getDefaultTemplate(leadType: string): DefaultTemplate {
  return leadType === 'LOCAL_BUSINESS'
    ? BUSINESS_OUTREACH_TEMPLATE
    : SCHOOL_FUNDRAISING_TEMPLATE
}
