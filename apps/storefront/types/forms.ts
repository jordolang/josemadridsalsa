export type BusinessFormCategory = {
  id: 'sales' | 'fundraising' | 'hr' | 'finance' | 'operations'
  label: string
  description: string
}

export type BusinessFormField = {
  id: string
  label: string
  type: 'short-text' | 'long-text' | 'checkbox' | 'table' | 'signature' | 'date' | 'number'
  placeholder?: string
  helperText?: string
  columns?: string[]
  defaultRows?: number
  rows?: string[][]
  rowHeight?: number
}

export type BusinessFormSection = {
  id: string
  label: string
  description?: string
  defaultIncluded?: boolean
  fields: BusinessFormField[]
}

export type BusinessFormTemplate = {
  id: string
  name: string
  categoryId: BusinessFormCategory['id'] | string
  description: string
  tags: string[]
  estimatedCompletion: string
  recommendedUses: string[]
  sections: BusinessFormSection[]
  publicSlug: string
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  version?: number
  source?: 'library' | 'saved'
  updatedAt?: string
}
