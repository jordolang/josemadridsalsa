import {
  wrapDocument,
  header,
  footer,
  colors,
  font,
  headingStyle,
  paragraphStyle,
  sectionHeadingStyle,
  labelStyle,
  valueStyle,
  button,
  detailRow,
  divider,
  supportBlurb,
} from './shared'
import type { ResendTemplateDefinition } from './types'
import { SITE_URL } from '@/lib/site-url'

function buildHtml(): string {
  const bodyRows = `
${header('order-confirmed.png', 'Order Confirmed')}

<!-- Body content -->
<tr>
  <td style="padding:0 48px;">
    <!-- Greeting -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:24px 0 0 0;">
          <h1 style="${headingStyle()}">Order Confirmed!</h1>
          <p style="${paragraphStyle()}">Hi {{{CUSTOMER_NAME}}},</p>
          <p style="${paragraphStyle()}">Thanks for your order! We&rsquo;re excited to get your delicious Jose Madrid Salsa on its way to you.</p>
        </td>
      </tr>
    </table>

    <!-- Order details box -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
      <tr>
        <td style="padding:20px;background-color:${colors.bgMuted};border-radius:8px;">
          <p style="${sectionHeadingStyle()}">Order Details</p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${detailRow('Order Number:', '#{{{ORDER_NUMBER}}}')}
            ${detailRow('Order Date:', '{{{ORDER_DATE}}}')}
            ${detailRow('Shipping:', '{{{SHIPPING_ADDRESS}}}')}
          </table>
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- Order items (pre-rendered HTML) -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:0;">
          <p style="${sectionHeadingStyle()}">Order Items</p>
          {{{ORDER_ITEMS_HTML}}}
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- Order total -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="right" style="padding:16px 0;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:16px;">
                <p style="margin:0;font-size:18px;font-weight:600;color:${colors.textDark};${font}line-height:1.5;">Total:</p>
              </td>
              <td>
                <p style="margin:0;font-size:20px;font-weight:700;color:${colors.primary};${font}line-height:1.5;">{{{ORDER_TOTAL}}}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding:24px 0;">
          <p style="${paragraphStyle('text-align:center;')}">Track your order or view your order history in your account.</p>
          ${button('{{{TRACKING_URL}}}', 'Track Order')}
        </td>
      </tr>
    </table>
  </td>
</tr>

${supportBlurb()}
${footer()}`

  return wrapDocument(
    'Order #{{{ORDER_NUMBER}}} confirmed - Thanks for your order!',
    bodyRows,
  )
}

export const orderConfirmation: ResendTemplateDefinition = {
  name: 'Order Confirmation',
  alias: 'order-confirmation',
  subject: 'Order #{{{ORDER_NUMBER}}} Confirmed - Thanks for Your Order!',
  from: 'Jose Madrid Salsa <mike@josemadridsalsa.com>',
  html: buildHtml(),
  variables: [
    { key: 'CUSTOMER_NAME', type: 'string', fallbackValue: 'there' },
    { key: 'ORDER_NUMBER', type: 'string' },
    { key: 'ORDER_DATE', type: 'string' },
    { key: 'ORDER_TOTAL', type: 'string' },
    { key: 'SHIPPING_ADDRESS', type: 'string' },
    { key: 'ORDER_ITEMS_HTML', type: 'string', fallbackValue: '' },
    { key: 'TRACKING_URL', type: 'string', fallbackValue: `${SITE_URL}/account/orders` },
  ],
}
