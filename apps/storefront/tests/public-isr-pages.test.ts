import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A public page that exports `revalidate` is statically cached. If it then
 * reads the request — the session cookie, headers — Next aborts the render
 * with DYNAMIC_SERVER_USAGE and the visitor gets a 500. That took down every
 * /products/[slug] page in production for two weeks (it asked for the current
 * user to label the review form). Session-dependent UI belongs in a client
 * component that reads `useSession()`.
 */

const PUBLIC_DIR = path.resolve(__dirname, '../app/(public)')
const REQUEST_BOUND = [/\bgetCurrentUser\(/, /\bgetServerSession\(/, /from ['"]next\/headers['"]/]

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return pageFiles(full)
    return name === 'page.tsx' ? [full] : []
  })
}

describe('statically cached public pages', () => {
  const cached = pageFiles(PUBLIC_DIR).filter((file) => {
    const source = readFileSync(file, 'utf8')
    return /export const revalidate\s*=/.test(source) && !/force-dynamic/.test(source)
  })

  it('include the product detail page', () => {
    expect(cached.map((file) => path.relative(PUBLIC_DIR, file))).toContain(path.join('products', '[slug]', 'page.tsx'))
  })

  it.each(cached.map((file) => [path.relative(PUBLIC_DIR, file), file]))('%s never reads the request', (_, file) => {
    const source = readFileSync(file, 'utf8')
    for (const pattern of REQUEST_BOUND) {
      expect(source, `${pattern}`).not.toMatch(pattern)
    }
  })
})
