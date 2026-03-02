
export enum BlockCategory {
  HEADER = 'HEADER',
  HERO = 'HERO',
  CONTENT = 'CONTENT',
  PRODUCTS = 'PRODUCTS',
  CTA = 'CTA',
  SOCIAL_FOOTER = 'SOCIAL_FOOTER',
  SPECIAL = 'SPECIAL',
}

export interface BlockVariable {
  key: string
  label: string
  description: string
  type: 'string' | 'number' | 'date' | 'currency' | 'url' | 'html' | 'array'
  required: boolean
  fallback: string
  example: string
}

export interface BlockStyling {
  backgroundColor?: string
  padding?: string
  margin?: string
  // etc.
}

export interface EmailBlock {
  id: string
  name: string
  category: BlockCategory
  description: string
  thumbnail: string
  html: string
  variables: Record<string, BlockVariable>
  defaultProps: Record<string, any>
  styling: BlockStyling
  compatibility: {
    gmail: boolean
    outlook: boolean
    appleMail: boolean
    mobile: boolean
  }
}
