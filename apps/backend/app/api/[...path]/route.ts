import type { NextRequest } from 'next/server'

const legacyOrigin = process.env.LEGACY_STOREFRONT_ORIGIN ?? 'http://localhost:3000'

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const target = new URL(`/api/${path.join('/')}`, legacyOrigin)
  target.search = request.nextUrl.search

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')
  headers.set('x-forwarded-host', request.nextUrl.host)
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''))

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    redirect: 'manual',
  })

  const responseHeaders = new Headers(upstream.headers)
  responseHeaders.delete('content-length')
  responseHeaders.delete('content-encoding')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export const DELETE = proxy
export const GET = proxy
export const HEAD = proxy
export const OPTIONS = proxy
export const PATCH = proxy
export const POST = proxy
export const PUT = proxy
