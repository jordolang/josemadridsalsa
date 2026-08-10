/**
 * Seed the CMS with realistic demo content so the admin screens have something to operate on.
 *
 *   npm run db:seed:cms                    # the database in .env / .env.local
 *   npm run db:seed:cms -- --production    # production, read from .env.vercel.production
 *   npm run db:seed:cms -- --clear         # remove previously seeded rows first
 *
 * **Nothing here changes the public site.** That is deliberate and it is not merely a convention —
 * three of these models render straight to the storefront the moment they exist, so each is held
 * back by the mechanism the code already respects:
 *
 * - Pages, banners, announcements and FAQ items are created `DRAFT`. The public queries filter on
 *   `PUBLISHED`, so a draft is editable and previewable but invisible.
 * - Navigation items are created `isVisible: false`. `getNavigationMenu` filters on visibility and
 *   `getHeaderGroups` returns `undefined` for an empty menu, which is what keeps the built-in
 *   header. The items still appear in the menu editor with their visibility toggle, so the UI is
 *   fully explorable.
 * - `FooterSettings` is the exception: any row at all replaces the built-in footer, because
 *   `getFooterOverrides` only bails when the row is absent. So the values seeded here **mirror the
 *   current hardcoded footer exactly** — the editor gets populated, and the rendered footer does
 *   not change.
 *
 * Every row is tagged so `--clear` can find them again: pages and reusable sections by a `demo-`
 * key or slug prefix, everything else by name.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient, type Prisma } from '@prisma/client'

const args = process.argv.slice(2)
const useProduction = args.includes('--production')
const shouldClear = args.includes('--clear')

function productionUrl(): string {
  const file = '.env.vercel.production'
  for (const key of ['DATABASE_URL_UNPOOLED', 'DATABASE_URL']) {
    for (const line of readFileSync(file, 'utf-8').split('\n')) {
      const match = line.match(new RegExp(`^${key}="?([^"\\n]+)"?$`))
      if (match) return match[1]
    }
  }
  throw new Error(`No database URL found in ${file}. Run: npm run db:production:pull-env`)
}

const prisma = useProduction
  ? new PrismaClient({ datasources: { db: { url: productionUrl() } } })
  : new PrismaClient()

/** Marks every row this script creates, so a re-run or a clear can find them. */
const DEMO_PREFIX = 'demo-'
const DEMO_TAG = '[demo]'

// ---------------------------------------------------------------------------
// Reusable sections — blocks a page can reference instead of copying.
// ---------------------------------------------------------------------------

const reusableSections: Array<{
  key: string
  name: string
  type: string
  data: Prisma.InputJsonValue
}> = [
  {
    key: `${DEMO_PREFIX}newsletter-signup`,
    name: `${DEMO_TAG} Newsletter signup`,
    type: 'newsletter',
    data: {
      heading: 'Get the first taste',
      body: 'New flavours, fundraiser openings and the occasional recipe. About one email a month.',
      buttonText: 'Sign me up',
    },
  },
  {
    key: `${DEMO_PREFIX}fundraiser-cta`,
    name: `${DEMO_TAG} Fundraiser call to action`,
    type: 'cta',
    data: {
      heading: 'Raise money with salsa people actually want',
      body: 'Groups keep half of every jar sold. No upfront cost, no leftover inventory to eat.',
      ctaText: 'Start a fundraiser',
      ctaHref: '/fundraise',
      variant: 'accent',
    },
  },
  {
    key: `${DEMO_PREFIX}our-story`,
    name: `${DEMO_TAG} Our story`,
    type: 'imageText',
    data: {
      heading: 'Made in Zanesville since 1989',
      body: 'Every batch is cooked, tasted and jarred by hand in small runs. If a batch is not right, it does not leave the kitchen — which is the whole reason people keep ordering.',
      imageUrl: '/images/shared/logo-image.png',
      imageAlt: 'Jose Madrid Salsa',
      imagePosition: 'left',
      ctaText: 'Read our story',
      ctaHref: '/about',
    },
  },
  {
    key: `${DEMO_PREFIX}customer-quotes`,
    name: `${DEMO_TAG} Customer quotes`,
    type: 'testimonials',
    data: {
      heading: 'What people say',
      items: [
        {
          quote: 'The Black Bean and Corn is the only salsa my family fights over. I order six jars at a time now.',
          author: 'Dana R.',
          role: 'Columbus, OH',
          imageUrl: '',
        },
        {
          quote: 'Our band raised more in three weeks with these than we did all last year selling coupon books.',
          author: 'Marcus T.',
          role: 'Band Booster President',
          imageUrl: '',
        },
        {
          quote: 'I run a small grocery and this moves faster than the national brands. Customers ask for it by name.',
          author: 'Priya S.',
          role: 'Independent Grocer',
          imageUrl: '',
        },
      ],
    },
  },
  {
    key: `${DEMO_PREFIX}heat-guide`,
    name: `${DEMO_TAG} Heat guide`,
    type: 'richText',
    data: {
      heading: 'How hot is hot?',
      body: 'Mild is all flavour and no burn — safe for anyone at the table. Medium warms the back of your throat and fades. Hot is a real kick that lingers. Extra hot is for people who already know they want it. When in doubt, buy one step milder than you think; nobody ever complained a salsa was too easy to keep eating.',
      alignment: 'left',
    },
  },
]

// ---------------------------------------------------------------------------
// Pages — each a landing page assembled from blocks. All DRAFT.
// ---------------------------------------------------------------------------

interface DemoPage {
  slug: string
  title: string
  seoTitle?: string
  seoDescription?: string
  sections: Array<{ type: string; data: Prisma.InputJsonValue; reusableKey?: string }>
}

const pages: DemoPage[] = [
  {
    slug: `${DEMO_PREFIX}holiday-gift-guide`,
    title: `${DEMO_TAG} Holiday gift guide`,
    seoTitle: 'Salsa gift boxes and holiday sets | Jose Madrid Salsa',
    seoDescription:
      'Hand-packed salsa gift sets for the holidays. Pick a heat level, we pack the box and ship it.',
    sections: [
      {
        type: 'hero',
        data: {
          headline: 'Give a box people actually finish',
          subheadline: 'Six-jar and twelve-jar sets, packed to order and shipped from Ohio.',
          imageUrl: '',
          imageAlt: '',
          ctaText: 'Shop gift sets',
          ctaHref: '/products',
          secondaryCtaText: 'Build your own',
          secondaryCtaHref: '/products',
          alignment: 'center',
        },
      },
      {
        type: 'productGrid',
        data: {
          heading: 'The ones people gift most',
          subheading: 'Safe bets, in order of how often they are re-ordered.',
          source: 'featured',
          categorySlug: '',
          limit: 6,
        },
      },
      { type: 'richText', data: {}, reusableKey: `${DEMO_PREFIX}heat-guide` },
      { type: 'testimonials', data: {}, reusableKey: `${DEMO_PREFIX}customer-quotes` },
      { type: 'newsletter', data: {}, reusableKey: `${DEMO_PREFIX}newsletter-signup` },
    ],
  },
  {
    slug: `${DEMO_PREFIX}wholesale-enquiry`,
    title: `${DEMO_TAG} Wholesale enquiry`,
    seoTitle: 'Wholesale salsa for shops and restaurants | Jose Madrid Salsa',
    seoDescription:
      'Case pricing for grocers, delis and restaurants. Twelve jars to a case, shipped from Zanesville, Ohio.',
    sections: [
      {
        type: 'hero',
        data: {
          headline: 'Stock a salsa customers ask for by name',
          subheadline: 'Twelve jars to a case. Net terms available once you have ordered twice.',
          imageUrl: '',
          imageAlt: '',
          ctaText: 'Request a price list',
          ctaHref: '/wholesale',
          secondaryCtaText: '',
          secondaryCtaHref: '',
          alignment: 'left',
        },
      },
      { type: 'imageText', data: {}, reusableKey: `${DEMO_PREFIX}our-story` },
      {
        type: 'faq',
        data: {
          heading: 'Wholesale questions',
          categorySlug: `${DEMO_PREFIX}wholesale`,
          limit: 10,
        },
      },
      {
        type: 'cta',
        data: {
          heading: 'Ready for a price list?',
          body: 'Tell us roughly how many cases a month and we will send terms the same day.',
          ctaText: 'Contact us',
          ctaHref: '/contact',
          variant: 'muted',
        },
      },
    ],
  },
  {
    slug: `${DEMO_PREFIX}fundraising-explained`,
    title: `${DEMO_TAG} Fundraising explained`,
    seoTitle: 'Salsa fundraisers that keep 50% | Jose Madrid Salsa',
    seoDescription:
      'How a Jose Madrid Salsa fundraiser works: no upfront cost, groups keep half of every jar.',
    sections: [
      {
        type: 'hero',
        data: {
          headline: 'Half of every jar goes to your group',
          subheadline: 'No upfront cost. No boxes of unsold product in somebody’s garage.',
          imageUrl: '',
          imageAlt: '',
          ctaText: 'See how it works',
          ctaHref: '/fundraise',
          secondaryCtaText: 'Talk to us',
          secondaryCtaHref: '/contact',
          alignment: 'center',
        },
      },
      {
        type: 'richText',
        data: {
          heading: 'Three ways to run it',
          body: 'Pre-sell with paper forms and collect once, sell online through your own fundraiser page and let us ship direct, or do both. Most groups start with forms and move online the second time round once they have seen how much less work it is.',
          alignment: 'left',
        },
      },
      { type: 'cta', data: {}, reusableKey: `${DEMO_PREFIX}fundraiser-cta` },
      { type: 'testimonials', data: {}, reusableKey: `${DEMO_PREFIX}customer-quotes` },
      {
        type: 'faq',
        data: {
          heading: 'Fundraising questions',
          categorySlug: `${DEMO_PREFIX}fundraising`,
          limit: 10,
        },
      },
    ],
  },
  {
    slug: `${DEMO_PREFIX}recipes-hub`,
    title: `${DEMO_TAG} Recipes hub`,
    seoTitle: 'What to cook with salsa | Jose Madrid Salsa',
    seoDescription: 'Recipes that use a jar of salsa as the shortcut rather than the garnish.',
    sections: [
      {
        type: 'hero',
        data: {
          headline: 'A jar is a shortcut, not a garnish',
          subheadline: 'Weeknight dinners that start by opening something you already own.',
          imageUrl: '',
          imageAlt: '',
          ctaText: 'Browse recipes',
          ctaHref: '/recipes',
          secondaryCtaText: '',
          secondaryCtaHref: '',
          alignment: 'center',
        },
      },
      { type: 'heatIndex', data: { heading: 'From the Heat Index', subheading: 'Cooking notes and flavour talk.', limit: 3 } },
      { type: 'newsletter', data: {}, reusableKey: `${DEMO_PREFIX}newsletter-signup` },
    ],
  },
]

// ---------------------------------------------------------------------------
// Banners and announcements — one per placement/variant so every case renders.
// ---------------------------------------------------------------------------

const banners = [
  {
    name: `${DEMO_TAG} Holiday gift sets`,
    placement: 'HOMEPAGE_HERO' as const,
    headline: 'Holiday gift sets are packing now',
    body: 'Order by 15 December for delivery before the holidays.',
    ctaText: 'Shop gift sets',
    ctaHref: '/products',
    priority: 10,
    targetPaths: [] as string[],
  },
  {
    name: `${DEMO_TAG} Fundraiser season`,
    placement: 'FUNDRAISING' as const,
    headline: 'Booking autumn fundraisers',
    body: 'Groups keep 50% of every jar. Ten spots left for October starts.',
    ctaText: 'Check availability',
    ctaHref: '/fundraise',
    priority: 5,
    targetPaths: ['/fundraise'],
  },
  {
    name: `${DEMO_TAG} Wholesale case pricing`,
    placement: 'CATEGORY' as const,
    headline: 'Buying for a shop?',
    body: 'Case pricing starts at twelve jars.',
    ctaText: 'See wholesale',
    ctaHref: '/wholesale',
    priority: 1,
    targetPaths: ['/products', '/salsas'],
  },
  {
    name: `${DEMO_TAG} Checkout reassurance`,
    placement: 'CHECKOUT' as const,
    headline: 'Packed to survive the trip',
    body: 'Every jar is dividered and boxed by hand. Breakage is replaced, no questions.',
    ctaText: '',
    ctaHref: '',
    priority: 0,
    targetPaths: [] as string[],
  },
  {
    name: `${DEMO_TAG} Site-wide new flavour`,
    placement: 'SITE_WIDE_TOP' as const,
    headline: 'New: Mango Habanero is back',
    body: 'Small batch, and it goes quickly.',
    ctaText: 'Try it',
    ctaHref: '/salsas',
    priority: 20,
    targetPaths: [] as string[],
  },
]

const announcements = [
  {
    message: 'Free recipe card in every order this month.',
    variant: 'PROMO' as const,
    ctaText: 'Shop now',
    ctaHref: '/products',
    priority: 10,
    dismissible: true,
    targetPaths: [] as string[],
  },
  {
    message: 'Orders placed after 2pm Friday ship the following Monday.',
    variant: 'INFO' as const,
    ctaText: '',
    ctaHref: '',
    priority: 5,
    dismissible: true,
    targetPaths: [] as string[],
  },
  {
    message: 'Winter storm in the Midwest is delaying some deliveries by a day.',
    variant: 'WARNING' as const,
    ctaText: 'Track your order',
    ctaHref: '/track',
    priority: 50,
    dismissible: false,
    targetPaths: [] as string[],
  },
  {
    message: 'Our Zanesville kitchen just passed its annual inspection with no findings.',
    variant: 'SUCCESS' as const,
    ctaText: '',
    ctaHref: '',
    priority: 1,
    dismissible: true,
    targetPaths: ['/about'],
  },
]

// ---------------------------------------------------------------------------
// FAQs — three categories, each with real answers.
// ---------------------------------------------------------------------------

const faqCategories = [
  {
    slug: `${DEMO_PREFIX}shipping`,
    name: `${DEMO_TAG} Shipping & delivery`,
    description: 'How orders are packed, priced and delivered.',
    sortOrder: 0,
    items: [
      {
        question: 'How much is shipping?',
        answer:
          'Shipping is calculated at checkout from the real carrier rate for your address and the weight of your order. Glass is heavy, so a single jar costs nearly as much to ship as it does to buy — most people order three or more at a time for that reason.',
      },
      {
        question: 'Do you offer free shipping?',
        answer:
          'No. Shipping is charged on every order. We would rather quote you the real cost than pad the jar price to hide it.',
      },
      {
        question: 'How are the jars packed?',
        answer:
          'Three jars to a line, up to twelve in a case, each one dividered so nothing touches. If something arrives broken, tell us and we replace it — you do not need to send the pieces back.',
      },
      {
        question: 'When will my order ship?',
        answer:
          'Orders placed before 2pm on a weekday usually go out the same day. Anything after 2pm Friday ships the following Monday.',
      },
      {
        question: 'Can I track it?',
        answer:
          'Yes. You will get a tracking number by email as soon as the label is bought, and you can look it up any time on our tracking page.',
      },
    ],
  },
  {
    slug: `${DEMO_PREFIX}fundraising`,
    name: `${DEMO_TAG} Fundraising`,
    description: 'How a salsa fundraiser works for groups.',
    sortOrder: 1,
    items: [
      {
        question: 'How much does our group keep?',
        answer:
          'Half. Jars sell for $10 on a fundraiser and your group keeps $5 of every one. There is no upfront cost and nothing to pay us if you sell nothing.',
      },
      {
        question: 'Do we have to hold inventory?',
        answer:
          'Only if you want to. Pre-sell with forms and we deliver one consolidated order, or send supporters to your own online fundraiser page and we ship each order direct.',
      },
      {
        question: 'How long does a fundraiser run?',
        answer:
          'Most run two to three weeks. Shorter tends to work better than longer — urgency sells more jars than time does.',
      },
      {
        question: 'What is the minimum?',
        answer:
          'There is no minimum to start. Groups that pre-sell usually land somewhere between 96 and 500 jars.',
      },
    ],
  },
  {
    slug: `${DEMO_PREFIX}wholesale`,
    name: `${DEMO_TAG} Wholesale`,
    description: 'For shops, delis and restaurants.',
    sortOrder: 2,
    items: [
      {
        question: 'What is the case size?',
        answer: 'Twelve jars to a case, and you can mix flavours within a case.',
      },
      {
        question: 'Do you offer net terms?',
        answer:
          'After your second order, yes — net 30. The first two are paid up front while we get to know each other.',
      },
      {
        question: 'What is the shelf life?',
        answer:
          'Eighteen months unopened, stored at room temperature. Every jar is date-coded on the lid.',
      },
      {
        question: 'Can we get shelf talkers or samples?',
        answer:
          'Yes to both. Ask when you order and we will include point-of-sale cards, and we can send a sample case at cost for a first order.',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Navigation — created hidden, so the built-in header and footer are untouched.
// ---------------------------------------------------------------------------

const headerMenu = [
  {
    label: 'Shop',
    href: '/products',
    description: 'Every salsa we make',
    children: [
      { label: 'All salsas', href: '/salsas', description: 'The full range, mild to extra hot' },
      { label: 'Gift sets', href: '/products', description: 'Six and twelve jar boxes' },
      { label: 'Merchandise', href: '/products', description: 'Shirts, hats and aprons' },
    ],
  },
  {
    label: 'Fundraising',
    href: '/fundraise',
    description: 'Keep half of every jar',
    children: [
      { label: 'How it works', href: '/fundraising', description: 'Three ways to run one' },
      { label: 'Start a fundraiser', href: '/fundraise', description: 'Book your dates' },
      { label: 'Group login', href: '/fundraiser-portal', description: 'Track your progress' },
    ],
  },
  {
    label: 'Recipes',
    href: '/recipes',
    description: 'What to cook with a jar',
    children: [
      { label: 'All recipes', href: '/recipes', description: 'Weeknight to weekend' },
      { label: 'The Heat Index', href: '/heat-index', description: 'Our writing on flavour' },
    ],
  },
  {
    label: 'About',
    href: '/about',
    description: 'Zanesville, Ohio, since 1989',
    children: [
      { label: 'Our story', href: '/about', description: 'How this started' },
      { label: 'Where to find us', href: '/where-is-jose', description: 'Shops and shows' },
      { label: 'Contact', href: '/contact', description: 'Talk to a person' },
    ],
  },
]

const footerMenu = [
  {
    label: 'Shop',
    href: '#',
    children: [
      { label: 'All salsas', href: '/salsas' },
      { label: 'Gift sets', href: '/products' },
      { label: 'Wholesale', href: '/wholesale' },
      { label: 'Gift certificates', href: '/gift-certificates' },
    ],
  },
  {
    label: 'Fundraising',
    href: '#',
    children: [
      { label: 'How it works', href: '/fundraising' },
      { label: 'Start a fundraiser', href: '/fundraise' },
      { label: 'Group login', href: '/fundraiser-portal' },
    ],
  },
  {
    label: 'Help',
    href: '#',
    children: [
      { label: 'Shipping', href: '/shipping' },
      { label: 'Returns', href: '/returns' },
      { label: 'Track an order', href: '/track' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    label: 'Company',
    href: '#',
    children: [
      { label: 'Our story', href: '/about' },
      { label: 'Where to find us', href: '/where-is-jose' },
      { label: 'The Heat Index', href: '/heat-index' },
      { label: 'Privacy', href: '/privacy' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Redirects — realistic BigCommerce-era paths worth keeping alive.
// ---------------------------------------------------------------------------

const redirects = [
  { source: '/shop', destination: '/products', permanent: true, note: `${DEMO_TAG} legacy storefront path` },
  { source: '/salsa', destination: '/salsas', permanent: true, note: `${DEMO_TAG} singular slug` },
  { source: '/fundraisers', destination: '/fundraising', permanent: true, note: `${DEMO_TAG} old plural` },
  { source: '/store-locator', destination: '/where-is-jose', permanent: true, note: `${DEMO_TAG} renamed page` },
  { source: '/blog', destination: '/heat-index', permanent: true, note: `${DEMO_TAG} blog renamed to Heat Index` },
  { source: '/holiday', destination: `/${DEMO_PREFIX}holiday-gift-guide`, permanent: false, note: `${DEMO_TAG} seasonal campaign` },
]

// ---------------------------------------------------------------------------

async function clearDemo() {
  console.log('clearing previously seeded demo rows…')
  const { count: sections } = await prisma.reusableSection.deleteMany({
    where: { key: { startsWith: DEMO_PREFIX } },
  })
  const { count: pageCount } = await prisma.page.deleteMany({
    where: { slug: { startsWith: DEMO_PREFIX } },
  })
  const { count: bannerCount } = await prisma.banner.deleteMany({
    where: { name: { startsWith: DEMO_TAG } },
  })
  const { count: annCount } = await prisma.announcement.deleteMany({
    where: { message: { in: announcements.map((a) => a.message) } },
  })
  const { count: faqCount } = await prisma.faqCategory.deleteMany({
    where: { slug: { startsWith: DEMO_PREFIX } },
  })
  const { count: redirectCount } = await prisma.redirect.deleteMany({
    where: { note: { startsWith: DEMO_TAG } },
  })
  console.log(
    ` removed: ${pageCount} pages, ${sections} reusable sections, ${bannerCount} banners, ` +
      `${annCount} announcements, ${faqCount} FAQ categories, ${redirectCount} redirects`
  )
}

async function main() {
  console.log(`target: ${useProduction ? 'PRODUCTION' : 'local (.env)'}\n`)

  if (shouldClear) await clearDemo()

  // Reusable sections first — pages reference them by key.
  const sectionIdByKey = new Map<string, string>()
  for (const section of reusableSections) {
    const row = await prisma.reusableSection.upsert({
      where: { key: section.key },
      create: { ...section, status: 'PUBLISHED' },
      update: { name: section.name, type: section.type, data: section.data },
      select: { id: true, key: true },
    })
    sectionIdByKey.set(row.key, row.id)
  }
  console.log(`reusable sections: ${sectionIdByKey.size}`)

  // Pages, each rebuilt from scratch so a re-run is idempotent.
  for (const page of pages) {
    const existing = await prisma.page.findUnique({ where: { slug: page.slug }, select: { id: true } })
    if (existing) {
      await prisma.pageSection.deleteMany({ where: { pageId: existing.id } })
    }

    const row = await prisma.page.upsert({
      where: { slug: page.slug },
      create: {
        slug: page.slug,
        title: page.title,
        kind: 'LANDING',
        // Draft: editable and previewable in the admin, invisible to the public.
        status: 'DRAFT',
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
      },
      update: { title: page.title, seoTitle: page.seoTitle, seoDescription: page.seoDescription },
      select: { id: true },
    })

    await prisma.pageSection.createMany({
      data: page.sections.map((section, index) => ({
        pageId: row.id,
        type: section.type,
        sortOrder: index,
        isVisible: true,
        data: section.reusableKey ? {} : section.data,
        reusableSectionId: section.reusableKey ? sectionIdByKey.get(section.reusableKey) : null,
      })),
    })
  }
  console.log(`pages: ${pages.length} (draft), sections: ${pages.reduce((n, p) => n + p.sections.length, 0)}`)

  // Banners — one per placement so every rendering path has something to show.
  for (const banner of banners) {
    const found = await prisma.banner.findFirst({ where: { name: banner.name }, select: { id: true } })
    if (found) {
      await prisma.banner.update({ where: { id: found.id }, data: { ...banner, status: 'DRAFT' } })
    } else {
      await prisma.banner.create({ data: { ...banner, status: 'DRAFT' } })
    }
  }
  console.log(`banners: ${banners.length} (draft, one per placement)`)

  for (const announcement of announcements) {
    const found = await prisma.announcement.findFirst({
      where: { message: announcement.message },
      select: { id: true },
    })
    if (found) {
      await prisma.announcement.update({ where: { id: found.id }, data: { ...announcement, status: 'DRAFT' } })
    } else {
      await prisma.announcement.create({ data: { ...announcement, status: 'DRAFT' } })
    }
  }
  console.log(`announcements: ${announcements.length} (draft, one per variant)`)

  let faqItemCount = 0
  for (const category of faqCategories) {
    const { items, ...rest } = category
    const row = await prisma.faqCategory.upsert({
      where: { slug: rest.slug },
      create: rest,
      update: { name: rest.name, description: rest.description, sortOrder: rest.sortOrder },
      select: { id: true },
    })
    await prisma.faqItem.deleteMany({ where: { categoryId: row.id } })
    await prisma.faqItem.createMany({
      data: items.map((item, index) => ({
        categoryId: row.id,
        question: item.question,
        answer: item.answer,
        sortOrder: index,
        // Draft so the FAQ block renders nothing publicly until they are approved.
        status: 'DRAFT',
      })),
    })
    faqItemCount += items.length
  }
  console.log(`FAQ: ${faqCategories.length} categories, ${faqItemCount} items (draft)`)

  // Navigation. Items are created hidden: `getNavigationMenu` filters on `isVisible`, and an
  // empty menu makes `getHeaderGroups` return undefined, which is what leaves the built-in
  // header in place. Toggle any item visible in the editor to take the CMS menu live.
  let navItemCount = 0
  for (const [location, tree] of [
    ['HEADER', headerMenu],
    ['FOOTER', footerMenu],
  ] as const) {
    const menu = await prisma.navigationMenu.upsert({
      where: { location },
      create: { location, name: `${DEMO_TAG} ${location === 'HEADER' ? 'Main navigation' : 'Footer columns'}` },
      update: {},
      select: { id: true },
    })
    await prisma.navigationItem.deleteMany({ where: { menuId: menu.id } })

    for (const [index, group] of tree.entries()) {
      const parent = await prisma.navigationItem.create({
        data: {
          menuId: menu.id,
          label: group.label,
          href: group.href,
          description: 'description' in group ? group.description : null,
          sortOrder: index,
          isVisible: false,
        },
        select: { id: true },
      })
      navItemCount += 1

      await prisma.navigationItem.createMany({
        data: group.children.map((child, childIndex) => ({
          menuId: menu.id,
          parentId: parent.id,
          label: child.label,
          href: child.href,
          description: 'description' in child ? (child.description as string) : null,
          sortOrder: childIndex,
          isVisible: false,
        })),
      })
      navItemCount += group.children.length
    }
  }
  console.log(`navigation: 2 menus, ${navItemCount} items (all hidden — public nav unchanged)`)

  // Footer settings. Any row at all overrides the built-in footer, so these values mirror the
  // current hardcoded content exactly: the editor gets populated and the rendered footer does not
  // change. Edit freely from the admin once you want it to differ.
  const footerExisting = await prisma.footerSettings.findFirst({ select: { id: true } })
  const footerData = {
    tagline: 'Crafted in Ohio • Fresh batches every week',
    aboutText:
      'Handcrafted, small-batch salsas made in Ohio since 1989. We partner with families, fundraisers, and retail shops across the Midwest.',
    copyrightText: `© ${new Date().getFullYear()} Jose Madrid Salsa. All rights reserved.`,
    newsletterHeading: 'Get the first taste',
    newsletterBody: 'New flavours and fundraiser openings. About one email a month.',
    // All four, matching the built-in list exactly. `overrides.socialLinks` *replaces* the
    // built-in array rather than merging, so omitting Google would silently drop the review link
    // from the live footer — the kind of change that is easy to ship and hard to notice.
    socialLinks: {
      Facebook: 'https://facebook.com/josemadridsalsa',
      Instagram: 'https://instagram.com/josemadridsalsa',
      X: 'https://twitter.com/josemadridsalsa',
      Google: process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL ?? 'https://g.page/jose-madrid-salsa/review',
    } as Prisma.InputJsonValue,
    contactEmail: 'mike@josemadridsalsa.com',
    contactPhone: '(740) 521-4304',
    addressLines: ['601 Putnam Ave', 'Zanesville, OH 43701'],
  }
  if (footerExisting) {
    await prisma.footerSettings.update({ where: { id: footerExisting.id }, data: footerData })
    console.log('footer settings: updated (mirrors the built-in footer)')
  } else {
    await prisma.footerSettings.create({ data: footerData })
    console.log('footer settings: created (mirrors the built-in footer, so nothing renders differently)')
  }

  for (const redirect of redirects) {
    await prisma.redirect.upsert({
      where: { source: redirect.source },
      create: { ...redirect, isActive: false },
      update: { destination: redirect.destination, note: redirect.note },
      select: { id: true },
    })
  }
  console.log(`redirects: ${redirects.length} (inactive)`)

  console.log('\nAll content is draft or hidden. The public site is unchanged.')
}

main()
  .catch((error) => {
    console.error('seed failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
