/**
 * Visual styling for product heat levels.
 *
 * Heat level isn't a success/error signal so it doesn't map cleanly onto
 * the four shadcn Badge variants. Instead we tint a Badge with subdued
 * dark-mode-aware backgrounds that preserve the spicy → mild visual
 * vocabulary customers expect.
 */

export type HeatLevel = 'MILD' | 'MEDIUM' | 'HOT' | 'EXTRA_HOT' | 'FRUIT'

const HEAT_LEVEL_CLASS: Record<HeatLevel, string> = {
  MILD: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent',
  MEDIUM: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent',
  HOT: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-transparent',
  EXTRA_HOT: 'bg-red-500/15 text-red-700 dark:text-red-300 border-transparent',
  FRUIT: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-transparent',
}

const HEAT_LEVEL_LABEL: Record<HeatLevel, string> = {
  MILD: 'Mild',
  MEDIUM: 'Medium',
  HOT: 'Hot',
  EXTRA_HOT: 'Extra Hot',
  FRUIT: 'Fruit',
}

export function getHeatLevelClass(level: string): string {
  return (
    HEAT_LEVEL_CLASS[level as HeatLevel] ??
    'bg-muted text-muted-foreground border-transparent'
  )
}

export function formatHeatLevel(level: string): string {
  return HEAT_LEVEL_LABEL[level as HeatLevel] ?? level
}
