import { EmailBlock, BlockCategory } from './block-definitions'

export const social_bar: EmailBlock = {
  id: 'social_bar',
  name: 'Social Bar',
  category: BlockCategory.SOCIAL_FOOTER,
  description: 'Social media icon links (already exists)',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const social_proof: EmailBlock = {
  id: 'social_proof',
  name: 'Social Proof',
  category: BlockCategory.SOCIAL_FOOTER,
  description: 'Star rating + testimonials',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const footer_simple: EmailBlock = {
  id: 'footer_simple',
  name: 'Simple Footer',
  category: BlockCategory.SOCIAL_FOOTER,
  description: 'Contact + unsubscribe (already exists)',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const footer_detailed: EmailBlock = {
  id: 'footer_detailed',
  name: 'Detailed Footer',
  category: BlockCategory.SOCIAL_FOOTER,
  description: 'Multi-column footer with links',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const socialFooterBlocks = [
  social_bar,
  social_proof,
  footer_simple,
  footer_detailed,
]
