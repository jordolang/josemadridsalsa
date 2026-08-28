/**
 * Fundraiser Referral Invite Email Template
 * Marketing email asking past and current coordinators to introduce another
 * organization that could run a José Madrid Salsa fundraiser.
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const fundraiserReferralInviteTemplate: EmailTemplateDefinition = {
  key: 'fundraiser_referral_invite',
  name: 'Fundraiser Referral Invite',
  subject: 'Know Another Group That Needs to Raise Money, {{contactName}}?',
  category: 'MARKETING',
  description:
    'Asks fundraiser coordinators to refer another organization, with the pitch they can forward and the ways to introduce us',
  variables: {
    contactName: 'string',
    organizationName: 'string',
    referralUrl: 'string',
    supportEmail: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Know another group that needs to raise money?</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('referral.png', 'José Madrid Salsa Fundraising')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{contactName}},</p>

      <p style="margin-bottom:20px;">Almost every group we work with came to us the same way: someone who'd already run a José Madrid fundraiser mentioned us to someone who hadn't. Not an ad — a coordinator telling another coordinator it went well.</p>

      <p style="margin-bottom:20px;">So we're asking directly. <strong>Is there another group in your world that needs to raise money?</strong> A booster club, a band, a church group, a scout troop, a class trip, the team on the next field over?</p>

      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:24px;margin:32px 0;border-radius:6px;">
        <p style="margin:0 0 12px;color:#92400e;font-weight:700;font-size:18px;">All it takes is a name</p>
        <p style="margin:0;color:#92400e;">Reply with their group and a contact, or forward this email along. We'll take it from there — no pressure on them, and nothing more required from you.</p>
      </div>

      <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">Here's the part you can forward</h3>
      <p style="margin-bottom:12px;">José Madrid Salsa has run fundraisers for schools, teams, and churches since 1988, out of our kitchen in Zanesville, Ohio:</p>
      <ul style="padding-left:20px;margin:0 0 30px;">
        <li style="margin-bottom:10px;"><strong>No upfront cost and no inventory risk.</strong> You never pay to start.</li>
        <li style="margin-bottom:10px;"><strong>Jars sell for $10, split 50/50.</strong> Five dollars a jar goes to the organization.</li>
        <li style="margin-bottom:10px;"><strong>People actually want it.</strong> Award-winning small-batch gourmet salsa — not another catalog of things nobody needs.</li>
        <li style="margin-bottom:10px;"><strong>Supporters come back.</strong> Groups that run with us year after year sell more each time, because buyers are waiting for it.</li>
        <li style="margin-bottom:10px;"><strong>Any time of year.</strong> No seasonal window, no waiting list.</li>
      </ul>

      <div style="text-align:center;margin:30px 0;">
        <a href="{{referralUrl}}" style="${baseStyles.button}">Introduce a Group</a>
      </div>

      <hr style="${baseStyles.divider}">

      <p style="margin-bottom:12px;">Or just reach us however's easiest:</p>
      <ul style="padding-left:20px;margin:0 0 24px;">
        <li style="margin-bottom:8px;">Reply to this email with a name</li>
        <li style="margin-bottom:8px;">Email <a href="mailto:{{supportEmail}}" style="color:#dc2626;">{{supportEmail}}</a></li>
        <li style="margin-bottom:8px;">Call or text <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a></li>
      </ul>

      <p style="margin-top:30px;">Thank you for everything you've done for {{organizationName}} — and for thinking of us.</p>
      <p style="margin-top:10px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{contactName}},

Almost every group we work with came to us the same way: someone who'd already run a Jose Madrid fundraiser mentioned us to someone who hadn't. Not an ad -- a coordinator telling another coordinator it went well.

So we're asking directly. Is there another group in your world that needs to raise money? A booster club, a band, a church group, a scout troop, a class trip, the team on the next field over?

ALL IT TAKES IS A NAME
Reply with their group and a contact, or forward this email along. We'll take it from there -- no pressure on them, and nothing more required from you.

HERE'S THE PART YOU CAN FORWARD
Jose Madrid Salsa has run fundraisers for schools, teams, and churches since 1988, out of our kitchen in Zanesville, Ohio:
- No upfront cost and no inventory risk. You never pay to start.
- Jars sell for $10, split 50/50. Five dollars a jar goes to the organization.
- People actually want it: award-winning small-batch gourmet salsa, not another catalog.
- Supporters come back. Groups that run with us year after year sell more each time.
- Any time of year. No seasonal window, no waiting list.

Introduce a group: {{referralUrl}}

Or just reach us however's easiest:
- Reply to this email with a name
- Email {{supportEmail}}
- Call or text 740-521-4304

Thank you for everything you've done for {{organizationName}} -- and for thinking of us.

The Jose Madrid Salsa Team`,
}
