import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * A Server Component cannot hold an event handler: React refuses to send the
 * function to the browser and the page throws when it is requested. Neither
 * `tsc` nor `next build` notices. The invoice, packing slip and gift
 * certificate pages all shipped with an inline onClick and failed this way.
 *
 * This scans every admin route file without 'use client' for an `onX={...}`
 * prop, so the next one is caught in CI rather than by someone printing.
 */

const ADMIN_DIR = path.resolve(__dirname, '../../app/admin')

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return routeFiles(full)
    return entry.name.endsWith('.tsx') ? [full] : []
  })
}

describe('admin server components', () => {
  it('pass no event handlers', () => {
    const offenders = routeFiles(ADMIN_DIR).flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8')
      if (/^\s*['"]use client['"]/m.test(source.split('\n').slice(0, 3).join('\n'))) return []
      return source
        .split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => /\son[A-Z][A-Za-z]+=\{/.test(line))
        .map(({ i }) => `${path.relative(ADMIN_DIR, file)}:${i + 1}`)
    })

    expect(offenders).toEqual([])
  })
})
