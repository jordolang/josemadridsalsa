import { EmailBlock, BlockCategory } from './block-definitions'

export const cta_banner: EmailBlock = {
  id: 'cta_banner',
  name: 'CTA Banner',
  category: BlockCategory.CTA,
  description: 'Full-width gradient banner',
  thumbnail: '',
  html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding: 40px 20px; text-align: center; background: linear-gradient(135deg, {{gradientStart}} 0%, {{gradientEnd}} 100%);">
      <h3 style="margin: 0 0 16px; font-size: 24px; color: #ffffff; font-family: Georgia, serif;">{{headline}}</h3>
      <p style="margin: 0 0 24px; font-size: 16px; color: #ffffff; opacity: 0.95; font-family: Arial, sans-serif;">{{description}}</p>
      <a href="{{ctaUrl}}" style="display: inline-block; padding: 14px 36px; background-color: #ffffff; color: {{gradientStart}}; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; font-family: Arial, sans-serif;">{{ctaText}}</a>
    </td>
  </tr>
</table>`,
  variables: {
    gradientStart: {
      key: 'gradientStart',
      label: 'Gradient Start Color',
      description: 'Starting color of gradient',
      type: 'string',
      required: false,
      fallback: '#dc2626',
      example: '#dc2626',
    },
    gradientEnd: {
      key: 'gradientEnd',
      label: 'Gradient End Color',
      description: 'Ending color of gradient',
      type: 'string',
      required: false,
      fallback: '#991b1b',
      example: '#991b1b',
    },
    headline: {
      key: 'headline',
      label: 'Headline',
      description: 'Banner headline',
      type: 'string',
      required: true,
      fallback: 'Take action now',
      example: 'Limited time offer',
    },
    description: {
      key: 'description',
      label: 'Description',
      description: 'Supporting description text',
      type: 'string',
      required: false,
      fallback: 'Don\'t miss this opportunity',
      example: 'Shop our sale before it ends',
    },
    ctaText: {
      key: 'ctaText',
      label: 'CTA Text',
      description: 'Button text',
      type: 'string',
      required: true,
      fallback: 'Get Started',
      example: 'Shop Now',
    },
    ctaUrl: {
      key: 'ctaUrl',
      label: 'CTA URL',
      description: 'Button URL',
      type: 'url',
      required: true,
      fallback: '#',
      example: 'https://example.com/sale',
    },
  },
  defaultProps: {
    gradientStart: '#dc2626',
    gradientEnd: '#991b1b',
    headline: 'Take action now',
    description: 'Don\'t miss this opportunity',
    ctaText: 'Get Started',
    ctaUrl: '#',
  },
  styling: {
    padding: '40px 20px',
  },
  compatibility: { gmail: true, outlook: false, appleMail: true, mobile: true },
}

export const cta_button_group: EmailBlock = {
  id: 'cta_button_group',
  name: 'Button Group',
  category: BlockCategory.CTA,
  description: 'Multiple buttons in a row',
  thumbnail: '',
  html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding: 30px 20px; text-align: center;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="display: inline-block;">
        <tr>
          <td style="padding: 0 10px;">
            <a href="{{button1Url}}" style="display: inline-block; padding: 14px 32px; background-color: {{button1Color}}; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; font-family: Arial, sans-serif;">{{button1Text}}</a>
          </td>
          <td style="padding: 0 10px;">
            <a href="{{button2Url}}" style="display: inline-block; padding: 14px 32px; background-color: {{button2Color}}; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; font-family: Arial, sans-serif;">{{button2Text}}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  variables: {
    button1Text: {
      key: 'button1Text',
      label: 'Button 1 Text',
      description: 'First button text',
      type: 'string',
      required: true,
      fallback: 'Primary Action',
      example: 'Shop Now',
    },
    button1Url: {
      key: 'button1Url',
      label: 'Button 1 URL',
      description: 'First button URL',
      type: 'url',
      required: true,
      fallback: '#',
      example: 'https://example.com/shop',
    },
    button1Color: {
      key: 'button1Color',
      label: 'Button 1 Color',
      description: 'First button background color',
      type: 'string',
      required: false,
      fallback: '#dc2626',
      example: '#dc2626',
    },
    button2Text: {
      key: 'button2Text',
      label: 'Button 2 Text',
      description: 'Second button text',
      type: 'string',
      required: true,
      fallback: 'Secondary Action',
      example: 'Learn More',
    },
    button2Url: {
      key: 'button2Url',
      label: 'Button 2 URL',
      description: 'Second button URL',
      type: 'url',
      required: true,
      fallback: '#',
      example: 'https://example.com/about',
    },
    button2Color: {
      key: 'button2Color',
      label: 'Button 2 Color',
      description: 'Second button background color',
      type: 'string',
      required: false,
      fallback: '#475569',
      example: '#475569',
    },
  },
  defaultProps: {
    button1Text: 'Primary Action',
    button1Url: '#',
    button1Color: '#dc2626',
    button2Text: 'Secondary Action',
    button2Url: '#',
    button2Color: '#475569',
  },
  styling: {
    padding: '30px 20px',
  },
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const cta_countdown: EmailBlock = {
  id: 'cta_countdown',
  name: 'Countdown CTA',
  category: BlockCategory.CTA,
  description: 'Visual countdown timer + CTA',
  thumbnail: '',
  html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding: 40px 20px; text-align: center; background-color: #f8fafc;">
      <p style="margin: 0 0 20px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, sans-serif; font-weight: 600;">{{timerLabel}}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="display: inline-block; margin-bottom: 24px;">
        <tr>
          <td style="padding: 0 12px; text-align: center;">
            <div style="background-color: #ffffff; border: 2px solid #e2e8f0; border-radius: 8px; padding: 16px 20px;">
              <div style="font-size: 32px; font-weight: 700; color: #1e293b; font-family: Arial, sans-serif;">{{days}}</div>
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 4px; font-family: Arial, sans-serif;">Days</div>
            </div>
          </td>
          <td style="padding: 0 12px; text-align: center;">
            <div style="background-color: #ffffff; border: 2px solid #e2e8f0; border-radius: 8px; padding: 16px 20px;">
              <div style="font-size: 32px; font-weight: 700; color: #1e293b; font-family: Arial, sans-serif;">{{hours}}</div>
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 4px; font-family: Arial, sans-serif;">Hours</div>
            </div>
          </td>
          <td style="padding: 0 12px; text-align: center;">
            <div style="background-color: #ffffff; border: 2px solid #e2e8f0; border-radius: 8px; padding: 16px 20px;">
              <div style="font-size: 32px; font-weight: 700; color: #1e293b; font-family: Arial, sans-serif;">{{minutes}}</div>
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 4px; font-family: Arial, sans-serif;">Min</div>
            </div>
          </td>
        </tr>
      </table>
      <div>
        <a href="{{ctaUrl}}" style="display: inline-block; padding: 16px 40px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; font-family: Arial, sans-serif;">{{ctaText}}</a>
      </div>
    </td>
  </tr>
</table>`,
  variables: {
    timerLabel: {
      key: 'timerLabel',
      label: 'Timer Label',
      description: 'Label above the countdown',
      type: 'string',
      required: false,
      fallback: 'Sale ends in',
      example: 'Offer expires in',
    },
    days: {
      key: 'days',
      label: 'Days',
      description: 'Days remaining',
      type: 'string',
      required: true,
      fallback: '2',
      example: '3',
    },
    hours: {
      key: 'hours',
      label: 'Hours',
      description: 'Hours remaining',
      type: 'string',
      required: true,
      fallback: '14',
      example: '12',
    },
    minutes: {
      key: 'minutes',
      label: 'Minutes',
      description: 'Minutes remaining',
      type: 'string',
      required: true,
      fallback: '32',
      example: '45',
    },
    ctaText: {
      key: 'ctaText',
      label: 'CTA Text',
      description: 'Button text',
      type: 'string',
      required: true,
      fallback: 'Shop Now',
      example: 'Grab the Deal',
    },
    ctaUrl: {
      key: 'ctaUrl',
      label: 'CTA URL',
      description: 'Button URL',
      type: 'url',
      required: true,
      fallback: '#',
      example: 'https://example.com/sale',
    },
  },
  defaultProps: {
    timerLabel: 'Sale ends in',
    days: '2',
    hours: '14',
    minutes: '32',
    ctaText: 'Shop Now',
    ctaUrl: '#',
  },
  styling: {
    backgroundColor: '#f8fafc',
    padding: '40px 20px',
  },
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const cta_text_link: EmailBlock = {
  id: 'cta_text_link',
  name: 'Text Link CTA',
  category: BlockCategory.CTA,
  description: 'Simple text link with arrow',
  thumbnail: '',
  html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding: 20px; text-align: center;">
      <a href="{{linkUrl}}" style="color: {{linkColor}}; text-decoration: none; font-size: 16px; font-weight: 600; font-family: Arial, sans-serif;">{{linkText}} →</a>
    </td>
  </tr>
</table>`,
  variables: {
    linkText: {
      key: 'linkText',
      label: 'Link Text',
      description: 'Text for the link',
      type: 'string',
      required: true,
      fallback: 'Learn More',
      example: 'View Details',
    },
    linkUrl: {
      key: 'linkUrl',
      label: 'Link URL',
      description: 'URL for the link',
      type: 'url',
      required: true,
      fallback: '#',
      example: 'https://example.com/more',
    },
    linkColor: {
      key: 'linkColor',
      label: 'Link Color',
      description: 'Color of the link text',
      type: 'string',
      required: false,
      fallback: '#dc2626',
      example: '#dc2626',
    },
  },
  defaultProps: {
    linkText: 'Learn More',
    linkUrl: '#',
    linkColor: '#dc2626',
  },
  styling: {
    padding: '20px',
  },
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const ctaBlocks = [
  cta_banner,
  cta_button_group,
  cta_countdown,
  cta_text_link,
]
