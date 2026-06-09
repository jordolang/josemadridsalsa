import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { fail, serverError } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return fail('Uploads disabled: BLOB_READ_WRITE_TOKEN is not configured', 503)

  const filename = request.nextUrl.searchParams.get('filename')
  if (!filename) return fail('Missing filename query parameter', 400)

  if (!request.body) return fail('Empty request body', 400)

  try {
    const blob = await put(filename, request.body, {
      access: 'public',
      token,
    })

    return NextResponse.json(blob)
  } catch (error) {
    return serverError('Upload failed', error)
  }
}
