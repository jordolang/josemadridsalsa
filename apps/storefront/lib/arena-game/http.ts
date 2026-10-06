/**
 * Responses for the Battle Arena game's API. The game runs on its own domain, so every route
 * answers cross-origin: signed-in routes only to the game's listed origins, the public boards
 * and profiles to anyone (they carry no credentials and nothing private).
 */
import { NextResponse } from 'next/server'
import { allowedGameOrigins } from './rules'

/** A failure the game can show the player as-is. `signed_out` sends the game back to sign-in. */
export class ArenaGameError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: 'signed_out' | 'rate_limited' | 'rejected'
  ) {
    super(message)
    this.name = 'ArenaGameError'
  }
}

export type Access = 'player' | 'public'

export function corsHeaders(request: Request, access: Access): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
  const origin = request.headers.get('origin')
  if (access === 'public') headers['Access-Control-Allow-Origin'] = '*'
  else if (origin && allowedGameOrigins().includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

export function preflight(request: Request, access: Access) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, access) })
}

export function json(request: Request, access: Access, body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { ...corsHeaders(request, access), 'Cache-Control': 'no-store', ...init.headers },
  })
}

export function errorResponse(request: Request, access: Access, error: unknown, context: string) {
  if (error instanceof ArenaGameError) {
    return json(request, access, { error: error.message, code: error.code }, { status: error.status })
  }
  console.error(`[ARENA GAME] ${context}:`, error)
  return json(request, access, { error: 'Something went wrong. Please try again in a moment.' }, { status: 500 })
}

/** Parse a JSON body against a schema, or fail with the first message the schema gives. */
export async function readBody<T>(request: Request, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }): Promise<T> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new ArenaGameError('Send the request as JSON.', 400)
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new ArenaGameError(parsed.error.issues[0]?.message || 'Invalid request.', 400)
  return parsed.data
}
