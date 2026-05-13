/**
 * Fundraiser Update Email Template
 * Transactional email sent with automated progress updates for fundraisers
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const fundraiserUpdateTemplate: EmailTemplateDefinition = {
  key: 'fundraiser_update',
  name: 'Fundraiser Update',
  subject: 'Your Fundraiser Progress for {{organizationName}}',
  category: 'TRANSACTIONAL',
  description: 'Automated progress updates for fundraisers',
  variables: {
    organizationName: 'string',
    contactName: 'string',
    currentTotal: 'string',
    fundraiserGoal: 'string',
    progressPercent: 'string',
    daysRemaining: 'string',
    dashboardUrl: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Fundraiser Update</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('fundraiser-update.png', 'Fundraiser Update')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{contactName}},</p>
      <p style="margin-bottom:20px;">Here's a quick update on your fundraiser for {{organizationName}}.</p>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;text-align:center;">
        <p style="font-size:18px;color:#333;">You've raised</p>
        <p style="font-size:48px;font-weight:700;color:#dc2626;margin:10px 0;">{{currentTotal}}</p>
        <p style="font-size:18px;color:#333;">out of your <strong>{{fundraiserGoal}}</strong> goal!</p>
        <div style="background:#e9ecef;border-radius:10px;height:20px;margin:20px 0;">
          <div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);width:{{progressPercent}}%;height:20px;border-radius:10px;"></div>
        </div>
        <p style="font-size:16px;"><strong>{{daysRemaining}}</strong> days remaining!</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{dashboardUrl}}" style="${baseStyles.button}">View Your Dashboard</a>
      </div>
      <p style="margin-top:30px;">Keep up the great work! Share your fundraising page to reach your goal.</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{contactName}},

Here's an update on your fundraiser for {{organizationName}}.

You've raised {{currentTotal}} out of your {{fundraiserGoal}} goal!

{{progressPercent}}% of the way there with {{daysRemaining}} days remaining.

Keep up the great work!

View your dashboard: {{dashboardUrl}}`,
}
