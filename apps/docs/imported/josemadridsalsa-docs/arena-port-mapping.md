# Arena Port — Schema & Convention Mapping

**Source:** `/Users/jordanlang/Repos/Battle-Arena` (Vite + React + Firestore SPA).
**Target:** this repo (Next.js 16 App Router + Prisma/Postgres + NextAuth + Stripe).
**Branch:** `feat/battle-arena-port`.

This doc locks the decisions so later phases can be mechanical.

## Entity mapping

| Battle-Arena (Firestore) | Target (Prisma) | Notes / gaps |
|---|---|---|
| `Team.{name, goal, colorScheme, badgeIcon, activityType, schoolName}` | `FundraiserTeam.{name, goalAmount, teamColor, — , — , school}` | `badgeIcon` / `activityType` not in schema — derive from `FundraiserCharacter.characterClass` or skip in Phase 2. |
| `Team.hp` / `Team.currentAmount` | **gap** — no `hpCurrent` field | **Add `hpCurrent Int @default(0)` to FundraiserTeam** in Phase 3 migration. Damage writes decrement it in-transaction. |
| `Team.shieldActiveUntil`, `lastShareUserId`, `consecutiveSharesCount` | `FundraiserShield` row + **gap** | Shield state stays on `FundraiserShield`. Consecutive-share throttling uses a new `FundraiserShareEvent` model instead of denormalized fields. |
| `Team.lastEmote`, `lastDamage` | **transient client state** | Not persisted. Emotes fire from the real-time event stream in Phase 4; damage flash is derived from the most recent `FundraiserSaleEvent`. |
| `Team.members` | `FundraiserCharacter[]` | Already modeled with richer fields (gender, skin, hair, quips). Drop the `members: string[]` concept. |
| `Share` | **new** `FundraiserShareEvent` | Add in Phase 3 migration: `{id, teamId, userId, platform, createdAt}`. Indexed on `(teamId, createdAt)`. |
| `Purchase` (damage event) | `FundraiserSaleEvent` | Already exists with `{teamId, orderId?, amount, createdAt}`. `orderId` provides Stripe idempotency. Existing `app/api/fundraiser/sale/route.ts` already implements opponent-shield absorption. |
| `GlobalConfig.gameActive` | **gap** — no active-season model | Phase 2 uses `FundraiserTeam.activePeriod` (string like `"2026-04"`) as the season grouping key. A `?period=…` URL param selects which season to render. No new model in Phase 0. |
| `Message` (team chat) | `FundraiserMessage` | Current model is tied to `Fundraiser`, not `FundraiserTeam`. Out of scope for this port — defer; use `FundraiserMessage` as-is if chat lands, else skip. |
| `FundraiserChampionship` | N/A | Past-tense record of month/year winners, not a live tournament. Out of scope. |

## Derived values

- **HP max** = `FundraiserTeam.goalAmount` (in dollars).
- **HP current** = stored `hpCurrent` once added. Until then: `goalAmount − sum(damage from opponent SaleEvents in this period) + sum(absorbed by our shields)`.
- **Raised** = `salesCount * pricePerUnit`. Already computed inline in `app/fundraise/[slug]/page.tsx`.
- **Shielded now** = `FundraiserShield.findFirst({ where: { teamId, expiresAt: { gt: now }, remainingHP: { gt: 0 } } })`.

## Rule constants (Phase 1)

Port from `Battle-Arena/src/useGame.ts` + existing `app/api/fundraiser/shield/route.ts` (30-min default):

| Constant | Value | Source |
|---|---|---|
| `SHIELD_DURATION_MS` | `30 * 60 * 1000` | existing shield route |
| `SHIELD_MAX_HP` | `30` | `FundraiserShield.remainingHP @default(30)` |
| `MAX_CONSECUTIVE_SHARES` | `2` | Battle-Arena `useGame.handleShare` (throws on 3rd) |
| `CRIT_DAMAGE_THRESHOLD` | `50` | Battle-Arena — emote `💥` vs `💢` |
| `BIG_PURCHASE_THRESHOLD` | `100` | Battle-Arena — emote `💰` vs `⚔️` |

Shield hitpoint cap of 30 diverges from Battle-Arena (which used shield-as-absorb-all for 1h). Keep the existing 30-HP cap since the server-side code already implements it and it makes shields feel more tactical.

## Conventions to match

- **Prisma import:** `import { prisma as db } from "@/lib/prisma"` (aliased `db`).
- **Rate limiting:** `import { rateLimit } from "@/lib/rateLimit"` — in-memory per-IP bucket, `rateLimit(key, limit, windowMs) → { allowed, retryAfterMs }`.
- **Validation:** Zod at boundary (matches `app/api/fundraiser/sale/route.ts`).
- **Transactions:** `db.$transaction([...])` array form for independent writes; interactive `db.$transaction(async tx => …)` when reads guard writes (share throttling path).
- **Auth for user-initiated actions (share):** NextAuth session via `getServerSession` — consistent with `MessageBoard.tsx`.
- **Auth for machine-to-machine (Stripe webhook, external order systems):** `verifyFundraiserApiKey(apiKey)` — existing API-key path.
- **Response shape:** `{ success: boolean, …payload, error?: string }` — matches existing fundraiser routes.
- **Route location:** `app/api/fundraiser/arena/<action>/route.ts` — nests under the existing fundraiser API tree.
- **Component location:** `components/arena/` (new) for reusable visuals; page components stay colocated under `app/(fundraiser-portal)/arena/…`.

## Files to evaluate / possibly retire in later phases

| Path | Decision |
|---|---|
| `app/api/fundraiser/battle-state/route.ts` | Retire in Phase 4 — superseded by `GET /api/fundraiser/arena/[period]/state`. |
| `app/api/fundraiser/sale/route.ts` | Keep + extend in Phase 3 — already idempotent and handles shield absorption. Needs: decrement `hpCurrent` once that field exists; optional "damage all opponents" mode. |
| `app/api/fundraiser/shield/route.ts` | Keep. Used by the user-initiated share path (via the new arena share route, or directly with an API key). |
| `app/api/webhooks/stripe/route.ts` | Extend in Phase 3 — when a checkout completes with a `fundraiserTeamId` in metadata, call `applyPurchaseDamage`. |

## Out of scope for this port

- Emote reactions as persisted events (live only, no storage).
- Team-level chat (use `FundraiserMessage` if/when it's migrated to be team-scoped; skip otherwise).
- Admin bootstrap UI (seed teams via existing `FundraiserSignupRequest` flow).
- Real social-share verification (OAuth or tracking links) — share route records intent; verification is a separate future PR.

## Phase handoff

- **Phase 1:** implement rule constants + pure functions listed above. No schema changes.
- **Phase 3 migration summary:** add `FundraiserTeam.hpCurrent Int @default(0)`, `FundraiserTeam.hpResetAt DateTime?`, and new `FundraiserShareEvent { id, teamId, userId, platform, createdAt }` with `(teamId, createdAt desc)` index.
