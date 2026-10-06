/**
 * Event Invitation Email Template
 * Marketing email for tasting tours and special events
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const eventInvitationTemplate: EmailTemplateDefinition = {
  key: 'event_invitation',
  name: 'Event Invitation',
  subject: "You're Invited: {{eventName}} 🎉",
  category: 'MARKETING',
  description: 'Tasting tours and event invitations',
  variables: {
    eventName: 'string',
    eventDate: 'string',
    eventTime: 'string',
    eventLocation: 'string',
    eventDescription: 'string',
    rsvpUrl: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Event Invitation</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('event-notification.png', 'Event Invitation')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:18px;margin-bottom:30px;line-height:1.6;">{{eventDescription}}</p>

      <div style="background:#f8f9fa;padding:30px;border-radius:12px;margin:30px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:15px 0;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">📅 Date</p>
              <p style="margin:0;font-size:18px;font-weight:600;">{{eventDate}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:15px 0;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">🕐 Time</p>
              <p style="margin:0;font-size:18px;font-weight:600;">{{eventTime}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:15px 0;">
              <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">📍 Location</p>
              <p style="margin:0;font-size:18px;font-weight:600;">{{eventLocation}}</p>
            </td>
          </tr>
        </table>
      </div>

      <div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);padding:25px;border-radius:12px;margin:30px 0;">
        <h3 style="color:#92400e;margin:0 0 15px;font-size:20px;">What to Expect:</h3>
        <ul style="padding-left:20px;margin:0;color:#92400e;">
          <li style="margin-bottom:12px;">Sample our full product line</li>
          <li style="margin-bottom:12px;">Meet founder Jose Madrid</li>
          <li style="margin-bottom:12px;">Learn salsa-making secrets</li>
          <li style="margin-bottom:12px;">Exclusive event pricing</li>
          <li>Free swag & recipe cards</li>
        </ul>
      </div>

      <div style="text-align:center;margin:40px 0;">
        <a href="{{rsvpUrl}}" style="display:inline-block;padding:16px 40px;background-color:#7c3aed;color:#ffffff !important;text-decoration:none;border-radius:8px;font-weight:600;font-size:18px;">RSVP Now</a>
        <p style="margin:15px 0 0;color:#6c757d;font-size:14px;">Space is limited - Reserve your spot today!</p>
      </div>

      <div style="background:#e7f5ff;border-left:4px solid #1971c2;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0;color:#1864ab;"><strong>🎁 Bonus:</strong> Every attendee receives a special discount code for online orders!</p>
      </div>

      <p style="margin-top:30px;">Can't make it? Share this invitation with a friend who'd love to join us!</p>
      <p style="margin-top:20px;">Questions? Reply to this email or call us at <a href="tel:7403493144" style="color:#7c3aed;">740-349-3144</a>.</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `YOU'RE INVITED: {{eventName}}

{{eventDescription}}

Date: {{eventDate}}
Time: {{eventTime}}
Location: {{eventLocation}}

What to Expect:
- Sample our full product line
- Meet founder Jose Madrid
- Learn salsa-making secrets
- Exclusive event pricing
- Free swag & recipe cards

RSVP: {{rsvpUrl}}

Space is limited - Reserve your spot today!

Bonus: Every attendee receives a special discount code for online orders!

Questions? Call 740-349-3144 or reply to this email.`,
}
