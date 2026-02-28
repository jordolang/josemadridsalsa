import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireCredentialAccess } from '@/lib/credentials-access'
import { encryptValue } from '@/lib/credentials-crypto'
import { ok, fail, forbidden, serverError } from '@/lib/api'
import { logAudit } from '@/lib/audit'

/**
 * CSV Upload for credentials.
 * Expected columns: serviceName, label, username, value, url, notes
 * The first row must be a header row.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireCredentialAccess()
    if (!user) return forbidden('Not Permitted')

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return fail('No file provided', 400)
    if (!file.name.toLowerCase().endsWith('.csv')) return fail('Only .csv files are accepted', 400)

    const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
    if (file.size > MAX_SIZE) return fail('File size must be under 2 MB', 400)

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((line) => line.trim())

    if (lines.length < 2) return fail('CSV must have a header row and at least one data row', 400)

    const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase())
    const requiredCols = ['servicename', 'label', 'value']
    const missing = requiredCols.filter((c) => !header.includes(c))
    if (missing.length > 0) {
      return fail(`CSV missing required columns: ${missing.join(', ')}. Required: serviceName, label, value`, 400)
    }

    const results: { created: number; errors: string[] } = { created: 0, errors: [] }

    for (let i = 1; i < lines.length; i++) {
      try {
        const cols = parseCSVLine(lines[i])
        const row: Record<string, string> = {}
        header.forEach((h, idx) => {
          row[h] = (cols[idx] || '').trim()
        })

        const serviceName = row['servicename'] || ''
        const label = row['label'] || ''
        const value = row['value'] || ''

        if (!serviceName || !label || !value) {
          results.errors.push(`Row ${i + 1}: missing required field(s)`)
          continue
        }

        const { encValue, encIv, encTag } = encryptValue(value)

        await prisma.serviceCredential.create({
          data: {
            serviceName,
            label,
            username: row['username'] || null,
            encValue,
            encIv,
            encTag,
            url: row['url'] || null,
            notes: row['notes'] || null,
            createdById: user.id,
          },
        })

        results.created++
      } catch (err: any) {
        results.errors.push(`Row ${i + 1}: ${err.message}`)
      }
    }

    await logAudit({
      userId: user.id,
      action: 'IMPORT',
      entityType: 'ServiceCredential',
      changes: { fileName: file.name, created: results.created, errors: results.errors.length },
    })

    return ok(results, 201)
  } catch (error: any) {
    console.error('[Credentials Upload API] error:', error)
    return serverError('Failed to process CSV upload')
  }
}

/**
 * Simple CSV line parser that handles quoted fields with commas.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }

  result.push(current)
  return result
}
