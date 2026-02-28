import { EmailBlock, BlockCategory } from './block-definitions'

export const content_single_column: EmailBlock = {
  id: 'content_single_column',
  name: 'Single Column Content',
  category: BlockCategory.CONTENT,
  description: 'Standard text block',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const content_two_column: EmailBlock = {
  id: 'content_two_column',
  name: 'Two Column Content',
  category: BlockCategory.CONTENT,
  description: 'Side-by-side content (already exists)',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const content_three_column: EmailBlock = {
  id: 'content_three_column',
  name: 'Three Column Content',
  category: BlockCategory.CONTENT,
  description: 'Icon + heading + description (3 across)',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const content_image_text: EmailBlock = {
  id: 'content_image_text',
  name: 'Image with Text',
  category: BlockCategory.CONTENT,
  description: 'Image with wrapping text',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const content_testimonial: EmailBlock = {
  id: 'content_testimonial',
  name: 'Testimonial',
  category: BlockCategory.CONTENT,
  description: 'Customer quote + photo + rating',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const content_timeline: EmailBlock = {
  id: 'content_timeline',
  name: 'Timeline',
  category: BlockCategory.CONTENT,
  description: 'Vertical event timeline',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const content_stats: EmailBlock = {
  id: 'content_stats',
  name: 'Stats',
  category: BlockCategory.CONTENT,
  description: 'Multiple stat callouts in a row',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const contentBlocks = [
  content_single_column,
  content_two_column,
  content_three_column,
  content_image_text,
  content_testimonial,
  content_timeline,
  content_stats,
]
