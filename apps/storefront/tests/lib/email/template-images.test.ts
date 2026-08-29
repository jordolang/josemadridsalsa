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
import { jmsFooter } from '@/lib/email/shared/components'
import { repairImageUrls } from '@/lib/email/shared/image-repair'

const ROOT = path.resolve(__dirname, '../../..')
const IMAGE_DIR = path.join(ROOT, 'public/email-templates')
const SOURCE_DIRS = ['lib/email', 'emails']

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
    for (const file of sourceFiles(path.join(ROOT, dir))) {
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
