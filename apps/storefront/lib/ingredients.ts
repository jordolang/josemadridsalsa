/**
 * Ingredient statement helpers.
 *
 * An ingredient statement is regulated label copy. The parenthesised
 * sub-ingredient groups, the order and the punctuation printed on the jar all
 * carry meaning — "Diced Tomatoes (Tomatoes, Citric Acid)" says the citric acid
 * comes with the tomatoes, while "Diced Tomatoes, Citric Acid" claims citric
 * acid is the second-largest ingredient in the jar. Everything here therefore
 * keeps the label text verbatim: nothing is flattened, lower-cased,
 * de-duplicated or stripped.
 */

// OCR sometimes prints a brace or bracket where the label has a paren, so all
// three count as sub-ingredient delimiters.
const OPENERS = new Set(['(', '[', '{'])
const CLOSERS = new Set([')', ']', '}'])

// Headers that follow the ingredient statement on a Jose Madrid label.
const STATEMENT_TERMINATORS =
  /nutrition\s*facts|amount\s*\/?\s*serving|serving\s+size|net\.?\s*wt|percent\s+daily\s+value|refrigerate/i

// A statement never runs longer than this. The cap keeps a label whose OCR lost
// the closing period from swallowing the rest of the page.
const MAX_STATEMENT_LINES = 15

export interface IngredientEntry {
  sortOrder: number
  qualifier: string | null
  ingredient: { name: string }
}

/** Render an ingredient the way the label prints it: `Name (sub, sub)`. */
export function formatIngredientName(name: string, qualifier?: string | null): string {
  const trimmedName = name.trim()
  const trimmedQualifier = qualifier?.trim()
  return trimmedQualifier ? `${trimmedName} (${trimmedQualifier})` : trimmedName
}

/** Render one `ProductIngredient` row as it appears on the label. */
export function formatIngredient(entry: IngredientEntry): string {
  return formatIngredientName(entry.ingredient.name, entry.qualifier)
}

/** Entries in label order, each with its parenthesised sub-ingredients intact. */
export function toIngredientList(entries: IngredientEntry[]): string[] {
  return [...entries]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(formatIngredient)
    .filter(Boolean)
}

/**
 * Join label parts into the statement as printed: comma-separated with "and"
 * before the final ingredient, closed by a period.
 * e.g. `Diced Tomatoes (Tomatoes, Citric Acid), Water and Spices.`
 */
export function formatIngredientStatement(parts: string[]): string {
  const cleaned = parts.map((part) => part.trim()).filter(Boolean)

  if (cleaned.length === 0) return ''
  if (cleaned.length === 1) return `${cleaned[0]}.`

  const last = cleaned[cleaned.length - 1]
  return `${cleaned.slice(0, -1).join(', ')} and ${last}.`
}

/** True when every `(`, `[` and `{` in the text is closed in order. */
export function hasBalancedParentheses(text: string): boolean {
  let depth = 0
  for (const char of text) {
    if (OPENERS.has(char)) depth++
    else if (CLOSERS.has(char)) {
      depth--
      if (depth < 0) return false
    }
  }
  return depth === 0
}

/**
 * Split a written-out ingredient statement into one entry per top-level
 * ingredient. Commas inside a `(...)` group stay with the ingredient they
 * belong to, so `Tomatoes (Water, Citric Acid), Salt` is two ingredients, not
 * three.
 */
export function splitIngredientList(statement: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0

  for (const char of statement) {
    if (OPENERS.has(char)) depth++
    else if (CLOSERS.has(char)) depth = Math.max(0, depth - 1)
    else if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)

  return parts.map((part) => part.trim()).filter(Boolean)
}

/** An ingredient statement read off a label, with anything that looked wrong. */
export interface ParsedLabel {
  ingredients: string[]
  warnings: string[]
}

/**
 * Pull the ingredient statement out of an OCR'd label and split it into
 * top-level ingredients.
 *
 * Splitting is parenthesis-aware: commas inside a `(...)` group belong to the
 * sub-ingredient list of the ingredient before them and never become
 * ingredients of their own. The trailing "X and Y" conjunction is split so the
 * list holds one ingredient per entry; `formatIngredientStatement` puts the
 * "and" back.
 *
 * Scans vary in quality, so anything that suggests the text cannot be trusted
 * comes back as a warning rather than being silently published.
 */
export function parseLabelIngredients(labelText: string): ParsedLabel {
  const extracted = extractStatement(labelText)
  if (!extracted) {
    return {
      ingredients: [],
      warnings: ['no "Ingredients:" statement found'],
    }
  }

  const parts = splitIngredientList(extracted.statement).map(cleanPart).filter(Boolean)
  const ingredients = splitTrailingConjunction(parts).map(cleanPart).filter(Boolean)

  const warnings: string[] = []
  if (!extracted.closed) {
    warnings.push(
      'statement has no closing period — it may be cut short or run into other label copy'
    )
  }
  for (const ingredient of ingredients) {
    // OCR routinely drops a closing paren, which merges a sub-ingredient group
    // into the ingredient beside it.
    if (!hasBalancedParentheses(ingredient)) {
      warnings.push(`unbalanced parentheses in "${ingredient}"`)
    }
  }

  return { ingredients, warnings }
}

function extractStatement(labelText: string): { statement: string; closed: boolean } | null {
  const lines = labelText.split('\n')
  const collected: string[] = []
  let started = false

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!started) {
      const match = line.match(/ingredients\s*:/i)
      if (!match || match.index === undefined) continue
      started = true
      const after = line.slice(match.index + match[0].length).trim()
      if (after) collected.push(after)
      continue
    }

    // The nutrition panel always follows the statement.
    if (STATEMENT_TERMINATORS.test(line)) break
    if (line) collected.push(line)

    // The statement runs to its closing period; blank lines before that are OCR
    // column breaks, not the end of it.
    if (topLevelIndexOf(collected.join(' '), '.') !== -1) break
    if (collected.length >= MAX_STATEMENT_LINES) break
  }

  if (collected.length === 0) return null

  const joined = collected
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/([([{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    .replace(/\s+([,.])/g, '$1')
    .trim()

  // Anything past the closing period is other label copy.
  const end = topLevelIndexOf(joined, '.')
  const statement = (end === -1 ? joined : joined.slice(0, end)).trim()

  return statement ? { statement, closed: end !== -1 } : null
}

/** Strip OCR gutter marks and the conjunction an Oxford comma leaves behind. */
function cleanPart(part: string): string {
  return part
    .replace(/^[|:;·•_\-–—\s]+/, '')
    .replace(/^and\s+/i, '')
    .trim()
}

/** Turn a final `"Salt and Citric Acid"` part into two ingredients. */
function splitTrailingConjunction(parts: string[]): string[] {
  if (parts.length === 0) return parts

  const last = parts[parts.length - 1]
  const index = topLevelIndexOf(last, ' and ', { last: true })
  if (index === -1) return parts

  const head = last.slice(0, index).trim()
  const tail = last.slice(index + ' and '.length).trim()
  if (!head || !tail) return parts

  return [...parts.slice(0, -1), head, tail]
}

/** Index of `needle` outside any parenthesised group, or -1. */
function topLevelIndexOf(
  haystack: string,
  needle: string,
  { last = false }: { last?: boolean } = {}
): number {
  let depth = 0
  let found = -1

  for (let i = 0; i < haystack.length; i++) {
    const char = haystack[i]
    if (OPENERS.has(char)) depth++
    else if (CLOSERS.has(char)) depth = Math.max(0, depth - 1)
    else if (depth === 0 && haystack.startsWith(needle, i)) {
      if (!last) return i
      found = i
    }
  }

  return found
}
