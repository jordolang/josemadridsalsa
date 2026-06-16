# Jose Madrid Salsa — Shopify Theme

An Online Store 2.0 Liquid theme that replicates the look & feel of the Jose Madrid
Salsa Next.js storefront: the salsa / verde / chile palette, Montserrat + Volkhov
typography, the dark hero, heat-level category tiles, featured products, the
"What Sets Us Apart" split, the fundraising CTA band, and the multi-column footer.

This is a **visual port**, not a code port — Shopify renders Liquid against
Shopify's own product/collection/cart data, so the React components were rebuilt as
Liquid sections.

> **Note:** This branch (`claude/sweet-lamport-6x0cq0`) contains *only* the Shopify
> theme, with the theme folders at the repository root so it can be loaded directly
> by Shopify (GitHub integration or `shopify theme push`). The full platform
> monorepo lives on `main`.

## What's included

Core commerce pages:

| Page | Template | Section |
| --- | --- | --- |
| Home | `templates/index.json` | hero, featured-collection, heat-levels, feature-split, cta-band |
| Product | `templates/product.json` | `main-product` |
| Collection | `templates/collection.json` | `main-collection-product-grid` |
| Cart | `templates/cart.json` | `main-cart` |
| All collections | `templates/list-collections.json` | `main-list-collections` |
| Page | `templates/page.json` | `main-page` |
| Search | `templates/search.json` | `main-search` |
| 404 | `templates/404.json` | `main-404` |

Shared chrome: `sections/header.liquid` (mega-menu + mobile drawer) and
`sections/footer.liquid`, wired in `layout/theme.liquid`.

Design tokens live in `assets/theme.css` (ported from `tailwind.config.ts` and
`globals.css`). Interactions (mobile drawer, qty steppers, variant price updates)
are in `assets/theme.js`.

## Setup notes

1. **Install** with the Shopify CLI from this folder:
   ```bash
   shopify theme dev      # live preview against a dev store
   shopify theme push     # upload to a store
   ```
2. **Heat-level badges** read a product metafield `custom.heat_level` with a value
   of `mild`, `medium`, `hot`, or `fruit`. Create that metafield and tag your
   products to get the colored heat badges on cards and product pages.
3. **Featured products** on the home page pull from a collection — set it in the
   theme editor (Home → Featured products → Collection). Until then a placeholder
   grid is shown.
4. **Nav links** in the header point to conventional Shopify routes
   (`/collections/mild`, `/collections/medium`, `/collections/hot`,
   `/collections/fruit`, `/collections/bundles`, `/collections/merchandise`, and
   `/pages/...`). Create those collections/pages, or edit `sections/header.liquid`.
5. **Brand settings** (logo, colors, announcement bar, socials, contact) are under
   Theme settings — defaults match the live site.

## Not included (out of scope for this first pass)

Customer account templates and the rich content pages (Our Story, Fundraising,
Wholesale, Find Us, Heat Index, Recipes). The footer/nav link to them as standard
Shopify pages; build them as `page` templates when needed.
