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

function buildHtml(): string {
  const bodyRows = `
${header('shipping-notification.png', 'Your Order Has Shipped')}

<tr>
  <td style="padding:0 48px;">
    <!-- Greeting -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:24px 0 0 0;">
          <h1 style="${headingStyle()}">Your Order Has Shipped!</h1>
          <p style="${paragraphStyle()}">Hi {{{CUSTOMER_NAME}}},</p>
          <p style="${paragraphStyle()}">Great news! Your Jose Madrid Salsa order is on its way to you. We hope you enjoy it!</p>
        </td>
      </tr>
    </table>

    <!-- Tracking info box -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
      <tr>
        <td style="padding:20px;background-color:${colors.bgGreen};border-radius:8px;border:2px solid ${colors.greenBorder};">
          <p style="${sectionHeadingStyle()}">Tracking Information</p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${detailRow('Tracking Number:', '{{{TRACKING_NUMBER}}}')}
            ${detailRow('Carrier:', '{{{CARRIER}}}')}
            ${detailRow('Estimated Delivery:', '{{{ESTIMATED_DELIVERY}}}')}
            ${detailRow('Shipping To:', '{{{SHIPPING_ADDRESS}}}')}
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding:24px 0;">
          ${button('{{{TRACKING_URL}}}', 'Track Your Shipment')}
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- Order items -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:0;">
          <p style="${sectionHeadingStyle()}">Order #{{{ORDER_NUMBER}}}</p>
          {{{ORDER_ITEMS_HTML}}}
        </td>
      </tr>
    </table>

    ${divider()}
  </td>
</tr>

${supportBlurb()}
${footer()}`

  return wrapDocument(
    'Order #{{{ORDER_NUMBER}}} has shipped - Track your delivery!',
    bodyRows,
  )
}

export const shippingNotification: ResendTemplateDefinition = {
  name: 'Shipping Notification',
  alias: 'shipping-notification',
  subject: 'Order #{{{ORDER_NUMBER}}} Has Shipped - Track Your Delivery!',
  from: 'Jose Madrid Salsa <mike@josemadrid.net>',
  html: buildHtml(),
  variables: [
    { key: 'CUSTOMER_NAME', type: 'string', fallbackValue: 'there' },
    { key: 'ORDER_NUMBER', type: 'string' },
    { key: 'TRACKING_NUMBER', type: 'string' },
    { key: 'TRACKING_URL', type: 'string' },
    { key: 'CARRIER', type: 'string' },
    { key: 'ESTIMATED_DELIVERY', type: 'string' },
    { key: 'SHIPPING_ADDRESS', type: 'string' },
    { key: 'ORDER_ITEMS_HTML', type: 'string', fallbackValue: '' },
  ],
}
