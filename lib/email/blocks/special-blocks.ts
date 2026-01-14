import { EmailBlock, BlockCategory } from './block-definitions'

export const divider: EmailBlock = {
  id: 'divider',
  name: 'Divider',
  category: BlockCategory.SPECIAL,
  description: 'Horizontal line separator',
  thumbnail: '',
  html: `<hr>`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const spacer: EmailBlock = {
  id: 'spacer',
  name: 'Spacer',
  category: BlockCategory.SPECIAL,
  description: 'Vertical spacing control',
  thumbnail: '',
  html: `<div style="height: 20px;"></div>`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const coupon_code: EmailBlock = {
  id: 'coupon_code',
  name: 'Coupon Code',
  category: BlockCategory.SPECIAL,
  description: 'Highlighted discount code',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const urgency_banner: EmailBlock = {
  id: 'urgency_banner',
  name: 'Urgency Banner',
  category: BlockCategory.SPECIAL,
  description: 'Eye-catching urgency message',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const specialBlocks = [divider, spacer, coupon_code, urgency_banner]
