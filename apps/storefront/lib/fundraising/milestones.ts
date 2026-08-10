/**
 * Sales milestones a fundraiser participant gets congratulated for.
 *
 * Counted in **orders**, not dollars. A participant selling $10 jars mostly moves in whole
 * jars, and "you have made 25 sales" is a number they can check against their own memory in a
 * way that a revenue figure is not.
 *
 * The thresholds thin out deliberately. Early ones are close together because the first few
 * sales are when someone decides whether this is worth doing; later ones spread out so a strong
 * seller is not emailed every other afternoon.
 */
export const SALES_MILESTONES = [5, 10, 25, 50, 100] as const

/**
 * The highest milestone a sales count has reached, or 0 for none.
 */
export function milestoneReached(totalOrders: number): number {
  let highest = 0
  for (const milestone of SALES_MILESTONES) {
    if (totalOrders >= milestone) highest = milestone
  }
  return highest
}

/**
 * The milestone worth sending an email about, or null when there is nothing new to say.
 *
 * Returns the *highest* newly-passed threshold rather than each one in turn: a participant who
 * sells twenty jars at a school fair in one afternoon should be congratulated on reaching
 * twenty-five once, not told separately about five, ten and twenty-five. Anything already
 * recorded against `lastNotified` is silent, which is what makes replaying a domain event safe.
 */
export function pendingMilestone(totalOrders: number, lastNotified: number): number | null {
  const reached = milestoneReached(totalOrders)
  return reached > lastNotified ? reached : null
}
