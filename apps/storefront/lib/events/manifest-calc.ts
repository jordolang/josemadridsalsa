/**
 * Manifest quantity math, shared by the API (server) and the editor (client).
 *
 * Product on a manifest is counted as whole cases plus loose jars. `unitsPerCase`
 * (jars per case, from the product) lets us combine the two into a single jar
 * count so that "taken" and "returned" can be compared to derive units sold.
 *
 * Chips are tracked in boxes: put the box count in the "cases" field and leave
 * jars at 0. With unitsPerCase = 1 (or any value, since jars stay 0) the sold
 * figure comes out as boxes taken minus boxes returned.
 */

export interface ManifestQuantities {
  takenCases: number
  takenJars: number
  returnedCases: number
  returnedJars: number
  unitsPerCase: number
}

/** Total loose-jar equivalent of a cases + jars pair. */
export function toJars(cases: number, jars: number, unitsPerCase: number): number {
  const per = unitsPerCase > 0 ? unitsPerCase : 1
  return Math.max(0, Math.trunc(cases)) * per + Math.max(0, Math.trunc(jars))
}

/** Units sold = jars taken out − jars returned (never negative). */
export function soldUnits(q: ManifestQuantities): number {
  const taken = toJars(q.takenCases, q.takenJars, q.unitsPerCase)
  const returned = toJars(q.returnedCases, q.returnedJars, q.unitsPerCase)
  return Math.max(0, taken - returned)
}

/** Break a jar count back into whole cases + leftover jars for display. */
export function toCasesAndJars(
  totalJars: number,
  unitsPerCase: number
): { cases: number; jars: number } {
  const per = unitsPerCase > 0 ? unitsPerCase : 1
  const safe = Math.max(0, Math.trunc(totalJars))
  return { cases: Math.floor(safe / per), jars: safe % per }
}

/** Human-readable "2 cases + 6 jars" style label. */
export function formatCasesAndJars(cases: number, jars: number): string {
  const parts: string[] = []
  if (cases > 0) parts.push(`${cases} ${cases === 1 ? 'case' : 'cases'}`)
  if (jars > 0) parts.push(`${jars} ${jars === 1 ? 'jar' : 'jars'}`)
  return parts.length > 0 ? parts.join(' + ') : '0'
}
