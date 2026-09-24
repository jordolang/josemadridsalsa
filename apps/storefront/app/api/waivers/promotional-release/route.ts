import { put } from '@vercel/blob'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { fail, ok, serverError, unauthorized } from '@/lib/api'
import { getCurrentUser, isStaff } from '@/lib/rbac'
import {
  buildPromoReleasePathname,
  buildPromoReleasePdf,
  createPromoReleaseRecord,
  promoReleaseSubmissionSchema,
} from '@/lib/waivers/promoRelease'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The kiosk runs on a staff-signed-in iPad; mirror requireAdminSession without the redirect. */
async function resolveStaffCollector(): Promise<string | null> {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (process.env.ADMIN_SECRET_TOKEN && adminToken === process.env.ADMIN_SECRET_TOKEN) {
    return 'admin-token'
  }

  const user = await getCurrentUser()
  if (user && isStaff(user)) return user.email || user.id
  return null
}

export async function POST(request: NextRequest) {
  const collectedBy = await resolveStaffCollector()
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
  })

  try {
    const pathname = buildPromoReleasePathname(record)
    const pdf = await buildPromoReleasePdf(record)

    // The josemadridsalsa-blob store is public, so the random suffix keeps
    // these URLs unguessable; nothing on the site links to or lists them.
    const [pdfBlob, jsonBlob] = await Promise.all([
      put(`${pathname}.pdf`, Buffer.from(pdf), {
        access: 'public',
        contentType: 'application/pdf',
        addRandomSuffix: true,
        token,
      }),
      put(
        `${pathname}.json`,
        // The drawn signature lives in the PDF; keep the JSON record small and searchable.
        JSON.stringify({ ...record, signature: undefined, signed: Boolean(record.signature) }, null, 2),
        {
          access: 'public',
          contentType: 'application/json',
          addRandomSuffix: true,
          token,
        },
      ),
    ])

    return ok(
      {
        id: record.id,
        decision: record.decision,
        pdfPathname: pdfBlob.pathname,
        jsonPathname: jsonBlob.pathname,
      },
      201,
    )
  } catch (error) {
    return serverError('Could not save the waiver', error)
  }
}
