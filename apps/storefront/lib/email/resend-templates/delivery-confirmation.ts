import {
  wrapDocument,
  header,
  footer,
  colors,
  font,
  headingStyle,
  paragraphStyle,
  sectionHeadingStyle,
  button,
  detailRow,
  divider,
  supportBlurb,
} from './shared'
import type { ResendTemplateDefinition } from './types'
import { SITE_URL } from '@/lib/site-url'

function buildHtml(): string {
  const bodyRows = `
${header('order-delivered.png', 'Order Delivered')}

<tr>
  <td style="padding:0 48px;">
    <!-- Greeting -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:24px 0 0 0;">
          <h1 style="${headingStyle()}">Your Order Has Been Delivered!</h1>
          <p style="${paragraphStyle()}">Hi {{{CUSTOMER_NAME}}},</p>
          <p style="${paragraphStyle()}">Great news! Your Jose Madrid Salsa order has been delivered. We hope you&rsquo;re ready to enjoy some delicious salsa!</p>
        </td>
      </tr>
    </table>

    <!-- Delivery details box -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
      <tr>
        <td style="padding:20px;background-color:${colors.bgMuted};border-radius:8px;">
          <p style="${sectionHeadingStyle()}">Delivery Information</p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${detailRow('Order Number:', '#{{{ORDER_NUMBER}}}')}
            ${detailRow('Delivery Date:', '{{{DELIVERY_DATE}}}')}
            ${detailRow('Delivered To:', '{{{SHIPPING_ADDRESS}}}')}
          </table>
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- Items delivered -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:0;">
          <p style="${sectionHeadingStyle()}">Items Delivered</p>
          {{{ORDER_ITEMS_HTML}}}
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- Feedback request -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding:24px;background-color:${colors.bgRedLight};border-radius:8px;margin:24px 0;">
          <p style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:${colors.primary};${font}line-height:1.3;">How Was Your Experience?</p>
          <p style="${paragraphStyle('text-align:center;')}">We&rsquo;d love to hear what you think! Your feedback helps us improve and helps other salsa lovers discover our products.</p>
          ${button('{{{FEEDBACK_URL}}}', 'Leave a Review')}
          <p style="margin:16px 0 0 0;font-size:14px;color:${colors.textMuted};${font}line-height:1.5;font-style:italic;">Your honest opinion means the world to us and takes just a minute to share.</p>
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- Order details link -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding:24px 0;">
          <p style="${paragraphStyle('text-align:center;')}">Want to view your order details or order history?</p>
          ${button('{{{ORDER_DETAILS_URL}}}', 'View Order Details', 'secondary')}
        </td>
      </tr>
    </table>
  </td>
</tr>

${supportBlurb()}
${footer()}`

  return wrapDocument(
    'Order #{{{ORDER_NUMBER}}} has been delivered - We hope you enjoy!',
    bodyRows,
  )
}

export const deliveryConfirmation: ResendTemplateDefinition = {
  name: 'Delivery Confirmation',
  alias: 'delivery-confirmation',
  subject: 'Order #{{{ORDER_NUMBER}}} Delivered - We Hope You Enjoy!',
  from: 'Jose Madrid Salsa <mike@josemadridsalsa.com>',
  html: buildHtml(),
  variables: [
    { key: 'CUSTOMER_NAME', type: 'string', fallbackValue: 'there' },
    { key: 'ORDER_NUMBER', type: 'string' },
    { key: 'DELIVERY_DATE', type: 'string' },
    { key: 'SHIPPING_ADDRESS', type: 'string' },
    { key: 'ORDER_ITEMS_HTML', type: 'string', fallbackValue: '' },
    { key: 'FEEDBACK_URL', type: 'string', fallbackValue: `${SITE_URL}/reviews` },
    { key: 'ORDER_DETAILS_URL', type: 'string', fallbackValue: `${SITE_URL}/account/orders` },
  ],
}
