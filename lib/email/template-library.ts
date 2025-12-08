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

const baseStyles = {
  container: 'width:100%;background-color:#f4f4f7;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;',
  wrapper: 'max-width:600px;margin:0 auto;background-color:#ffffff;',
  header: 'background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:40px 32px;text-align:center;',
  headerTitle: 'color:#ffffff;font-size:28px;font-weight:700;margin:0;',
  content: 'padding:40px 32px;color:#333333;line-height:1.6;',
  button: 'display:inline-block;padding:14px 32px;background-color:#dc2626;color:#ffffff !important;text-decoration:none;border-radius:6px;font-weight:600;margin:20px 0;',
  footer: 'background-color:#f8f9fa;padding:30px 32px;text-align:center;color:#6c757d;font-size:14px;',
  divider: 'height:1px;background-color:#e2e8f0;margin:30px 0;border:none;',
}

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
      <h1 style="${baseStyles.headerTitle}">Welcome to the Family!</h1>
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
    <div style="${baseStyles.footer}">
      <p style="margin:0 0 10px;">Jose Madrid Salsa</p>
      <p style="margin:0 0 10px;">59 S 6th Street, Newark, OH 43055</p>
      <p style="margin:0;"><a href="https://www.josemadridsalsa.com" style="color:#dc2626;text-decoration:none;">Visit Website</a> | <a href="{{unsubscribe_url}}" style="color:#dc2626;text-decoration:none;">Unsubscribe</a></p>
    </div>
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
      <h1 style="${baseStyles.headerTitle}">Order Confirmed!</h1>
      <p style="color:#ffffff;margin:10px 0 0;font-size:18px;">Order #{{orderNumber}}</p>
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
    <div style="${baseStyles.footer}">
      <p style="margin:0 0 10px;">Thank you for supporting Jose Madrid Salsa!</p>
      <p style="margin:0;"><a href="https://www.josemadridsalsa.com" style="color:#dc2626;text-decoration:none;">Visit Website</a></p>
    </div>
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
      <h1 style="${baseStyles.headerTitle}">Your Order Has Shipped!</h1>
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
    <div style="${baseStyles.footer}">
      <p style="margin:0 0 10px;">Questions about your delivery?</p>
      <p style="margin:0;">Call <a href="tel:7403493144" style="color:#dc2626;text-decoration:none;">740-349-3144</a></p>
    </div>
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
      <h1 style="${baseStyles.headerTitle}">Don't Miss Out!</h1>
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
    <div style="${baseStyles.footer}">
      <p style="margin:0 0 10px;">Need help deciding? We're here for you!</p>
      <p style="margin:0;">Email <a href="mailto:hello@josemadridsalsa.com" style="color:#dc2626;text-decoration:none;">hello@josemadridsalsa.com</a></p>
    </div>
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
      <p style="color:#ffffff;margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:2px;">New Release</p>
      <h1 style="${baseStyles.headerTitle}">{{productName}}</h1>
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
    <div style="${baseStyles.footer}">
      <p style="margin:0 0 10px;">Follow us for more updates</p>
      <p style="margin:0;">
        <a href="https://www.facebook.com/JoseMadridSalsa" style="color:#dc2626;text-decoration:none;margin:0 10px;">Facebook</a> |
        <a href="https://www.instagram.com/JoseMadridSalsa" style="color:#dc2626;text-decoration:none;margin:0 10px;">Instagram</a>
      </p>
    </div>
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
      <p style="color:#ffffff;margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:2px;">The Salsa Scoop</p>
      <h1 style="${baseStyles.headerTitle}">{{month}} Edition</h1>
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
    <div style="${baseStyles.footer}">
      <p style="margin:0 0 15px;"><strong>Connect With Us</strong></p>
      <p style="margin:0 0 10px;">
        <a href="https://www.facebook.com/JoseMadridSalsa" style="color:#dc2626;text-decoration:none;margin:0 8px;">Facebook</a> |
        <a href="https://www.instagram.com/JoseMadridSalsa" style="color:#dc2626;text-decoration:none;margin:0 8px;">Instagram</a> |
        <a href="https://www.josemadridsalsa.com" style="color:#dc2626;text-decoration:none;margin:0 8px;">Website</a>
      </p>
      <p style="margin:15px 0 0;font-size:12px;"><a href="{{unsubscribe_url}}" style="color:#6c757d;text-decoration:none;">Unsubscribe</a></p>
    </div>
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
    <div style="background:linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%);padding:50px 32px;text-align:center;">
      <p style="color:#ffffff;margin:0 0 15px;font-size:14px;text-transform:uppercase;letter-spacing:3px;">You're Invited</p>
      <h1 style="color:#ffffff;font-size:32px;font-weight:700;margin:0;line-height:1.3;">{{eventName}}</h1>
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
    <div style="${baseStyles.footer}">
      <p style="margin:0 0 10px;">We can't wait to see you there!</p>
      <p style="margin:0;"><strong>Jose Madrid Salsa Team</strong></p>
    </div>
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
      <h1 style="${baseStyles.headerTitle}">Welcome, {{businessName}}!</h1>
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
    <div style="${baseStyles.footer}">
      <p style="margin:0 0 10px;">Jose Madrid Salsa Wholesale Division</p>
      <p style="margin:0;">59 S 6th Street, Newark, OH 43055</p>
    </div>
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
    <div style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:50px 32px;text-align:center;">
      <p style="color:#ffffff;margin:0 0 15px;font-size:14px;text-transform:uppercase;letter-spacing:3px;">Fundraiser Kickoff</p>
      <h1 style="color:#ffffff;font-size:32px;font-weight:700;margin:0;">Let's Do This, {{organizationName}}!</h1>
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
    <div style="${baseStyles.footer}">
      <p style="margin:0 0 10px;"><strong>Jose Madrid Salsa Fundraising Team</strong></p>
      <p style="margin:0;">Supporting communities since 1982</p>
    </div>
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
      <h1 style="${baseStyles.headerTitle}">Thank You! 💚</h1>
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
    <div style="${baseStyles.footer}">
      <p style="margin:0 0 10px;">Questions or concerns?</p>
      <p style="margin:0;">Email <a href="mailto:hello@josemadridsalsa.com" style="color:#dc2626;text-decoration:none;">hello@josemadridsalsa.com</a> or call <a href="tel:7403493144" style="color:#dc2626;text-decoration:none;">740-349-3144</a></p>
    </div>
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
]
