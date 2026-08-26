import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import Papa from 'papaparse'

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

/**
 * A 5 MB CSV is tens of thousands of contacts, and each one is a database
 * round trip. Take the full window rather than dying at the 60s default with
 * the list half-imported.
 */
export const maxDuration = 300

/**
 * Rows are upserted a batch at a time inside one `$transaction`, which Prisma
 * sends as a single round trip. Row-by-row upserts meant one round trip each —
 * enough to blow the function budget long before a 22,000-contact import
 * finished.
 */
const BATCH_SIZE = 500

/**
 * Every rejected row used to append a string to the response. A CSV mapped to
 * the wrong column produced one error per row, so the failure report itself
 * became megabytes of JSON.
 */
const MAX_REPORTED_ERRORS = 100

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const list = await prisma.mailingList.findUnique({ where: { id } })
    if (!list) {
      return NextResponse.json({ error: 'Mailing list not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const mappingStr = formData.get('mapping') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    const csvText = await file.text()

    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json({ error: 'Invalid CSV file', details: parsed.errors }, { status: 400 })
    }

    if (!mappingStr) {
      const headers = parsed.meta.fields || []
      const preview = parsed.data.slice(0, 3)
      return NextResponse.json({ headers, preview, totalRows: parsed.data.length })
    }

    const mapping: Record<string, string> = JSON.parse(mappingStr)

    if (!mapping.email) {
      return NextResponse.json({ error: 'Email column mapping is required' }, { status: 400 })
    }

    const statusMappingStr = formData.get('statusMapping') as string | null
    const statusMapping: Record<string, string> | null = statusMappingStr
      ? JSON.parse(statusMappingStr)
      : null

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] }
    const recordError = (message: string) => {
      if (result.errors.length < MAX_REPORTED_ERRORS) result.errors.push(message)
    }

    for (let i = 0; i < parsed.data.length; i += BATCH_SIZE) {
      const batch = parsed.data.slice(i, i + BATCH_SIZE)
      const toUpsert: {
        listId: string
        email: string
        firstName: string | null
        lastName: string | null
        phone: string | null
        source: string
        status: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'BOUNCED' | 'COMPLAINED'
        customFields: Record<string, string> | null
        tags: string[]
      }[] = []

      for (const row of batch) {
        const rawEmail = row[mapping.email]?.trim()?.toLowerCase()
        if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
          recordError(`Invalid email: ${rawEmail || '(empty)'}`)
          result.skipped++
          continue
        }

        let resolvedStatus: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'BOUNCED' | 'COMPLAINED' = 'SUBSCRIBED'
        if (mapping.status && statusMapping) {
          const rawStatus = row[mapping.status]?.trim()
          if (rawStatus && statusMapping[rawStatus]) {
            resolvedStatus = statusMapping[rawStatus] as typeof resolvedStatus
          }
        }

        const knownMappedValues = new Set(Object.values(mapping))
        const customFields: Record<string, string> = {}
        for (const [header, value] of Object.entries(row)) {
          if (!knownMappedValues.has(header) && value?.trim()) {
            customFields[header] = value.trim()
          }
        }

        toUpsert.push({
          listId: id,
          email: rawEmail,
          firstName: mapping.firstName ? (row[mapping.firstName]?.trim() || null) : null,
          lastName: mapping.lastName ? (row[mapping.lastName]?.trim() || null) : null,
          phone: mapping.phone ? (row[mapping.phone]?.trim() || null) : null,
          source: mapping.source ? (row[mapping.source]?.trim() || 'csv_import') : 'csv_import',
          status: resolvedStatus,
          customFields: Object.keys(customFields).length > 0 ? customFields : null,
          tags: [],
        })
      }

      const upsertFor = (sub: (typeof toUpsert)[number]) =>
        prisma.mailingListSubscriber.upsert({
          where: { listId_email: { listId: sub.listId, email: sub.email } },
          create: {
            listId: sub.listId,
            email: sub.email,
            firstName: sub.firstName,
            lastName: sub.lastName,
            phone: sub.phone,
            source: sub.source,
            customFields: sub.customFields ?? undefined,
            tags: sub.tags,
            status: sub.status,
          },
          update: {
            firstName: sub.firstName ?? undefined,
            lastName: sub.lastName ?? undefined,
            phone: sub.phone ?? undefined,
            customFields: sub.customFields ?? undefined,
            status: sub.status,
          },
        })

      try {
        await prisma.$transaction(toUpsert.map(upsertFor))
        result.imported += toUpsert.length
      } catch {
        // One bad row rolls the whole batch back, so retry it row by row to
        // keep the rest of the batch and isolate the row that actually failed.
        for (const sub of toUpsert) {
          try {
            await upsertFor(sub)
            result.imported++
          } catch {
            recordError(`Could not import: ${sub.email}`)
            result.skipped++
          }
        }
      }
    }

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'import',
        entityType: 'mailing_list',
        entityId: id,
        changes: { imported: result.imported, skipped: result.skipped },
      },
      request
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('CSV import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
