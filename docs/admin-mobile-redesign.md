# Admin Panel — Mobile-First Redesign Plan

> **Status:** Draft awaiting sign-off. Do not begin implementation until the owner signs off on this doc.
>
> **Audience:** The engineer who picks this up may have never touched this codebase. Every file path is exact. Every step shows the actual change.
>
> **Naming note:** `AGENTS.md` says docs use `UPPER_SNAKE_CASE.md`. The task brief specifies `docs/admin-mobile-redesign.md`. Keeping the kebab-case filename per the brief; flag at review if rename desired (e.g. `ADMIN_MOBILE_REDESIGN.md`).

---

## 1. Goal

Make `/admin/**` first-class on a phone in portrait. The owner — a non-technical operator — must be able to triage orders, update status, add tracking, refund, send invoices, manage products, moderate reviews/messages, and view analytics from an iPhone in portrait. Today the admin is desktop-only and only marginally usable in landscape.

This PR is **not** a responsive pass. It's a deliberate redesign of the admin shell plus one reference section (Orders) implemented end-to-end. The rest of the admin keeps working at desktop dimensions and degrades to "viewable but not great" on mobile until later PRs port each section using the migration guide in §11.

## 2. Architecture (in 3 sentences)

We render two admin shells in parallel — `MobileAdminShell` (`md:hidden`) and the existing `AdminLayoutClient` desktop shell (`hidden md:flex`) — switched purely by Tailwind, so device rotation works and desktop bytes stay identical at `md+`. The mobile shell is a bottom tab bar over a single-column scroll area, with a full-screen `Drawer` for the long-tail nav. Action-heavy detail screens (Orders being the reference) get a sticky bottom action bar with a status-aware primary CTA plus a `Drawer` of secondary actions, replacing the desktop sidebar of `Dialog`s.

## 3. Tech stack (verified, not assumed)

| Thing | Version | Confirmed in |
|---|---|---|
| Next.js | 16.2.3 (App Router) | `package.json` |
| React | 19.2.0 | `package.json` |
| Tailwind | 4.2.2 (v4 — uses `@import 'tailwindcss'` + `@config`) | `app/globals.css:1-5`, `package.json` |
| shadcn/ui | style `new-york`, RSC, lucide icons | `components.json` |
| `next-themes` | 0.4.6 | `package.json` |
| `framer-motion` | 12.23.25 | `package.json` |
| `@react-pdf/renderer` | 4.5.1 (transpiled per `next.config.mjs`) | `package.json`, `next.config.mjs:79` |
| Mobile bp | 768px via `useIsMobile()` | `hooks/use-mobile.tsx:3` |
| **Missing** | `vaul` (needed for `Drawer`) | absent from deps |
| **Missing** | `@tanstack/react-query` (we use `router.refresh()` + `useOptimistic`) | absent from deps |

## 4. Decisions confirmed during planning (Owner Q&A — 2026-05-12)

1. **Shell switch:** CSS-driven duality with Tailwind `md:` classes. Both shells render; one is hidden. No JS branching, no UA hint, no client hook.
2. **Bottom tab bar:** `Dashboard | Orders | Products | Messages | More`. "More" opens a full-screen `Drawer` with the permission-filtered long tail from `lib/permissions-map.ts`.
3. **Order-detail actions:** Sticky bottom action bar with one status-aware primary CTA plus a `⋯ More` `Drawer` for the rest.
4. **PDF on mobile:** Replace the client-side `<PrintInvoiceButton>` `@react-pdf/renderer` call with a plain `<a>` to the existing `/admin/orders/[id]/invoice` route. (Desktop keeps the current button so we don't regress desktop UX — see §8 for the branching shape.)

## 5. Existing admin — what we're replacing

### 5.1 Layout

- `app/admin/layout.tsx` — RSC, runs auth/permission check, renders `<AdminLayoutClient>` (49 lines).
- `components/admin/AdminLayoutClient.tsx` — `'use client'`. Computes sidebar width from `useSidebar()`, draws a CSS-grid `[sidebar][main]`, sticky header with breadcrumbs/notifications/theme toggle. On mobile it currently delegates to `components/ui/sidebar.tsx`'s built-in `Sheet` (the shadcn sidebar primitive's mobile mode), so the off-canvas drawer is the *desktop* sidebar squeezed into a sheet — same IA, same density. That's the actual root cause of the mobile pain. (220 lines.)
- `components/admin/AppSidebar.tsx` — `'use client'`. Renders the nav tree from `lib/permissions-map.ts` into shadcn `Sidebar*` primitives with `Collapsible` for sub-groups. (201 lines.)
- `components/ui/sidebar.tsx` — the shadcn sidebar primitive. 773 lines. Heavyweight, designed for desktop. We are not editing it.

### 5.2 Nav surface (from `lib/permissions-map.ts:17-271`)

20 top-level nav items, several with 2–8 children. Owner's daily-driver set vs. long tail:

| Daily driver (→ tab bar) | Long tail (→ More drawer) |
|---|---|
| Dashboard `/admin` | Gift Certificates, Users, Content (Media/Locations/Events/SEO/AI Training), Fundraisers (and accounts), Analytics, Growth, Project Status, Email Marketing (8 children), Communications (Lead Gen, Reviews), Forms, Social Media, Financials (Invoices/Payroll/Expenses/Taxes), Wholesale, Settings (7 children), Credentials |
| Orders `/admin/orders` | |
| Products `/admin/products` (incl. Categories, Tags) | |
| Messages `/admin/messages` | |
| More (→ drawer w/ everything else) | |

### 5.3 Orders — the canonical pain

- **List** (`app/admin/orders/page.tsx`, 222 lines): header with right-aligned Export button, filter `Card` (search + status `Select`, stacks `md:flex-row`), `<OrdersTableClient>` table (8 columns including a select-all checkbox + a bulk-actions row that overflows on mobile), then `<Pagination>`. Mobile pain: 8-column table, horizontal scroll, bulk-action row wraps badly.
- **Detail** (`app/admin/orders/[id]/page.tsx`, 498 lines): `lg:grid-cols-3` layout — items + shipping + notes in 2/3, customer + payment + 7-button actions sidebar in 1/3. On mobile the entire actions sidebar gets pushed to the bottom of a long scroll. Mobile pain: 7 dialogs hidden behind buttons no one knows to scroll to.
- **Action dialogs** (all `'use client'`, all use `<Dialog>`):
  - `UpdateStatusDialog.tsx` (153 lines) — status `Select` + admin note `Textarea`.
  - `TrackingDialog.tsx` (189 lines) — carrier `Select` + tracking number `Input` + live preview link.
  - `RefundDialog.tsx` (196 lines) — amount `Input` + "Full Refund" button.
  - `SendEmailDialog.tsx` (203 lines) — email type `Select` + optional subject/body.
  - `BuyShippingLabelDialog.tsx` (361 lines) — heaviest; full address/weight/rate flow.
  - `PrintInvoiceButton.tsx` (95 lines) — uses `@react-pdf/renderer` (transpiled).
  - `PackingSlipButton.tsx` (21 lines).

## 6. New file structure

Create:

| File | Responsibility | Lines (est.) |
|---|---|---|
| `components/ui/drawer.tsx` | shadcn `Drawer` (vaul) — added via `npx shadcn@latest add drawer`. Don't hand-write. | ~120 |
| `components/admin/mobile/MobileAdminShell.tsx` | Mobile shell root: header bar, scrollable main, bottom tab bar, safe-area padding. | ~120 |
| `components/admin/mobile/MobileTabBar.tsx` | 5-slot bottom tab bar. Reads pathname, highlights active tab. Last tab opens More drawer. | ~80 |
| `components/admin/mobile/MoreNavDrawer.tsx` | Full-screen `Drawer` showing the permission-filtered long-tail nav with collapsible groups + sign-out + theme toggle. | ~140 |
| `components/admin/mobile/MobileTopBar.tsx` | Sticky top bar: contextual back-button on detail routes, page title, optional right-slot. | ~70 |
| `components/admin/mobile/MobileOrderListItem.tsx` | One order card (replaces a `<TableRow>` on mobile). | ~80 |
| `components/admin/mobile/MobileOrdersList.tsx` | Mobile orders list: search input, status chip-row, scrollable list of `MobileOrderListItem`, "Load more" or pagination, empty state. | ~160 |
| `components/admin/mobile/MobileOrderDetail.tsx` | Single-column order detail (items, shipping, customer, payment) + sticky `OrderActionBar`. | ~200 |
| `components/admin/mobile/OrderActionBar.tsx` | Sticky bottom action bar with status-derived primary CTA + ⋯ More button → `OrderActionsDrawer`. | ~80 |
| `components/admin/mobile/OrderActionsDrawer.tsx` | `Drawer` containing the secondary order actions (status, tracking, refund, email, shipping label, print/packing). Reuses existing dialogs in a sheet shell. | ~120 |
| `lib/admin/mobile-nav.ts` | Pure helper: derive `{ primaryTabs, moreTabs }` from `adminNavigation` + user permissions. Pure → testable. | ~50 |
| `lib/admin/order-primary-cta.ts` | Pure helper: map `(orderStatus, paymentStatus, hasTracking)` → `{ label, action, icon }`. Pure → testable. | ~40 |
| `tests/lib/admin/mobile-nav.test.ts` | Unit tests for `mobile-nav.ts` (tab split, permission filtering). | ~70 |
| `tests/lib/admin/order-primary-cta.test.ts` | Unit tests for every status × payment × tracking combination. | ~80 |
| `tests/components/admin/mobile/MobileOrdersList.test.tsx` | RTL test: renders rows, empty state, status filter, search debounce. | ~120 |
| `tests/components/admin/mobile/OrderActionBar.test.tsx` | RTL test: correct CTA per status, opens drawer on More tap, focus trap. | ~100 |
| `tests/e2e/admin-mobile.spec.ts` | Playwright: iPhone 15 viewport → login as admin → tab-bar nav → orders list → orders detail → open actions drawer. No console errors. | ~150 |

Modify:

| File | Change |
|---|---|
| `app/admin/layout.tsx` | Render both shells: `<MobileAdminShell className="md:hidden">{children}</MobileAdminShell>` + `<AdminLayoutClient className="hidden md:flex">…</AdminLayoutClient>`. Pass identical props. |
| `app/admin/orders/page.tsx` | Wrap the existing list view in `<div className="hidden md:block">` and add `<MobileOrdersList className="md:hidden" … />` driven by the same server-fetched data. |
| `app/admin/orders/[id]/page.tsx` | Wrap the existing 3-col layout in `<div className="hidden md:block">` and add `<MobileOrderDetail className="md:hidden" … />`. Same server fetch, same props. |
| `components/admin/AdminLayoutClient.tsx` | Accept `className` and forward to outer `<div>` so it can be hidden on mobile. **Do not touch anything else inside.** |
| `app/globals.css` | Add `--safe-area-*` CSS vars + a `.safe-pad-bottom` utility (or use Tailwind v4 arbitrary `[padding-bottom:env(safe-area-inset-bottom)]` — pick one in §9). |
| `components/admin/PrintInvoiceButton.tsx` | Add `variant?: 'mobile'` prop. When `'mobile'`, render an `<a href="/admin/orders/[id]/invoice" target="_blank">` instead of triggering the `@react-pdf/renderer` client bundle. Desktop default unchanged. |

Do **not** touch:

- `components/ui/sidebar.tsx`
- `components/admin/AppSidebar.tsx` (desktop only — keeps working as-is)
- `lib/permissions-map.ts` / `lib/rbac.ts`
- `app/api/admin/**` (this is a presentation-layer PR only)
- The 90 other `app/admin/**/page.tsx` files — they get follow-up PRs per §11.

## 7. Information architecture (mobile)

### 7.1 Bottom tab bar

```
┌─────────────────────────────────────────────┐
│  Order ON1234                          ⌃ ⋯  │  ← MobileTopBar (sticky)
├─────────────────────────────────────────────┤
│                                             │
│  …scrollable single-column content…         │  ← main
│                                             │
├─────────────────────────────────────────────┤
│ [ Add tracking ]                  [ ⋯ More ]│  ← OrderActionBar (sticky, detail-only)
├─────────────────────────────────────────────┤
│  🏠       📦       🌶️       💬       •••  │  ← MobileTabBar (sticky)
│  Home    Orders   Products  Inbox    More   │
└─────────────────────────────────────────────┘
            ↑ safe-area-inset-bottom padding under the tab bar
```

- Active tab uses `--primary` salsa fill + label; inactive uses muted icon only.
- All tab buttons are 44×44px min hit area.
- Tab bar is `position: sticky; bottom: 0` with `pb-[env(safe-area-inset-bottom)]`.
- Tapping "More" opens `MoreNavDrawer` from the bottom (vaul `Drawer`).
- The `OrderActionBar` only renders on `/admin/orders/[id]` (detail routes). Layout-level shells don't know about it; each mobile detail screen can render its own `*ActionBar` between content and tab bar.

### 7.2 More drawer

- Full-screen vaul `Drawer` (`shouldScaleBackground={false}`, `snapPoints={[1]}` → full height).
- Header: "All sections" title + Close (X) button (top-right).
- Body: scrollable list of `adminNavigation` groups (filtered by `getUserPermissions(user)`), each row a `Link` that closes the drawer on tap.
- Footer: user identity + theme toggle + Sign out.

### 7.3 List → detail pattern

For orders (and as the template for every other list later):

- **No tables.** A list page renders a `<ul>` of `MobileOrderListItem` cards.
- **2–3 fields per card max:**
  - Title: order number + status `Badge`.
  - Subtitle: customer name + relative date.
  - Trailing: total amount (right-aligned tabular-nums).
- Tap card → `/admin/orders/[id]`.
- Search input pinned at top (`Input type="search"` 16px+, `inputMode="search"`).
- Status filter as a horizontal scrollable chip row, not a `<Select>` (faster, more thumb-friendly).
- Pagination becomes "Load more" button at the bottom (still using server `?page=` so it's deep-linkable). No infinite scroll for v1 — simpler to test, no scroll-position bugs on `router.refresh()`.
- Empty state: centered icon + message + link to next action.

### 7.4 Detail pattern (Orders reference)

Single-column scroll, sections stacked:

1. Status header card — big badge, `Placed on …`, shipping/payment status one-liner.
2. Items card — same content as desktop, full width.
3. Shipping card — full width, includes tracking number in a tap-to-copy chip if present.
4. Customer card.
5. Payment card.
6. Internal notes card (if any).

Sticky `OrderActionBar` at the bottom. Primary CTA is computed via `lib/admin/order-primary-cta.ts`:

| Status | Tracking? | Primary CTA |
|---|---|---|
| `PENDING` | — | "Confirm order" → opens `UpdateStatusDialog` defaulted to `CONFIRMED` |
| `CONFIRMED` | — | "Start processing" → defaults to `PROCESSING` |
| `PROCESSING` | no | "Add tracking" → opens `TrackingDialog` |
| `PROCESSING` | yes | "Mark shipped" → status update to `SHIPPED` |
| `SHIPPED` | — | "View tracking" → external link if `trackingUrl` known, else opens `TrackingDialog` |
| `DELIVERED` | — | "Send thank-you" → opens `SendEmailDialog` defaulted to `custom` |
| `CANCELLED` / `REFUNDED` | — | "Send email" → opens `SendEmailDialog` |

The ⋯ More drawer always exposes the full set: Update status, Add/Update tracking, Buy shipping label, Refund, Send email, View invoice (PDF link), View packing slip.

### 7.5 Forms (out of scope this PR, defined for follow-ups)

The brief asks for step-based flows. We're not implementing this in the Orders-only PR, but the migration guide (§11) sets the pattern: collapsible `<details>` sections on mobile, single-step on desktop. All inputs use `text-base` (16px) to avoid iOS zoom-on-focus, and explicit `inputMode` per field type.

## 8. Breakpoint strategy

- Tailwind `md` (`768px`) is the only breakpoint we branch on.
- `< 768px` → mobile shell, mobile lists, mobile detail.
- `≥ 768px` → desktop shell, desktop tables, desktop detail. **Byte-for-byte identical to today** because the desktop tree is unchanged; only its outer container gains a `hidden md:flex` class.
- Why not also branch at `lg` for tablet? Because the brief explicitly tests at iPad Mini portrait (768×1024), which sits right on `md`. Designing for "phone vs not-phone" is enough; tablets get the desktop experience and that's intentional.
- **No `useIsMobile()` in the new components.** It's a client hook with `undefined` on SSR — we already saw it's only used by `components/ui/sidebar.tsx`. New mobile components are CSS-only.

## 9. Safe-area + 16px input rules

Tailwind v4 doesn't ship `safe-area-*` utilities. Use arbitrary syntax: `pb-[max(env(safe-area-inset-bottom),0.5rem)]`. Two locations need it:

- `MobileTabBar` — bottom padding.
- `OrderActionBar` — bottom padding (renders *above* tab bar; both stack).

Apply `text-base` (≥16px) to every mobile `<Input>`, `<Textarea>`, and `<Select>` in the new components to prevent iOS zoom. The existing shadcn `<Input>` is already `text-base md:text-sm` in shadcn `new-york` style, which is correct — confirm before touching it.

## 10. Performance budget

| Metric | Target | How we measure |
|---|---|---|
| First-paint JS (admin/orders, mobile) | ≤ 220 KB gzip | `npm run build` analyzer output |
| TTI on emulated mid-tier 4G phone | < 2.0 s | Chrome DevTools throttling at Mobile preset |
| Lighthouse mobile Performance | ≥ 90 | `npx lighthouse http://localhost:3000/admin/orders --preset=mobile` |
| Lighthouse mobile Accessibility | ≥ 95 | same |
| LCP element | First card or stat in viewport, not below the fold | DevTools Performance |

Levers we'll pull:

- Replace `@react-pdf/renderer` (`~200 KB` chunk) with a plain link on mobile (decision 4).
- Keep `MobileAdminShell` and its children as `'use client'` only where they need interactivity (tab bar, drawer state). The mobile orders list is mostly server-rendered like the desktop list.
- No new client libraries except `vaul` (~7 KB gzip via shadcn `Drawer`).
- `loading.tsx` files that match the final layout per route (Orders list and Orders detail) so the user sees skeleton cards, not spinner-then-pop.

## 11. Accessibility checklist (WCAG AA + iOS VoiceOver)

- [ ] All tappable controls ≥ 44×44 px.
- [ ] `focus-visible` ring on every interactive element (shadcn already does this — verify on tab bar buttons).
- [ ] Icon-only buttons have `aria-label`.
- [ ] Tab bar uses `<nav aria-label="Primary">` containing `<button>` or `<a>`. Active tab has `aria-current="page"`.
- [ ] More drawer trapped focus (`vaul` handles this).
- [ ] OrderActionBar primary CTA's label is verbose enough for VoiceOver ("Add tracking number", not "Add").
- [ ] Status badges have `aria-label="Order status: Shipped"` (don't rely on color alone).
- [ ] Color contrast ≥ 4.5:1 for body, ≥ 3:1 for large text. Verify salsa-500 on white in `.btn-primary` — already in use, so should pass.
- [ ] Semantic landmarks: `<header>`, `<main>`, `<nav>`. Mobile shell uses all three.
- [ ] Skip-to-content link at top of mobile shell (hidden until focused).
- [ ] Drawer escape: tap backdrop or swipe down closes it.
- [ ] iOS VoiceOver swipe nav: verified via Safari Develop → Accessibility Audit.

## 12. Task list

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

### Task 0: Branch + baseline (1 commit)

- [ ] **Step 1:** Confirm we're not on `main`. Brief lists branch `feat/design-system-refresh` already; either continue there or branch off main as `feat/admin-mobile-redesign`. Decision pending owner — see §13 Q1.
- [ ] **Step 2:** Run `npm run lint && npm run type-check && npx vitest run` to confirm clean baseline.
  - Expected: all green. If anything is red on `main`, stop and surface to owner — we don't fix unrelated red on this PR.
- [ ] **Step 3:** Commit a one-line `docs/admin-mobile-redesign.md` (this file) so the plan is reviewable.

```bash
git add docs/admin-mobile-redesign.md
git commit -m "Docs: add admin mobile redesign plan"
```

### Task 1: Add shadcn Drawer (vaul) — 1 commit

**Files:**
- Create: `components/ui/drawer.tsx` (via CLI)
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1:** Add the Drawer primitive via shadcn CLI.

```bash
npx shadcn@latest add drawer
```

Expected: creates `components/ui/drawer.tsx`, adds `vaul` to `package.json`. Confirm by running:

```bash
grep -q '"vaul"' package.json && echo OK
ls components/ui/drawer.tsx
```

- [ ] **Step 2:** Run `npm run type-check`.
  - Expected: PASS.

- [ ] **Step 3:** Commit.

```bash
git add components/ui/drawer.tsx package.json package-lock.json
git commit -m "Chore: add shadcn Drawer primitive (vaul) for mobile bottom sheets"
```

### Task 2: Pure helpers — TDD first (3 commits)

**Files:**
- Create: `lib/admin/mobile-nav.ts`, `lib/admin/order-primary-cta.ts`
- Create: `tests/lib/admin/mobile-nav.test.ts`, `tests/lib/admin/order-primary-cta.test.ts`

#### 2a. `lib/admin/mobile-nav.ts`

- [ ] **Step 1:** Write the failing test.

```ts
// tests/lib/admin/mobile-nav.test.ts
import { describe, it, expect } from 'vitest'
import { splitNavForMobile } from '@/lib/admin/mobile-nav'
import { adminNavigation } from '@/lib/permissions-map'

describe('splitNavForMobile', () => {
  it('puts Dashboard, Orders, Products, Messages in primary tabs (in that order)', () => {
    const { primary, more } = splitNavForMobile(adminNavigation, [
      'orders:read', 'products:read', 'messaging:read',
    ])
    expect(primary.map((i) => i.href)).toEqual([
      '/admin',
      '/admin/orders',
      '/admin/products',
      '/admin/messages',
    ])
    expect(more.some((i) => i.href === '/admin')).toBe(false)
  })

  it('drops a primary tab when the user lacks its permission', () => {
    const { primary } = splitNavForMobile(adminNavigation, [
      'products:read', 'messaging:read',
    ])
    expect(primary.map((i) => i.href)).toEqual([
      '/admin',
      '/admin/products',
      '/admin/messages',
    ])
  })

  it('moves everything not in the primary set into `more`', () => {
    const { more } = splitNavForMobile(adminNavigation, [
      'orders:read', 'products:read', 'messaging:read',
      'analytics:read', 'financials:read', 'settings:read',
    ])
    const moreHrefs = more.map((i) => i.href)
    expect(moreHrefs).toContain('/admin/analytics')
    expect(moreHrefs).toContain('/admin/financials')
    expect(moreHrefs).toContain('/admin/settings')
  })
})
```

- [ ] **Step 2:** Run `npx vitest run tests/lib/admin/mobile-nav.test.ts`.
  - Expected: FAIL — `splitNavForMobile is not a function`.

- [ ] **Step 3:** Implement.

```ts
// lib/admin/mobile-nav.ts
import { adminNavigation, filterNavByPermissions, type NavItem } from '@/lib/permissions-map'

const PRIMARY_HREFS = [
  '/admin',
  '/admin/orders',
  '/admin/products',
  '/admin/messages',
] as const

export interface MobileNav {
  primary: NavItem[]
  more: NavItem[]
}

export function splitNavForMobile(
  nav: NavItem[],
  userPermissions: readonly string[],
): MobileNav {
  const filtered = filterNavByPermissions(nav, [...userPermissions])
  const byHref = new Map(filtered.map((item) => [item.href, item]))

  const primary: NavItem[] = []
  for (const href of PRIMARY_HREFS) {
    const item = byHref.get(href)
    if (item) primary.push(item)
  }

  const primarySet = new Set(primary.map((i) => i.href))
  const more = filtered.filter((item) => !primarySet.has(item.href))

  return { primary, more }
}

export function getMobileNav(userPermissions: readonly string[]): MobileNav {
  return splitNavForMobile(adminNavigation, userPermissions)
}
```

- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** Commit.

```bash
git add lib/admin/mobile-nav.ts tests/lib/admin/mobile-nav.test.ts
git commit -m "Add: mobile-nav splitter for admin bottom tab bar"
```

#### 2b. `lib/admin/order-primary-cta.ts`

- [ ] **Step 1:** Write the failing test.

```ts
// tests/lib/admin/order-primary-cta.test.ts
import { describe, it, expect } from 'vitest'
import { getOrderPrimaryCta } from '@/lib/admin/order-primary-cta'

describe('getOrderPrimaryCta', () => {
  it('PENDING → Confirm order, sets status to CONFIRMED', () => {
    const cta = getOrderPrimaryCta({ status: 'PENDING', paymentStatus: 'PAID', hasTracking: false })
    expect(cta).toEqual({ label: 'Confirm order', action: 'update-status', nextStatus: 'CONFIRMED' })
  })

  it('CONFIRMED → Start processing', () => {
    expect(getOrderPrimaryCta({ status: 'CONFIRMED', paymentStatus: 'PAID', hasTracking: false }))
      .toMatchObject({ label: 'Start processing', nextStatus: 'PROCESSING' })
  })

  it('PROCESSING + no tracking → Add tracking', () => {
    expect(getOrderPrimaryCta({ status: 'PROCESSING', paymentStatus: 'PAID', hasTracking: false }))
      .toMatchObject({ label: 'Add tracking', action: 'add-tracking' })
  })

  it('PROCESSING + has tracking → Mark shipped', () => {
    expect(getOrderPrimaryCta({ status: 'PROCESSING', paymentStatus: 'PAID', hasTracking: true }))
      .toMatchObject({ label: 'Mark shipped', nextStatus: 'SHIPPED' })
  })

  it('SHIPPED → View tracking', () => {
    expect(getOrderPrimaryCta({ status: 'SHIPPED', paymentStatus: 'PAID', hasTracking: true }))
      .toMatchObject({ label: 'View tracking', action: 'view-tracking' })
  })

  it('DELIVERED → Send thank-you', () => {
    expect(getOrderPrimaryCta({ status: 'DELIVERED', paymentStatus: 'PAID', hasTracking: true }))
      .toMatchObject({ label: 'Send thank-you', action: 'send-email' })
  })

  it('CANCELLED → Send email', () => {
    expect(getOrderPrimaryCta({ status: 'CANCELLED', paymentStatus: 'REFUNDED', hasTracking: false }))
      .toMatchObject({ label: 'Send email', action: 'send-email' })
  })
})
```

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3:** Implement.

```ts
// lib/admin/order-primary-cta.ts
export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PROCESSING'
  | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'

export type PrimaryCtaAction =
  | 'update-status' | 'add-tracking' | 'view-tracking' | 'send-email'

export interface PrimaryCta {
  label: string
  action: PrimaryCtaAction
  nextStatus?: OrderStatus
}

interface CtaInput {
  status: OrderStatus
  paymentStatus: string
  hasTracking: boolean
}

export function getOrderPrimaryCta({ status, hasTracking }: CtaInput): PrimaryCta {
  switch (status) {
    case 'PENDING':
      return { label: 'Confirm order', action: 'update-status', nextStatus: 'CONFIRMED' }
    case 'CONFIRMED':
      return { label: 'Start processing', action: 'update-status', nextStatus: 'PROCESSING' }
    case 'PROCESSING':
      return hasTracking
        ? { label: 'Mark shipped', action: 'update-status', nextStatus: 'SHIPPED' }
        : { label: 'Add tracking', action: 'add-tracking' }
    case 'SHIPPED':
      return { label: 'View tracking', action: 'view-tracking' }
    case 'DELIVERED':
      return { label: 'Send thank-you', action: 'send-email' }
    case 'CANCELLED':
    case 'REFUNDED':
      return { label: 'Send email', action: 'send-email' }
  }
}
```

- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit.

```bash
git add lib/admin/order-primary-cta.ts tests/lib/admin/order-primary-cta.test.ts
git commit -m "Add: status-aware primary CTA helper for mobile order detail"
```

### Task 3: Mobile shell — `MobileAdminShell`, top bar, tab bar, More drawer (4 commits)

#### 3a. `MobileTabBar.tsx`

**Files:**
- Create: `components/admin/mobile/MobileTabBar.tsx`

- [ ] **Step 1:** Implement.

```tsx
// components/admin/mobile/MobileTabBar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingCart, Package, MessageSquare, Menu, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TabBarProps {
  onMoreClick: () => void
  className?: string
}

interface Tab { href: string; label: string; icon: LucideIcon }

const PRIMARY_TABS: readonly Tab[] = [
  { href: '/admin',          label: 'Home',     icon: LayoutDashboard },
  { href: '/admin/orders',   label: 'Orders',   icon: ShoppingCart },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/messages', label: 'Inbox',    icon: MessageSquare },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(href + '/')
}

export function MobileTabBar({ onMoreClick, className }: TabBarProps) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'sticky bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75',
        'pb-[max(env(safe-area-inset-bottom),0.25rem)]',
        className,
      )}
    >
      {PRIMARY_TABS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span>{label}</span>
          </Link>
        )
      })}
      <button
        type="button"
        onClick={onMoreClick}
        aria-label="More sections"
        className="flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="size-5" aria-hidden />
        <span>More</span>
      </button>
    </nav>
  )
}
```

- [ ] **Step 2:** Run `npm run type-check`. Expected: PASS.

- [ ] **Step 3:** Commit.

```bash
git add components/admin/mobile/MobileTabBar.tsx
git commit -m "Add: MobileTabBar bottom navigation for admin"
```

#### 3b. `MoreNavDrawer.tsx`

**Files:**
- Create: `components/admin/mobile/MoreNavDrawer.tsx`

- [ ] **Step 1:** Implement (using `Drawer` from Task 1).

```tsx
// components/admin/mobile/MoreNavDrawer.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { ChevronRight, X } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/lib/permissions-map'
import { NavUser } from '@/components/admin/NavUser'

interface MoreNavDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: NavItem[]
  user: { name: string | null; email: string; role: string }
}

export function MoreNavDrawer({ open, onOpenChange, items, user }: MoreNavDrawerProps) {
  const pathname = usePathname()
  useEffect(() => { if (open) onOpenChange(false) }, [pathname]) // close on route change

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[92vh]">
        <DrawerHeader className="flex items-center justify-between">
          <DrawerTitle>All sections</DrawerTitle>
          <DrawerClose asChild>
            <Button size="icon" variant="ghost" aria-label="Close menu"><X className="size-5" /></Button>
          </DrawerClose>
        </DrawerHeader>
        <nav aria-label="Secondary" className="flex-1 overflow-y-auto px-2 pb-4">
          <ul className="space-y-1">
            {items.map((item) => <MoreNavGroup key={item.href} item={item} pathname={pathname} />)}
          </ul>
        </nav>
        <div className="border-t p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <div className="flex items-center justify-between">
            <NavUser user={user} />
            <ThemeToggle />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function MoreNavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(item.href + '/')
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          'flex min-h-11 items-center justify-between rounded-md px-3 py-2.5',
          active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50',
        )}
      >
        <span className="text-sm font-medium">{item.label}</span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
      {item.children && item.children.length > 0 && (
        <ul className="ml-3 mt-1 space-y-0.5 border-l pl-2">
          {item.children.map((child) => {
            const childActive = pathname === child.href
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={cn(
                    'flex min-h-10 items-center rounded-md px-3 py-2 text-sm',
                    childActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {child.label}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
```

- [ ] **Step 2:** `npm run type-check` → PASS.
- [ ] **Step 3:** Commit.

```bash
git add components/admin/mobile/MoreNavDrawer.tsx
git commit -m "Add: MoreNavDrawer for admin mobile long-tail navigation"
```

#### 3c. `MobileTopBar.tsx`

- [ ] **Step 1:** Implement — sticky top bar with optional back button (`back` prop) and right-slot.

```tsx
// components/admin/mobile/MobileTopBar.tsx
'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MobileTopBarProps {
  title: string
  back?: { href: string; label: string }
  right?: React.ReactNode
  className?: string
}

export function MobileTopBar({ title, back, right, className }: MobileTopBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center gap-1 border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/75',
        'pt-[env(safe-area-inset-top)]',
        className,
      )}
    >
      {back ? (
        <Button asChild size="icon" variant="ghost">
          <Link href={back.href} aria-label={back.label}><ChevronLeft className="size-5" /></Link>
        </Button>
      ) : (
        <div className="w-11" aria-hidden />
      )}
      <h1 className="flex-1 truncate text-base font-semibold">{title}</h1>
      <div className="flex items-center gap-1">{right}</div>
    </header>
  )
}
```

- [ ] **Step 2:** Commit.

```bash
git add components/admin/mobile/MobileTopBar.tsx
git commit -m "Add: MobileTopBar with optional back button"
```

#### 3d. `MobileAdminShell.tsx` + wire into `app/admin/layout.tsx`

**Files:**
- Create: `components/admin/mobile/MobileAdminShell.tsx`
- Modify: `app/admin/layout.tsx`, `components/admin/AdminLayoutClient.tsx`

- [ ] **Step 1:** Implement.

```tsx
// components/admin/mobile/MobileAdminShell.tsx
'use client'

import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { MobileTabBar } from './MobileTabBar'
import { MoreNavDrawer } from './MoreNavDrawer'
import type { NavItem } from '@/lib/permissions-map'
import { cn } from '@/lib/utils'

interface MobileAdminShellProps {
  user: { name: string | null; email: string; role: string }
  primary: NavItem[]
  more: NavItem[]
  className?: string
  children: React.ReactNode
}

export function MobileAdminShell({ user, more, className, children }: MobileAdminShellProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  return (
    <div className={cn('flex h-svh flex-col bg-background', className)}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>
      <main id="main-content" className="flex-1 overflow-y-auto">
        {children}
      </main>
      <MobileTabBar onMoreClick={() => setMoreOpen(true)} />
      <MoreNavDrawer open={moreOpen} onOpenChange={setMoreOpen} items={more} user={user} />
      <Toaster />
    </div>
  )
}
```

- [ ] **Step 2:** Modify `app/admin/layout.tsx` to render both shells. Replace lines 41–48 with:

```tsx
import { MobileAdminShell } from '@/components/admin/mobile/MobileAdminShell'
import { splitNavForMobile } from '@/lib/admin/mobile-nav'

// inside the try block, after computing filteredNav:
const { primary: mobilePrimary, more: mobileMore } = splitNavForMobile(adminNavigation, userPermissions)

return (
  <>
    <AdminLayoutClient
      user={user}
      navigation={filteredNav}
      className="hidden md:flex"
    >
      {children}
    </AdminLayoutClient>
    <MobileAdminShell
      user={user}
      primary={mobilePrimary}
      more={mobileMore}
      className="md:hidden"
    >
      {children}
    </MobileAdminShell>
    <Toaster />
  </>
)
```

Note: the existing layout already renders `<Toaster />` once at the bottom. `MobileAdminShell` renders its own internal `Toaster` for the mobile branch. **Remove the inner Toaster from `MobileAdminShell`** to keep a single Toaster mounted; rely on the layout-level one. (Fix: delete the `<Toaster />` line from `MobileAdminShell.tsx`.)

- [ ] **Step 3:** Modify `components/admin/AdminLayoutClient.tsx` to accept and forward `className`. Change the props interface and the outer `<div className="grid h-svh w-screen overflow-hidden" …>` to apply the passed class:

```tsx
// Before (line 104):
<div
  className="grid h-svh w-screen overflow-hidden"
  style={{ gridTemplateColumns: `${sidebarWidth} minmax(0, 1fr)` }}
>

// After:
<div
  className={cn('grid h-svh w-screen overflow-hidden', className)}
  style={{ gridTemplateColumns: `${sidebarWidth} minmax(0, 1fr)` }}
>
```

Add `className?: string` to `AdminLayoutClientProps` interface, thread it through `AdminLayoutInner`, and import `cn` from `@/lib/utils`.

- [ ] **Step 4:** Run `npm run dev`, open `http://localhost:3000/admin` in Chrome DevTools mobile emulator (iPhone 15, 390×844). Sign in. Confirm:
  - Bottom tab bar visible, 5 slots, "Home" highlighted.
  - Tap Orders → tab bar highlights Orders, URL changes.
  - Tap More → drawer opens from bottom with the long-tail nav.
  - Resize to 1024px wide → mobile shell disappears, desktop sidebar appears, no flicker.

- [ ] **Step 5:** Run quality gates.

```bash
npm run lint && npm run type-check && npx vitest run
```

- [ ] **Step 6:** Commit.

```bash
git add components/admin/mobile/MobileAdminShell.tsx app/admin/layout.tsx components/admin/AdminLayoutClient.tsx
git commit -m "Add: mobile admin shell with bottom tab bar and More drawer"
```

### Task 4: Mobile Orders list (3 commits)

#### 4a. `MobileOrderListItem.tsx`

- [ ] **Step 1:** Implement as a pure presentational card.

```tsx
// components/admin/mobile/MobileOrderListItem.tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { getOrderStatusVariant, formatOrderStatus } from '@/lib/order-status'

interface OrderRow {
  id: string
  orderNumber: string
  status: string
  total: string | number
  createdAt: string
  customerName: string
  itemCount: number
}

export function MobileOrderListItem({ order }: { order: OrderRow }) {
  return (
    <li>
      <Link
        href={`/admin/orders/${order.id}`}
        className="flex min-h-[72px] items-center gap-3 rounded-lg border bg-card p-3 active:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{order.orderNumber}</span>
            <Badge variant={getOrderStatusVariant(order.status)} className="shrink-0">
              {formatOrderStatus(order.status)}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{order.customerName}</span>
            <span aria-hidden>·</span>
            <span>{new Date(order.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          ${Number(order.total).toFixed(2)}
        </span>
      </Link>
    </li>
  )
}
```

- [ ] **Step 2:** Commit.

```bash
git add components/admin/mobile/MobileOrderListItem.tsx
git commit -m "Add: MobileOrderListItem card for mobile orders list"
```

#### 4b. `MobileOrdersList.tsx`

- [ ] **Step 1:** Implement search + status chips + list + load-more.

```tsx
// components/admin/mobile/MobileOrdersList.tsx
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition, useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MobileOrderListItem } from './MobileOrderListItem'

interface OrderRow {
  id: string; orderNumber: string; status: string
  total: string | number; createdAt: string
  customerName: string; itemCount: number
}

interface Props {
  orders: OrderRow[]
  total: number
  page: number
  totalPages: number
  initialStatus?: string
  initialSearch?: string
  className?: string
}

const STATUS_FILTERS = ['all', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const

export function MobileOrdersList({ orders, total, page, totalPages, initialStatus = 'all', initialSearch = '', className }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [search, setSearch] = useState(initialSearch)
  const [isPending, startTransition] = useTransition()

  // Debounce search → push new URL
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (search) next.set('search', search); else next.delete('search')
      next.delete('page')
      startTransition(() => router.replace(`${pathname}?${next.toString()}`))
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const setStatus = (status: string) => {
    const next = new URLSearchParams(params)
    if (status === 'all') next.delete('status'); else next.set('status', status)
    next.delete('page')
    startTransition(() => router.replace(`${pathname}?${next.toString()}`))
  }

  const loadMore = () => {
    const next = new URLSearchParams(params)
    next.set('page', String(page + 1))
    startTransition(() => router.replace(`${pathname}?${next.toString()}`))
  }

  return (
    <div className={cn('flex flex-col gap-3 p-3', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          inputMode="search"
          placeholder="Search orders…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 pl-9 text-base"
          aria-label="Search orders"
        />
      </div>
      <div className="-mx-3 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2">
          {STATUS_FILTERS.map((s) => {
            const active = s === initialStatus || (s === 'all' && !params.get('status'))
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-sm whitespace-nowrap',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background',
                )}
              >
                {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            )
          })}
        </div>
      </div>
      {orders.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No orders match.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => <MobileOrderListItem key={order.id} order={order} />)}
        </ul>
      )}
      {page < totalPages && (
        <Button variant="outline" className="h-11" onClick={loadMore} disabled={isPending}>
          {isPending ? 'Loading…' : `Load more (${total - page * 50} remaining)`}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2:** Write the RTL test.

```tsx
// tests/components/admin/mobile/MobileOrdersList.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileOrdersList } from '@/components/admin/mobile/MobileOrdersList'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/orders',
  useSearchParams: () => new URLSearchParams(),
}))

const sample = [
  { id: '1', orderNumber: 'ON-0001', status: 'PENDING', total: '12.50', createdAt: new Date().toISOString(), customerName: 'A', itemCount: 1 },
]

describe('MobileOrdersList', () => {
  it('renders order rows', () => {
    render(<MobileOrdersList orders={sample} total={1} page={1} totalPages={1} />)
    expect(screen.getByText('ON-0001')).toBeInTheDocument()
  })
  it('shows empty state when orders is empty', () => {
    render(<MobileOrdersList orders={[]} total={0} page={1} totalPages={1} />)
    expect(screen.getByText(/no orders match/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3:** Run tests → PASS.

- [ ] **Step 4:** Commit.

```bash
git add components/admin/mobile/MobileOrdersList.tsx tests/components/admin/mobile/MobileOrdersList.test.tsx
git commit -m "Add: MobileOrdersList with search, status chips, and load more"
```

#### 4c. Wire into `app/admin/orders/page.tsx`

- [ ] **Step 1:** Wrap the existing desktop tree in `<div className="hidden md:block">…</div>` and add `<MobileOrdersList className="md:hidden" … />`. The server data fetch (`getOrders`) stays identical and feeds both.

```tsx
// app/admin/orders/page.tsx — after computing orderRows/totalPages/total/page:
return (
  <>
    <div className="hidden md:block">
      {/* …existing JSX from line 132 to line 217 unchanged… */}
    </div>
    <MobileOrdersList
      className="md:hidden"
      orders={orderRows}
      total={total}
      page={page}
      totalPages={totalPages}
      initialStatus={params.status ?? 'all'}
      initialSearch={params.search ?? ''}
    />
  </>
)
```

- [ ] **Step 2:** Manually test in mobile emulator: search debounces, status chips filter, Load more appends a page.

- [ ] **Step 3:** Commit.

```bash
git add app/admin/orders/page.tsx
git commit -m "Add: mobile orders list to /admin/orders (desktop unchanged)"
```

### Task 5: Mobile Order detail + Action bar + Actions drawer (4 commits)

#### 5a. `OrderActionBar.tsx`

- [ ] **Step 1:** Implement.

```tsx
// components/admin/mobile/OrderActionBar.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'
import { getOrderPrimaryCta, type OrderStatus } from '@/lib/admin/order-primary-cta'
import { OrderActionsDrawer, type OrderActionContext } from './OrderActionsDrawer'

interface OrderActionBarProps {
  order: OrderActionContext & { status: OrderStatus }
}

export function OrderActionBar({ order }: OrderActionBarProps) {
  const cta = getOrderPrimaryCta({
    status: order.status,
    paymentStatus: order.paymentStatus,
    hasTracking: Boolean(order.trackingNumber),
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [initialAction, setInitialAction] = useState<string | null>(null)

  const trigger = (action: string) => { setInitialAction(action); setDrawerOpen(true) }

  return (
    <>
      <div
        className="sticky bottom-0 z-30 flex items-center gap-2 border-t bg-background/95 px-3 py-2 backdrop-blur pb-[max(env(safe-area-inset-bottom),0.5rem)] supports-[backdrop-filter]:bg-background/75"
        role="toolbar"
        aria-label="Order actions"
      >
        <Button className="h-11 flex-1 text-base" onClick={() => trigger(cta.action)}>
          {cta.label}
        </Button>
        <Button
          variant="outline"
          className="h-11 min-w-11 px-3"
          aria-label="More actions"
          onClick={() => trigger('menu')}
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </Button>
      </div>
      <OrderActionsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        order={order}
        initialAction={initialAction}
      />
    </>
  )
}
```

- [ ] **Step 2:** Commit.

```bash
git add components/admin/mobile/OrderActionBar.tsx
git commit -m "Add: OrderActionBar with status-aware primary CTA"
```

#### 5b. `OrderActionsDrawer.tsx`

- [ ] **Step 1:** Compose existing dialogs as drawer items. Strategy: render a `Drawer` whose `DrawerContent` shows a vertical list of action triggers; tapping one opens its existing `Dialog` (UpdateStatusDialog, TrackingDialog, etc.) directly. Reuse, don't rewrite.

```tsx
// components/admin/mobile/OrderActionsDrawer.tsx
'use client'

import { useEffect } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import UpdateStatusDialog from '@/components/admin/UpdateStatusDialog'
import TrackingDialog from '@/components/admin/TrackingDialog'
import RefundDialog from '@/components/admin/RefundDialog'
import SendEmailDialog from '@/components/admin/SendEmailDialog'
import BuyShippingLabelDialog from '@/components/admin/BuyShippingLabelDialog'
import PackingSlipButton from '@/components/admin/PackingSlipButton'
import PrintInvoiceButton from '@/components/admin/PrintInvoiceButton'

export interface OrderActionContext {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  trackingNumber: string | null
  customerEmail: string
  total: number
  refundableAmount: number
  hasShippingAddress: boolean
  invoiceData: React.ComponentProps<typeof PrintInvoiceButton>['order']
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: OrderActionContext
  initialAction: string | null
}

export function OrderActionsDrawer({ open, onOpenChange, order }: Props) {
  // initialAction handling: drawer always opens to the menu; the parent already
  // shows the primary CTA inline. Tapping the small ⋯ opens the menu.
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="flex items-center justify-between">
          <DrawerTitle>Order actions</DrawerTitle>
          <DrawerClose asChild>
            <Button size="icon" variant="ghost" aria-label="Close"><X className="size-5" /></Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="flex flex-col gap-2 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <UpdateStatusDialog orderId={order.id} orderNumber={order.orderNumber} currentStatus={order.status} />
          <TrackingDialog orderId={order.id} orderNumber={order.orderNumber} currentTrackingNumber={order.trackingNumber} currentStatus={order.status} />
          <BuyShippingLabelDialog orderId={order.id} orderNumber={order.orderNumber} hasShippingAddress={order.hasShippingAddress} />
          <RefundDialog orderId={order.id} orderNumber={order.orderNumber} totalPaid={order.total} refundableAmount={order.refundableAmount} paymentStatus={order.paymentStatus} />
          <SendEmailDialog orderId={order.id} orderNumber={order.orderNumber} customerEmail={order.customerEmail} trackingNumber={order.trackingNumber} />
          <Button asChild variant="outline" className="h-11">
            <a href={`/admin/orders/${order.id}/invoice`} target="_blank" rel="noreferrer">View invoice (PDF)</a>
          </Button>
          <PackingSlipButton orderId={order.id} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
```

> Each existing dialog renders its own `<Button>` trigger. Inside the drawer they appear stacked as full-width buttons, each opening its own dialog on top of the drawer. We're explicitly *not* rewriting the dialogs into drawers in this PR — that's a follow-up if we want stricter mobile sheet UX, captured in §11.

- [ ] **Step 2:** Commit.

```bash
git add components/admin/mobile/OrderActionsDrawer.tsx
git commit -m "Add: OrderActionsDrawer composing existing order dialogs"
```

#### 5c. `MobileOrderDetail.tsx`

- [ ] **Step 1:** Implement — single-column scroll, sections stacked, ends with `<OrderActionBar />`.

```tsx
// components/admin/mobile/MobileOrderDetail.tsx
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getOrderStatusVariant } from '@/lib/order-status'
import { OrderActionBar } from './OrderActionBar'
import type { OrderActionContext } from './OrderActionsDrawer'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/lib/admin/order-primary-cta'

interface MobileOrderDetailProps {
  order: {
    id: string
    orderNumber: string
    status: OrderStatus
    paymentStatus: string
    createdAt: string
    total: number; subtotal: number; tax: number; shippingCost: number; discountAmount: number
    customerName: string; customerEmail: string; customerPhone: string | null; customerId: string | null
    trackingNumber: string | null; shippingLabelUrl: string | null
    shippingAddress: { firstName: string; lastName: string; street: string; city: string; state: string; zipCode: string; country: string; company: string | null; phone: string | null } | null
    items: { id: string; productName: string; productSku: string; productImage: string | null; quantity: number; unitPrice: number; totalPrice: number }[]
    customerNotes: string | null
  }
  actionContext: OrderActionContext
  canWrite: boolean
  className?: string
}

export function MobileOrderDetail({ order, actionContext, canWrite, className }: MobileOrderDetailProps) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
              <p className="text-lg font-semibold">{order.orderNumber}</p>
            </div>
            <Badge variant={getOrderStatusVariant(order.status)} aria-label={`Order status: ${order.status}`}>
              {order.status}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Placed {new Date(order.createdAt).toLocaleString()}
          </p>
        </section>

        <section className="rounded-lg border bg-card">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">Items</h2>
          <ul className="divide-y">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-3 p-3">
                {item.productImage && (
                  <div className="relative size-14 shrink-0">
                    <Image src={item.productImage} alt={item.productName} fill className="rounded object-cover" sizes="56px" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">SKU {item.productSku}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity} × ${item.unitPrice.toFixed(2)}</p>
                </div>
                <p className="shrink-0 text-sm font-medium tabular-nums">${item.totalPrice.toFixed(2)}</p>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t p-4 text-sm">
            <Row label="Subtotal" value={order.subtotal} />
            <Row label="Shipping" value={order.shippingCost} />
            <Row label="Tax" value={order.tax} />
            {order.discountAmount > 0 && <Row label="Discount" value={-order.discountAmount} />}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">${order.total.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {order.shippingAddress && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Shipping</h2>
            <p className="text-sm">
              {order.shippingAddress.firstName} {order.shippingAddress.lastName}<br />
              {order.shippingAddress.street}<br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
            </p>
            {order.trackingNumber && (
              <div className="mt-3 rounded bg-muted p-3 text-xs">
                <p className="uppercase tracking-wide text-muted-foreground">Tracking</p>
                <p className="mt-0.5 font-mono">{order.trackingNumber}</p>
              </div>
            )}
          </section>
        )}

        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Customer</h2>
          <p className="text-sm font-medium">{order.customerName}</p>
          <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
          {order.customerId && (
            <Link href={`/admin/users/${order.customerId}`} className="mt-2 inline-block text-sm text-primary">
              View profile →
            </Link>
          )}
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Payment</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={order.paymentStatus === 'PAID' ? 'default' : 'outline'}>{order.paymentStatus}</Badge>
          </div>
        </section>

        {order.customerNotes && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Customer notes</h2>
            <p className="text-sm text-muted-foreground">{order.customerNotes}</p>
          </section>
        )}
      </div>
      {canWrite && <OrderActionBar order={actionContext} />}
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">${value.toFixed(2)}</span>
    </div>
  )
}
```

- [ ] **Step 2:** Commit.

```bash
git add components/admin/mobile/MobileOrderDetail.tsx
git commit -m "Add: MobileOrderDetail single-column screen"
```

#### 5d. Wire `app/admin/orders/[id]/page.tsx`

- [ ] **Step 1:** Branch on `md:` like the list. Add an `actionContext` object built from the existing order data.

```tsx
// app/admin/orders/[id]/page.tsx — after computing `refundableAmount`:
const actionContext = {
  id: order.id,
  orderNumber: order.orderNumber,
  status: order.status,
  paymentStatus: order.paymentStatus,
  trackingNumber: order.trackingNumber,
  customerEmail: order.user?.email ?? order.guestEmail ?? '',
  total: Number(order.total),
  refundableAmount,
  hasShippingAddress: Boolean(order.shippingAddress),
  invoiceData: { /* the same big object passed to PrintInvoiceButton today, lines 443-487 */ },
}

return (
  <>
    <div className="hidden md:block">
      {/* …existing JSX from line 150 to line 495 unchanged… */}
    </div>
    <MobileOrderDetail
      className="md:hidden"
      order={{ /* same fields, narrowed shape */ }}
      actionContext={actionContext}
      canWrite={canWrite}
    />
  </>
)
```

- [ ] **Step 2:** Modify `components/admin/PrintInvoiceButton.tsx` to accept `variant?: 'mobile'` and, when `variant === 'mobile'`, return a plain `<a>` to `/admin/orders/[id]/invoice`. The mobile detail uses `<a>` directly (per Task 5b), so this prop is only needed if we later want to expose the desktop button on mobile — keep it as a deferred small change unless lint warns about the unused export.

- [ ] **Step 3:** Manually test at iPhone SE (375×667):
  - Detail page renders single-column.
  - No horizontal scroll.
  - Action bar sticks above tab bar.
  - Primary CTA reflects current status.
  - ⋯ opens drawer, drawer shows all actions, each opens its dialog.

- [ ] **Step 4:** Commit.

```bash
git add app/admin/orders/[id]/page.tsx components/admin/PrintInvoiceButton.tsx
git commit -m "Add: mobile order detail to /admin/orders/[id] (desktop unchanged)"
```

### Task 6: Loading skeletons + verification (3 commits)

#### 6a. Mobile-aware loading skeletons

- [ ] **Step 1:** `app/admin/orders/loading.tsx` already exists. Read it, then update so it renders a mobile card-list skeleton on `< md` and the table skeleton on `≥ md`. If the existing file is a generic spinner, replace with two skeleton variants under the same `md:`/`hidden md:block` discipline.

```tsx
// app/admin/orders/loading.tsx (replacement)
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <>
      <div className="hidden md:block space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
      <div className="md:hidden space-y-3 p-3">
        <Skeleton className="h-11 w-full" />
        <div className="flex gap-2"><Skeleton className="h-11 w-16" /><Skeleton className="h-11 w-20" /><Skeleton className="h-11 w-24" /></div>
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[72px] w-full" />)}
      </div>
    </>
  )
}
```

Add a similar `app/admin/orders/[id]/loading.tsx` if not present.

- [ ] **Step 2:** Commit.

```bash
git add app/admin/orders/loading.tsx app/admin/orders/[id]/loading.tsx
git commit -m "Add: mobile-aware loading skeletons for orders"
```

#### 6b. Playwright E2E (mobile viewport)

- [ ] **Step 1:** Add a Playwright spec that uses an iPhone 15 emulation profile, logs in as a seeded admin, walks the happy path.

```ts
// tests/e2e/admin-mobile.spec.ts
import { test, expect, devices } from '@playwright/test'

test.use({ ...devices['iPhone 15'] })

test('admin mobile happy path', async ({ page }) => {
  await page.goto('/auth/signin')
  // assumes seeded admin from test fixtures
  await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.waitForURL('**/admin')
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()

  await page.getByRole('link', { name: /orders/i }).click()
  await expect(page).toHaveURL(/\/admin\/orders/)
  await expect(page.getByRole('searchbox', { name: /search orders/i })).toBeVisible()

  // Open More drawer
  await page.getByRole('button', { name: /more sections/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible() // vaul Drawer is role=dialog
  await page.keyboard.press('Escape')

  // No console errors
  const errors: string[] = []
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.reload()
  expect(errors).toEqual([])
})
```

- [ ] **Step 2:** Commit.

```bash
git add tests/e2e/admin-mobile.spec.ts
git commit -m "Test: Playwright mobile admin happy path"
```

#### 6c. Lighthouse + manual verification

- [ ] **Step 1:** Run the build and Lighthouse:

```bash
npm run build
npm start &
SERVER_PID=$!
sleep 5
npx lighthouse http://localhost:3000/admin --preset=mobile --output=json --output-path=./lighthouse-admin.json --chrome-flags="--headless"
npx lighthouse http://localhost:3000/admin/orders --preset=mobile --output=json --output-path=./lighthouse-orders.json --chrome-flags="--headless"
kill $SERVER_PID
```

Read each JSON, confirm `categories.performance.score >= 0.9` and `categories.accessibility.score >= 0.95`. Delete the JSON files (they're not committed).

- [ ] **Step 2:** Manual checks at viewports 375×667 (iPhone SE), 390×844 (iPhone 15), 412×915 (Pixel 7), 768×1024 (iPad Mini portrait):
  - No horizontal scroll on any admin route in scope.
  - Tap targets ≥ 44px (use DevTools "Show layout shift regions" + manual inspection).
  - Safari iOS (real device or simulator) — confirm safe-area padding and no zoom-on-input-focus.

- [ ] **Step 3:** Commit (no code, just a verification note in the PR description — no commit needed).

### Task 7: Open PR

- [ ] **Step 1:** Final quality gate.

```bash
npx vitest run && npm run lint && npm run type-check
```

- [ ] **Step 2:** Push.

```bash
git push -u origin <branch>
```

- [ ] **Step 3:** `gh pr create` per `AGENTS.md` PR checklist. Body must list: summary, screenshots at 375/390/412/768, Lighthouse scores, what's in scope vs deferred (link this doc).

## 13. Open questions for sign-off

Before implementation begins, please confirm:

1. **Branch.** Continue on `feat/design-system-refresh` (current branch, lots of unrelated changes pending), or branch `feat/admin-mobile-redesign` off `main`? Recommend the latter — keeps the diff scoped and reviewable.
2. **Filename.** Keep `docs/admin-mobile-redesign.md` (per brief), or rename to `docs/ADMIN_MOBILE_REDESIGN.md` per `AGENTS.md` convention? Trivial either way.
3. **E2E credentials.** Playwright spec assumes `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` in CI env. Is a seeded admin account already configured for CI, or should we skip the E2E in this PR and add it after CI secrets are in place?
4. **Notifications dropdown parity.** Desktop has a notifications bell with a Sheet of recent messages/orders/reviews (`AdminLayoutClient.tsx:138-184`). Mobile shell doesn't replicate it (the bottom tab bar's Inbox tab serves the same job). OK to drop it on mobile, or do you want it as a top-bar icon?
5. **Audit log / dashboard.** Dashboard at `/admin` is `lg:grid-cols-3` heavy widgets (450 lines). On mobile it's still going to render — just stacked, since `sm:grid-cols-2 lg:grid-cols-4` already linearizes at `sm`. Acceptable for this PR, or do you want a trimmed mobile dashboard included?

## 14. Out of scope (deferred to follow-up PRs)

- Porting any admin page other than Orders (the migration guide in §15 is the runbook).
- Push notifications, PWA install manifest, service worker. We'll keep the manifest at storefront-level unless owner wants admin to install separately.
- Native app wrappers (the `mobile/` directory in the repo root is a separate Expo project — out of scope).
- Rewriting the existing dialogs (UpdateStatusDialog etc.) as native bottom sheets — they're reused via the drawer in §5b. If the owner wants a more native feel, that's a clear follow-up: rewrite each as a `Drawer` variant.
- Offline / optimistic mutations. We use `router.refresh()` which forces a server round-trip — fine on Wi-Fi but slow on flaky cell. Migration to `useOptimistic` is a clear small follow-up.
- Storefront mobile changes — the storefront has its own redesign track and is not in scope here.
- Editing `components/ui/sidebar.tsx`.

## 15. Migration guide for the rest of `/admin/**`

When porting another admin section to mobile in a follow-up PR, the pattern is exactly what Orders did:

1. **List page (`page.tsx`):**
   - Identify the 2–3 fields per row that actually matter on a phone.
   - Build a `MobileXListItem.tsx` card.
   - Build a `MobileXList.tsx` with search + chip-row filters + load-more.
   - Wrap the existing desktop tree in `<div className="hidden md:block">` and add the mobile version with `md:hidden`.
   - Add/update `loading.tsx` to mirror the mobile skeleton on `<md`.

2. **Detail page (`[id]/page.tsx`):**
   - Decide whether actions are heavy enough to need a sticky action bar (Orders: yes, Reviews: probably no).
   - If yes, model the primary-CTA helper after `lib/admin/order-primary-cta.ts` for that domain.
   - Build a `MobileXDetail.tsx` single-column screen.
   - Reuse existing dialogs by composing them inside a `Drawer` (`MobileXActionsDrawer`).
   - Wrap the existing 3-col tree in `hidden md:block` and add the mobile variant under `md:hidden`.

3. **Forms (new/edit pages):**
   - Make the outer layout single-column.
   - Group fields into `<details>` collapsibles on mobile (the same fieldsets stay flat on desktop via `md:open` or by rendering them outside `<details>` at `md`).
   - All `<Input>` get `text-base` to defeat iOS zoom.
   - Submit button becomes a sticky bottom bar on mobile (similar shape to `OrderActionBar`).

4. **Charts/analytics:**
   - `RevenueChart`, `PopularProducts` etc. currently auto-shrink. On mobile, wrap in a horizontally-scrollable container (`<div className="overflow-x-auto"><div className="min-w-[480px]">…</div></div>`) so labels remain readable. Don't try to squeeze them.

Estimated effort per section, based on Orders (the heaviest): list ≈ 0.5–1 day, detail ≈ 1–2 days, forms ≈ 1 day each. Most sections are lighter than Orders.

## 16. Done means

This PR is complete when:

- [ ] `npm run lint`, `npm run type-check`, `npx vitest run` all green.
- [ ] Manual sign-off at iPhone SE / 15 / Pixel 7 / iPad Mini portrait — no horizontal scroll on `/admin`, `/admin/orders`, `/admin/orders/[id]`.
- [ ] Lighthouse mobile Performance ≥ 90 and Accessibility ≥ 95 on `/admin` and `/admin/orders`.
- [ ] Playwright `admin-mobile.spec.ts` passes locally (CI gated on Q3 above).
- [ ] Desktop UX visually unchanged at ≥ 768 px (spot-check Orders list, Orders detail, Dashboard).
- [ ] PR description links this doc and lists what's deferred.
