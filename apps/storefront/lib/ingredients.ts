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
const CLOSER_FOR: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const OPENERS = new Set(Object.keys(CLOSER_FOR))
const CLOSERS = new Set(Object.values(CLOSER_FOR))

// Headers that follow the ingredient statement on a Jose Madrid label.
const STATEMENT_TERMINATORS =
  /nutrition\s*facts|amount\s*\/?\s*serving|serving\s+size|net\.?\s*wt|percent\s+daily\s+value|refrigerate/i

// A statement never runs longer than this. The cap keeps a label whose OCR lost
// the closing period from swallowing the rest of the page.
const MAX_STATEMENT_LINES = 15

// A line this short is border decoration the scan misread, not an ingredient.
const JUNK_LINE_LENGTH = 2

// How many blank or junk lines the statement may span before it is treated as finished.
const MAX_GAP_LINES = 2

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
 *
 * The conjunction is written without an Oxford comma. A few labels print one — Black Bean Corn
 * Poblano ends "Spices, Salt, and Citric Acid." where Original Mild ends "(From Concentrate) and
 * Spices." — and the ingredients are stored as a list, so which style a jar used is not something
 * this can know. Reproducing it would mean storing the statement text per product; that was
 * weighed and declined, since the comma misleads nobody and every ingredient, sub-ingredient,
 * parenthesis and position is exact either way.
 */
export function formatIngredientStatement(parts: string[]): string {
  const cleaned = parts.map((part) => part.trim()).filter(Boolean)

  if (cleaned.length === 0) return ''
  if (cleaned.length === 1) return `${cleaned[0]}.`

  const last = cleaned[cleaned.length - 1]
  return `${cleaned.slice(0, -1).join(', ')} and ${last}.`
}

/**
 * True when every `(`, `[` and `{` is closed in order by its own closer.
 *
 * The delimiter type matters, not just the nesting depth: the strawberry scan reads
 * `Calcium Chloride}` where the label prints `Calcium Chloride)`, and counting depth alone would
 * call that balanced and publish it as regulated label copy.
 */
export function hasBalancedParentheses(text: string): boolean {
  const expected: string[] = []

  for (const char of text) {
    if (OPENERS.has(char)) expected.push(CLOSER_FOR[char])
    else if (CLOSERS.has(char) && expected.pop() !== char) return false
  }

  return expected.length === 0
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

  const ingredients = parseIngredientStatement(extracted.statement)

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
    if (looksLikeProse(ingredient)) {
      warnings.push(`"${ingredient}" reads as label copy rather than an ingredient`)
    }
  }

  return { ingredients, warnings }
}

/** Shown when a written statement has a sub-ingredient group that never closes. */
export const UNBALANCED_INGREDIENTS_MESSAGE =
  'Every "(" in the ingredients must be closed by a matching ")" — check the sub-ingredient groups.'

/**
 * Split a written-out ingredient statement into one ingredient per entry.
 *
 * Accepts the statement exactly as it is printed or pasted — `A (a1, a2), B, C and D.` — and
 * undoes only the sentence assembly: the closing period, the conjunction before the final
 * ingredient, and the `and` an Oxford comma leaves stranded at the front of a part.
 * `formatIngredientStatement` puts those back.
 */
export function parseIngredientStatement(statement: string): string[] {
  const withoutPeriod = statement.trim().replace(/\.\s*$/, '')
  const parts = splitIngredientList(withoutPeriod).map(cleanPart).filter(Boolean)

  return splitTrailingConjunction(parts).map(cleanPart).filter(Boolean)
}

function extractStatement(labelText: string): { statement: string; closed: boolean } | null {
  const lines = labelText.split('\n')
  const collected: string[] = []
  let started = false
  let gap = 0

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

    // A blank line, or the stray one- and two-character marks OCR reads off the label border,
    // is a column break rather than the end of the statement — so long as there is only one of
    // them. A wider gap means the scan has moved on to other copy, and reading past it would
    // publish marketing text as ingredients.
    if (line.length <= JUNK_LINE_LENGTH) {
      gap++
      if (gap >= MAX_GAP_LINES && hasBalancedParentheses(collected.join(' '))) break
      continue
    }

    gap = 0
    collected.push(line)

    // The statement runs to its closing period.
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

/**
 * Does this read as label copy rather than an ingredient?
 *
 * Ingredients are printed in title case on these labels, so a lower-case word outside the
 * parentheses means the scan has run into a sentence — `Always Great over Chicken, Pork or Fish.`
 * sits one blank line below the statement on the cilantro labels and would otherwise be published
 * as two ingredients. Sub-ingredient groups are exempt: `Oil (Contains 2% or less Water)` is real.
 */
function looksLikeProse(ingredient: string): boolean {
  return outsideGroups(ingredient)
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word))
    .some((word) => /^\p{Ll}/u.test(word))
}

/** The text of an ingredient with every parenthesised group removed, nesting included. */
function outsideGroups(text: string): string {
  let depth = 0
  let outside = ''

  for (const char of text) {
    if (OPENERS.has(char)) depth++
    else if (CLOSERS.has(char)) depth = Math.max(0, depth - 1)
    else if (depth === 0) outside += char
  }

  return outside
}

/** Strip OCR gutter marks and the conjunction an Oxford comma leaves behind. */
function cleanPart(part: string): string {
  return part
    .replace(/^[|:;·•_\-–—\s]+/, '')
    .replace(/^and\s+/i, '')
    .trim()
}

/**
 * Ingredient names that contain "and" and are one ingredient, not two.
 *
 * The trailing conjunction is normally a list separator — "Spices, Salt and Citric Acid" is three
 * ingredients — but a handful of standard names carry "and" inside them. Splitting
 * "Natural and Artificial Flavors" would publish two ingredients that do not exist. Compared
 * case-insensitively against the whole part.
 */
const COMPOUND_INGREDIENT_NAMES = [
  'natural and artificial flavors',
  'natural and artificial flavor',
  'artificial and natural flavors',
  'artificial and natural flavor',
  'mono- and diglycerides',
  'mono and diglycerides',
]

/** Turn a final `"Salt and Citric Acid"` part into two ingredients. */
function splitTrailingConjunction(parts: string[]): string[] {
  if (parts.length === 0) return parts

  const last = parts[parts.length - 1].trim()

  // A compound name ending the statement is one ingredient, so the split — if any — belongs at
  // the conjunction before it, not at the "and" inside it.
  const compound = COMPOUND_INGREDIENT_NAMES.find((name) => last.toLowerCase().endsWith(name))
  if (compound) {
    const before = last.slice(0, last.length - compound.length).replace(/\s+and\s+$/i, '').trim()
    const name = last.slice(last.length - compound.length).trim()

    return before ? [...parts.slice(0, -1), before, name] : parts
  }

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
