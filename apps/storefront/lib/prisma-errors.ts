import { Prisma } from '@prisma/client'

// Detect Prisma P2021 ("table does not exist") errors, including the case
// where Prisma Accelerate wraps the error and the structured code is lost —
// we then fall back to message heuristics anchored on Prisma's own wording.
export function isMissingTableError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021'
  ) {
    return true
  }

  if (error instanceof Error) {
    const msg = error.message
    const lower = msg.toLowerCase()
    return (
      msg.includes('P2021') ||
      msg.includes('does not exist in the current database') ||
      lower.includes('missing table') ||
      (lower.includes('relation') && lower.includes('does not exist'))
    )
  }

  return false
}

// Detect Prisma P2022 ("column does not exist"). The sibling of P2021, and the shape a
// deploy takes when code lands ahead of its migration: `vercel-build` wraps
// `prisma migrate deploy` in a `|| echo WARN`, so a failed migration still ships a green
// build and the new code then queries a column that was never added.
export function isMissingColumnError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2022'
  ) {
    return true
  }

  if (error instanceof Error) {
    const msg = error.message
    const lower = msg.toLowerCase()
    return (
      msg.includes('P2022') ||
      (lower.includes('column') && lower.includes('does not exist'))
    )
  }

  return false
}

// Standardised log line so missing-table warnings are easy to grep across
// all admin surfaces (RBAC, credentials, future modules).
export function logMissingTableWarning(scope: string, tableName: string): void {
  console.warn(
    `[${scope}] ${tableName} table does not exist. Run \`prisma migrate deploy\`.`,
  )
}
