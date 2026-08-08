/**
 * Shared guard for scheduled endpoints.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically whenever that
 * variable is set on the project, so a cron route needs no special handling to be callable
 * — only this check to stop anyone else calling it.
 *
 * Outside production a missing secret is allowed, because local runs and `vercel dev` have
 * no reason to carry one. In production a missing secret is a **refusal**, not a pass: these
 * routes send customer email and move money-adjacent state, and failing open there would
 * leave them world-callable if the variable were ever dropped. The older per-route copies of
 * this check fail open unconditionally; that is the behaviour this replaces.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET

  if (!secret) return process.env.NODE_ENV !== 'production'

  return request.headers.get('authorization') === `Bearer ${secret}`
}
