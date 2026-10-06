/**
 * Every image an email references must exist in public/email-templates.
 *
 * Email clients fetch these over HTTP with no fallback, so a filename that does
 * not exist renders as a broken-image placeholder in the recipient's inbox —
 * which is exactly how eleven templates shipped before this guard existed.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { baseStyles, jmsFooter } from '@/lib/email/shared/components'
import { emailTemplates } from '@/lib/email/templates/index'
import { repairImageUrls, repairFooter, repairEmailHtml } from '@/lib/email/shared/image-repair'

const ROOT = path.resolve(__dirname, '../../..')
const IMAGE_DIR = path.join(ROOT, 'public/email-templates')
// Email code lives in this app and in packages/core.
const CORE_ROOT = path.resolve(ROOT, '../../packages/core')
const SOURCE_DIRS = [ROOT, CORE_ROOT].flatMap((root) => ['lib/email', 'emails'].map((dir) => path.join(root, dir)))

/** Recursively collect .ts/.tsx files under a directory. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

/** Filenames passed to headerImg('x.png', …) or headerImage="x.png". */
function referencedImages(): Map<string, string[]> {
  const pattern = /(?:headerImg\(|headerImage(?:=|: ))\s*["']([\w.-]+\.(?:png|jpg|jpeg|gif|webp))["']/g
  const found = new Map<string, string[]>()

  for (const dir of SOURCE_DIRS) {
    for (const file of sourceFiles(dir)) {
      const contents = readFileSync(file, 'utf8')
      for (const match of contents.matchAll(pattern)) {
        const filename = match[1]
        const sources = found.get(filename) ?? []
        sources.push(path.relative(ROOT, file))
        found.set(filename, sources)
      }
    }
  }

  return found
}

describe('email template images', () => {
  const available = new Set(readdirSync(IMAGE_DIR))
  const referenced = referencedImages()

  it('finds image references to check', () => {
    expect(referenced.size).toBeGreaterThan(20)
  })

  it.each([...referenced.entries()])('%s exists in public/email-templates', (filename, sources) => {
    expect(available.has(filename), `referenced by ${sources.join(', ')}`).toBe(true)
  })

  it('builds absolute image URLs so email clients can resolve them', () => {
    expect(jmsFooter).toContain('https://www.josemadrid.net/email-templates/')
    expect(jmsFooter).not.toContain('josemadridsalsa.com/email-templates/')
  })
})

describe('footer link layout', () => {
  it('keeps every footer link on one line', () => {
    // Without white-space:nowrap the narrow columns break labels mid-word on a
    // phone ("FUNDRAI / SING"). Each anchor must carry it.
    // The regex only matches anchors whose body is plain text, so the
    // image-wrapping logo and social links are excluded.
    const textLinks = jmsFooter.match(/<a\b[^>]*>[^<]+<\/a>/g) ?? []

    expect(textLinks.length).toBeGreaterThan(5)
    for (const anchor of textLinks) {
      expect(anchor).toContain('white-space: nowrap')
    }
  })
})

describe('stored HTML repair', () => {
  it('rewrites dead filenames and the retired origin', () => {
    const stored = [
      '<img src="https://www.josemadrid.net/email-templates/cart-reminder.png" />',
      '<img src="https://www.josemadridsalsa.com/email-templates/order-confirmed.png" />',
      '<img src="https://josemadrid.net/images/logo.png" />',
    ].join('')

    expect(repairImageUrls(stored)).toBe(
      [
        '<img src="https://www.josemadrid.net/email-templates/abandoned-cart.png" />',
        '<img src="https://www.josemadrid.net/email-templates/order-confirmed.png" />',
        '<img src="https://www.josemadrid.net/email-templates/Jose-Madrid-Profile.png" />',
      ].join('')
    )
  })

  it('leaves already-correct HTML untouched', () => {
    const stored = '<img src="https://www.josemadrid.net/email-templates/abandoned-cart.png" />'
    expect(repairImageUrls(stored)).toBe(stored)
  })
})

describe('shared footer adoption', () => {
  // Eleven templates used to declare a local `jmsFooter` that shadowed the shared
  // import, so a fix to the shared footer silently missed them.
  const withFooter = emailTemplates.filter((t) => t.html.includes('Handcrafted Gourmet Salsas'))

  it('covers most of the template set', () => {
    expect(withFooter.length).toBeGreaterThan(30)
  })

  it.each(withFooter.map((t) => [t.key, t.html]))('%s renders the shared footer', (_key, html) => {
    expect(html).toContain('white-space: nowrap')
    // The fixed-column markup that broke labels mid-word on narrow screens.
    expect(html).not.toContain('style="padding: 0 12px;"><a')
  })
})

describe('mobile layout', () => {
  it('resets the default body margin so the page cannot scroll sideways', () => {
    // width:100% plus the browser's default 8px body margin overflows every phone.
    expect(baseStyles.container).toContain('width:100%')
    expect(baseStyles.container).toContain('margin:0')
  })
})

describe('stored footer repair', () => {
  // The exact footer a seeded row carries, taken from the template source as it
  // stood before the mobile fix.
  const legacyFooter = readFileSync(path.join(__dirname, 'fixtures/legacy-footer.html'), 'utf8').trim()
  const stored = `<div>before</div>${legacyFooter}<div>after</div>`

  it('swaps the legacy footer for the current one', () => {
    const out = repairFooter(stored)

    expect(out).toContain('<div>before</div>')
    expect(out).toContain('<div>after</div>')
    expect(out).toContain('white-space: nowrap')
    expect(out).not.toContain('style="padding: 0 12px;"><a')
  })

  it('does not truncate at the footer\'s nested tables', () => {
    // A naive search for the first </table> would drop everything after it.
    expect(repairFooter(stored).endsWith('<div>after</div>')).toBe(true)
  })

  it('is idempotent', () => {
    const once = repairFooter(stored)
    expect(repairFooter(once)).toBe(once)
  })

  it('leaves HTML with no footer alone', () => {
    expect(repairFooter('<div>no footer here</div>')).toBe('<div>no footer here</div>')
  })

  it('leaves a truncated footer alone rather than corrupting it', () => {
    // A stored row whose footer table is never closed: without a matching tag
    // there is no safe end to splice at, so the HTML must come back untouched.
    const truncated = stored.slice(0, stored.indexOf('Handcrafted Gourmet Salsas'))

    expect(truncated).toContain('background-color: #f4f1ec')
    expect(repairFooter(truncated)).toBe(truncated)
  })

  it('repairEmailHtml fixes images and the footer together', () => {
    const out = repairEmailHtml(
      `<img src="https://www.josemadrid.net/email-templates/cart-reminder.png" />${legacyFooter}`
    )
    expect(out).toContain('email-templates/abandoned-cart.png')
    expect(out).toContain('white-space: nowrap')
  })
})
