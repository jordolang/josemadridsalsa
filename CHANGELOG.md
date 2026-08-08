# Changelog

All notable changes to the Jose Madrid Salsa e-commerce platform are documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

---

## [Unreleased]

- Converted the platform to a Turborepo with independent storefront, fundraising, backend, and iOS application workspaces.

### Added
- **Manual orders** — `/admin/orders/new` records a sale taken somewhere other than the website: over the phone, at a wholesale table, at a festival stand. Until now those had nowhere to go; the bulk importer replays history and is not the same thing.

  The defining difference from checkout is that **a manual order records a deal already struck**, so nothing is quoted on the customer's behalf. Line prices, shipping and tax are all entered rather than calculated — recomputing tax through Stripe Tax for a sale that already happened at an agreed number would either contradict what the customer was told or fail outright on an address nobody collected. A per-line price override is expected rather than exceptional, since negotiated pricing is the norm on these channels. The one figure not taken from the client is the total, which is derived from the parts, with a discount larger than the goods clamped rather than allowed to make the order negative.

  Stock comes out as soon as the order is saved, whether or not the money has arrived — a phone order awaiting a cheque still means those jars are spoken for, and deducting only on payment would oversell. It is deducted after the order commits, because `adjustInventory` opens its own serializable transaction.

  This is the only order-creating path with no natural idempotency key: checkout has a payment intent, the POS a terminal checkout, the importer a batch id. An admin double-clicking Save would otherwise create two orders and deduct stock twice, so an identical order — same customer, same total — created in the last minute is refused with the existing order number rather than silently duplicated, alongside a client-side submit guard.

  There is deliberately **no `Payment` row**: that table is the processor ledger, and `PaymentProvider` has no honest value for cash or a cheque, so the method goes in `Order.paymentMethod` as free text. The consequence, stated rather than left to be discovered: manual sales do not appear in transaction history or in net-revenue-after-fees. Only channels a person should choose are offered — website, POS, fundraiser and import are set by the paths that own them. Cost is snapshotted onto each line exactly as the checkout paths do, so these orders reach the margin dashboard; verified against a live database with a twelve-jar wholesale line at a negotiated $3.50 reporting 41.4% margin.

- **Margin dashboard** — `/admin/analytics/margin` answers which salsas actually make money, from the cost snapshotted onto each order line when it sold. Headline revenue, cost of goods, gross profit and margin over a selectable window, then a row per product ranked by revenue.

  The whole design turns on one rule: **a missing cost is missing, never zero.** A line with no recorded cost is excluded from profit and counted against coverage rather than averaged in as free stock, and the margin is taken against costed revenue rather than total, since dividing profit-we-can-see by revenue-we-cannot understates by exactly the missing data. The sentence saying how much of the revenue the figure could actually see sits next to the figure, not in a footnote — a margin quoted bare eventually gets quoted as fact. Products with no cost show an em dash, never `$0.00`, and are labelled as such. The grouping is done in code rather than SQL for the same reason: a `groupBy` would have to either drop those rows, losing the revenue, or coalesce the cost to zero, reporting the item as pure profit.

  With nothing costed the page leads with what to do about it instead of four cards showing dashes, which reads as broken rather than empty. Fundraiser commission is reported as its own figure — gross profit, paid to groups, contribution — rather than folded into the margin, because a single blended percentage that nets commission on some orders and not others cannot be read correctly by anyone. It uses the same order filter as the order analytics page so the two never disagree about revenue for the same window, and it is deliberately *operational* margin: QuickBooks Online stays the source of truth for the books.

- **Event pricing published on Where is Jose?** — The booth price list now sits directly under the on-the-move schedule, where someone checking whether we will be near them next weekend is already looking: one jar $10, three $25, four $32, five plus a bag of Jose Madrid Tortilla Chips $40, a twelve-jar case in any combination $80, and chips on their own $3. Stated explicitly as standard pricing at every event we work, anywhere from Michigan and Ohio through Pennsylvania and out to the East Coast, so nobody has to wonder whether the market two states over is charging something different. The detail column collapses under each item name on narrow screens rather than being dropped, and the figures are page content rather than catalogue rows — there is no chips SKU, and event pricing is not what the online store charges.
- **Processor fees and the inputs for margin reporting** — Two nullable columns, and in both cases null means *not known* rather than zero: `OrderItem.unitCost` snapshots what a unit cost at the moment it sold, and `Payment.processorFee` records what the processor charged. Margin computed from a product's *current* `costPrice` would silently recalculate every historical order whenever a supplier changes price, which is the same reason `OrderItem` already snapshots the product name and SKU — a completed sale is a fact, not a live join. All five order paths now write the snapshot; the POS route reads cost from the database rather than the till payload, since the client has no business asserting what stock cost us.

  Fees are filled by a new `/api/cron/processor-fees` sweep rather than at webhook time, because Square usually does not know its own fee when `payment.completed` fires — it settles hours later. Given a sweep is unavoidable for Square, all providers go through it, which also keeps a third-party call out of handlers that must not fail and off the checkout path. Every attempt stamps `processorFeeCheckedAt` whether or not a fee came back, so an unanswerable payment is retried hourly rather than on every tick and abandoned after a week. Square's own lookup is not implemented yet and reports itself as uncovered rather than being silently skipped.

  `lib/analytics/margin.ts` computes gross profit with **coverage reported, never averaged away**. A line with no recorded cost is excluded from the margin and counted against coverage, because treating it as free stock would report a margin far better than reality; the ratio is taken against costed revenue rather than total revenue, since dividing profit-we-can-see by revenue-we-cannot understates by exactly the missing data. Every summary ships with the sentence that has to accompany it — "based on 1 of 2 line items — 50% of revenue" — so the number cannot be quoted bare. Refunds reduce revenue but do **not** return the fee: Stripe keeps its processing fee on a refunded charge, and netting by symmetry would overstate recovery. This is deliberately scoped as *operational* margin, not accounting — QuickBooks Online remains the source of truth for the books, and a second net-income figure that disagreed with it would be worse than none.

  Cost had no practical way in: all 28 products had a null `costPrice`, so margin reporting would have had no input at all. Bulk product operations gain **Set cost** and **Apply latest purchase cost**, the latter reading what a supplier most recently actually charged from the purchase orders that now record it. A product with no purchase history is skipped rather than zeroed, and the skipped count is reported rather than quietly succeeding on a subset.
- **Content management system** — `/admin/content` becomes a real CMS covering pages, banners, announcements, FAQs, navigation, footer, reusable sections, redirects, media and SEO, rather than the redirect to the media library it was before. The design is deliberately hybrid: pages that already exist as hand-written React (the homepage, About, Our Story, the policy pages) keep their layout and expose their copy, imagery, section order and per-section visibility for editing, while genuinely new landing pages are composed freely from a block registry and render at their own clean URL. Making the 403-line homepage fully drag-and-drop would have meant rewriting the storefront, and the pages that already convert are the worst place to accept that risk. Every override falls back to the copy the component already ships with, so a page nobody has edited renders byte-for-byte as before and a half-configured page is never half-blank — which is also why system pages are not seeded with a copy of their current text: two copies of the same words drift apart. One block registry describes each editable section exactly once and drives the admin form, the Zod validation of stored section data, and the public renderer, so a field cannot exist in the editor without somewhere to go. Malformed or unknown section data falls back to defaults instead of throwing, because bad content in one block must not take a public page down. Rich text is sanitised against an allowlist before rendering; staff hold `content:write`, but an account compromise should not become stored XSS on every page. Redirects resolve in `proxy.ts` at request time rather than through `next.config.mjs`, which bakes them in at build — an editor adding a redirect expects it live, not next deploy — and the table is fetched from an internal route and cached in module scope so per-request routing never opens a database connection, falling through to the normal response if it cannot be loaded. `proxy.ts` also forwards the pathname as `x-pathname`, which is what lets announcements and banners target specific paths from a layout. The CMS announcement bar replaces the GrowthBook demo banner, which is removed along with its feature flag so there is only one banner system. Scheduling is uniform across banners, announcements, FAQs and pages: a draft/scheduled/published status plus an optional start and end window.
- **Docker images for the storefront, CI, and local development** — Three root Dockerfiles, one per purpose, plus a `.dockerignore` and a `docker-compose.dev.yml`. The production image is a multi-stage build of `apps/storefront` on Next.js standalone output; the CI image reproduces a clean-checkout `lint`/`type-check`/`build`; the development image runs the dev server against a bundled Postgres with the tree bind-mounted. Vercel remains the deployment target and none of this changes it: `output: 'standalone'` is set in `next.config.mjs` only when `DOCKER_BUILD=1`, which the builder stage sets and Vercel does not, so the platform build path is unchanged. The builder and runner stages deliberately share one base image — `schema.prisma` carries only `native` and `rhel-openssl-3.0.x`, so a runner on a different libc would generate a Prisma engine that fails on its first query rather than at build time. `NEXT_PUBLIC_*` values are taken through a BuildKit secret mounted as `.env.production` instead of `--build-arg`, because build arguments are recorded in image history and these have to be present at build time to be inlined into the client bundle at all. That path is documented with `--no-cache-filter builder`, which it needs to be correct rather than merely fast: BuildKit keeps secret contents out of the layer cache key, so editing a value in the env file does not invalidate the build layer, and a rebuild without the flag silently ships the previous run's values — verified by rebuilding with a changed marker and finding the old one still in the bundle. `.dockerignore` keeps the local multi-GB `Documents/` archive and every `.env` file out of the context, but deliberately keeps `scripts/` and `public/` in: `next.config.mjs` drops both from serverless traces, and copying that list would have broken the storefront `prebuild` step and left the runner with no static assets. Both build images raise `--max-old-space-size` explicitly, because Node derives its default heap from container memory and the TypeScript pass over this codebase dies on the default an 8 GB daemon produces.
- **Purchase orders and receiving** — Inventory could only ever go down: sales, returns and manual adjustments all had a home, but stock arriving from a supplier had none. New `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseOrderReceipt` and `PurchaseOrderReceiptItem` models, with API routes to create and list suppliers and purchase orders, submit or cancel a PO, and record deliveries against it. A purchase order can be filled by several deliveries, so receiving is per line and per receipt rather than an all-or-nothing flip.

  Admin screens live at `/admin/purchase-orders`: a list with status filters showing received-of-ordered per row, a drafting form, a detail view with line-by-line outstanding counts and the full delivery history, and a receiving dialog. Suppliers are at `/admin/purchase-orders/suppliers`, and both are linked under Products in the sidebar. Receiving quantities default to what is still outstanding rather than to zero — the opposite of the customer return form, and deliberately so: a return is a choice about what to send back, whereas a delivery usually *is* the rest of the order, and retyping numbers off a packing slip already checked by hand invites transcription errors. Quantity inputs cap at what is outstanding, because the server refuses over-receipt outright and it is better to show the limit than to let someone submit and be told no. Drafting prefills unit cost from `Product.costPrice` where one exists and suggests a quantity that would clear the low-stock threshold, both editable. There is no control anywhere for setting `RECEIVED` directly; that status is derived from quantities, and a button that stamped it would let the status disagree with the line items.

  The shape deliberately mirrors order fulfillment, because it is the same problem pointed the other way, and it carries the same invariant: `quantityReceived` is a cached rollup that must always equal the sum of that line's receipt items. On the sales side that invariant was broken for a while by a helper which advanced the rollup without writing the rows — a fault no unit test could see, because the two halves were only inconsistent in the database. So there is exactly one writer here: `receivePurchaseOrder` creates the receipt, its lines and the incremented rollup in a single transaction, and nothing else may set the field. Quantities are incremented rather than assigned, so two deliveries landing together accumulate instead of the second overwriting the first. `PARTIALLY_RECEIVED` and `RECEIVED` are derived from those quantities; `DRAFT`, `SUBMITTED` and `CANCELLED` are lifecycle states a person sets, and a late receipt cannot resurrect a cancelled order. Over-receiving is refused rather than clamped — accepting more than a line has outstanding would push the rollup past the quantity ordered and corrupt every count derived from it, and it usually means the wrong line was picked. A purchase order with no lines reports as not-yet-received rather than complete, so an empty draft cannot close itself. Verified against a live database through partial receipt, refused over-receipt, completion, and a refused receipt against a closed order, checking the invariant after each.

  Stock moves through `adjustInventory` with a `RESTOCK` transaction, the same call the returns path uses, so receiving records an inventory transaction and re-evaluates low stock for free — which as of this release means putting stock away automatically clears the low-stock notification it raised. `InventoryTransaction` gains a `purchaseOrderId`, because otherwise "where did this stock come from" is only answerable from a free-text reason, which is not an answer. Unit cost is recorded on the purchase order line and **not** written back to `Product.costPrice`: that stays a deliberate action, since silently overwriting it would make margin history unreconstructable. Deleting a product is restricted rather than cascading where a purchase order references it — purchase history is accounting.
- **Low stock reaches the notification centre** — `INVENTORY_LOW` and `INVENTORY_OUT_OF_STOCK` notification types and their dedupe keys had existed since the centre shipped with nothing writing them; low stock only ever sent email, which is where operational mail goes to be ignored. Raising a new inventory alert now also records an `inventory.low` / `inventory.out_of_stock` domain event and puts a line in front of every operator. Both are emitted only where a new alert row is created, so they mark the moment stock crossed the line rather than the ongoing state of being below it, and the dedupe key is the product — the same item going low again after a restock updates one line instead of stacking. Low and out-of-stock use separate keys, because selling the last unit is a new and worse situation, not an update to the earlier warning. Every announcement failure is swallowed: the stock movement that triggered it has already committed and must not be undone by a failed notification. All callers already invoke the alert check after their transaction commits, so nothing here extends a payment transaction.
- **`order.created`, `customer.created`, and PayPal/Square payment events** — The domain event log previously recorded facts from only the Stripe webhook, fulfillment, and returns. Order creation now emits from all five live order paths (standard checkout, PayPal, Square, POS terminal, gift certificates) through a shared helper so the payload keys are identical whichever route produced the row. The bulk order importer deliberately does not emit — it replays orders placed elsewhere, often years ago, and announcing thousands of them as new business facts would drown the log and any automation reading it. `customer.created` emits on password registration and on first OAuth sign-in. The PayPal and Square webhooks now emit `payment.completed` inside their existing transaction, matching Stripe — previously a card payment produced an event and the same purchase through PayPal produced none, which would have made any consumer reading the log quietly wrong about revenue.
- **Operations sweep cron** — A new `/api/cron/operations-sweep` runs every two hours and raises a notification for work that has gone quiet: paid orders still unshipped after 48 hours, return requests left undecided for 72 hours, and webhooks received more than 30 minutes ago that never finished processing. The webhook case is the one that costs money silently — the provider took the payment and called us, the handler threw partway, and the row sits at `processed: false` with nothing watching it — so it is raised as CRITICAL and reported as counts per provider, since the useful question is whether one integration is broken or one event is bad. Detection only: replaying a payment webhook unattended is not a decision to automate. It reuses the `INTEGRATION_FAILED` type and dedupe identity the notification centre already defined and nothing had used. None of the three conditions throws an error or fires a webhook — the rows just sit — so nothing else was noticing them. Each sweep collapses onto a single rolling notification rather than one per row, because twelve unshipped orders is one situation and a list that reports it twelve times is a list operators learn to ignore. The stale-order query reuses the exact `where` clause behind the "Needs Shipping" saved view, so the notification and the link it points at cannot disagree about which orders count, and a quiet sweep writes nothing at all rather than an "all clear" that would re-surface itself on every tick.

### Changed
- **Jar pricing raised to $9, and the catalogue priced uniformly** — All 28 products move from $7.00 to $9.00 in both databases and in `lib/seed.ts`, so a reseed cannot quietly restore the old figure. The three SKUs that carried a `compareAtPrice` (Original Mild, Garden Cilantro Hot, Mango Habanero) have it cleared: the storefront renders a strikethrough and a "Save 18%" badge whenever that column exceeds the price, which would have shown a phantom sale on three arbitrary items out of twenty-eight while the rest showed nothing.

  Bulk product operations gain **Set price**, because a percentage adjustment cannot land on a round figure from an arbitrary starting price, and `set-cost` already existed without a price counterpart. It is planned per row rather than issued as one `updateMany` — every row lands on the same number, but the audit entry needs to record what each one *was*, which is the only thing that makes the change reversible. The bulk actions bar also finally exposes **Set cost** and **Cost from purchases**: both shipped in the API last release with no control to reach them.

- **Cron schedules raised now that the project is on Vercel Pro** — Hobby capped crons at once per day, which several of these were built expecting not to be. Email automation and campaign sends move from daily to every five minutes: the automation route documented itself as "runs every minute", and the campaign route is the safety net that recovers sends orphaned by a crashed run, with a five-minute staleness cutoff that daily execution made meaningless — a stalled campaign could sit stalled for a day. Abandoned-cart recovery moves to hourly so its one-hour first-stage delay is real rather than up to 24 hours late; its stage is persisted per cart, so raising the frequency cannot re-send a stage. QuickBooks sync moves to hourly, which its own comment already claimed. Scheduled social publishing moves off GitHub Actions onto Vercel Cron at five-minute granularity, and the Actions workflow was deleted in the same change rather than left running alongside: `publishPost` guards against re-publishing an already-published pair, but the check and the claim are not atomic, so two schedulers racing the same queue could both pass the guard and post twice.
- **`/api/cron/dashboard-analysis` unscheduled** — The route is a four-line stub that returns `{ success: true }` and does nothing else, so it was burning a daily invocation to no effect. The orphaned route file is left in place rather than deleted.

### Fixed
- **Fundraiser prices were shown but never charged** — `FundraiserProduct.price` reached the product grid and the cart, and all three order-creating routes then re-priced the line from `Product.price`. A supporter on a fundraiser page saw ten dollars, added ten dollars to their cart, and was charged the catalogue price; the group's share came out of our margin instead of out of the gap it was meant to come from. Checkout now resolves the fundraiser price server-side from the referral code — never accepted from the client, for the same reason shipping and discounts are recomputed there. The rule lives in one place and the four display sites now call it too, so the page and the charge cannot disagree again. It uses `??` rather than a truthiness check, which the display sites did not: an override of zero is a fundraiser giving something away, and falling through to the catalogue price would have charged for it.

- **Fundraiser commission was paid on shipping and tax** — Commission was `order.total × rate`, and the total includes freight and sales tax. On the standard fifty-percent terms, six jars shipped for $8.95 with $1.20 of tax paid the group $35.08 against $60.00 of merchandise — a share of money owed to a carrier and a state, taken out of the only thing funding the group's half. It is now taken from the merchandise subtotal net of discounts, so a $10 jar splits $5 and $5 as the terms say. Gift certificates are excluded from that deduction: they are a means of payment, not a lower price. `totalRevenue` still records the full order value. The same expression was inlined in all three completion routes and is now one helper with tests.

- **Refunding a fundraiser order takes the group's share back** — Commission was credited on payment and never reversed, so a returned jar left a group credited for revenue that no longer existed: money owed against a sale that did not happen. Refunds now reverse it, from all four paths that record one — the admin refund route and the Stripe, PayPal and Square webhooks.

  How much comes back is measured against the **merchandise** base — subtotal net of discounts — because that is the base commission was credited on; reversing against a different denominator than you credited against leaves the two permanently out of step. It does mean a refund is treated as merchandise before freight, which reverses slightly more than a total-based split would, and that is the right way round: a refund on a fundraiser order is a returned jar far more often than it is refunded shipping. The proportion is applied to what was *originally* credited, reconstructed from the order's remaining commission plus everything already reversed, rather than recomputed from `Fundraiser.commissionRate` — the rate is editable, and a reversal derived from a rate that changed after the sale would not match the credit it is undoing. Each reversal is then capped at what is left, which is what makes a partial reversal followed by a refund of the remainder come to exactly the original credit rather than a cent either side.

  `Refund.commissionReversed` records what each refund took back and doubles as the claim that stops one refund reversing twice, the same pattern as the credit. `Order.fundraiserCommission` is decremented, so it always carries what a group is still owed and margin reporting nets refunds without joining back. Revenue comes down by the refunded amount; the order count is deliberately left alone, because the order did happen. Verified against a live database: $25 refunded against $60 of goods reversed $12.50, repeating that refund was a no-op, and refunding the remaining $45.15 reversed exactly the $17.50 left, returning the group's balance to zero to the cent.

- **Commission is credited exactly once, from whichever path finishes the order** — Six paths can mark an order paid: the three completion routes and the three payment webhooks, each pair racing the other. Crediting lived inline in the completion routes only, and those return early once an order is already paid, so a webhook that won the race left the group unpaid for that sale with nothing anywhere recording it had happened. Crediting is now one operation called from all six, and it claims a new `Order.commissionCreditedAt` before touching a rollup — a conditional update rather than a read-then-write, so of two callers arriving together exactly one matches and the loser stops. Same shape as the fulfillment and receiving rollups: one writer, increments rather than assignments. It runs inside the transaction that marks the order paid, so a rolled-back payment takes its credit with it. Verified against a live database by crediting the same order from two concurrent transactions: one credited, the rollups moved once.

  `Fundraiser.totalOrders`, `totalRevenue` and `totalCommission` are now written for the first time. They were read in about fifteen places — the public progress bars, the coordinator's portal, admin detail and analytics — and incremented by nothing, which is why several admin screens quietly work around them by summing participants instead and can disagree with their own siblings.

- **"Raised" means sales, and the campaign-summary email now agrees** — Every progress bar on the site measures gross sales against the fundraiser's `goal`, while the coordinator's summary email reported the commission under the heading "Total Raised" and put that same figure in the subject preview. The same word named two different numbers, differing by half at the standard terms. A goal here is measured in sales, so the email's figure is relabelled **"Commission Earned"** — matching the wording the participant page and the coordinator portal already use — and the preview quotes sales. The number itself is unchanged; only what it is called. `sendParticipantMilestoneEmail` carries the same mislabel but has no callers, so it is left alone.

- **Standard fundraiser terms are now the default** — A new fundraiser took 20% from the admin form, 40% from public self-registration and 40% from the seed. All three are 50%, matching the $10 jar. Existing fundraisers were moved to 50% with their products priced at $10; products a fundraiser has not chosen to carry were deliberately not backfilled, since that is a catalogue decision rather than a pricing one.

- **Review-request emails were never being sent** — The post-delivery review cron used `confirmationEmailSentAt IS NULL` as a stand-in for "no review request sent yet". Every successful checkout stamps that column, so the filter only ever matched orders that had *not* received an order confirmation — in practice, almost none. Worse, on the rare order it did match, it then overwrote `confirmationEmailSentAt` with the review-request time, destroying the confirmation timestamp. Orders now carry a dedicated `reviewRequestSentAt` marker, which is both the correct predicate and the idempotency guarantee that makes the cron's frequency safe to change.
- **Three cron endpoints were callable by anyone** — `abandoned-cart`, `review-requests`, and `dashboard-analysis` took no `request` argument and checked no authorization, leaving two customer-email senders open to the internet. All scheduled routes now share `isAuthorizedCronRequest`, which verifies the bearer token Vercel Cron sends. It allows a missing secret outside production so local runs need no setup, but **refuses** in production rather than failing open — the older per-route copies of this check pass unconditionally when the variable is unset, which would leave these routes world-callable if it were ever dropped.
- **Customer-facing return requests** — Customers can request a return from their own order page at `/account/orders/[id]/return`, choosing items and a reason. Quantities default to zero so a return is an explicit choice rather than a reflex submission, and the page shows an estimated refund. Requests always land as REQUESTED for staff to approve — a customer cannot approve their own return, set a resolution, waive the window, or apply a restocking fee. The order is looked up scoped to the signed-in user, so another customer's order id resolves to nothing rather than revealing that it exists. Staff are notified through the notification centre when one arrives.
- **Notification bell in the admin header** — Shows the unread count as a badge, capped at 99+ so a backlog cannot widen the header. The bell swings only when the count *rises* — a standing backlog should not jingle forever, but something new arriving should catch the eye — and the animation is suppressed for users who have asked for reduced motion. The count refreshes on navigation as well as on a poll, so reading the notifications page updates the badge immediately.
- **Fulfillment and order history on mobile** — The mobile order view gains the per-item fulfillment progress, the "Fulfill items" action, and the activity timeline that the desktop view already had, so a phone is no longer missing the answer to "what shipped and when".
- **Bulk product and inventory operations** — The product list gains row selection with an actions bar: activate, deactivate, feature, unfeature, move to a category, or adjust prices by a percentage across the selection. A new bulk inventory endpoint applies stock adjustments to many products at once. Flag and category changes are a single `updateMany`; a percentage price change cannot be, since each row's new price derives from its own, so those are planned first and written in one transaction — a half-repriced catalogue is worse than an unchanged one because there is no way to tell which rows moved. Adjustments are bounded (-90% to +500%) and floored at one cent, so a typo cannot make the catalogue free, and a selection over 200 products is refused rather than quietly applied. Bulk stock changes route through `adjustInventory` rather than a bulk write, so each still records an inventory transaction and still evaluates low-stock alerts; one bad product id is reported without discarding the rest of the batch.
- **Two-factor authentication** — Accounts can enrol a TOTP authenticator app from `/admin/settings/profile`, after which password sign-in requires a six-digit code. Ten single-use recovery codes are issued at enrolment for a lost device, stored only as hashes and shown exactly once. The shared secret is encrypted at rest with the credential-vault key, so reading the database does not yield the ability to mint codes, and a secret only becomes a second factor once a valid code has proved the app works — an abandoned setup cannot lock anyone out. Disabling requires the account password again rather than trusting the existing session. TOTP is implemented directly against RFC 6238 and verified in tests against the RFC's own published vectors. Note this covers the password sign-in path; the Google, GitHub, Facebook and Apple providers rely on those accounts' own second factors.
- **Global admin search** — ⌘K (or Ctrl-K) from anywhere in the admin opens a search box that finds orders by number or tracking number, returns by RMA, customers by name/email/phone, products by name/SKU/barcode, fundraisers, and discount codes. The query is classified first, so pasting an order number goes straight to that order instead of ranking it among fuzzy name matches, and a pasted email never scans product descriptions. Results are ranked with exact identifiers above prefix matches above substring matches, with orders winning ties because that is what staff look for most. Search is federated across the entities rather than backed by a separate index: an index would have to stay in sync with every write path, and staleness in the tool used to answer "where is this order" is worse than a few indexed lookups. Each entity is permission-gated before it is queried, so results never include things the operator could not open.
- **Notification centre** — `/admin/notifications` gives operators an in-app place to see problems instead of relying on email. `NotificationType` gains payment-failure, low-stock, out-of-stock, return-requested and integration-failure categories alongside the existing order events, and notifications now carry a severity, a destination link, and a dedupe key. That key is what keeps the list usable: a condition observed repeatedly updates one row rather than creating another, while a condition that had already been read and then recurs is surfaced again, since stock going low a second time is genuinely new information. Dispatch fans out to admin, developer and staff accounts and never throws — it runs after the thing it describes has already happened, so failing to tell someone about a captured payment must not roll the payment back. Wired so far to Stripe payment failures and return requests. Marking read is scoped to the owning user, so one operator cannot clear another's list by guessing an id.
- **Operational dashboard** — `/admin` now opens with a "Needs attention" section answering what has to be done right now, separate from the performance figures below it and in `/admin/analytics`. Seven queues are tracked: orders needing shipping, failed payments, orders stuck paid-but-unconfirmed for over 30 minutes (usually a webhook that never landed), open returns, active inventory alerts, pending fundraiser signups, and pending wholesale applications. Each tile is a link into the filtered list it counts, so a number is always one click from the rows behind it — previously the dashboard's eight stat cards carried no links at all, so "12 low stock" was a dead end. Tiles are ranked by what most needs attention: outstanding before cleared, then by severity, then by size, so one failed payment sorts above fifty pending signups. Queue counts reuse the same `where` clauses as their destination pages, and a queue that cannot be counted reports zero rather than taking the dashboard down. The analytical stat cards now link to their underlying lists too.
- **Returns / RMA** — A new returns system covers the full lifecycle: request, approve or reject, receive and inspect, then complete. `/admin/returns` lists the queue with open requests called out and each RMA opens a detail page where staff advance it — only the transitions the state machine allows are offered, and per-item condition is captured on the way to Received because that is what decides restocking. The page also shows the refund due, net of any restocking fee, and links the refund record once one exists. `POST /api/admin/returns` creates a request, and `PATCH /api/admin/returns/[id]` advances it. Only quantities that actually shipped can be returned — the returnable balance is `quantityFulfilled` minus what live requests already claim, so an unfulfilled line has nothing to send back and a rejected or cancelled request frees its units again. Returns are accepted within 30 days of shipping, which staff can override deliberately. Restocking happens on completion and is driven by the condition recorded at inspection: only resellable units go back to sellable stock, through `adjustInventory` so the inventory transaction is written and low-stock alerts still evaluate. Units returned damaged are not written off against inventory — they were already deducted when they shipped and never re-entered stock, so recording a second movement would double-count the loss; the damage is recorded on the return line instead. Lines are marked once dispositioned, so re-running completion cannot restock twice. Refund amounts are computed in cents and never go negative when a restocking fee exceeds the returned value.
- **Partial fulfillment and split shipments** — `POST /api/admin/orders/[id]/fulfillments` records a shipment covering any subset of an order's items, and the order detail page gains a "Fulfill items" action showing what remains outstanding per line. This closes the Phase 1 gap where `Fulfillment`, `FulfillmentItem`, and `OrderItem.quantityFulfilled` existed in the schema but nothing wrote them, so `PARTIALLY_FULFILLED` was unreachable. Quantities are incremented rather than set, so successive shipments accumulate; shipping more than an item has outstanding is rejected rather than clamped, since it would push `quantityFulfilled` past `quantity` and corrupt every downstream count. Re-submitting with the same tracking number returns the existing fulfillment instead of shipping the box twice.

  Item quantities are now the single authority for how much of an order has shipped: `deriveFulfillmentStatus` computes `UNFULFILLED`/`PARTIALLY_FULFILLED`/`FULFILLED` and nothing else asserts them, while `DELIVERED` and `RETURNED` remain order-level overlays because they describe what happened after shipping and cannot be inferred from quantities. The six order-level "mark shipped" paths (admin status update, bulk status, tracking entry, label purchase, the Shopify webhook, and EasyPost tracking) now write the item quantities and record a `Fulfillment` for whatever was outstanding, rather than stamping the order enum directly — otherwise an order partially fulfilled and then marked shipped would have said `FULFILLED` while its items said 3 of 5.
- **Order filtering, saved views, and an activity timeline** — `/admin/orders` can now be filtered by order status, fulfillment status, sales channel, payment status, date range, and order value, and the search box also matches tracking numbers. Five saved views cover the everyday questions — Needs Shipping, High Value, Payment Failed, Fundraiser Orders, and Local Pickup. Previously the desktop filter controls were inert (a select and an input with no form and no navigation), and only a text search plus order status were honoured at all. The where clause now lives in one shared module used by both the page and the CSV export, so filtering the list and hitting Export returns the same rows — the export previously understood only status and a date range, so any newer filter would have exported everything. Order detail gains a chronological timeline that merges recorded domain events with the timestamps already stored on the order, its payments, and its refunds, so orders placed before the event log still show a history; entries derived that way are labelled `reconstructed` rather than presented as observed fact.
- **Order fulfillment tracked separately from order status** — Orders now carry a `fulfillmentStatus` (`UNFULFILLED`, `PARTIALLY_FULFILLED`, `FULFILLED`, `DELIVERED`, `RETURNED`) alongside the existing commercial `status` and `paymentStatus`, plus `OrderItem.quantityFulfilled` and new `Fulfillment`/`FulfillmentItem` records so one shipment can cover a subset of an order — the structural prerequisite for partial fulfillment, split shipments, and per-item returns. Six code paths advance an order to shipped or delivered (admin status update, bulk status, tracking entry, label purchase, the Shopify webhook, and EasyPost tracking); all six now go through `buildFulfillmentUpdate()` in `lib/orders/fulfillment.ts`, which returns status, fulfillment status and timestamps as a single object so the fields cannot drift apart. A partially shipped order stays `PROCESSING` rather than `SHIPPED`, and a late carrier webhook records delivery without resurrecting a cancelled or refunded order. The migration backfills history from `status`/`shippedAt`/`deliveredAt` instead of defaulting every past order to unfulfilled.
- **Sales channel on orders** — New `SalesChannel` enum (`WEBSITE`, `POS`, `FUNDRAISER`, `WHOLESALE`, `MANUAL`, `MARKETPLACE`, `PHONE`, `IMPORT`) and `Order.salesChannel`, replacing the practice of inferring an order's origin from the combination of `paymentChannel`, `fundraiserId`, `shopifyOrderId`, and `importSource`. Set at creation across all five order paths by `deriveSalesChannel()`, whose precedence (fundraiser attribution outranks the terminal a sale was rung up on) is stated explicitly and mirrored in the migration backfill.
- **Audit logging across the admin console** — Admin write endpoints that previously changed data without recording who did it now log an `AuditLog` entry with the acting user, the entity, a before/after or summary of what changed, and the request IP. Coverage went from 48 to 93 of the 99 admin API route files containing a POST/PATCH/PUT/DELETE handler. Newly covered actions include refunds, order modification, fundraiser approval/rejection and API-key rotation, commission-rate changes, fundraiser account approval and suspension, email campaign send/pause/cancel/duplicate, mailing-list bulk operations and CSV imports, email template and automation edits, arena season lifecycle changes, SEO configuration and structured-data changes, location imports, and lead deletion. Six POST endpoints are deliberately not logged — they render a preview, geocode a lookup, or send a test message to the requesting admin, and change no persistent state.
- **Domain event log** — New append-only `DomainEvent` model plus a typed emitter (`lib/domain-events/`) recording business facts such as `payment.completed`, `payment.failed`, `shipment.created`, and the order fulfillment transitions. Consumers (notifications, automation, activity timelines, analytics) can subscribe to these instead of being hand-wired into every route that causes the fact, and the table's `(entityType, entityId, createdAt)` index doubles as the source for per-entity timelines. Emitting never throws and accepts a transaction client, so a failed event write can never roll back the payment it merely describes.
- **Staff timeclock** — Signed-in staff, admin, and developer accounts get a `/account/timeclock` page in the customer account area (alongside the Admin Panel link, not inside it) with a live clock showing seconds and milliseconds, Clock In / Clock Out buttons, and their full punch history. Punches are stored as append-only in/out pairs, so clocking out for lunch and back in simply creates a second pair and the day's hours still add up. Punch times are taken from the server and the record has no update or delete route, so entries cannot be altered after the fact; the IP address is logged on both the clock-in and the clock-out, and a partial unique index guarantees at most one open punch per user. A Notes / Job Duties field is captured at clock-out — the only moment it can be written. Hours are always derived from the timestamps (never stored) and bucketed into `America/New_York` business days so daylight-saving transitions don't shift a shift onto the wrong day. The history table groups punches by day with per-day and per-period totals in decimal hours, over a pay period the user types directly as `MM/DD/YYYY`, within two months either side of today.
- **Customer list browsing, editing, and mailing lists** — `/admin/customers` now sorts on every column heading (click to sort, click again to flip; blanks always last, with a stable tie-break so paging doesn't reshuffle), filters by account type alongside search and source, and shows 500 rows per page by default (100/250/500/1,000) in a compact row layout. Clicking a row opens an editor for name, phone, account type, organization, email status, and notes — email and the order rollups stay read-only because other systems key off them. A **Create mailing list** action builds a `MailingList` from either the whole filtered result set or tick-selected rows, carrying unsubscribes across as `UNSUBSCRIBED` so campaigns skip them, and tagging each subscriber with its account type and organization. The CSV export now shares the list's filters and sort, so it matches what's on screen, and is streamed in batches — a full ~11 MB export would otherwise exceed Vercel's 4.5 MB buffered-response cap.
- **Customer account-type designation** — `Customer` now carries an `accountType` of `STANDARD`, `FUNDRAISING`, or `WHOLESALE` (new `CustomerAccountType` enum, indexed), so retail salsa buyers, fundraiser organizations, and wholesale/retail accounts can be told apart on the customer list.
- **Document-archive customer import** — A two-stage importer builds the customer list from the local `Documents/` business archive. Stage 1 (`scripts/extract-archive-customers.py`) walks every CSV/XLSX/XLS/DOCX/PDF and extracts contacts with full provenance via tabular, labelled-form, and freeform modes; stage 2 (`scripts/import-archive-customers.ts` + `lib/customers/archive-merge.ts`) merges them into one order-independent record per email address, designates the account type, reconstructs order rollups, and upserts — dry run unless `--commit`.
- **Mileage archive import** — New `MileageEntry` model recovers business trips from the yearly "Mileage Master" spreadsheets in `01 Financial/Mileage`. `scripts/extract-mileage.py` reads the four different column layouts to raw rows; `lib/archive/mileage-normalize.ts` (unit-tested) resolves the odometer-vs-date `Start`/`End` ambiguity, canonicalizes driver names, rejects subtotal rows, and de-duplicates the overlapping re-exports on a content hash; `scripts/import-mileage.ts` inserts them (dry run unless `--commit`). Every row keeps its source file, md5, sheet, and row number.
- **Show & market sales archive** — New `ArchivedShowSale` model recovers per-show and per-farmers-market daily sales from the yearly sheets in `04 Shows & Events`. `scripts/extract-show-sales.py` auto-detects the show-sales shape (one row per show, with a crew member) and the market shape (days grouped under a carried-down market name, with amount-paid/expenses); `lib/archive/show-sales-normalize.ts` (unit-tested) parses date ranges like "1/3-5/2025" to the start date, canonicalizes crew names, and de-duplicates overlapping sheets on a content hash; `scripts/import-show-sales.ts` inserts them. 257 event-days across 2021/2025/2026. (These are the crew's own tallies, not QuickBooks — historical record, not authoritative accounting.)
- **Fundraiser history archive** — New `ArchivedFundraiser` model recovers past fundraiser campaigns from the order-form spreadsheets in `03 Fundraisers` (a separate archival model from the live `Fundraiser`, which requires a slug/commission rate that historical forms can't supply). `scripts/extract-fundraisers.py` classifies each file as a store order-export (one row per order, with a Total Jars column) or the hand-filled Jose Madrid order-form template (Organization/Submitted-by labels plus per-flavor quantities); `lib/archive/fundraiser-normalize.ts` (unit-tested) resolves the organization name across group/label/folder/filename, parses the free-text form date, and drops Jose Madrid's own email off the blank template; `scripts/import-fundraisers.ts` upserts one summary row per file. 644 campaigns across ~492 organizations, 2018–2026.
- **Searchable document archive index** — New `ArchiveDocument` model indexes all ~4,059 files in the local `Documents/` archive. `scripts/extract-archive-text.py` pulls full text from every text-bearing format (PDF text layers, Word, spreadsheets, CSV/TXT, HTML), flagging image-only scans as `needsOcr`; `scripts/import-archive-documents.ts` merges that with the archive's `search_index.csv` metadata and classifies each file's sensitivity (`lib/archive/document-classify.ts`, unit-tested) so HR, tax, bank, and payroll records are marked `SENSITIVE` and gated from public/customer surfaces. Idempotent on the file path.
- **QuickBooks Online integration** — The admin financials suite connects to QuickBooks Online via OAuth and keeps the books in sync: paid orders sync to QBO, refunds sync as RefundReceipts, and the financials dashboard pulls live profit & loss along with expenses, bills, and vendor balances directly from QuickBooks.
- **Show CSV import** — Events can be bulk-imported through a strict 20-column Show CSV importer.
- **Developer Console (super admin)** — The DEVELOPER role is now the platform super admin with exclusive `developer:*` permissions and a dedicated `/admin/developer` console: a blob file explorer for the `josemadridsalsa-blob` store (browse, upload, delete — Developer-only), developer blog post management, a public developer page content editor with section visibility controls, and a Salsadocs manager that imports repository Markdown, converts it to Fumadocs MDX, and publishes pages and sections to the salsadocs repository directly from the admin panel. The designated developer account is auto-promoted to DEVELOPER at sign-in, with an `npm run create-developer` script for manual promotion.
- **Homepage Heat Index bento** — The storefront home page now features the three newest Heat Index posts in a responsive editorial bento section.
- **Playable fundraiser battle arena** — The `/arena/[period]` view is now an interactive graphic arena with controllable player movement, team sprites in a shared level, local arena messages, sound toggles, support links, and purchase-triggered damage effects inferred from live HP and sales updates.
- **Heat Index blog concept page** — Added a new public editorial landing page with acrylic bento story cards for salsa posts, fictional Jose Madrid lore, expo dispatches, recipes, and developer notes.
- **Contact form message inbox** — Contact form submissions now create admin message conversations so staff can track, read, and reply from the renamed Contact Form Messages page.
- **Facebook + TikTok social commerce hardening** — Admin social integrations now use a verified OAuth session flow, support choosing the exact connected destination account for each export, and can create Meta catalogs from the admin panel when Business Manager access is available.

### Added
- **Document archive admin browser** — `/admin/archive` is a read-only browser for the four indexed archive datasets: documents, fundraiser campaigns, show & market sales, and mileage. Each page supports search, filtering, sortable columns and paging; the documents view searches full text as well as filename and path, and filters by category, sensitivity and needs-OCR. Gated on `analytics:read`, which admins and developers hold but staff do not. Sortable columns resolve through an allow-list, so a hand-edited URL cannot choose an arbitrary column. Query helpers live in `lib/archive/archive-list.ts` (unit-tested).
- **`--redact-sensitive-text` on the archive document importer** — stores `SENSITIVE` documents as metadata only, with `extractedText` null. Raw identifiers in the archive (Social Security numbers on tax returns, account numbers on bank records) live only in that field, so dropping it at import keeps them out of the target database entirely rather than relying on a read-time guard. Used for the production import.
- **Fundraiser account import** — the document archive's fundraiser contacts and organizations can now be loaded as `Customer` records with `accountType: FUNDRAISING`. `scripts/import-archive-customers.ts` gained an `--account-type` filter so one designation can be imported without the other two, and the new `scripts/import-fundraiser-accounts.ts` promotes the organizations behind `ArchivedFundraiser` to customer records, storing the organization in `sourceName` (what the admin customer list searches as "organization"). The normalization lives in `lib/archive/fundraiser-accounts.ts` (unit-tested): it repairs cp1252 mojibake, strips trailing year/season suffixes so one group's campaigns across years resolve to a single account ("BGSU Equestrian", "BGSU Equestrian 2023", "BGSU Equestrian Fall '21"), and drops filing artifacts ("2024 Fundraiser Totals", "Tracking $6"). Dry run by default; prints its target database before writing.
- **Four email layouts added to the template system** — `announcement_newsletter`, `announcement_single`, `order_confirmation_light`, and `order_confirmation_dark` are now selectable templates, registered from their source HTML in `public/templates/`. The two announcement layouts are also previewable and exportable from `/admin/email-templates`. The order-confirmation layouts are additional options only; the live transactional send path still uses the existing `order_confirmation` template.
- **Email templates now support Handlebars block helpers** — template bodies render through `substituteVariables()` in the new `lib/email/render.ts`, so `{{#each line_items}}` and `{{#if}}` work in addition to flat `{{variable}}` substitution. Values are still inserted unescaped, matching the previous behavior that lets templates pass pre-rendered HTML through variables like `{{orderItems}}`, and a template that fails to compile falls back to flat substitution rather than failing the send. The admin preview imports the same renderer, so it can no longer drift from what actually sends.
- **`db:seed:email-templates` accepts template keys** — the seed upserts, so a blanket run replaces the subject and HTML of every template it defines, including any edited in the admin panel. Passing keys (`npm run db:seed:email-templates -- announcement_single`) limits the run to those templates; with no arguments it behaves as before.

### Changed
- **Sensitivity classification now inspects document content** — `classifySensitivity()` previously decided from path and category alone, which missed a Social Security number sitting in `12 Correspondence`, a category no rule treats as sensitive. It now also flags documents whose extracted text contains an SSN, written either as `NNN-NN-NNNN` or spelled out. Bare long digit runs are deliberately not matched, so order numbers and tracking numbers do not trip it.
- **Standard shipping is now the only shipping option** — Express shipping has been removed from the storefront. Checkout presents a single method: when live carrier rates are available it is the cheapest returned rate, and when the calculator falls back to estimates it is `Standard Shipping` (or `USPS Ground Advantage` for PO Box destinations). The `EXPRESS` rate tier, the second-tier `USPS Priority Mail` fallback option, and the express-is-free-when-it-exceeds-the-subtotal rule are gone, and the `/shipping` page no longer advertises expedited or express service. Admins can still buy any carrier service — including Priority Mail Express — when purchasing a label.
- **User deletion is now restricted to the owner accounts** — `DELETE /api/admin/users/[id]` requires the caller to be one of the two accounts in `DATA_ERASURE_EMAILS` (`lib/developer/constants.ts`); holding the `users:write` permission is no longer sufficient and everyone else receives a 403. Deleting a `User` cascades to every record they own, including their otherwise append-only timeclock history, so the destructive path is held to the owners rather than to any admin.
- **Homepage hero redesign** — The storefront home page (`/`) now leads with a scroll-scrubbed cinematic hero: the video advances frame-by-frame as the page scrolls (logo → jar → farmers-market beats), with the copy in a left-hand column over a left-edge legibility gradient that fades before the centred subject. The Featured Products section is lifted above the pinned video (opaque `z-10` wrapper) so the footage can no longer bleed behind the store text, and the Fundraising section now sits directly beneath the products display. This replaces the previous GrowthBook-flagged `HeroWithFeatureFlag`, retiring the logged-in hero personalization on the homepage.
- **Preview deployment policy** now disables Vercel Git deployments for non-`main` branches to stop recurring failed preview checks while keeping production deploys enabled.
- **Claude Code Review workflow** is now manual-only until `CLAUDE_CODE_OAUTH_TOKEN` is rotated; the previous automatic PR run failed with `401 Invalid bearer token`.
- **Shop listings** now target a selected connected Facebook Page or TikTok account instead of blindly exporting to the first active account.
- **Social commerce setup UX** now makes the platform boundary explicit: Facebook catalog creation can be started from the admin panel, while TikTok Shop onboarding remains a Seller Center prerequisite before API-based product export.
- **Front-page analytics loading** now stays quiet unless optional Amplitude and Vercel Analytics settings are configured.

### Security
- Resolved 111 of 112 open Dependabot alerts by upgrading Next.js (16.2.11), Axios (1.18.1), next-auth (4.24.15, clearing two critical `@auth/core` advisories), and Nodemailer (9.0.3, closing a high-severity file-read/SSRF), and by forcing patched versions of vulnerable transitive dependencies (undici, sharp, ws, tar, js-yaml, esbuild, postcss, minimatch, srvx, @tootallnate/once, and others) via root `package.json` `overrides` plus `npm audit fix`. Several of these transitive fixes were previously specified in `apps/storefront/package.json` `overrides`, which npm silently ignores in a workspace — they now live in the root and actually take effect. Declared `protobufjs@^8.6.6` in the storefront so `@google-analytics/data` can resolve `protobufjs/minimal`. The one remaining alert (a medium-severity `uuid` advisory) is pinned by `exceljs@4.4.0`, which requires `uuid@^8`; it is deferred to an `exceljs` upgrade. Note: npm honors `overrides` only from the root `package.json` in this monorepo, and installs use `--legacy-peer-deps` to match the existing next-auth/Nodemailer peer arrangement (`npm ci` is unaffected).
- Patched dependency vulnerabilities by upgrading Next.js, Axios, next-intl, PostCSS, and Vercel; removed the unused `workflow` package; and pinned vulnerable transitive packages to fixed versions.
- Removed hard-coded database and Google API fallback credentials from maintenance scripts.

### Security
- **Two admin endpoints were callable without authentication** — `POST /api/admin/locations/fetch-photos` and `POST /api/admin/locations/update-local-photos` had no session or permission check of any kind. `proxy.ts` does not guard `/api/admin` (it only handles fundraising route redirects), so both were reachable anonymously. `fetch-photos` would enumerate every active retail location, spend billable Google Places API quota, and write the resulting photo URLs back to the database; `update-local-photos` rewrote photo URLs on matched locations. Both now require the `content:write` permission and record an audit entry.

### Fixed
- **Google reviews returned a 500 for two hours after every deploy** — `/api/reviews/google` declared `revalidate = 7200`, which made Next execute it during `next build` and bake the result into the static output. The build environment has no Google Places credentials, so what got baked was an error response, and production served that until the first revalidation — even though the key is present in the runtime environment. The route now renders per request and reads its environment variables at request time rather than module scope, with the two-hour cache moved onto the upstream Google calls so the billable request rate is unchanged. This was the source of the unexplained `Server error: undefined` line in every build log.
- **`serverError()` logged nothing useful** — it printed the optional `error` argument, which most callers do not pass, producing a bare `Server error: undefined` that identified neither the route nor the failure. It now logs the message as well.
- **The orders page turned its own permission redirect into a render error** — the page body is wrapped in a `try/catch` that re-threw everything as a plain `Error`. Next.js implements `redirect()` and `notFound()` by throwing a tagged error, so re-wrapping stripped the marker it dispatches on and the `orders:read` redirect surfaced as a failed render instead. `lib/next-errors.ts` now identifies those control-flow exceptions so catch-alls can let them through.
- **Audit logging could fail the operation it was recording** — `logAuditWithRequest` called `getRequestMetadata` outside any try/catch, and `getRequestMetadata` assumed `request.headers.get` existed. A request object without usable headers therefore threw, turning an operation that had *already completed* — a refund where the money had moved — into a 500 for the caller. Both functions are now total: `getRequestMetadata` returns null metadata rather than throwing, and `logAuditWithRequest` swallows its own errors the way `logAudit` always did. This matters more than it did before, because audit logging now runs on nearly every admin write.
- **Admin-initiated PayPal and Square refunds collided on a unique column** — `Refund.stripeRefundId` is UNIQUE, and `app/api/admin/refunds/route.ts` stored the real refund ID only when the provider was Stripe, writing an empty string for every other provider. The first non-Stripe refund taken from the admin panel succeeded; the second would violate the unique constraint and roll back the entire refund transaction. The route now stores the provider's actual refund ID. `Refund` also gains a `provider` column (backfilled from the parent `Payment`) so refunds can be attributed and reported on by processor — previously nothing recorded which processor a refund belonged to, since the PayPal and Square webhooks reuse the Stripe-named column for their own IDs. The column is deliberately not renamed to `providerRefundId`, because Prisma emits DROP + ADD for a rename, which would destroy every stored refund ID.
- **"Invalid shipping calculation request" during checkout** — The checkout page requested real-time shipping (and tax) rates as soon as the address fields were merely non-empty, but the `calculate-shipping` route validates `state` with a 2-character minimum and `postalCode` with a 5-character minimum. Typing a partial ZIP or state fired a request the server rejected with a 400 "Invalid shipping calculation request", which surfaced to the customer. The client now gates both calls behind `isShippingAddressReadyForRates` (`lib/checkout/shipping-address.ts`, unit-tested), which mirrors the server minimums, so rates are only requested once the address can actually pass validation. The debounced calculators also read the latest address through a ref instead of a one-keystroke-stale closure, so shipping and tax now calculate as soon as a complete ZIP is entered rather than waiting for a further edit.
- **Silently skipped permission seeding on deploy** — The `esbuild` security override added in the Dependabot sweep was unsatisfiable for `tsx@4.21.0` (which requires `esbuild ~0.27.0`), so npm dropped `esbuild` from the tree entirely and every `tsx` invocation failed with `ERR_MODULE_NOT_FOUND`. That broke `tsx prisma/seed.permissions.ts` on every production build, where the failure was swallowed by the step's `|| echo WARN` guard, and broke the `tsx`-based operational scripts. Upgraded `tsx` to `^4.23.1`, which uses `esbuild ~0.28.0` and satisfies the override — no package versions changed and the security patch still applies.
- **Intermittent production deploy failures** — The game icon manifest is no longer regenerated from the unauthenticated GitHub API during every Vercel build. That call was rate-limited on Vercel's shared build IPs and failed the whole deploy with a 403 at random, while only ever reproducing the manifest already committed to the repository. Builds now use the committed manifest and never depend on the network; `node scripts/generate-game-icons-manifest.mjs --refresh` re-pulls the upstream catalog on demand.
- **Storefront console noise** — Google Maps assets now have the required CSP sources, and desktop navigation moves focus before hiding an open menu to prevent Chromium accessibility warnings.
- **Vercel Toolbar console errors** — The storefront CSP now permits the official Vercel Toolbar resources used for deployment feedback and inspection.
- **Heat Index post pages on Vercel** — Heat Index routes now include Prisma client files in the serverless trace to prevent post detail pages from failing with a missing Prisma module at runtime.
- **Vercel production deploys** — Scoped the mobile app ignore rule to `/mobile/` so `components/admin/mobile/*` is included in web builds.
- **Front-page hydration stability** — Event ticker dates and review selection no longer render with client/server-only randomness that can trigger React hydration text mismatches.
- **Header logo preload warning** — Removed the forced priority preload for the small navigation logo.

---

## [1.10.1] — 2026-04-18 — Prisma Error Utilities & Credential Vault Refactor

### Added
- **`lib/prisma-errors.ts`** — Shared module exporting `isMissingTableError` (Prisma P2021 detection, including Accelerate-wrapped errors) and `logMissingTableWarning` (greppable warning format)
- **`tests/lib/prisma-errors.test.ts`** — 12 unit tests covering Prisma `KnownRequestError`, message-based heuristics, false-positive resistance, and standardised warning output

### Changed
- **Consolidated missing-table detection** — `lib/credentials.ts` and `lib/rbac.ts` now both call into `isMissingTableError` from `lib/prisma-errors.ts` instead of maintaining two parallel implementations (`isMissingTableError` + `shouldFallbackToDefaultPermissions`)
- **Tightened heuristics** — Cached `error.message.toLowerCase()` and added explicit precedence parentheses around the `relation` + `does not exist` check for clarity and a small perf win
- **Combined access-grant queries on `/admin/credentials`** — Page now performs a single `findUnique({ email })` and derives both grant existence and the per-permission flags from the result, halving DB roundtrips on every credentials-page render
- **Standardised warning format** — All "missing table" warnings across the admin surface now follow `[<scope>] <table_name> table does not exist. Run \`prisma migrate deploy\`.` for log greppability

### Removed
- **Redundant `shouldFallbackToDefaultPermissions`** in `lib/rbac.ts` (replaced with shared helper)
- **Closed PR #265** (`claude/beautiful-heisenberg`) and **PR #266** (`fix/credentials-page-runtime-error`) as superseded — the credential vault tables, indexes, and P2021 fallback behaviour are already in main via the `20260317000000_baseline` migration; this refactor addresses the shared reviewer feedback from both

---

## [1.10.0] — 2026-04-17 — Mobile App, Lead Gen & Admin Overhaul

### Added
- **iOS mobile app** — React Native Expo scaffold with full auth system, multi-provider payment integration, and native iOS Swift components
- **Mobile API endpoints** — Product by ID, account profile, and addresses for mobile client
- **Lead-generation scraper v2** — Google Business scraper with SerpAPI integration, Browserless.io remote browser, custom URL scraping with live progress dialog, and streaming `/parse` endpoint for Find Contacts step
- **Lead-gen UI overhaul** — Live feed redesign, collapsible table, pagination, toast notifications, progress bar, pause/resume dialog, skeleton loaders, tabbed activity log, and lead-selection checkboxes
- **PDF export for leads** with customizable options
- **Constant Contact CSV import** for existing contact lists
- **Resend email-template system** — Branded templates with sync pipeline; campaigns now support resume, cancel, and improved retry controls
- **Fundraiser Battle Arena port** — Ported Battle-Arena to the fundraiser subsystem across phases 0–5: pure game rules with vitest coverage, read-only spectator arena at `/arena/[period]`, server-authoritative damage and shield endpoints, realtime polling, and mobile/reduced-motion polish with Playwright smoke tests
- **Givebutter-style fundraiser pages** — `/fundraise/[slug]` restructured to a 2:1 layout with shadcn/ui donation UI and real donor identity on sale events (live supporter feed)
- **Admin panel redesign** — shadcn/ui sidebar-09 block with single-rail collapsible groups, theme-token migration, theme toggle, and bell-notifications fix
- **Sentry observability** — Error tracking and performance instrumentation wired up
- **Reviews section redesign** — Card grid with a leaning silhouette, theme-aware shadow/glow, and a 6th CTA card
- **Growth dashboard refactor** — Real database queries replacing placeholder data across admin dashboards
- **Feature images** added to the developer-page timeline
- **Developer-page profile photo** — Real photo inserted into the hero circle with flush framing

### Changed
- **Auth consolidation** — Removed Clerk; standardized on NextAuth.js with GitHub, Facebook, and Apple OAuth providers
- **Admin UI** — Completed shadcn migration across admin theme tokens; switched to CSS Grid with explicit column widths; plain-div content area to avoid SidebarInset overflow
- **Documentation site** — Removed fumadocs integration; public docs moved to `salsadocs.vercel.app`
- **Email pipeline** — Switched primary transactional provider from SMTP to Resend; slower rate limit for sync; `RESEND_UNSUBSCRIBE_URL` wired into outbound mail
- **Find-Us map** — Upgraded to Google Embed API v1 `/place` endpoint so the map zooms to the selected store
- **Event ticker** slowed to a comfortable reading speed
- **Dependabot** tightened to security-only npm updates and monthly GitHub Actions bumps
- **Package type** declared as ES module; CommonJS scripts renamed to `.cjs`
- **Developer-page faith statement** — Replaced with 1 Peter 4:10 and Galatians 6:9–10

### Fixed
- **Admin sidebar overlap** — CSS Grid layout fixes, SidebarInset bypassed for the content area, clickable parent nav with expand behavior, and single-rail collapsible groups
- **Scraper reliability** — Browser connection rotated every 3 domains, anti-detection measures, smarter contact parser (directory scanning + domain dedup), SSE `TextEncoder` bug, and event-bus subscriber mismatch
- **Vercel build** — TypeScript build errors resolved; `.vercelignore` patterns anchored to prevent admin-route exclusion; dead `fumadocs.config.ts` removed; `esbuild` pinning for legacy fumadocs-mdx
- **SMTP encryption failures** hardened via config validation
- **Rate-limit bypass** for mobile clients resolved
- **Email campaigns** — Missing campaign detail page (404 on create) and campaign sending both fixed
- **Google Places / Maps API key rotation** to restore Find-Us photos
- **Reviews section** — Silhouette positioning (~1.25in right shift) and theme-aware shadow/glow
- **Dependencies** — Next.js bumped to 16.2.3, Nodemailer to 8.0.5, `@prisma/client` aligned to 6.19.3, `defu` to 6.1.6

### Security
- **Auth surface reduced** — Removing Clerk eliminates a duplicate auth stack; NextAuth.js is now the single source of truth for OAuth
- **Sentry instrumentation** enables production error and regression monitoring
- **Scraper hardened** — Rotating remote browsers with anti-detection measures reduce the risk of IP-level bans and credential leakage

---

## [1.9.0] — 2026-04-02 — Developer Page & Blog Platform

### Added
- **Developer Page** (`/developer`) — Comprehensive developer hub honoring God's role in the project with Soli Deo Gloria faith statement and jlang.dev link
- **Parallax hero section** with developer bio, animated background effects, and scroll-driven interactions
- **Feature timeline** — 8 development phases rendered as scroll-driven timeline with cursor parallax, glow effects, and expand/zoom interactions
- **Tech stack grid** — 18 technologies across 4 categories with hover animations
- **Blog publishing system** (`/developer/blog`) — Full CRUD with Prisma model, admin-authenticated API, and markdown rendering via rehype-sanitize
- **Blog detail pages** (`/developer/blog/[slug]`) with sanitized markdown content
- **Contact form** — React Hook Form + Zod validation with rate limiting (3 requests per 5 minutes) and email notification via backend API
- **Changelog module** — Renders CHANGELOG.md on the developer page with collapsible version sections and changelog parser (`lib/developer/parse-changelog.ts`)
- **Developer link** added to global site footer across all pages
- **JSON-LD structured data** for developer page SEO
- **Full SEO metadata** with OpenGraph and Twitter card support (`lib/developer/metadata.ts`)
- **Loading skeleton** for developer page with animated placeholders
- **Dynamic imports** for code-split developer components (`lib/developer/dynamic-imports.tsx`)
- **Developer schemas** for input validation (`lib/developer/schemas.ts`)
- **Timeline data module** with 8 project phases (`lib/developer/timeline-data.ts`)
- Prisma schema extended with DeveloperBlogPost model (title, slug, content, excerpt, published, coverImage, tags)

### Security
- All 11 mandatory security audit items passed
- XSS sanitization via rehype-sanitize on blog markdown content
- Authentication required for blog CRUD API endpoints
- Rate limiting on contact form submissions
- Input validation with Zod schemas on all API endpoints

### Changed
- CHANGELOG.md expanded from stub to full 12-version history (v0.1.0 through v1.8.0)
- Footer updated with Developer link in About Us column
- `lib/metadata.ts` updated with developer page reference

---

## [1.8.0] — 2026-04-01 — Multi-Payment & Optimization

### Added
- Multi-payment provider support: PayPal, Square, and POS alongside Stripe
- Order analytics dashboard with enhanced tracking and reporting
- Shipping label generation system

### Fixed
- SSR enabled for dynamic components to resolve hydration issues
- Square SDK version corrected for production compatibility
- Google API calls reduced to max 1 per page load with server-side caching

---

## [1.7.0] — 2026-03-26 — Fundraiser Battle Arena

### Added
- Fundraiser Battle Arena — competitive gamification system for fundraiser campaigns
- Battle arena signup flow with Clerk authentication
- Admin tools for managing battle arena competitions

### Fixed
- Vercel build errors in battle arena files resolved
- PR #226 review comments addressed: Clerk auth, checkout tamper protection, E2E helpers

---

## [1.6.0] — 2026-03-16 — Fundraising Platform

### Added
- Fundraising Portal with dedicated subdomain for school and organization campaigns
- Participant tracking with real-time sales dashboards and referral ordering
- Fundraiser Account Portal with page builder and file uploads
- Homepage fundraising section with promotional content
- "Where Is Jose" schedule map on homepage
- Fundraiser admin detail page with product selection, pricing, branding, and commission controls
- Community message board with Google OAuth, supporter posts, and admin moderation
- Advanced fundraiser profiles with custom CSS, team management, and analytics
- Fundraiser page editor with 10 block types, inline GUI editor, and drag-and-drop
- Email campaigns system with sports team scraper integration
- Fundraising Portal button on account page for FUNDRAISER role users

### Fixed
- Fundraising portal build errors and admin 404s resolved
- Fundraising icon container aspect ratio corrected on homepage
- Fundraising portal button visibility — shows for any user with a fundraiserAccount, not just FUNDRAISER role
- Broken FacebookProvider removed; social-features stubs and FundraiserForm type fixed

---

## [1.5.0] — 2026-03-10 — Real Shipping & Infrastructure

### Added
- Real shipping cost calculation with carrier rate lookups
- Repository documentation overhaul: restructured docs/, removed junk files

### Changed
- Shipping module refactored per CodeRabbit review recommendations
- Express shipping cost calculation refactored for accuracy

### Fixed
- `calculateShipping()` calls properly awaited to resolve Promise type errors
- Shipping module Zod validation using `.issues` instead of `.errors`

---

## [1.4.0] — 2026-02-12 — Security & Inventory

### Added
- AES-256-GCM encryption for SMTP passwords and sensitive credentials
- Shipping and tax calculation integration into checkout flow
- File validation for uploads
- Admin credentials vault with encrypted storage and access control
- Inventory admin system with full management UI
- Refund API endpoint with inventory restoration on refunds

### Changed
- Sourcery suggestions integrated: params type improvements, encryption key validation, CSV case-sensitivity

### Fixed
- Inventory restoration on refunds optimized
- Critical bugs in API route handlers: payment double-charging, 403 status codes, cart inventory, params await, rate limiting, enum validation, error leakage

---

## [1.3.0] — 2026-01-03 — Analytics & Intelligence

### Added
- Discount code system with coupon and promo code support (`lib/discounts.ts`)
- AI-powered product recommendations engine (`lib/recommendations.ts`)
- Loyalty rewards program with points and rewards system (`lib/loyalty.ts`)
- Abandoned cart recovery with automated email sequences
- Email template block composition system
- Checkout API with authentication, audit logging, and tests
- Fundraiser signups API route with auth and auditing
- Forms API enhanced with audit logging and comprehensive tests

### Fixed
- Cart tracking now works without requiring guest email initially
- 401 Unauthorized errors fixed by normalizing email consistently
- EmailTemplateComposition model reverted to fix broken DB connection

---

## [1.2.0] — 2025-12-27 — Tax, Analytics & Inventory

### Added
- Real-time tax calculation using Stripe Tax API (`lib/tax-calculator.ts`)
- AI Chat API route with authentication, validation, and audit logging
- Amplitude analytics integration for behavior tracking and session replay
- Real-time inventory management system (`lib/inventory-manager.ts`)

---

## [1.1.0] — 2025-11-25 — Business Tools & Email

### Added
- 12 new branded business form templates with logo letterhead
- Fundraiser order tally sheet for campaign tracking
- Complete email template system with mass mailing capabilities
- Interactive location map with Google Maps and Street View
- Email campaigns system with analytics settings and engagement features

### Fixed
- Admin panel navigation fixed by seeding permissions tables
- Nodemailer import removed from client component to fix Vercel build

---

## [1.0.0] — 2025-11-06 — Production Launch

### Added
- **Storefront** — Full product catalog with heat-level filtering, search, and side-by-side comparison
- **Shopping Cart** — Cart sidebar with add, remove, and update quantities
- **Checkout** — Multi-step checkout with Stripe PaymentIntents, 3D Secure, Apple Pay, Google Pay
- **Gift Certificates** — Purchase, balance check, admin management, and custom themes
- **Authentication** — NextAuth.js with credential sign-in/sign-up and password reset with email verification
- **Account Management** — User dashboard, order history, saved addresses, and profile settings
- **Admin Panel** — Comprehensive dashboard: products, orders, customers, settings CRUD (Phases 1-4)
- **Recipe System** — 16 database-backed recipes with detail pages
- **Store Locator** — 77+ retail locations loaded from database with Google Places photo fetching
- **Location Detail Pages** — Individual pages for each retail location
- **RBAC System** — 5 user roles, 28 granular permissions with admin seeding script
- **Email System** — Transactional emails via Resend with branded templates
- **Google Analytics** — Tag integration (G-HG4QV5GFKH) for behavior tracking
- **Google Reviews** — Homepage section displaying random customer reviews
- **Dark Mode** — Site-wide dark mode support across all pages
- **OpenGraph Metadata** — Centralized OG images for social sharing
- **Vercel Analytics** — Performance monitoring integration
- **WordPress Bot Protection** — Middleware to block probe bots
- **Product Import** — CSV support with SKU tracking and restoration tools
- **i18n Foundation** — Intl.DisplayNames for region formatting
- **Admin Locations** — Location management panel with Google Places photo fetching
- **Stripe Webhooks** — Production webhook endpoint for payment processing
- **Prisma Accelerate** — Production database optimization layer

### Changed
- Migrated from static data to PostgreSQL-backed API for salsas and products
- Production-ready infrastructure and deployment configuration on Vercel
- Site URL configured to josemadrid.net

### Fixed
- Product image loading errors with missing images and enhanced error handling
- Prisma initialization for deployment environments
- NextAuth session endpoint CLIENT_FETCH_ERROR resolved
- Database schema sync with missing tables added
- Auth 401 errors resolved by optimizing SessionProvider and adding error handling

---

## [0.2.0] — 2025-10-30 — Core E-Commerce

### Added
- Stripe checkout flow with PaymentIntents
- Credential sign-up and sign-in flows
- Resend dependency for email functionality
- Recipe model with 16 recipes and API endpoint
- Google Calendar integration for "On the Move" page
- GitHub Actions workflow for Next.js deployment

### Changed
- Salsas page updated to fetch products from PostgreSQL API

### Fixed
- Stripe initialization guarded for build environments
- Auth pages wrapped in Suspense for router hooks

---

## [0.1.0] — 2025-10-10 — Foundation

### Added
- Next.js 15 project setup with TypeScript and Tailwind CSS
- Comprehensive database schema with Prisma ORM (PostgreSQL)
- UI design system with modern components (Radix UI + Shadcn)
- Product catalog with salsas, products, and recipes pages
- Cart sidebar with shopping cart functionality
- NextAuth SessionProvider configuration

### Fixed
- Package.json structure corrected for basic Next.js setup
- Tailwind CSS configuration fixed for successful build
- Cart-sidebar import errors resolved
