import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { CaptureClient, type CaptureSummary } from './_components/CaptureClient'

export const metadata: Metadata = createMetadata({
  title: 'Form Capture - Jose Madrid Salsa Admin',
  description: 'Photograph a paper form and let it become ledger entries.',
  pathname: '/admin/financials/capture',
})

// The queue changes as forms are photographed; never serve a cached view of it.
export const dynamic = 'force-dynamic'

export default async function FormCapturePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin?callbackUrl=/admin/financials/capture')
  if (!(await hasPermission(user, 'financials:read'))) redirect('/admin')

  const canWrite = await hasPermission(user, 'financials:write')

  const captures = await prisma.formCapture.findMany({
    where: { status: { notIn: ['REJECTED'] } },
    orderBy: [{ uploadedAt: 'desc' }],
    take: 40,
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })

  const summaries: CaptureSummary[] = captures.map((capture) => ({
    id: capture.id,
    formType: capture.formType,
    status: capture.status,
    fileUrl: capture.fileUrl,
    fileName: capture.fileName,
    capturedOn: capture.capturedOn?.toISOString() ?? null,
    statedTotalCents: capture.statedTotalCents,
    reconciled: capture.reconciled,
    minConfidence: capture.minConfidence ? Number(capture.minConfidence) : null,
    extractionError: capture.extractionError,
    duplicateOfId: capture.duplicateOfId,
    uploadedAt: capture.uploadedAt.toISOString(),
    lines: capture.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      label: line.label,
      direction: line.direction,
      category: line.category,
      amountCents: line.amountCents,
      quantity: line.quantity,
      confidence: line.confidence ? Number(line.confidence) : null,
      rawValue: line.rawValue,
      edited: line.edited,
      excluded: line.excluded,
    })),
  }))

  return <CaptureClient initialCaptures={summaries} canWrite={canWrite} />
}
