/**
 * Sanitiser for the fundraiser-supplied "custom CSS" rendered on the public
 * `/f/[subdomain]` page. The CSS is untrusted: it is wrapped in
 * `@scope (.<scopeClass>)` so it can only style the fundraiser's own content
 * container, and anything that could escape that scope, close the `<style>`
 * element, or load/execute something is stripped. When the result could still
 * be ambiguous (unbalanced braces, braces inside strings) the whole sheet is
 * rejected — failing closed is the point.
 */

export const CUSTOM_CSS_MAX_LENGTH = 20_000

const ALLOWED_AT_RULES = new Set(['media', 'supports', 'keyframes', 'container'])
const DANGEROUS = /expression\s*\(|behaviou?r\s*:|-moz-binding|javascript:|vbscript:/i

/** The class the fundraiser's content container carries and the CSS is scoped to. */
export function customCssScopeClass(fundraiserId: string): string {
  return `fundraiser-custom-${fundraiserId.replace(/[^A-Za-z0-9_-]/g, '')}`
}

/** Braces outside strings must balance and never close more than they open. */
function hasSafeBraces(css: string): boolean {
  let depth = 0
  let quote: string | null = null
  for (const ch of css) {
    if (quote) {
      if (ch === quote || ch === '\n') quote = null
      else if (ch === '{' || ch === '}') return false
      continue
    }
    if (ch === '"' || ch === "'") quote = ch
    else if (ch === '{') depth++
    else if (ch === '}' && --depth < 0) return false
  }
  return depth === 0
}

export function sanitizeCustomCss(input: string | null | undefined, scopeClass: string): string | null {
  if (!input || input.length > CUSTOM_CSS_MAX_LENGTH) return null
  if (!/^[A-Za-z0-9_-]+$/.test(scopeClass)) return null

  const css = input
    // Comments first, so they can't hide keywords (`@im/**/port`).
    .replace(/\/\*[\s\S]*?(\*\/|$)/g, '')
    // `<` is the only way out of a <style> element; backslash escapes can spell
    // any keyword below (`\40 import`, `u\72l(`). Neither is needed for styling.
    .replace(/[<\\\u0000]/g, '')
    .replace(/@(import|charset|namespace)\b[^;{}]*;?/gi, '')
    .replace(/@(-?[A-Za-z][\w-]*)/g, (rule, name: string) =>
      ALLOWED_AT_RULES.has(name.toLowerCase()) ? rule : '',
    )
    .replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (_match, _quote, target: string) =>
      /^https:\/\//i.test(target.trim()) ? `url("${target.trim()}")` : 'none',
    )
    .replace(new RegExp(DANGEROUS.source, 'gi'), '')
    .trim()

  if (!css) return null
  // Anything a single pass could have reassembled (`javajavascript:script:`) or
  // a url( the rewrite didn't recognise means the input was adversarial.
  if (DANGEROUS.test(css) || /url\((?!"https:\/\/)/i.test(css) || /@(import|charset|namespace)/i.test(css)) {
    return null
  }
  if (!hasSafeBraces(css)) return null

  return `@scope (.${scopeClass}) {\n${css}\n}`
}
