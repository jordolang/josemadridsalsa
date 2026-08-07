import { z } from 'zod'

/**
 * The block registry.
 *
 * Every editable section on the site — whether it belongs to a hard-coded
 * SYSTEM page (the homepage, About, ...) or a free-form LANDING page composed
 * in the admin — is described here exactly once. The registry is the single
 * source of truth for:
 *
 *   - what fields the admin editor renders,
 *   - what shape `PageSection.data` is allowed to take (validated with Zod),
 *   - the defaults used when an editor adds a fresh section.
 *
 * `systemOnly` blocks wrap behaviour that already exists in the storefront
 * (live product queries, the store locator) and cannot be dropped onto an
 * arbitrary landing page without a matching data source.
 */

/** Field kinds the admin editor knows how to render. */
export type BlockFieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'image'
  | 'link'
  | 'number'
  | 'boolean'
  | 'select'

export interface BlockField {
  name: string
  label: string
  type: BlockFieldType
  help?: string
  /** Only for `select` fields. */
  options?: { value: string; label: string }[]
}

export interface BlockDefinition {
  type: string
  label: string
  description: string
  fields: BlockField[]
  schema: z.ZodTypeAny
  defaults: Record<string, unknown>
  /** Not offered in the "add section" menu for landing pages. */
  systemOnly?: boolean
}

const alignmentOptions = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

const heroSchema = z.object({
  headline: z.string().default(''),
  subheadline: z.string().default(''),
  imageUrl: z.string().default(''),
  imageAlt: z.string().default(''),
  ctaText: z.string().default(''),
  ctaHref: z.string().default(''),
  secondaryCtaText: z.string().default(''),
  secondaryCtaHref: z.string().default(''),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
})

const videoHeroSchema = z.object({
  headline: z.string().default(''),
  subheadline: z.string().default(''),
  videoUrl: z.string().default(''),
  posterUrl: z.string().default(''),
  ctaText: z.string().default(''),
  ctaHref: z.string().default(''),
})

/**
 * The homepage hero is a scroll-scrubbed video with three copy panels that
 * cross-fade as the visitor scrolls, so its fields mirror those panels rather
 * than the single headline a generic hero has.
 */
const homeHeroSchema = z.object({
  panel1Eyebrow: z.string().default(''),
  panel1Title: z.string().default(''),
  panel1Accent: z.string().default(''),
  panel1Body: z.string().default(''),
  panel2Eyebrow: z.string().default(''),
  panel2Title: z.string().default(''),
  panel2Accent: z.string().default(''),
  panel2Body: z.string().default(''),
  panel3Eyebrow: z.string().default(''),
  panel3Title: z.string().default(''),
  panel3Accent: z.string().default(''),
  panel3Body: z.string().default(''),
})

const richTextSchema = z.object({
  heading: z.string().default(''),
  body: z.string().default(''),
  alignment: z.enum(['left', 'center', 'right']).default('left'),
})

const imageTextSchema = z.object({
  heading: z.string().default(''),
  body: z.string().default(''),
  imageUrl: z.string().default(''),
  imageAlt: z.string().default(''),
  imagePosition: z.enum(['left', 'right']).default('left'),
  ctaText: z.string().default(''),
  ctaHref: z.string().default(''),
})

const productGridSchema = z.object({
  heading: z.string().default(''),
  subheading: z.string().default(''),
  source: z.enum(['featured', 'category']).default('featured'),
  categorySlug: z.string().default(''),
  limit: z.number().int().min(1).max(24).default(8),
})

const faqSchema = z.object({
  heading: z.string().default('Frequently asked questions'),
  categorySlug: z.string().default(''),
  limit: z.number().int().min(1).max(50).default(10),
})

const ctaSchema = z.object({
  heading: z.string().default(''),
  body: z.string().default(''),
  ctaText: z.string().default(''),
  ctaHref: z.string().default(''),
  variant: z.enum(['primary', 'muted', 'accent']).default('primary'),
})

const testimonialsSchema = z.object({
  heading: z.string().default(''),
  items: z
    .array(
      z.object({
        quote: z.string().default(''),
        author: z.string().default(''),
        role: z.string().default(''),
        imageUrl: z.string().default(''),
      })
    )
    .default([]),
})

const heatIndexSchema = z.object({
  heading: z.string().default('From the Heat Index'),
  subheading: z.string().default(''),
  limit: z.number().int().min(1).max(12).default(3),
})

const newsletterSchema = z.object({
  heading: z.string().default(''),
  body: z.string().default(''),
  buttonText: z.string().default('Subscribe'),
})

const locationsSchema = z.object({
  heading: z.string().default('Where to find us'),
  subheading: z.string().default(''),
  limit: z.number().int().min(1).max(50).default(12),
})

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    type: 'hero',
    label: 'Hero',
    description: 'Full-width headline, image and call to action.',
    schema: heroSchema,
    defaults: heroSchema.parse({}),
    fields: [
      { name: 'headline', label: 'Headline', type: 'text' },
      { name: 'subheadline', label: 'Subheadline', type: 'textarea' },
      { name: 'imageUrl', label: 'Background image', type: 'image' },
      { name: 'imageAlt', label: 'Image alt text', type: 'text' },
      { name: 'ctaText', label: 'Button text', type: 'text' },
      { name: 'ctaHref', label: 'Button link', type: 'link' },
      { name: 'secondaryCtaText', label: 'Secondary button text', type: 'text' },
      { name: 'secondaryCtaHref', label: 'Secondary button link', type: 'link' },
      { name: 'alignment', label: 'Text alignment', type: 'select', options: alignmentOptions },
    ],
  },
  {
    type: 'videoHero',
    label: 'Video hero',
    description: 'Hero with a looping background video.',
    schema: videoHeroSchema,
    defaults: videoHeroSchema.parse({}),
    fields: [
      { name: 'headline', label: 'Headline', type: 'text' },
      { name: 'subheadline', label: 'Subheadline', type: 'textarea' },
      { name: 'videoUrl', label: 'Video URL', type: 'text' },
      { name: 'posterUrl', label: 'Poster image', type: 'image' },
      { name: 'ctaText', label: 'Button text', type: 'text' },
      { name: 'ctaHref', label: 'Button link', type: 'link' },
    ],
  },
  {
    type: 'homeHero',
    label: 'Homepage hero',
    description: 'The three copy panels that cross-fade over the scrolling hero video.',
    schema: homeHeroSchema,
    defaults: homeHeroSchema.parse({}),
    systemOnly: true,
    fields: [
      { name: 'panel1Eyebrow', label: 'Panel 1 — small label', type: 'text' },
      { name: 'panel1Title', label: 'Panel 1 — headline', type: 'text' },
      {
        name: 'panel1Accent',
        label: 'Panel 1 — highlighted word',
        type: 'text',
        help: 'Shown in gold at the end of the headline.',
      },
      { name: 'panel1Body', label: 'Panel 1 — body', type: 'textarea' },
      { name: 'panel2Eyebrow', label: 'Panel 2 — small label', type: 'text' },
      { name: 'panel2Title', label: 'Panel 2 — headline', type: 'text' },
      { name: 'panel2Accent', label: 'Panel 2 — highlighted word', type: 'text' },
      { name: 'panel2Body', label: 'Panel 2 — body', type: 'textarea' },
      { name: 'panel3Eyebrow', label: 'Panel 3 — small label', type: 'text' },
      { name: 'panel3Title', label: 'Panel 3 — headline', type: 'text' },
      { name: 'panel3Accent', label: 'Panel 3 — highlighted word', type: 'text' },
      { name: 'panel3Body', label: 'Panel 3 — body', type: 'textarea' },
    ],
  },
  {
    type: 'richText',
    label: 'Rich text',
    description: 'A heading and a body of formatted copy.',
    schema: richTextSchema,
    defaults: richTextSchema.parse({}),
    fields: [
      { name: 'heading', label: 'Heading', type: 'text' },
      { name: 'body', label: 'Body', type: 'richtext' },
      { name: 'alignment', label: 'Alignment', type: 'select', options: alignmentOptions },
    ],
  },
  {
    type: 'imageText',
    label: 'Image + text',
    description: 'Image beside a block of copy with an optional button.',
    schema: imageTextSchema,
    defaults: imageTextSchema.parse({}),
    fields: [
      { name: 'heading', label: 'Heading', type: 'text' },
      { name: 'body', label: 'Body', type: 'richtext' },
      { name: 'imageUrl', label: 'Image', type: 'image' },
      { name: 'imageAlt', label: 'Image alt text', type: 'text' },
      {
        name: 'imagePosition',
        label: 'Image position',
        type: 'select',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ],
      },
      { name: 'ctaText', label: 'Button text', type: 'text' },
      { name: 'ctaHref', label: 'Button link', type: 'link' },
    ],
  },
  {
    type: 'productGrid',
    label: 'Product grid',
    description: 'A grid of products, either featured or drawn from a category.',
    schema: productGridSchema,
    defaults: productGridSchema.parse({}),
    fields: [
      { name: 'heading', label: 'Heading', type: 'text' },
      { name: 'subheading', label: 'Subheading', type: 'textarea' },
      {
        name: 'source',
        label: 'Products to show',
        type: 'select',
        options: [
          { value: 'featured', label: 'Featured products' },
          { value: 'category', label: 'From a category' },
        ],
      },
      {
        name: 'categorySlug',
        label: 'Category slug',
        type: 'text',
        help: 'Used when "From a category" is selected.',
      },
      { name: 'limit', label: 'Maximum products', type: 'number' },
    ],
  },
  {
    type: 'faq',
    label: 'FAQ',
    description: 'Accordion of questions pulled from the FAQ manager.',
    schema: faqSchema,
    defaults: faqSchema.parse({}),
    fields: [
      { name: 'heading', label: 'Heading', type: 'text' },
      {
        name: 'categorySlug',
        label: 'FAQ category slug',
        type: 'text',
        help: 'Leave blank to show every published question.',
      },
      { name: 'limit', label: 'Maximum questions', type: 'number' },
    ],
  },
  {
    type: 'cta',
    label: 'Call to action',
    description: 'A short prompt with a single button.',
    schema: ctaSchema,
    defaults: ctaSchema.parse({}),
    fields: [
      { name: 'heading', label: 'Heading', type: 'text' },
      { name: 'body', label: 'Body', type: 'textarea' },
      { name: 'ctaText', label: 'Button text', type: 'text' },
      { name: 'ctaHref', label: 'Button link', type: 'link' },
      {
        name: 'variant',
        label: 'Style',
        type: 'select',
        options: [
          { value: 'primary', label: 'Primary' },
          { value: 'muted', label: 'Muted' },
          { value: 'accent', label: 'Accent' },
        ],
      },
    ],
  },
  {
    type: 'testimonials',
    label: 'Testimonials',
    description: 'Customer quotes.',
    schema: testimonialsSchema,
    defaults: testimonialsSchema.parse({}),
    fields: [{ name: 'heading', label: 'Heading', type: 'text' }],
  },
  {
    type: 'heatIndex',
    label: 'Heat Index posts',
    description: 'Latest posts from the Heat Index blog.',
    schema: heatIndexSchema,
    defaults: heatIndexSchema.parse({}),
    fields: [
      { name: 'heading', label: 'Heading', type: 'text' },
      { name: 'subheading', label: 'Subheading', type: 'textarea' },
      { name: 'limit', label: 'Number of posts', type: 'number' },
    ],
  },
  {
    type: 'newsletter',
    label: 'Newsletter signup',
    description: 'Email capture form.',
    schema: newsletterSchema,
    defaults: newsletterSchema.parse({}),
    fields: [
      { name: 'heading', label: 'Heading', type: 'text' },
      { name: 'body', label: 'Body', type: 'textarea' },
      { name: 'buttonText', label: 'Button text', type: 'text' },
    ],
  },
  {
    type: 'locations',
    label: 'Where to find us',
    description: 'Store locator and upcoming show schedule.',
    schema: locationsSchema,
    defaults: locationsSchema.parse({}),
    systemOnly: true,
    fields: [
      { name: 'heading', label: 'Heading', type: 'text' },
      { name: 'subheading', label: 'Subheading', type: 'textarea' },
      { name: 'limit', label: 'Maximum locations', type: 'number' },
    ],
  },
]

const BLOCKS_BY_TYPE = new Map(BLOCK_DEFINITIONS.map((block) => [block.type, block]))

/** Block metadata without the Zod schemas, safe to send to a client component. */
export interface SerializableBlock {
  type: string
  label: string
  description: string
  fields: BlockField[]
  defaults: Record<string, unknown>
  systemOnly: boolean
}

export function serializableBlocks(): SerializableBlock[] {
  return BLOCK_DEFINITIONS.map((block) => ({
    type: block.type,
    label: block.label,
    description: block.description,
    fields: block.fields,
    defaults: block.defaults,
    systemOnly: Boolean(block.systemOnly),
  }))
}

export function getBlockDefinition(type: string): BlockDefinition | undefined {
  return BLOCKS_BY_TYPE.get(type)
}

/** Blocks an editor may add to a free-form landing page. */
export function composableBlocks(): BlockDefinition[] {
  return BLOCK_DEFINITIONS.filter((block) => !block.systemOnly)
}

/**
 * Validate and normalise a section's stored `data` against its block schema.
 *
 * Unknown block types and malformed payloads must never take a public page
 * down, so this falls back to the block defaults (or an empty object) instead
 * of throwing.
 */
export function parseBlockData(type: string, data: unknown): Record<string, unknown> {
  const definition = getBlockDefinition(type)
  if (!definition) return {}

  const result = definition.schema.safeParse(data ?? {})
  return result.success
    ? (result.data as Record<string, unknown>)
    : { ...definition.defaults }
}
