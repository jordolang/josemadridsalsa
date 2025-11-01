import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Standard success response
 */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

/**
 * Standard error response
 */
export function fail(message: string, status = 400, details?: any) {
  return NextResponse.json(
    {
      error: message,
      details,
    },
    { status }
  )
}

/**
 * Internal server error response
 */
export function serverError(message = 'Internal server error', error?: any) {
  console.error('Server error:', error)
  return NextResponse.json(
    {
      error: message,
    },
    { status: 500 }
  )
}

/**
 * Unauthorized response
 */
export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json(
    {
      error: message,
    },
    { status: 401 }
  )
}

/**
 * Forbidden response
 */
export function forbidden(message = 'Forbidden') {
  return NextResponse.json(
    {
      error: message,
    },
    { status: 403 }
  )
}

/**
 * Not found response
 */
export function notFound(message = 'Not found') {
  return NextResponse.json(
    {
      error: message,
    },
    { status: 404 }
  )
}

/**
 * Parse query parameters from request
 */
export function parseQuery(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query: Record<string, string> = {}

  searchParams.forEach((value, key) => {
    query[key] = value
  })

  return query
}

/**
 * Parse pagination parameters
 */
export function parsePagination(request: NextRequest) {
  const query = parseQuery(request)
  const page = Math.max(1, parseInt(query.page || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '50')))
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

/**
 * Parse sort parameters
 */
export function parseSort(request: NextRequest, defaultSort = 'createdAt') {
  const query = parseQuery(request)
  const sortBy = query.sortBy || defaultSort
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc'

  return { sortBy, sortOrder }
}

/**
 * Parse date range parameters
 */
export function parseDateRange(request: NextRequest) {
  const query = parseQuery(request)
  
  let startDate: Date | undefined
  let endDate: Date | undefined

  if (query.startDate) {
    startDate = new Date(query.startDate)
  }

  if (query.endDate) {
    endDate = new Date(query.endDate)
  }

  return { startDate, endDate }
}

/**
 * Parse search parameter
 */
export function parseSearch(request: NextRequest) {
  const query = parseQuery(request)
  return query.search || query.q || ''
}

/**
 * Create paginated response
 */
export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  const totalPages = Math.ceil(total / limit)

  return ok({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  })
}

/**
 * Validate required fields
 */
export function validateRequired(
  data: Record<string, any>,
  fields: string[]
): boolean {
  const missing = fields.filter((field) => !data[field])

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`)
  }

  return true
}

/**
 * Try-catch wrapper for API handlers
 */
export async function tryCatch<T>(
  handler: () => Promise<T>,
  errorMessage = 'An error occurred'
) {
  try {
    return await handler()
  } catch (error: any) {
    console.error('API Error:', error)

    if (error.message.includes('Unauthorized')) {
      return unauthorized(error.message)
    }

    if (error.message.includes('Forbidden')) {
      return forbidden(error.message)
    }

    if (error.message.includes('Not found')) {
      return notFound(error.message)
    }

    return serverError(errorMessage, error)
  }
}
