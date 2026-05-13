/**
 * Type-safe error handling utilities.
 *
 * Use these functions to safely extract error information from unknown error values
 * (e.g., in catch blocks) without using `any`.
 */

/**
 * Type guard to check if an error has a message property.
 *
 * @param error - The error value to check
 * @returns True if the error is an object with a string message property
 */
export function isErrorWithMessage(
  error: unknown
): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  )
}

/**
 * Safely extracts an error message from an unknown error value.
 *
 * @param error - The error value to extract a message from
 * @returns The error message string, or a default message if extraction fails
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation()
 * } catch (error: unknown) {
 *   const message = getErrorMessage(error)
 *   console.error('Operation failed:', message)
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred'
}
