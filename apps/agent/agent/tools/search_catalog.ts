import { defineTool } from 'eve/tools'
import { z } from 'zod'

const HEAT_LEVELS = ['MILD', 'MEDIUM', 'HOT', 'EXTRA_HOT', 'FRUIT'] as const

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  compareAtPrice: z.number().optional(),
  heatLevel: z.enum(HEAT_LEVELS).nullable(),
  sku: z.string().nullable(),
  inventory: z.number(),
  isFeatured: z.boolean(),
  ingredients: z.array(z.string()),
  category: z
    .object({ id: z.string(), name: z.string(), slug: z.string() })
    .nullable(),
})

/**
 * The storefront's own `/api/products/search` handler, which already applies
 * the `isActive` filter, the heat/price/stock filters, and the pagination
 * contract. Calling it keeps the agent on one definition of "the catalog"
 * instead of a second Prisma client with its own idea of what is for sale.
 */
const STOREFRONT_URL = process.env.STOREFRONT_API_URL ?? 'https://www.josemadridsalsa.com'

export default defineTool({
  description:
    'Search the live Jose Madrid Salsa product catalog. Returns active products with price, heat level, SKU, on-hand inventory, ingredients, and category. Read-only. Use this for any question about what is for sale, what a product costs, how hot it is, or whether it is in stock — never answer those from memory.',
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .optional()
      .describe('Free-text match against name, description, keywords, and SKU.'),
    heatLevel: z
      .enum(HEAT_LEVELS)
      .optional()
      .describe('Restrict to one heat level.'),
    inStockOnly: z
      .boolean()
      .default(false)
      .describe('Only return products with inventory above zero.'),
    featuredOnly: z
      .boolean()
      .default(false)
      .describe('Only return products flagged as featured.'),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
  }),
  outputSchema: z.object({
    products: z.array(productSchema),
    total: z.number(),
    hasMore: z.boolean(),
  }),
  async execute(input, ctx) {
    const params = new URLSearchParams({
      limit: String(input.limit),
      offset: String(input.offset),
    })
    if (input.query) params.set('q', input.query)
    if (input.heatLevel) params.set('heatLevel', input.heatLevel)
    if (input.inStockOnly) params.set('inStock', 'true')
    if (input.featuredOnly) params.set('featured', 'true')

    const url = `${STOREFRONT_URL}/api/products/search?${params}`
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: ctx.abortSignal,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `Catalog search failed: ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`,
      )
    }

    const payload = await response.json()
    const parsed = z
      .object({
        products: z.array(productSchema),
        pagination: z.object({ total: z.number(), hasMore: z.boolean() }),
      })
      .safeParse(payload)

    if (!parsed.success) {
      throw new Error(
        `Catalog search returned an unexpected shape: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      )
    }

    return {
      products: parsed.data.products,
      total: parsed.data.pagination.total,
      hasMore: parsed.data.pagination.hasMore,
    }
  },
})
