import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EmailComposer } from '@/components/admin/email-composer'
import { createMetadata } from '@/lib/metadata'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const template = await prisma.emailTemplate.findUnique({
    where: { id },
    select: { name: true },
  })

  return createMetadata({
    title: `Compose ${template?.name || 'Email'} - Jose Madrid Salsa Admin`,
    description: 'Build your email template using drag-and-drop blocks',
    pathname: `/admin/emails/${id}/compose`,
  })
}

export default async function EmailComposePage({ params }: PageProps) {
  const { id } = await params

  const template = await prisma.emailTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      key: true,
      name: true,
      subject: true,
      category: true,
      isActive: true,
    },
  })

  if (!template) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/emails">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Templates
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Compose: {template.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Build your email template using pre-designed blocks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-muted rounded text-sm font-medium">
            {template.category}
          </span>
          {template.isActive && (
            <span className="px-3 py-1 bg-primary/10 text-primary rounded text-sm font-medium">
              Active
            </span>
          )}
        </div>
      </div>

      {/* Composer */}
      <EmailComposer templateId={template.id} />
    </div>
  )
}
