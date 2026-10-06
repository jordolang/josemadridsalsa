import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A structural check that every route which settles a payment also records the fact.
 *
 * The whole consumer layer hangs off `payment.completed`. A route that marks an order paid
 * without emitting it starves *all* of them at once — automation enrollment, the shop's
 * new-order notification, the high-value alert, participant milestones, order rules — and does
 * so silently, because each consumer is individually correct and simply never runs.
 *
 * This is not hypothetical. The PayPal and Square checkout routes marked orders `PAID` and
 * emitted nothing, and the webhooks that *did* emit returned early on `paymentStatus === 'PAID'`
 * — so the fact was lost for every web sale on those two providers. Gift-certificate completion
 * had the same hole against the Stripe webhook. The audit had scored those consumers as working
 * on the strength of an event that was never emitted on three paths.
 *
 * Asserted against source text rather than by invoking handlers, for the same reason the cron
 * guard check is: the property is "nobody forgot", and a behavioural test only ever covers the
 * routes somebody remembered to write one for. This fails the moment a fifth payment path
 * appears without the emit.
 */

// Checkout routes shared with the fundraising app live in packages/core; this app's copies are
// one-line re-exports, so scan both trees.
const API_DIRS = [join(process.cwd(), 'app/api'), join(process.cwd(), '../../packages/core/routes/api')]

/** Writes that mean "this order is now paid" — the trigger for the whole consumer layer. */
const MARKS_PAID = /paymentStatus:\s*(?:PAID_PAYMENT_STATUS|'PAID'|'SUCCEEDED'|"PAID"|"SUCCEEDED")/

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return routeFiles(path)
    return entry.name === 'route.ts' ? [path] : []
  })
}

function settlementRoutes(): Array<{ name: string; source: string }> {
  return API_DIRS.flatMap((dir) =>
    routeFiles(dir).map((path) => ({
      name: path.slice(dir.length + 1),
      source: readFileSync(path, 'utf8'),
    }))
  )
    .filter((route) => MARKS_PAID.test(route.source))
}

describe('payment fact parity', () => {
  const routes = settlementRoutes()

  it('finds the routes that settle payments', () => {
    // A rename or a refactor that empties this list would make every assertion below vacuous.
    expect(routes.length).toBeGreaterThanOrEqual(4)
  })

  it.each(routes.map((r) => r.name))('%s emits payment.completed', (name) => {
    const route = routes.find((r) => r.name === name)!
    expect(route.source).toContain("type: 'payment.completed'")
  })

  it.each(routes.map((r) => r.name))(
    '%s emits inside the transaction that marks the order paid',
    (name) => {
      const route = routes.find((r) => r.name === name)!
      // The emit takes the transaction client, so the fact commits with the payment or not at
      // all. Emitting on the singleton after the transaction would let a rolled-back payment
      // announce itself, and consumers would act on a sale that never happened.
      expect(route.source).toMatch(/emitDomainEvent\(\s*\{[\s\S]*?\},\s*tx\s*\)/)
    }
  )
})
