import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { TrainingDocument, TrainingDocumentStatus } from '@prisma/client'
import { createMetadata } from '@/lib/metadata'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  {
    label: string
    variant: 'default' | 'secondary' | 'outline' | 'destructive'
    description: string
  }
> = {
  PROCESSING: {
    label: 'Processing',
    variant: 'secondary',
    description: 'Queued for ingestion',
  },
  READY: {
    label: 'Ready',
    variant: 'default',
    description: 'Available to the AI assistant',
  },
  NEEDS_REVIEW: {
    label: 'Needs review',
    variant: 'outline',
    description: 'Text extracted but should be double-checked',
  },
  FAILED: {
    label: 'Failed',
    variant: 'destructive',
    description: 'Extraction failed. Try again or convert the file.',
  },
  UNSUPPORTED: {
    label: 'Unsupported',
    variant: 'outline',
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
  try {
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
  } catch (error) {
    console.error('[Training Data] Error fetching documents:', error)
    throw new Error('Failed to load training documents. Please check your database connection.')
  }
}

export default async function TrainingDataPage() {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:write'))) {
      redirect('/admin')
    }

    const { documents, stats } = await getDocuments()

    return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">AI Training Data</h1>
        <p className="text-muted-foreground">
          Drop in documents or scrape trusted URLs to keep the assistant sharp.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total sources</p>
          <p className="text-2xl font-semibold">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Ready</p>
          <p className="text-2xl font-semibold">{stats[TrainingDocumentStatus.READY]}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Needs review</p>
          <p className="text-2xl font-semibold">
            {stats[TrainingDocumentStatus.NEEDS_REVIEW]}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Characters indexed</p>
          <p className="text-2xl font-semibold">
            {stats.readyCharacters.toLocaleString()}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Upload documents</h2>
            <p className="text-sm text-muted-foreground">
              Accepts markdown, text, Office docs, CSV/XLSX, PDFs, and more. Images are
              captured for manual follow-up.
            </p>
          </div>
          <TrainingUploadForm />
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Scrape a URL</h2>
            <p className="text-sm text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">
                Showing the latest {documents.length} sources.
              </p>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No training documents yet. Upload your first file to get started.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id} className="align-top">
                      <TableCell>
                        <p className="font-medium">{doc.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {summarizeContent(doc.content)}
                        </p>
                        {Array.isArray(doc.warnings) && doc.warnings.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Warnings: {doc.warnings.join('; ')}
                          </p>
                        )}
                        {doc.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">Notes: {doc.notes}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {SOURCE_LABELS[doc.sourceType]}
                        </Badge>
                        {doc.url && (
                          <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
                            {doc.url}
                          </p>
                        )}
                        {doc.fileName && (
                          <p className="mt-1 text-xs text-muted-foreground">{doc.fileName}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_META[doc.status].variant}>
                          {STATUS_META[doc.status].label}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {STATUS_META[doc.status].description}
                        </p>
                      </TableCell>
                      <TableCell>{formatBytes(doc.fileSize)}</TableCell>
                      <TableCell>
                        <p>{formatDate(doc.createdAt)}</p>
                        {doc.ingestedAt && (
                          <p className="text-xs text-muted-foreground">
                            Ready {formatDate(doc.ingestedAt)}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>
    </div>
    )
  } catch (error) {
    console.error('[Training Data] Error rendering:', error)
    throw new Error(error instanceof Error ? error.message : 'Failed to load training data page')
  }
}
