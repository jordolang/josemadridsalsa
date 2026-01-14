import { EmailBlock, BlockCategory } from './block-definitions'

export const hero_image: EmailBlock = {
  id: 'hero_image',
  name: 'Hero Image',
  category: BlockCategory.HERO,
  description: 'Full-width image + headline overlay',
  thumbnail: '',
  html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="position: relative; padding: 0;">
      <img src="{{imageUrl}}" alt="{{imageAlt}}" width="600" style="display: block; width: 100%; height: auto; max-width: 600px;" />
    </td>
  </tr>
</table>`,
  variables: {
    imageUrl: {
      key: 'imageUrl',
      label: 'Hero Image URL',
      description: 'URL to the hero image',
      type: 'url',
      required: true,
      fallback: 'https://placehold.co/600x400',
      example: 'https://example.com/hero.jpg',
    },
    imageAlt: {
      key: 'imageAlt',
      label: 'Image Alt Text',
      description: 'Alternative text for the image',
      type: 'string',
      required: true,
      fallback: 'Hero image',
      example: 'Fresh salsa products',
    },
  },
  defaultProps: {
    imageUrl: 'https://placehold.co/600x400',
    imageAlt: 'Hero image',
  },
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const hero_split: EmailBlock = {
  id: 'hero_split',
  name: 'Split Hero',
  category: BlockCategory.HERO,
  description: '50/50 image + text side-by-side',
  thumbnail: '',
  html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding: 40px 20px; background-color: #f8fafc;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="width: 50%; vertical-align: middle; padding-right: 20px;">
            <img src="{{imageUrl}}" alt="{{imageAlt}}" width="280" style="display: block; width: 100%; height: auto; border-radius: 8px;" />
          </td>
          <td style="width: 50%; vertical-align: middle; padding-left: 20px;">
            <h2 style="margin: 0 0 16px; font-size: 28px; color: #1e293b; font-family: Georgia, serif; line-height: 1.3;">{{headline}}</h2>
            <p style="margin: 0 0 24px; font-size: 16px; color: #475569; font-family: Arial, sans-serif; line-height: 1.6;">{{bodyText}}</p>
            <a href="{{ctaUrl}}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; font-family: Arial, sans-serif;">{{ctaText}}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  variables: {
    imageUrl: {
      key: 'imageUrl',
      label: 'Image URL',
      description: 'URL to the image',
      type: 'url',
      required: true,
      fallback: 'https://placehold.co/280x280',
      example: 'https://example.com/product.jpg',
    },
    imageAlt: {
      key: 'imageAlt',
      label: 'Image Alt Text',
      description: 'Alternative text for the image',
      type: 'string',
      required: true,
      fallback: 'Product image',
      example: 'Our signature salsa',
    },
    headline: {
      key: 'headline',
      label: 'Headline',
      description: 'Main headline text',
      type: 'string',
      required: true,
      fallback: 'Discover something new',
      example: 'Try our new spicy salsa',
    },
    bodyText: {
      key: 'bodyText',
      label: 'Body Text',
      description: 'Supporting body text',
      type: 'string',
      required: false,
      fallback: 'Learn more about our products and special offers.',
      example: 'Handcrafted with fresh ingredients.',
    },
    ctaText: {
      key: 'ctaText',
      label: 'CTA Text',
      description: 'Call-to-action button text',
      type: 'string',
      required: true,
      fallback: 'Shop Now',
      example: 'Shop Now',
    },
    ctaUrl: {
      key: 'ctaUrl',
      label: 'CTA URL',
      description: 'Call-to-action button URL',
      type: 'url',
      required: true,
      fallback: '#',
      example: 'https://example.com/shop',
    },
  },
  defaultProps: {
    imageUrl: 'https://placehold.co/280x280',
    imageAlt: 'Product image',
    headline: 'Discover something new',
    bodyText: 'Learn more about our products and special offers.',
    ctaText: 'Shop Now',
    ctaUrl: '#',
  },
  styling: {
    backgroundColor: '#f8fafc',
    padding: '40px 20px',
  },
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const hero_gradient: EmailBlock = {
  id: 'hero_gradient',
  name: 'Gradient Hero',
  category: BlockCategory.HERO,
  description: 'Gradient background + centered content',
  thumbnail: '',
  html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding: 60px 20px; text-align: center; background: linear-gradient(135deg, {{gradientStart}} 0%, {{gradientEnd}} 100%);">
      <h1 style="margin: 0 0 16px; font-size: 36px; color: #ffffff; font-family: Georgia, serif; line-height: 1.2;">{{headline}}</h1>
      <p style="margin: 0 0 32px; font-size: 18px; color: #ffffff; font-family: Arial, sans-serif; opacity: 0.95; max-width: 500px; margin-left: auto; margin-right: auto;">{{subheadline}}</p>
      <a href="{{ctaUrl}}" style="display: inline-block; padding: 16px 40px; background-color: #ffffff; color: {{gradientStart}}; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; font-family: Arial, sans-serif;">{{ctaText}}</a>
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
      description: 'Main headline text',
      type: 'string',
      required: true,
      fallback: 'Welcome to our store',
      example: 'Summer Sale',
    },
    subheadline: {
      key: 'subheadline',
      label: 'Subheadline',
      description: 'Supporting subheadline text',
      type: 'string',
      required: false,
      fallback: 'Discover amazing products and exclusive offers',
      example: 'Save up to 50% on select items',
    },
    ctaText: {
      key: 'ctaText',
      label: 'CTA Text',
      description: 'Call-to-action button text',
      type: 'string',
      required: true,
      fallback: 'Shop Now',
      example: 'Shop Now',
    },
    ctaUrl: {
      key: 'ctaUrl',
      label: 'CTA URL',
      description: 'Call-to-action button URL',
      type: 'url',
      required: true,
      fallback: '#',
      example: 'https://example.com/shop',
    },
  },
  defaultProps: {
    gradientStart: '#dc2626',
    gradientEnd: '#991b1b',
    headline: 'Welcome to our store',
    subheadline: 'Discover amazing products and exclusive offers',
    ctaText: 'Shop Now',
    ctaUrl: '#',
  },
  styling: {
    padding: '60px 20px',
  },
  compatibility: { gmail: true, outlook: false, appleMail: true, mobile: true }, // Outlook doesn't support CSS gradients well
}

export const hero_video: EmailBlock = {
  id: 'hero_video',
  name: 'Video Hero',
  category: BlockCategory.HERO,
  description: 'Video thumbnail + play button',
  thumbnail: '',
  html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="position: relative; padding: 0;">
      <a href="{{videoUrl}}" style="display: block; position: relative;">
        <img src="{{thumbnailUrl}}" alt="{{videoTitle}}" width="600" style="display: block; width: 100%; height: auto; max-width: 600px;" />
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
          <div style="width: 80px; height: 80px; background-color: rgba(220, 38, 38, 0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <span style="color: #ffffff; font-size: 32px; margin-left: 8px;">▶</span>
          </div>
        </div>
      </a>
    </td>
  </tr>
</table>`,
  variables: {
    videoUrl: {
      key: 'videoUrl',
      label: 'Video URL',
      description: 'URL to the video page',
      type: 'url',
      required: true,
      fallback: '#',
      example: 'https://youtube.com/watch?v=xxx',
    },
    thumbnailUrl: {
      key: 'thumbnailUrl',
      label: 'Thumbnail URL',
      description: 'Video thumbnail image URL',
      type: 'url',
      required: true,
      fallback: 'https://placehold.co/600x400',
      example: 'https://example.com/video-thumb.jpg',
    },
    videoTitle: {
      key: 'videoTitle',
      label: 'Video Title',
      description: 'Video title for alt text',
      type: 'string',
      required: true,
      fallback: 'Watch video',
      example: 'Product demo video',
    },
  },
  defaultProps: {
    videoUrl: '#',
    thumbnailUrl: 'https://placehold.co/600x400',
    videoTitle: 'Watch video',
  },
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const hero_callout: EmailBlock = {
  id: 'hero_callout',
  name: 'Callout Hero',
  category: BlockCategory.HERO,
  description: 'Large text + button',
  thumbnail: '',
  html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding: 60px 20px; text-align: center; background-color: {{backgroundColor}};">
      <h1 style="margin: 0 0 24px; font-size: 42px; color: {{textColor}}; font-family: Georgia, serif; line-height: 1.2; max-width: 600px; margin-left: auto; margin-right: auto;">{{headline}}</h1>
      <a href="{{ctaUrl}}" style="display: inline-block; padding: 18px 48px; background-color: {{buttonColor}}; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 18px; font-weight: 600; font-family: Arial, sans-serif;">{{ctaText}}</a>
    </td>
  </tr>
</table>`,
  variables: {
    backgroundColor: {
      key: 'backgroundColor',
      label: 'Background Color',
      description: 'Background color of the hero',
      type: 'string',
      required: false,
      fallback: '#f8fafc',
      example: '#f8fafc',
    },
    textColor: {
      key: 'textColor',
      label: 'Text Color',
      description: 'Color of the headline text',
      type: 'string',
      required: false,
      fallback: '#1e293b',
      example: '#1e293b',
    },
    buttonColor: {
      key: 'buttonColor',
      label: 'Button Color',
      description: 'Background color of the button',
      type: 'string',
      required: false,
      fallback: '#dc2626',
      example: '#dc2626',
    },
    headline: {
      key: 'headline',
      label: 'Headline',
      description: 'Main headline text',
      type: 'string',
      required: true,
      fallback: 'Big announcement',
      example: 'New product launch!',
    },
    ctaText: {
      key: 'ctaText',
      label: 'CTA Text',
      description: 'Call-to-action button text',
      type: 'string',
      required: true,
      fallback: 'Learn More',
      example: 'Shop Now',
    },
    ctaUrl: {
      key: 'ctaUrl',
      label: 'CTA URL',
      description: 'Call-to-action button URL',
      type: 'url',
      required: true,
      fallback: '#',
      example: 'https://example.com/new',
    },
  },
  defaultProps: {
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',
    buttonColor: '#dc2626',
    headline: 'Big announcement',
    ctaText: 'Learn More',
    ctaUrl: '#',
  },
  styling: {
    backgroundColor: '#f8fafc',
    padding: '60px 20px',
  },
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const heroBlocks = [
  hero_image,
  hero_split,
  hero_gradient,
  hero_video,
  hero_callout,
]
