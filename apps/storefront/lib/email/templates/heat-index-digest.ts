/**
 * Heat Index Digest Email Template
 * Marketing email rounding up recent Heat Index posts and recipes.
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const heatIndexDigestTemplate: EmailTemplateDefinition = {
  key: 'heat_index_digest',
  name: 'Heat Index Digest',
  subject: 'The Heat Index: {{featuredTitle}}',
  category: 'MARKETING',
  description:
    'Content digest of recent Heat Index posts and recipes, with one featured story and two follow-ups',
  variables: {
    firstName: 'string',
    featuredTitle: 'string',
    featuredSummary: 'string',
    featuredUrl: 'string',
    secondTitle: 'string',
    secondSummary: 'string',
    secondUrl: 'string',
    thirdTitle: 'string',
    thirdSummary: 'string',
    thirdUrl: 'string',
    pairedProductName: 'string',
    pairedProductUrl: 'string',
    blogUrl: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>The Heat Index from José Madrid Salsa</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('newsletter.png', 'The Heat Index')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{firstName}},</p>

      <p style="margin-bottom:30px;">A few things worth reading from the kitchen this month — recipes, flavor notes, and what we've been cooking.</p>

      <h3 style="color:#dc2626;font-size:20px;margin:0 0 10px;"><a href="{{featuredUrl}}" style="color:#dc2626;text-decoration:none;">{{featuredTitle}}</a></h3>
      <p style="margin:0 0 12px;">{{featuredSummary}}</p>
      <p style="margin:0 0 30px;"><a href="{{featuredUrl}}" style="color:#dc2626;font-weight:600;">Read it →</a></p>

      <hr style="${baseStyles.divider}">

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 10px;"><a href="{{secondUrl}}" style="color:#dc2626;text-decoration:none;">{{secondTitle}}</a></h3>
      <p style="margin:0 0 12px;">{{secondSummary}}</p>
      <p style="margin:0 0 30px;"><a href="{{secondUrl}}" style="color:#dc2626;font-weight:600;">Read it →</a></p>

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 10px;"><a href="{{thirdUrl}}" style="color:#dc2626;text-decoration:none;">{{thirdTitle}}</a></h3>
      <p style="margin:0 0 12px;">{{thirdSummary}}</p>
      <p style="margin:0 0 30px;"><a href="{{thirdUrl}}" style="color:#dc2626;font-weight:600;">Read it →</a></p>

      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:24px;margin:32px 0;border-radius:6px;">
        <p style="margin:0 0 12px;color:#991b1b;font-weight:700;font-size:18px;">Cooking along?</p>
        <p style="margin:0;color:#991b1b;">Most of this month's recipes lean on <a href="{{pairedProductUrl}}" style="color:#991b1b;text-decoration:underline;"><strong>{{pairedProductName}}</strong></a>. Worth having a jar on hand.</p>
      </div>

      <div style="text-align:center;margin:30px 0;">
        <a href="{{blogUrl}}" style="${baseStyles.button}">Read the Heat Index</a>
      </div>

      <p style="margin-top:30px;">Made something good with one of these? Send us a photo — we love seeing it.</p>
      <p style="margin-top:10px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{firstName}},

A few things worth reading from the kitchen this month -- recipes, flavor notes, and what we've been cooking.

{{featuredTitle}}
{{featuredSummary}}
Read it: {{featuredUrl}}

{{secondTitle}}
{{secondSummary}}
Read it: {{secondUrl}}

{{thirdTitle}}
{{thirdSummary}}
Read it: {{thirdUrl}}

COOKING ALONG?
Most of this month's recipes lean on {{pairedProductName}}. Worth having a jar on hand: {{pairedProductUrl}}

Read the Heat Index: {{blogUrl}}

Made something good with one of these? Send us a photo -- we love seeing it.

The Jose Madrid Salsa Team`,
}
