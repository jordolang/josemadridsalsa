import { describe, expect, it } from 'vitest'

import { CUSTOM_CSS_MAX_LENGTH, customCssScopeClass, sanitizeCustomCss } from '@/lib/fundraising/custom-css'

const SCOPE = 'fundraiser-custom-abc123'
const body = (css: string | null) => css?.replace(`@scope (.${SCOPE}) {\n`, '').replace(/\n}$/, '') ?? null

describe('sanitizeCustomCss', () => {
  it('wraps ordinary CSS in @scope for the fundraiser container', () => {
    expect(sanitizeCustomCss('.hero > h1 { color: red; }', SCOPE)).toBe(
      `@scope (.${SCOPE}) {\n.hero > h1 { color: red; }\n}`,
    )
  })

  it('returns null for empty input and over-length input', () => {
    expect(sanitizeCustomCss('', SCOPE)).toBeNull()
    expect(sanitizeCustomCss(null, SCOPE)).toBeNull()
    expect(sanitizeCustomCss('a{}'.padEnd(CUSTOM_CSS_MAX_LENGTH + 1, ' '), SCOPE)).toBeNull()
  })

  it('cannot close the style element', () => {
    const out = sanitizeCustomCss('a { color: red } </style><script>alert(1)</script>', SCOPE)
    expect(out ?? '').not.toContain('<')
  })

  it('rejects a closing brace that would escape the scope', () => {
    expect(sanitizeCustomCss('} body { display: none }', SCOPE)).toBeNull()
    expect(sanitizeCustomCss('a { color: red } } body { display: none } {', SCOPE)).toBeNull()
  })

  it('rejects braces hidden in strings, which the browser would not count', () => {
    expect(sanitizeCustomCss('a { content: "{" } } body { display: none }', SCOPE)).toBeNull()
  })

  it('strips @import and other non-allowlisted at-rules (including @scope)', () => {
    const out = body(sanitizeCustomCss('@import url(https://evil.test/x.css); @scope (body) { a { color: red } } .a { color: blue }', SCOPE))
    expect(out).not.toMatch(/@import|@scope/)
    expect(out).toContain('.a { color: blue }')
  })

  it('keeps allowlisted at-rules', () => {
    const out = sanitizeCustomCss('@media (max-width: 600px) { .a { color: red } }', SCOPE)
    expect(out).toContain('@media (max-width: 600px)')
  })

  it('keeps https url() and neutralises every other scheme', () => {
    expect(body(sanitizeCustomCss(".a { background: url('https://img.test/a.png') }", SCOPE))).toBe(
      '.a { background: url("https://img.test/a.png") }',
    )
    for (const target of ['javascript:alert(1)', 'http://img.test/a.png', 'data:image/png;base64,AAAA', '/local.png']) {
      const out = sanitizeCustomCss(`.a { background: url(${target}) }`, SCOPE) ?? ''
      expect(out).not.toContain(target)
    }
  })

  it('strips expression(), behavior:, -moz-binding and comment/escape obfuscation', () => {
    for (const css of [
      '.a { width: expression(alert(1)) }',
      '.a { behavior: url(x.htc) }',
      '.a { -moz-binding: url(https://x.test/x.xml#x) }',
      '@im/**/port "x.css"; .a { color: red }',
      '.a { background: u\\72l(javascript:alert(1)) }',
    ]) {
      const out = sanitizeCustomCss(css, SCOPE) ?? ''
      expect(out).not.toMatch(/expression\(|behavior:|-moz-binding|@import|javascript:/i)
    }
  })

  it('rejects input whose stripping reassembles a dangerous token', () => {
    expect(sanitizeCustomCss('.a { width: expresexpression(sion(1) }', SCOPE)).toBeNull()
  })

  it('refuses an unsafe scope class', () => {
    expect(sanitizeCustomCss('.a { color: red }', 'x) { } body')).toBeNull()
    expect(customCssScopeClass('ck9"x<y')).toBe('fundraiser-custom-ck9xy')
  })
})
