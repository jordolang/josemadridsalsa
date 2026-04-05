import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import Papa from 'papaparse'

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

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

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] }
    const BATCH_SIZE = 500

    for (let i = 0; i < parsed.data.length; i += BATCH_SIZE) {
      const batch = parsed.data.slice(i, i + BATCH_SIZE)
      const toUpsert: {
        listId: string
        email: string
        firstName: string | null
        lastName: string | null
        phone: string | null
        source: string
        customFields: Record<string, string> | null
        tags: string[]
      }[] = []

      for (const row of batch) {
        const rawEmail = row[mapping.email]?.trim()?.toLowerCase()
        if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
          result.errors.push(`Invalid email: ${rawEmail || '(empty)'}`)
          result.skipped++
          continue
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
          source: 'csv_import',
          customFields: Object.keys(customFields).length > 0 ? customFields : null,
          tags: [],
        })
      }

      for (const sub of toUpsert) {
        try {
          await prisma.mailingListSubscriber.upsert({
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
              status: 'SUBSCRIBED',
            },
            update: {
              firstName: sub.firstName ?? undefined,
              lastName: sub.lastName ?? undefined,
              phone: sub.phone ?? undefined,
              customFields: sub.customFields ?? undefined,
            },
          })
          result.imported++
        } catch {
          result.skipped++
        }
      }
    }

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('CSV import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
