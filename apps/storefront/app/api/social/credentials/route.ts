import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import {
  SOCIAL_PROVIDERS,
  saveProviderCredentials,
  deleteProviderCredentials,
  type SocialProvider,
} from '@/lib/social/credentials'

function isValidProvider(value: unknown): value is SocialProvider {
  return typeof value === 'string' && (SOCIAL_PROVIDERS as string[]).includes(value)
}

// Save app-level OAuth credentials for a provider, entered from the admin panel.
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:publish'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { provider?: unknown; clientId?: unknown; clientSecret?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!isValidProvider(body.provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : ''
  const clientSecret = typeof body.clientSecret === 'string' ? body.clientSecret.trim() : ''

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Both the ID/key and secret are required.' }, { status: 400 })
  }

  await saveProviderCredentials({
    provider: body.provider,
    clientId,
    clientSecret,
    updatedById: user.id,
  })

  await logAudit({
    userId: user.id,
    action: 'social_credentials.save',
    entityType: 'SocialPlatformCredential',
    // Never log the secret — only which provider was configured.
    changes: { provider: body.provider },
  })

  return NextResponse.json({ ok: true, provider: body.provider })
}

// Remove admin-entered credentials for a provider (env fallback still applies).
export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:publish'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const provider = new URL(request.url).searchParams.get('provider')
  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  await deleteProviderCredentials(provider)

  await logAudit({
    userId: user.id,
    action: 'social_credentials.delete',
    entityType: 'SocialPlatformCredential',
    changes: { provider },
  })

  return NextResponse.json({ ok: true, provider })
}
