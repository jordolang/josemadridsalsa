import { Metadata } from 'next'
import { EmailTemplateGallery } from '@/components/admin/email-template-gallery'
import { newsletterBlocks, newsletterTemplates } from '@/lib/email/templates'

export const metadata: Metadata = {
  title: 'Email templates',
  description: 'Preview and export Jose Madrid Salsa newsletter templates and reusable HTML building blocks.',
}

export default function AdminEmailTemplatesPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-salsa-500">Email studio</p>
        <h1 className="text-3xl font-serif font-semibold text-gray-900">Newsletter templates</h1>
        <p className="text-sm text-gray-600 max-w-2xl">
          Export ready-to-send HTML newsletters or assemble your own using drag-and-drop friendly blocks. Templates
          are designed to work across Mailchimp, Klaviyo, and Constant Contact.
        </p>
      </header>
      <EmailTemplateGallery templates={newsletterTemplates} blocks={newsletterBlocks} />
    </div>
  )
}
