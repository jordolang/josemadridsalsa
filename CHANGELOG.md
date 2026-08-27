# Changelog

All notable changes to the Jose Madrid Salsa e-commerce platform are documented in this file.

This project follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format and its
own version scheme: `MAJOR.MINOR` with an optional letter, where a large feature bumps the minor
(`2.0` → `2.1`) and everything smaller takes a letter (`2.1` → `2.1a`). See
[Versioning](https://josemadrid.net/docs/guides/versioning) for the full rule and the release
command. `package.json` carries the derived SemVer form so npm stays happy; `projectVersion` in
the root `package.json` is canonical.

---

## [Unreleased]

### Removed
- **The Shopify integration, in full.** The Shopify store this synced to has been shut down and
  the platform is not migrating to or from it, but the dead integration was still wired into all
  three order-creating paths — `queueShopifySync()` fired on every checkout, every direct order,
  and every gift-certificate purchase.

  Gone: `app/api/shopify/` (order sync and cancel), `app/api/webhooks/shopify/`, `lib/shopify/`
  (client, sync, webhook), the `shopify:test-webhook` script, the `orders:sync-shopify`
  permission, the "View in Shopify" button on the admin order page, the MSW Admin-API mocks, and
  both docs-site integration pages. Migration `20260826230000_remove_shopify_integration` drops
  the six `orders.shopify*` columns and their unique index, and rebuilds `ShippingProviderType`
  without its `SHOPIFY` value. No order ever synced successfully, so those columns held nothing
  but the failure strings the dead integration wrote.

  `deriveSalesChannel()` no longer infers `MARKETPLACE` from a Shopify order id. The channel is
  still there and still reachable — a marketplace sale is now entered with an explicit channel
  rather than derived from a sync that no longer runs.

  `scripts/test-production-webhook.sh` went with it. It carried a hardcoded Shopify webhook
  secret, which is in the git history and should be treated as burned regardless of the store
  being dead.

### Added
- **Contact form in the Picante chat.** The chat's opening message now carries an
  "Or fill out a contact form by clicking here" button beneath it, for visitors who would rather
  leave their details than have a conversation. It swaps the panel to a standard contact form —
  Full Name, Email Address, Company name, Phone number, and Comments / questions — and posts to
  the existing `POST /api/send-email/contact` endpoint, so the submission is rate limited, stored
  as a `Conversation`, and emailed to mike@josemadridsalsa.com with the sender's address as
  reply-to.

  The contact notification email was rebuilt to match the layout of the legacy BigCommerce store's
  contact email that the office already works from: logo, "Contact form submission" heading, a
  labelled **Details** block, the comment body, and an "Open store" button, with the subject line
  `<email> submitted the form from your <page> page`. The route accepts two new optional fields,
  `company` and `sourcePage` (the latter naming the page in the subject), and the shared template
  is also used by the public `/contact` page and the developer contact form.

  The notification is an internal alert to the business inbox rather than a subscriber email, so
  it carries no footer unsubscribe link; the `List-Unsubscribe` header the email client applies is
  unchanged, and the template suites now mark it explicitly as not subscriber-facing.
- **Native macOS administration app.** An ARM64 SwiftUI shell now opens the complete,
  permission-aware production admin panel with persistent WebKit sign-in, connection state,
  native navigation controls, and shortcuts for Command Center, Operations, and Growth & Field.
- **Product bundles — sell a fixed set of products together at one set price.** A bundle (e.g. a "Gift Set" of three salsas) is defined in **Admin → Products → Bundles** with a price and a list of component products and quantities, and shown on the storefront at `/bundles/[slug]` with an Add-to-Cart button and the saving versus buying separately. Distinct from a Collection (a marketing grouping at each product's own price), a bundle carries its own price.

  The pricing is enforced **server-side and anti-tamper**: the browser only ever sends `{ bundleId, quantity }`; the three online checkout routes load the bundle, expand it into component order lines, and split the bundle price across them in integer cents (largest-remainder, weighted by each product's catalogue value) so the line totals sum back to the bundle price to the cent — the same posture as the fundraiser price overrides. A component whose cents don't divide evenly by its quantity is emitted as two lines so that every line satisfies `unitPrice × quantity === totalPrice` exactly, keeping refund/return math (which multiplies `unitPrice × quantity`) penny-accurate. Because a bundle becomes **real component order lines**, inventory reservation, tax, margin (`unitCost` snapshot), fulfilment and returns all work per-product with no special cases, and each line is tagged with `bundleId`/`bundleName` for reporting. A product that appears on more than one line (bought standalone *and* as a bundle component, or in two bundles) has its reservation and its completion deduction aggregated per product, so no reserved stock is stranded. A missing, inactive, empty, or unavailable-component bundle fails checkout cleanly (400) rather than charging a wrong or partial bundle.

  The proration and slug/row helpers live in `lib/bundles.ts` (pure, fully tested); `lib/bundles.server.ts` resolves selections into order lines, reservations, and a subtotal. Models `Bundle` + `BundleProduct` mirror `Collection`/`CollectionProduct` (migration `20260822120000_add_product_bundles`, additive; `OrderItem` gains nullable `bundleId`/`bundleName`). Admin is gated on the existing `products:read`/`products:write` — no new permission seed. Active bundles are added to the sitemap.

- **The jar labels are now product photos.** `npm run images:labels` uploads the flat label scans in
  `public/images/unused/new-products/labels` to Blob as WebP and appends each one to its product's
  gallery, so the label sits beside the jar shot instead of only existing in the repo. It is
  `images:sync` in a label-specific mode: the blob prefix is `products/labels/`, a label is always
  appended and never becomes the main product photo, and filenames get one extra chance to reach
  their product through `lib/images/label-aliases.ts` — the scans were named from the jar artwork,
  before the catalogue slugs settled. Dry run by default, as with every other image command.

  Filename matching also now ignores a trailing `salsa`, which the catalogue applies inconsistently
  (`mango-mild-salsa` and `spanish-verde-mild` are both salsas), so a photo named after the flavour
  finds its product. A relaxed match that fits two products still links nothing.

- **Configurable flat-rate shipping presets.** The rates the estimate/fallback path quotes — when a live carrier rate isn't available (no API key, an unset warehouse origin, a PO Box with no USPS rate, or a carrier outage) — were hardcoded constants in the calculator. They are now editable under **Settings → Shipping → Flat-rate presets**: the base flat rate, the heavy-order surcharge (threshold weight, base, and per-pound amount), the flat international rate, and the per-state multipliers for remote destinations (Alaska, Hawaii, Puerto Rico). Live EasyPost rates, when available, are still used ahead of these and are unaffected.

  The values live on the `ShippingSettings` singleton as whole cents (migration `20260821140000_add_shipping_rate_presets`, additive nullable columns) and are read at quote time by `lib/shipping/rate-config.ts`, which merges the stored row over the built-in defaults — so any field left blank falls back to exactly the number the calculator used before, and an unconfigured store's quotes don't change. The resolver never throws: a database problem falls through to the defaults so a quote is always available, the same posture as the origin resolver. The rate math and config resolution are pure and fully tested, and the move was verified to leave every existing shipping quote byte-for-byte identical (the calculator's `toFixed` rounding is preserved). Shipping is still charged on every order — there is no free-shipping path. The rate-preset form writes only its own columns, so saving presets leaves the origin and carrier settings untouched.
- **Two-way Google Calendar sync, so the "Where is Jose?" flag finally reaches customers.**
  `/where-is-jose` renders the Google Calendar feed, not the database, so flagging an event in
  the admin changed nothing a visitor saw. Pushing to the calendar is the publish step, and it
  now happens: flagged events go up, shows added on the calendar come back down as flagged
  events, and unflagging one takes it off the public calendar again.

  Only flagged events are ever pushed. `FeaturedEvent` also holds the booking pipeline — shows
  applied to, waitlisted, or declined, with their booth fees — and the target calendar is
  public, so pushing everything would publish all of it. In the other direction Google can
  never delete a local record: an event owns its staff, contacts, manifest and show
  financials, so a removal on the calendar unlinks the pair and leaves the record standing.

  When an event changed in both places since the last sync, the connection's conflict policy
  decides — the website wins, Google wins, or (the default) neither is touched and the event
  is listed in the admin card with "Keep this site's" / "Keep Google's". Connect, sync,
  policy, conflicts and disconnect all live in the Google Calendar card on Admin → Events,
  which replaces the old status-only panel. Setup is documented under Integrations → Google
  Calendar Two-Way Sync; it needs the `calendar.events` scope added in Google Cloud.

- **A week-by-week calendar inside the Events tab's "Where is Jose?" card.** The tab already listed
  the flagged events and there was a month grid on a separate page, but nothing let you look at a
  single week and work in it. The card now opens on the current week: flagged events render solid,
  every other booked show renders dimmed beside them so an empty-looking week is distinguishable
  from a week with shows nobody has promoted yet, and application deadlines sit on the day they
  fall. Weeks page backwards and forwards without limit — arrows, five week buttons for longer
  jumps, "This week", and a date picker — and the list of flagged events stays below the grid.

  Clicking a day opens a panel for it: the day's events with their status, time and location; edit,
  manifest and financials links; a one-click toggle to promote or demote a show from "Where is
  Jose?"; and an add-event button that prefills the date and the flag. Each event can be shared —
  details and link to the clipboard, a single-event `.ics`, a social post draft, or an email
  campaign started from the Event Invitation template. The whole week exports as `.ics` or as the
  20-column Show-import CSV, and every "Where is Jose?" event exports as one `.ics` covering all
  dates.
- **The FAQ page is reachable from the main navigation.** `/faq` already rendered the questions and
  categories managed in Content → FAQs, and it was already in the sitemap, but nothing on the site
  linked to it — a visitor could only arrive by typing the URL. It now sits under About in the
  header, on desktop and mobile.
- **Picante AI chat launcher.** The storefront's floating chat pill is replaced by the animated
  José Madrid Salsa pepper mascot. Picante walks within a bounded bottom-right track, opens the
  existing AI/live-handoff panel when clicked or keyboard-activated, idles while chat is open, and
  remains stationary when the visitor requests reduced motion. Picante now introduces himself and
  answers with a bounded pepper-penguin personality that keeps support accuracy ahead of wordplay.

- **Community polls (`/polls`), built and controlled from Content → Polls.** A poll is a small,
  self-contained way to ask visitors a question, and it needed to live where a curious visitor finds
  it rather than where the shop's navigation competes for attention: the polls hub is linked from the
  footer of every page and deliberately absent from the top menu.

  Visitors answer without an account. Each question renders as pill-shaped controls with a real
  radio or checkbox underneath, sized for a finger at 48px, so the same markup serves a tap, a click
  and a keyboard. Questions come in five styles — pick one, pick as many as apply, a short answer, a
  long comment capped at 1500 characters, and a rating scale — and any of them can carry its own
  image and an optional "something else" box.

  Only a first name is required, and only in the sense that the field cannot be blank: no length
  rule, with the placeholder text saying a last name is welcome but optional. Above the name fields
  every poll carries the participation advisory — answers are appreciated, and may be used
  promotionally or internally where people who do not share the respondent's views will see them —
  next to a prominent button asking us to keep them anonymous if we quote them. That request is
  stored on the response and honoured everywhere a name is rendered, including the admin's own
  export, so whoever writes the copy sees it rather than having to remember it.

  Admins get the whole surface: create and edit polls, upload or pick images for the poll, each
  question and each option, reorder questions, set selection bounds, choose an accent colour, decide
  whether results show always, after voting, or never, and set open/close times. Visibility is either
  public — listed on `/polls` and in the sitemap — or invite only, which is unlisted, `noindex`, and
  reachable only through a share link carrying the poll's access code. Editing a live poll keeps
  question and option ids, so answers already collected stay attached to what they answered.

  The public endpoint is rate limited to 5 submissions per IP per 10 minutes, carries a honeypot, and
  by default accepts one response per device. IP addresses are stored only as a salted SHA-256 hash,
  for that check alone.

- **Image hosting on Vercel Blob, with WebP conversion (`images:sync`, `images:migrate`).** Images do
  not belong in git — the repo already carries 201 MB across 152 committed files, and history is
  permanent, so deleting them later reclaims nothing. Two commands move image hosting off the repo.

  `images:sync` uploads from a folder outside the repo (`~/Desktop/jms-images` by default) and
  optionally attaches each image to its product, matching the filename against slug, then SKU, then
  product name. An ambiguous name match links nothing and says so — attaching a photo to the wrong
  product is worse than not attaching it. `images:migrate` moves the existing `public/images` tree
  and repoints all ~179 references, in both the root-relative and absolute forms the codebase uses,
  across code, `Product.featuredImage`, `Product.images` and `BlogPost.coverImage`.

  Conversion to WebP at quality 82 is the default and measured a **93% reduction** on real product
  photos (3.36 MB → 0.25 MB across three images). Three categories are deliberately exempt: Open
  Graph images, because WebP support across social crawlers is inconsistent and a WebP OG image
  renders as a blank card on several of them; animated GIFs, which would silently lose their
  animation; and files already `.webp`/`.avif`.

  Both commands are dry-run by default — they write to a live store and a live database, so nothing
  happens without `--apply`. Both are content-hash keyed, so re-running is free and cannot duplicate.
  Uploads use `addRandomSuffix: false`, so a replaced image keeps its URL and every listing pointing
  at it updates at once with no deploy. `images:migrate` never deletes a local file: keeping them
  means a missed reference degrades to the old image rather than a 404.

  Also documents `BLOB_READ_WRITE_TOKEN`, previously undocumented despite gating every upload path
  in the app.

- **Data & Charts (`/admin/data`)** — a self-serve report builder over the business's own data. An
  admin picks a data source, measures, a breakdown, a time grain and filters, and reads the result as
  a chart or a spreadsheet. A typed registry (`lib/data-studio/`) describes what can be asked and the
  UI is generated from it, so a new question needs no new route and no SQL console exists to secure.
  Four datasets ship: the bookkeeping ledger, the attested revenue anchors, fundraiser history from
  the archive (2011 onwards, measured in jars) and the mileage log.

  Three decisions are load-bearing rather than incidental:

  - **Per-dataset permissions.** `data:read` opens the section; each dataset additionally requires its
    domain permission, re-checked server-side on every run and export. A single blanket permission
    would have been a privilege escalation — `STAFF` holds `analytics:read` but deliberately not
    `financials:read`, and a generic query layer gated only on its own permission would have handed
    them the ledger anyway.
  - **`null` means *not recorded*, never zero.** Aggregation happens in TypeScript, not via `_sum`,
    because SQL would have to drop rows with a missing value (losing their revenue) or coalesce it to
    zero (reporting unknown cost as pure profit). Unknown counts are reported beside every total and
    blanks render as an em dash. Truncating a scan withholds the totals outright instead of showing a
    partial sum as final.
  - **Buckets are cut in `America/New_York`.** Vercel runs `TZ=UTC`, so a sale at 8pm ET on 31
    December would otherwise bucket into the next tax year. `grain.ts` reuses the DST-safe primitives
    already in `lib/timeclock.ts`, and every report and export states its timezone.

  Bases are compared, never summed: a spec names exactly one dataset, so a total that mixes ledger
  rows with filed-return figures is unexpressible rather than merely discouraged.

- Converted the platform to a Turborepo with independent storefront, fundraising, backend, and iOS application workspaces.

### Changed
- **The salsa detail gallery shows a photo whole rather than cropping it to a square.** The main
  image and its thumbnails used `object-cover`, which is fine for a jar shot and useless for a
  label: the scans are roughly 2.4:1, so the ingredient panel fell outside the frame entirely. Both
  now use `object-contain`, matching `components/products/ImageGallery`.

- **The image migration now keeps the original alongside the WebP, and blog covers point at it.**
  Conversion used to replace: `salsa-bowl.png` became `salsa-bowl.webp` and the PNG existed only in
  git history. Anything that cannot read WebP therefore had no URL to fall back to — which is not
  hypothetical, because a blog cover is the article's `og:image` and the photo a Google Business
  cross-post attaches, and Google accepts only JPEG or PNG. Migrating the covers had quietly made
  six of nineteen posts ineligible for a Google Business photo.

  `planFile` now records `originalBlobPathname` beside `blobPathname`, the upload stage puts both,
  and `buildRewriteMap` takes a variant so a consumer can ask for either. Code and product images
  resolve to the WebP as before; `BlogPost.coverImage` resolves to the original. The page loses
  nothing by that, because covers render through `next/image`, which re-encodes on the fly. The
  trade is storage: 233 images are now held in both formats rather than one.

  Preserving originals also made a latent bug certain, so it is fixed here. `rewriteText` matched a
  reference anywhere it appeared, and a migrated URL ends with the very key that produced it — so a
  second pass re-prefixed its own output into `.../sitehttps://.../site/images/...`. That had
  already reached the repository. Matching now requires a leading delimiter, which makes the rewrite
  idempotent; a full dry run over the migrated tree reports zero changes. A path inside a template
  literal (`${SITE_URL}/images/x.png`) is reported for review rather than rewritten, since replacing
  only the path strands the variable in front of an absolute URL — the second way that same bug
  reached the repository.

- **CI now runs the shipping E2E suite instead of silently skipping it.** The five files under
  `tests/e2e` that exercise `/api/checkout/calculate-shipping` are gated on `E2E_BASE_URL`, which
  was set nowhere — not in CI, not in any script — so all 45 of their assertions had never executed;
  the Playwright step could not cover them either, since its `testMatch` is `**/*.spec.ts` while
  these files end in `.test.ts`. CI now seeds the catalogue after the unit and integration suite has
  finished with the empty database, starts the built storefront, and runs those files as a gating
  step. Both shipping fixes below were found by turning them on.
- **The database-backed tests now opt in explicitly instead of keying off `DATABASE_URL`.** Their
  gate was meant to mean "an isolated database is available", but `@prisma/client` loads
  `apps/storefront/.env` itself, so `DATABASE_URL` is set on every developer machine — and the four
  files that create, mutate and delete rows were quietly running against shared dev. There they both
  failed (their assertions assume they own the data: one counted two alert emails and got twelve,
  because dev has six admins) and wrote to rows other people rely on, including deleting the CMS
  `home` page. They now run only when `RUN_INTEGRATION_TESTS` is set, which CI sets against its
  throwaway Postgres. Local `npm run test` is green again with no loss of CI coverage.

### Fixed
- **The QuickBooks account mapping silently erased itself.** When the settings page could not
  reach QuickBooks — an expired token, a network blip — it caught the error, logged it in a
  banner, and then rendered every account picker with nothing in it but "Not mapped". A mapping
  that was safely in the database looked gone, and pressing Save wrote those blanks over it, so
  re-entering the mapping appeared to never stick. The page now hides both Save buttons while the
  account list is unavailable and says why, and each save action re-reads the catalog and refuses
  to write rather than store a form it knows is empty.

  Two smaller causes of the same silence went with it. A stored account id that QuickBooks no
  longer offers — deactivated, deleted, or filtered out of that field by type — now gets an option
  of its own instead of the select falling back to "Not mapped" and discarding it on the next
  save. And the pickers show each account's qualified `Parent:Child` path rather than its leaf
  name: this company's chart of accounts holds three separate accounts all named "Refunds &
  discounts to customers", which were previously impossible to tell apart. The stored account
  names, which the ledger's journal file is imported into QuickBooks by, are now qualified too.
- **The two remaining reads that loaded a whole mailing list in one shot.** A list built from the
  customer database holds around 22,000 contacts, and both of these fetched every one of them with
  every column — `customFields` included, the JSON blob where the importer parks each unmapped
  column of the source CSV.

  Creating a campaign against a mailing list is the worse of the two, because it runs inside a
  server action: `createCampaign` loaded the entire list into an in-memory `recipientsList` and
  then wrote it back as a single nested `create`. It now counts the list, creates the campaign row
  on its own, and pages through the subscribers a thousand at a time, writing each batch out as
  `EmailRecipient` rows before reading the next — so neither the list nor the insert is ever fully
  resident. `customFields` is fetched only when a variable mapping actually reads one. Splitting
  the recipients off the campaign row gave up the nested write's atomicity, so a failed batch — or
  one that materialises nobody because the list emptied mid-run — now deletes the campaign rather
  than leaving a recipient-less draft that looks like a success, and `totalRecipients` is corrected
  if someone unsubscribes between the count and the read. A create killed part-way by a timeout or
  a deployment leaves no in-process handler to undo it, so **launching** a campaign now refuses a
  draft holding fewer recipients than it advertises instead of quietly sending to a partial
  audience and reporting a complete run.

  The subscriber CSV export (`GET /api/admin/mailing-lists/[id]/export`) built one CSV string in
  memory from the same unbounded read — several megabytes held twice over against Vercel's
  response cap, with no `maxDuration`. It now streams: the header goes out first, then each page of
  subscribers is unparsed and written straight into the response body, with only the columns the
  file actually contains selected. Export order moves from oldest-first to email order, which is
  what lets the read page forward — a CSV import stamps thousands of rows with the same
  `createdAt`, so paging on it would repeat or skip rows. Both reads page on an `email > last`
  predicate rather than a Prisma `cursor`: a cursor has to locate the boundary row, so an admin
  removing that subscriber between pages would end the read early and hand back a truncated export,
  or a campaign missing everyone past that point. An empty list now downloads a header-only file
  instead of an empty one.
- **The mobile "Live chats" tab covered the admin controls underneath it.** On a phone the tab is
  pinned to the right edge at mid-height, where it sat on top of the edit and delete buttons in
  Admin → Reusable sections (and any other right-aligned action at that height). It can now be
  dragged: press and move it to slide it anywhere along the edge, or across the screen's midpoint
  to switch it to the left edge. The chosen spot is saved per device in `localStorage`, the pulse
  animation pauses while dragging, and a drag no longer opens the queue panel on release. Tap
  behaviour and the desktop pill are unchanged.
- **Every product's gallery showed the same jar photo two or three times.** Two separate causes,
  both fixed. In the data, 26 of the 28 products carried a second copy of their front-of-jar
  studio shot: the same photograph re-uploaded to `products/` alongside the `featuredImage` it
  duplicates (Clovis Medium carried two). The copies are re-encodes, sometimes at a different
  resolution or with the background knocked out to transparency, so they are byte-different and
  URL-different — nothing comparing strings could have caught them. They were found by comparing
  decoded pixels, and removed from `Product.images` (155 entries down to 128) after each was
  confirmed visually; near-misses that are genuinely different photographs of the same jar —
  Pineapple Mild's second angle, Strawberry Mild's older label — were kept. The 27 orphaned
  files were then deleted from Blob storage (128 objects under `products/` down to 101), after
  confirming nothing else in either database or the repo referenced them.

  In the code, the product page built its gallery as `[featuredImage, ...images]` while `images`
  already leads with `featuredImage`, so the featured photo was rendered twice on every product
  regardless of the data. The list is now deduplicated.

- **Attribution and collections follow-ups from post-merge review.**
  - *A crafted UTM value could break checkout.* A `?utm_source=%00…` link put a NUL byte into the attribution cookie; PostgreSQL rejects `0x00` in a text column, so `order.create` threw and every Stripe checkout carrying that cookie failed until it expired. Attribution fields now strip control characters (NUL and the rest of the C0 range plus DEL) in one `sanitizeField` helper, applied both when the cookie is written and when it is read back for the order.
  - *PayPal/Venmo and Square/Cash App orders lost their attribution.* The first-touch cookie was only read in the Stripe checkout route, so orders paid through the other providers were recorded as Direct/none despite carrying it. All three online checkout routes now read and persist attribution identically.
  - *Attribution ignored the cookie-consent choice.* The marketing cookie was written on landing regardless of consent. It is now written only after the visitor accepts, and an existing cookie is cleared if they reject — driven by the banner's existing `cookie-consent-change` event.
  - *Collections admin fixes.* The admin list is typed against the real `Collection` shape instead of `any[]`; it pages through all collections rather than silently showing only the first 100; the collection slug is validated as a single URL-safe segment in both API routes (a value like `gift/sets` would have left the storefront page unreachable); and the changelog now names the actual `products:read`/`products:write` permissions the API enforces.

- **Search-result metadata on `/laperla` and `/live` fell outside the documented limits.** The
  La Perla page's title ran 67 characters and its description 223, so Google truncated the
  description partway through "the stone-ground white corn" — cutting off the Jose Madrid Salsa
  connection that is the page's reason for existing. The `/live` title ran only 24 characters.
  Both now sit inside the 30–60 title / 160-character description range; La Perla's street address
  moves out of the description and stays available in the page's structured data.
- **`/live` built its metadata by hand instead of through `createMetadata`.** It was the only one
  of these public pages declaring a bare `Metadata` object, so it shipped without the OpenGraph and
  Twitter card tags its siblings get and fell back to the default share image with no card markup.
  It now goes through the shared helper like the rest of the `(public)` routes.

- **Dark mode rendered several sections as light text on a light background.** The `verde` and
  `chile` colour scales in `apps/storefront/tailwind.config.ts` stopped at `900`, so every
  `dark:*-verde-950` / `dark:*-chile-950` utility referenced a shade that did not exist and Tailwind
  emitted no rule for it at all. The affected blocks kept their light `-50` background in dark mode
  while the CSS-variable text colours (`text-foreground`, `text-muted-foreground`) correctly flipped
  to near-white — most visibly the homepage "Fundraise With Jose!" fundraising promo, whose body
  copy was effectively invisible. Both scales now define `950` (`#052e16` and `#451a03`), which
  restores the intended dark backgrounds for the promo, the gift-box quick add, the location map
  fade, and the developer console's stats, changelog, timeline, and skills panels.
- **`npm run db:migrate` could not run at all: the shadow database failed on
  `20260810040000_drop_email_webhooks`.** The `email_webhooks` table was created by `db push` and
  never by a migration, so it is absent from any database built by replaying the migration history
  — the shadow database Prisma creates for `migrate dev`, a fresh clone, or a rebuilt production.
  The migration counted and dropped it unconditionally, so the replay died with P3006/P1014 and
  every migration after it was unreachable. It now checks `to_regclass` first and no-ops when the
  table is already absent, the same two-guard shape the later `drop_email_segments` and
  `drop_product_variants` migrations use; the refuse-if-non-empty guard is unchanged.
- **A PO Box order placed after a street-address order to the same ZIP was quoted a carrier that
  cannot deliver to it.** `/api/checkout/calculate-shipping` caches quotes for five minutes, but its
  cache key was built from the cart plus city, state and ZIP only — the street lines and the country
  were left out. The calculator does detect a PO Box and restrict it to USPS, and it does price
  non-US destinations on the international rate; the cache simply served the first answer for a ZIP
  to every later address in it. So a PO Box shipment that followed an ordinary one to the same ZIP
  came back as "Standard Shipping", and a foreign address could be handed a domestic quote. The key
  now includes `address1`, `address2` and `country`.
- **International shipping rejected any postal code shorter than five characters.** The request
  schema applied the US five-digit ZIP floor to every country, so Australia's four-digit postcodes —
  and every other shorter format — returned HTTP 422 even though the calculator has a published
  international rate for them. The five-character rule now applies only when `country` is `US`.
- **Blog posts now share their own cover image, not a generated red card.** The Heat Index route
  carried a file-based `opengraph-image.tsx` that rendered a title-on-red-gradient card and ignored
  the post's cover image entirely — it even read `coverImage` from the database and then never drew
  it. Next.js only applies a file-based Open Graph image when the page's own metadata has no
  `openGraph.images` key at all, and `generateMetadata` set that key *conditionally*, so any post
  without a cover image silently fell through to the red card. Because a blog cross-post publishes a
  link and lets the network scrape the page for its preview, that card is what Facebook and X
  cached. `og:image` and `twitter:image` are now always set — the cover image when present, a
  branded default otherwise — and the generated card has been removed.
- **Google Business cross-posts now carry the article's cover photo.** `crosspostBlogPost` built a
  `SocialMediaPost` with text, link and hashtags but never created the `SocialMediaPostMedia` rows
  the publisher reads, so `mediaUrls` was always empty and `publishToGoogleMyBusiness` — which only
  sets `body.media` when it has one — published a summary with no image. The cover image is now
  recorded as a `Media` row and linked to the cross-post, reusing an existing row for the same URL
  and unlinking a superseded cover. Google Business accepts only JPEG and PNG and caps a post photo
  at 5 MB, so a cover that fails either bound (a WebP, after the blob migration) is deliberately left
  unattached and logged rather than sent to fail the whole post. Facebook is unaffected: it still
  posts the article as a link card.

- **Corrected three doubled image URLs from the Vercel Blob migration.** A find/replace produced
  `.../sitehttps://.../site/images/opengraph/josemadridhome.png` in the site-wide Open Graph and
  Twitter image, and `${SITE_URL}https://...` in the Heat Index JSON-LD publisher logo. All three
  would have 404'd on deploy, taking out the default share image for every page that does not set
  its own.

- **Analytics report review follow-ups** — small correctness and clarity fixes to the two new analytics reports after review. The turnover report's *inventory-at-cost* caveat is now decided on the exact coverage ratio rather than a rounded percent, so 99.6%-covered no longer rounds to 100% and hides the "some stock is uncosted" warning; and the slow-mover ranking compares stock value only when both products have a known cost, falling back to units on hand otherwise, so a large pile of uncosted dead stock is no longer sorted beneath a single cheap costed jar (a missing cost is not "worth zero"). The retention grid's cohort math floors its observable-offset count at zero, so a future-dated `now` degrades to an unobservable column instead of a negative array length; a dead rectangular-padding branch was removed; and the cohort report no longer accepts a caller-supplied `now` that could disagree with the query window. All covered by new regression tests.

### Added
- **Store settings** — a new **Settings → Store** screen (`/admin/settings/store`, gated on the existing `settings:read`/`settings:write` permissions) that turns four things that were hardcoded or env-only into admin-editable controls, each wired to real behaviour rather than being dead configuration:
  - **Checkout controls** — a *guest-checkout* toggle (when off, the three online checkout routes — card, PayPal, Square — reject a signed-out shopper with a sign-in prompt) and a *minimum order amount* (the same routes reject an order whose goods subtotal is under the threshold, assessed before discounts and shipping so a code cannot duck under it).
  - **Store identity** — business name, support email, support phone, and business address. The public contact page reads these first, falling back to the previous `NEXT_PUBLIC_*` env vars and then the built-in defaults, so nothing changes until a value is saved.
  - **Operational defaults** — the low-stock threshold new products inherit when the create form leaves it blank (previously a hardcoded `5`).
  - **Legal pages** — optional custom bodies for the Terms, Privacy, and Returns pages; a saved value replaces the built-in copy (rendered as plain text, never HTML), a blank field keeps the curated default.

  Settings live in a single-row `store_settings` table (migration `20260815140000_add_store_settings`, keyed by a `singleton` column exactly like `shipping_settings`), read through `lib/store-settings.ts` — a React-`cache`d accessor that merges the row over safe defaults and returns those defaults when the row or the whole table is absent, so every reader works before the first save and before the migration runs. The pure helpers (`isBelowMinimumOrder`, `formatMinimumOrder`) are fully tested; the save route validates with Zod and writes an audit entry. No new permission seed is required.

- **Form Capture — photograph a paper form and it becomes ledger entries.** Most of this company's revenue has never passed through a system: shows and farmers markets are settled on paper, and QuickBooks only ever sees invoiced customers — 29.8% of filed gross receipts in 2023, 27.0% in 2024. Rather than wait for the paper habit to change, the photo is now the input. A new `FormCapture`/`FormCaptureLine` pair records the image, an extraction pass reads it, and approval writes `LedgerEntry` rows with `source = FORM_CAPTURE`, which the existing `enqueueLedgerEntries` sweep already carries into QuickBooks — no new sync code.

  Six form types are modelled from the sheets actually in the document archive (show settlement, farmers market, fundraiser order, mileage log, expense receipt, and a catch-all), each with its own label → ledger-category rules in `lib/form-capture/form-specs.ts`.

  A form posts without asking anyone anything when every line was read at confidence ≥ 0.9 *and* the total printed on the page equals the sum of the income lines exactly. Everything else goes to a review queue, so a person only ever sees the forms whose arithmetic or handwriting could not be settled automatically.

  Double-counting is guarded three ways, because that is the specific failure the feature exists to end: `FormCapture.fileHash` is a unique SHA-256 of the bytes (the same photo cannot be captured twice, and a repeat returns `409` naming the original), `LedgerEntry.dedupeKey` is `capture:<lineId>` and unique, and `FormCaptureLine.ledgerEntryId` is unique. Separately, any row labelled "Total" is discarded during extraction — on these forms a total summarises the rows above it, so posting it alongside them would double the day's takings.

  Two decisions worth knowing: an unreadable figure is dropped rather than posted as zero (a silent zero looks like a day with no sales; the resulting gap sends the form to review instead), and the accounting date is the date written on the form, never the upload date — forms are routinely photographed weeks later, which is how the historical data drifted in the first place. Capture screen at `/admin/financials/capture`, gated on `financials:read`/`financials:write`.

- **Ledger reconciliation — how much of the business the ledger has actually captured.** The bookkeeping ledger can be internally perfect and still describe a fraction of the company: every row correct, every total consistent, and most of the year never written down. Nothing inside the ledger detects that, because the missing rows leave no trace.

  `lib/financials/anchors.ts` records the gross-receipts figure printed on each year's filed Schedule C or year-end P&L, recovered from the document archive, with its source file and an evidence grade. `lib/financials/reconciliation.ts` puts ledger income next to those figures and reports the gap; `/admin/financials/reconciliation` renders it, gated on `financials:read`.

  The anchors live in code rather than a table on purpose: fourteen immutable rows describing closed years, where being reviewable in a diff and un-editable by accident matter more than being queryable. A filed return does not change — if one is ever amended, that is a commit.

  Years with no company-wide document carry a `FLOOR` anchor built from the surviving channel records. A floor is a lower bound, not a target, so ledger income exceeding one reports as `ABOVE_FLOOR` rather than as a discrepancy, and floors are excluded from every aggregate ratio — otherwise the system's ambition would be quietly capped at whatever a spreadsheet happened to record in 2017.

  Starting point on measurement: **7.3%** of attested revenue captured across the seven fully documented years, 0 of 7 reconciled, $3,125,370 proven by paperwork and absent from the ledger.

- **`QUICKBOOKS_ENVIRONMENT` is now documented.** It has no admin-panel equivalent, defaults to `sandbox`, and decides which Intuit environment the Connect button reaches. Left unset in production the OAuth flow completes successfully against a sandbox company and syncs nothing real — a silent failure with no error to notice.

### Fixed
- **The admin search palette showed nothing, for any query** — `CommandDialog` never set `shouldFilter={false}`, so cmdk's client-side filter ran on top of the server's results and re-scored each row against its own `value`. Those values are ids (`order-clx123abc`), so typing "Maysville" scored every row at zero and unmounted the entire list, including the "See all results" action. The palette rendered an empty box while the API returned matches. This predates the archive work — item values have been ids since the search box shipped — and the code carried a comment asserting the opposite, which is why it survived review twice. The dialog now forwards `shouldFilter`, the palette turns filtering off, and a component test renders the palette and asserts a body-text hit whose title shares no characters with the query is still displayed.

- **A phone number typed without punctuation searched for a parcel** — `classifyQuery` tested the tracking shape before the phone shape, and a bare `7405550132` satisfies both. Ten digits were therefore classified as `tracking`, whose fan-out is orders alone, so searching a customer's phone number returned nothing. An all-digit query of exactly ten digits — or eleven behind a US country code — is now read as a phone number; carrier numbers are longer or carry letters, so nothing that is really a tracking number is caught by it.

- **Gift-certificate and purchase-order codes reached neither** — `JMS-GC-4821-9930` and `PO-20260808-1234` both satisfy the SKU pattern, and the SKU fan-out was products and orders, so pasting either record's primary identifier scanned the product table and found nothing. Both entities are now in the SKU-shaped fan-out.

- **Formatted phone columns were never matched** — phone predicates compared against the query with its separators stripped, but phone numbers are stored two ways: digits-only by the archive imports, formatted by everything typed into the admin. Searching `(740) 452-5080` looked for `7405520580` and missed the row that stored it exactly as typed. Both forms are now tried. A formatted column searched with unformatted input still cannot match without a normalized column to compare against, which is a schema change rather than a search change.

- **The document row cap was applied before anything was scored** — the archive provider issued one `OR` across filename, path and full text, ordered newest-first and capped at five. A recent document merely *mentioning* the query therefore displaced the document actually *named* after it, which is the opposite of what the ranking exists to do. Named matches and text mentions are now fetched as two parallel queries so the named ones always survive to the ranking step. Searching "Maysville" now returns `Maysville Key Club 10-24-23.xlsx` at a name score instead of burying it under bank statements from a later year. The second query costs nothing in wall-clock: the two run concurrently and the text scan was already the slower of them.

- **Two providers pointed at pages their own permission could not open** — training documents were gated on `ai:view-training` while `/admin/training-data` gates on `content:write`, so the staff who can open the page got no results from it; and event hits linked to `/admin/events/[id]/edit`, which requires `events:write`, so a read-only operator selecting an event was bounced to `/admin`. Each provider is now gated on the permission its destination actually requires, and event hits open the `events:read` manifest view.

- **A ledger hit opened a ledger that did not contain it** — the ledger loads its newest hundred entries and starts with an empty text filter, so selecting an older matched entry landed on a list the row was not in, with nothing to say where it had gone. The query now travels in `?q=` and seeds the filter.

- **Campaigns matched on their preview text gave no sign of it** — `previewText` and `fromEmail` were searched but not selected, so a campaign found through either scored as though its name had matched and displayed no excerpt. Both fields are now carried through to the scoring step.

- **A blank query excerpted the opening line of every document** — an empty string is found at index 0 of any text, so `extractExcerpt` treated it as a body match. `runGlobalSearch` never passes one, but the helper now refuses it for the same reason `scoreTextMatch` does.

- **The full-results page could crash on a repeated query parameter, and mis-signalled truncation** — `?q=a&q=b` arrives as an array, and `.trim()` threw before the page rendered; the last value is now used. Its per-section "+" also compared group sizes against the per-section cap after a global cap had already trimmed them, so a truncated section could report a smaller number and no "+". The global cap is now derived from the per-section cap and the provider count, so it can never bind first. The search input also gained an accessible name.

- **Chunking the invite send could mail one coordinator twice** — `FundraiserContact.email` is deliberately not unique, because a parent can run two groups. The send path collapsed duplicate addresses per request, which was correct while a send was one request; once large selections were split into 200-contact chunks, two rows sharing an address in *different* chunks each got a fresh dedup set, and both were mailed.

  The fix is structural rather than a wider dedup set: eligibility now resolves exactly once, in `resolveRecipients()`, over the entire selection. A new `POST /api/admin/fundraiser-contacts/solicit/preview` answers for the whole list in one request — it sends nothing, so it is three set-based queries rather than a rate-limited loop — and returns the deduplicated, eligible ids. The dialog then mails *only those ids*, chunked. Duplicates are impossible by construction, because no chunk ever resolves anything.

  Suppression moved to batch lookups in the same change: a 2,000-contact selection was costing 4,000 sequential round trips before the first email went out.

- **A failed chunk could re-mail everyone who had already received the invitation** — a non-2xx response mid-send returned the dialog to its confirmation screen with the acknowledgement still ticked and Send still enabled. Pressing it started again at the first batch. The partial-failure state is now terminal: it reports how many invitations went out, how many did not, and tells the operator to re-select the uninvited rather than resending the batch.

- **Two stale-response races could act on rows the operator had already dismissed** — the invite preflight shared one cancellation ref across effect runs, so a new selection reset the flag and let a superseded request overwrite the newer recipient count; and clearing the selection while "Select all N" was still resolving was silently undone when the response landed. Cancellation is now local to each effect run, and the id request carries a selection generation that a manual change invalidates.

- **Partial bulk updates over-reported what they changed** — a chunk's success incremented the applied count by the number of ids requested, but `updateMany` returns how many rows it actually touched, which is smaller when a contact was deleted after id resolution. The count now comes from the route's response.

- **Select-all on the fundraiser contact list selected nothing** — `ok()` in `lib/api.ts` is `NextResponse.json(data)`, so the body *is* the payload; there is no `data` envelope. Both new clients read `body.data.ids` and `body.data.result`, which are `undefined`. "Select all N matching" therefore selected zero contacts while the banner claimed success, and the invite dialog's preflight never resolved, leaving the send button permanently disabled. The component test missed it because its `fetch` mock returned the wrong shape — the mocks now mirror what the route actually serializes, and a regression test asserts against that shape specifically.

- **Bulk invitations could exceed the request the route would accept, then the platform's time limit** — `/solicit` capped `contactIds` at 2,000 while "select all" yields 2,082, so a whole-database invite failed with a 400 before sending anything. Raising the cap alone would have traded that for a worse failure: sends are serial with a 600 ms pace, so 1,096 recipients need ~11 minutes and would be killed mid-batch with no record of who had already been mailed. The route now caps a request at 200 contacts and declares `maxDuration`, and the dialog sends chunks sequentially with a progress bar. A failure part-way through reports how many invitations already went out rather than presenting itself as all-or-nothing.

- **A capped selection claimed to be the whole set** — when more contacts match than the ids endpoint returns, the banner said "All N contacts matching these filters are selected" while holding only the first slice, and the warning vanished as soon as an action began. Truncation is now its own state with a persistent, differently-worded banner, and the "Select all N" label is clamped to what the endpoint can actually return instead of advertising `totalMatching`.

- **Changing a filter mid-flight could re-arm the selection from the old view** — the id request captured no identity, so a response arriving after the filter-change reset repopulated ids for filters no longer on screen, leaving bulk actions pointed at invisible rows. Responses are now discarded unless the filters they were issued for are still current.

- **The invite dialog under-reported who would be skipped** — `sendSolicitations` drops inactive and do-not-contact rows in its query, so they were excluded from the result entirely and the dialog could report "0 skipped" while silently discarding most of a selection. The result now carries `requested` and `skippedIneligible`, and both the confirmation and the summary account for them.

- **The acknowledgement checkbox could be ticked before the recipient count existed** — the safety gate for irreversible bulk email was enabled while the preflight was still running, against a label reading "0 people", and stayed ticked once the real number arrived. It is now disabled until the count resolves.

- **A partly-selected page rendered as fully selected** — `components/ui/checkbox.tsx` always drew a tick, so Radix's `indeterminate` state was indistinguishable from `checked`. It now draws a dash, which is what the fundraiser list's header checkbox has been asking for.

- **Bulk active/inactive gave no sign when it partly succeeded** — chunked requests commit independently, so a late failure left earlier chunks applied behind a generic error. The message now says how many contacts were updated before the failure, and the table refreshes either way so it stops showing stale rows. The invite button is also disabled while a bulk update is in flight, since it would otherwise mail contacts whose active state was still changing.

- **The ids endpoint trusted its query parameters and misreported auth failures** — filters are now parsed with Zod before reaching Prisma, per the repository's input-validation rule, and both new routes use `failFromError` so a missing permission returns 401/403 instead of 500.

- **Storefront 404s answered with HTTP 200** — every dead URL on the site returned a success status. `/products/anything-at-all`, a mistyped recipe slug, a retired landing page: all 200. The page a visitor saw was the correct "not found" page, so nothing looked wrong in a browser; only the status line was lying, and nothing on the site reads the status line. Search engines do. A 200 carrying error content is the textbook trigger for Google's **soft 404**, which is what the crawl was almost certainly filling up with.

  The cause was one file. `app/(public)/loading.tsx` sat at the **route-group** level, and a `loading.tsx` wraps its whole segment — and everything beneath it — in a Suspense boundary. With `export const dynamic = 'force-dynamic'` on the public layout, Next flushed the shell and the spinner immediately, headers and all, and by the time a page called `notFound()` the status could no longer be changed. Removing it restores the 404; `(public)/developer/loading.tsx` had the same effect over `developer/blog/[slug]`, whose posts are in the sitemap, and went with it. Verified in both directions — every dead route now answers 404, every real route still answers 200.

  `/account` keeps its loading states and so still answers a missing order with a 200. That subtree is behind a login, so no crawler reaches it and the soft-404 problem needs a crawler to matter; the trade is stated in `tests/not-found-status.test.ts` rather than left to be rediscovered. That test is structural — it fails if a `loading.tsx` is ever added at or above a route that calls `notFound()` — because this failure is invisible in the rendered output and would otherwise come back unnoticed.

- **A fundraiser tracking sheet counted as a single campaign** — `ArchivedFundraiser` reported **7,334,516** jars raised. At $10 a jar that is $73M, which the business has plainly never done. One file caused 97.8% of it: `5 year completed JMSFundraisers.xlsx`, a five-year rollup of every campaign, recorded as if it were one. Three yearly trackers ("Fundraisers for 2021", "Fundraisers 2022") did the same on a smaller scale.

  The extractor locates a form's quantity columns positionally, so on a rollup sheet it latched onto the column that sheet happens to list down the side — coordinator names, "Randy", "Cheryl", "Karen" — and read their running totals as one campaign's flavor quantities. The tell is what those columns are *named*: every flavor on the JMS order form carries a heat level, and a roster of people carries none. Measured across the archive the split is total — 281 forms name a heat level on at least half their columns, 7 name one on none, and **nothing falls in between** — so `looksLikeSalsaFlavors()` demotes the sheet to `UNKNOWN` and drops its figures rather than attributing them to an invented campaign. The corrected total is **101,963** jars across 621 campaigns, averaging 164.

  The guard is in the normalizer, not the extractor, because the extractor's positional read is what makes it work on the hundred slightly-different copies of the order form; the judgement about whether the result *is* an order form is domain logic and is unit-tested as such.

- **112 legacy `.xls` files were silently unreadable** — openpyxl cannot read the old BIFF format at all, so every `.xls` in the archive was skipped: the text extractor returned an empty string for them by design ("rare enough to leave for OCR/manual"), and the fundraiser extractor logged 73 errors and moved on. They were not rare, and they were not junk — they are the *oldest* campaigns, and losing them is why `ArchivedFundraiser` appeared to begin in 2018.

  `scripts/_spreadsheet.py` reads either generation, because `xlrd` 2.x handles `.xls` and only `.xls` (it dropped `.xlsx` in 2.0), making the two libraries exactly complementary. Callers get plain row tuples and never learn which one ran — xlrd hands back raw floats for dates and empty strings for blanks, so values are normalized to what openpyxl would have produced, including the whole-number-to-`int` narrowing the order-form parsers depend on.

  The extension is treated as a hint, not a fact. The archive contains `.xls` files that are really `.xlsx` and vice versa, so the other reader is tried before giving up — and the fallback opens a **file handle rather than a path**, because openpyxl rejects a `.xls` *filename* outright without ever looking inside, which is what kept one genuinely-xlsx file failing after the first fix.

  Recovered: 73 fundraiser campaigns, extraction errors 73 → **0**, and a year range that now reaches back to **2011** instead of starting at 2018.

- **QuickBooks company files were not treated as sensitive** — `.qbw`/`.qbb` files carry the entire general ledger (payroll, bank accounts, every customer), but the archive's sensitivity rules keyed on folder names and would have filed one under `01 Financial` as merely `INTERNAL`. They are now sensitive wherever they sit, which is the only workable rule for a file whose folder never says what it holds.

### Added
- **Admin search now covers documents and archive data, not just live commerce** — ⌘K reached six tables: orders, returns, customers, products, fundraisers and discount codes. Everything else the business runs on — the 7,945-file document archive, the recovered fundraiser contact database, historical campaigns, show sales, mileage, the ledger, media, blog posts, CMS pages, recipes, email campaigns, invoices, purchase orders, gift certificates, locations, events, suppliers and staff accounts — was reachable only by knowing which page listed it. Searching a school's name found the open campaign and nothing else, while the scanned order form that named the same school sat unfound in the archive.

  Free text now fans out across **26 tables**. Typing a group's name returns the live campaign, the contact record, the archived order forms, the mileage entry for the delivery and the scanned documents that mention it, grouped by kind. Archive documents match on their **extracted text**, not just their filename, which is the only way a scan filed as `fc70bde0-…pdf` is ever found by the organization named inside it; a body hit ranks below a name hit and carries an excerpt of the matching line, so an oddly named file never looks like a random result. Sensitive documents are matched on their text but never quote it — the palette shows "Matched inside the document text" and the file itself stays one click away, because a ⌘K panel opens over whatever page the operator is on.

  Identifier queries did not get slower: pasting an order number still queries exactly one table. The shape classifier decides the fan-out, so an email scans the nine tables that hold addresses and a phone number the nine that hold phone columns — neither scans document text, which would be the most expensive query in the app for a result that could not exist.

  The fan-out lives in `lib/admin/search-providers.ts` as a list of permission-gated providers rather than inline queries, so adding a table is one entry, and the permission it is gated behind sits next to the query. Gating happens **before** the query: a staff member without archive access never pays for a full-text scan they would not be shown. A provider that throws is dropped rather than failing the search, so a missing table on a partially migrated environment costs that one section.

  The palette shows the top few per section and ends in **"See all results"**, which opens a new `/admin/search` page running the same code at greater depth — the palette answers "take me there", the page answers "show me everything that mentions this".

- **Select every fundraiser contact matching a filter, not just the visible page** — the contact list paginates at 100, so turning a whole segment on or off meant ticking 21 pages by hand. The header checkbox still selects the page and now renders indeterminate when the page is partly ticked; once it is fully ticked, a banner offers **"Select all N matching these filters"**, which resolves the real id set from `GET /api/admin/fundraiser-contacts/ids` and hands it to the existing bulk route. Ids stay explicit end to end — the bulk route never accepts a filter, because a filter re-resolved server-side could touch rows the operator never saw — and the client chunks them to stay under the route's per-request cap.

  The bulk buttons now say what they do and to how many: **Set 2,082 active** / **Set 2,082 inactive**.

  Widening the selection past the loaded page broke an assumption in the invite flow, which counted mailable recipients from the rows it had in memory: selecting all 2,082 and clicking invite would have mailed only the ~100 on screen. The dialog now runs the `dryRun` preflight that already existed and shows the count the server actually resolves — after suppression, unsubscribes, duplicate coordinators, and missing addresses — so the number on the confirm button is the number of emails that will be sent. A dry run also no longer writes `FundraiserOutreachLog` rows; it is a preflight, and logging it left a record of sends that never happened.

- **A fundraiser contact database, and one button to invite every group back** — twenty years of fundraising history sat in `03 Fundraisers` as one spreadsheet per campaign, plus two Constant Contact exports nobody had opened since 2016. `ArchivedFundraiser` had already recovered 930 of those files, but one row per *file* is not a contact list: a group that ran five yearly campaigns appeared five times, blank templates and year-rollup workbooks appeared alongside real organizations, and 741 of the rows carried no email at all.

  `FundraiserContact` is the deduplicated, editable view built on top of it — **2,082 contacts, 571 with recovered campaign history, 1,096 mailable today**. Archive rows group by organization and sum their jars; the old mailing lists fold onto those records by address rather than forming a second set; and the storefront customer export comes in **inactive**, because those are supporters who bought *through* a group, not the coordinator who ran it, and inviting them to "run a fundraiser" would be addressed to someone who once bought a jar of salsa.

  Deciding what is an organization is the part worth testing. The archive names its filing artifacts out of a small vocabulary — "16 Flavors", "2018 Fundraisers for filing", "order form $6", "Undated" — so `isNonOrganizationName()` asks whether *every* token in a name comes from that vocabulary, rather than chasing one pattern per filename. "Fundraisers 2022" reduces to nothing but filing words; "Anderson HS Band" and "FFA Fruit Sale Participation Donation" both keep tokens that carry real identity. Re-import is keyed on a hidden `dedupeKey` rather than the organization name, so correcting a group's spelling in the admin does not fork a duplicate on the next run, and a re-import refreshes the archive-derived totals while leaving `isActive`, `status`, and notes alone — the toggle is the admin's, not the importer's.

  `/admin/fundraisers/contacts` lists them with search, filters, sorting, per-row and bulk on/off, and inline editing. Selecting contacts arms one button that mails each of them a personalized re-signup invitation quoting their own history — "Hardin Valley Middle School Band sold 3,838 jars with us in 2025". Sending checks the suppression and unsubscribe tables per address, deduplicates coordinators who ran two groups, carries `List-Unsubscribe` with one-click support and the postal address CAN-SPAM requires, and writes a `FundraiserOutreachLog` row for every contact including the skips — a suppressed address needs to read as "deliberately not mailed", not as an absence that invites a retry. The API refuses to send without an explicit `confirm`, and the dialog will not arm until the operator ticks an acknowledgement against the real recipient count.

  No dollar totals anywhere. The order forms record jar counts, and the archive spans $6, $8, and $10 per-jar eras with no line totals on any form, so revenue here would be a guess wearing a total's clothes. Jars are what the archive actually knows.

- **A 404 page worth landing on** — the storefront now has its own not-found page instead of Next's built-in one, keyed to the thing the shop actually sells on. The heat scale runs Mild, Medium, Hot, Extra hot; the page draws that scale and puts a fifth notch past the end of it, dashed and unlabelled except for **404**. *Off the scale.* Beneath the joke the copy says plainly what happened — the link is broken, or the page moved — and three routes out sit under it: salsas, recipes, stockists.

  Two entry points share one component. `app/(public)/not-found.tsx` renders inside the storefront chrome, so the nav and footer stay; `app/not-found.tsx` carries its own wordmark for paths that match no route at all and never reach that layout. Only the root one exports metadata — Next reads metadata from `layout` and `page` only, so the segment-level file inherits the layout title, and the note in it says so rather than leaving a plausible-looking export that does nothing.

- **A storefront error boundary that reports** — `app/(public)/error.tsx`, in the same type system as the 404. It also calls `Sentry.captureException`, which is the part that matters: it sits below `app/global-error.tsx`, so without it a failed storefront render would have been caught, shown to the customer, and reported to nobody.

- **CMS landing pages and four stranded routes enter the sitemap** — `app/sitemap.ts` already built itself from Prisma, but the `Page` table was not among the tables it read. Editors could publish a landing page at a clean root URL (`/summer-sale`), see it render, and never learn that the sitemap did not mention it. `/faq`, `/laperla`, `/live`, and `/refunds` had the same gap for a simpler reason: they were never added.

  The publish rule is not restated in the sitemap. `getSitemapLandingPages` in `lib/cms/queries.ts` runs the same `isLive()` check the public renderer runs — status plus the scheduling window — so a page cannot be live and unlisted, or listed and dark, and a scheduled page enters the sitemap on the hour it starts serving. To it is added one condition the renderer has no reason to care about: **`noIndex` pages are withheld**, because listing a URL in a sitemap and then tagging it `noindex` asks Google to crawl a page in order to be told to forget it. `getPublishedLandingSlugs` was left alone rather than widened — it returns slugs for a different caller, and it has no `noIndex` filter and no `updatedAt`, which the sitemap needs for `lastmod`.

  A missing CMS table still yields an empty list rather than an exception, matching every other block in the file: a sitemap that loses one section is recoverable, one that 500s is not.

- **Purchase loyalty points are actually earned now.** The loyalty program could redeem points and even promote tiers, but nothing ever awarded any — the `awardPoints`/`awardPurchasePoints` helpers had no callers outside their own test, so the whole tier and rewards system was inert weight. Points now accrue when an order is marked paid, from the same paid-marking transaction that credits fundraiser commission, so it fires once for Stripe, PayPal, Square, and in-person POS alike rather than being hand-wired onto one path and missing on the other five.

  `creditPurchaseLoyaltyPoints` mirrors `creditFundraiserCommission` exactly: it claims a new `Order.loyaltyPointsAwardedAt` marker with a conditional `updateMany` before it touches the loyalty account, so a webhook racing a completion route awards the points exactly once. Points are earned on the merchandise actually paid for — `subtotal - discountAmount`, excluding tax and shipping, the same base the commission is figured on — and only for registered customers, since the account is keyed by `User`; a guest order earns nothing and creates no account. The account is upserted on the transaction client (not through `getOrCreateLoyaltyAccount`, which uses the singleton and would not roll back with a reversed payment), so a rolled-back payment takes its points with it.

- **Bank and card statements read into the ledger (Stage 3)** — the last of the three ledger stages, and the one that fills `LedgerSource.IMPORT`, which had sat in the schema since Stage 1 with nothing writing it. *Financials → Ledger → Import statement* reads a CSV export from a bank or card account and turns the parts nothing else records — fuel, booth fees, supplier payments, bank charges — into ledger rows.

  **The hard part is not reading the file; it is refusing most of it.** A bank statement is not a list of new facts: every card deposit on it is money the ledger *already holds*, recorded from the orders that produced it. Importing one wholesale would book that revenue a second time and double every figure the ledger reports. So the importer is built around detection — rows are excluded **by default** and the reviewer opts a suspected duplicate back in, rather than being trusted to remember to opt it out. Two exclusions: an amount the ledger already carries within three days (the window exists because card settlement lands a day or three after the sale, so matching on the exact date would miss nearly every real duplicate), and anything that looks like a **processor payout**. The second is the honest half: a Stripe deposit is many orders netted with fees, and **no rule can split it back into the orders it contains** — so it is excluded on its description with the reason stated, rather than matched approximately and reported as reconciled. What this does *not* do is said in the docs as plainly as what it does.

  Parsing refuses where a guess would be silent. `(12.34)` is read as negative — accounting parentheses, which a naive read turns into a *positive* 12.34 and so a withdrawal into a deposit. `1.234,56` is **rejected**: European decimal notation is ambiguous against US thousands separators, and validating after stripping commas (the obvious way round) reads it as `1.23456` and mis-scales the amount by a thousand without ever failing. Dates are read only as `MM/DD/YYYY` or `YYYY-MM-DD` at UTC midnight; anything else is rejected rather than handed to `new Date()`, which accepts almost any string and invents a date from it. Rows that cannot be read are listed with a reason rather than dropped.

  Two things the tests caught while being written, both real: the keyword rules that suggest a category fired regardless of sign, so a *deposit* described "SHELL OIL" — a fuel-card refund — suggested `TRAVEL`, filing money-in under a money-out category and flipping the sign of a figure in every report built on it; a rule now only fires on the side the money actually moved. And the money parser let `1.234,56` through as `123` cents, exactly the mis-scale described above.

  Nothing the client sends back is trusted: the direction is derived from the amount, the category is checked against it (and refused, not corrected — the mismatch almost always means the wrong category was picked, and correcting it would hide that), and the content hash is recomputed server-side, which is what keeps the duplicate guard meaningful. Rows upsert on that hash, so re-importing an overlapping statement export updates the rows it already created. Migration `20260815120000_add_ledger_import_batches` (additive: one new table; `ledger_entries` is unchanged).

- **The bookkeeping ledger reaches QuickBooks (Stage 2)** — Stage 1 built the ledger and left two hooks unused: `LedgerEntry.exportedAt`, documented as "when this entry was written into a QuickBooks export/sync", and the `IMPORT` source. This fills the first of them, by file and by automatic posting.

  **By file.** *Financials → Ledger → Export* downloads exactly the rows the filters are showing, oldest first, in three shapes: full detail (a spreadsheet and a backup), the four-column `Date, Description, Credit, Debit` CSV QuickBooks Online reads under *Banking → Upload from file*, and the journal-entry CSV QuickBooks Online Advanced imports. The four-column bank form was chosen over the three-column `Amount` variant QBO also accepts because that one carries direction in the sign of the number, and a spreadsheet reformatting a negative as `(1.23)` silently reverses a transaction. **Two categories are omitted from the bank format**: cost of goods and discounts moved no cash on their own — the money for stock left when the ingredients were bought, and a discount is money that never arrived — so listing them as bank lines would invent transactions that never happened. `markExported` is opt-in, so taking a second copy of last month's file does not make rows look filed.

  **By posting.** The hourly sync already pushed paid orders as sales receipts and refunds as refund receipts. It now also posts ledger rows whose money *never became an order* — historical show takings, hand-entered expenses, and (from Stage 3) imported statement rows — as balanced **journal entries**, which is the honest shape for money with no customer and no line detail to invent. The rule that keeps the books from doubling is an allowlist, not a filter: `isJournalSyncable` refuses `ORDER` and `REFUND` rows outright, because those are already in QuickBooks as receipts.

  **Account mapping**, on the QuickBooks settings page: one cash/clearing account, one inventory account, and the account each category books to, expanded on save into a fully explicit per-category map so the stored settings say exactly what will happen. Two defaults matter and are the sort of thing that misstates a set of books silently — **collected sales tax credits a liability, not income** (the ledger files it as money-in because that is the direction it moved, but it is owed to the state), and **cost of goods offsets against inventory, not cash** (that payment already left the bank). The sync refuses to post a category with no mapped account, matching the order sync's refuse-rather-than-guess contract; the file export falls back to a suggested standard QuickBooks account name, which is safe there precisely because a person reads the file before importing it.

  **IIF was planned and dropped**: it is a QuickBooks *Desktop* format and QuickBooks Online cannot import it, so shipping it would have been a file nobody here can use.

  Two things found on the way. `mappers.toTxnDate` reads a date with local getters, which is right for an order's `createdAt` — a real instant, and the receipt should carry the day the shop experienced — but wrong for a ledger row, whose date is already a calendar date written at UTC midnight; re-reading one locally files a 1 January sale in the previous tax year, so the journal and export dates read UTC. And the new sweeper excludes already-queued rows *in the query* rather than taking the oldest hundred and filtering afterwards: the existing `enqueuePaidOrders` and `enqueueRefunds` do the latter, which stalls permanently once a hundred rows have been queued. Those two are left as they are — noted, not quietly rewritten — since neither has reached the ceiling at this volume.

  Migration `20260815100000_add_ledger_account_map_and_journal_entries` (additive: one enum value, one nullable column). `JOURNAL_ENTRY` is appended to the end of `QuickBooksEntityType` deliberately — the drain queue orders by that enum so a refund never posts before the sale it reverses.

- **UTM attribution — capture and report** — the platform can now say where a sale came from. Nothing captured marketing source before: orders knew their `salesChannel` (website/POS/fundraiser/…) but not which campaign, ad, or referrer brought the buyer in. This adds **first-touch** capture and an admin report on it.

  Because the cart lives entirely in the browser (there is no server-side cart row), attribution rides in a cookie — the same shape of precedent as the abandoned-cart and fundraiser-referral cookies. A small client component (`AttributionTracker`, mounted in the public layout) records the `utm_*` params, the external referrer host, and the landing path into a `jms_attribution` cookie the **first** time a visitor lands with anything worth attributing; a purely direct visit is deliberately left uncaptured so a later campaign click can still be the first touch. `POST /api/checkout` reads that cookie and writes the fields onto the order — parsing is fully defensive and never throws, so a malformed cookie can never break checkout. Seven nullable columns (`utmSource/utmMedium/utmCampaign/utmTerm/utmContent`, `referrer`, `landingPage`) are added to `Order` by migration `20260815120000_add_order_attribution`; existing and offline orders are simply direct (no backfill).

  The report at `/admin/analytics/attribution` (Analytics → Attribution) groups settled orders by source, medium, campaign, or referrer into orders / revenue / average order value, ranked by revenue, reusing the same sales filter as the margin and orders reports. Its honesty rule: orders with no captured source are their own **Direct / none** row rather than folded into whichever campaign sorts first, and the headline states the share of orders that carried any UTM source — attribution is only ever as complete as capture. Capture logic lives in `lib/analytics/attribution.ts` (pure, tested); report math in `lib/analytics/utm-report.ts`. Read-only, gated on the existing `analytics:read` permission — no permission seed.

- **Collections — curated product groups** — a new admin section (`/admin/collections`, under Products) for hand-picked, marketing-facing groups of products like "Gift Sets", "New Arrivals", or "Staff Picks", distinct from the Category taxonomy. Where a product belongs to exactly one Category, it can appear in **many** Collections and a Collection holds many products, so the relation is many-to-many through a `CollectionProduct` join that also stores each product's display order within the collection.

  Admins create and edit collections (name, slug, description, image, SEO fields, active flag, sort order) with a searchable product multi-select; products keep the order they're selected in. The API (`app/api/admin/collections/**`, gated on `products:read`/`products:write`, audit-logged) mirrors the categories handlers and adds product-set syncing; deleting a collection detaches its products (the join rows cascade) and never deletes the products themselves. On the storefront, `/collections/[slug]` renders a collection's active products, in order, through the same `ProductCard` grid as the catalog, with per-collection SEO metadata. The slug and join-row logic live in `lib/collections.ts` (pure, tested); migration `20260815130000_add_collections` adds the two tables. Gated on the existing `products:read` nav visibility — no permission seed.

- **Inventory turnover & slow-movers report** — a new analytics page (`/admin/analytics/inventory-turnover`, under Analytics → Turnover & Slow Movers) answering two questions the platform could not: how fast stock is selling, and what is sitting still. It reports an overall turnover ratio — how many times the shelf sold through in the window, annualised — and days on hand to clear current stock at that pace, then a per-product table ranked **slowest-first**: products holding stock with no sales lead, followed by the longest days of supply. The slow-mover flag fires past 90 days of supply, or immediately when a product holds stock and sold nothing.

  It follows the same honesty rule as the margin page — *a missing cost is missing, never zero.* A product with no recorded cost is excluded from the turnover ratio and inventory-value figures and counted against a stated coverage percentage, rather than valued at $0 and reported as free stock; the velocity half of the table (units, days of supply) needs no cost, so it works for a catalogue that has never recorded one. Both COGS and inventory are valued at the current cost price, which the page states plainly, because the platform keeps no historical inventory snapshots to average against. The arithmetic lives in `lib/analytics/inventory-turnover.ts` (pure, fully tested); the query in `inventory-turnover.server.ts` reuses the same sales definition as the margin and orders pages so units-sold never disagrees between them. Read-only; gated on the existing `analytics:read` permission, so no new migration or permission seed.

- **Cohort retention & repeat-purchase report** — a new analytics page (`/admin/analytics/retention`, under Analytics → Retention & Repeat Purchase) answering whether customers come back, which the platform could not report at all. It shows the **repeat-purchase rate** (share of distinct buyers with two or more orders) and orders-per-buyer, then a **cohort retention triangle**: buyers grouped by the month they were first seen, with each later column the share of that cohort who ordered again that many months on.

  Buyer identity is the signed-in `userId` when present, otherwise the normalised guest email — there is no `Customer` foreign key on `Order`. Orders with neither are excluded (and their count surfaced) rather than counted as one-time buyers, which would deflate every retention figure. Two honesty rules the grid depends on, stated on the page: month 0 is the acquisition month and is 100% by definition, and a cell the data cannot see yet is **blank, never 0%** — a cohort acquired last month has no "three months later" column, and printing 0% there would read as total churn instead of "not observable yet". The math lives in `lib/analytics/cohort-retention.ts` (pure, fully tested); the query in `cohort-retention.server.ts` reuses the same sales filter as the margin and orders reports. Read-only, gated on the existing `analytics:read` permission — no migration or seed.

- **A unified bookkeeping ledger** — the one place the platform lacked: a single running record of every dollar in and out, from every channel, that can be summed, edited, and (next) exported to QuickBooks. Money had been scattered across `Payment`, `Refund`, order columns, show cash/card fields, and fundraiser rollups with nothing joining them; the new `LedgerEntry` model is that join.

  It is a *reporting and backup* ledger, not a new system of record: orders, refunds and shows keep their own tables, and entries here are either derived from them (idempotently, keyed by a `dedupeKey`) or hand-entered by staff. The rule that keeps totals honest is that each dollar is recorded from exactly one source — online/manual/fundraiser/event sales from `Order` + `Refund`, the pre-database paper years from `ArchivedShowSale` — so the rollup tables that merely re-summarise those sales are deliberately **not** backfilled, because doing so would count the same money twice.

  An order becomes its revenue components (product, shipping, tax collected) plus its costs (COGS from item cost snapshots, processor fees); a refund and a discount are positive amounts under contra categories so `sum(income) − sum(expense)` nets correctly. Everything is stored in integer cents so a column of entries sums without drift. The mapping and P&L math live in `lib/financials/ledger.ts` (pure, fully tested); `lib/financials/ledger-writer.ts` upserts derived rows; a domain-event handler writes each order/refund into the ledger the moment its money settles, and `npm run ledger:backfill --workspace @jose-madrid/storefront` reconstructs the whole thing from existing data (safe to re-run).

  A new **Ledger** page under Financials (`/admin/financials/ledger`) shows money-in / money-out / net over any date range, filters by direction, category and text, and lets staff **add, edit and delete** manual entries — the missing place to type in an expense or correct a figure. Derived rows can have a note added but stay in sync automatically. Migration `20260813140000_add_ledger_entries` adds the table; the new `financials:write` permission gates entry editing, so run `npm run db:seed:permissions --workspace @jose-madrid/storefront` to grant it to existing roles. This is the foundation for the QuickBooks-formatted export that follows.

- **Show financials & break-even for events** — festival and market shows now carry their own money, not just a pack-out manifest. A new **Financials** page per event (`/admin/events/[id]/financials`, linked from the event card and the edit screen) captures the costs of a show — booth/show fee, fuel, lodging, meals, and a free-form **other expenses** line with a note — and the money taken, split into **cash** and **credit-card** sales. From those it computes, live, the figures the crew actually wants on the drive home: total costs (the dollar amount the show has to earn back), total sales, net profit or loss with margin, and **how much is left to sell to break even** — every dollar spent on a show counted against that show.

  It reuses the existing manifest (cases + jars taken minus returned → units sold) as a cross-check: the page shows the estimated retail value of the units the manifest says sold, alongside the recorded cash-and-card total, and explains the gap (samples, discounts, tax) rather than pretending the two must match. The four cost fields `boothFee`/`costOfFuel`/`lodging`/`meals` already existed on `FeaturedEvent` but were written only by the Show CSV import and shown nowhere; they are now editable and, for the first time, add up to something. New columns `otherExpenses`/`otherExpensesNote`/`cashSales`/`cardSales` (migration `20260813130000_add_show_financials`) hold the rest.

  The math lives in `lib/events/show-financials.ts` (pure, Zod-validated, fully tested): a blank field counts as zero in a total but is preserved as "not entered" rather than coerced to $0, negatives are rejected, and break-even is expressed as a sales target with the shortfall floored at zero. Served by `GET`/`PUT /api/admin/events/[id]/financials`.

- **`EVENT` sales channel** — the business rings up four kinds of sale with different pricing and handling: regular retail (the website), fundraiser (its own flow), wholesale (a negotiated manual order), and event sales at festivals and markets. The first three already had a `SalesChannel` value; event sales had none and were being folded into `MANUAL` or `POS`. `EVENT` was added to the enum, to the manual-order form's channel picker, and to the server-side list of channels a person may set by hand, so event sales can now be recorded, filtered and reported on their own. Because `SALES_CHANNEL_LABELS` drives the order-filter dropdown, the new channel surfaces there automatically. Migration `20260813120200_add_event_sales_channel` adds the enum value idempotently.

- **`apps/agent` — the platform agent**, an [eve](https://eve.dev) agent whose remit is the repository, the business, the document archive, and the cutover from the legacy BigCommerce store. `agent/instructions.md` carries the always-on purpose plus the guardrails that keep it honest: read-only by default, explicit human approval before anything that writes, sends, charges, refunds, publishes, or deploys, and the four business facts that are easy to get backwards (production is pre-traffic, fundraiser goals are gross sales, QuickBooks Online is the accounting source of truth, `Product.weight` is ounces).

  Its first tool, `search_catalog`, is a read-only wrapper over the storefront's own `/api/products/search`, so the agent and the storefront share one definition of "the catalog" rather than the agent standing up a second Prisma client. Verified against the 28 live products on production.

  The workspace pins its own toolchain — Node 24 and TypeScript 7, both required by eve — in `apps/agent/package.json` rather than at the repo root, so the other five workspaces keep Node 20 and TypeScript 5.9. `eve build` runs without model credentials, so building it depends on no secret; it is, however, excluded from the aggregate `npm run build` gate (see Fixed) because that gate runs on the repo's Node 20/22 baseline and `eve build` requires Node 24.

### Changed
- **Search & indexing rules for every AI agent** — `AGENTS.md` and `CLAUDE.md` (Part 18) now carry Google's own guidance bound to this repo's files, so an agent adding a public route has to register it in `app/sitemap.ts`, choose between `noindex` and a `robots.txt` disallow deliberately (a page blocked from crawling never has its `noindex` tag read), and hold titles and descriptions to the 30–60 / ≤160 limits the blog schema already enforces. Domain changes must update `SeoConfiguration.siteUrl` and canonicals together; page removals default to delete-or-redirect, with the Removals tool reserved for content that is actually harmful while live. The rule ends where an agent's reach does: **URL Inspection, Removals, and Change of Address are Search Console actions no agent can perform, and must be handed to a person rather than reported as done.**

- **The developer essay's cost figures, corrected to match the page** — "The Real Cost of Building This Platform" claimed **$144,000–$360,000** in developer cost and a **$250,000–$600,000** agency quote, the same hours × hourly-rate arithmetic the developer page was carrying. Rewritten to the replacement-cost framing (**$1,500–$5,000** off-the-shelf, **$8,000–$18,000** freelance rebuild, **$20,000–$30,000** ceiling), with the correction stated in the essay's own voice rather than quietly swapped — the post is an "honest accounting", so revising it silently would have undercut its premise. Fixed in `scripts/seed-developer-blog-posts.ts` **and** in the stored `DeveloperBlogPost` row, since re-seeding does not overwrite published content.

- **The developer page's valuation figures, corrected downward** — the page claimed a "real-world fair-market value" of **$250,000–$750,000+**, with commission tiers running to $1.2M and a "$150K–$400K" Shopify Plus comparable. Those were bill-rate arithmetic (1,500 hours × agency hourly) dressed up as market value, and the platform has never been sold, quoted, or asked after. A pre-revenue storefront with no order history and no traffic record does not command six figures; publishing that it does was a claim the business could not stand behind.

  The whole frame moved from *what an agency would charge* to *what it would cost to replace*, which is the only version of this number that is checkable: **Off-the-Shelf Alternative $1,500–$5,000** (a themed Shopify/BigCommerce store with apps — the actual alternative for a company this size), **Freelance Rebuild $8,000–$18,000**, **Upper Bound $20,000–$30,000**. The headline reads **"Under $30,000"** under the honest heading — a platform is worth what someone will pay for it, and nobody has been asked to. Retitling the tiers rather than just dividing the old numbers was the point: "Big Four consultancy, $28,000" would have replaced one unsupportable claim with another.

  The footnote no longer cites Clutch/Toptal/BLS rate tables, which were real sources supporting a calculation nobody should have been making; it now says plainly that the counts (lines, endpoints, models, releases) are measured from the repository, the dollar ranges are judgement, and the only certain figure on the page is the **$0** actually charged — which is untouched, and is the part that was always true. Also fixed `formatUSD`, which rounded to whole thousands and would have printed the new $1,500 floor as "$2K", and shortened the page's meta description (198 → 146 characters) since the valuation claim was in it.

- **Blog post SEO limits are now enforced, not merely scored** — the SEO analyzer has always graded pages on snippet length, but nothing stopped a post being published with a 21-character title or a 198-character description; the score was advice nobody had to take. The Heat Index write path now holds posts to the analyzer's own thresholds — meta title **30–60 characters**, meta description **160 or fewer** — and the analyzer's constants are exported and imported by the schema and the editor, so a value the API accepts can never be one the analyzer then flags.

  The rule is checked against **what a crawler actually renders**, not the override fields. `seoTitle` falls back to the post title and `seoDescription` to the excerpt, so validating only the overrides would have left the common case — no override set — completely unguarded, which is exactly how a 21-character title reached production. `checkPostSeo` resolves the fallback first, then reports against whichever value is in play: a short *override* asks for more characters, a short *post title* asks for an SEO title to be set instead, so the message names the field the author has to go fix.

  **Drafts and archived posts are exempt.** The rules bite on `PUBLISHED` and `SCHEDULED` only, so a half-written post still saves; the gate is publication, not typing. The `PATCH` route checks the post as it will be *after* the patch (stored values merged with the change), so flipping status to published cannot slip past a check that only looked at the fields the request happened to include.

  In the editor, the SEO panel counts the **effective** value — labelled `(from title)` / `(from excerpt)` when no override is set — caps both inputs at their limits, opens itself when an existing post already breaks a rule, and blocks the save with the specific failure rather than a generic API error.

  **All nine published posts currently fail this rule** (excerpts of 164–478 characters, three titles under 30 too) and will need an SEO description before they can next be saved. That is the intended consequence, not an accident of the rollout.

### Removed
- **`ProductVariant`, a decorative model wired to no sale** — one of four dead models the admin-platform audit flagged for an explicit adopt-or-drop decision. It had an admin editor and a customer-facing "Select Options" control, but the selection reached nothing: no `order_items` or `cart_items` column recorded it, and the add-to-cart button ignored it and used the base product's price and SKU. A shopper could pick a variant and it changed neither the price charged, the SKU shipped, nor the stock deducted — UI attached to no behaviour. The distinct pricing and handling the business actually needs is expressed by `SalesChannel` (retail, fundraiser, wholesale, event), not by product-level variants. Removed the model, its `Product` relation, the `getProductBySlug`/`getProducts` includes, the customer `VariantSelector` and its render on the product page, the admin `VariantEditor`/`VariantEditorWrapper`, the `/api/admin/products/[id]/variants` routes, the variant checks in `scripts/verify-db-integrity.ts`, and the variant-only `ProductCard` test. Guarded migration `20260813120000_drop_product_variants` refuses to run if the table holds any rows.

- **`EmailSegment`, a segmentation model with nothing behind it** — another of the four dead models. It described audience conditions (`conditions` JSON, `subscriberCount`, `lastCalculatedAt`) but no code ever read or wrote it: no segment was ever calculated and no campaign ever targeted by one. Real customer segmentation is a dedicated feature and will be designed as one. Removed the model and its `MailingList` relation. Guarded migration `20260813120100_drop_email_segments` refuses to run if the table holds any rows.

  The other two flagged models, `OrderNotificationRule` and `OrderNotificationEvent`, were **kept**: the separate workflow-automation work has since given them an evaluation module, a registered domain-event handler, and tests, so they are adopted rather than dead. Their remaining gap — an admin write path to create rules — belongs to that effort.

- **The dead Stripe webhook handler** — `apps/storefront/lib/stripe/webhooks.ts` (`processWebhookEvent` and friends) was never wired into any route; only two test files imported it, and a comment in `lib/domain-events/handlers/order-notifications.ts` already noted that nothing else did. The live Stripe webhook is `app/api/webhooks/stripe/route.ts`, which has its own inline, idempotent handler — it skips any order item that already carries an `ORDER_COMPLETION` inventory transaction before deducting, and it handles `charge.refunded` too, so nothing reachable was lost.

  The orphan mattered because its `handlePaymentIntentSucceeded` called `deductReservedInventoryInTx` with **no** such guard — the same oversell race PR #421 is fixing on the PayPal and Square paths. Deleting it removes the one unguarded deduction path rather than leaving a trap for a future caller. Removed with its two orphaned tests (`tests/stripe/webhooks.test.ts`, `tests/integration/inventory-order-completion.test.ts`); `lib/stripe/types.ts` is untouched.

- **Free shipping, entirely** — the business does not offer it and never has. Two mechanisms did: a `freeShippingThreshold` on `ShippingSettings` that zeroed the shipping line above a subtotal, falling back to **$50 in code** when null, and a `FREE_SHIPPING` discount type that did the same on demand. A loyalty reward spent 300 points on it.

  Both were live and expensive. Once real carrier rates reached checkout, the $50 default meant a **six-jar order shipped free at a cost of ~$11.88** to the business and a **twelve-jar case at ~$35.74** — on exactly the orders worth having. At $9 a jar the threshold triggered at six.

  Removed from every layer rather than switched off: the two zero-cost branches in `lib/shipping-calculator.ts` and its DB-backed threshold reader, the discount branch, the loyalty reward, the checkout path that zeroed shipping for a code, the admin threshold field and its API, the `freeShippingThreshold` column, and the `FREE_SHIPPING` enum value. Customer-facing copy went too — the checkout banner, a wholesale bullet, two fundraising claims, and the promo text baked into the email header block and the seasonal template.

  The tests were inverted rather than deleted: where they asserted a threshold produced $0, they now assert shipping is charged at $50, $75, $500 and $10,000, and two Playwright specs assert the phrase "free shipping" never appears on checkout. `tests/component/CheckoutForm.test.tsx` lost a whole `Free Shipping Threshold` block that only ever asserted arithmetic defined inside the test file — it never touched application code and passed regardless.

  Dropping the enum value needed the type rebuilt, since Postgres cannot remove a value in place. Safe: zero `FREE_SHIPPING` codes existed in either database and the threshold was null in both, so no configured behaviour was removed.

- **The duplicate abandoned-cart sender** — `lib/email/automation.ts` carried a second `sendAbandonedCartEmail` that nothing called. The working one is the cron's own local copy, so the two were never in conflict; the risk was that a future caller would reach for the exported one, which builds different copy and a different recovery URL than the sequence actually sends. Removed with its single-use `CartItemData` interface.

- **The `EmailWebhook` model** — an outbound webhook registry (name, url, events, secret) with **zero code references anywhere**: nothing ever registered a webhook and nothing ever delivered to one. Unrelated to `app/api/webhooks/resend`, which is the *inbound* handler for bounce and delivery events and is untouched.

  The migration **refuses to run rather than destroy**. The table carries a `secret` column, and the developer database it was checked against is not production, so instead of assuming prod is also empty it raises if any row exists. Because `vercel-build` wraps `prisma migrate deploy` in a warning rather than a failure, the failure mode is "the table survives and the drop shows up in the build log" — the right way round for a change that cannot be undone.

### Fixed
- **CI's `Build application` step failed on every branch** — the aggregate `npm run build` runs `turbo run build` across all workspaces, and `apps/agent`'s build is `eve build`, which requires Node ≥24. CI (and the repo baseline) run Node 22/20, so `eve build` aborted before any deployable app compiled, turning the build gate red on `main` and every PR since the agent workspace landed. The root `build` script now excludes `@jose-madrid/agent` (`--filter=!@jose-madrid/agent`), matching the workspace's own design — it pins its Node 24 toolchain locally while the other six stay on the Node 20/22 baseline. Vercel production deploys were never affected: `vercel-build` is scoped to the storefront workspace and never invoked the agent. The agent still builds on its own under Node 24 via `npm run build --workspace=@jose-madrid/agent`.

- **The admin financials and merchandise consoles showed fabricated data as if it were real** — `lib/financials/config.ts` hardcoded payroll runs with named fake employees ("Sarah Thompson", "Daniel Wu"), an expense-approval queue, and tax-filing tasks dated 2024–25; `lib/merchandise/config.ts` hardcoded a product catalog with invented SKUs and margins plus a vendor credential marked "connected". All of it rendered unlabelled across `/admin/financials` (overview, payroll, expenses, taxes) and `/admin/merchandise`, so a reader could not tell it from live business figures — a direct violation of the no-fake-implementations rule.

  The mock data and its types are gone. Expenses, bills, vendors, and the P&L already had a real source — QuickBooks Online, the accounting source of truth — read through `lib/quickbooks/reports.ts`; the expenses workspace now renders that live card when QuickBooks is connected and an honest "connect QuickBooks" state when it is not, rather than a fake submission queue. Payroll has no data source, so its workspace is now an honest not-connected scaffold (ADP / QuickBooks Payroll) instead of invented pay runs. The taxes workspace keeps its real sales-tax report and drops the fabricated filing tasks. The merchandise console becomes a not-yet-connected fulfillment scaffold — the real launch collections stay as clearly-labelled *planned* collections. A regression test asserts the fabricated exports never return.

- **Every transactional email footer linked to a 404 unsubscribe page** — the twelve senders in `lib/email/automation.ts` (order confirmation, shipped, delivered, welcome, newsletter, contact, and the fundraiser sequence) all footered `/account/preferences`, a route that does not exist: account pages live under `app/(public)/account/` and only `settings` was ever built. A dead unsubscribe link is a CAN-SPAM compliance gap and a deliverability signal, so the address had no working way to opt out.

  All twelve now point at the existing standalone `/unsubscribe` flow, which writes `UnsubscribePreference` — the same table `lib/email/client.ts`'s send-time `checkUnsubscribed` and the mass-send `checkSuppression` already read, so an opt-out actually excludes future sends. A shared `lib/email/unsubscribe-url.ts` builds the link and owns the base URL that the `List-Unsubscribe` header also reads, so header and footer can no longer drift to different hosts — the old footer fell back to the **legacy `josemadridsalsa.com`** store while the header used `josemadrid.net`. The link carries the same signed token the route already verifies, so `/unsubscribe` loads the recipient's real preferences instead of blank defaults; without it, saving the form would silently overwrite prior category opt-outs. A source guard asserts no sender points at `/account/preferences` again, and a test pins the target to a page that exists on disk.

  Not addressed here, noted for follow-up: shipped/delivered emails pass `type: 'order-shipped'`/`'order-delivered'`, but `client.ts`'s transactional allowlist checks for `'shipping-notification'`/`'delivery-confirmation'`, so an `unsubscribeAll` currently suppresses those notices — pre-existing, but more reachable now that order emails carry a prominent unsubscribe link. A real logged-in `/account/preferences` page (Option B) was declined in favour of the working flow.

- **The PayPal and Square checkout paths could oversell inventory on a replay** — a paid order is finalized by two independent paths, the checkout route and the provider webhook, that each deduct the same order's reserved stock. `deductReservedInventoryInTx` is not idempotent, and the Stripe route and Stripe webhook already guarded against it by skipping any item that already has an `ORDER_COMPLETION` transaction — but `checkout/paypal/capture-order` and `checkout/square/process-payment` did not. When the webhook replayed a PayPal or Square order the route had already committed, the second deduction either threw (the reservation was gone) or **silently consumed another customer's reservation, overselling the product**. Serializable isolation does not catch this — it is sequential replay, not a concurrent write conflict.

  The guard is now one shared helper, `deductReservedInventoryOnceInTx`, that all four finalize paths call, so the two that were correct and the two that were not can no longer drift apart. It requires an `orderId` and refuses to run without one, because Prisma silently drops an `undefined` predicate — a guard keyed on a missing `orderId` would match any product's completed deduction and skip a legitimate one, turning an oversell into an invisible undersell.

  A regression test models the race as two sequential deductions sharing committed state and asserts the PayPal and Square paths deduct exactly once while a bystander customer's reservation survives; a negative control runs the raw deduction twice and asserts it still oversells, proving the harness reproduces the original bug; and a drift check fails if any of the four finalize routes ever calls the non-idempotent deduction directly again.

- **A tax-calculation failure was swallowed silently, so a bad Stripe Tax key would ship untaxed orders indefinitely with nothing surfacing it** — `lib/tax-calculator.ts` caught any Stripe Tax error and returned a `$0` result, and each checkout route caught it again and logged to a console nobody reads. A `$0` tax line is indistinguishable from a legitimately untaxed order (a resale-exempt wholesale account, a no-nexus jurisdiction), so the failure left no trace on the order, in an alert, or anywhere an operator would look. Shipping, by contrast, already **blocked** the order with a 500 on failure — tax was the lenient outlier.

  The silent zero is gone at the source: `calculateTax` now **propagates** the Stripe Tax error instead of reporting `$0`, so the failure is no longer invisible to its callers. Each of the four routes that create an order — `checkout`, `checkout/paypal/create-order`, `checkout/square/create-order` and `orders` — now routes that failure through the canonical `notifyOperators` path (`type: INTEGRATION_FAILED`, `CRITICAL`), the same channel a failed payment webhook uses. The alert is deduped on `integration-failed:stripe-tax`, so a sustained outage collapses to one row on the operator's list rather than one per order, and it carries no customer data — the integration id and a plain description only.

  **Chose notify-and-continue over hard-fail** (the two options the audit left open), and deliberately did *not* mirror shipping's block. If Stripe Tax is not actually activated on the account, `tax.calculations.create` errors on *every* call, and hard-failing would turn a misconfiguration into a total checkout outage on the next deploy — a severe, hard-to-reverse failure mode for a fix meant to protect the store, and one that could not be verified from here (no activation is documented, and production is pre-traffic). Continuing records the order with `$0` tax — recoverable, and now loudly visible — while a bad key gets caught on the first order rather than the accountant's first reconciliation. If Stripe Tax activation is later confirmed, flipping any route to block is a one-line change.

  Two tests cover it. A route-level regression test mocks `calculateTax` to reject and stubs the dispatcher, then asserts the `INTEGRATION_FAILED` alert fires and checkout still completes with `$0` tax. A separate `calculateTax` unit test mocks the Stripe Tax client itself to throw and pins the new contract — the function now rejects rather than returning a silent `$0`. The browser tax-preview path (`/api/checkout/calculate-tax`) already soft-degrades: its consumer in `checkout/page.tsx` treats a non-OK response as `$0` tax without blocking checkout, so the estimate endpoint surfacing the error to the client does not gate the order, and it does not alert operators (that would flood on every keystroke of an address field).

- **Four of the eight routes that mark an order paid never recorded the payment** — `checkout/complete`, `checkout/paypal/capture-order`, `checkout/square/process-payment` and `gift-certificates/complete` each set `paymentStatus: PAID` and emitted no `payment.completed` event. The webhooks that do emit return early once an order is already paid, so whenever the checkout route won that race — the ordinary case, since the browser calls it the moment payment confirms — the fact was lost for that sale.

  Every consumer hangs off that event, so on those paths nobody was enrolled in an email automation, the shop raised no new-order notification, no high-value alert fired, participant milestones did not count the sale, and order rules did not evaluate. On the main storefront path the customer also received **no order confirmation at all**: `checkout/complete` never sent one, and the Stripe webhook that would have was skipping the order as already paid.

  All four now emit inside the transaction that marks the order paid, so the fact commits with the payment or not at all. Exactly one event is emitted per sale in either race order, because whichever side loses returns early; where a duplicate is still conceivable the consumers absorb it through `confirmationEmailSentAt`, their notification dedupe keys, and the milestone marker.

  A structural test enumerates every route whose source marks an order paid and fails if one does not emit, on the same "nobody forgot" reasoning as the cron guard check. It immediately found a fourth route the hand-traced census had missed — which is how `checkout/complete`, the busiest path in the application, came to light.

- **Every shipping quote was 16× overweight** — `Product.weight` is stored in **ounces** (a jar is `16`, and `lib/feeds/products.ts` maps the same column to `weightOz` for the Google and Amazon feeds). Both paths in `lib/shipping-calculator.ts` treated it as pounds: the carrier path multiplied by 16 to "convert lb to oz", and the estimate path measured a `> 5 lb` surcharge against it directly.

  So one 16oz jar priced as a 16 lb parcel, cleared the heavy-parcel threshold, and cost **$10.49 instead of $6.99**. Six jars quoted as 96 lb — $50.49 instead of $6.99. Seven orders in the database carry exactly that $10.49 against a single $7 jar. The six products with *no* recorded weight were the only ones quoting correctly, because the `|| 1.0` fallback happened to land on one pound.

  The unit is now in the field name — `weightOz` — so a mismatch is visible at the call site instead of behind a comment that disagreed with reality, and one helper computes parcel weight for both paths. The five checkout routes that each had their own copy of `weight: Number(product.weight)` now share one `buildShippingItems`, which is also the first time **dimensions** have been passed at all: no caller ever sent them, so every parcel was sized from a fallback regardless of what the catalogue knew.

  Worth recording that the rename type-checked clean at first. The callers build the array in a variable before passing it, so excess-property checking never fires and `weightOz` would have silently arrived `undefined` on all five paths.

- **The warehouse address had three sources of truth under two environment-variable prefixes** — rate quoting read `SHIPPING_ORIGIN_*` and **defaulted to `123 Main St, San Francisco, CA 94111`**; label buying read `SHIP_FROM_*`; and `ShippingSettings.originAddress` held a third copy. A half-configured deployment quoted customers from one coast and shipped from the other, with nothing in the response to indicate it. One resolver now serves both, database first and environment second, and it returns **nothing** rather than a placeholder — a made-up origin produces confident wrong prices, which is worse than a missing one.

- **A jar's shipping weight is not its size** — `Product.weight` holds `16`, the net contents. Shipping on that under-declares a jar by about two thirds, and an under-declared parcel is rejected at the counter or surcharged afterwards. Gross weight is now computed from the physical object: empty jar, lid, contents at salsa's density, dividers and the box. A case of twelve comes out at 21.4 lb, which is what a real case of twelve pint jars weighs.

- **Four cron routes failed open when `CRON_SECRET` was unset** — `social-publish`, `quickbooks-sync`, `email-campaigns` and `email-automation` each carried a private copy of the authorisation check that returned `true` whenever the secret was missing. The shared guard in `lib/cron/auth.ts` refuses in production instead, precisely because that is the configuration where failing open matters: these routes publish to social accounts, write to accounting and send customer email, and a cron endpoint is an ordinary public URL — nothing about living under `app/api/cron` makes one unreachable. All four now use the shared guard.

  A structural test now asserts that every route under `app/api/cron` uses it, returns 401, and carries no private fail-open copy. Asserted over the source of each route rather than by invoking handlers, because the property being protected is "nobody forgot", and a per-route behavioural test only ever covers the routes somebody remembered to write a test for. Two real faults motivated it: a stub route that shipped with no check at all, and these four.

### Added
- **Seedable demo content for the CMS** — the content section had zeroes in every column, so there was nothing to interact with. `npm run db:seed:cms` fills it with realistic content: 5 reusable sections, 4 landing pages assembled from 17 blocks, 5 banners (one per placement), 4 announcements (one per variant), 3 FAQ categories with 13 answered questions, header and footer menus with 34 nested items, footer settings, and 6 legacy redirects. Two pages reference reusable sections rather than copying them, so that relationship is visible in the editor.

  **Nothing it creates is publicly visible**, enforced through the mechanisms the code already respects rather than by convention. Pages, banners, announcements and FAQ items are `DRAFT`, which the public queries filter out. Navigation items are `isVisible: false` — `getNavigationMenu` filters on visibility and `getHeaderGroups` returns `undefined` for an empty menu, which is what keeps the built-in header, while the items stay editable with their toggles. Redirects are inactive.

  `FooterSettings` is the exception worth recording: **any row at all overrides the built-in footer**, because `getFooterOverrides` only bails when the row is absent — there is no draft state to hide behind. So the seeded values mirror the hardcoded footer exactly. That includes all four social links: `overrides.socialLinks` *replaces* the built-in array rather than merging, so seeding three would have silently dropped the Google review link from the live footer.

  Verified against both databases after seeding — the header resolver still returns `undefined`, the footer resolves to identical values with no link columns, and every publicly-visible count is zero. Idempotent, with `--clear` to remove what it made and `--production` to target Supabase.

- **Pirate Ship shipping automation** — Orders can now be fulfilled through Pirate Ship without leaving the admin panel. Each order detail page has an **Export to Pirate Ship** action that cross-references the shipping address against the carrier network (via the existing EasyPost address verification), auto-computes the parcel weight and box dimensions from the ordered products (with an editable override and a sensible fallback when a product has no weight/dimensions), and downloads a Pirate Ship–ready import CSV. A new **Ship Orders** fulfillment queue (`/admin/shipping`) lists every unshipped paid order, batch-exports selected (or all) orders to one Pirate Ship import file, and imports Pirate Ship's tracking export back — matching each row to its order, marking it Shipped with tracking, and sending the shipped email. Since Pirate Ship has no public API, this is the most automated path that preserves your negotiated Pirate Ship rates: one click to a mapped import file, drag-and-buy in Pirate Ship, one upload to close the loop. New endpoints under `/api/admin/orders/[id]/pirate-ship` and `/api/admin/shipping/pirate-ship/{export,import-tracking}`; pure mapping/parcel logic in `lib/shipping/pirate-ship.ts` with unit tests.
- **Blog cross-posting to social channels** — The Heat Index post editor gains a "Cross-post to social" panel: check the connected channels and the *full article* is published to them, not just the Open Graph link card the share buttons produced. It reuses the existing social publishing engine (`lib/social/publisher.ts`) rather than reinventing Graph API calls — a single `SocialMediaPost` is upserted per article (linked by a new unique `SocialMediaPost.blogPostId`) so repeated saves or "Cross-post now" clicks reuse it and its per-account idempotency guards instead of duplicating a live post.

  Because a Facebook Page feed post cannot render the article's HTML, the body is converted from Markdown to the closest faithful plain text — paragraphs and line breaks kept, lists turned to bullets, headings and emphasis markers stripped to their text, links written as "text (url)", and the `[[youtube|vimeo|video:...]]` embeds turned into plain URLs — with the cover image carried by the link preview card. Eligible channels are those that accept a text-plus-link post: Facebook, X/Twitter (a trimmed hook plus the link, since the whole body won't fit 280 characters) and Google Business; Instagram and TikTok are excluded because their publish APIs require uploaded media. Checked channels post automatically on the draft→published transition, alongside the subscriber email, and can also be pushed on demand from the editor. Cross-posting is gated on `content:write`, the same permission the blog editor already requires, so a content admin never needs the broader social permissions.
- **Review-request and abandoned-cart selection logic is now testable** — both crons held their date arithmetic inside the route file, where nothing could reach it. The review-request window has been wrong here before, in a way that was invisible: the "already asked" guard keyed off `confirmationEmailSentAt`, which every successful checkout stamps, so the filter only ever matched orders that never got a confirmation and the cron sent almost nothing.

  Selection and copy move to `lib/orders/review-requests.ts` and `lib/checkout/abandoned-cart.ts`, following the `lib/operations/aging.ts` pattern. The tests pin the parts that fail silently: that the delivery window's bounds are not inverted (an order delivered *longer* ago has the *earlier* timestamp, so the maximum age produces `gte` — reversed, the range is empty and nothing sends); that each abandoned-cart stage measures from the right column, since measuring all three from `updatedAt` would fire the whole sequence in one sweep once a cart was two days old; and that a cart whose stored JSON cannot be priced says "your items" rather than `$0.00` or `$NaN`.

### Added
- **Order notification rules do something** — `OrderNotificationRule` has sat in the schema with **zero code references anywhere**: a table describing which order events should go to which addresses and Slack channels, that nothing read. An admin could describe routing that never occurred. It is now evaluated against the domain events as they happen.

  Deliberately separate from `notifyOperators`, which is the built-in operational floor every operator sees — payment failed, stock out, orders gone stale. These are rules an admin writes, sending named events to named recipients who may not be operators at all: a warehouse address that only wants shipped orders above $200, a Slack channel for large orders. Filters are conjunctive and each is optional, and `minAmount` is inclusive, because a rule written for "$100 and up" that skipped a $100 order reads as broken by whoever wrote it.

  `HIGH_VALUE_ORDER` shares `payment.completed` with `ORDER_PAID` rather than having a fact of its own — "high value" is a threshold on the rule, not a different thing happening. `ORDER_CANCELLED` is deliberately unmapped: `order.cancelled` is in the event catalogue but nothing emits it, so a rule using it would sit in the table looking configured and never fire. One bad address or a revoked Slack webhook costs only itself, never the other recipients or the other half of its own rule. Not idempotent, and it cannot easily be — a rule is an arbitrary recipient list with nowhere to stamp "already told" — which is acceptable because these go to staff and are operational rather than transactional.

- **Restock emails actually get sent** — `createRestockNotification` computes urgency, days of stock remaining and how much to order to cover thirty days of sales, renders an email and writes a `RestockNotification` row. It had no callers, so none of it ever happened: the only thing a low stock level produced was the in-app badge, which says a product is low but not what to do about it.

  It now hangs off `inventory.low` and `inventory.out_of_stock`, with a seven-day per-product cooldown. Stock sits below its threshold continuously until someone restocks and the event fires on every sale that keeps it there, so without the cooldown a slow-moving product would generate a restock email per order — which is how a genuinely useful alert becomes a filter rule. An unrecognised payload is skipped rather than guessed at: re-reading the product could report a different stock level than the one that triggered the alert, putting a wrong number in front of whoever does the ordering.

### Removed
- **The `dashboard-analysis` cron stub** — five lines returning `{success: true}`, referenced by nothing: not scheduled in `vercel.json`, not called from any code, not mentioned in any doc. Unlike every other cron route it also had no authorisation check, so it was a public endpoint that did nothing. Reported in the automation audit and removed with sign-off rather than left to read as a working job.

- **Refunds tell the customer, and `payment.refunded` finally has a producer** — a refund issued through the admin refund form or by settling a return moved the money and told the customer nothing. The only thing that sent that email was an admin manually flipping an order's status to REFUNDED, which is a different action and can happen without any money moving at all.

  `lib/payments/refund.ts` now emits `payment.refunded` when a refund settles at the processor — inside the same transaction, so the fact is durable only if the refund is, and only on SUCCEEDED, because a pending refund has not returned anything yet. That producer did not exist before, which is why `ORDER_REFUNDED` — one of the automation triggers — could never fire. It is now mapped; a trigger wired to a fact nobody emits reads as a working automation and is not one.

  The email reports **what was actually refunded**, taken from the event, rather than the order total: a partial refund on a three-jar order should not tell the customer the whole order came back. Both senders now share `Order.refundEmailSentAt`, so whichever runs first sends and the other stays quiet — without it a customer gets two "your refund was processed" emails for one refund, which reads as two refunds. Orders already refunded are backfilled, so switching this on does not email everyone the shop has ever refunded.

- **POS and manual orders finally confirm themselves to the customer** — three checkout routes and three webhooks each called `sendOrderConfirmationEmail` by hand; the POS and the manual-order form did not. A counter sale or a phone order confirmed nothing to anybody. This is the "same automation, forgotten on the fourth path" bug in its purest form.

  Rather than a fifth hand-wired copy, a consumer listens for the facts and confirms any order that has not been confirmed, which makes the omission structurally impossible on paths added later. It cannot double-send, because `sendOrderConfirmationEmail` stamps `confirmationEmailSentAt` and the consumer checks it first — the web paths stamp it during checkout, long before the five-minute drain reaches their event.

  Two events, because the two families of channel become real at different moments: money arriving for anything taken online or at the terminal, and the order being written down for phone, wholesale and manual sales, where an admin is recording a deal already struck and no later payment fact is coming. Website, PayPal, Square and POS all open an order *before* taking payment, so confirming those at creation would email everyone who abandoned checkout.

  The POS terminal now also emits `payment.completed`, which it never did. That was why the counter was the one path the shop learned nothing from — beyond the missing confirmation, a POS sale raised no new-order notification, enrolled nobody in an automation, and counted toward no fundraiser milestone. All four now work from the one fact.

- **Campaign coordinators hear when a fundraiser opens and when it closes** — `sendCampaignLaunchEmail` and `sendCampaignSummaryEmail` were both written, both correct, and neither had a caller. A coordinator set a fundraiser up and heard nothing when it went live, then heard nothing when it finished — including the totals, which is the one thing they need in order to hand money to a school. A daily `fundraiser-lifecycle` cron announces campaigns that have opened, closes campaigns whose end date has passed, and sends the closing summary.

  This is a sweep rather than a consumer of domain events, and deliberately so: **a campaign ending has no actor.** It is a date passing — no route runs, no request is made, and nothing would ever emit an event for it. Since the sweep has to exist for that, the launch announcement rides along rather than being wired separately into the admin route.

  A first pass at the backfill missed campaigns still marked ACTIVE whose end date had already passed — of which there are plenty, since nothing has ever closed a campaign automatically before. On its first run the sweep ended those and then, finding no marker, mailed a closing summary for a fundraiser that finished months ago. This was caught by running the sweep against the dev database, where it sent one such email before the hole was closed. Pre-existing expired campaigns are now stamped as history rather than news.

  Launch is gated on `startDate` as well as status, so a campaign staged in June to run in September is announced when it opens rather than when an admin saves it. Both emails carry sent-markers rather than being inferred from status, because status moves back and forth while a campaign is edited and a coordinator should not be re-announced each time; the summary keys off its own marker, so a campaign ended by hand in the admin still gets its closing email. Markers are stamped after the send, and the summary sender's failure-by-return-value is respected rather than stamped over — a campaign with no coordinator address retries and stays visible instead of being silently buried. Existing campaigns are backfilled so switching this on does not announce a fundraiser that started in March.

- **Fundraiser participants hear when they hit a milestone** — `sendParticipantMilestoneEmail` existed, rendered, and had no callers: the one piece of the fundraising loop that tells a seller their effort registered anywhere. Passing 5, 10, 25, 50 or 100 sales now sends it.

  Milestones are counted in orders rather than dollars, because a participant selling $10 jars moves in whole jars and "you have made 25 sales" is a number they can check against their own memory. The thresholds thin out on purpose — the early ones are close together because the first few sales are when someone decides whether this is worth doing, and the later ones spread out so a strong seller is not emailed every other afternoon.

  It hangs off `payment.completed` rather than the commission crediting that moves the counter, because `credit-commission` runs inside a transaction and sending email from there would hold it open across a network call. A new `lastMilestoneNotified` column makes it replay-safe under at-least-once delivery, and comparing the highest milestone reached against that marker also collapses a burst of sales into one message instead of one per threshold crossed — twenty-five jars at a school fair is one congratulation, not three. The marker is written *after* the send, so a crash between the two repeats an email rather than losing it. Existing participants are backfilled to whatever they have already passed, so switching this on does not congratulate a whole roster for thresholds crossed weeks ago.

- **Local pickup orders tell the customer they are ready** — a pickup order got no notification at all. The shipped email is sent from the EasyPost tracking webhook, and a pickup order never has a label, so no tracker exists and nothing ever fired. `sendOrderReadyForPickupEmail` was written for exactly this and had no callers.

  It subscribes to `order.fulfilled`, so the notice follows the fact rather than whichever admin route happened to mark the order fulfilled. Shipped orders are filtered out in the same handler rather than through a second code path — they already get their email from the tracking webhook, and sending both would tell one customer both to expect a parcel and to come and collect it. A guest with no name on file is greeted rather than addressed as `undefined`.

- **New order notifications for the shop** — a new order notified nobody, by any mechanism, on any payment path. Three separate attempts existed and all three were unreachable: `notifyAdminsOfNewOrder` had no callers and would have returned early regardless, because it reads `OrderNotificationSetting` — a table with no rows, no seed and no UI to create one; and the admin email sender was called only from `lib/stripe/webhooks.ts`, which nothing imports. A paid order now raises an in-app notification, flags anything above $100 separately, and sends the admin email.

  It subscribes to `payment.completed` rather than being wired into each payment route, so one handler covers Stripe, PayPal and Square — and any path added later. Hand-wiring a fourth copy into each route is the pattern that produced three dead mechanisms in the first place. The high-value flag carries its own dedupe key rather than being a louder version of the first notification, so acknowledging the routine "new order" does not also clear the flag saying this one was unusually large. Both keys derive from the order id, which is what makes the handler safe under the event poller's at-least-once delivery.

  `OrderNotificationSetting` was deliberately not seeded. Reading an empty table for per-operator preferences is what made the original silently do nothing; the threshold is a documented constant matching that column's default, and notifications go through `notifyOperators`, the dispatcher the operations sweep and inventory alerts already use. The three legacy pieces are left in place and reported rather than removed.

- **Domain event consumers** — `lib/domain-events` had thirteen producers and no consumers: sixteen business facts were recorded on every order, payment, shipment and inventory movement, and nothing read them. Every automation was instead hand-wired into the route that caused it, which is why the same automation ended up implemented three times on three payment paths and missing on the fourth. A handler registered against the bus now runs for the fact regardless of which route produced it.

  The first consumer connects the bus to the email automation engine. `EmailAutomation`, its trigger enum, the admin builder and the five-minute drain cron were all complete and correct, but `enrollInAutomation` had no callers — so nobody was ever enrolled and the cron drained an empty queue indefinitely. Four committed facts now map onto triggers: `payment.completed` → `ORDER_PLACED`, `order.fulfilled` → `ORDER_SHIPPED`, `order.delivered` → `ORDER_DELIVERED`, `customer.created` → `USER_REGISTERED`.

  **Handlers are drained by a poller rather than invoked at emit time**, which is what `consumedAt` on `domain_events` is for. Emitters pass their own transaction client — the Stripe webhook marks a payment failed and emits inside one `$transaction` — so running a handler at emit time would act on work that can still roll back and would hold a database transaction open across email sends. A poller only ever sees committed rows, making the hand-off correct by construction. Delivery is therefore at-least-once and handlers must be idempotent; an event is marked consumed only after its handlers finish, so a crash mid-batch replays rather than silently dropping an enrollment. Existing rows are backfilled to consumed so the first poll does not replay the entire order history as though it had just happened.

  Two mappings are deliberately absent rather than plausible-looking no-ops. `ORDER_PLACED` keys off `payment.completed`, not `order.created`, because the checkout, PayPal and Square routes all create the order *before* taking payment — keying a post-purchase series off creation would email people who abandoned at the payment step. And there is no `ORDER_REFUNDED` mapping at all, because nothing emits `payment.refunded` or `refund.completed` today; registering it would read as though refund automations worked.

- **Shipping labels are real postage now** — `app/api/admin/orders/[id]/shipping-label` synthesised `${CARRIER}${Date.now()}` as a tracking number, set `labelUrl` to a download route that **does not exist**, marked the order shipped, fulfilled it, and bought nothing. The fake number reached customers: the account order page renders it and `/track/[trackingNumber]` calls `notFound()` for a code no carrier has heard of. The buy dialog was no better — it built a `mockRates` array client-side from a hard-coded service list and an invented price, so the cost staff approved had no relationship to what a carrier would charge.

  It now creates a shipment and buys it. `trackingCode` is populated as well as `trackingNumber`, which is what makes the EasyPost tracking webhook able to advance the order to delivered — the mock only ever filled the second, so tracking never worked even in principle. The label URL is the carrier's own hosted one, so the missing download route is no longer needed.

  One click is all it takes: the parcel comes from the order's own items through the same packing model that quoted the customer, the origin from the shared resolver, and the cheapest rate is pre-selected. Pinning a carrier, service, rate or hand-measured parcel stays available. Buying twice is refused, and the dialog warns when a label costs more than the customer paid for shipping — which is exactly when Pirate Ship is worth the detour.

- **Jars pack on the warehouse grid** — three side by side make a line, four lines make a case of twelve, one layer deep. The generic volume fit this replaced summed each item's bounding box and picked the smallest carton with more *volume*, which is wrong for cylinders twice over: volume ignores that jars pack in a grid, and six jars do not stack into a jar-shaped space. Three jars now quote as a 9.5″ × 3.5″ × 5.75″ box and a case as 12.5″ × 9.5″ × 5.75″ at 21.4 lb. Every assumption — jar diameter, height, tare, box weight — is a named constant in one file, so correcting one corrects every quote.

- **Postage bought outside the system is a first-class path** — Pirate Ship has no API and better rates than anything reachable programmatically, so buying there and pasting the result back is a way to fulfil an order rather than a workaround. Recording a shipment now captures the service and **what was actually paid**, and writes a `ShippingLabel` row for it; previously the tracking route wrote nothing but a number on the order, so the money spent was invisible and margin treated the shipment as free. `trackingCode` is deliberately left null on those rows — that column means "an EasyPost shipment we can track", and filling it would leave the webhook waiting forever.

- **Returns are self-serve, and the customer pays the return postage** — a request inside the 30-day window is approved on creation, because a customer does not need permission to send something back. They are given the RMA and the warehouse address immediately, and arrange their own carrier. The prepaid-label feature added hours earlier is removed along with its columns: the goods coming back are theirs to send, so there is no label to buy, no cost to front, and nothing to claw back if the parcel never arrives.

  **The refund is goods plus the tax collected on them**, plus the original shipping *only* when the return is our fault — `DAMAGED`, `WRONG_ITEM`, `QUALITY_ISSUE`. Everyone else paid for a delivery that happened. Tax is apportioned by the returned goods' share of the order rather than recomputed, because re-running Stripe Tax would price today's rates against yesterday's sale, and refunding the whole order's tax for one jar would hand back tax never collected on it. Staff can override the shipping decision per return, and the breakdown is itemised on screen before they confirm — "refund due" as a single number hides whether shipping is in it.

- **A version scheme the project will actually use** — `CHANGELOG.md` claimed Semantic Versioning while the repository sat on `2.0.0` for months. That is the honest signal that nobody was reaching for a third number: SemVer's patch component exists so consumers can judge whether an upgrade is safe, and nothing consumes this repository as a package.

  The scheme is now `MAJOR.MINOR` with an optional letter. A large feature bumps the minor (`2.0` → `2.1`); everything smaller takes a letter (`2.1` → `2.1a` → `2.1b`); `2.x` → `3.0` happens only on an explicit instruction and `suggestBump()` cannot return it. A feature bump drops the letter, because the letter counts increments within a minor and means nothing once the minor moves.

  npm still requires valid SemVer, so both exist rather than one being fudged: `projectVersion` in the root `package.json` is canonical (`"2.1a"`) and `version` is derived (`"2.1.1"`). The mapping is positional — the letter's place in the alphabet is the patch number — so it stays monotonic and any tool comparing versions still orders releases correctly. Letters carry past `z` to `aa` rather than wrapping onto a version already released.

  `npm run version:feature|increment|major` bumps every workspace, renames `## [Unreleased]` to the new version with today's date, and opens a fresh one. It refuses when `[Unreleased]` is empty — a version with no changelog section looks like a release nobody documented — and it does not commit, tag or push, because a release that tags itself before anyone reads the diff makes a wrong version number permanent.

- **Return resolutions do something** — `ReturnRequest.resolution` accepted `REFUND`, `EXCHANGE` and `STORE_CREDIT`, stored the choice, displayed it on the return detail page, and never branched on it. Completing a return restocked the resellable units and stopped. So a staff member could resolve a return as an exchange and nothing distinguished it from a refund — except that no refund happened either, because nothing wrote `ReturnRequest.refundId`.

  All three now settle, to the **same value**: `REFUND` issues at the processor, `STORE_CREDIT` issues a gift certificate coded `JMS-CR-…` valid a year, `EXCHANGE` raises a replacement order. Which button staff press changes the form the customer's compensation takes, never the amount.

  A return produces exactly one outcome. Unique columns give at-most-one of each; at-most-one *in total* is a rule they cannot express, so it lives in `lib/orders/return-resolution.ts` with tests — including the case that matters, where someone refunds a customer and then also tries to issue credit for the same goods.

  Settlement runs *before* the status is written. Refusing leaves the return in `RECEIVED`, which is recoverable; recording `COMPLETED` and then failing to pay the customer is not, because `COMPLETED` is terminal and cannot be re-driven.

  The resolution is settable up until the return settles. Customer-raised returns are always created as `REFUND` — the customer is not offered a choice — so without that, store credit and exchange would only ever have been reachable on staff-raised returns.

- **An exchange order is not a sale** — a replacement carries a real `unitCost` against a zero total, because the customer paid for those goods once already on the original order. Left in the sales population it reports a loss on every exchange, blended into product and channel margin, and drags average order value down with a $0 order. `Order.exchangeForReturnId` marks it, and `SALES_ONLY` in `lib/orders/sales-population.ts` is the one definition every revenue query composes — spelled out once because the failure mode is a new report that forgets the clause and quietly disagrees with all the others.

- **Return shipping labels** — a real EasyPost purchase from the customer's address back to the warehouse, cheapest rate by default since the business is paying for its own or the customer's mistake. Refuses rather than guessing on an incomplete warehouse address: EasyPost accepts a partial address and prints an undeliverable label, which a customer discovers when their parcel comes back to them.

  Stored on `ReturnRequest`, deliberately not as a `ShippingLabel` row. `lib/tracking/webhook-handlers.ts` resolves a label to its order and advances that order to shipped and then delivered — a return label in that table would mark the customer's original order **delivered** the moment their return reached the warehouse. Keeping return labels out makes the collision impossible rather than guarded; the cost is that return shipments are not tracked.

  It also does not reuse `app/api/admin/orders/[id]/shipping-label`, because that route never calls the carrier: it synthesises `${CARRIER}${Date.now()}` as a tracking number and a local URL as the label. A label a customer is emailed has to be real.

- **Taxes collected** — `/admin/financials/taxes` reports tax by period and destination state with a CSV export. Tax was charged and stored on every order and nothing read it back.

  Calendar periods, not the rolling `7d`/`30d` keys the other analytics use: a return covers a named month or quarter, and a rolling 90 days cannot be filed against anything. Jurisdiction comes from the shipping address, which is the finest split available — Stripe Tax returns a state/county/city breakdown at checkout but only the order total is persisted, so a county-level report would be null for every order already taken. Refunded orders and orders with no address are counted and called out rather than silently kept or silently dropped.

- **Net revenue after processor fees** on `/admin/financials`. `summariseNetRevenue` had been written and tested and read by nothing, while the page computed revenue minus refunds and called *that* "Net Revenue" — two different figures under one name. The computed one is now labelled **After Refunds**, and the fee-aware figure states its coverage, because a net number quoted while a third of the fees are unknown is gross wearing a different hat.

- **Square processor fees** — the sweep now covers all three providers. `readSquareFee` already parsed the fee array correctly, including negative settlement adjustments; only the API call was missing. Two traps it had to clear: the parser was written against snake_case (`processing_fee`) while the v43 SDK returns camelCase, which would have read as "not settled yet" forever, and the sweep prefers `squarePaymentId` over `providerPaymentId` because on a terminal sale the latter can hold the terminal *checkout* ID, which `payments.get` rejects as not found.

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
- **Admin analytics no longer build raw SQL** — Seven `prisma.$queryRaw` template literals in `app/admin/page.tsx` and `app/admin/growth/page.tsx` are now Prisma aggregates and `groupBy`. CLAUDE.md forbids raw SQL, and the count had been growing: the gap analysis recorded four in the growth page, and the operational dashboard had since picked up the same pattern.

  They were never an injection risk, being parameter-free, but they carried a real bug. Because they grouped only rows that exist, **a month with no orders was absent from the series rather than zero** — so every chart drawn from them joined the months either side of an empty one and showed a trend that had not happened. `lib/analytics/monthly-series.ts` always emits every month in the window, and drops the correlated per-month subqueries that counted the whole `users` table once for each point on a line.

  The one remaining `$queryRaw` is `SELECT 1` in the developer console's connectivity probe, which builds no SQL from data.

- **Refund execution extracted to `lib/payments/refund.ts`** — A refund has four consequences that must all happen or none: the provider call, the `Refund` row, the payment status, and the fundraiser commission clawback. Return completion needed to issue refunds too, and two implementations of that would have drifted on the first change to any of the four. The admin refund route now calls the same function.

- **`/admin/inventory` is in the sidebar.** The page worked and nothing linked to it.

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

### Security
- **Closed every open Dependabot advisory (31) and all but one npm-audit finding, and fixed the
  reason the previous rounds of pinning had not worked.** The repository already carried override
  blocks meant to hold vulnerable transitive packages at patched versions, but three of them sat in
  `apps/storefront/package.json` and `apps/docs/package.json` — and npm only honours `overrides`
  from the *root* package.json of a workspaces monorepo. Those blocks were silently inert, which is
  why advisories against `path-to-regexp`, `ajv`, `smol-toml` and `fast-uri` stayed open while the
  file appeared to address them; the storefront block's `"nodemailer": "$nodemailer"` reference had
  likewise never resolved. The security-relevant pins now live in the root block, which is the only
  place they take effect.

  Patched, all as transitive dependencies: `nanoid` 3.3.16 → 3.3.18, `js-yaml` 3.15.0 → 3.15.1 and
  4.1.1/4.3.0 → 4.3.1, `brace-expansion` 1.1.16 → 1.1.18, 2.1.2 → 2.1.4 and 5.0.8 → 5.0.9, `undici`
  (5.28.4, 5.29.0, 6.27.0, 7.28.0 → 6.28.0/7.29.0, retiring the 5.x line), `fast-uri` 3.1.4 → 3.1.5,
  `minimatch` 10.1.1 → 10.2.5, `esbuild` 0.27.7 → 0.28.1, `effect` 3.17.7 → 3.21.0, `tar` → 7.5.22
  (critical), `path-to-regexp` → 6.3.0/8.4.2, `ajv` → 8.20.0, and `smol-toml` → 1.8.0. `uuid` 8.3.2,
  reachable only through `exceljs`, was raised to 11.1.1; the advisory concerns `v3`/`v5`/`v6` with a
  caller-supplied buffer and `exceljs` calls only `v4()`, so it was never exploitable here, but the
  bump closes the alert rather than leaving it standing on a rationale.

  `@axe-core/cli` was removed from the storefront's devDependencies. It pulled in `chromedriver` and
  `extract-zip`, whose symlink path-traversal advisory has no patched release, and nothing invoked
  it — no npm script, no CI workflow, no config. Deleting the dependency is the only available fix;
  `npx @axe-core/cli` still works if accessibility scanning is wanted later.

  `google-auth-library` is now pinned to a single copy (10.9.1). `google-gax` and `googleapis-common`
  pin it at exactly 10.5.0 while the storefront needs `^10.6.1`, and a second copy makes the two
  `UserRefreshClient` types nominally distinct, which breaks `tsc` in `lib/google-analytics-reports.ts`.

  One advisory is deliberately left open: `deepmerge-ts` is pinned to an exact 7.1.5 by
  `@prisma/config`, so clearing it means forcing a major bump on the Prisma CLI — which runs
  `prisma migrate deploy` during the Vercel build. It is development-scoped, Dependabot has
  auto-dismissed it, and the risk of breaking deploy-time migrations outweighs the finding.

  The lockfile was updated with a targeted `npm update` of the affected packages rather than a full
  regeneration. A clean re-resolve applies the overrides correctly but floats 534 packages to the
  newest version their ranges allow — including Amplitude/rrweb session replay and `@easypost/api` —
  which is a far larger change than a security patch should carry. The targeted update moves 47.

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
