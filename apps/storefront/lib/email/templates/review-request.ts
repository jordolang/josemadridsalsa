/**
 * Review Request Email Template
 * Marketing email sent to request product reviews
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const reviewRequestTemplate: EmailTemplateDefinition = {
  key: 'review_request',
  name: 'Review Request',
  subject: 'Got a Minute? Share Your Feedback',
  category: 'MARKETING',
  description: 'Post-purchase review requests',
  variables: {
    name: 'string',
    productName: 'string',
    reviewUrl: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Review Request</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('review-request.png', 'How Did We Do')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Thanks for your recent purchase of {{productName}}. We'd love to hear what you think!</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{reviewUrl}}" style="${baseStyles.button}">Leave a Review</a>
      </div>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Thanks for your recent purchase of {{productName}}. We'd love to hear what you think!

Leave a review: {{reviewUrl}}`,
}
