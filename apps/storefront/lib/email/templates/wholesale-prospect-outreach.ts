/**
 * Wholesale Prospect Outreach Email Template
 * Marketing email to shops, delis, and markets that don't yet carry the salsa.
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const wholesaleProspectOutreachTemplate: EmailTemplateDefinition = {
  key: 'wholesale_prospect_outreach',
  name: 'Wholesale Prospect Outreach',
  subject: 'Would José Madrid Salsa Fit on Your Shelves?',
  category: 'MARKETING',
  description:
    'Cold and warm outreach to retail buyers at shops, delis, and markets that do not yet carry the salsa',
  variables: {
    contactName: 'string',
    storeName: 'string',
    wholesaleUrl: 'string',
    salesEmail: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Carry José Madrid Salsa</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('wholesale-welcome.png', 'José Madrid Salsa Wholesale')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{contactName}},</p>

      <p style="margin-bottom:20px;">I'll keep this short. We're José Madrid Salsa — small-batch gourmet salsa made in Zanesville, Ohio since 1988 — and we'd like to be on the shelf at {{storeName}}.</p>

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">Why it works for a shop like yours</h3>
      <ul style="padding-left:20px;margin:0 0 30px;">
        <li style="margin-bottom:10px;"><strong>It isn't the national brands.</strong> Customers who won't pay a premium for what's in every grocery store will pay it for something they can't get anywhere else.</li>
        <li style="margin-bottom:10px;"><strong>A real range.</strong> Distinct recipes across mild to genuinely hot, plus fruit and specialty salsas that give the set some depth.</li>
        <li style="margin-bottom:10px;"><strong>Shelf-stable.</strong> No refrigeration, no short-code headaches.</li>
        <li style="margin-bottom:10px;"><strong>It repeats.</strong> Salsa is a habit. People who like ours come back for the same jar.</li>
        <li style="margin-bottom:10px;"><strong>A local story worth telling.</strong> Family-made in Ohio for over thirty-five years, with a following across the region.</li>
      </ul>

      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:24px;margin:32px 0;border-radius:6px;">
        <p style="margin:0 0 12px;color:#92400e;font-weight:700;font-size:18px;">Start small</p>
        <p style="margin:0;color:#92400e;">You don't need to commit to a full set. Take a starter case of our best sellers, put it out, and see how it moves before you decide anything else.</p>
      </div>

      <div style="text-align:center;margin:30px 0;">
        <a href="{{wholesaleUrl}}" style="${baseStyles.button}">See Wholesale Pricing</a>
      </div>

      <p style="margin-bottom:12px;">Happy to send samples, a line sheet, and current case pricing — just say the word:</p>
      <ul style="padding-left:20px;margin:0 0 24px;">
        <li style="margin-bottom:8px;">Reply to this email</li>
        <li style="margin-bottom:8px;">Email <a href="mailto:{{salesEmail}}" style="color:#dc2626;">{{salesEmail}}</a></li>
        <li style="margin-bottom:8px;">Call or text <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a></li>
      </ul>

      <p style="margin-top:30px;">Thanks for reading — and for keeping shelf space for the small guys.</p>
      <p style="margin-top:10px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{contactName}},

I'll keep this short. We're Jose Madrid Salsa -- small-batch gourmet salsa made in Zanesville, Ohio since 1988 -- and we'd like to be on the shelf at {{storeName}}.

WHY IT WORKS FOR A SHOP LIKE YOURS
- It isn't the national brands. Customers who won't pay a premium for what's in every grocery store will pay it for something they can't get anywhere else.
- A real range: distinct recipes from mild to genuinely hot, plus fruit and specialty salsas.
- Shelf-stable. No refrigeration, no short-code headaches.
- It repeats. Salsa is a habit, and people come back for the same jar.
- A local story worth telling: family-made in Ohio for over thirty-five years.

START SMALL
You don't need to commit to a full set. Take a starter case of our best sellers, put it out, and see how it moves before you decide anything else.

See wholesale pricing: {{wholesaleUrl}}

Happy to send samples, a line sheet, and current case pricing -- just say the word:
- Reply to this email
- Email {{salesEmail}}
- Call or text 740-521-4304

Thanks for reading -- and for keeping shelf space for the small guys.

The Jose Madrid Salsa Team`,
}
