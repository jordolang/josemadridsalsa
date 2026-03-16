/**
 * Professional Email Templates Library
 * Complete HTML email templates with inline CSS for maximum compatibility
 */

export interface EmailTemplateDefinition {
  key: string
  name: string
  subject: string
  category: 'TRANSACTIONAL' | 'MARKETING' | 'ADMINISTRATIVE'
  description: string
  variables: Record<string, string>
  html: string
  text: string
}

function getImageBaseUrl() {
  return 'https://www.josemadrid.net/email-templates'
}

const headerImg = (filename: string, alt: string) =>
  `<img src="${getImageBaseUrl()}/${filename}" alt="${alt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;" />`

const baseStyles = {
  container: 'width:100%;background-color:#f4f4f7;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;',
  wrapper: 'max-width:600px;margin:0 auto;background-color:#ffffff;',
  header: 'padding:0;text-align:center;',
  headerTitle: 'color:#ffffff;font-size:28px;font-weight:700;margin:0;',
  content: 'padding:40px 32px;color:#333333;line-height:1.6;',
  button: 'display:inline-block;padding:14px 32px;background-color:#dc2626;color:#ffffff !important;text-decoration:none;border-radius:6px;font-weight:600;margin:20px 0;',
  footer: 'background-color:#f8f9fa;padding:30px 32px;text-align:center;color:#6c757d;font-size:14px;',
  divider: 'height:1px;background-color:#e2e8f0;margin:30px 0;border:none;',
}

const jmsFooter = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f1ec; font-family: Georgia, 'Times New Roman', serif;">
  <tr>
    <td align="center" style="padding: 0 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%;">
        <tr>
          <td style="padding: 32px 0 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="border-top: 2px solid #c8102e; font-size: 0; line-height: 0;" height="1">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 28px 0 8px 0;">
            <a href="https://www.josemadridsalsa.com" target="_blank" style="text-decoration: none;">
              <img src="https://www.josemadrid.net/email-templates/Jose-Madrid-Profile.png" alt="José Madrid Salsa" width="180" height="auto" style="display: block; border: 0; outline: none; max-width: 180px; height: auto;" />
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 4px 0 20px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 1.4; color: #8c7a6b; letter-spacing: 0.5px;">
            Handcrafted Gourmet Salsas · Zanesville, Ohio · Est. 1988
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0 0 20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 0 12px;"><a href="https://www.josemadridsalsa.com" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 1.2px;">Shop</a></td>
                <td style="color: #d4c8ba; font-size: 12px;">&#124;</td>
                <td style="padding: 0 12px;"><a href="https://www.josemadridsalsa.com/our-story" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 1.2px;">Our Story</a></td>
                <td style="color: #d4c8ba; font-size: 12px;">&#124;</td>
                <td style="padding: 0 12px;"><a href="https://www.josemadridsalsa.com/our-salsas" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 1.2px;">Flavors</a></td>
                <td style="color: #d4c8ba; font-size: 12px;">&#124;</td>
                <td style="padding: 0 12px;"><a href="https://josemadridsalsafundraising.com" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 1.2px;">Fundraising</a></td>
                <td style="color: #d4c8ba; font-size: 12px;">&#124;</td>
                <td style="padding: 0 12px;"><a href="https://www.josemadridsalsa.com/contact-us" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 1.2px;">Contact</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0 0 24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 0 8px;"><a href="https://www.facebook.com/josemadridsalsa" target="_blank" style="text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" width="28" height="28" style="display: block; border: 0; border-radius: 50%;" /></a></td>
                <td style="padding: 0 8px;"><a href="https://www.instagram.com/josemadrid_salsa/" target="_blank" style="text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" width="28" height="28" style="display: block; border: 0; border-radius: 50%;" /></a></td>
                <td style="padding: 0 8px;"><a href="https://x.com/madridsalsa" target="_blank" style="text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/512/5968/5968830.png" alt="X (Twitter)" width="28" height="28" style="display: block; border: 0; border-radius: 50%;" /></a></td>
                <td style="padding: 0 8px;"><a href="https://www.linkedin.com/company/jose-madrid-salsa" target="_blank" style="text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/512/3536/3536505.png" alt="LinkedIn" width="28" height="28" style="display: block; border: 0; border-radius: 50%;" /></a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0 0 20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ebe5db; border-radius: 6px;">
              <tr>
                <td align="center" style="padding: 14px 20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding: 0 10px;"><a href="{{NEWSLETTER_PREFERENCES_URL}}" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #6b5d50; text-decoration: underline; letter-spacing: 0.3px;">Manage Preferences</a></td>
                      <td style="color: #c8bfb3; font-size: 11px;">&#8226;</td>
                      <td style="padding: 0 10px;"><a href="{{VIEW_IN_BROWSER_URL}}" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #6b5d50; text-decoration: underline; letter-spacing: 0.3px;">View in Browser</a></td>
                      <td style="color: #c8bfb3; font-size: 11px;">&#8226;</td>
                      <td style="padding: 0 10px;"><a href="{{FORWARD_TO_FRIEND_URL}}" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #6b5d50; text-decoration: underline; letter-spacing: 0.3px;">Forward to a Friend</a></td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0 20px 12px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.6; color: #a0948a;">
            You're receiving this email because you signed up for updates from José Madrid Salsa or made a purchase at josemadridsalsa.com.
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0 20px 8px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.6; color: #a0948a;">
            José Madrid Salsa &middot; Zanesville, OH 43701 &middot; (740) 521-4304
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0 0 32px 0;">
            <a href="{{UNSUBSCRIBE_URL}}" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; color: #c8102e; text-decoration: underline; letter-spacing: 0.3px;">Unsubscribe</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="border-top: 3px solid #c8102e; font-size: 0; line-height: 0;" height="1">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 16px 0 32px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 10px; color: #c0b6ab; letter-spacing: 0.3px;">
            &copy; 2026 José Madrid Salsa. All rights reserved.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`


export const emailTemplates: EmailTemplateDefinition[] = [
  // 1. Welcome Email
  {
    key: 'welcome_email',
    name: 'Welcome Email',
    subject: 'Welcome to Jose Madrid Salsa! 🌶️',
    category: 'TRANSACTIONAL',
    description: 'New customer onboarding email',
    variables: {
      name: 'string',
      discountCode: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Welcome</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('new-welcome.png', 'Welcome to the Family')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Thank you for joining the Jose Madrid Salsa community! We're thrilled to have you here and can't wait to add some heat to your kitchen.</p>
      <p style="margin-bottom:20px;">Since 1982, we've been crafting authentic salsas using time-honored recipes passed down through generations. Every jar is made with fresh ingredients and packed with flavor.</p>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;">🎁 Welcome Gift!</p>
        <p style="margin:0;color:#92400e;">Use code <strong>{{discountCode}}</strong> for 15% off your first order</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://www.josemadridsalsa.com/store" style="${baseStyles.button}">Start Shopping</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">What to Try First:</h3>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;"><strong>Mild Red Salsa</strong> - Perfect for beginners</li>
        <li style="margin-bottom:10px;"><strong>Fire Roasted Medium</strong> - Our most popular</li>
        <li style="margin-bottom:10px;"><strong>Habanero Hot</strong> - For heat seekers</li>
      </ul>
      <p style="margin-top:30px;">Questions? Reply to this email or call us at <a href="tel:7403493144" style="color:#dc2626;">740-349-3144</a>.</p>
      <p style="margin-top:20px;">Welcome aboard!</p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Hi {{name}},

Welcome to Jose Madrid Salsa! Thank you for joining our community.

Use code {{discountCode}} for 15% off your first order.

Shop now: https://www.josemadridsalsa.com/store

Questions? Call 740-349-3144 or reply to this email.

Jose Madrid Salsa Team`,
  },

  // 2. Order Confirmation
  {
    key: 'order_confirmation',
    name: 'Order Confirmation',
    subject: 'Order Confirmed #{{orderNumber}}',
    category: 'TRANSACTIONAL',
    description: 'Purchase receipt with order details',
    variables: {
      name: 'string',
      orderNumber: 'string',
      orderDate: 'string',
      orderTotal: 'string',
      orderItems: 'string',
      shippingAddress: 'string',
      trackingLink: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Order Confirmation</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('order-confirmed.png', 'Order Confirmed')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Thanks for your order! We've received your payment and are preparing your items for shipment.</p>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 15px;font-size:18px;">Order Summary</h3>
        <div style="margin-bottom:15px;">
          <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">Order Date</p>
          <p style="margin:0;font-size:16px;font-weight:600;">{{orderDate}}</p>
        </div>
        <hr style="${baseStyles.divider}">
        <div>{{orderItems}}</div>
        <hr style="${baseStyles.divider}">
        <div style="text-align:right;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#dc2626;">Total: {{orderTotal}}</p>
        </div>
      </div>
      <div style="background:#e7f5ff;padding:20px;border-radius:8px;border-left:4px solid:#1971c2;margin:30px 0;">
        <p style="margin:0 0 10px;color:#1864ab;font-weight:600;">📦 Shipping Address</p>
        <p style="margin:0;color:#1864ab;white-space:pre-line;">{{shippingAddress}}</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{trackingLink}}" style="${baseStyles.button}">Track Your Order</a>
      </div>
      <p style="color:#6c757d;font-size:14px;margin-top:30px;">Need help? Contact us at <a href="mailto:orders@josemadridsalsa.com" style="color:#dc2626;">orders@josemadridsalsa.com</a></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Hi {{name}},

Your order #{{orderNumber}} has been confirmed!

Order Date: {{orderDate}}
Total: {{orderTotal}}

Shipping Address:
{{shippingAddress}}

Track your order: {{trackingLink}}

Questions? Email orders@josemadridsalsa.com`,
  },

  // 3. Shipping Notification
  {
    key: 'shipping_notification',
    name: 'Shipping Notification',
    subject: 'Your Order is On the Way! 🚚',
    category: 'TRANSACTIONAL',
    description: 'Shipping confirmation with tracking',
    variables: {
      name: 'string',
      orderNumber: 'string',
      trackingNumber: 'string',
      trackingUrl: 'string',
      carrier: 'string',
      estimatedDelivery: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Shipped</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('shipping-notification.png', 'Your Order Has Shipped')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:30px;font-size:18px;">Great news! Your order #{{orderNumber}} is on its way to you.</p>
      <div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:30px;border-radius:12px;text-align:center;margin:30px 0;">
        <p style="color:#ffffff;margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Tracking Number</p>
        <p style="color:#ffffff;margin:0 0 20px;font-size:24px;font-weight:700;">{{trackingNumber}}</p>
        <a href="{{trackingUrl}}" style="display:inline-block;padding:12px 28px;background-color:#ffffff;color:#059669 !important;text-decoration:none;border-radius:6px;font-weight:600;">Track Package</a>
      </div>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;color:#6c757d;font-size:14px;">Carrier</p>
              <p style="margin:5px 0 0;font-weight:600;">{{carrier}}</p>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;">
              <p style="margin:0;color:#6c757d;font-size:14px;">Estimated Delivery</p>
              <p style="margin:5px 0 0;font-weight:600;color:#dc2626;">{{estimatedDelivery}}</p>
            </td>
          </tr>
        </table>
      </div>
      <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0;color:#856404;"><strong>📍 Tip:</strong> Make sure someone is available to receive the package or provide delivery instructions to your carrier.</p>
      </div>
      <p style="margin-top:30px;">We hope you enjoy your Jose Madrid Salsa! Share your creations with us on social media using #JoseMadridSalsa</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Hi {{name}},

Your order #{{orderNumber}} has shipped!

Tracking Number: {{trackingNumber}}
Carrier: {{carrier}}
Estimated Delivery: {{estimatedDelivery}}

Track your package: {{trackingUrl}}

Questions? Call 740-349-3144`,
  },

  // 4. Abandoned Cart
  {
    key: 'abandoned_cart',
    name: 'Abandoned Cart Reminder',
    subject: 'You Left Something Behind... 🛒',
    category: 'MARKETING',
    description: 'Cart abandonment reminder',
    variables: {
      name: 'string',
      cartItems: 'string',
      cartTotal: 'string',
      cartUrl: 'string',
      discountCode: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Cart Reminder</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('abandoned-cart.png', "Don't Miss Out")}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">We noticed you left some delicious items in your cart. They're still waiting for you!</p>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 20px;font-size:18px;">Items in Your Cart</h3>
        <div>{{cartItems}}</div>
        <hr style="${baseStyles.divider}">
        <div style="text-align:right;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#dc2626;">Total: {{cartTotal}}</p>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:25px;border-radius:12px;text-align:center;margin:30px 0;color:#ffffff;">
        <p style="margin:0 0 10px;font-size:16px;">Complete your order now and get</p>
        <p style="margin:0 0 20px;font-size:32px;font-weight:700;">10% OFF</p>
        <p style="margin:0 0 20px;font-size:14px;">Use code: <strong style="font-size:18px;letter-spacing:2px;">{{discountCode}}</strong></p>
        <a href="{{cartUrl}}" style="display:inline-block;padding:14px 32px;background-color:#ffffff;color:#dc2626 !important;text-decoration:none;border-radius:6px;font-weight:600;">Complete My Order</a>
      </div>
      <p style="color:#6c757d;font-size:14px;margin-top:30px;">This discount code expires in 24 hours.</p>
      <hr style="${baseStyles.divider}">
      <p style="margin-top:20px;"><strong>Why Choose Jose Madrid Salsa?</strong></p>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;">✓ Made with fresh, quality ingredients</li>
        <li style="margin-bottom:10px;">✓ Family recipes since 1982</li>
        <li style="margin-bottom:10px;">✓ Fast & reliable shipping</li>
        <li style="margin-bottom:10px;">✓ 100% satisfaction guaranteed</li>
      </ul>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Hi {{name}},

You left items in your cart! Complete your order and get 10% OFF with code {{discountCode}}.

Cart Total: {{cartTotal}}

Complete your order: {{cartUrl}}

This offer expires in 24 hours!`,
  },

  // 5. Product Launch
  {
    key: 'product_launch',
    name: 'Product Launch Announcement',
    subject: '🔥 NEW: {{productName}} Just Dropped!',
    category: 'MARKETING',
    description: 'New product announcement',
    variables: {
      productName: 'string',
      productDescription: 'string',
      productImage: 'string',
      productPrice: 'string',
      productUrl: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>New Product</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('product-launch.png', 'New Product Launch')}
    </div>
    <div style="text-align:center;padding:0;">
      <img src="{{productImage}}" alt="{{productName}}" style="width:100%;max-width:600px;display:block;" />
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:18px;margin-bottom:25px;line-height:1.6;">{{productDescription}}</p>
      <div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);padding:30px;border-radius:12px;text-align:center;margin:30px 0;">
        <p style="margin:0 0 10px;color:#92400e;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Special Launch Price</p>
        <p style="margin:0 0 25px;color:#92400e;font-size:36px;font-weight:700;">{{productPrice}}</p>
        <a href="{{productUrl}}" style="${baseStyles.button}background-color:#dc2626;">Order Now</a>
      </div>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 15px;font-size:18px;">What Makes It Special:</h3>
        <ul style="padding-left:20px;margin:0;">
          <li style="margin-bottom:10px;">Small-batch crafted for maximum freshness</li>
          <li style="margin-bottom:10px;">Made with locally sourced peppers</li>
          <li style="margin-bottom:10px;">Perfect balance of heat and flavor</li>
          <li>Limited first run - order while supplies last!</li>
        </ul>
      </div>
      <div style="background:#e7f5ff;border-left:4px solid#1971c2;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0;color:#1864ab;"><strong>🌟 Early Bird Bonus:</strong> Orders placed in the next 48 hours get a FREE recipe card collection!</p>
      </div>
      <p style="margin-top:30px;text-align:center;font-size:16px;">Join our community of salsa lovers and never miss a new release!</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `NEW PRODUCT LAUNCH: {{productName}}

{{productDescription}}

Special Launch Price: {{productPrice}}

Order now: {{productUrl}}

Early bird bonus: FREE recipe cards with orders in next 48 hours!`,
  },

  // 6. Newsletter
  {
    key: 'monthly_newsletter',
    name: 'Monthly Newsletter',
    subject: 'The Salsa Scoop: {{month}} Edition 📰',
    category: 'MARKETING',
    description: 'Monthly updates and stories',
    variables: {
      month: 'string',
      featuredRecipe: 'string',
      recipeLink: 'string',
      newsUpdate: 'string',
      specialOffer: 'string',
      offerCode: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Newsletter</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('newsletter.png', 'The Salsa Scoop Newsletter')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:30px;">Hello Salsa Lovers! Here's what's cooking this month at Jose Madrid Salsa.</p>
      
      <div style="margin:40px 0;">
        <h2 style="color:#dc2626;font-size:24px;margin:0 0 15px;border-bottom:3px solid #dc2626;padding-bottom:10px;">🍴 Featured Recipe</h2>
        <h3 style="font-size:20px;margin:0 0 15px;">{{featuredRecipe}}</h3>
        <p style="margin-bottom:20px;">Try this month's featured recipe using our signature salsa. Perfect for family dinners or entertaining guests!</p>
        <a href="{{recipeLink}}" style="color:#dc2626;text-decoration:none;font-weight:600;">Get the Full Recipe →</a>
      </div>
      
      <hr style="${baseStyles.divider}">
      
      <div style="margin:40px 0;">
        <h2 style="color:#dc2626;font-size:24px;margin:0 0 15px;border-bottom:3px solid #dc2626;padding-bottom:10px;">📣 What's New</h2>
        <p style="line-height:1.8;">{{newsUpdate}}</p>
      </div>
      
      <hr style="${baseStyles.divider}">
      
      <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:35px;border-radius:12px;text-align:center;margin:40px 0;color:#ffffff;">
        <h2 style="margin:0 0 15px;font-size:26px;">This Month's Special</h2>
        <p style="margin:0 0 20px;font-size:18px;line-height:1.6;">{{specialOffer}}</p>
        <p style="margin:0 0 25px;font-size:16px;">Use code: <strong style="font-size:20px;letter-spacing:2px;background-color:rgba(255,255,255,0.2);padding:8px 16px;border-radius:6px;">{{offerCode}}</strong></p>
        <a href="https://www.josemadridsalsa.com/store" style="display:inline-block;padding:14px 32px;background-color:#ffffff;color:#dc2626 !important;text-decoration:none;border-radius:6px;font-weight:600;">Shop Now</a>
      </div>
      
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 15px;font-size:18px;">📍 Where to Find Us</h3>
        <p style="margin:0;line-height:1.6;">Visit us at farmers markets, food festivals, and retail locations throughout Ohio. Check our website for the latest schedule!</p>
      </div>
      
      <p style="margin-top:40px;text-align:center;font-size:16px;">Thank you for being part of our community!</p>
      <p style="text-align:center;margin-top:10px;"><strong>- The Jose Madrid Salsa Family</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `THE SALSA SCOOP - {{month}} Edition

FEATURED RECIPE: {{featuredRecipe}}
{{recipeLink}}

WHAT'S NEW:
{{newsUpdate}}

THIS MONTH'S SPECIAL:
{{specialOffer}}
Use code: {{offerCode}}

Shop: https://www.josemadridsalsa.com/store`,
  },

  // 7. Event Invitation
  {
    key: 'event_invitation',
    name: 'Event Invitation',
    subject: 'You\'re Invited: {{eventName}} 🎉',
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

RSVP now: {{rsvpUrl}}

Space is limited!

Questions? Call 740-349-3144`,
  },

  // 8. Wholesale Welcome
  {
    key: 'wholesale_welcome',
    name: 'Wholesale Welcome',
    subject: 'Welcome to Our Wholesale Program! 🤝',
    category: 'TRANSACTIONAL',
    description: 'B2B partner onboarding',
    variables: {
      businessName: 'string',
      contactName: 'string',
      accountManager: 'string',
      accountManagerEmail: 'string',
      accountManagerPhone: 'string',
      discountRate: 'string',
      orderPortalUrl: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Wholesale Welcome</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('wholesale-welcome.png', 'Welcome to Wholesale')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Dear {{contactName}},</p>
      <p style="margin-bottom:20px;">We're excited to partner with {{businessName}} as an official Jose Madrid Salsa wholesale customer! Thank you for choosing to carry our products.</p>
      
      <div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:30px;border-radius:12px;text-align:center;margin:30px 0;color:#ffffff;">
        <p style="margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Your Wholesale Discount</p>
        <p style="margin:0;font-size:42px;font-weight:700;">{{discountRate}}</p>
      </div>
      
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 20px;font-size:20px;">Your Account Manager</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;">
              <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">Name</p>
              <p style="margin:0;font-weight:600;">{{accountManager}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;">
              <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">Email</p>
              <p style="margin:0;"><a href="mailto:{{accountManagerEmail}}" style="color:#dc2626;">{{accountManagerEmail}}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;">
              <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">Phone</p>
              <p style="margin:0;"><a href="tel:{{accountManagerPhone}}" style="color:#dc2626;">{{accountManagerPhone}}</a></p>
            </td>
          </tr>
        </table>
      </div>
      
      <div style="text-align:center;margin:30px 0;">
        <a href="{{orderPortalUrl}}" style="${baseStyles.button}">Access Order Portal</a>
      </div>
      
      <div style="margin:30px 0;">
        <h3 style="color:#dc2626;font-size:20px;margin:0 0 15px;">What's Included:</h3>
        <ul style="padding-left:20px;">
          <li style="margin-bottom:12px;"><strong>Priority Ordering:</strong> Online portal with order history tracking</li>
          <li style="margin-bottom:12px;"><strong>Marketing Support:</strong> Point-of-sale materials, shelf talkers, and digital assets</li>
          <li style="margin-bottom:12px;"><strong>Product Training:</strong> Staff tasting kits and product knowledge sheets</li>
          <li style="margin-bottom:12px;"><strong>Flexible Terms:</strong> Net 30 payment options for qualified accounts</li>
          <li><strong>Dedicated Support:</strong> Direct line to your account manager</li>
        </ul>
      </div>
      
      <div style="background:#e7f5ff;border-left:4px solid #1971c2;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#1864ab;font-weight:600;">📦 First Order Bonus</p>
        <p style="margin:0;color:#1864ab;">Orders over $500 ship free and include a POS display kit!</p>
      </div>
      
      <hr style="${baseStyles.divider}">
      
      <p style="margin-top:30px;"><strong>Next Steps:</strong></p>
      <ol style="padding-left:20px;line-height:1.8;">
        <li>Log in to your wholesale portal</li>
        <li>Review our current product catalog</li>
        <li>Schedule a call with {{accountManager}} if needed</li>
        <li>Place your first order!</li>
      </ol>
      
      <p style="margin-top:30px;">We're here to help you succeed. Don't hesitate to reach out with questions or for support.</p>
      <p style="margin-top:20px;"><strong>Welcome to the Jose Madrid Salsa family!</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Welcome to Jose Madrid Salsa Wholesale, {{businessName}}!

Your wholesale discount: {{discountRate}}

Your Account Manager:
{{accountManager}}
{{accountManagerEmail}}
{{accountManagerPhone}}

Access your wholesale portal: {{orderPortalUrl}}

First order over $500 ships free!

Questions? Contact {{accountManager}} directly.`,
  },

  // 9. Fundraiser Kickoff
  {
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

Let\'s reach that goal together!`,
  },

  // 10. Thank You
  {
    key: 'thank_you',
    name: 'Thank You Email',
    subject: 'Thank You for Your Order! 💚',
    category: 'TRANSACTIONAL',
    description: 'Post-purchase appreciation',
    variables: {
      name: 'string',
      orderNumber: 'string',
      reviewUrl: 'string',
      referralCode: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Thank You</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('thank-you.png', 'Thank You')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Dear {{name}},</p>
      <p style="margin-bottom:20px;font-size:18px;">We wanted to take a moment to personally thank you for your order #{{orderNumber}}.</p>
      <p style="margin-bottom:30px;">Your support means the world to our family business and helps us continue crafting authentic salsa using recipes passed down through generations.</p>
      
      <div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:35px;border-radius:12px;text-align:center;margin:30px 0;color:#ffffff;">
        <h2 style="margin:0 0 15px;font-size:26px;">We Hope You Love It!</h2>
        <p style="margin:0;font-size:16px;line-height:1.6;">Once you've had a chance to taste your salsa, we'd love to hear what you think.</p>
      </div>
      
      <div style="text-align:center;margin:30px 0;">
        <a href="{{reviewUrl}}" style="${baseStyles.button}background-color:#10b981;">Leave a Review</a>
      </div>
      
      <hr style="${baseStyles.divider}">
      
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 15px;font-size:20px;">🎁 Share the Love, Get Rewarded</h3>
        <p style="margin:0 0 15px;">Know someone who'd love Jose Madrid Salsa? Give them 15% off their first order with your personal referral code:</p>
        <div style="background:#ffffff;padding:15px;border-radius:6px;text-align:center;border:2px dashed #dc2626;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#dc2626;letter-spacing:2px;">{{referralCode}}</p>
        </div>
        <p style="margin:15px 0 0;font-size:14px;color:#6c757d;text-align:center;">You'll earn $10 credit when they make their first purchase!</p>
      </div>
      
      <div style="background:#e7f5ff;border-left:4px solid #1971c2;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#1864ab;font-weight:600;">📸 Show Us Your Creations!</p>
        <p style="margin:0;color:#1864ab;">Tag us <strong>@JoseMadridSalsa</strong> on social media for a chance to be featured and win free products!</p>
      </div>
      
      <hr style="${baseStyles.divider}">
      
      <div style="margin:30px 0;">
        <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">Ways to Enjoy Your Salsa:</h3>
        <ul style="padding-left:20px;">
          <li style="margin-bottom:10px;">Classic chips & salsa (obviously!)</li>
          <li style="margin-bottom:10px;">Mix into scrambled eggs or omelets</li>
          <li style="margin-bottom:10px;">Top grilled chicken or fish</li>
          <li style="margin-bottom:10px;">Stir into soups and chilis</li>
          <li>Use as a marinade base</li>
        </ul>
        <p style="margin-top:15px;"><a href="https://www.josemadridsalsa.com/recipes" style="color:#dc2626;font-weight:600;">Browse All Recipes →</a></p>
      </div>
      
      <p style="margin-top:40px;">Thank you again for choosing Jose Madrid Salsa. We're honored to be part of your kitchen!</p>
      <p style="margin-top:20px;"><strong>With gratitude,</strong><br>The Jose Madrid Family</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Dear {{name}},

Thank you for your order #{{orderNumber}}!

Your support means everything to our family business.

LEAVE A REVIEW: {{reviewUrl}}

REFER A FRIEND:
Give them 15% off with code: {{referralCode}}
You'll earn $10 when they order!

Show us your creations on social media @JoseMadridSalsa

Thank you for choosing Jose Madrid Salsa!

The Jose Madrid Family`,
  },

  // 11. Password Reset
  {
    key: 'password_reset',
    name: 'Password Reset',
    subject: 'Reset Your Password - Jose Madrid Salsa',
    category: 'TRANSACTIONAL',
    description: 'Password reset email with secure link',
    variables: {
      name: 'string',
      resetUrl: 'string',
      expiresIn: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Reset Password</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('password-reset.png', 'Reset Your Password')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">We received a request to reset your password for your Jose Madrid Salsa account.</p>
      <p style="margin-bottom:20px;">Click the button below to create a new password:</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{resetUrl}}" style="${baseStyles.button}">Reset Password</a>
      </div>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;">⏰ Link expires in {{expiresIn}}</p>
        <p style="margin:0;color:#92400e;font-size:14px;">For your security, this link will only work once and expires after the time limit.</p>
      </div>
      <p style="margin-top:30px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      <hr style="${baseStyles.divider}">
      <p style="font-size:14px;color:#6c757d;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="font-size:14px;color:#dc2626;word-break:break-all;">{{resetUrl}}</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Hi {{name}},

We received a request to reset your password for your Jose Madrid Salsa account.

Reset your password here: {{resetUrl}}

This link expires in {{expiresIn}} and will only work once.

If you didn't request this, you can safely ignore this email.

Jose Madrid Salsa Support`,
  },

  // 12. Email Verification
  {
    key: 'email_verification',
    name: 'Email Verification',
    subject: 'Verify Your Email Address',
    category: 'TRANSACTIONAL',
    description: 'Email confirmation for new accounts',
    variables: {
      name: 'string',
      verificationUrl: 'string',
      code: 'string',
      expiresIn: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Verify Email</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('account-creation.png', 'Verify Your Email')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Thanks for signing up! We just need to verify your email address to complete your registration.</p>
      <p style="margin-bottom:20px;">Click the button below to verify your email:</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{verificationUrl}}" style="${baseStyles.button}">Verify Email Address</a>
      </div>
      <div style="background:#e0f2fe;border-left:4px solid:#0284c7;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#075985;font-weight:600;">Or use this verification code:</p>
        <p style="margin:0;color:#075985;font-size:24px;font-weight:700;letter-spacing:4px;font-family:monospace;">{{code}}</p>
      </div>
      <p style="margin-top:20px;font-size:14px;color:#6c757d;">This code expires in {{expiresIn}}.</p>
      <hr style="${baseStyles.divider}">
      <p style="font-size:14px;color:#6c757d;">If you didn't create an account, please ignore this email.</p>
      <p style="font-size:14px;color:#6c757d;word-break:break-all;margin-top:20px;">Verification link: {{verificationUrl}}</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Hi {{name}},

Thanks for signing up! Please verify your email address to complete registration.

Verify here: {{verificationUrl}}

Or use this code: {{code}}

This code expires in {{expiresIn}}.

If you didn't create an account, please ignore this email.

Jose Madrid Salsa Team`,
  },

  // 13. Order Delivered
  {
    key: 'order_delivered',
    name: 'Order Delivered',
    subject: 'Your Order Has Been Delivered! 📦',
    category: 'TRANSACTIONAL',
    description: 'Delivery confirmation with review request',
    variables: {
      name: 'string',
      orderNumber: 'string',
      deliveryDate: 'string',
      reviewUrl: 'string',
      orderItems: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Order Delivered</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('order-delivered.png', 'Your Order Arrived')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Great news! Your order #{{orderNumber}} was delivered on {{deliveryDate}}.</p>
      <div style="background:#dcfce7;border-left:4px solid:#16a34a;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#166534;font-weight:600;">✓ Delivery Confirmed</p>
        <p style="margin:0;color:#166534;">Your package should now be at your doorstep. We hope you enjoy every bite!</p>
      </div>
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">Items Delivered:</h3>
      <div style="background:#f9fafb;padding:20px;border-radius:8px;margin-bottom:30px;">
        {{orderItems}}
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">How Did We Do?</h3>
      <p style="margin-bottom:20px;">We'd love to hear your feedback! Your review helps other salsa lovers make great choices.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{reviewUrl}}" style="${baseStyles.button}">Leave a Review</a>
      </div>
      <p style="margin-top:30px;font-size:14px;color:#6c757d;">As a thank you for leaving a review, we'll send you a special discount code for your next order!</p>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">🌮 Try These Recipes:</h3>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;"><a href="https://www.josemadridsalsa.com/recipes/salsa-verde-chicken" style="color:#dc2626;text-decoration:none;">Salsa Verde Chicken Enchiladas</a></li>
        <li style="margin-bottom:10px;"><a href="https://www.josemadridsalsa.com/recipes/breakfast-burrito" style="color:#dc2626;text-decoration:none;">Ultimate Breakfast Burrito</a></li>
        <li style="margin-bottom:10px;"><a href="https://www.josemadridsalsa.com/recipes/fish-tacos" style="color:#dc2626;text-decoration:none;">Baja Fish Tacos</a></li>
      </ul>
      <p style="margin-top:30px;">Enjoy your salsa!</p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Hi {{name}},

Great news! Your order #{{orderNumber}} was delivered on {{deliveryDate}}.

We hope you enjoy every bite!

HOW DID WE DO?
Leave a review and get a special discount code: {{reviewUrl}}

TRY THESE RECIPES:
- Salsa Verde Chicken Enchiladas
- Ultimate Breakfast Burrito
- Baja Fish Tacos

Visit: https://www.josemadridsalsa.com/recipes

Enjoy your salsa!

The Jose Madrid Salsa Team`,
  },

  // 14. Refund Processed
  {
    key: 'refund_processed',
    name: 'Refund Processed',
    subject: 'Refund Processed for Order #{{orderNumber}}',
    category: 'TRANSACTIONAL',
    description: 'Refund confirmation with timeline',
    variables: {
      name: 'string',
      orderNumber: 'string',
      refundAmount: 'string',
      refundMethod: 'string',
      processingDays: 'string',
      originalOrderDate: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Refund Processed</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('refund-processed.png', 'Refund Processed')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Your refund for order #{{orderNumber}} has been processed.</p>
      <div style="background:#f9fafb;border:1px solid #e2e8f0;border-radius:8px;padding:24px;margin:30px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;color:#6c757d;">Refund Amount:</td>
            <td style="padding:12px 0;text-align:right;font-weight:600;font-size:20px;color:#16a34a;">{{refundAmount}}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;color:#6c757d;">Refund Method:</td>
            <td style="padding:12px 0;text-align:right;font-weight:600;">{{refundMethod}}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;color:#6c757d;">Order Date:</td>
            <td style="padding:12px 0;text-align:right;">{{originalOrderDate}}</td>
          </tr>
          <tr>
            <td style="padding:12px 0;color:#6c757d;">Expected in Account:</td>
            <td style="padding:12px 0;text-align:right;font-weight:600;">{{processingDays}}</td>
          </tr>
        </table>
      </div>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;">⏰ Processing Time</p>
        <p style="margin:0;color:#92400e;">Please allow {{processingDays}} for the refund to appear in your account, depending on your financial institution.</p>
      </div>
      <p style="margin-top:30px;">We're sorry things didn't work out this time. We're always working to improve our products and service.</p>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">We'd Love Your Feedback</h3>
      <p style="margin-bottom:20px;">If you have a moment, please let us know what went wrong so we can make it right:</p>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;">Did the product not meet your expectations?</li>
        <li style="margin-bottom:10px;">Was there an issue with delivery?</li>
        <li style="margin-bottom:10px;">Something else we should know?</li>
      </ul>
      <p style="margin-top:20px;">Reply to this email or call us at <a href="tel:7403493144" style="color:#dc2626;">740-349-3144</a>. We're here to help!</p>
      <p style="margin-top:30px;">Thank you for giving us a try.</p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Hi {{name}},

Your refund for order #{{orderNumber}} has been processed.

REFUND DETAILS:
Amount: {{refundAmount}}
Method: {{refundMethod}}
Expected in Account: {{processingDays}}

Please allow {{processingDays}} for the refund to appear in your account.

We'd love your feedback on what went wrong. Reply to this email or call 740-349-3144.

Thank you for giving us a try.

The Jose Madrid Salsa Team`,
  },

  // 15. Account Created
  {
    key: 'account_created',
    name: 'Account Created',
    subject: 'Your Account is Ready!',
    category: 'TRANSACTIONAL',
    description: 'Admin-created account welcome email',
    variables: {
      name: 'string',
      email: 'string',
      loginUrl: 'string',
      accountType: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Account Created</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('jose-madrid-welcome.png', 'Welcome to Jose Madrid Salsa')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Great news! Your {{accountType}} account has been created and is ready to use.</p>
      <div style="background:#dcfce7;border-left:4px solid:#16a34a;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#166534;font-weight:600;">✓ Account Active</p>
        <p style="margin:0;color:#166534;">You can now access your account and start exploring.</p>
      </div>
      <div style="background:#f9fafb;border:1px solid #e2e8f0;border-radius:8px;padding:24px;margin:30px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:12px 0;color:#6c757d;width:40%;">Account Type:</td>
            <td style="padding:12px 0;font-weight:600;">{{accountType}}</td>
          </tr>
          <tr>
            <td style="padding:12px 0;color:#6c757d;">Email:</td>
            <td style="padding:12px 0;font-weight:600;">{{email}}</td>
          </tr>
        </table>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{loginUrl}}" style="${baseStyles.button}">Log In to Your Account</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">Getting Started:</h3>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;"><strong>Set your password</strong> - Check your email for a password setup link</li>
        <li style="margin-bottom:10px;"><strong>Complete your profile</strong> - Add your shipping and billing information</li>
        <li style="margin-bottom:10px;"><strong>Browse products</strong> - Check out our full line of authentic salsas</li>
      </ul>
      <p style="margin-top:30px;">If you have any questions about your account or need assistance getting started, we're here to help!</p>
      <p style="margin-top:20px;">Call us at <a href="tel:7403493144" style="color:#dc2626;">740-349-3144</a> or reply to this email.</p>
      <p style="margin-top:30px;">Welcome to the family!</p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Hi {{name}},

Your {{accountType}} account has been created and is ready to use!

ACCOUNT DETAILS:
Type: {{accountType}}
Email: {{email}}

Log in here: {{loginUrl}}

GETTING STARTED:
1. Set your password (check your email)
2. Complete your profile
3. Browse our products

Questions? Call 740-349-3144 or email support@josemadridsalsa.com

Welcome to the family!

The Jose Madrid Salsa Team`,
  },
  // 16. Subscription Renewal
  {
    key: 'subscription_renewal',
    name: 'Subscription Renewal',
    subject: 'Your Upcoming Subscription Renewal',
    category: 'TRANSACTIONAL',
    description: 'Recurring order confirmation and reminder',
    variables: {
      name: 'string',
      subscriptionName: 'string',
      renewalDate: 'string',
      renewalPrice: 'string',
      manageSubscriptionUrl: 'string',
      orderItems: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Subscription Renewal</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('renew-subscription.png', 'Subscription Renewal')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">This is a reminder that your {{subscriptionName}} subscription is scheduled to renew on <strong>{{renewalDate}}</strong>.</p>
      <div style="background:#f9fafb;border:1px solid #e2e8f0;border-radius:8px;padding:24px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 20px;font-size:18px;">Renewal Details</h3>
        <div style="margin-bottom:15px;">{{orderItems}}</div>
        <hr style="${baseStyles.divider}">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#6c757d;">Renewal Price:</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;font-size:18px;">{{renewalPrice}}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6c757d;">Renewal Date:</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;">{{renewalDate}}</td>
          </tr>
        </table>
      </div>
      <div style="background:#e7f5ff;border-left:4px solid #1971c2;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0;color:#1864ab;">No action is needed. Your order will be processed automatically. To make changes to your subscription, please visit your account dashboard.</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{manageSubscriptionUrl}}" style="${baseStyles.button}">Manage Subscription</a>
      </div>
      <p style="margin-top:30px;">Thank you for being a loyal subscriber!</p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Hi {{name}},

This is a reminder that your {{subscriptionName}} subscription is scheduled to renew on {{renewalDate}}.

RENEWAL DETAILS:
{{orderItems}}
Price: {{renewalPrice}}
Date: {{renewalDate}}

No action is needed. Your order will be processed automatically.

To make changes, visit: {{manageSubscriptionUrl}}

Thank you for being a loyal subscriber!
The Jose Madrid Salsa Team`,
    },
    // 17. Payment Failed
    {
      key: 'payment_failed',
      name: 'Payment Failed',
      subject: 'Action Required: Your Payment Failed',
      category: 'TRANSACTIONAL',
      description: 'Failed payment notification with retry link',
      variables: {
        name: 'string',
        orderNumber: 'string',
        amountDue: 'string',
        updatePaymentUrl: 'string',
      },
      html: `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Payment Failed</title></head>
  <body style="${baseStyles.container}">
    <div style="${baseStyles.wrapper}">
      <div style="${baseStyles.header}">
        ${headerImg('payment-failure.png', 'Payment Failed')}
      </div>
      <div style="${baseStyles.content}">
        <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
        <p style="margin-bottom:20px;">Unfortunately, we were unable to process the payment for your recent order #{{orderNumber}}.</p>
        <div style="background:#ffe3e3;border-left:4px solid #dc2626;padding:20px;margin:30px 0;border-radius:6px;">
          <p style="margin:0 0 10px;color:#991b1b;font-weight:600;">Action Required</p>
          <p style="margin:0;color:#991b1b;">Please update your payment information to keep your order active. Amount due: <strong>{{amountDue}}</strong></p>
        </div>
        <div style="text-align:center;margin:30px 0;">
          <a href="{{updatePaymentUrl}}" style="${baseStyles.button}">Update Payment Info</a>
        </div>
        <p style="margin-top:30px;">If your payment information is not updated within 3 days, your order will be automatically canceled.</p>
        <p style="margin-top:20px;">If you have any questions, please contact us at <a href="mailto:support@josemadridsalsa.com" style="color:#dc2626;">support@josemadridsalsa.com</a>.</p>
      </div>
      ${jmsFooter}
    </div>
  </body>
  </html>`,
      text: `Hi {{name}},
  
  Your payment for order #{{orderNumber}} failed.
  
  Amount due: {{amountDue}}
  
  Please update your payment information: {{updatePaymentUrl}}
  
  If not updated within 3 days, your order will be canceled.
  
  Questions? Email support@josemadridsalsa.com`,
    },
    // 18. Wholesale Order Confirmation
    {
      key: 'wholesale_order_confirmation',
      name: 'Wholesale Order Confirmation',
      subject: 'Wholesale Order #{{orderNumber}} Confirmed',
      category: 'TRANSACTIONAL',
      description: 'B2B order confirmation',
      variables: {
        businessName: 'string',
        orderNumber: 'string',
        orderDate: 'string',
        orderTotal: 'string',
        orderItems: 'string',
        shippingAddress: 'string',
      },
      html: `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Wholesale Order Confirmation</title></head>
  <body style="${baseStyles.container}">
    <div style="${baseStyles.wrapper}">
      <div style="${baseStyles.header}">
        ${headerImg('wholesale-order-confirm.png', 'Wholesale Order Confirmed')}
      </div>
      <div style="${baseStyles.content}">
        <p style="font-size:16px;margin-bottom:20px;">Hello {{businessName}},</p>
        <p style="margin-bottom:20px;">Thank you for your wholesale order. We are preparing your items for shipment.</p>
        <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
          <h3 style="color:#333;margin:0 0 15px;font-size:18px;">Order Summary</h3>
          <p><strong>Order Date:</strong> {{orderDate}}</p>
          <hr style="${baseStyles.divider}">
          {{orderItems}}
          <hr style="${baseStyles.divider}">
          <p style="text-align:right;font-size:20px;font-weight:700;color:#dc2626;">Total: {{orderTotal}}</p>
        </div>
        <div style="background:#e7f5ff;padding:20px;border-radius:8px;border-left:4px solid:#1971c2;margin:30px 0;">
          <p style="margin:0 0 10px;color:#1864ab;font-weight:600;">📦 Shipping Address</p>
          <p style="margin:0;color:#1864ab;white-space:pre-line;">{{shippingAddress}}</p>
        </div>
        <p style="margin-top:30px;">For any questions regarding your order, please contact your account manager.</p>
      </div>
      ${jmsFooter}
    </div>
  </body>
  </html>`,
      text: `Hello {{businessName}},
  
  Thank you for your wholesale order #{{orderNumber}}.
  
  Order Date: {{orderDate}}
  Total: {{orderTotal}}
  
  Shipping Address:
  {{shippingAddress}}
  
  For questions, contact your account manager.
  
  Thank you for your partnership!`,
    },
    // 19. Fundraiser Update
    {
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
    },
    // 20. Order Cancellation
    {
      key: 'order_cancellation',
      name: 'Order Cancellation',
      subject: 'Your Order #{{orderNumber}} Has Been Canceled',
      category: 'TRANSACTIONAL',
      description: 'Cancellation confirmation',
      variables: {
        name: 'string',
        orderNumber: 'string',
        cancellationDate: 'string',
      },
      html: `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Order Canceled</title></head>
  <body style="${baseStyles.container}">
    <div style="${baseStyles.wrapper}">
      <div style="${baseStyles.header}">
        ${headerImg('order-cancellation.png', 'Order Canceled')}
      </div>
      <div style="${baseStyles.content}">
        <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
        <p style="margin-bottom:20px;">Your order #{{orderNumber}} has been canceled as of {{cancellationDate}}.</p>
        <div style="background:#ffe3e3;border-left:4px solid #dc2626;padding:20px;margin:30px 0;border-radius:6px;">
          <p style="margin:0;color:#991b1b;">If you did not request this cancellation, please contact us immediately at <a href="mailto:support@josemadridsalsa.com" style="color:#991b1b;">support@josemadridsalsa.com</a>.</p>
        </div>
        <p style="margin-top:30px;">If you have any questions, feel free to reach out. We're here to help.</p>
      </div>
      ${jmsFooter}
    </div>
  </body>
  </html>`,
            text: `Hi {{name}},
        
        Your order #{{orderNumber}} has been canceled as of {{cancellationDate}}.
        
        If you did not request this, please contact us immediately at support@josemadridsalsa.com.
        
        If you have any questions, feel free to reach out.`,
          },
          // 21. Flash Sale
          {
            key: 'flash_sale',
            name: 'Flash Sale',
            subject: '⚡ Flash Sale! 25% Off EVERYTHING! ⚡',
            category: 'MARKETING',
            description: 'Time-sensitive promotions with countdown',
            variables: {
              name: 'string',
              saleEndDate: 'string',
              shopUrl: 'string',
            },
            html: `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Flash Sale</title></head>
        <body style="${baseStyles.container}">
          <div style="${baseStyles.wrapper}">
            <div style="${baseStyles.header}">
              ${headerImg('flash-sale.png', 'Flash Sale')}
            </div>
            <div style="${baseStyles.content}">
              <p style="font-size:24px;font-weight:bold;text-align:center;color:#dc2626;">25% Off Everything!</p>
              <p style="font-size:16px;text-align:center;margin-bottom:30px;">For a limited time, get 25% off your entire order. No code needed!</p>
              <div style="text-align:center;margin:30px 0;">
                <a href="{{shopUrl}}" style="${baseStyles.button}">Shop Now</a>
              </div>
              <p style="font-size:14px;text-align:center;">Hurry, this sale ends on {{saleEndDate}}.</p>
            </div>
            ${jmsFooter}
          </div>
        </body>
        </html>`,
                  text: `Flash Sale! Get 25% off everything. No code needed.
              
                    Shop now: {{shopUrl}}
                    
                    Hurry, sale ends {{saleEndDate}}.`,
                },
                // 22. Seasonal Summer
                {
                  key: 'seasonal_summer',
                  name: 'Seasonal Summer',
                  subject: '☀️ Summer is Here! Time to Grill!',
                  category: 'MARKETING',
                  description: 'Summer/BBQ season campaigns',
                  variables: {
                    name: 'string',
                    productName: 'string',
                    productUrl: 'string',
                    recipeName: 'string',
                    recipeUrl: 'string',
                  },
                  html: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Summer Sale</title></head>
              <body style="${baseStyles.container}">
                <div style="${baseStyles.wrapper}">
                  <div style="${baseStyles.header}">
                    ${headerImg('summer.png', 'Summer is Here')}
                  </div>
                  <div style="${baseStyles.content}">
                    <p style="font-size:18px;text-align:center;">Fire up the grill and get ready for a season of flavor!</p>
                    <p style="text-align:center;margin-bottom:30px;">Our {{productName}} is the perfect companion for all your summer BBQs.</p>
                    <div style="text-align:center;margin:30px 0;">
                      <a href="{{productUrl}}" style="${baseStyles.button}">Shop Summer Flavors</a>
                    </div>
                    <p style="font-size:16px;text-align:center;">Need some inspiration? Check out our new recipe for <strong>{{recipeName}}</strong>!</p>
                    <div style="text-align:center;margin:30px 0;">
                      <a href="{{recipeUrl}}" style="color:#dc2626;text-decoration:underline;">Get the Recipe</a>
                    </div>
                  </div>
                  ${jmsFooter}
                </div>
              </body>
              </html>`,
                  text: `Summer is here! Time to grill!
            
            Our {{productName}} is the perfect companion for all your summer BBQs.
            Shop now: {{productUrl}}
            
            Need inspiration? Check out our new recipe for {{recipeName}}: {{recipeUrl}}
            
            Happy Grilling!`,
                },
                // 23. Seasonal Fall
                {
                    key: 'seasonal_fall',
                    name: 'Seasonal Fall',
                    subject: '🏈 Game Day Never Tasted So Good!',
                    category: 'MARKETING',
                    description: 'Fall/game day campaigns',
                    variables: {
                        name: 'string',
                        productName: 'string',
                        productUrl: 'string',
                        discountCode: 'string',
                    },
                    html: `
                <!DOCTYPE html>
                <html lang="en">
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Fall Sale</title></head>
                <body style="${baseStyles.container}">
                    <div style="${baseStyles.wrapper}">
                    <div style="${baseStyles.header}">
                        ${headerImg('fall.png', 'Game Day Ready')}
                    </div>
                    <div style="${baseStyles.content}">
                        <p style="font-size:18px;text-align:center;">The weather is cooling down, but the salsa is heating up!</p>
                        <p style="text-align:center;margin-bottom:30px;">Score a touchdown at your next tailgate with our {{productName}}.</p>
                        <div style="text-align:center;margin:30px 0;">
                        <a href="{{productUrl}}" style="${baseStyles.button}">Shop Game Day Salsas</a>
                        </div>
                        <p style="font-size:16px;text-align:center;">Use code <strong>{{discountCode}}</strong> for 15% off your next order.</p>
                    </div>
                    ${jmsFooter}
                    </div>
                </body>
                </html>`,
                    text: `Game Day Never Tasted So Good!
                
                Score a touchdown at your next tailgate with our {{productName}}.
                Shop now: {{productUrl}}
                
                Use code {{discountCode}} for 15% off your next order.`,
                },
                // 24. Seasonal Holiday
                {
                  key: 'seasonal_holiday',
                  name: 'Seasonal Holiday',
                  subject: '🎄 Holiday Gifting Made Easy!',
                  category: 'MARKETING',
                  description: 'Holiday gift sets and party packs',
                  variables: {
                    name: 'string',
                    giftGuideUrl: 'string',
                    shippingDeadline: 'string',
                  },
                  html: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Holiday Sale</title></head>
              <body style="${baseStyles.container}">
                <div style="${baseStyles.wrapper}">
                  <div style="${baseStyles.header}">
                    ${headerImg('christmas.png', 'Happy Holidays')}
                  </div>
                  <div style="${baseStyles.content}">
                    <p style="font-size:18px;text-align:center;">Find the perfect gift for the salsa lover in your life!</p>
                    <p style="text-align:center;margin-bottom:30px;">Our holiday gift sets are here and ready to ship.</p>
                    <div style="text-align:center;margin:30px 0;">
                      <a href="{{giftGuideUrl}}" style="${baseStyles.button}">Shop the Holiday Gift Guide</a>
                    </div>
                    <p style="font-size:14px;text-align:center;">Order by <strong>{{shippingDeadline}}</strong> to ensure delivery by Christmas!</p>
                  </div>
                  ${jmsFooter}
                </div>
              </body>
              </html>`,
                  text: `Holiday Gifting Made Easy!

Find the perfect gift for the salsa lover in your life.
Shop our Holiday Gift Guide: {{giftGuideUrl}}

Order by {{shippingDeadline}} for Christmas delivery.`,
                },
                // 25. Back in Stock
                {
                  key: 'back_in_stock',
                  name: 'Back in Stock',
                  subject: 'Good News! {{productName}} is Back in Stock!',
                  category: 'MARKETING',
                  description: 'Inventory restocking notifications',
                  variables: {
                    name: 'string',
                    productName: 'string',
                    productUrl: 'string',
                  },
                  html: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Back in Stock</title></head>
              <body style="${baseStyles.container}">
                <div style="${baseStyles.wrapper}">
                  <div style="${baseStyles.header}">
                    ${headerImg('back-in-stock.png', 'Back in Stock')}
                  </div>
                  <div style="${baseStyles.content}">
                    <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
                    <p style="margin-bottom:20px;">Great news! The {{productName}} you've been waiting for is back in stock.</p>
                    <div style="text-align:center;margin:30px 0;">
                      <a href="{{productUrl}}" style="${baseStyles.button}">Shop Now</a>
                    </div>
                    <p style="text-align:center;">Hurry, it might sell out again!</p>
                  </div>
                  ${jmsFooter}
                </div>
              </body>
              </html>`,
                  text: `Good News! {{productName}} is back in stock.

              Shop now: {{productUrl}}
              
              Hurry, it might sell out again!`,
                },
                // 26. Win Back
                {
                  key: 'win_back',
                  name: 'Win Back',
                  subject: '👋 We Miss You!',
                  category: 'MARKETING',
                  description: 'Re-engage inactive customers (90+ days)',
                  variables: {
                    name: 'string',
                    discountCode: 'string',
                    shopUrl: 'string',
                  },
                  html: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>We Miss You</title></head>
              <body style="${baseStyles.container}">
                <div style="${baseStyles.wrapper}">
                  <div style="${baseStyles.header}">
                    ${headerImg('miss-you-letter.png', 'We Miss You')}
                  </div>
                  <div style="${baseStyles.content}">
                    <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
                    <p style="margin-bottom:20px;">It's been a while since your last order. We'd love to see you again!</p>
                    <p style="text-align:center;">Here's a special offer to welcome you back:</p>
                    <div style="text-align:center;margin:30px 0;">
                      <p style="font-size:24px;font-weight:bold;color:#dc2626;">20% OFF YOUR NEXT ORDER</p>
                      <p>Use code: <strong>{{discountCode}}</strong></p>
                    </div>
                    <div style="text-align:center;margin:30px 0;">
                      <a href="{{shopUrl}}" style="${baseStyles.button}">Shop Now</a>
                    </div>
                  </div>
                  ${jmsFooter}
                </div>
              </body>
              </html>`,
                  text: `We Miss You!

              It's been a while since your last order. We'd love to see you again!
              
              Here's 20% off your next order. Use code: {{discountCode}}
              
              Shop now: {{shopUrl}}`,
                },
                // 27. Birthday Special
                {
                  key: 'birthday_special',
                  name: 'Birthday Special',
                  subject: '🎉 Happy Birthday, {{name}}!',
                  category: 'MARKETING',
                  description: 'Birthday emails with special offers',
                  variables: {
                    name: 'string',
                    discountCode: 'string',
                    shopUrl: 'string',
                  },
                  html: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Happy Birthday</title></head>
              <body style="${baseStyles.container}">
                <div style="${baseStyles.wrapper}">
                  <div style="${baseStyles.header}">
                    ${headerImg('birthday-header.png', 'Happy Birthday')}
                  </div>
                  <div style="${baseStyles.content}">
                    <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
                    <p style="margin-bottom:20px;">Happy birthday from all of us at Jose Madrid Salsa! We hope you have a great day.</p>
                    <p style="text-align:center;">To celebrate, here's a special gift for you:</p>
                    <div style="text-align:center;margin:30px 0;">
                      <p style="font-size:24px;font-weight:bold;color:#dc2626;">A FREE JAR OF SALSA</p>
                      <p>with your next order. Use code: <strong>{{discountCode}}</strong></p>
                    </div>
                    <div style="text-align:center;margin:30px 0;">
                      <a href="{{shopUrl}}" style="${baseStyles.button}">Claim Your Gift</a>
                    </div>
                  </div>
                  ${jmsFooter}
                </div>
              </body>
              </html>`,
                  text: `Happy Birthday, {{name}}!

              Enjoy a free jar of salsa on us. Use code: {{discountCode}}
              
              Claim your gift: {{shopUrl}}`,
                },
                // 28. Referral Program
                {
                  key: 'referral_program',
                  name: 'Referral Program',
                  subject: 'Share the Love, Get Rewarded!',
                  category: 'MARKETING',
                  description: 'Customer referral invitations',
                  variables: {
                    name: 'string',
                    referralUrl: 'string',
                    friendDiscount: 'string',
                    yourReward: 'string',
                  },
                  html: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Refer a Friend</title></head>
              <body style="${baseStyles.container}">
                <div style="${baseStyles.wrapper}">
                  <div style="${baseStyles.header}">
                    ${headerImg('referral.png', 'Share the Love')}
                  </div>
                  <div style="${baseStyles.content}">
                    <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
                    <p style="margin-bottom:20px;">Love our salsa? Share it with your friends and get rewarded!</p>
                    <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;text-align:center;">
                      <p>Your friends get <strong>{{friendDiscount}}</strong> off their first order.</p>
                      <p>You get <strong>{{yourReward}}</strong> for each successful referral!</p>
                    </div>
                    <div style="text-align:center;margin:30px 0;">
                      <a href="{{referralUrl}}" style="${baseStyles.button}">Start Sharing</a>
                    </div>
                  </div>
                  ${jmsFooter}
                </div>
              </body>
              </html>`,
                  text: `Share the Love, Get Rewarded!

              Your friends get {{friendDiscount}} off their first order. You get {{yourReward}} for each successful referral!
              
              Start sharing: {{referralUrl}}`,
                },
                // 29. Review Request
                {
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
                },
                // 30. Customer Survey
                {
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
                },
                // 31. Recipe Feature
                {
                  key: 'recipe_feature',
                  name: 'Recipe Feature',
                  subject: '🌶️ New Recipe: {{recipeName}}',
                  category: 'MARKETING',
                  description: 'Monthly recipe spotlights',
                  variables: {
                    name: 'string',
                    recipeName: 'string',
                    recipeUrl: 'string',
                    productName: 'string',
                    productUrl: 'string',
                  },
                  html: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>New Recipe</title></head>
              <body style="${baseStyles.container}">
                <div style="${baseStyles.wrapper}">
                  <div style="${baseStyles.header}">
                    ${headerImg('recipe.png', 'New Recipe')}
                  </div>
                  <div style="${baseStyles.content}">
                    <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
                    <p style="margin-bottom:20px;">Looking for some culinary inspiration? Try our new recipe for <strong>{{recipeName}}</strong>, featuring our delicious {{productName}} salsa!</p>
                    <div style="text-align:center;margin:30px 0;">
                      <a href="{{recipeUrl}}" style="${baseStyles.button}">Get the Recipe</a>
                    </div>
                    <div style="text-align:center;margin:30px 0;">
                      <a href="{{productUrl}}" style="color:#dc2626;text-decoration:underline;">Get the Salsa</a>
                    </div>
                  </div>
                  ${jmsFooter}
                </div>
              </body>
              </html>`,
                  text: `New Recipe: {{recipeName}}

              Try our new recipe for {{recipeName}}, featuring our delicious {{productName}} salsa!
              
              Get the recipe: {{recipeUrl}}
              Get the salsa: {{productUrl}}`,
                },
                // 32. Loyalty Milestone
                {
                  key: 'loyalty_milestone',
                  name: 'Loyalty Milestone',
                  subject: 'You\'ve Reached a New Loyalty Level!',
                  category: 'MARKETING',
                  description: 'Loyalty program achievements',
                  variables: {
                    name: 'string',
                    level: 'string',
                    reward: 'string',
                  },
                  html: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Loyalty Milestone</title></head>
              <body style="${baseStyles.container}">
                <div style="${baseStyles.wrapper}">
                  <div style="${baseStyles.header}">
                    ${headerImg('loyalty-milestone.png', 'Congratulations')}
                  </div>
                  <div style="${baseStyles.content}">
                    <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
                    <p style="margin-bottom:20px;">You've reached the <strong>{{level}}</strong> level in our loyalty program! Thank you for being such a loyal customer.</p>
                    <p style="text-align:center;">Your reward is: <strong>{{reward}}</strong></p>
                  </div>
                  ${jmsFooter}
                </div>
              </body>
              </html>`,
                  text: `Congratulations, {{name}}!

              You've reached the {{level}} level in our loyalty program.
              
              Your reward is: {{reward}}`,
                },
                // 33. Order Status Update
                {
                  key: 'order_status_update',
                  name: 'Order Status Update',
                  subject: 'Update on Your Order #{{orderNumber}}',
                  category: 'ADMINISTRATIVE',
                  description: 'Manual status updates for exceptions',
                  variables: {
                    name: 'string',
                    orderNumber: 'string',
                    status: 'string',
                    message: 'string',
                  },
                  html: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Order Status Update</title></head>
              <body style="${baseStyles.container}">
                <div style="${baseStyles.wrapper}">
                  <div style="${baseStyles.header}">
                    ${headerImg('order-update.png', 'Order Update')}
                  </div>
                  <div style="${baseStyles.content}">
                    <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
                    <p style="margin-bottom:20px;">Here's an update on your order #{{orderNumber}}:</p>
                    <p><strong>Status:</strong> {{status}}</p>
                    <p><strong>Message:</strong></p>
                    <p>{{message}}</p>
                  </div>
                  ${jmsFooter}
                </div>
              </body>
              </html>`,
                  text: `Hi {{name}},

              Here's an update on your order #{{orderNumber}}:
              Status: {{status}}
              
              Message:
              {{message}}`,
                },
                // 34. Account Security Alert
                {
                  key: 'account_security_alert',
                  name: 'Account Security Alert',
                  subject: 'Security Alert for Your Account',
                  category: 'ADMINISTRATIVE',
                  description: 'Security notifications',
                  variables: {
                    name: 'string',
                    alert: 'string',
                  },
                  html: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Security Alert</title></head>
              <body style="${baseStyles.container}">
                <div style="${baseStyles.wrapper}">
                  <div style="${baseStyles.header}">
                    ${headerImg('security-notice.png', 'Security Alert')}
                  </div>
                  <div style="${baseStyles.content}">
                    <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
                    <p style="margin-bottom:20px;">We're writing to you about a security alert on your account.</p>
                    <p><strong>Alert:</strong> {{alert}}</p>
                    <p>If this was you, you can safely disregard this email. If this was not you, please contact us immediately.</p>
                  </div>
                  ${jmsFooter}
                </div>
              </body>
              </html>`,
                  text: `Hi {{name}},

              We're writing to you about a security alert on your account.
              
              Alert: {{alert}}
              
              If this was you, you can safely disregard this email. If this was not you, please contact us immediately.`,
                },
                // 35. Service Announcement
                {
                  key: 'service_announcement',
                  name: 'Service Announcement',
                  subject: 'An Important Announcement from Jose Madrid Salsa',
                  category: 'ADMINISTRATIVE',
                  description: 'Maintenance, policy changes',
                  variables: {
                    title: 'string',
                    message: 'string',
                  },
                  html: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{{title}}</title></head>
              <body style="${baseStyles.container}">
                <div style="${baseStyles.wrapper}">
                  <div style="${baseStyles.header}">
                    ${headerImg('service-announcement.png', 'Service Announcement')}
                  </div>
                  <div style="${baseStyles.content}">
                    <p>{{message}}</p>
                  </div>
                  ${jmsFooter}
                </div>
              </body>
              </html>`,
                  text: `{{title}}

              {{message}}`,
                },

  // 36. Jose Madrid Specials
  {
    key: 'jose_madrid_specials',
    name: 'Jose Madrid Specials',
    subject: '🌶️ Jose Madrid Specials Just for You!',
    category: 'MARKETING',
    description: 'Special deals and featured products',
    variables: {
      name: 'string',
      specialTitle: 'string',
      specialDescription: 'string',
      discountCode: 'string',
      shopUrl: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Jose Madrid Specials</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('jose-madrid-specials.png', 'Jose Madrid Specials')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">We've put together something special just for you!</p>
      <h2 style="color:#dc2626;font-size:24px;margin:0 0 15px;">{{specialTitle}}</h2>
      <p style="margin-bottom:20px;line-height:1.6;">{{specialDescription}}</p>
      <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:30px;border-radius:12px;text-align:center;margin:30px 0;color:#ffffff;">
        <p style="margin:0 0 15px;font-size:16px;">Use code:</p>
        <p style="margin:0 0 20px;font-size:28px;font-weight:700;letter-spacing:2px;">{{discountCode}}</p>
        <a href="{{shopUrl}}" style="display:inline-block;padding:14px 32px;background-color:#ffffff;color:#dc2626 !important;text-decoration:none;border-radius:6px;font-weight:600;">Shop Specials</a>
      </div>
      <p style="color:#6c757d;font-size:14px;margin-top:30px;">Limited time offer. While supplies last.</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Hi {{name}},

{{specialTitle}}

{{specialDescription}}

Use code {{discountCode}} to save!

Shop now: {{shopUrl}}`,
  },

  // 37. Gameday Ready
  {
    key: 'gameday_ready',
    name: 'Gameday Ready',
    subject: '🏈 Game Day is Here — Get Your Salsa Ready!',
    category: 'MARKETING',
    description: 'Gameday promotions and party prep',
    variables: {
      name: 'string',
      gameDayDate: 'string',
      bundleUrl: 'string',
      discountCode: 'string',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Gameday Ready</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('gameday.png', 'Gameday Ready')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;font-size:18px;">Game day is coming up on <strong>{{gameDayDate}}</strong> — make sure your snack table is stocked with Jose Madrid Salsa!</p>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 15px;font-size:18px;">Game Day Must-Haves:</h3>
        <ul style="padding-left:20px;margin:0;">
          <li style="margin-bottom:10px;">Our famous Chipotle Hot for the bold fans</li>
          <li style="margin-bottom:10px;">Crowd-pleasing Garden Cilantro Mild</li>
          <li style="margin-bottom:10px;">Game Day Party Pack — chips & salsa bundles</li>
        </ul>
      </div>
      <div style="background:linear-gradient(135deg,#1e40af 0%,#1e3a5f 100%);padding:30px;border-radius:12px;text-align:center;margin:30px 0;color:#ffffff;">
        <p style="margin:0 0 10px;font-size:16px;">Game Day Special</p>
        <p style="margin:0 0 20px;font-size:28px;font-weight:700;">15% OFF Party Bundles</p>
        <p style="margin:0 0 20px;font-size:14px;">Code: <strong style="font-size:18px;letter-spacing:2px;">{{discountCode}}</strong></p>
        <a href="{{bundleUrl}}" style="display:inline-block;padding:14px 32px;background-color:#ffffff;color:#1e40af !important;text-decoration:none;border-radius:6px;font-weight:600;">Shop Party Packs</a>
      </div>
      <p style="margin-top:30px;text-align:center;">Order by Thursday for guaranteed delivery before kickoff!</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
    text: `Hi {{name}},

Game day is on {{gameDayDate}} — make sure you're stocked up!

Use code {{discountCode}} for 15% off party bundles.

Shop now: {{bundleUrl}}

Order by Thursday for guaranteed delivery!`,
  },
]
