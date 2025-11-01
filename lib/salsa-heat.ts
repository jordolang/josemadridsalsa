type HeatRatingSource = 'catalog' | 'fallback'

export type HeatRating = {
  value: number
  max: number
  label: string
  source: HeatRatingSource
}

type HeatRatingEntry = {
  name: string
  value: number
}

const HEAT_SCALE_MAX = 10

const CATALOG_HEAT_RATINGS: HeatRatingEntry[] = [
  { name: 'Original Mild', value: 3 },
  { name: 'Clovis Medium', value: 4 },
  { name: 'Original Hot', value: 6 },
  { name: 'Original X Hot', value: 8.5 },
  { name: 'Black Bean Corn Poblano Salsa', value: 5.5 },
  { name: 'Cherry Chocolate Hot', value: 6 },
  { name: 'Cherry Mild', value: 2 },
  { name: 'Chipotle Con Queso', value: 5 },
  { name: 'Chipotle Hot', value: 7 },
  { name: 'Garden Cilantro Salsa Mild', value: 4 },
  { name: 'Garden Cilantro Salsa Hot', value: 6 },
  { name: 'Jamaican Jerk', value: 7 },
  { name: 'Ghost of Clovis', value: 8.5 },
  { name: 'Mango Mild', value: 2 },
  { name: 'Mango Habanero', value: 7.5 },
  { name: 'Peach Mild', value: 2 },
  { name: 'Pineapple Mild', value: 3 },
  { name: 'Raspberry BBQ Chipotle', value: 5 },
  { name: 'Raspberry Mild', value: 3 },
  { name: 'Roasted Garlic & Olives', value: 4 },
  { name: 'Roasted Pineapple Habanero Hot', value: 7.5 },
  { name: 'Spanish Verde Mild', value: 4 },
  { name: 'Spanish Verde Hot', value: 7 },
  { name: 'Spanish Verde XX Hot', value: 11 },
  { name: 'Strawberry Mild', value: 2 },
  { name: 'Cherry Hot', value: 8.5 },
  { name: 'Green Apple', value: 4 },
]

const FALLBACK_BY_HEAT_LEVEL: Record<string, number> = {
  MILD: 3,
  MEDIUM: 5.5,
  HOT: 7.5,
  EXTRA_HOT: 9,
  FRUIT: 3,
  DEFAULT: 5,
}

const normalizedCatalog = CATALOG_HEAT_RATINGS.map((entry) => ({
  key: normalizeName(entry.name),
  value: entry.value,
}))

// Add aliases for names that differ slightly between data sources
const aliasEntries: HeatRatingEntry[] = [
  { name: 'Spanish Verde X X Hot', value: 11 },
  { name: 'Roasted Pineapple Habanero', value: 7.5 },
  { name: 'Roasted Pineapple Habanero Salsa', value: 7.5 },
  { name: 'Chipotle Con Queso Salsa', value: 5 },
  { name: 'Black Bean Corn Poblano', value: 5.5 },
]

aliasEntries.forEach((entry) => {
  const aliasKey = normalizeName(entry.name)
  if (!normalizedCatalog.some((item) => item.key === aliasKey)) {
    normalizedCatalog.push({ key: aliasKey, value: entry.value })
  }
})

export function getSalsaHeatRating(name: string, heatLevel?: string | null): HeatRating {
  const normalizedName = normalizeName(name)
  const catalogEntry = findCatalogRating(normalizedName)

  if (catalogEntry) {
    return {
      value: catalogEntry,
      max: HEAT_SCALE_MAX,
      label: formatLabel(catalogEntry),
      source: 'catalog',
    }
  }

  const fallbackValue = getFallbackValue(heatLevel)
  return {
    value: fallbackValue,
    max: HEAT_SCALE_MAX,
    label: formatLabel(fallbackValue),
    source: 'fallback',
  }
}

function findCatalogRating(normalizedName: string): number | undefined {
  if (!normalizedName) return undefined

  const directMatch = normalizedCatalog.find((entry) => entry.key === normalizedName)
  if (directMatch) return directMatch.value

  const partialMatch = normalizedCatalog.find((entry) =>
    normalizedName.includes(entry.key)
  )
  return partialMatch?.value
}

function getFallbackValue(rawHeatLevel?: string | null): number {
  const heatLevel = rawHeatLevel ? rawHeatLevel.toUpperCase() : 'DEFAULT'
  return FALLBACK_BY_HEAT_LEVEL[heatLevel] ?? FALLBACK_BY_HEAT_LEVEL.DEFAULT
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bsalsa\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatLabel(value: number): string {
  const displayValue = Number.isInteger(value)
    ? value.toString()
    : value.toFixed(1).replace(/\.0$/, '')

  return `${displayValue}/${HEAT_SCALE_MAX}`
}
