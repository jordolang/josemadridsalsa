export type NewsletterTemplate = {
  id: string
  name: string
  subject: string
  description: string
  tags: string[]
  html: string
}

export type NewsletterBlock = {
  id: string
  label: string
  category: 'hero' | 'content' | 'cta' | 'social' | 'footer'
  description: string
  html: string
}
