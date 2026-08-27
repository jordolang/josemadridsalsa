import { NextRequest } from 'next/server'
import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { developerApiErrorResponse } from '@/lib/developer/api-errors'
import { getErrorMessage } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import {
  DEFAULT_ROW_LIMIT,
  classifyStatement,
  executeRead,
  executeWrite,
  signConfirmation,
  sqlConsoleRequestSchema,
  verifyConfirmation,
} from '@/lib/developer/sql-console'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SchemaColumn {
  table_name: string
  column_name: string
  data_type: string
  is_nullable: string
}

/**
 * GET /api/developer/admin/sql
 * Developer-only — the public schema's tables and columns, so the console can
 * offer a reference panel without anyone having to guess Prisma's table names.
 */
export async function GET() {
  try {
    await requirePermission('developer:database')

    // Constant SQL against the catalog — no user input reaches this query.
    const columns = await prisma.$queryRaw<SchemaColumn[]>`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `

    const tables = new Map<string, { name: string; columns: Array<Record<string, unknown>> }>()
    for (const column of columns) {
      let table = tables.get(column.table_name)
      if (!table) {
        table = { name: column.table_name, columns: [] }
        tables.set(column.table_name, table)
      }
      table.columns.push({
        name: column.column_name,
        type: column.data_type,
        nullable: column.is_nullable === 'YES',
      })
    }

    return ok({ tables: Array.from(tables.values()) })
  } catch (error: unknown) {
    return developerApiErrorResponse(error) ?? serverError('Failed to load database schema', error)
  }
}

/**
 * POST /api/developer/admin/sql
 * Developer-only — run one statement against the database.
 *
 * Reads return rows immediately. Writes are executed once as a rolled-back dry
 * run and answered with `status: "confirmation_required"` plus a signed token;
 * posting the same statement back with that token commits it. Every outcome,
 * including refusals, is written to the audit trail.
 */
export async function POST(req: NextRequest) {
  let user: { id: string } | undefined

  try {
    user = await requirePermission('developer:database')

    const body = await req.json().catch(() => null)
    const parsed = sqlConsoleRequestSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return fail(`Validation error: ${issue.path.join('.') || 'sql'} — ${issue.message}`)
    }

    const { sql, confirmation } = parsed.data
    const limit = parsed.data.limit ?? DEFAULT_ROW_LIMIT
    const classification = classifyStatement(sql)

    if (classification.kind === 'blocked') {
      await logAuditWithRequest(
        {
          userId: user.id,
          action: 'developer.sql.blocked',
          entityType: 'Database',
          changes: { sql, command: classification.command, reason: classification.reason },
        },
        req
      )
      return fail(classification.reason ?? 'This statement is not allowed.', 422)
    }

    const startedAt = Date.now()

    if (classification.kind === 'read') {
      const result = await executeRead(sql, classification.command, limit)
      const durationMs = Date.now() - startedAt

      await logAuditWithRequest(
        {
          userId: user.id,
          action: 'developer.sql.read',
          entityType: 'Database',
          changes: { sql, command: classification.command, rowCount: result.rowCount, durationMs },
        },
        req
      )

      return ok({ status: 'ok', kind: 'read', command: classification.command, durationMs, ...result })
    }

    // Writes: preview first, commit only against a confirmation for this exact statement.
    const confirmationCheck = confirmation
      ? verifyConfirmation(confirmation, sql, user.id)
      : { valid: false, reason: undefined }

    if (confirmation && !confirmationCheck.valid) {
      return fail(confirmationCheck.reason ?? 'Confirmation is not valid.', 409)
    }

    const commit = confirmationCheck.valid
    const outcome = await executeWrite(sql, commit)
    const durationMs = Date.now() - startedAt

    if (!commit) {
      const signed = signConfirmation(sql, user.id)

      await logAuditWithRequest(
        {
          userId: user.id,
          action: 'developer.sql.dry_run',
          entityType: 'Database',
          changes: {
            sql,
            command: classification.command,
            affectedRows: outcome.affectedRows,
            unscoped: classification.unscoped,
            durationMs,
          },
        },
        req
      )

      return ok({
        status: 'confirmation_required',
        kind: 'write',
        command: classification.command,
        affectedRows: outcome.affectedRows,
        unscoped: classification.unscoped,
        note: classification.reason,
        confirmation: signed.token,
        expiresAt: signed.expiresAt,
        durationMs,
      })
    }

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'developer.sql.write',
        entityType: 'Database',
        changes: {
          sql,
          command: classification.command,
          affectedRows: outcome.affectedRows,
          unscoped: classification.unscoped,
          durationMs,
        },
      },
      req
    )

    return ok({
      status: 'committed',
      kind: 'write',
      command: classification.command,
      affectedRows: outcome.affectedRows,
      durationMs,
    })
  } catch (error: unknown) {
    const mapped = developerApiErrorResponse(error)
    if (mapped) return mapped

    // A rejected statement is an expected outcome here, not a platform fault:
    // report Postgres' own message so the operator can fix the query.
    const message = getErrorMessage(error)
    if (user) {
      await logAuditWithRequest(
        { userId: user.id, action: 'developer.sql.error', entityType: 'Database', changes: { message } },
        req
      )
    }

    return fail(message || 'The statement could not be executed.', 400)
  }
}
