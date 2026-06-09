import { NextResponse } from 'next/server'

/**
 * Standardized success response utility
 * @param data - The data to return in the response
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with the data
 */
export function successResponse<T = unknown>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(data, { status })
}

/**
 * Standardized error response utility
 * @param error - Error message
 * @param status - HTTP status code (default: 500)
 * @param details - Optional additional error details
 * @returns NextResponse with error format
 */
export function errorResponse(
  error: string,
  status: number = 500,
  details?: unknown
): NextResponse {
  const response: { error: string; details?: unknown } = { error }
  if (details !== undefined) {
    response.details = details
  }
  return NextResponse.json(response, { status })
}
