import { describe, expect, it, beforeAll } from 'vitest'
import {
  buildReadQuery,
  classifyStatement,
  normalizeForSigning,
  serializeValue,
  shapeRows,
  signConfirmation,
  stripSqlNoise,
  stripTrailingSemicolon,
  verifyConfirmation,
} from '@/lib/developer/sql-console'

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret-for-sql-console'
})

describe('stripSqlNoise', () => {
  it('blanks out string literals so their contents cannot be parsed as SQL', () => {
    const { stripped } = stripSqlNoise("SELECT * FROM orders WHERE note = '; DROP TABLE orders; --'")
    expect(stripped).not.toMatch(/DROP/i)
    expect(stripped).not.toContain(';')
    expect(stripped).toMatch(/^SELECT \* FROM orders WHERE note = /)
  })

  it('blanks out line and block comments', () => {
    const { stripped } = stripSqlNoise('SELECT 1 -- DROP TABLE users\n/* DELETE FROM users */')
    expect(stripped).not.toMatch(/DROP|DELETE/i)
  })

  it('handles doubled quotes inside literals and identifiers', () => {
    const { stripped } = stripSqlNoise(`SELECT "col""umn" FROM t WHERE x = 'it''s fine'`)
    expect(stripped).not.toMatch(/fine/)
    expect(stripped).toMatch(/^SELECT/)
  })

  it('reports dollar quoting rather than trying to strip it', () => {
    expect(stripSqlNoise('SELECT $$body$$').hasDollarQuote).toBe(true)
    expect(stripSqlNoise('SELECT 1').hasDollarQuote).toBe(false)
  })
})

describe('classifyStatement', () => {
  it('treats plain selects as reads', () => {
    const result = classifyStatement("SELECT id FROM orders WHERE status = 'PAID'")
    expect(result.kind).toBe('read')
    expect(result.command).toBe('SELECT')
  })

  it('allows read-only CTEs', () => {
    expect(classifyStatement('WITH recent AS (SELECT 1) SELECT * FROM recent').kind).toBe('read')
  })

  it('classifies inserts, updates and deletes as writes', () => {
    expect(classifyStatement("INSERT INTO tags (name) VALUES ('x')").kind).toBe('write')
    expect(classifyStatement('UPDATE orders SET status = 1 WHERE id = 2').kind).toBe('write')
    expect(classifyStatement('DELETE FROM carts WHERE id = 3').kind).toBe('write')
  })

  it('does not mistake UPDATE ... SET for a session SET command', () => {
    const result = classifyStatement("UPDATE products SET name = 'Hot' WHERE id = '1'")
    expect(result.kind).toBe('write')
    expect(result.command).toBe('UPDATE')
  })

  it('catches data-modifying CTEs that start with WITH', () => {
    const result = classifyStatement(
      'WITH removed AS (DELETE FROM carts WHERE id = 1 RETURNING *) SELECT * FROM removed'
    )
    expect(result.kind).toBe('write')
    expect(result.command).toBe('WITH')
    expect(result.reason).toMatch(/common table expression/i)
  })

  it('flags mutations with no WHERE clause', () => {
    expect(classifyStatement('DELETE FROM carts').unscoped).toBe(true)
    expect(classifyStatement('UPDATE orders SET status = 1').unscoped).toBe(true)
    expect(classifyStatement('UPDATE orders SET status = 1 WHERE id = 2').unscoped).toBe(false)
  })

  it('refuses schema changes', () => {
    for (const statement of [
      'DROP TABLE orders',
      'TRUNCATE orders',
      'ALTER TABLE orders ADD COLUMN x text',
      'CREATE INDEX idx ON orders (id)',
    ]) {
      const result = classifyStatement(statement)
      expect(result.kind).toBe('blocked')
      expect(result.reason).toMatch(/migration/i)
    }
  })

  it('refuses permission and transaction control', () => {
    expect(classifyStatement('GRANT ALL ON orders TO public').kind).toBe('blocked')
    expect(classifyStatement('BEGIN').kind).toBe('blocked')
    expect(classifyStatement('SET statement_timeout = 0').kind).toBe('blocked')
    expect(classifyStatement("COPY orders TO '/tmp/x'").kind).toBe('blocked')
  })

  it('refuses more than one statement', () => {
    const result = classifyStatement('SELECT 1; DELETE FROM orders')
    expect(result.kind).toBe('blocked')
    expect(result.reason).toMatch(/one statement at a time/i)
  })

  it('allows a single trailing semicolon', () => {
    expect(classifyStatement('SELECT 1;').kind).toBe('read')
  })

  it('refuses filesystem and connection functions', () => {
    const result = classifyStatement("SELECT pg_read_file('/etc/passwd')")
    expect(result.kind).toBe('blocked')
    expect(result.reason).toMatch(/pg_read_file/)
  })

  it('refuses EXPLAIN ANALYZE because it executes the statement', () => {
    expect(classifyStatement('EXPLAIN ANALYZE SELECT 1').kind).toBe('blocked')
    expect(classifyStatement('EXPLAIN SELECT 1').kind).toBe('read')
  })

  it('refuses empty input', () => {
    expect(classifyStatement('   ').kind).toBe('blocked')
    expect(classifyStatement('-- just a comment').kind).toBe('blocked')
  })
})

describe('buildReadQuery', () => {
  it('wraps select-shaped statements and asks for one extra row', () => {
    expect(buildReadQuery('SELECT * FROM orders;', 'SELECT', 100)).toBe(
      'SELECT * FROM (SELECT * FROM orders) AS "sql_console_result" LIMIT 101'
    )
  })

  it('leaves statements that cannot be wrapped alone', () => {
    expect(buildReadQuery('SHOW timezone', 'SHOW', 100)).toBe('SHOW timezone')
    expect(buildReadQuery('EXPLAIN SELECT 1', 'EXPLAIN', 100)).toBe('EXPLAIN SELECT 1')
  })

  it('strips a trailing semicolon before wrapping', () => {
    expect(stripTrailingSemicolon('SELECT 1 ;  ')).toBe('SELECT 1')
  })
})

describe('confirmation tokens', () => {
  const sql = 'DELETE FROM carts WHERE id = 1'

  it('round-trips for the same statement and user', () => {
    const { token } = signConfirmation(sql, 'user-1')
    expect(verifyConfirmation(token, sql, 'user-1').valid).toBe(true)
  })

  it('ignores formatting differences in the statement', () => {
    const { token } = signConfirmation(sql, 'user-1')
    expect(verifyConfirmation(token, 'DELETE FROM carts   WHERE id = 1;', 'user-1').valid).toBe(true)
  })

  it('rejects a token issued for a different statement', () => {
    const { token } = signConfirmation(sql, 'user-1')
    const result = verifyConfirmation(token, 'DELETE FROM carts', 'user-1')
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/does not match/i)
  })

  it('rejects a token issued to a different user', () => {
    const { token } = signConfirmation(sql, 'user-1')
    expect(verifyConfirmation(token, sql, 'user-2').valid).toBe(false)
  })

  it('rejects an expired token', () => {
    const expiresAt = Date.now() - 1000
    const { token } = signConfirmation(sql, 'user-1', expiresAt)
    const result = verifyConfirmation(token, sql, 'user-1')
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/expired/i)
  })

  it('rejects malformed tokens', () => {
    expect(verifyConfirmation('nonsense', sql, 'user-1').valid).toBe(false)
    expect(verifyConfirmation('abc.def', sql, 'user-1').valid).toBe(false)
  })

  it('normalizes whitespace consistently', () => {
    expect(normalizeForSigning('SELECT\n  1 ;')).toBe('SELECT 1')
  })
})

describe('result shaping', () => {
  it('serializes values JSON cannot represent', () => {
    expect(serializeValue(10n)).toBe('10')
    expect(serializeValue(new Date('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02T03:04:05.000Z')
    expect(serializeValue(Buffer.from([0xde, 0xad]))).toBe('\\xdead')
    expect(serializeValue({ nested: { count: 3n } })).toEqual({ nested: { count: '3' } })
    expect(serializeValue([1n, null])).toEqual(['1', null])
  })

  it('prints class instances by their own string form, not their internals', () => {
    // Prisma returns a Decimal for `numeric` columns; walking its fields would
    // show {"s":1,"e":1,"d":[12,5]} where the operator asked for a price.
    class Decimal {
      constructor(private readonly value: string) {}
      toString() {
        return this.value
      }
    }
    expect(serializeValue(new Decimal('12.50'))).toBe('12.50')
    expect(serializeValue({ total: new Decimal('9.99') })).toEqual({ total: '9.99' })
  })

  it('still walks plain objects and arrays from json columns', () => {
    expect(serializeValue({ meta: { tags: ['a', 'b'], count: 2n } })).toEqual({
      meta: { tags: ['a', 'b'], count: '2' },
    })
    expect(serializeValue(Object.create(null))).toEqual({})
  })

  it('reports truncation when more rows came back than were asked for', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const shaped = shapeRows(rows, 2)
    expect(shaped.truncated).toBe(true)
    expect(shaped.rowCount).toBe(2)
    expect(shaped.columns).toEqual(['id'])
  })

  it('does not report truncation when the result fits', () => {
    const shaped = shapeRows([{ id: 1 }], 2)
    expect(shaped.truncated).toBe(false)
    expect(shaped.rowCount).toBe(1)
  })

  it('handles an empty result set', () => {
    const shaped = shapeRows([], 10)
    expect(shaped).toEqual({ columns: [], rows: [], rowCount: 0, truncated: false })
  })
})
