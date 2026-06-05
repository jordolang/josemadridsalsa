import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import {
  getAyrshareStatus,
  saveAyrshareApiKey,
  deleteAyrshareApiKey,
} from '@/lib/social/ayrshare'

// Read Ayrshare connection status (which accounts the owner has linked).
export async function GET() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:compose'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await getAyrshareStatus())
}

// Save the Ayrshare API key (the single value that powers easy mode).
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:publish'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { apiKey?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  if (!apiKey) {
    return NextResponse.json({ error: 'Paste your Ayrshare API key.' }, { status: 400 })
  }

  await saveAyrshareApiKey(apiKey, user.id)
  await logAudit({
    userId: user.id,
    action: 'social_credentials.save',
    entityType: 'SocialPlatformCredential',
    changes: { provider: 'ayrshare' },
  })

  // Return fresh status so the UI can immediately show linked accounts.
  return NextResponse.json({ ok: true, ...(await getAyrshareStatus()) })
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:publish'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await deleteAyrshareApiKey()
  await logAudit({
    userId: user.id,
    action: 'social_credentials.delete',
    entityType: 'SocialPlatformCredential',
    changes: { provider: 'ayrshare' },
  })
  return NextResponse.json({ ok: true })
}
