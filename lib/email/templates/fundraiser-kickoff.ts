/**
 * Fundraiser Kickoff Email Template
 * Marketing email sent when a fundraising campaign launches
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const fundraiserKickoffTemplate: EmailTemplateDefinition = {
  key: 'fundraiser_kickoff',
  name: 'Fundraiser Kickoff',
  subject: 'Your Fundraiser Starts Now! Let\'s Reach Your Goal! 🎯',
  category: 'MARKETING',
  description: 'Fundraising campaign launch details',
  variables: {
    organizationName: 'string',
    contactName: 'string',
    fundraiserGoal: 'string',
    fundraiserEndDate: 'string',
    orderFormUrl: 'string',
    dashboardUrl: 'string',
    supportEmail: 'string',
    profitPerJar: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Fundraiser Kickoff</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('fundraiser-kickoff.png', 'Fundraiser Kickoff')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{contactName}},</p>
      <p style="margin-bottom:30px;font-size:18px;">Your fundraiser is officially live! We're so excited to help {{organizationName}} reach your goal.</p>

      <div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:30px;border-radius:12px;text-align:center;margin:30px 0;color:#ffffff;">
        <p style="margin:0 0 10px;font-size:16px;">Your Fundraising Goal</p>
        <p style="margin:0 0 20px;font-size:48px;font-weight:700;">\${{fundraiserGoal}}</p>
        <p style="margin:0;font-size:14px;opacity:0.9;">Every jar sold = \${{profitPerJar}} for your cause</p>
      </div>

      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 20px;font-size:20px;">Important Dates & Links</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">Campaign End Date</p>
              <p style="margin:0;font-weight:600;color:#dc2626;">{{fundraiserEndDate}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">Order Form</p>
              <p style="margin:0;"><a href="{{orderFormUrl}}" style="color:#dc2626;font-weight:600;">{{orderFormUrl}}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;">
              <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">Live Dashboard</p>
              <p style="margin:0;"><a href="{{dashboardUrl}}" style="color:#dc2626;font-weight:600;">Track Your Progress</a></p>
            </td>
          </tr>
        </table>
      </div>

      <div style="margin:30px 0;">
        <h3 style="color:#dc2626;font-size:20px;margin:0 0 15px;">Your Fundraiser Toolkit:</h3>
        <ul style="padding-left:20px;">
          <li style="margin-bottom:12px;"><strong>✉️ Email Templates:</strong> Ready-to-send messages for supporters</li>
          <li style="margin-bottom:12px;"><strong>📱 Social Media Graphics:</strong> Shareable posts and stories</li>
          <li style="margin-bottom:12px;"><strong>🖨️ Print Flyers:</strong> School/office distribution materials</li>
          <li style="margin-bottom:12px;"><strong>📊 Progress Tracking:</strong> Real-time dashboard updates</li>
          <li><strong>🎯 Sales Tips:</strong> Proven strategies from top fundraisers</li>
        </ul>
      </div>

      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;">💡 Pro Tip for Success:</p>
        <p style="margin:0;color:#92400e;">The most successful fundraisers send 3 reminders: Launch day, mid-campaign, and 48 hours before closing!</p>
      </div>

      <div style="text-align:center;margin:40px 0;">
        <a href="{{orderFormUrl}}" style="display:inline-block;padding:16px 40px;background-color:#f59e0b;color:#ffffff !important;text-decoration:none;border-radius:8px;font-weight:600;font-size:18px;margin:0 10px 10px 0;">Share Order Form</a>
        <a href="{{dashboardUrl}}" style="display:inline-block;padding:16px 40px;background-color:#333;color:#ffffff !important;text-decoration:none;border-radius:8px;font-weight:600;font-size:18px;margin:0 10px 10px 0;">View Dashboard</a>
      </div>

      <hr style="${baseStyles.divider}">

      <p style="margin-top:30px;"><strong>Need Help?</strong></p>
      <p>Our fundraising team is here for you every step of the way. Have questions about orders, materials, or strategy?</p>
      <p style="margin-top:15px;">Email: <a href="mailto:{{supportEmail}}" style="color:#dc2626;">{{supportEmail}}</a><br>Phone: <a href="tel:7403493144" style="color:#dc2626;">740-349-3144</a></p>

      <p style="margin-top:30px;font-size:18px;text-align:center;"><strong>We believe in your mission. Let's make it happen together!</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Your fundraiser is live, {{organizationName}}!

Goal: \${{fundraiserGoal}}
End Date: {{fundraiserEndDate}}
Profit Per Jar: \${{profitPerJar}}

Order Form: {{orderFormUrl}}
Dashboard: {{dashboardUrl}}

Share your order form and track progress in real-time!

Questions? Email {{supportEmail}} or call 740-349-3144

Let's reach that goal together!`,
}
