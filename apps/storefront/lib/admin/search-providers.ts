import type { Prisma, UserRole } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import {
  classifyQuery,
  digitsOnly,
  extractExcerpt,
  isSearchable,
  MATCH_SCORES,
  rankResults,
  scoreTextMatch,
  searchTargets,
  type QueryShape,
  type SearchEntity,
  type SearchResult,
} from '@/lib/admin/global-search'

/**
 * Every table the admin search box reaches into, in one place.
 *
 * The route used to inline each query, which worked while there were six entities and
 * stopped working the moment "search everything" meant twenty-six. Declaring them as a
 * list keeps the fan-out honest: adding a table is one entry, and the permission it is
 * gated behind sits next to the query rather than in a lookup the reader has to hold in
 * their head.
 *
 * Every provider is permission-gated and only runs when the query's shape could plausibly
 * match it, so a staff member without product access never pays for a product scan and
 * never sees one in their results.
 */

/** What a provider is handed. Precomputed once per search rather than per provider. */
export interface SearchContext {
  /** The raw trimmed query. */
  query: string
  shape: QueryShape
  /** Prisma filter fragment for a case-insensitive substring match. */
  contains: Prisma.StringFilter
  /** The query with separators stripped, for phone columns. */
  digits: string
  /** Rows to take from each table. */
  take: number
}

interface SearchProvider {
  entity: SearchEntity
  /** Permission the operator needs before this table is queried at all. */
  permission: string
  run(ctx: SearchContext): Promise<SearchResult[]>
}

const money = (value: Prisma.Decimal | number | null | undefined) =>
  value == null ? '—' : `$${Number(value).toFixed(2)}`

const lower = (value: string) => value.toLowerCase().replace(/_/g, ' ')

/** Join the parts of a subtitle that survived, or drop the line entirely. */
const parts = (...values: (string | number | null | undefined)[]) =>
  values.filter(Boolean).join(' · ') || null

/** Score a record by its name, falling back to "matched somewhere we did not check". */
const nameScore = (field: string, query: string) =>
  scoreTextMatch(field, query) || MATCH_SCORES.nameContains

/**
 * Score a record whose name did not match, meaning the hit came from a body field. Returns
 * the excerpt alongside so the caller can show the operator what actually matched.
 */
function bodyMatch(
  title: string,
  query: string,
  body: (string | null | undefined)[]
): { score: number; excerpt: string | null } {
  const titleScore = scoreTextMatch(title, query)
  if (titleScore) return { score: titleScore, excerpt: null }

  for (const text of body) {
    const excerpt = extractExcerpt(text, query)
    if (excerpt) return { score: MATCH_SCORES.bodyContains, excerpt }
  }
  return { score: MATCH_SCORES.nameContains, excerpt: null }
}

const PROVIDERS: SearchProvider[] = [
  {
    entity: 'order',
    permission: 'orders:read',
    async run({ query, shape, contains, digits, take }) {
      const orders = await prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: contains },
            { trackingNumber: contains },
            { guestEmail: contains },
            { user: { OR: [{ email: contains }, { name: contains }] } },
            ...(shape === 'phone' ? [{ guestPhone: { contains: digits } }] : []),
          ],
        },
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          guestEmail: true,
          trackingNumber: true,
          user: { select: { name: true, email: true } },
        },
      })

      return orders.map((order) => ({
        entity: 'order' as const,
        id: order.id,
        title: order.orderNumber,
        subtitle: `${order.user?.name ?? order.guestEmail ?? 'Guest'} · ${money(order.total)} · ${lower(order.status)}`,
        href: `/admin/orders/${order.id}`,
        score:
          order.orderNumber.toLowerCase() === query.toLowerCase()
            ? MATCH_SCORES.exactIdentifier
            : order.trackingNumber?.toLowerCase() === query.toLowerCase()
              ? MATCH_SCORES.trackingNumber
              : nameScore(order.orderNumber, query),
      }))
    },
  },

  {
    entity: 'return',
    permission: 'orders:read',
    async run({ query, contains, take }) {
      const returns = await prisma.returnRequest.findMany({
        where: { OR: [{ rmaNumber: contains }, { order: { orderNumber: contains } }] },
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          rmaNumber: true,
          status: true,
          order: { select: { orderNumber: true } },
        },
      })

      return returns.map((r) => ({
        entity: 'return' as const,
        id: r.id,
        title: r.rmaNumber,
        subtitle: `Order ${r.order.orderNumber} · ${lower(r.status)}`,
        href: `/admin/returns/${r.id}`,
        score:
          r.rmaNumber.toLowerCase() === query.toLowerCase()
            ? MATCH_SCORES.exactIdentifier
            : MATCH_SCORES.nameContains,
      }))
    },
  },

  {
    entity: 'customer',
    permission: 'users:read',
    async run({ query, shape, contains, digits, take }) {
      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { email: contains },
            { firstName: contains },
            { lastName: contains },
            { sourceName: contains },
            ...(shape === 'phone' ? [{ phone: { contains: digits } }] : []),
          ],
        },
        take,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          sourceName: true,
          totalOrders: true,
        },
      })

      return customers.map((c) => {
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
        return {
          entity: 'customer' as const,
          id: c.id,
          title: name || c.email,
          subtitle: `${c.email}${c.sourceName ? ` · ${c.sourceName}` : ''} · ${c.totalOrders} order${c.totalOrders === 1 ? '' : 's'}`,
          href: `/admin/customers?search=${encodeURIComponent(c.email)}`,
          score:
            c.email.toLowerCase() === query.toLowerCase()
              ? MATCH_SCORES.exactEmail
              : nameScore(name || c.email, query),
        }
      })
    },
  },

  {
    entity: 'product',
    permission: 'products:read',
    async run({ query, contains, take }) {
      const products = await prisma.product.findMany({
        where: {
          OR: [{ name: contains }, { sku: contains }, { barcode: contains }, { description: contains }],
        },
        take,
        select: { id: true, name: true, sku: true, inventory: true, description: true },
      })

      return products.map((p) => {
        const { score, excerpt } = bodyMatch(p.name, query, [p.description])
        return {
          entity: 'product' as const,
          id: p.id,
          title: p.name,
          subtitle: `${p.sku} · ${p.inventory} in stock`,
          href: `/admin/products/${p.id}`,
          score: p.sku.toLowerCase() === query.toLowerCase() ? MATCH_SCORES.sku : score,
          excerpt,
        }
      })
    },
  },

  {
    entity: 'fundraiser',
    permission: 'orders:read',
    async run({ query, shape, contains, digits, take }) {
      const fundraisers = await prisma.fundraiser.findMany({
        where: {
          OR: [
            { name: contains },
            { organizationName: contains },
            { contactEmail: contains },
            { slug: contains },
            { description: contains },
            { missionStatement: contains },
            ...(shape === 'phone' ? [{ contactPhone: { contains: digits } }] : []),
          ],
        },
        take,
        select: {
          id: true,
          name: true,
          organizationName: true,
          status: true,
          description: true,
          missionStatement: true,
          goal: true,
        },
      })

      return fundraisers.map((f) => {
        const { score, excerpt } = bodyMatch(f.name, query, [f.description, f.missionStatement])
        // A campaign is as often known by the group that runs it as by its own name, so an
        // organization match counts for as much as a name match.
        const orgScore = scoreTextMatch(f.organizationName, query)
        return {
          entity: 'fundraiser' as const,
          id: f.id,
          title: f.name,
          subtitle: `${f.organizationName} · ${lower(f.status)}${f.goal ? ` · goal ${money(f.goal)}` : ''}`,
          href: `/admin/fundraisers/${f.id}`,
          score: Math.max(score, orgScore),
          excerpt,
        }
      })
    },
  },

  {
    entity: 'participant',
    permission: 'orders:read',
    async run({ query, shape, contains, digits, take }) {
      const participants = await prisma.fundraiserParticipant.findMany({
        where: {
          OR: [
            { name: contains },
            { email: contains },
            { referralCode: contains },
            ...(shape === 'phone' ? [{ phone: { contains: digits } }] : []),
          ],
        },
        take,
        select: {
          id: true,
          name: true,
          email: true,
          referralCode: true,
          totalRevenue: true,
          fundraiserId: true,
          fundraiser: { select: { name: true } },
        },
      })

      return participants.map((p) => ({
        entity: 'participant' as const,
        id: p.id,
        title: p.name,
        subtitle: `${p.fundraiser.name} · ${p.email} · ${money(p.totalRevenue)} raised`,
        href: `/admin/fundraisers/${p.fundraiserId}/participants/${p.id}`,
        score:
          p.referralCode.toLowerCase() === query.toLowerCase()
            ? MATCH_SCORES.exactIdentifier
            : nameScore(p.name, query),
      }))
    },
  },

  {
    entity: 'contact',
    permission: 'users:read',
    async run({ query, shape, contains, digits, take }) {
      const contacts = await prisma.fundraiserContact.findMany({
        where: {
          OR: [
            { organizationName: contains },
            { contactName: contains },
            { email: contains },
            { notes: contains },
            ...(shape === 'phone' ? [{ phone: { contains: digits } }] : []),
          ],
        },
        take,
        orderBy: { lastCampaignAt: 'desc' },
        select: {
          id: true,
          organizationName: true,
          contactName: true,
          email: true,
          totalJars: true,
          years: true,
          status: true,
          notes: true,
        },
      })

      return contacts.map((c) => {
        const { score, excerpt } = bodyMatch(c.organizationName, query, [c.notes])
        const years = c.years.length ? ` · ${c.years[0]}–${c.years[c.years.length - 1]}` : ''
        return {
          entity: 'contact' as const,
          id: c.id,
          title: c.organizationName,
          subtitle: `${c.contactName ?? c.email ?? 'No contact'} · ${c.totalJars} jars${years} · ${lower(c.status)}`,
          href: `/admin/fundraisers/contacts?search=${encodeURIComponent(c.organizationName)}`,
          score,
          excerpt,
        }
      })
    },
  },

  {
    entity: 'user',
    permission: 'users:read',
    async run({ query, shape, contains, digits, take }) {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { name: contains },
            { email: contains },
            ...(shape === 'phone' ? [{ phone: { contains: digits } }] : []),
          ],
        },
        take,
        select: { id: true, name: true, email: true, role: true },
      })

      return users.map((u) => ({
        entity: 'user' as const,
        id: u.id,
        title: u.name ?? u.email,
        subtitle: `${u.email} · ${lower(u.role)}`,
        href: `/admin/users/${u.id}`,
        score:
          u.email.toLowerCase() === query.toLowerCase()
            ? MATCH_SCORES.exactEmail
            : nameScore(u.name ?? u.email, query),
      }))
    },
  },

  {
    entity: 'supplier',
    permission: 'inventory:read',
    async run({ query, shape, contains, digits, take }) {
      const suppliers = await prisma.supplier.findMany({
        where: {
          OR: [
            { name: contains },
            { contactName: contains },
            { email: contains },
            { notes: contains },
            ...(shape === 'phone' ? [{ phone: { contains: digits } }] : []),
          ],
        },
        take,
        select: { id: true, name: true, contactName: true, email: true, city: true, state: true, notes: true },
      })

      return suppliers.map((s) => {
        const { score, excerpt } = bodyMatch(s.name, query, [s.notes])
        const where = [s.city, s.state].filter(Boolean).join(', ')

        return {
          entity: 'supplier' as const,
          id: s.id,
          title: s.name,
          subtitle: parts(s.contactName, s.email, where),
          href: '/admin/purchase-orders/suppliers',
          score,
          excerpt,
        }
      })
    },
  },

  {
    entity: 'location',
    permission: 'locations:read',
    async run({ query, shape, contains, digits, take }) {
      const locations = await prisma.retailLocation.findMany({
        where: {
          OR: [
            { businessName: contains },
            { address: contains },
            { city: contains },
            { county: contains },
            { zipCode: contains },
            ...(shape === 'phone' ? [{ phone: { contains: digits } }] : []),
          ],
        },
        take,
        select: { id: true, businessName: true, city: true, state: true, isActive: true },
      })

      return locations.map((l) => ({
        entity: 'location' as const,
        id: l.id,
        title: l.businessName,
        subtitle: `${l.city}, ${l.state}${l.isActive ? '' : ' · inactive'}`,
        href: `/admin/locations/${l.id}/edit`,
        score: nameScore(l.businessName, query),
      }))
    },
  },

  {
    entity: 'event',
    permission: 'events:read',
    async run({ query, contains, take }) {
      const events = await prisma.featuredEvent.findMany({
        where: {
          OR: [
            { title: contains },
            { venue: contains },
            { location: contains },
            { city: contains },
            { address: contains },
            { description: contains },
            { customDescription: contains },
          ],
        },
        take,
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          title: true,
          venue: true,
          city: true,
          state: true,
          startDate: true,
          description: true,
        },
      })

      return events.map((e) => {
        const { score, excerpt } = bodyMatch(e.title, query, [e.description])
        const where = [e.venue, [e.city, e.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
        return {
          entity: 'event' as const,
          id: e.id,
          title: e.title,
          subtitle: `${e.startDate.toISOString().slice(0, 10)}${where ? ` · ${where}` : ''}`,
          href: `/admin/events/${e.id}/edit`,
          score,
          excerpt,
        }
      })
    },
  },

  {
    entity: 'discount',
    permission: 'content:read',
    async run({ query, contains, take }) {
      const codes = await prisma.discountCode.findMany({
        where: { OR: [{ code: contains }, { description: contains }] },
        take,
        select: { id: true, code: true, type: true, value: true, isActive: true, description: true },
      })

      return codes.map((d) => {
        const { score, excerpt } = bodyMatch(d.code, query, [d.description])
        return {
          entity: 'discount' as const,
          id: d.id,
          title: d.code,
          subtitle: `${lower(d.type)} ${d.value} · ${d.isActive ? 'active' : 'inactive'}`,
          href: '/admin/settings/discount-codes',
          score: d.code.toLowerCase() === query.toLowerCase() ? MATCH_SCORES.exactIdentifier : score,
          excerpt,
        }
      })
    },
  },

  {
    /**
     * The business document archive. `extractedText` is searched as well as the filename,
     * which is the only way a scanned order form filed as "img_0421.pdf" is ever found by
     * the organization named inside it — the reason the archive was indexed in the first
     * place. Body hits score below filename hits and carry an excerpt so the operator can
     * see why an oddly named file came back.
     */
    entity: 'document',
    permission: 'analytics:read',
    async run({ query, contains, take }) {
      const documents = await prisma.archiveDocument.findMany({
        where: {
          OR: [
            { filename: contains },
            { path: contains },
            { category: contains },
            { textPreview: contains },
            { extractedText: contains },
          ],
        },
        take,
        orderBy: { year: 'desc' },
        select: {
          id: true,
          filename: true,
          path: true,
          category: true,
          year: true,
          sensitivity: true,
          extractedText: true,
          textPreview: true,
        },
      })

      return documents.map((d) => {
        const { score, excerpt } = bodyMatch(d.filename, query, [d.textPreview, d.extractedText])
        // A scan filed under "03 Fundraisers/Maysville/…" is named by its folder as much as
        // by its filename, so a path hit counts as naming the document, not as body text.
        const pathHit = scoreTextMatch(d.path, query) ? MATCH_SCORES.nameContains : 0
        const sensitive = d.sensitivity === 'SENSITIVE'
        return {
          entity: 'document' as const,
          id: d.id,
          title: d.filename,
          subtitle: `${d.category}${d.year ? ` · ${d.year}` : ''}${sensitive ? ' · sensitive' : ''}`,
          href: `/admin/archive/documents?search=${encodeURIComponent(d.filename)}`,
          score: Math.max(score, pathHit),
          // Sensitive scans — bank statements, payroll, legal — are still matched on their
          // text so they can be found, but the line that matched is not quoted into a
          // palette that opens over whatever page the operator happens to be on. The file
          // itself is one click away for anyone who needs it.
          excerpt: excerpt && sensitive ? 'Matched inside the document text' : excerpt,
        }
      })
    },
  },

  {
    entity: 'training',
    permission: 'ai:view-training',
    async run({ query, contains, take }) {
      const documents = await prisma.trainingDocument.findMany({
        where: {
          OR: [
            { title: contains },
            { description: contains },
            { fileName: contains },
            { notes: contains },
            { content: contains },
          ],
        },
        take,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          content: true,
          status: true,
          category: { select: { name: true } },
        },
      })

      return documents.map((d) => {
        const { score, excerpt } = bodyMatch(d.title, query, [d.description, d.content])
        return {
          entity: 'training' as const,
          id: d.id,
          title: d.title,
          subtitle: `${d.category?.name ?? 'Uncategorized'} · ${lower(d.status)}`,
          href: '/admin/training-data',
          score,
          excerpt,
        }
      })
    },
  },

  {
    entity: 'media',
    permission: 'content:read',
    async run({ query, contains, take }) {
      const media = await prisma.media.findMany({
        where: { OR: [{ filename: contains }, { alt: contains }, { caption: contains }] },
        take,
        orderBy: { createdAt: 'desc' },
        select: { id: true, filename: true, alt: true, caption: true, mimeType: true },
      })

      return media.map((m) => {
        const { score, excerpt } = bodyMatch(m.filename, query, [m.alt, m.caption])
        return {
          entity: 'media' as const,
          id: m.id,
          title: m.filename,
          subtitle: `${m.mimeType}${m.alt ? ` · ${m.alt}` : ''}`,
          href: `/admin/media?search=${encodeURIComponent(m.filename)}`,
          score,
          excerpt,
        }
      })
    },
  },

  {
    entity: 'invoice',
    permission: 'financials:read',
    async run({ query, contains, take }) {
      const invoices = await prisma.invoice.findMany({
        where: { OR: [{ number: contains }, { notes: contains }] },
        take,
        orderBy: { createdAt: 'desc' },
        select: { id: true, number: true, status: true, total: true, dueDate: true, notes: true },
      })

      return invoices.map((i) => {
        const { score, excerpt } = bodyMatch(i.number, query, [i.notes])
        return {
          entity: 'invoice' as const,
          id: i.id,
          title: i.number,
          subtitle: `${money(i.total)} · ${lower(i.status)} · due ${i.dueDate.toISOString().slice(0, 10)}`,
          href: `/admin/invoices/${i.id}`,
          score: i.number.toLowerCase() === query.toLowerCase() ? MATCH_SCORES.exactIdentifier : score,
          excerpt,
        }
      })
    },
  },

  {
    entity: 'purchase-order',
    permission: 'inventory:read',
    async run({ query, contains, take }) {
      const orders = await prisma.purchaseOrder.findMany({
        where: {
          OR: [{ poNumber: contains }, { notes: contains }, { supplier: { name: contains } }],
        },
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          poNumber: true,
          status: true,
          notes: true,
          supplier: { select: { name: true } },
        },
      })

      return orders.map((po) => {
        const { score, excerpt } = bodyMatch(po.poNumber, query, [po.notes])
        return {
          entity: 'purchase-order' as const,
          id: po.id,
          title: po.poNumber,
          subtitle: `${po.supplier.name} · ${lower(po.status)}`,
          href: `/admin/purchase-orders/${po.id}`,
          score: po.poNumber.toLowerCase() === query.toLowerCase() ? MATCH_SCORES.exactIdentifier : score,
          excerpt,
        }
      })
    },
  },

  {
    entity: 'gift-certificate',
    permission: 'gift-certificates:read',
    async run({ query, contains, take }) {
      const certificates = await prisma.giftCertificate.findMany({
        where: {
          OR: [
            { code: contains },
            { purchaserName: contains },
            { purchaserEmail: contains },
            { recipientName: contains },
            { recipientEmail: contains },
            { message: contains },
          ],
        },
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          purchaserName: true,
          recipientName: true,
          balance: true,
          status: true,
          message: true,
        },
      })

      return certificates.map((g) => {
        const { score, excerpt } = bodyMatch(g.code, query, [g.message])
        return {
          entity: 'gift-certificate' as const,
          id: g.id,
          title: g.code,
          subtitle: `${g.purchaserName} → ${g.recipientName} · ${money(g.balance)} left · ${lower(g.status)}`,
          href: `/admin/gift-certificates/${g.id}`,
          score: g.code.toLowerCase() === query.toLowerCase() ? MATCH_SCORES.exactIdentifier : score,
          excerpt,
        }
      })
    },
  },

  {
    entity: 'blog',
    permission: 'content:read',
    async run({ query, contains, take }) {
      const posts = await prisma.blogPost.findMany({
        where: {
          OR: [
            { title: contains },
            { subtitle: contains },
            { slug: contains },
            { excerpt: contains },
            { content: contains },
            { seoTitle: contains },
            { seoDescription: contains },
          ],
        },
        take,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          content: true,
          status: true,
          publishedAt: true,
        },
      })

      return posts.map((p) => {
        const { score, excerpt } = bodyMatch(p.title, query, [p.excerpt, p.content])
        return {
          entity: 'blog' as const,
          id: p.id,
          title: p.title,
          subtitle: `${lower(p.status)}${p.publishedAt ? ` · ${p.publishedAt.toISOString().slice(0, 10)}` : ''}`,
          href: `/admin/blog/posts/${p.slug}`,
          score,
          excerpt,
        }
      })
    },
  },

  {
    entity: 'page',
    permission: 'content:read',
    async run({ query, contains, take }) {
      const pages = await prisma.page.findMany({
        where: {
          OR: [
            { title: contains },
            { slug: contains },
            { seoTitle: contains },
            { seoDescription: contains },
          ],
        },
        take,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, slug: true, title: true, kind: true, status: true },
      })

      return pages.map((p) => ({
        entity: 'page' as const,
        id: p.id,
        title: p.title,
        subtitle: `/${p.slug} · ${lower(p.kind)} · ${lower(p.status)}`,
        href: `/admin/content/pages/${p.slug}`,
        score: nameScore(p.title, query),
      }))
    },
  },

  {
    /** Recipes have no admin editor, so the hit links to the live page it publishes. */
    entity: 'recipe',
    permission: 'content:read',
    async run({ query, contains, take }) {
      const recipes = await prisma.recipe.findMany({
        where: {
          OR: [
            { title: contains },
            { slug: contains },
            { description: contains },
            { category: contains },
          ],
        },
        take,
        select: { id: true, slug: true, title: true, description: true, category: true },
      })

      return recipes.map((r) => {
        const { score, excerpt } = bodyMatch(r.title, query, [r.description])
        return {
          entity: 'recipe' as const,
          id: r.id,
          title: r.title,
          subtitle: r.category,
          href: `/recipes/${r.slug}`,
          score,
          excerpt,
        }
      })
    },
  },

  {
    entity: 'campaign',
    permission: 'content:read',
    async run({ query, contains, take }) {
      const campaigns = await prisma.emailCampaign.findMany({
        where: {
          OR: [
            { name: contains },
            { subject: contains },
            { previewText: contains },
            { notes: contains },
            { fromEmail: contains },
          ],
        },
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          subject: true,
          status: true,
          sentCount: true,
          totalRecipients: true,
          notes: true,
        },
      })

      return campaigns.map((c) => {
        const { score, excerpt } = bodyMatch(c.name, query, [c.subject, c.notes])
        return {
          entity: 'campaign' as const,
          id: c.id,
          title: c.name,
          subtitle: `${c.subject} · ${lower(c.status)} · ${c.sentCount}/${c.totalRecipients} sent`,
          href: `/admin/email-campaigns/${c.id}`,
          score,
          excerpt,
        }
      })
    },
  },

  {
    entity: 'archived-fundraiser',
    permission: 'analytics:read',
    async run({ query, shape, contains, digits, take }) {
      const archived = await prisma.archivedFundraiser.findMany({
        where: {
          OR: [
            { organizationName: contains },
            { submittedBy: contains },
            { contactEmail: contains },
            { sourceFile: contains },
            { notes: contains },
            ...(shape === 'phone' ? [{ contactPhone: { contains: digits } }] : []),
          ],
        },
        take,
        orderBy: { year: 'desc' },
        select: {
          id: true,
          organizationName: true,
          year: true,
          totalJars: true,
          orderCount: true,
          submittedBy: true,
        },
      })

      return archived.map((a) => ({
        entity: 'archived-fundraiser' as const,
        id: a.id,
        title: a.organizationName,
        subtitle: parts(
          a.year,
          a.totalJars != null ? `${a.totalJars} jars` : null,
          a.orderCount != null ? `${a.orderCount} orders` : null,
          a.submittedBy
        ),
        href: `/admin/archive/fundraisers?search=${encodeURIComponent(a.organizationName)}`,
        score: nameScore(a.organizationName, query),
      }))
    },
  },

  {
    entity: 'show-sale',
    permission: 'analytics:read',
    async run({ query, contains, take }) {
      const shows = await prisma.archivedShowSale.findMany({
        where: {
          OR: [
            { showName: contains },
            { salesPerson: contains },
            { dateText: contains },
            { sourceFile: contains },
          ],
        },
        take,
        orderBy: { showDate: 'desc' },
        select: { id: true, showName: true, year: true, sales: true, salesPerson: true },
      })

      return shows.map((s) => ({
        entity: 'show-sale' as const,
        id: s.id,
        title: s.showName,
        subtitle: parts(s.year, s.sales == null ? null : money(s.sales), s.salesPerson),
        href: `/admin/archive/shows?search=${encodeURIComponent(s.showName)}`,
        score: nameScore(s.showName, query),
      }))
    },
  },

  {
    entity: 'mileage',
    permission: 'analytics:read',
    async run({ query, contains, take }) {
      const trips = await prisma.mileageEntry.findMany({
        where: {
          OR: [
            { destination: contains },
            { city: contains },
            { driver: contains },
            { sourceFile: contains },
          ],
        },
        take,
        orderBy: { tripDate: 'desc' },
        select: { id: true, destination: true, tripDate: true, miles: true, driver: true },
      })

      return trips.map((t) => ({
        entity: 'mileage' as const,
        id: t.id,
        title: t.destination,
        subtitle: parts(
          t.tripDate.toISOString().slice(0, 10),
          t.miles != null ? `${t.miles} mi` : null,
          t.driver
        ),
        href: `/admin/archive/mileage?search=${encodeURIComponent(t.destination)}`,
        score: nameScore(t.destination, query),
      }))
    },
  },

  {
    entity: 'ledger',
    permission: 'financials:read',
    async run({ query, contains, take }) {
      const entries = await prisma.ledgerEntry.findMany({
        where: {
          OR: [{ description: contains }, { counterparty: contains }, { memo: contains }],
        },
        take,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          description: true,
          counterparty: true,
          amountCents: true,
          direction: true,
          date: true,
          memo: true,
        },
      })

      return entries.map((e) => {
        const { score, excerpt } = bodyMatch(e.description, query, [e.memo])
        return {
          entity: 'ledger' as const,
          id: e.id,
          title: e.description,
          subtitle: `${e.date.toISOString().slice(0, 10)} · ${lower(e.direction)} ${money(e.amountCents / 100)}${e.counterparty ? ` · ${e.counterparty}` : ''}`,
          href: '/admin/financials/ledger',
          score,
          excerpt,
        }
      })
    },
  },
]

/**
 * Every entity the search box actually reaches. Exported so the free-text fan-out declared
 * in `global-search.ts` can be checked against the providers that back it — an entity
 * listed there with no provider is a section that silently never returns anything.
 */
export const SEARCH_PROVIDER_ENTITIES: SearchEntity[] = PROVIDERS.map((p) => p.entity)

/** Rows taken from each table before ranking. */
export const DEFAULT_PER_ENTITY_LIMIT = 5
/** Results returned to the palette. The full-results page asks for more. */
export const DEFAULT_RESULT_LIMIT = 30

export interface GlobalSearchOptions {
  perEntityLimit?: number
  limit?: number
}

/**
 * Run every provider the operator is allowed to see and the query shape could match.
 *
 * A provider that throws is dropped rather than failing the whole search — a missing table
 * on a partially migrated environment should cost that one section, not the search box.
 */
export async function runGlobalSearch(
  user: { role: UserRole } | null,
  rawQuery: string,
  options: GlobalSearchOptions = {}
): Promise<{ results: SearchResult[]; shape: QueryShape | null }> {
  const query = rawQuery.trim()
  if (!user || !isSearchable(query)) return { results: [], shape: null }

  const shape = classifyQuery(query)
  const targets = new Set(searchTargets(shape))
  const candidates = PROVIDERS.filter((provider) => targets.has(provider.entity))

  // Permissions are resolved once per distinct permission so an entity is only queried if
  // its results could be shown, rather than filtering them out after the database work is
  // already done.
  const permissions = [...new Set(candidates.map((provider) => provider.permission))]
  const granted = new Set(
    (
      await Promise.all(
        permissions.map(async (name) => ((await hasPermission(user, name)) ? name : null))
      )
    ).filter((name): name is string => name !== null)
  )

  const ctx: SearchContext = {
    query,
    shape,
    contains: { contains: query, mode: 'insensitive' },
    digits: digitsOnly(query),
    take: options.perEntityLimit ?? DEFAULT_PER_ENTITY_LIMIT,
  }

  const results = (
    await Promise.all(
      candidates
        .filter((provider) => granted.has(provider.permission))
        .map((provider) =>
          provider.run(ctx).catch((error) => {
            console.error(`[admin-search] ${provider.entity} lookup failed:`, error)
            return [] as SearchResult[]
          })
        )
    )
  ).flat()

  return { results: rankResults(results, options.limit ?? DEFAULT_RESULT_LIMIT), shape }
}
