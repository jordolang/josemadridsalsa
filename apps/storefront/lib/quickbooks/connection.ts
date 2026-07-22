import type { QuickBooksConnection } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import {
  getQuickBooksAppCredentials,
  QUICKBOOKS_SCOPES,
  type QuickBooksEnvironment,
} from './config'
import { refreshTokens, revokeToken, type QuickBooksTokens } from './oauth'

/** Refresh the access token this many ms before it actually expires. */
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

/**
 * The single active QuickBooks connection, if any. This app syncs one company,
 * so we treat the most-recently-updated active connection as the live one.
 */
export async function getConnection(): Promise<QuickBooksConnection | null> {
  return prisma.quickBooksConnection.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  })
}

export type QuickBooksConnectionStatus =
  | { connected: false }
  | {
      connected: true
      realmId: string
      companyName: string | null
      environment: QuickBooksEnvironment
      lastSyncedAt: Date | null
      lastRefreshedAt: Date | null
      connectionError: string | null
    }

/** Non-secret view of the connection for the admin UI. */
export async function getConnectionStatus(): Promise<QuickBooksConnectionStatus> {
  const conn = await getConnection()
  if (!conn) return { connected: false }
  return {
    connected: true,
    realmId: conn.realmId,
    companyName: conn.companyName,
    environment: conn.environment as QuickBooksEnvironment,
    lastSyncedAt: conn.lastSyncedAt,
    lastRefreshedAt: conn.lastRefreshedAt,
    connectionError: conn.connectionError,
  }
}

/** Persist a fresh set of tokens (encrypted) for a realm. Used after connect. */
export async function saveConnection(params: {
  realmId: string
  environment: QuickBooksEnvironment
  tokens: QuickBooksTokens
  companyName?: string | null
  connectedById?: string | null
}): Promise<QuickBooksConnection> {
  const access = encryptSecret(params.tokens.accessToken)
  const refresh = encryptSecret(params.tokens.refreshToken)
  const now = Date.now()

  const data = {
    environment: params.environment,
    companyName: params.companyName ?? null,
    accessToken: access.encryptedValue,
    accessTokenIv: access.iv,
    refreshToken: refresh.encryptedValue,
    refreshTokenIv: refresh.iv,
    accessTokenExpiresAt: new Date(now + params.tokens.expiresIn * 1000),
    refreshTokenExpiresAt: new Date(now + params.tokens.refreshExpiresIn * 1000),
    scopes: QUICKBOOKS_SCOPES,
    isActive: true,
    lastRefreshedAt: new Date(now),
    connectionError: null,
  }

  return prisma.quickBooksConnection.upsert({
    where: { realmId: params.realmId },
    create: { realmId: params.realmId, connectedById: params.connectedById ?? null, ...data },
    update: data,
  })
}

/**
 * Return a valid access token for the active connection, refreshing it in place
 * when it's within the expiry buffer. Throws if there's no connection or the
 * refresh token itself has expired (admin must reconnect).
 */
export async function getValidAccessToken(): Promise<{
  accessToken: string
  realmId: string
  environment: QuickBooksEnvironment
}> {
  const conn = await getConnection()
  if (!conn) throw new Error('QuickBooks is not connected')

  const environment = conn.environment as QuickBooksEnvironment

  const stillFresh =
    conn.accessTokenExpiresAt.getTime() - Date.now() > ACCESS_TOKEN_REFRESH_BUFFER_MS

  if (stillFresh) {
    return {
      accessToken: decryptSecret(conn.accessToken, conn.accessTokenIv),
      realmId: conn.realmId,
      environment,
    }
  }

  if (conn.refreshTokenExpiresAt.getTime() <= Date.now()) {
    await markConnectionError(conn.realmId, 'Refresh token expired — reconnect required')
    throw new Error('QuickBooks refresh token expired — please reconnect')
  }

  const creds = await getQuickBooksAppCredentials(environment)
  if (!creds) {
    throw new Error('QuickBooks OAuth client is not configured')
  }

  const currentRefresh = decryptSecret(conn.refreshToken, conn.refreshTokenIv)

  let tokens: QuickBooksTokens
  try {
    tokens = await refreshTokens({ refreshToken: currentRefresh, creds })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token refresh failed'
    await markConnectionError(conn.realmId, message)
    throw error
  }

  const updated = await saveConnection({
    realmId: conn.realmId,
    environment,
    tokens,
    companyName: conn.companyName,
    connectedById: conn.connectedById,
  })

  return {
    accessToken: decryptSecret(updated.accessToken, updated.accessTokenIv),
    realmId: updated.realmId,
    environment,
  }
}

export async function markConnectionError(realmId: string, message: string) {
  await prisma.quickBooksConnection
    .update({ where: { realmId }, data: { connectionError: message } })
    .catch(() => {})
}

export async function markSynced(realmId: string) {
  await prisma.quickBooksConnection
    .update({ where: { realmId }, data: { lastSyncedAt: new Date() } })
    .catch(() => {})
}

/**
 * Disconnect the active connection: best-effort token revocation, then
 * deactivate the row so no further syncs run.
 */
export async function disconnect(): Promise<void> {
  const conn = await getConnection()
  if (!conn) return

  const environment = conn.environment as QuickBooksEnvironment
  const creds = await getQuickBooksAppCredentials(environment)
  if (creds) {
    try {
      await revokeToken({
        token: decryptSecret(conn.refreshToken, conn.refreshTokenIv),
        creds,
      })
    } catch {
      // Revocation is best-effort; deactivate regardless.
    }
  }

  await prisma.quickBooksConnection.update({
    where: { realmId: conn.realmId },
    data: { isActive: false, connectionError: null },
  })
}
