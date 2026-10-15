/**
 * Text alerts are off until a provider is chosen and wired up.
 *
 * The opt-in form stays hidden while this is false, so no customer signs up for texts that
 * would never arrive.
 */
export function smsAlertsEnabled(): boolean {
  return process.env.ORDER_SMS_ALERTS_ENABLED === 'true'
}
