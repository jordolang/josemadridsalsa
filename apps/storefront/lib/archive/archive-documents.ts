/**
 * The ONLY sanctioned read path for `ArchiveDocument` on public or
 * customer-facing surfaces.
 *
 * The archive index contains `SENSITIVE` rows — tax returns (with SSNs), HR
 * files, bank statements, payroll — whose `extractedText` holds raw identifiers.
 * Tagging them is not a boundary on its own; a bare `prisma.archiveDocument
 * .findMany()` in an API route would return them. This module makes the safe
 * query the easy one: every where-clause is AND-composed with a hard
 * `sensitivity != 'SENSITIVE'` exclusion that a caller cannot override — even a
 * caller that explicitly asks for `sensitivity: 'SENSITIVE'` gets nothing,
 * because the two conditions are contradictory.
 *
 * Privileged admin/developer views that legitimately need sensitive records must
 * query Prisma directly and gate access with the RBAC helpers in `lib/rbac.ts`.
 */

import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Compose a caller's where-clause with the non-sensitive guard so the exclusion
 * can never be dropped or overridden. Pure and unit-tested.
 */
export function publicArchiveWhere(
  where: Prisma.ArchiveDocumentWhereInput = {}
): Prisma.ArchiveDocumentWhereInput {
  return {
    AND: [where, { sensitivity: { not: 'SENSITIVE' } }],
  }
}

/**
 * List archive documents safe for public/customer surfaces. Accepts the same
 * arguments as `findMany` but forces the sensitivity guard onto `where`.
 */
export function findPublicArchiveDocuments(
  prisma: PrismaClient,
  args: Omit<Prisma.ArchiveDocumentFindManyArgs, 'where'> & {
    where?: Prisma.ArchiveDocumentWhereInput
  } = {}
) {
  const { where, ...rest } = args
  return prisma.archiveDocument.findMany({
    ...rest,
    where: publicArchiveWhere(where),
  })
}
