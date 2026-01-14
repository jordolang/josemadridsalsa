import { EmailBlock, BlockCategory } from './block-definitions'

export const header_simple: EmailBlock = {
  id: 'header_simple',
  name: 'Simple Header',
  category: BlockCategory.HEADER,
  description: 'Logo + tagline, centered',
  thumbnail: '',
  html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding: 40px 20px; text-align: center; background-color: #ffffff;">
      <img src="{{logoUrl}}" alt="{{companyName}}" width="180" style="display: block; margin: 0 auto; height: auto;" />
      <p style="margin: 16px 0 0; font-size: 14px; color: #64748b; font-family: Arial, sans-serif;">{{tagline}}</p>
    </td>
  </tr>
</table>`,
  variables: {
    logoUrl: {
      key: 'logoUrl',
      label: 'Logo URL',
      description: 'URL to your company logo',
      type: 'url',
      required: true,
      fallback: 'https://placehold.co/180x60',
      example: 'https://example.com/logo.png',
    },
    companyName: {
      key: 'companyName',
      label: 'Company Name',
      description: 'Your company name for alt text',
      type: 'string',
      required: true,
      fallback: 'Company Name',
      example: 'Jose Madrid Salsa',
    },
    tagline: {
      key: 'tagline',
      label: 'Tagline',
      description: 'Short tagline below logo',
      type: 'string',
      required: false,
      fallback: 'Your favorite salsa',
      example: 'Handcrafted gourmet salsa',
    },
  },
  defaultProps: {
    logoUrl: 'https://placehold.co/180x60',
    companyName: 'Company Name',
    tagline: 'Your tagline here',
  },
  styling: {
    backgroundColor: '#ffffff',
    padding: '40px 20px',
  },
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const header_nav: EmailBlock = {
  id: 'header_nav',
  name: 'Header with Navigation',
  category: BlockCategory.HEADER,
  description: 'Logo + horizontal menu links',
  thumbnail: '',
  html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding: 30px 20px; background-color: #ffffff;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="width: 200px;">
            <img src="{{logoUrl}}" alt="{{companyName}}" width="150" style="display: block; height: auto;" />
          </td>
          <td style="text-align: right;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="display: inline-block;">
              <tr>
                <td style="padding: 0 15px;"><a href="{{link1Url}}" style="color: #1e293b; text-decoration: none; font-size: 14px; font-family: Arial, sans-serif;">{{link1Text}}</a></td>
                <td style="padding: 0 15px;"><a href="{{link2Url}}" style="color: #1e293b; text-decoration: none; font-size: 14px; font-family: Arial, sans-serif;">{{link2Text}}</a></td>
                <td style="padding: 0 15px;"><a href="{{link3Url}}" style="color: #1e293b; text-decoration: none; font-size: 14px; font-family: Arial, sans-serif;">{{link3Text}}</a></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  variables: {
    logoUrl: {
      key: 'logoUrl',
      label: 'Logo URL',
      description: 'URL to your logo',
      type: 'url',
      required: true,
      fallback: 'https://placehold.co/150x50',
      example: 'https://example.com/logo.png',
    },
    companyName: {
      key: 'companyName',
      label: 'Company Name',
      description: 'Company name for alt text',
      type: 'string',
      required: true,
      fallback: 'Company',
      example: 'Jose Madrid Salsa',
    },
    link1Text: {
      key: 'link1Text',
      label: 'Link 1 Text',
      description: 'First navigation link text',
      type: 'string',
      required: false,
      fallback: 'Shop',
      example: 'Shop',
    },
    link1Url: {
      key: 'link1Url',
      label: 'Link 1 URL',
      description: 'First navigation link URL',
      type: 'url',
      required: false,
      fallback: '#',
      example: 'https://example.com/shop',
    },
    link2Text: {
      key: 'link2Text',
      label: 'Link 2 Text',
      description: 'Second navigation link text',
      type: 'string',
      required: false,
      fallback: 'About',
      example: 'About',
    },
    link2Url: {
      key: 'link2Url',
      label: 'Link 2 URL',
      description: 'Second navigation link URL',
      type: 'url',
      required: false,
      fallback: '#',
      example: 'https://example.com/about',
    },
    link3Text: {
      key: 'link3Text',
      label: 'Link 3 Text',
      description: 'Third navigation link text',
      type: 'string',
      required: false,
      fallback: 'Contact',
      example: 'Contact',
    },
    link3Url: {
      key: 'link3Url',
      label: 'Link 3 URL',
      description: 'Third navigation link URL',
      type: 'url',
      required: false,
      fallback: '#',
      example: 'https://example.com/contact',
    },
  },
  defaultProps: {
    logoUrl: 'https://placehold.co/150x50',
    companyName: 'Company',
    link1Text: 'Shop',
    link1Url: '#',
    link2Text: 'About',
    link2Url: '#',
    link3Text: 'Contact',
    link3Url: '#',
  },
  styling: {
    backgroundColor: '#ffffff',
    padding: '30px 20px',
  },
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const header_promo: EmailBlock = {
  id: 'header_promo',
  name: 'Promotional Header',
  category: BlockCategory.HEADER,
  description: 'Colored banner with announcement',
  thumbnail: '',
  html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding: 12px 20px; text-align: center; background-color: {{bannerColor}};">
      <p style="margin: 0; font-size: 14px; color: #ffffff; font-family: Arial, sans-serif; font-weight: 600;">
        {{promoText}}
      </p>
    </td>
  </tr>
</table>`,
  variables: {
    bannerColor: {
      key: 'bannerColor',
      label: 'Banner Color',
      description: 'Background color of the banner',
      type: 'string',
      required: false,
      fallback: '#dc2626',
      example: '#dc2626',
    },
    promoText: {
      key: 'promoText',
      label: 'Promo Text',
      description: 'Promotional message',
      type: 'string',
      required: true,
      fallback: 'FREE SHIPPING on orders over $50',
      example: 'SALE: 20% off everything!',
    },
  },
  defaultProps: {
    bannerColor: '#dc2626',
    promoText: 'FREE SHIPPING on orders over $50',
  },
  styling: {
    backgroundColor: '#dc2626',
    padding: '12px 20px',
  },
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const headerBlocks = [header_simple, header_nav, header_promo]
