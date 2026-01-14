import { EmailBlock, BlockCategory } from './block-definitions'

export const product_grid: EmailBlock = {
  id: 'product_grid',
  name: 'Product Grid',
  category: BlockCategory.PRODUCTS,
  description: '3-column product cards (already exists)',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const product_single: EmailBlock = {
  id: 'product_single',
  name: 'Single Product',
  category: BlockCategory.PRODUCTS,
  description: 'Large single product spotlight',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const product_comparison: EmailBlock = {
  id: 'product_comparison',
  name: 'Product Comparison',
  category: BlockCategory.PRODUCTS,
  description: 'Side-by-side comparison table',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const product_carousel: EmailBlock = {
  id: 'product_carousel',
  name: 'Product Carousel',
  category: BlockCategory.PRODUCTS,
  description: 'Horizontal scrolling products',
  thumbnail: '',
  html: `...`,
  variables: {},
  defaultProps: {},
  styling: {},
  compatibility: { gmail: true, outlook: true, appleMail: true, mobile: true },
}

export const productBlocks = [
  product_grid,
  product_single,
  product_comparison,
  product_carousel,
]
