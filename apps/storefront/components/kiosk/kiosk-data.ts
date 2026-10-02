import type { KioskGroup, KioskHeat } from '@/lib/kiosk/catalog'

export const HEAT: Record<KioskHeat, { label: string; n: number; ink: string; chip: string }> = {
  mild: { label: 'Mild', n: 1, ink: '#1F7A3A', chip: '#1F7A3A' },
  medium: { label: 'Medium', n: 2, ink: '#A85F00', chip: '#C47A00' },
  hot: { label: 'Hot', n: 3, ink: '#C2410C', chip: '#D9480F' },
  xhot: { label: 'Extra Hot', n: 4, ink: '#B91C1C', chip: '#B91C1C' },
}

export type KioskFilter = 'all' | KioskHeat | Extract<KioskGroup, 'fruit' | 'verde'>

export const FILTERS: Array<[KioskFilter, string]> = [
  ['all', 'All'],
  ['mild', 'Mild'],
  ['medium', 'Medium'],
  ['hot', 'Hot'],
  ['xhot', 'Extra Hot'],
  ['fruit', 'Fruity'],
  ['verde', 'Verde'],
]

export const matchesFilter = (filter: KioskFilter, f: { heat: KioskHeat; group: KioskGroup }) =>
  filter === 'all' || (filter === 'fruit' || filter === 'verde' ? f.group === filter : f.heat === filter)

/** Jars standing on the splash-screen fire, tallest in the middle. */
export const FIRE_JARS = [
  'mango-habanero',
  'spanish-verde-hot',
  'cherry-hot',
  'clovis-medium',
  'ghost-of-clovis',
  'original-mild',
  'chipotle-hot',
  'pineapple-mild',
  'blueberry',
]

/** Fixed pseudo-random numbers, so the fire looks organic but renders identically on server and client. */
export const rnd = (n: number) => {
  const x = Math.sin(n * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

export const PRICE_ROWS = [
  { label: '1 jar', note: '', price: '$10' },
  { label: '3 jars', note: '', price: '$25' },
  { label: '4 jars', note: '', price: '$32' },
  { label: 'Case', note: '(12 jars)', price: '$80' },
]

export const IDLE_RESET_MS = 90_000
export const DONE_RESET_SECONDS = 10
