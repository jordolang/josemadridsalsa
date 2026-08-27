import { createHmac, timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

/**
 * Guarded SQL console used by the Developer Console and the desktop admin apps.
 *
 * Everything the platform normally does goes through Prisma models and the
 * validated API routes. This module is the deliberate exception: a DEVELOPER-only
 * escape hatch for direct statements. Because it bypasses Zod schemas, model
 * hooks and inventory transactions, it is built to make the dangerous cases
 * loud rather than convenient:
 *
 *  - one statement per request, never a batch;
 *  - reads run inside a READ ONLY transaction with a row cap and a timeout;
 *  - writes are executed once as a rolled-back dry run, and only committed when
 *    the caller comes back with a signed confirmation for that exact statement;
 *  - schema changes (DDL) are refused outright — those belong in a migration;
 *  - every attempt is written to the audit trail by the calling route.
 */

export const DEFAULT_ROW_LIMIT = 200
export const MAX_ROW_LIMIT = 1000
export const STATEMENT_TIMEOUT_MS = 15_000
export const TRANSACTION_TIMEOUT_MS = 25_000
export const CONFIRMATION_TTL_MS = 5 * 60_000

export const sqlConsoleRequestSchema = z.object({
  sql: z.string().trim().min(1, 'Enter a SQL statement').max(20_000),
  limit: z.number().int().min(1).max(MAX_ROW_LIMIT).optional(),
  confirmation: z.string().min(1).optional(),
})

export type SqlConsoleRequest = z.infer<typeof sqlConsoleRequestSchema>

export type SqlStatementKind = 'read' | 'write' | 'blocked'

export interface SqlClassification {
  kind: SqlStatementKind
  /** Leading command keyword, upper-cased (SELECT, UPDATE, DROP, ...). */
  command: string
  /** Why a statement was blocked, or why a write needs extra care. */
  reason?: string
  /** True for UPDATE/DELETE with no WHERE clause — affects every row. */
  unscoped: boolean
}

/** Commands that only read. */
const READ_COMMANDS = new Set(['SELECT', 'WITH', 'TABLE', 'VALUES', 'EXPLAIN', 'SHOW'])

/** Commands that change rows. Allowed, but only behind a confirmed dry run. */
const WRITE_COMMANDS = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE'])

/**
 * Commands the console will run. Anything outside this set is refused by name,
 * which keeps DDL, permission changes and session/transaction control out.
 *
 * The check is deliberately on the *leading* command rather than a keyword scan
 * of the whole statement: Postgres grammar does not permit DDL nested inside a
 * DML statement, and a naive scan would reject every `UPDATE ... SET ...`.
 */
const ALLOWED_COMMANDS = new Set([...READ_COMMANDS, ...WRITE_COMMANDS])

/** Refused commands that deserve a more useful message than "not supported". */
const SCHEMA_COMMANDS = new Set([
  'ALTER',
  'CREATE',
  'DROP',
  'TRUNCATE',
  'REINDEX',
  'REFRESH',
  'CLUSTER',
  'COMMENT',
])

const PERMISSION_COMMANDS = new Set(['GRANT', 'REVOKE', 'REASSIGN', 'SECURITY'])

const TRANSACTION_COMMANDS = new Set([
  'BEGIN',
  'START',
  'COMMIT',
  'ROLLBACK',
  'SAVEPOINT',
  'RELEASE',
  'SET',
  'RESET',
  'DISCARD',
  'LOCK',
])

/**
 * Functions that read or write the server's filesystem, hold a connection open,
 * or change session settings the guards below depend on. None of them belong in
 * an admin console query.
 */
const FORBIDDEN_FUNCTION_PATTERN =
  /\b(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|pg_sleep|dblink|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|set_config)\s*\(/i

/**
 * Replace comments, string literals and quoted identifiers with harmless
 * placeholders of the same length, so keyword and statement-separator scanning
 * cannot be fooled by `'; DROP TABLE orders; --'` inside a string.
 *
 * Dollar-quoted strings are not rewritten — they are reported instead, because
 * their only real use here would be a function body, which is DDL we refuse.
 */
export function stripSqlNoise(sql: string): { stripped: string; hasDollarQuote: boolean } {
  let stripped = ''
  let hasDollarQuote = false
  let i = 0

  while (i < sql.length) {
    const char = sql[i]
    const next = sql[i + 1]

    // -- line comment
    if (char === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') {
        stripped += ' '
        i += 1
      }
      continue
    }

    // /* block comment */ (Postgres nests these)
    if (char === '/' && next === '*') {
      let depth = 0
      while (i < sql.length) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth += 1
          stripped += '  '
          i += 2
        } else if (sql[i] === '*' && sql[i + 1] === '/') {
          depth -= 1
          stripped += '  '
          i += 2
          if (depth === 0) break
        } else {
          stripped += sql[i] === '\n' ? '\n' : ' '
          i += 1
        }
      }
      continue
    }

    // 'string literal' with '' escaping
    if (char === "'") {
      stripped += ' '
      i += 1
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          stripped += '  '
          i += 2
          continue
        }
        if (sql[i] === "'") {
          stripped += ' '
          i += 1
          break
        }
        stripped += sql[i] === '\n' ? '\n' : ' '
        i += 1
      }
      continue
    }

    // "quoted identifier" with "" escaping
    if (char === '"') {
      stripped += ' '
      i += 1
      while (i < sql.length) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          stripped += '  '
          i += 2
          continue
        }
        if (sql[i] === '"') {
          stripped += ' '
          i += 1
          break
        }
        stripped += sql[i] === '\n' ? '\n' : ' '
        i += 1
      }
      continue
    }

    // $tag$ dollar quoting
    if (char === '$') {
      const match = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i))
      if (match) {
        hasDollarQuote = true
        stripped += ' '.repeat(match[0].length)
        i += match[0].length
        continue
      }
    }

    stripped += char
    i += 1
  }

  return { stripped, hasDollarQuote }
}

/** Everything after the last meaningful character, ignoring a single trailing `;`. */
function trailingSemicolonOnly(stripped: string): boolean {
  const withoutTrailing = stripped.replace(/;\s*$/, '')
  return !withoutTrailing.includes(';')
}

function leadingCommand(stripped: string): string {
  const match = /^\s*\(*\s*([A-Za-z]+)/.exec(stripped)
  return match ? match[1].toUpperCase() : ''
}

function hasWriteKeyword(stripped: string): boolean {
  return /\b(INSERT|UPDATE|DELETE|MERGE)\b/i.test(stripped)
}

/**
 * UPDATE/DELETE with no WHERE clause rewrites or removes every row in the table.
 * We still allow it — sometimes that is the intent — but the caller is told so
 * the confirmation step can say exactly how bad a mistake would be.
 */
function isUnscopedMutation(stripped: string, command: string): boolean {
  if (command !== 'UPDATE' && command !== 'DELETE') return false
  return !/\bWHERE\b/i.test(stripped)
}

export function classifyStatement(sql: string): SqlClassification {
  const { stripped, hasDollarQuote } = stripSqlNoise(sql)
  const command = leadingCommand(stripped)
  const blocked = (reason: string): SqlClassification => ({
    kind: 'blocked',
    command,
    reason,
    unscoped: false,
  })

  if (!command) {
    return blocked('No SQL statement found.')
  }

  if (hasDollarQuote) {
    return blocked('Dollar-quoted strings are not supported by the console.')
  }

  if (!trailingSemicolonOnly(stripped)) {
    return blocked('Run one statement at a time — multiple statements are not allowed.')
  }

  if (!ALLOWED_COMMANDS.has(command)) {
    if (SCHEMA_COMMANDS.has(command)) {
      return blocked(
        `${command} changes the schema. Schema changes belong in a Prisma migration, not the console.`
      )
    }
    if (PERMISSION_COMMANDS.has(command)) {
      return blocked(`${command} changes database permissions and is not available from the console.`)
    }
    if (TRANSACTION_COMMANDS.has(command)) {
      return blocked(
        `${command} controls the transaction or session. The console manages both for you.`
      )
    }
    return blocked(`${command} statements are not supported by the console.`)
  }

  if (FORBIDDEN_FUNCTION_PATTERN.test(stripped)) {
    const fn = FORBIDDEN_FUNCTION_PATTERN.exec(stripped)?.[1]
    return blocked(`The function ${fn}() is not available from the console.`)
  }

  // EXPLAIN ANALYZE really runs the statement it is explaining, so it is not the
  // read-only operation it looks like.
  if (command === 'EXPLAIN' && /\bANALYZE\b/i.test(stripped)) {
    return blocked('EXPLAIN ANALYZE executes the statement it explains — run EXPLAIN on its own.')
  }

  if ((command === 'EXPLAIN' || command === 'SHOW') && hasWriteKeyword(stripped)) {
    return blocked(`${command} of a data-modifying statement is not supported by the console.`)
  }

  // A data-modifying CTE (`WITH x AS (DELETE ... RETURNING ...) SELECT ...`) reads
  // like a SELECT but writes. Treat any statement containing a write keyword as a
  // write, whatever it starts with.
  if (hasWriteKeyword(stripped)) {
    const effectiveCommand = WRITE_COMMANDS.has(command) ? command : 'WITH'
    return {
      kind: 'write',
      command: effectiveCommand,
      unscoped: isUnscopedMutation(stripped, command),
      reason:
        effectiveCommand === 'WITH'
          ? 'This statement modifies rows inside a common table expression.'
          : undefined,
    }
  }

  return { kind: 'read', command, unscoped: false }
}

/** SELECT-shaped statements can be wrapped in a subquery to enforce the row cap. */
function canWrapInSubquery(command: string): boolean {
  return command === 'SELECT' || command === 'WITH' || command === 'TABLE' || command === 'VALUES'
}

export function stripTrailingSemicolon(sql: string): string {
  return sql.trim().replace(/;\s*$/, '').trim()
}

/**
 * Ask for one row more than the caller wants, so the response can honestly say
 * whether the result set was cut short.
 */
export function buildReadQuery(sql: string, command: string, limit: number): string {
  const base = stripTrailingSemicolon(sql)
  if (!canWrapInSubquery(command)) return base
  return `SELECT * FROM (${base}) AS "sql_console_result" LIMIT ${limit + 1}`
}

export function normalizeForSigning(sql: string): string {
  return stripTrailingSemicolon(sql).replace(/\s+/g, ' ').trim()
}

function signingSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.MASTER_KEY
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required to confirm SQL console writes')
  }
  return secret
}

export interface Confirmation {
  token: string
  expiresAt: number
}

/**
 * Bind a confirmation to the exact statement, the user who previewed it and a
 * short expiry, so a token cannot be replayed against a different query or by
 * a different account.
 */
export function signConfirmation(
  sql: string,
  userId: string,
  expiresAt: number = Date.now() + CONFIRMATION_TTL_MS
): Confirmation {
  const payload = `${userId}\n${normalizeForSigning(sql)}\n${expiresAt}`
  const digest = createHmac('sha256', signingSecret()).update(payload).digest('base64url')
  return { token: `${expiresAt}.${digest}`, expiresAt }
}

export function verifyConfirmation(
  token: string,
  sql: string,
  userId: string,
  now: number = Date.now()
): { valid: boolean; reason?: string } {
  const separator = token.indexOf('.')
  if (separator === -1) return { valid: false, reason: 'Malformed confirmation.' }

  const expiresAt = Number(token.slice(0, separator))
  if (!Number.isFinite(expiresAt)) return { valid: false, reason: 'Malformed confirmation.' }
  if (expiresAt < now) return { valid: false, reason: 'Confirmation expired — preview the statement again.' }

  const expected = signConfirmation(sql, userId, expiresAt).token
  const provided = Buffer.from(token)
  const candidate = Buffer.from(expected)
  if (provided.length !== candidate.length || !timingSafeEqual(provided, candidate)) {
    return { valid: false, reason: 'Confirmation does not match this statement.' }
  }

  return { valid: true }
}

/** Postgres types Prisma hands back that JSON.stringify cannot represent. */
export function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return `\\x${value.toString('hex')}`
  if (value instanceof Uint8Array) return `\\x${Buffer.from(value).toString('hex')}`
  if (Array.isArray(value)) return value.map(serializeValue)
  if (typeof value === 'object') {
    // Prisma hands back class instances for some column types — Decimal for
    // `numeric` most of all. Walking their internals would print
    // `{"s":1,"e":0,"d":[10]}` where the operator asked for a price, so anything
    // that is not a plain object gets its own string form instead.
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return String(value)

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serializeValue(item)])
    )
  }
  return value
}

export interface SqlResultSet {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  truncated: boolean
}

export function shapeRows(rows: unknown[], limit: number): SqlResultSet {
  const truncated = rows.length > limit
  const visible = (truncated ? rows.slice(0, limit) : rows) as Record<string, unknown>[]
  const columns = visible.length > 0 ? Object.keys(visible[0]) : []
  return {
    columns,
    rows: visible.map((row) => serializeValue(row) as Record<string, unknown>),
    rowCount: visible.length,
    truncated,
  }
}

/** Thrown to unwind a dry-run transaction once the affected-row count is known. */
class DryRunRollback extends Error {
  constructor(readonly affectedRows: number) {
    super('sql-console-dry-run')
  }
}

async function applyStatementTimeout(tx: { $executeRawUnsafe: (sql: string) => Promise<number> }) {
  await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
}

export async function executeRead(sql: string, command: string, limit: number): Promise<SqlResultSet> {
  const rows = await prisma.$transaction(
    async (tx) => {
      // READ ONLY is belt-and-braces behind classifyStatement: even if a write
      // slipped past the parser, Postgres refuses it inside this transaction.
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
      await applyStatementTimeout(tx)
      return tx.$queryRawUnsafe<unknown[]>(buildReadQuery(sql, command, limit))
    },
    { timeout: TRANSACTION_TIMEOUT_MS, maxWait: 10_000 }
  )

  return shapeRows(Array.isArray(rows) ? rows : [], limit)
}

export interface WriteOutcome {
  affectedRows: number
  committed: boolean
}

/**
 * Run a write. With `commit: false` the statement really executes — so the row
 * count and any constraint violation are real — and is then rolled back.
 */
export async function executeWrite(sql: string, commit: boolean): Promise<WriteOutcome> {
  const statement = stripTrailingSemicolon(sql)

  try {
    const affectedRows = await prisma.$transaction(
      async (tx) => {
        await applyStatementTimeout(tx)
        const affected = await tx.$executeRawUnsafe(statement)
        if (!commit) throw new DryRunRollback(affected)
        return affected
      },
      { timeout: TRANSACTION_TIMEOUT_MS, maxWait: 10_000 }
    )

    return { affectedRows, committed: true }
  } catch (error) {
    if (error instanceof DryRunRollback) {
      return { affectedRows: error.affectedRows, committed: false }
    }
    throw error
  }
}
