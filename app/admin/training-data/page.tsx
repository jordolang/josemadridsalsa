import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { TrainingDocument, TrainingDocumentStatus } from '@prisma/client'
import { createMetadata } from '@/lib/metadata'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrainingUploadForm } from './_components/training-upload-form'
import { UrlScrapeForm } from './_components/url-scrape-form'

export const metadata: Metadata = createMetadata({
  title: 'AI Training Data - Jose Madrid Salsa Admin',
  description: 'Upload documents or scrape URLs to enrich the AI assistant knowledge base.',
  pathname: '/admin/training-data',
})

type TrainingStats = Record<TrainingDocumentStatus, number> & {
  total: number
  readyCharacters: number
}

const STATUS_META: Record<
  TrainingDocumentStatus,
  { label: string; badgeClass: string; description: string }
> = {
  PROCESSING: {
    label: 'Processing',
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    description: 'Queued for ingestion',
  },
  READY: {
    label: 'Ready',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    description: 'Available to the AI assistant',
  },
  NEEDS_REVIEW: {
    label: 'Needs review',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    description: 'Text extracted but should be double-checked',
  },
  FAILED: {
    label: 'Failed',
    badgeClass: 'bg-red-50 text-red-700 border border-red-200',
    description: 'Extraction failed. Try again or convert the file.',
  },
  UNSUPPORTED: {
    label: 'Unsupported',
    badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
    description: 'Format requires OCR or manual transcription',
  },
}

const SOURCE_LABELS = {
  UPLOAD: 'Upload',
  URL: 'URL',
  NOTE: 'Manual',
} as const

function formatBytes(bytes?: number | null) {
  if (!bytes || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function summarizeContent(content?: string | null) {
  if (!content) return 'No extracted text yet.'
  if (content.length <= 200) return content
  return `${content.slice(0, 200)}…`
}

async function getDocuments() {
  const documents = await prisma.trainingDocument.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const initial: TrainingStats = {
    total: 0,
    readyCharacters: 0,
    [TrainingDocumentStatus.PROCESSING]: 0,
    [TrainingDocumentStatus.READY]: 0,
    [TrainingDocumentStatus.NEEDS_REVIEW]: 0,
    [TrainingDocumentStatus.FAILED]: 0,
    [TrainingDocumentStatus.UNSUPPORTED]: 0,
  }

  const stats = documents.reduce<TrainingStats>((acc, doc) => {
    acc.total += 1
    acc[doc.status] += 1
    if (doc.content?.length) {
      acc.readyCharacters += doc.content.length
    }
    return acc
  }, initial)

  return { documents, stats }
}

export default async function TrainingDataPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin')
  }

  const { documents, stats } = await getDocuments()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">AI Training Data</h1>
        <p className="text-slate-600">
          Drop in documents or scrape trusted URLs to keep the assistant sharp.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Total sources</p>
          <p className="text-2xl font-semibold">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Ready</p>
          <p className="text-2xl font-semibold">{stats[TrainingDocumentStatus.READY]}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Needs review</p>
          <p className="text-2xl font-semibold">
            {stats[TrainingDocumentStatus.NEEDS_REVIEW]}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Characters indexed</p>
          <p className="text-2xl font-semibold">
            {stats.readyCharacters.toLocaleString()}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Upload documents</h2>
            <p className="text-sm text-slate-600">
              Accepts markdown, text, Office docs, CSV/XLSX, PDFs, and more. Images are
              captured for manual follow-up.
            </p>
          </div>
          <TrainingUploadForm />
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Scrape a URL</h2>
            <p className="text-sm text-slate-600">
              Paste blog posts, help-center articles, or trusted resources. HTML is cleaned
              before indexing.
            </p>
          </div>
          <UrlScrapeForm />
        </Card>
      </div>

      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Recent ingests</h2>
              <p className="text-sm text-slate-500">
                Showing the latest {documents.length} sources.
              </p>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No training documents yet. Upload your first file to get started.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-3">Title</th>
                    <th className="pb-3">Source</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Size</th>
                    <th className="pb-3">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                      <tr key={doc.id} className="align-top">
                        <td className="py-4">
                          <p className="font-medium">{doc.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {summarizeContent(doc.content)}
                          </p>
                          {Array.isArray(doc.warnings) && doc.warnings.length > 0 && (
                            <p className="mt-1 text-xs text-amber-600">
                              Warnings: {doc.warnings.join('; ')}
                            </p>
                          )}
                          {doc.notes && (
                            <p className="mt-1 text-xs text-slate-500">Notes: {doc.notes}</p>
                          )}
                        </td>
                        <td className="py-4">
                          <Badge variant="outline">
                            {SOURCE_LABELS[doc.sourceType]}
                          </Badge>
                          {doc.url && (
                            <p className="mt-1 truncate text-xs text-slate-500 max-w-xs">
                              {doc.url}
                            </p>
                          )}
                          {doc.fileName && (
                            <p className="mt-1 text-xs text-slate-500">{doc.fileName}</p>
                          )}
                        </td>
                        <td className="py-4">
                          <div className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[doc.status].badgeClass}`}>
                            {STATUS_META[doc.status].label}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {STATUS_META[doc.status].description}
                          </p>
                        </td>
                        <td className="py-4">{formatBytes(doc.fileSize)}</td>
                        <td className="py-4">
                          <p>{formatDate(doc.createdAt)}</p>
                          {doc.ingestedAt && (
                            <p className="text-xs text-slate-500">
                              Ready {formatDate(doc.ingestedAt)}
                            </p>
                          )}
                        </td>
                      </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
