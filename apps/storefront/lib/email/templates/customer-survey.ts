/**
 * Customer Survey Email Template
 * Marketing email sent to gather customer feedback
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const customerSurveyTemplate: EmailTemplateDefinition = {
  key: 'customer_survey',
  name: 'Customer Survey',
  subject: 'Help Us Improve! Take Our Survey',
  category: 'MARKETING',
  description: 'Customer satisfaction surveys',
  variables: {
    name: 'string',
    surveyUrl: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Customer Survey</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('share-feedback.png', 'We Value Your Opinion')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Your feedback is important to us. Please take a few minutes to complete our survey.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{surveyUrl}}" style="${baseStyles.button}">Take the Survey</a>
      </div>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Help us improve by taking our survey: {{surveyUrl}}

Thank you for your time!`,
}
