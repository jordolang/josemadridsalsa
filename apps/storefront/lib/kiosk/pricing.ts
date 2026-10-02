/**
 * Kiosk pricing — the booth sign, as code.
 *
 * Every jar is $10. Flavors mix and match, and any jar count is charged the cheapest
 * combination of the sign's bundles (ties go to the mix with more free bags of chips).
 * The server is the only place a kiosk charge is computed; the screen just displays it.
 */

export const JAR_PRICE_CENTS = 1000

export interface KioskBundle {
  jars: number
  priceCents: number
  name: string
  freeChips: number
}

export const KIOSK_BUNDLES: readonly KioskBundle[] = [
  { jars: 12, priceCents: 8000, name: 'Case of 12', freeChips: 0 },
  { jars: 5, priceCents: 4000, name: 'Show Special', freeChips: 1 },
  { jars: 4, priceCents: 3200, name: '4-jar deal', freeChips: 0 },
  { jars: 3, priceCents: 2500, name: '3-jar deal', freeChips: 0 },
  { jars: 1, priceCents: JAR_PRICE_CENTS, name: '1 jar', freeChips: 0 },
]

export interface KioskQuote {
  jars: number
  /** Full price before bundles. */
  listCents: number
  /** What the customer pays (before tax). */
  totalCents: number
  savingsCents: number
  freeChips: number
  /** Bundles applied, largest first, e.g. [{ name: '4-jar deal', count: 2 }]. Single jars omitted. */
  deals: Array<{ name: string; count: number }>
}

interface Best {
  cents: number
  chips: number
  used: KioskBundle[]
}

export function quoteJars(jars: number): KioskQuote {
  if (!Number.isInteger(jars) || jars < 0) {
    throw new Error(`Invalid jar count: ${jars}`)
  }

  const best: Best[] = [{ cents: 0, chips: 0, used: [] }]
  for (let n = 1; n <= jars; n++) {
    let pick: Best | null = null
    for (const bundle of KIOSK_BUNDLES) {
      if (bundle.jars > n) continue
      const prev = best[n - bundle.jars]
      const candidate = {
        cents: prev.cents + bundle.priceCents,
        chips: prev.chips + bundle.freeChips,
        used: [...prev.used, bundle],
      }
      if (
        !pick ||
        candidate.cents < pick.cents ||
        (candidate.cents === pick.cents && candidate.chips > pick.chips)
      ) {
        pick = candidate
      }
    }
    best.push(pick as Best)
  }

  const result = best[jars]
  const counts = new Map<string, number>()
  for (const bundle of result.used) {
    if (bundle.jars > 1) counts.set(bundle.name, (counts.get(bundle.name) ?? 0) + 1)
  }
  const deals = KIOSK_BUNDLES.filter((b) => counts.has(b.name)).map((b) => ({
    name: b.name,
    count: counts.get(b.name) as number,
  }))

  const listCents = jars * JAR_PRICE_CENTS
  return {
    jars,
    listCents,
    totalCents: result.cents,
    savingsCents: listCents - result.cents,
    freeChips: result.chips,
    deals,
  }
}

export function dealLabel(deals: KioskQuote['deals']): string {
  return deals.map((d) => (d.count > 1 ? `${d.count} × ${d.name}` : d.name)).join(' + ')
}

/** Upsell hint shown when one more jar is a bargain (or makes the order cheaper). */
export function nextJarHint(jars: number): string | null {
  if (jars < 1) return null
  const now = quoteJars(jars)
  const next = quoteJars(jars + 1)
  const extra = next.totalCents - now.totalCents
  const moreChips = next.freeChips > now.freeChips
  if (extra <= 0) {
    return `Add 1 more jar to make a case of 12. Your total drops to ${formatCents(next.totalCents)}!`
  }
  if (extra < JAR_PRICE_CENTS || moreChips) {
    return `Add 1 more jar for just ${formatCents(extra)}${moreChips ? ' and get a FREE bag of chips' : ''}`
  }
  return null
}

export function formatCents(cents: number): string {
  return `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`
}
