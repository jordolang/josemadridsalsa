import { put } from '@vercel/blob'
import type { NextRequest } from 'next/server'
import { fail, ok, serverError, unauthorized } from '@/lib/api'
import {
  buildPromoReleasePathname,
  buildPromoReleasePdf,
  createPromoReleaseRecord,
  networkLocationFromHeaders,
  promoReleaseSubmissionSchema,
  toPromoReleaseLogEntry,
} from '@/lib/waivers/promoRelease'
import { resolveWaiverStaff } from '@/lib/waivers/staffCollector'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const collectedBy = await resolveWaiverStaff()
  if (!collectedBy) return unauthorized('Sign in as staff to collect waivers')

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return fail('Waiver storage is not configured (BLOB_READ_WRITE_TOKEN missing)', 503)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('Invalid JSON body', 400)
  }

  const parsed = promoReleaseSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return fail('Please check the form and try again', 422, parsed.error.flatten().fieldErrors)
  }

  const record = createPromoReleaseRecord(parsed.data, {
    collectedBy,
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'),
    networkLocation: networkLocationFromHeaders(request.headers),
  })

  try {
    const pathname = buildPromoReleasePathname(record)
    const pdf = await buildPromoReleasePdf(record)

    // The josemadridsalsa-blob store is public, so the random suffix keeps
    // these URLs unguessable; nothing on the site links to or lists them.
    // The PDF goes first so the JSON log entry can point at it.
    const pdfBlob = await put(`${pathname}.pdf`, Buffer.from(pdf), {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: true,
      token,
    })
    // The drawn signature lives in the PDF; the JSON stays small and searchable.
    await put(`${pathname}.json`, JSON.stringify(toPromoReleaseLogEntry(record, pdfBlob.url), null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: true,
      token,
    })

    return ok(
      {
        id: record.id,
        code: record.code,
        decision: record.decision,
        submittedAt: record.submittedAt,
      },
      201,
    )
  } catch (error) {
    return serverError('Could not save the waiver', error)
  }
}
