/**
 * Every write the desktop admin shell can make.
 *
 * One registry, keyed by the same ids as the form registry in `forms.ts`. A
 * handler owns three things and nothing else: the permission its `/admin`
 * equivalent requires, the Zod schema its values must satisfy, and the write
 * itself. Everything around them — the session, the audit row, the error shape
 * — is done once by `/api/admin/desktop/write`, so a new operation cannot
 * accidentally ship without a permission check or without being logged.
 *
 * Where a path already has real business logic behind it, the handler calls
 * that logic rather than restating it: a manual order is priced by
 * `lib/admin/manual-order.ts` and its stock deducted by
 * `lib/inventory-manager.ts`, exactly as `/api/admin/orders` does. What is
 * written here is the plumbing, never the rules.
 */

import { z } from 'zod'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { adjustInventory, StaleInventoryError } from '@/lib/inventory-manager'
import { canEraseData } from '@/lib/developer/constants'
import { emitOrderCreated } from '@/lib/orders/events'
import {
  buildFulfillmentUpdate,
  fulfillEntireOrder,
  isDerivedTransition,
  recordFulfillmentEvent,
  transitionForOrderStatus,
} from '@/lib/orders/fulfillment'
import { creditFundraiserCommission } from '@/lib/fundraising/credit-commission'
import { creditPurchaseLoyaltyPoints } from '@/lib/loyalty'
import { deriveSalesChannel } from '@/lib/orders/sales-channel'
import {
  duplicateWindowStart,
  generateManualOrderNumber,
  ManualOrderSchema,
  priceManualOrder,
} from '@/lib/admin/manual-order'
import { generatePoNumber } from '@/lib/purchasing/receiving'
import { createInvoice, INVOICE_STATUSES, invoiceLinesSchema, priceInvoiceLines } from '@/lib/invoices/create-invoice'
import { insertRecipientsFromList } from '@/lib/email/recipients'
import { canClearNotification, completeStep, reopenStep } from '@/lib/inbox/resolution'
import { markAllNotificationsRead } from '@/lib/notifications/dispatch'
import { checkPostSeo } from '@/lib/blog/schemas'
import {
  RewardAdminError,
  createReward,
  deleteReward,
  setRewardActive,
  updateReward,
} from '@/lib/loyalty-rewards'
import { rewardInputSchema } from '@/lib/loyalty-rewards-schema'
import { generateGameCode } from '@/lib/arena/game-codes'
import { PRODUCT_IMAGE_LIMIT, slugify, type WriteOpId } from './forms'
import type { DesktopSectionId } from './sections'

// ---------------------------------------------------------------------------
// the contract
// ---------------------------------------------------------------------------

export interface WriteActor {
  id: string
  email: string
  /** Needed where a rule is about the actor's own standing, not a permission. */
  role: string
}

export interface WriteContext {
  actor: WriteActor
  /** The row this operation acts on. Absent for a create. */
  recordId?: string
  /**
   * Whether the actor holds a permission beyond the handler's own.
   *
   * The route checks `handler.permission` before a handler runs, which covers
   * the operations whose gate is the same whatever the operator typed. It is
   * not enough where the *values* decide which permission applies — scheduling
   * a social post rather than drafting it, assigning the DEVELOPER role — so
   * those handlers ask here instead of the route guessing for them.
   */
  can(permission: string): Promise<boolean>
}

export interface WriteOutcome {
  /** One line for the toast — what actually happened, in the past tense. */
  message: string
  /** The record written, so the shell can re-select it after the reload. */
  recordId?: string
  /** Move the window here afterwards, when the write belongs to another list. */
  section?: DesktopSectionId
}

/** A write that failed for a reason the operator can act on. */
export class WriteError extends Error {
  constructor(
    message: string,
    /** The field it belongs to, when it belongs to one. */
    readonly field?: string,
  ) {
    super(message)
    this.name = 'WriteError'
  }
}

export interface WriteHandler {
  /** The permission the matching `/admin` page requires. `null` is staff-only. */
  permission: string | null
  /** For the audit row. */
  entity: string
  action: 'create' | 'update' | 'delete'
  /** True when the operation is meaningless without a record to act on. */
  requiresRecord: boolean
  /**
   * Fields to strip from the audit row's copy of the submitted values.
   *
   * The audit row keeps what was sent so a change can be read back later, which
   * is right for a name or a price and wrong for a secret: a password reaches
   * the handler in the clear and is hashed before it touches the user row, so
   * logging the payload verbatim would leave the only plaintext copy of it
   * sitting in `AuditLog.changes` forever.
   */
  redact: readonly string[]
  /** Validates and runs. Throws `WriteError` for anything the operator caused. */
  execute(values: unknown, context: WriteContext): Promise<WriteOutcome>
}

/** The submitted values as the audit row should keep them. */
export function redactForAudit(values: unknown, redact: readonly string[]): unknown {
  if (redact.length === 0 || values === null || typeof values !== 'object' || Array.isArray(values)) {
    return values ?? null
  }

  const out: Record<string, unknown> = { ...(values as Record<string, unknown>) }
  for (const field of redact) {
    // Only say it was set. Whether a password was part of the change is the
    // thing an audit reader needs; the password itself never is.
    if (out[field] !== undefined && out[field] !== null && out[field] !== '') out[field] = '[redacted]'
  }
  return out
}

function handler<Schema extends z.ZodTypeAny>(config: {
  permission: string | null
  entity: string
  action: 'create' | 'update' | 'delete'
  requiresRecord?: boolean
  redact?: readonly string[]
  schema: Schema
  run: (values: z.output<Schema>, context: WriteContext) => Promise<WriteOutcome>
}): WriteHandler {
  return {
    permission: config.permission,
    entity: config.entity,
    action: config.action,
    requiresRecord: config.requiresRecord ?? config.action !== 'create',
    redact: config.redact ?? [],
    async execute(values, context) {
      const parsed = config.schema.safeParse(values ?? {})
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new WriteError(issue?.message ?? 'That is not a valid value.', issue?.path?.[0]?.toString())
      }
      return config.run(parsed.data, context)
    },
  }
}

// ---------------------------------------------------------------------------
// field helpers
// ---------------------------------------------------------------------------

/** Trimmed, and required to have something in it. */
const required = (label: string) => z.string().trim().min(1, `${label} is required`)

/**
 * Blank is a real answer here, and it means null.
 *
 * `.optional()` before the transform is what makes the key itself optional —
 * a `z.undefined()` member inside the union is not enough in Zod 4, and a
 * handler that demanded every optional key would reject a form the shell had
 * simply not filled in.
 */
const optionalText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    const trimmed = typeof value === 'string' ? value.trim() : ''
    return trimmed.length > 0 ? trimmed : null
  })

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value ? (value as T[number]) : null))

const requiredNumber = (label: string) =>
  z.coerce.number({ message: `${label} must be a number` }).finite(`${label} must be a number`)

const optionalNumber = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  })

const optionalInt = optionalNumber.transform((value) => (value === null ? null : Math.trunc(value)))

/** Checkboxes arrive as booleans; a form replayed from a URL may send strings. */
const boolean = z
  .union([z.boolean(), z.string(), z.null()])
  .optional()
  .transform((value) => value === true || value === 'true' || value === 'on')

/**
 * A `date` input, pinned to midday UTC.
 *
 * A bare `YYYY-MM-DD` parses as midnight UTC, which is the previous evening in
 * Zanesville — a show entered for the 4th would read as the 3rd everywhere the
 * shell formats dates in store time. Midday survives both directions.
 */
function parseDateInput(value: string): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const parsed = new Date(dateOnly ? `${value}T12:00:00.000Z` : value)
  if (Number.isNaN(parsed.getTime())) throw new WriteError('That is not a valid date.')
  return parsed
}

const requiredDate = (label: string) =>
  required(label).transform((value) => parseDateInput(value))

const optionalDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (typeof value !== 'string' || value.trim() === '') return null
    return parseDateInput(value.trim())
  })

/** A comma- or space-separated list typed into one box. */
const stringList = z
  .union([z.string(), z.array(z.string()), z.null()])
  .optional()
  .transform((value) => {
    if (Array.isArray(value)) return value.map((entry) => entry.trim()).filter(Boolean)
    if (typeof value !== 'string') return []
    return value
      .split(/[,\n]/)
      .map((entry) => entry.trim().replace(/^#/, ''))
      .filter(Boolean)
  })

/**
 * The gallery as it should be stored.
 *
 * `images[0]` is the storefront's lead image, and the rest of the app treats the
 * featured URL as a member of the list, so a featured image typed on its own is
 * put at the front rather than left out of the gallery it belongs to — which
 * means it counts against the limit like any other image. A full gallery plus a
 * different featured URL is refused rather than silently trimmed, because the
 * image that would be dropped is one somebody deliberately added.
 */
function galleryFor(images: string[], featuredImage: string | null): string[] {
  const gallery = featuredImage
    ? [featuredImage, ...images.filter((url) => url !== featuredImage)]
    : images

  if (gallery.length > PRODUCT_IMAGE_LIMIT) {
    throw new WriteError(
      `A product can carry ${PRODUCT_IMAGE_LIMIT} images, and the featured one counts. Remove an image and save again.`,
      'images',
    )
  }

  return gallery
}

/**
 * A list of image URLs.
 *
 * `stringList` would take any string at all, and these end up in `src`
 * attributes on the public product page, so each entry has to be a real
 * http(s) URL before it is stored. The hostname is deliberately not checked
 * here: `next.config.mjs` holds the list of hosts the image optimiser will
 * serve, and a second copy of it in this file would be one to keep in step.
 */
const imageList = stringList.refine(
  (urls) => urls.every((url) => /^https?:\/\//i.test(url) && URL.canParse(url)),
  'Every image has to be an http or https URL',
)

const decimal = (value: number) => new Prisma.Decimal(value.toFixed(2))
const optionalDecimal = (value: number | null) => (value === null ? null : decimal(value))

/** Line-item rows from a `lines` repeater. */
const productLines = z
  .array(
    z.object({
      productId: required('Product'),
      quantity: z.coerce.number().int().positive('Quantity must be at least 1'),
      unitPrice: z.coerce.number().min(0, 'Price cannot be negative'),
    }),
  )
  .min(1, 'Add at least one line')

function requireRecord(context: WriteContext): string {
  if (!context.recordId) throw new WriteError('Nothing was selected to act on.')
  return context.recordId
}

/** Turns Prisma's unique-constraint failure into something an operator can fix. */
function friendly(error: unknown, fallback: string): never {
  if (error instanceof WriteError) throw error
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? (error.meta?.target as string[])[0] : undefined
      throw new WriteError(
        target ? `Another record already uses that ${target}.` : 'Another record already uses one of those values.',
        target,
      )
    }
    if (error.code === 'P2025') throw new WriteError('That record no longer exists.')
    if (error.code === 'P2003') throw new WriteError('Something this record points at no longer exists.')
  }
  console.error('[admin-desktop] write failed:', error)
  throw new WriteError(fallback)
}

// ---------------------------------------------------------------------------
// orders
// ---------------------------------------------------------------------------

const orderHandlers: Record<string, WriteHandler> = {
  'order.create': handler({
    permission: 'orders:write',
    entity: 'Order',
    action: 'create',
    schema: z.object({
      email: required('Customer email').email('That is not a valid email'),
      firstName: optionalText,
      lastName: optionalText,
      phone: optionalText,
      salesChannel: z.enum(['MANUAL', 'PHONE', 'WHOLESALE', 'EVENT', 'MARKETPLACE']),
      items: productLines,
      shippingCost: optionalNumber,
      tax: optionalNumber,
      discountAmount: optionalNumber,
      paymentStatus: z.enum(['PENDING', 'PAID']),
      paymentMethod: optionalText,
      notes: optionalText,
    }),
    async run(values, { actor }) {
      // Everything below mirrors `/api/admin/orders`, and deliberately reuses its
      // pricing, its duplicate window and its stock deduction rather than a second
      // opinion about any of them.
      const input = ManualOrderSchema.parse({
        customer: {
          email: values.email,
          firstName: values.firstName ?? undefined,
          lastName: values.lastName ?? undefined,
          phone: values.phone ?? undefined,
        },
        items: values.items,
        salesChannel: values.salesChannel,
        paymentStatus: values.paymentStatus,
        paymentMethod: values.paymentMethod ?? undefined,
        shippingCost: values.shippingCost ?? 0,
        tax: values.tax ?? 0,
        discountAmount: values.discountAmount ?? 0,
        notes: values.notes ?? undefined,
      })

      const products = await prisma.product.findMany({
        where: { id: { in: input.items.map((item) => item.productId) } },
        select: { id: true, name: true, sku: true, price: true, costPrice: true, featuredImage: true },
      })

      if (products.length !== new Set(input.items.map((item) => item.productId)).size) {
        throw new WriteError('One or more of those products could not be found.', 'items')
      }

      const priced = priceManualOrder(
        input,
        new Map(
          products.map((product) => [
            product.id,
            {
              ...product,
              price: Number(product.price),
              costPrice: product.costPrice === null ? null : Number(product.costPrice),
            },
          ]),
        ),
      )

      const now = new Date()
      const duplicate = await prisma.order.findFirst({
        where: {
          guestEmail: input.customer.email.toLowerCase(),
          total: decimal(priced.total),
          createdAt: { gte: duplicateWindowStart(now) },
        },
        select: { orderNumber: true },
      })

      if (duplicate) {
        throw new WriteError(
          `An identical order (${duplicate.orderNumber}) was created moments ago. Change something if this really is a second sale.`,
        )
      }

      const channel = deriveSalesChannel({ explicitChannel: input.salesChannel })

      const order = await prisma.order.create({
        data: {
          orderNumber: generateManualOrderNumber(now, Math.random()),
          guestEmail: input.customer.email.toLowerCase(),
          guestPhone: input.customer.phone,
          subtotal: decimal(priced.subtotal),
          discountAmount: decimal(priced.discountAmount),
          shippingCost: decimal(priced.shippingCost),
          tax: decimal(priced.tax),
          total: decimal(priced.total),
          paymentStatus: input.paymentStatus,
          paymentMethod: input.paymentMethod,
          status: input.paymentStatus === 'PAID' ? 'CONFIRMED' : 'PENDING',
          salesChannel: channel,
          customerNotes: input.notes,
          items: { create: priced.lines },
        },
        select: { id: true, orderNumber: true, total: true },
      })

      // After the order commits, because adjustInventory opens its own transaction.
      for (const line of priced.lines) {
        try {
          await adjustInventory({
            productId: line.productId,
            quantity: -line.quantity,
            type: 'SALE',
            reason: `Manual order ${order.orderNumber}`,
            orderId: order.id,
            userId: actor.id,
          })
        } catch (error) {
          console.error('[admin-desktop] inventory deduction failed:', { orderId: order.id, error })
        }
      }

      await emitOrderCreated({
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        itemCount: priced.lines.length,
        salesChannel: channel,
        actorUserId: actor.id,
      })

      return { message: `Order ${order.orderNumber} created`, recordId: order.id }
    },
  }),

  'order.status': handler({
    permission: 'orders:write',
    entity: 'Order',
    action: 'update',
    schema: z.object({
      status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
      paymentStatus: z.enum([
        'PENDING',
        'PROCESSING',
        'PAID',
        'SUCCEEDED',
        'FAILED',
        'REFUNDED',
        'PARTIALLY_REFUNDED',
        'CANCELED',
      ]),
      salesChannel: z.enum([
        'WEBSITE',
        'POS',
        'FUNDRAISER',
        'WHOLESALE',
        'EVENT',
        'MANUAL',
        'MARKETPLACE',
        'PHONE',
        'IMPORT',
      ]),
      adminNotes: optionalText,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const order = await prisma.order.findUnique({
        where: { id },
        select: { orderNumber: true, status: true, shippedAt: true, deliveredAt: true },
      })
      if (!order) throw new WriteError('That order no longer exists.')

      // Fulfillment is derived from the commercial status, exactly as
      // `/api/admin/orders/[id]/update-status` does it. Stamping the enums here
      // by hand is what let an order claim it had shipped while its items still
      // showed nothing fulfilled, so the form no longer offers the field and
      // `buildFulfillmentUpdate` owns the timestamps.
      const transition = transitionForOrderStatus(values.status, order)
      const fulfillmentUpdate = transition
        ? buildFulfillmentUpdate({ transition, current: order, syncOrderStatus: false })
        : {}

      await prisma.order
        .update({
          where: { id },
          data: {
            status: values.status,
            paymentStatus: values.paymentStatus,
            salesChannel: values.salesChannel,
            adminNotes: values.adminNotes,
            ...fulfillmentUpdate,
          },
        })
        .catch((error) => friendly(error, 'That order could not be updated.'))

      // "Shipped" means every line shipped, so the item quantities are written
      // from the order rather than asserted next to it.
      if (transition && isDerivedTransition(transition)) {
        await fulfillEntireOrder(prisma, id, { via: 'admin-desktop:order.status', createdById: context.actor.id })
      }

      if (transition) {
        await recordFulfillmentEvent({
          orderId: id,
          transition,
          current: order,
          actorUserId: context.actor.id,
          eventPayload: { orderNumber: order.orderNumber, via: 'admin-desktop:order.status' },
        })
      }

      return { message: `Order ${order.orderNumber} updated`, recordId: id }
    },
  }),

  'order.tracking': handler({
    permission: 'orders:write',
    entity: 'Order',
    action: 'update',
    schema: z.object({
      carrierName: optionalText,
      shippingMethod: optionalText,
      trackingNumber: optionalText,
      trackingUrl: optionalText,
      shippedAt: optionalDate,
      estimatedDelivery: optionalDate,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const order = await prisma.order
        .update({
          where: { id },
          data: {
            carrierName: values.carrierName,
            shippingMethod: values.shippingMethod,
            trackingNumber: values.trackingNumber,
            trackingUrl: values.trackingUrl,
            shippedAt: values.shippedAt,
            estimatedDelivery: values.estimatedDelivery,
            // A tracking number is the moment an order stops being unfulfilled.
            fulfillmentStatus: values.trackingNumber ? 'FULFILLED' : undefined,
          },
          select: { orderNumber: true },
        })
        .catch((error) => friendly(error, 'That tracking could not be saved.'))

      return { message: `Tracking saved for ${order.orderNumber}`, recordId: id }
    },
  }),

  'order.markPaid': handler({
    permission: 'orders:write',
    entity: 'Order',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)

      // Marking an order paid is a payment completion like any other, so it owes
      // the same two side effects the checkout routes and the payment webhooks
      // run: the fundraiser's half of the sale, and the customer's points. Both
      // claim their own column first and are safe to call twice; skipping them
      // left the group and the customer permanently short against an order that
      // reads as paid. In the same transaction, so a failed credit takes the
      // payment state back with it.
      const result = await prisma
        .$transaction(async (tx) => {
          const order = await tx.order.update({
            where: { id },
            data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
            select: { orderNumber: true },
          })

          const commission = await creditFundraiserCommission(tx, id)
          const points = await creditPurchaseLoyaltyPoints(tx, id)
          return { orderNumber: order.orderNumber, commission, points }
        })
        .catch((error) => friendly(error, 'That order could not be marked paid.'))

      const credited = [
        result.commission.credited ? `$${result.commission.amount.toFixed(2)} credited to the fundraiser` : null,
        result.points.awarded ? `${result.points.points} points awarded` : null,
      ].filter(Boolean)

      return {
        message: `Order ${result.orderNumber} marked paid${credited.length ? ` · ${credited.join(' · ')}` : ''}`,
        recordId: id,
      }
    },
  }),

  'order.cancel': handler({
    permission: 'orders:write',
    entity: 'Order',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const order = await prisma.order
        .update({
          where: { id },
          data: { status: 'CANCELLED' },
          select: { orderNumber: true },
        })
        .catch((error) => friendly(error, 'That order could not be cancelled.'))

      return { message: `Order ${order.orderNumber} cancelled`, recordId: id }
    },
  }),
}

// ---------------------------------------------------------------------------
// products & inventory
// ---------------------------------------------------------------------------

const productShape = {
  name: required('Name'),
  slug: required('Slug').regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  sku: required('SKU'),
  barcode: optionalText,
  categoryId: required('Category'),
  heatLevel: z.enum(['MILD', 'MEDIUM', 'HOT', 'EXTRA_HOT', 'FRUIT']),
  description: optionalText,
  ingredients: stringList,
  price: requiredNumber('Price').min(0, 'Price cannot be negative'),
  compareAtPrice: optionalNumber,
  costPrice: optionalNumber,
  weight: optionalNumber,
  lowStockThreshold: optionalInt,
  unitsPerCase: optionalInt,
  sortOrder: optionalInt,
  isActive: boolean,
  isFeatured: boolean,
  featuredImage: optionalText,
  images: imageList,
  metaTitle: optionalText,
  metaDescription: optionalText,
  ogImage: optionalText,
  searchKeywords: stringList,
}

const productHandlers: Record<string, WriteHandler> = {
  'product.create': handler({
    permission: 'products:write',
    entity: 'Product',
    action: 'create',
    schema: z.object({ ...productShape, inventory: optionalInt }),
    async run(values, { actor }) {
      const product = await prisma.product
        .create({
          data: {
            name: values.name,
            slug: values.slug,
            sku: values.sku,
            categoryId: values.categoryId,
            heatLevel: values.heatLevel,
            description: values.description,
            price: decimal(values.price),
            compareAtPrice: optionalDecimal(values.compareAtPrice),
            costPrice: optionalDecimal(values.costPrice),
            weight: optionalDecimal(values.weight),
            inventory: values.inventory ?? 0,
            lowStockThreshold: values.lowStockThreshold ?? 5,
            unitsPerCase: values.unitsPerCase ?? 12,
            sortOrder: values.sortOrder ?? 0,
            isActive: values.isActive,
            isFeatured: values.isFeatured,
            featuredImage: values.featuredImage,
            images: galleryFor(values.images, values.featuredImage),
            metaTitle: values.metaTitle,
            metaDescription: values.metaDescription,
            ogImage: values.ogImage,
            searchKeywords: values.searchKeywords,
            barcode: values.barcode,
            ingredients: values.ingredients,
          },
          select: { id: true, name: true, inventory: true },
        })
        .catch((error) => friendly(error, 'That product could not be created.'))

      // Opening stock is a movement like any other, so it leaves a trail.
      if (product.inventory > 0) {
        await adjustInventory({
          productId: product.id,
          quantity: 0,
          type: 'INITIAL',
          reason: 'Opening balance',
          userId: actor.id,
        }).catch(() => undefined)
      }

      return { message: `${product.name} created`, recordId: product.id }
    },
  }),

  'product.edit': handler({
    permission: 'products:write',
    entity: 'Product',
    action: 'update',
    schema: z.object({ ...productShape, inventory: optionalInt, inventoryAt: optionalInt }),
    async run(values, context) {
      const id = requireRecord(context)
      const current = await prisma.product.findUnique({ where: { id }, select: { inventory: true } })
      if (!current) throw new WriteError('That product no longer exists.')

      // The sheet shows the count because that is what anyone opening a product
      // wants to see, but a count is never written straight over: a change is
      // applied as an adjustment below so it lands in the inventory ledger like
      // every other movement.
      //
      // What counts as a change is measured against `inventoryAt` — the count
      // the sheet opened on — and never against a fresh read. The whole seeded
      // form is submitted on every save, so a count that still matches the one
      // it was seeded with is a field nobody touched: comparing it to a fresh
      // read would turn a sale that landed while the sheet was open into a
      // correction and quietly reverse it, and would block an operator who may
      // only edit products from saving a name.
      const wanted = values.inventory
      const opened = values.inventoryAt
      const touched = wanted !== null && opened !== null && wanted !== opened

      if (touched) {
        // Editing a product and moving stock are two permissions in `/admin`,
        // so they stay two here.
        if (!(await context.can('inventory:write'))) {
          throw new WriteError('Changing the count needs the inventory permission.', 'inventory')
        }

        // Refused before anything is written, rather than after the fields have
        // been saved: the adjustment is a second write this handler cannot roll
        // the first one back from, so the failures worth catching are caught
        // while nothing has happened yet.
        if (current.inventory !== opened) {
          throw new WriteError(
            `Stock moved while this was open (it was ${opened}, it is now ${current.inventory}). Reopen the product and set the count again.`,
            'inventory',
          )
        }

        if (wanted < 0) throw new WriteError('A count cannot be negative.', 'inventory')
      }

      const product = await prisma.product
        .update({
          where: { id },
          data: {
            name: values.name,
            slug: values.slug,
            sku: values.sku,
            barcode: values.barcode,
            categoryId: values.categoryId,
            heatLevel: values.heatLevel,
            description: values.description,
            ingredients: values.ingredients,
            price: decimal(values.price),
            compareAtPrice: optionalDecimal(values.compareAtPrice),
            costPrice: optionalDecimal(values.costPrice),
            weight: optionalDecimal(values.weight),
            lowStockThreshold: values.lowStockThreshold ?? undefined,
            unitsPerCase: values.unitsPerCase ?? undefined,
            sortOrder: values.sortOrder ?? undefined,
            isActive: values.isActive,
            isFeatured: values.isFeatured,
            featuredImage: values.featuredImage,
            images: galleryFor(values.images, values.featuredImage),
            metaTitle: values.metaTitle,
            metaDescription: values.metaDescription,
            ogImage: values.ogImage,
            searchKeywords: values.searchKeywords,
          },
          select: { name: true },
        })
        .catch((error) => friendly(error, 'That product could not be saved.'))

      if (!touched) return { message: `${product.name} saved`, recordId: id }

      try {
        await adjustInventory({
          productId: id,
          quantity: wanted - opened,
          type: 'ADJUSTMENT',
          reason: 'Edited on the product sheet',
          userId: context.actor.id,
          // Checked again at the point of the write, because the gap between
          // the read above and this call is small but not nothing.
          expectedPreviousStock: opened,
        })
      } catch (error) {
        if (error instanceof StaleInventoryError) throw new WriteError(error.message, 'inventory')
        throw new WriteError(
          error instanceof Error ? error.message : 'The count could not be changed.',
          'inventory',
        )
      }

      return {
        message: `${product.name} saved, ${wanted} on hand`,
        recordId: id,
      }
    },
  }),

  'product.toggleActive': handler({
    permission: 'products:write',
    entity: 'Product',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const current = await prisma.product.findUnique({ where: { id }, select: { isActive: true, name: true } })
      if (!current) throw new WriteError('That product no longer exists.')

      await prisma.product.update({ where: { id }, data: { isActive: !current.isActive } })
      return {
        message: `${current.name} ${current.isActive ? 'hidden from the store' : 'is live'}`,
        recordId: id,
      }
    },
  }),

  'product.delete': handler({
    permission: 'products:write',
    entity: 'Product',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const product = await prisma.product.findUnique({
        where: { id },
        select: { name: true, _count: { select: { orderItems: true } } },
      })
      if (!product) throw new WriteError('That product no longer exists.')

      // Deleting a product that has been sold would take its order lines with it,
      // so a sold product is retired instead. The operator is told which happened.
      if (product._count.orderItems > 0) {
        await prisma.product.update({ where: { id }, data: { isActive: false } })
        return { message: `${product.name} has been sold before, so it was retired rather than deleted`, recordId: id }
      }

      await prisma.product.delete({ where: { id } }).catch((error) => friendly(error, 'That product could not be deleted.'))
      return { message: `${product.name} deleted` }
    },
  }),

  'inventory.adjust': handler({
    permission: 'inventory:write',
    entity: 'Product',
    action: 'update',
    schema: z.object({
      mode: z.enum(['DELTA', 'SET']),
      amount: z.coerce.number().int('Whole jars only'),
      reason: required('Reason'),
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const product = await prisma.product.findUnique({ where: { id }, select: { name: true, inventory: true } })
      if (!product) throw new WriteError('That product no longer exists.')

      const delta = values.mode === 'SET' ? values.amount - product.inventory : values.amount
      if (delta === 0) return { message: `${product.name} is already at ${product.inventory}`, recordId: id }

      try {
        await adjustInventory({
          productId: id,
          quantity: delta,
          type: 'ADJUSTMENT',
          reason: values.reason,
          userId: context.actor.id,
          // "Set to 20" is a delta computed against the count read above. If a
          // sale or a receipt moves stock before the adjustment lands, that
          // delta produces the wrong total, so the count it was figured on is
          // handed over and a changed one is refused rather than applied. A
          // delta means what it says whatever the current count is, so it does
          // not carry the guard.
          expectedPreviousStock: values.mode === 'SET' ? product.inventory : undefined,
        })
      } catch (error) {
        if (error instanceof StaleInventoryError) throw new WriteError(error.message, 'amount')
        throw new WriteError(error instanceof Error ? error.message : 'That adjustment could not be applied.', 'amount')
      }

      return {
        message: `${product.name}: ${delta > 0 ? '+' : ''}${delta} → ${product.inventory + delta} on hand`,
        recordId: id,
      }
    },
  }),

  'inventory.thresholds': handler({
    permission: 'inventory:write',
    entity: 'Product',
    action: 'update',
    schema: z.object({
      lowStockThreshold: z.coerce.number().int().min(0, 'Cannot be negative'),
      unitsPerCase: z.coerce.number().int().min(1, 'At least one per case'),
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const product = await prisma.product
        .update({
          where: { id },
          data: { lowStockThreshold: values.lowStockThreshold, unitsPerCase: values.unitsPerCase },
          select: { name: true },
        })
        .catch((error) => friendly(error, 'Those thresholds could not be saved.'))

      return { message: `${product.name} reorders at ${values.lowStockThreshold}`, recordId: id }
    },
  }),
}

// ---------------------------------------------------------------------------
// customers
// ---------------------------------------------------------------------------

const customerHandlers: Record<string, WriteHandler> = {
  'customer.create': handler({
    permission: 'users:write',
    entity: 'Customer',
    action: 'create',
    schema: z.object({
      email: required('Email').email('That is not a valid email'),
      firstName: optionalText,
      lastName: optionalText,
      phone: optionalText,
      accountType: z.enum(['STANDARD', 'FUNDRAISING', 'WHOLESALE']),
      source: z.enum(['MANUAL', 'IMPORT', 'GUEST_ORDER', 'REGISTERED']),
      sourceName: optionalText,
      notes: optionalText,
    }),
    async run(values) {
      const customer = await prisma.customer
        .create({
          data: {
            email: values.email.toLowerCase(),
            firstName: values.firstName,
            lastName: values.lastName,
            phone: values.phone,
            accountType: values.accountType,
            source: values.source,
            sourceName: values.sourceName,
            notes: values.notes,
          },
          select: { id: true, email: true },
        })
        .catch((error) => friendly(error, 'That customer could not be created.'))

      return { message: `${customer.email} added`, recordId: customer.id }
    },
  }),

  'customer.edit': handler({
    permission: 'users:write',
    entity: 'Customer',
    action: 'update',
    schema: z.object({
      // No `email`. It is the key order sync, import batches and mailing-list
      // rows join a customer on, so changing it in place detaches the row from
      // its own history and the next sync recreates the old address as a second
      // customer. `/api/admin/customers/[id]` leaves it out for the same reason.
      firstName: optionalText,
      lastName: optionalText,
      phone: optionalText,
      accountType: z.enum(['STANDARD', 'FUNDRAISING', 'WHOLESALE']),
      sourceName: optionalText,
      notes: optionalText,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const customer = await prisma.customer
        .update({
          where: { id },
          data: {
            firstName: values.firstName,
            lastName: values.lastName,
            phone: values.phone,
            accountType: values.accountType,
            sourceName: values.sourceName,
            notes: values.notes,
          },
          select: { email: true },
        })
        .catch((error) => friendly(error, 'That customer could not be saved.'))

      return { message: `${customer.email} saved`, recordId: id }
    },
  }),

  'customer.delete': handler({
    permission: 'users:write',
    entity: 'Customer',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const customer = await prisma.customer
        .delete({ where: { id }, select: { email: true } })
        .catch((error) => friendly(error, 'That customer could not be deleted.'))

      return { message: `${customer.email} deleted` }
    },
  }),
}

// ---------------------------------------------------------------------------
// fundraisers
// ---------------------------------------------------------------------------

const fundraiserShape = {
  name: required('Name'),
  slug: required('Slug').regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  organizationName: required('Organization'),
  contactEmail: required('Coordinator email').email('That is not a valid email'),
  contactPhone: optionalText,
  description: optionalText,
  startDate: requiredDate('Start date'),
  endDate: requiredDate('End date'),
  goal: optionalNumber,
  commissionRate: requiredNumber('Commission').min(0).max(100, 'Between 0 and 100'),
  defaultUnitPrice: requiredNumber('Price per jar').min(0, 'Cannot be negative'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED']),
  fulfillmentMethod: z.enum(['ORDER_FORMS_AND_BULK', 'ONLINE_ONLY']),
  brochureOption: optionalEnum(['PRINT_YOUR_OWN', 'PROFESSIONAL_100'] as const),
  subdomain: optionalText,
  isActive: boolean,
}

const fundraiserHandlers: Record<string, WriteHandler> = {
  'fundraiser.create': handler({
    permission: 'orders:write',
    entity: 'Fundraiser',
    action: 'create',
    schema: z.object(fundraiserShape).refine((values) => values.endDate > values.startDate, {
      message: 'The end date has to be after the start date',
      path: ['endDate'],
    }),
    async run(values) {
      const fundraiser = await prisma.fundraiser
        .create({
          data: {
            name: values.name,
            slug: values.slug,
            organizationName: values.organizationName,
            contactEmail: values.contactEmail,
            contactPhone: values.contactPhone,
            description: values.description,
            startDate: values.startDate,
            endDate: values.endDate,
            goal: optionalDecimal(values.goal),
            commissionRate: decimal(values.commissionRate),
            defaultUnitPrice: decimal(values.defaultUnitPrice),
            status: values.status,
            fulfillmentMethod: values.fulfillmentMethod,
            brochureOption: values.brochureOption,
            subdomain: values.subdomain,
            isActive: values.isActive,
          },
          select: { id: true, name: true },
        })
        .catch((error) => friendly(error, 'That fundraiser could not be created.'))

      return { message: `${fundraiser.name} created`, recordId: fundraiser.id }
    },
  }),

  'fundraiser.edit': handler({
    permission: 'orders:write',
    entity: 'Fundraiser',
    action: 'update',
    schema: z
      .object({ ...fundraiserShape, missionStatement: optionalText })
      .refine((values) => values.endDate > values.startDate, {
        message: 'The end date has to be after the start date',
        path: ['endDate'],
      }),
    async run(values, context) {
      const id = requireRecord(context)
      const fundraiser = await prisma.fundraiser
        .update({
          where: { id },
          data: {
            name: values.name,
            slug: values.slug,
            organizationName: values.organizationName,
            contactEmail: values.contactEmail,
            contactPhone: values.contactPhone,
            description: values.description,
            startDate: values.startDate,
            endDate: values.endDate,
            goal: optionalDecimal(values.goal),
            commissionRate: decimal(values.commissionRate),
            defaultUnitPrice: decimal(values.defaultUnitPrice),
            status: values.status,
            fulfillmentMethod: values.fulfillmentMethod,
            brochureOption: values.brochureOption,
            subdomain: values.subdomain,
            isActive: values.isActive,
            missionStatement: values.missionStatement,
          },
          select: { name: true },
        })
        .catch((error) => friendly(error, 'That fundraiser could not be saved.'))

      return { message: `${fundraiser.name} saved`, recordId: id }
    },
  }),

  'fundraiser.end': handler({
    permission: 'orders:write',
    entity: 'Fundraiser',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const fundraiser = await prisma.fundraiser
        .update({ where: { id }, data: { status: 'ENDED', isActive: false }, select: { name: true } })
        .catch((error) => friendly(error, 'That campaign could not be ended.'))

      return { message: `${fundraiser.name} ended`, recordId: id }
    },
  }),

  'fundraiser.delete': handler({
    permission: 'orders:write',
    entity: 'Fundraiser',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const fundraiser = await prisma.fundraiser.findUnique({
        where: { id },
        select: { name: true, _count: { select: { orders: true } } },
      })
      if (!fundraiser) throw new WriteError('That campaign no longer exists.')
      if (fundraiser._count.orders > 0) {
        throw new WriteError(
          `${fundraiser.name} has ${fundraiser._count.orders} order(s) against it. Cancel it instead of deleting it.`,
        )
      }

      await prisma.fundraiser
        .delete({ where: { id } })
        .catch((error) => friendly(error, 'That campaign could not be deleted.'))
      return { message: `${fundraiser.name} deleted` }
    },
  }),

  'participant.create': handler({
    permission: 'orders:write',
    entity: 'FundraiserParticipant',
    action: 'create',
    schema: z.object({
      fundraiserId: required('Campaign'),
      name: required('Name'),
      email: required('Email').email('That is not a valid email'),
      phone: optionalText,
      referralCode: optionalText,
    }),
    async run(values) {
      // A referral code has to be unique across every campaign, so a blank one is
      // built from the name with a short suffix rather than left to collide.
      const base = slugify(values.name).slice(0, 20) || 'seller'
      const code = values.referralCode ?? `${base}-${Math.random().toString(36).slice(2, 6)}`

      const participant = await prisma.fundraiserParticipant
        .create({
          data: {
            fundraiserId: values.fundraiserId,
            name: values.name,
            email: values.email.toLowerCase(),
            phone: values.phone,
            referralCode: code,
          },
          select: { id: true, name: true, referralCode: true },
        })
        .catch((error) => friendly(error, 'That participant could not be added.'))

      return { message: `${participant.name} added as ${participant.referralCode}`, recordId: participant.id }
    },
  }),

  'participant.edit': handler({
    permission: 'orders:write',
    entity: 'FundraiserParticipant',
    action: 'update',
    schema: z.object({
      name: required('Name'),
      email: required('Email').email('That is not a valid email'),
      phone: optionalText,
      status: z.enum(['ACTIVE', 'INACTIVE']),
      referralCode: required('Referral code'),
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const participant = await prisma.fundraiserParticipant
        .update({
          where: { id },
          data: {
            name: values.name,
            email: values.email.toLowerCase(),
            phone: values.phone,
            status: values.status,
            referralCode: values.referralCode,
          },
          select: { name: true },
        })
        .catch((error) => friendly(error, 'That participant could not be saved.'))

      return { message: `${participant.name} saved`, recordId: id }
    },
  }),

  'participant.delete': handler({
    permission: 'orders:write',
    entity: 'FundraiserParticipant',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const participant = await prisma.fundraiserParticipant.findUnique({
        where: { id },
        select: { name: true, _count: { select: { orders: true } } },
      })
      if (!participant) throw new WriteError('That participant no longer exists.')
      if (participant._count.orders > 0) {
        throw new WriteError(`${participant.name} has sales against them. Mark them inactive instead.`)
      }

      await prisma.fundraiserParticipant
        .delete({ where: { id } })
        .catch((error) => friendly(error, 'That participant could not be removed.'))
      return { message: `${participant.name} removed` }
    },
  }),
}

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------

const eventShape = {
  title: required('Name'),
  venue: optionalText,
  city: optionalText,
  state: optionalText,
  startDate: requiredDate('Start date'),
  endDate: optionalDate,
  eventTimes: optionalText,
  bookingStatus: z.enum([
    'INTERESTED',
    'APPLIED',
    'WAITLISTED',
    'ACCEPTED',
    'CONFIRMED',
    'DECLINED',
    'CANCELLED',
  ]),
  applicationDeadline: optionalDate,
  description: optionalText,
  boothFee: optionalNumber,
  attendance: optionalInt,
  costOfFuel: optionalNumber,
  lodging: optionalNumber,
  meals: optionalNumber,
  isWhereIsJose: boolean,
}

const eventHandlers: Record<string, WriteHandler> = {
  'event.create': handler({
    permission: 'events:write',
    entity: 'FeaturedEvent',
    action: 'create',
    schema: z.object(eventShape),
    async run(values) {
      const event = await prisma.featuredEvent
        .create({
          data: {
            title: values.title,
            venue: values.venue,
            city: values.city,
            state: values.state?.toUpperCase().slice(0, 2) ?? null,
            location: [values.venue, values.city, values.state].filter(Boolean).join(', ') || null,
            startDate: values.startDate,
            endDate: values.endDate,
            eventTimes: values.eventTimes,
            bookingStatus: values.bookingStatus,
            applicationDeadline: values.applicationDeadline,
            description: values.description,
            boothFee: optionalDecimal(values.boothFee),
            attendance: values.attendance,
            costOfFuel: optionalDecimal(values.costOfFuel),
            lodging: optionalDecimal(values.lodging),
            meals: optionalDecimal(values.meals),
            isWhereIsJose: values.isWhereIsJose,
            // The window the show is featured in defaults to the show itself.
            featuredFrom: values.startDate,
            featuredTo: values.endDate,
            source: 'MANUAL',
          },
          select: { id: true, title: true },
        })
        .catch((error) => friendly(error, 'That show could not be created.'))

      return { message: `${event.title} added to the calendar`, recordId: event.id }
    },
  }),

  'event.edit': handler({
    permission: 'events:write',
    entity: 'FeaturedEvent',
    action: 'update',
    schema: z.object(eventShape),
    async run(values, context) {
      const id = requireRecord(context)
      const event = await prisma.featuredEvent
        .update({
          where: { id },
          data: {
            title: values.title,
            venue: values.venue,
            city: values.city,
            state: values.state?.toUpperCase().slice(0, 2) ?? null,
            startDate: values.startDate,
            endDate: values.endDate,
            eventTimes: values.eventTimes,
            bookingStatus: values.bookingStatus,
            applicationDeadline: values.applicationDeadline,
            description: values.description,
            boothFee: optionalDecimal(values.boothFee),
            attendance: values.attendance,
            costOfFuel: optionalDecimal(values.costOfFuel),
            lodging: optionalDecimal(values.lodging),
            meals: optionalDecimal(values.meals),
            isWhereIsJose: values.isWhereIsJose,
            // Says out loud that a person edited this, so a Google sync does not
            // quietly overwrite it with the calendar's copy.
            manuallyModified: true,
          },
          select: { title: true },
        })
        .catch((error) => friendly(error, 'That show could not be saved.'))

      return { message: `${event.title} saved`, recordId: id }
    },
  }),

  'event.financials': handler({
    permission: 'financials:write',
    entity: 'FeaturedEvent',
    action: 'update',
    schema: z.object({
      cashSales: optionalNumber,
      cardSales: optionalNumber,
      boothFee: optionalNumber,
      costOfFuel: optionalNumber,
      lodging: optionalNumber,
      meals: optionalNumber,
      otherExpenses: optionalNumber,
      otherExpensesNote: optionalText,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const event = await prisma.featuredEvent
        .update({
          where: { id },
          data: {
            cashSales: optionalDecimal(values.cashSales),
            cardSales: optionalDecimal(values.cardSales),
            boothFee: optionalDecimal(values.boothFee),
            costOfFuel: optionalDecimal(values.costOfFuel),
            lodging: optionalDecimal(values.lodging),
            meals: optionalDecimal(values.meals),
            otherExpenses: optionalDecimal(values.otherExpenses),
            otherExpensesNote: values.otherExpensesNote,
          },
          select: { title: true },
        })
        .catch((error) => friendly(error, 'Those figures could not be saved.'))

      return { message: `${event.title} financials saved`, recordId: id }
    },
  }),

  'event.delete': handler({
    permission: 'events:write',
    entity: 'FeaturedEvent',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const event = await prisma.featuredEvent
        .delete({ where: { id }, select: { title: true } })
        .catch((error) => friendly(error, 'That show could not be deleted.'))

      return { message: `${event.title} removed from the calendar` }
    },
  }),
}

// ---------------------------------------------------------------------------
// purchasing
// ---------------------------------------------------------------------------

const purchaseHandlers: Record<string, WriteHandler> = {
  'purchase.create': handler({
    permission: 'inventory:write',
    entity: 'PurchaseOrder',
    action: 'create',
    schema: z.object({
      supplierId: required('Supplier'),
      poNumber: optionalText,
      expectedAt: optionalDate,
      shippingCost: optionalNumber,
      // Not the received states: those are derived from receipt quantities by
      // `lib/purchasing/receiving.ts`, and writing one here would leave the PO
      // claiming stock that never arrived.
      status: z.enum(['DRAFT', 'SUBMITTED', 'CANCELLED']),
      notes: optionalText,
      items: productLines,
    }),
    async run(values, { actor }) {
      const now = new Date()
      const order = await prisma.purchaseOrder
        .create({
          data: {
            poNumber: values.poNumber ?? generatePoNumber(now),
            supplierId: values.supplierId,
            status: values.status,
            expectedAt: values.expectedAt,
            submittedAt: values.status === 'DRAFT' ? null : now,
            shippingCost: decimal(values.shippingCost ?? 0),
            notes: values.notes,
            createdById: actor.id,
            items: {
              create: values.items.map((item) => ({
                productId: item.productId,
                quantityOrdered: item.quantity,
                unitCost: decimal(item.unitPrice),
              })),
            },
          },
          select: { id: true, poNumber: true },
        })
        .catch((error) => friendly(error, 'That purchase order could not be created.'))

      return { message: `${order.poNumber} created`, recordId: order.id }
    },
  }),

  'purchase.edit': handler({
    permission: 'inventory:write',
    entity: 'PurchaseOrder',
    action: 'update',
    schema: z.object({
      supplierId: required('Supplier'),
      expectedAt: optionalDate,
      shippingCost: optionalNumber,
      // Not the received states: those are derived from receipt quantities by
      // `lib/purchasing/receiving.ts`, and writing one here would leave the PO
      // claiming stock that never arrived.
      status: z.enum(['DRAFT', 'SUBMITTED', 'CANCELLED']),
      notes: optionalText,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const order = await prisma.purchaseOrder
        .update({
          where: { id },
          data: {
            supplierId: values.supplierId,
            expectedAt: values.expectedAt,
            shippingCost: values.shippingCost === null ? undefined : decimal(values.shippingCost),
            status: values.status,
            notes: values.notes,
          },
          select: { poNumber: true },
        })
        .catch((error) => friendly(error, 'That purchase order could not be saved.'))

      return { message: `${order.poNumber} saved`, recordId: id }
    },
  }),

  'purchase.submit': handler({
    permission: 'inventory:write',
    entity: 'PurchaseOrder',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const order = await prisma.purchaseOrder
        .update({
          where: { id },
          data: { status: 'SUBMITTED', submittedAt: new Date() },
          select: { poNumber: true },
        })
        .catch((error) => friendly(error, 'That purchase order could not be submitted.'))

      return { message: `${order.poNumber} submitted`, recordId: id }
    },
  }),

  'purchase.receive': handler({
    permission: 'inventory:write',
    entity: 'PurchaseOrder',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const order = await prisma.purchaseOrder.findUnique({
        where: { id },
        select: {
          poNumber: true,
          status: true,
          items: { select: { id: true, productId: true, quantityOrdered: true, quantityReceived: true } },
        },
      })
      if (!order) throw new WriteError('That purchase order no longer exists.')
      if (order.status === 'RECEIVED') throw new WriteError(`${order.poNumber} has already been received in full.`)
      if (order.status === 'CANCELLED') throw new WriteError(`${order.poNumber} was cancelled.`)

      const outstanding = order.items
        .map((item) => ({ ...item, remaining: item.quantityOrdered - item.quantityReceived }))
        .filter((item) => item.remaining > 0)

      if (outstanding.length === 0) throw new WriteError(`Nothing is outstanding on ${order.poNumber}.`)

      // The receipt row and the line counters move together; stock moves after,
      // because adjustInventory opens a transaction of its own.
      await prisma.$transaction(async (tx) => {
        await tx.purchaseOrderReceipt.create({
          data: {
            purchaseOrderId: id,
            receivedById: context.actor.id,
            items: {
              create: outstanding.map((item) => ({
                purchaseOrderItemId: item.id,
                quantity: item.remaining,
              })),
            },
          },
        })

        for (const item of outstanding) {
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: { quantityReceived: item.quantityOrdered },
          })
        }

        await tx.purchaseOrder.update({
          where: { id },
          data: { status: 'RECEIVED', receivedAt: new Date() },
        })
      })

      let jars = 0
      for (const item of outstanding) {
        jars += item.remaining
        await adjustInventory({
          productId: item.productId,
          quantity: item.remaining,
          type: 'RESTOCK',
          reason: `Received ${order.poNumber}`,
          purchaseOrderId: id,
          userId: context.actor.id,
        }).catch((error) => {
          console.error('[admin-desktop] restock failed:', { purchaseOrderId: id, error })
        })
      }

      return { message: `${order.poNumber} received — ${jars} unit(s) into stock`, recordId: id }
    },
  }),

  'purchase.cancel': handler({
    permission: 'inventory:write',
    entity: 'PurchaseOrder',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const order = await prisma.purchaseOrder
        .update({
          where: { id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
          select: { poNumber: true },
        })
        .catch((error) => friendly(error, 'That purchase order could not be cancelled.'))

      return { message: `${order.poNumber} cancelled`, recordId: id }
    },
  }),

  'supplier.create': handler({
    permission: 'inventory:write',
    entity: 'Supplier',
    action: 'create',
    schema: z.object({
      name: required('Name'),
      contactName: optionalText,
      email: optionalText,
      phone: optionalText,
      website: optionalText,
      address1: optionalText,
      city: optionalText,
      state: optionalText,
      postalCode: optionalText,
      isActive: boolean,
      notes: optionalText,
    }),
    async run(values) {
      const supplier = await prisma.supplier
        .create({
          data: {
            name: values.name,
            contactName: values.contactName,
            email: values.email,
            phone: values.phone,
            address1: values.address1,
            city: values.city,
            state: values.state,
            postalCode: values.postalCode,
            isActive: values.isActive,
            notes: values.notes,
          },
          select: { id: true, name: true },
        })
        .catch((error) => friendly(error, 'That supplier could not be created.'))

      return { message: `${supplier.name} added`, recordId: supplier.id }
    },
  }),
}

// ---------------------------------------------------------------------------
// invoices
// ---------------------------------------------------------------------------

const invoiceHandlers: Record<string, WriteHandler> = {
  'invoice.create': handler({
    permission: 'financials:write',
    entity: 'Invoice',
    action: 'create',
    schema: z.object({
      number: optionalText,
      dueDate: requiredDate('Due date'),
      customerId: optionalText,
      status: z.enum(INVOICE_STATUSES),
      notes: optionalText,
      lines: invoiceLinesSchema,
    }),
    async run(values) {
      const invoice = await createInvoice(values).catch((error) =>
        friendly(error, 'That invoice could not be created.'),
      )

      return { message: `Invoice ${invoice.number} created`, recordId: invoice.id }
    },
  }),

  'invoice.edit': handler({
    permission: 'financials:write',
    entity: 'Invoice',
    action: 'update',
    schema: z.object({
      number: required('Invoice number'),
      dueDate: requiredDate('Due date'),
      customerId: optionalText,
      status: z.enum(INVOICE_STATUSES),
      notes: optionalText,
      lines: invoiceLinesSchema,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const invoice = await prisma.invoice
        .update({
          where: { id },
          data: {
            number: values.number,
            customerId: values.customerId,
            status: values.status,
            dueDate: values.dueDate,
            ...priceInvoiceLines(values.lines),
            notes: values.notes,
          },
          select: { number: true },
        })
        .catch((error) => friendly(error, 'That invoice could not be saved.'))

      return { message: `Invoice ${invoice.number} saved`, recordId: id }
    },
  }),

  'invoice.markSent': handler({
    permission: 'financials:write',
    entity: 'Invoice',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const invoice = await prisma.invoice
        .update({ where: { id }, data: { status: 'SENT', sentAt: new Date() }, select: { number: true } })
        .catch((error) => friendly(error, 'That invoice could not be marked sent.'))

      return { message: `Invoice ${invoice.number} marked sent`, recordId: id }
    },
  }),

  'invoice.markPaid': handler({
    permission: 'financials:write',
    entity: 'Invoice',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const invoice = await prisma.invoice
        .update({ where: { id }, data: { status: 'PAID', paidAt: new Date() }, select: { number: true } })
        .catch((error) => friendly(error, 'That invoice could not be marked paid.'))

      return { message: `Invoice ${invoice.number} marked paid`, recordId: id }
    },
  }),

  'invoice.delete': handler({
    permission: 'financials:write',
    entity: 'Invoice',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const invoice = await prisma.invoice
        .delete({ where: { id }, select: { number: true } })
        .catch((error) => friendly(error, 'That invoice could not be deleted.'))

      return { message: `Invoice ${invoice.number} deleted` }
    },
  }),
}

// ---------------------------------------------------------------------------
// wholesale
// ---------------------------------------------------------------------------

const wholesaleHandlers: Record<string, WriteHandler> = {
  'wholesale.edit': handler({
    permission: 'users:write',
    entity: 'WholesaleAccount',
    action: 'update',
    schema: z.object({
      businessName: required('Business name'),
      contactName: required('Contact'),
      businessType: z.enum(['RETAIL_STORE', 'RESTAURANT', 'DISTRIBUTOR', 'ONLINE_STORE', 'OTHER']),
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']),
      discountRate: optionalNumber,
      minimumOrder: optionalNumber,
      resaleNumber: optionalText,
      taxId: optionalText,
      website: optionalText,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const account = await prisma.wholesaleAccount
        .update({
          where: { id },
          data: {
            businessName: values.businessName,
            contactName: values.contactName,
            businessType: values.businessType,
            status: values.status,
            discountRate: values.discountRate === null ? undefined : decimal(values.discountRate),
            minimumOrder: optionalDecimal(values.minimumOrder),
            resaleNumber: values.resaleNumber,
            taxId: values.taxId,
            website: values.website,
            approvedAt: values.status === 'APPROVED' ? new Date() : undefined,
            approvedBy: values.status === 'APPROVED' ? context.actor.id : undefined,
          },
          select: { businessName: true },
        })
        .catch((error) => friendly(error, 'That account could not be saved.'))

      return { message: `${account.businessName} saved`, recordId: id }
    },
  }),

  'wholesale.approve': handler({
    permission: 'users:write',
    entity: 'WholesaleAccount',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const account = await prisma.wholesaleAccount
        .update({
          where: { id },
          data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: context.actor.id },
          select: { businessName: true },
        })
        .catch((error) => friendly(error, 'That account could not be approved.'))

      return { message: `${account.businessName} approved`, recordId: id }
    },
  }),

  'wholesale.suspend': handler({
    permission: 'users:write',
    entity: 'WholesaleAccount',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const account = await prisma.wholesaleAccount
        .update({ where: { id }, data: { status: 'SUSPENDED' }, select: { businessName: true } })
        .catch((error) => friendly(error, 'That account could not be suspended.'))

      return { message: `${account.businessName} suspended`, recordId: id }
    },
  }),
}

// ---------------------------------------------------------------------------
// ledger
// ---------------------------------------------------------------------------

const LEDGER_CATEGORIES = [
  'PRODUCT_SALES',
  'SHIPPING_INCOME',
  'SALES_TAX_COLLECTED',
  'SHOW_SALES',
  'OTHER_INCOME',
  'COGS',
  'PROCESSOR_FEES',
  'SHIPPING_COST',
  'SHOW_EXPENSES',
  'REFUNDS',
  'DISCOUNTS',
  'BOOTH_FEE',
  'TRAVEL',
  'MEALS',
  'SUPPLIES',
  'PAYROLL',
  'OTHER_EXPENSE',
] as const

const SALES_CHANNELS = [
  'WEBSITE',
  'POS',
  'FUNDRAISER',
  'WHOLESALE',
  'EVENT',
  'MANUAL',
  'MARKETPLACE',
  'PHONE',
  'IMPORT',
] as const

const ledgerShape = {
  date: requiredDate('Date'),
  direction: z.enum(['INCOME', 'EXPENSE']),
  amount: requiredNumber('Amount').min(0, 'Amounts are always positive — the direction carries the sign'),
  category: z.enum(LEDGER_CATEGORIES),
  description: required('Description'),
  counterparty: optionalText,
  paymentMethod: optionalText,
  channel: optionalEnum(SALES_CHANNELS),
  memo: optionalText,
}

const ledgerHandlers: Record<string, WriteHandler> = {
  'ledger.create': handler({
    permission: 'financials:write',
    entity: 'LedgerEntry',
    action: 'create',
    schema: z.object(ledgerShape),
    async run(values, { actor }) {
      const entry = await prisma.ledgerEntry
        .create({
          data: {
            date: values.date,
            direction: values.direction,
            amountCents: Math.round(values.amount * 100),
            category: values.category,
            source: 'MANUAL',
            description: values.description,
            counterparty: values.counterparty,
            paymentMethod: values.paymentMethod,
            channel: values.channel,
            memo: values.memo,
            isManual: true,
            enteredById: actor.id,
          },
          select: { id: true, description: true },
        })
        .catch((error) => friendly(error, 'That entry could not be added.'))

      return { message: `${entry.description} added to the ledger`, recordId: entry.id }
    },
  }),

  'ledger.edit': handler({
    permission: 'financials:write',
    entity: 'LedgerEntry',
    action: 'update',
    schema: z.object(ledgerShape),
    async run(values, context) {
      const id = requireRecord(context)
      const existing = await prisma.ledgerEntry.findUnique({ where: { id }, select: { isManual: true } })
      if (!existing) throw new WriteError('That entry no longer exists.')
      if (!existing.isManual) {
        throw new WriteError(
          'This row was derived from an order, a refund or an import. Edit the record it came from instead.',
        )
      }

      const entry = await prisma.ledgerEntry
        .update({
          where: { id },
          data: {
            date: values.date,
            direction: values.direction,
            amountCents: Math.round(values.amount * 100),
            category: values.category,
            description: values.description,
            counterparty: values.counterparty,
            paymentMethod: values.paymentMethod,
            channel: values.channel,
            memo: values.memo,
            enteredById: context.actor.id,
          },
          select: { description: true },
        })
        .catch((error) => friendly(error, 'That entry could not be saved.'))

      return { message: `${entry.description} saved`, recordId: id }
    },
  }),

  'ledger.markExported': handler({
    permission: 'financials:write',
    entity: 'LedgerEntry',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const entry = await prisma.ledgerEntry
        .update({ where: { id }, data: { exportedAt: new Date() }, select: { description: true } })
        .catch((error) => friendly(error, 'That entry could not be marked exported.'))

      return { message: `${entry.description} marked exported`, recordId: id }
    },
  }),

  'ledger.delete': handler({
    permission: 'financials:write',
    entity: 'LedgerEntry',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const entry = await prisma.ledgerEntry.findUnique({ where: { id }, select: { isManual: true, description: true } })
      if (!entry) throw new WriteError('That entry no longer exists.')
      if (!entry.isManual) {
        throw new WriteError('Only hand-entered rows can be deleted. This one was derived from another record.')
      }

      await prisma.ledgerEntry.delete({ where: { id } }).catch((error) => friendly(error, 'That entry could not be deleted.'))
      return { message: `${entry.description} deleted` }
    },
  }),
}

// ---------------------------------------------------------------------------
// email marketing
// ---------------------------------------------------------------------------

const campaignShape = {
  name: required('Name'),
  subject: required('Subject line'),
  previewText: optionalText,
  templateId: required('Template'),
  listId: optionalText,
  fromName: optionalText,
  fromEmail: optionalText,
  scheduledAt: optionalDate,
  trackOpens: boolean,
  trackClicks: boolean,
  notes: optionalText,
}

const campaignHandlers: Record<string, WriteHandler> = {
  'campaign.create': handler({
    permission: 'content:write',
    entity: 'EmailCampaign',
    action: 'create',
    schema: z.object(campaignShape),
    async run(values, { actor }) {
      // A send date without recipients is a campaign that never sends: the cron
      // reaches it, moves it to SENDING, finds nothing PENDING and leaves it
      // there. So a scheduled campaign has to name the list it goes to, and the
      // recipients are written before the status says it is going out.
      if (values.scheduledAt && !values.listId) {
        throw new WriteError('A scheduled campaign needs a mailing list to send to.', 'listId')
      }

      const campaign = await prisma.emailCampaign
        .create({
          data: {
            name: values.name,
            subject: values.subject,
            previewText: values.previewText,
            templateId: values.templateId,
            listId: values.listId,
            fromName: values.fromName,
            fromEmail: values.fromEmail,
            scheduledAt: values.scheduledAt,
            // Stays a draft until its recipients exist, below.
            status: 'DRAFT',
            trackOpens: values.trackOpens,
            trackClicks: values.trackClicks,
            notes: values.notes,
            createdById: actor.id,
          },
          select: { id: true, name: true },
        })
        .catch((error) => friendly(error, 'That campaign could not be created.'))

      if (!values.listId) return { message: `${campaign.name} created as a draft`, recordId: campaign.id }

      let inserted = 0
      try {
        inserted = await insertRecipientsFromList(campaign.id, values.listId, {}, {})
      } catch (error) {
        // A campaign with a half-written recipient list would sit in the table
        // looking sendable, so it goes with the failure — the same undo the
        // campaign page does.
        await prisma.emailCampaign.delete({ where: { id: campaign.id } }).catch(() => {})
        throw new WriteError(
          error instanceof Error ? error.message : 'Those recipients could not be built.',
          'listId',
        )
      }

      if (inserted === 0) {
        await prisma.emailCampaign.delete({ where: { id: campaign.id } }).catch(() => {})
        throw new WriteError('That list has no subscribed contacts to send to.', 'listId')
      }

      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: {
          totalRecipients: inserted,
          status: values.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        },
      })

      return {
        message: `${campaign.name} created · ${inserted.toLocaleString('en-US')} recipient${inserted === 1 ? '' : 's'}${values.scheduledAt ? ', scheduled' : ''}`,
        recordId: campaign.id,
      }
    },
  }),

  'campaign.edit': handler({
    permission: 'content:write',
    entity: 'EmailCampaign',
    action: 'update',
    schema: z.object(campaignShape),
    async run(values, context) {
      const id = requireRecord(context)
      const existing = await prisma.emailCampaign.findUnique({ where: { id }, select: { status: true } })
      if (!existing) throw new WriteError('That campaign no longer exists.')
      if (existing.status === 'SENDING' || existing.status === 'SENT') {
        throw new WriteError('A campaign that has already gone out cannot be edited. Duplicate it instead.')
      }

      const campaign = await prisma.emailCampaign
        .update({
          where: { id },
          data: {
            name: values.name,
            subject: values.subject,
            previewText: values.previewText,
            templateId: values.templateId,
            listId: values.listId,
            fromName: values.fromName,
            fromEmail: values.fromEmail,
            scheduledAt: values.scheduledAt,
            status: values.scheduledAt ? 'SCHEDULED' : 'DRAFT',
            trackOpens: values.trackOpens,
            trackClicks: values.trackClicks,
            notes: values.notes,
          },
          select: { name: true },
        })
        .catch((error) => friendly(error, 'That campaign could not be saved.'))

      return { message: `${campaign.name} saved`, recordId: id }
    },
  }),

  'campaign.pause': handler({
    permission: 'content:write',
    entity: 'EmailCampaign',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const campaign = await prisma.emailCampaign
        .update({ where: { id }, data: { status: 'PAUSED' }, select: { name: true } })
        .catch((error) => friendly(error, 'That campaign could not be paused.'))

      return { message: `${campaign.name} paused`, recordId: id }
    },
  }),

  'campaign.resume': handler({
    permission: 'content:write',
    entity: 'EmailCampaign',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const existing = await prisma.emailCampaign.findUnique({
        where: { id },
        select: { name: true, scheduledAt: true },
      })
      if (!existing) throw new WriteError('That campaign no longer exists.')

      await prisma.emailCampaign.update({
        where: { id },
        data: { status: existing.scheduledAt ? 'SCHEDULED' : 'DRAFT' },
      })
      return { message: `${existing.name} resumed`, recordId: id }
    },
  }),

  'campaign.cancel': handler({
    permission: 'content:write',
    entity: 'EmailCampaign',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const campaign = await prisma.emailCampaign
        .update({ where: { id }, data: { status: 'CANCELLED' }, select: { name: true } })
        .catch((error) => friendly(error, 'That campaign could not be cancelled.'))

      return { message: `${campaign.name} cancelled`, recordId: id }
    },
  }),

  'campaign.delete': handler({
    permission: 'content:write',
    entity: 'EmailCampaign',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const campaign = await prisma.emailCampaign.findUnique({ where: { id }, select: { name: true, status: true } })
      if (!campaign) throw new WriteError('That campaign no longer exists.')
      if (campaign.status === 'SENT' || campaign.status === 'SENDING') {
        throw new WriteError('A campaign that has gone out is a record of what was sent, and stays.')
      }

      await prisma.emailCampaign.delete({ where: { id } }).catch((error) => friendly(error, 'That campaign could not be deleted.'))
      return { message: `${campaign.name} deleted` }
    },
  }),
}

// ---------------------------------------------------------------------------
// social
// ---------------------------------------------------------------------------

const SOCIAL_PLATFORMS = ['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'TIKTOK', 'GOOGLE_MY_BUSINESS'] as const

const socialShape = {
  content: required('Post text'),
  platforms: z.array(z.enum(SOCIAL_PLATFORMS)).min(1, 'Pick at least one platform'),
  linkUrl: optionalText,
  hashtags: stringList,
  scheduledAt: optionalDate,
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']),
}

/**
 * Composing, queueing and going live are three different permissions.
 *
 * `/admin/social` gates its draft, schedule and publish intents separately, because a
 * scheduled row is published unattended by the cron and a PUBLISHED row asserts that
 * something already went out. The desktop form carries the same three intents in one
 * `status` field, so the extra permission is checked from the value rather than by the
 * route, which only ever sees `social_media:compose`.
 */
async function guardSocialStatus(status: string, context: WriteContext) {
  if (status === 'SCHEDULED' && !(await context.can('social_media:schedule'))) {
    throw new WriteError('You need scheduling permission to queue a post.', 'status')
  }
  if (status === 'PUBLISHED' && !(await context.can('social_media:publish'))) {
    throw new WriteError('You need publishing permission to mark a post live.', 'status')
  }
}

const socialHandlers: Record<string, WriteHandler> = {
  'social.create': handler({
    permission: 'social_media:compose',
    entity: 'SocialMediaPost',
    action: 'create',
    schema: z.object(socialShape),
    async run(values, context) {
      const { actor } = context
      if (values.status === 'SCHEDULED' && !values.scheduledAt) {
        throw new WriteError('A scheduled post needs a time to go out.', 'scheduledAt')
      }
      await guardSocialStatus(values.status, context)

      const post = await prisma.socialMediaPost
        .create({
          data: {
            content: values.content,
            platforms: values.platforms,
            linkUrl: values.linkUrl,
            hashtags: values.hashtags,
            scheduledAt: values.scheduledAt,
            status: values.status,
            createdById: actor.id,
          },
          select: { id: true },
        })
        .catch((error) => friendly(error, 'That post could not be created.'))

      return { message: `Post created for ${values.platforms.length} platform(s)`, recordId: post.id }
    },
  }),

  'social.edit': handler({
    permission: 'social_media:compose',
    entity: 'SocialMediaPost',
    action: 'update',
    schema: z.object(socialShape),
    async run(values, context) {
      const id = requireRecord(context)
      const existing = await prisma.socialMediaPost.findUnique({ where: { id }, select: { status: true } })
      if (!existing) throw new WriteError('That post no longer exists.')
      if (existing.status === 'PUBLISHED') {
        throw new WriteError('A published post is a record of what went out. Edit it on the platform itself.')
      }
      await guardSocialStatus(values.status, context)

      await prisma.socialMediaPost
        .update({
          where: { id },
          data: {
            content: values.content,
            platforms: values.platforms,
            linkUrl: values.linkUrl,
            hashtags: values.hashtags,
            scheduledAt: values.scheduledAt,
            status: values.status,
          },
        })
        .catch((error) => friendly(error, 'That post could not be saved.'))

      return { message: 'Post saved', recordId: id }
    },
  }),

  'social.delete': handler({
    permission: 'social_media:compose',
    entity: 'SocialMediaPost',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      await prisma.socialMediaPost.delete({ where: { id } }).catch((error) => friendly(error, 'That post could not be deleted.'))
      return { message: 'Post deleted' }
    },
  }),
}

// ---------------------------------------------------------------------------
// content
// ---------------------------------------------------------------------------

const SEO_DESCRIPTION_MAX = 160

const postShape = {
  title: required('Title'),
  slug: required('Slug').regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  categoryId: optionalText,
  subtitle: optionalText,
  excerpt: required('Excerpt'),
  content: required('Body'),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']),
  layout: z.enum(['STANDARD', 'LONGFORM', 'GALLERY', 'VIDEO', 'MINIMAL']),
  publishedAt: optionalDate,
  scheduledFor: optionalDate,
  featured: boolean,
  readingMinutes: optionalInt,
  coverImage: optionalText,
  tags: stringList,
  seoTitle: optionalText,
  seoDescription: optionalText,
}

/**
 * The same length rules `lib/blog/schemas.ts` enforces, checked against the
 * effective values rather than the overrides: a blank SEO title means the
 * article's own title is what Google will show, so that is what has to fit.
 */
function checkSeoLengths(values: {
  title: string
  excerpt: string
  seoTitle: string | null
  seoDescription: string | null
  status: string
}) {
  // `checkPostSeo` is the rule the blog schemas apply, and it has both ends of
  // the title budget — a 21-character title wastes the snippet exactly as a
  // 70-character one is truncated. Checking only the maximum here let a post go
  // public through this window in a state `/admin/blog` would have refused.
  const problem = checkPostSeo({
    status: values.status,
    title: values.title,
    excerpt: values.excerpt,
    seoTitle: values.seoTitle,
    seoDescription: values.seoDescription,
  })
  if (problem) {
    throw new WriteError(problem, values.seoTitle ? 'seoTitle' : 'title')
  }
}

const contentHandlers: Record<string, WriteHandler> = {
  'post.create': handler({
    permission: 'content:write',
    entity: 'BlogPost',
    action: 'create',
    schema: z.object(postShape),
    async run(values, { actor }) {
      checkSeoLengths(values)

      const post = await prisma.blogPost
        .create({
          data: {
            title: values.title,
            slug: values.slug,
            subtitle: values.subtitle,
            excerpt: values.excerpt,
            content: values.content,
            categoryId: values.categoryId,
            status: values.status,
            layout: values.layout,
            publishedAt: values.publishedAt ?? (values.status === 'PUBLISHED' ? new Date() : null),
            scheduledFor: values.scheduledFor,
            featured: values.featured,
            readingMinutes: values.readingMinutes ?? 5,
            coverImage: values.coverImage,
            tags: values.tags,
            seoTitle: values.seoTitle,
            seoDescription: values.seoDescription,
            authorId: actor.id,
          },
          select: { id: true, title: true },
        })
        .catch((error) => friendly(error, 'That post could not be created.'))

      return { message: `${post.title} created`, recordId: post.id }
    },
  }),

  'post.edit': handler({
    permission: 'content:write',
    entity: 'BlogPost',
    action: 'update',
    schema: z.object(postShape),
    async run(values, context) {
      const id = requireRecord(context)
      checkSeoLengths(values)

      const post = await prisma.blogPost
        .update({
          where: { id },
          data: {
            title: values.title,
            slug: values.slug,
            subtitle: values.subtitle,
            excerpt: values.excerpt,
            content: values.content,
            categoryId: values.categoryId,
            status: values.status,
            layout: values.layout,
            publishedAt: values.publishedAt ?? (values.status === 'PUBLISHED' ? new Date() : null),
            scheduledFor: values.scheduledFor,
            featured: values.featured,
            readingMinutes: values.readingMinutes ?? undefined,
            coverImage: values.coverImage,
            tags: values.tags,
            seoTitle: values.seoTitle,
            seoDescription: values.seoDescription,
          },
          select: { title: true },
        })
        .catch((error) => friendly(error, 'That post could not be saved.'))

      return { message: `${post.title} saved`, recordId: id }
    },
  }),

  'post.publish': handler({
    permission: 'content:write',
    entity: 'BlogPost',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const post = await prisma.blogPost
        .update({
          where: { id },
          data: { status: 'PUBLISHED', publishedAt: new Date(), scheduledFor: null },
          select: { title: true, slug: true },
        })
        .catch((error) => friendly(error, 'That post could not be published.'))

      // The sitemap reads published posts from the database, so the URL is
      // registered the moment this lands. Search Console has to be told by hand.
      return {
        message: `${post.title} published — run URL Inspection on /heat-index/${post.slug} in Search Console`,
        recordId: id,
      }
    },
  }),

  'post.delete': handler({
    permission: 'content:write',
    entity: 'BlogPost',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const post = await prisma.blogPost
        .delete({ where: { id }, select: { title: true } })
        .catch((error) => friendly(error, 'That post could not be deleted.'))

      return { message: `${post.title} deleted` }
    },
  }),
}

// ---------------------------------------------------------------------------
// leads
// ---------------------------------------------------------------------------

const leadHandlers: Record<string, WriteHandler> = {
  'leadCampaign.create': handler({
    permission: null,
    entity: 'LeadCampaign',
    action: 'create',
    schema: z.object({
      name: required('Name'),
      leadType: z.enum(['SCHOOL_ATHLETICS', 'LOCAL_BUSINESS', 'LOCAL_SCHOOL', 'FUNDRAISER_ORG']),
      schoolType: optionalText,
      city: required('City'),
      state: required('State'),
      radius: optionalText,
      limit: optionalInt,
      skipNoEmail: boolean,
      autoSend: boolean,
    }),
    async run(values) {
      const campaign = await prisma.leadCampaign
        .create({
          data: {
            name: values.name,
            leadType: values.leadType,
            schoolType: values.schoolType ?? 'high school',
            city: values.city,
            state: values.state.toUpperCase(),
            radius: values.radius,
            limit: values.limit,
            skipNoEmail: values.skipNoEmail,
            autoSend: values.autoSend,
          },
          select: { id: true, name: true },
        })
        .catch((error) => friendly(error, 'That campaign could not be created.'))

      return { message: `${campaign.name} created — run it to start scraping`, recordId: campaign.id }
    },
  }),

  'lead.edit': handler({
    permission: null,
    entity: 'Lead',
    action: 'update',
    schema: z.object({
      schoolName: required('Organization'),
      contactName: optionalText,
      title: optionalText,
      email: optionalText,
      phone: optionalText,
      city: optionalText,
      state: optionalText,
      website: optionalText,
      status: z.enum(['SCRAPED', 'CONTACT_FOUND', 'EMAIL_SENT', 'EMAIL_FAILED']),
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const lead = await prisma.lead
        .update({
          where: { id },
          data: {
            schoolName: values.schoolName,
            contactName: values.contactName,
            title: values.title,
            email: values.email,
            phone: values.phone,
            city: values.city,
            state: values.state,
            website: values.website,
            status: values.status,
          },
          select: { schoolName: true },
        })
        .catch((error) => friendly(error, 'That lead could not be saved.'))

      return { message: `${lead.schoolName} saved`, recordId: id }
    },
  }),

  'lead.delete': handler({
    permission: null,
    entity: 'Lead',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const lead = await prisma.lead
        .delete({ where: { id }, select: { schoolName: true } })
        .catch((error) => friendly(error, 'That lead could not be deleted.'))

      return { message: `${lead.schoolName} deleted` }
    },
  }),
}

// ---------------------------------------------------------------------------
// reviews
// ---------------------------------------------------------------------------

const reviewHandlers: Record<string, WriteHandler> = {
  'review.edit': handler({
    permission: 'content:write',
    entity: 'Review',
    action: 'update',
    schema: z.object({
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
      rating: z.coerce.number().int().min(1, 'One star at least').max(5, 'Five stars at most'),
      title: optionalText,
      comment: optionalText,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      await prisma.review
        .update({
          where: { id },
          data: {
            status: values.status,
            rating: values.rating,
            title: values.title,
            comment: values.comment,
            moderatedAt: new Date(),
            moderatedBy: context.actor.id,
          },
        })
        .catch((error) => friendly(error, 'That review could not be saved.'))

      return { message: 'Review saved', recordId: id }
    },
  }),

  'review.approve': handler({
    permission: 'content:write',
    entity: 'Review',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      await prisma.review
        .update({
          where: { id },
          data: { status: 'APPROVED', moderatedAt: new Date(), moderatedBy: context.actor.id },
        })
        .catch((error) => friendly(error, 'That review could not be approved.'))

      return { message: 'Review approved', recordId: id }
    },
  }),

  'review.reject': handler({
    permission: 'content:write',
    entity: 'Review',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      await prisma.review
        .update({
          where: { id },
          data: { status: 'REJECTED', moderatedAt: new Date(), moderatedBy: context.actor.id },
        })
        .catch((error) => friendly(error, 'That review could not be rejected.'))

      return { message: 'Review rejected', recordId: id }
    },
  }),

  'review.delete': handler({
    permission: 'content:write',
    entity: 'Review',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      await prisma.review.delete({ where: { id } }).catch((error) => friendly(error, 'That review could not be deleted.'))
      return { message: 'Review deleted' }
    },
  }),
}

// ---------------------------------------------------------------------------
// media
// ---------------------------------------------------------------------------

const mediaHandlers: Record<string, WriteHandler> = {
  'media.upload': handler({
    permission: 'content:write',
    entity: 'Media',
    action: 'create',
    schema: z.object({
      url: required('File URL').url('That is not a valid URL'),
      filename: required('Filename'),
      mimeType: required('MIME type'),
      alt: optionalText,
    }),
    async run(values) {
      const media = await prisma.media
        .create({
          data: {
            url: values.url,
            filename: values.filename,
            mimeType: values.mimeType,
            // Unknown until the file is fetched; the library fills it on next scan.
            fileSize: 0,
            alt: values.alt,
          },
          select: { id: true, filename: true },
        })
        .catch((error) => friendly(error, 'That file could not be registered.'))

      return { message: `${media.filename} added to the library`, recordId: media.id }
    },
  }),

  'media.edit': handler({
    permission: 'content:write',
    entity: 'Media',
    action: 'update',
    schema: z.object({
      filename: required('Filename'),
      alt: optionalText,
      caption: optionalText,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const media = await prisma.media
        .update({
          where: { id },
          data: { filename: values.filename, alt: values.alt, caption: values.caption },
          select: { filename: true },
        })
        .catch((error) => friendly(error, 'That file could not be saved.'))

      return { message: `${media.filename} saved`, recordId: id }
    },
  }),

  'media.delete': handler({
    permission: 'content:write',
    entity: 'Media',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const media = await prisma.media
        .delete({ where: { id }, select: { filename: true } })
        .catch((error) => friendly(error, 'That file could not be deleted.'))

      return { message: `${media.filename} deleted from the library` }
    },
  }),
}

// ---------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------

const messageHandlers: Record<string, WriteHandler> = {
  'conversation.edit': handler({
    permission: 'messaging:reply',
    entity: 'Conversation',
    action: 'update',
    schema: z.object({ subject: optionalText, status: z.enum(['OPEN', 'CLOSED']) }),
    async run(values, context) {
      const id = requireRecord(context)
      await prisma.conversation
        .update({ where: { id }, data: { subject: values.subject, status: values.status } })
        .catch((error) => friendly(error, 'That conversation could not be saved.'))

      return { message: `Conversation ${values.status.toLowerCase()}`, recordId: id }
    },
  }),

  'conversation.close': handler({
    permission: 'messaging:reply',
    entity: 'Conversation',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      await prisma.conversation
        .update({ where: { id }, data: { status: 'CLOSED' } })
        .catch((error) => friendly(error, 'That conversation could not be closed.'))

      return { message: 'Conversation closed', recordId: id }
    },
  }),

  'conversation.reopen': handler({
    permission: 'messaging:reply',
    entity: 'Conversation',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      await prisma.conversation
        .update({ where: { id }, data: { status: 'OPEN' } })
        .catch((error) => friendly(error, 'That conversation could not be reopened.'))

      return { message: 'Conversation reopened', recordId: id }
    },
  }),

  'chat.edit': handler({
    permission: 'messaging:reply',
    entity: 'ChatThread',
    action: 'update',
    schema: z.object({
      status: z.enum(['WAITING', 'ACTIVE', 'CLOSED', 'OFFLINE']),
      assignedAdminId: optionalText,
      closedReason: optionalText,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      await prisma.chatThread
        .update({
          where: { id },
          data: {
            status: values.status,
            assignedAdminId: values.assignedAdminId,
            closedReason: values.closedReason,
            closedAt: values.status === 'CLOSED' ? new Date() : null,
          },
        })
        .catch((error) => friendly(error, 'That thread could not be saved.'))

      return { message: `Thread ${values.status.toLowerCase()}`, recordId: id }
    },
  }),

  'chat.close': handler({
    permission: 'messaging:reply',
    entity: 'ChatThread',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      await prisma.chatThread
        .update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } })
        .catch((error) => friendly(error, 'That thread could not be closed.'))

      return { message: 'Thread closed', recordId: id }
    },
  }),
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

const USER_ROLES = ['CUSTOMER', 'STAFF', 'ADMIN', 'DEVELOPER', 'WHOLESALE', 'FUNDRAISER'] as const

/**
 * The DEVELOPER role is the platform super admin, and `users:write` is not enough
 * to hand it out or to touch an account that already holds it — `/api/admin/users/[id]`
 * has always required the actor to be a developer themselves. Without the same rule
 * here, any account that could edit users could promote itself through the shell.
 */
function guardDeveloperRole(actorRole: string, target: { assigning?: string; existing?: string }) {
  if (actorRole === 'DEVELOPER') return
  if (target.assigning === 'DEVELOPER') {
    throw new WriteError('Only a developer can assign the DEVELOPER role.', 'role')
  }
  if (target.existing === 'DEVELOPER') {
    throw new WriteError('Only a developer can modify a DEVELOPER account.', 'role')
  }
}

const userHandlers: Record<string, WriteHandler> = {
  'user.create': handler({
    permission: 'users:write',
    entity: 'User',
    action: 'create',
    redact: ['password'],
    schema: z.object({
      name: required('Name'),
      email: required('Email').email('That is not a valid email'),
      password: required('Password').min(8, 'At least 8 characters'),
      role: z.enum(USER_ROLES),
      phone: optionalText,
    }),
    async run(values, context) {
      guardDeveloperRole(context.actor.role, { assigning: values.role })

      const user = await prisma.user
        .create({
          data: {
            name: values.name,
            email: values.email.toLowerCase(),
            password: await bcrypt.hash(values.password, 10),
            role: values.role,
            phone: values.phone,
          },
          select: { id: true, email: true },
        })
        .catch((error) => friendly(error, 'That user could not be created.'))

      return { message: `${user.email} created`, recordId: user.id }
    },
  }),

  'user.edit': handler({
    permission: 'users:write',
    entity: 'User',
    action: 'update',
    redact: ['password'],
    schema: z.object({
      name: required('Name'),
      email: required('Email').email('That is not a valid email'),
      role: z.enum(USER_ROLES),
      phone: optionalText,
      isEmailVerified: boolean,
      password: optionalText,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      if (values.password !== null && values.password.length < 8) {
        throw new WriteError('A new password has to be at least 8 characters.', 'password')
      }

      const existing = await prisma.user.findUnique({ where: { id }, select: { role: true } })
      if (!existing) throw new WriteError('That user no longer exists.')
      guardDeveloperRole(context.actor.role, { assigning: values.role, existing: existing.role })

      const user = await prisma.user
        .update({
          where: { id },
          data: {
            name: values.name,
            email: values.email.toLowerCase(),
            role: values.role,
            phone: values.phone,
            isEmailVerified: values.isEmailVerified,
            password: values.password ? await bcrypt.hash(values.password, 10) : undefined,
          },
          select: { email: true },
        })
        .catch((error) => friendly(error, 'That user could not be saved.'))

      return { message: `${user.email} saved`, recordId: id }
    },
  }),

  'user.delete': handler({
    permission: 'users:write',
    entity: 'User',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      // Deleting your own account would sign you out mid-task and leave the window
      // holding a session that no longer resolves.
      if (id === context.actor.id) throw new WriteError('You cannot delete the account you are signed in with.')

      // Deleting a user cascades through everything they own, which is why
      // `/api/admin/users/[id]` puts it behind the owner account rather than
      // behind `users:write`. The shell is not a way around that.
      if (!canEraseData(context.actor.email)) {
        throw new WriteError('Only an owner account can delete records.')
      }

      const existing = await prisma.user.findUnique({ where: { id }, select: { role: true } })
      if (!existing) throw new WriteError('That user no longer exists.')
      guardDeveloperRole(context.actor.role, { existing: existing.role })

      const user = await prisma.user
        .delete({ where: { id }, select: { email: true } })
        .catch((error) => friendly(error, 'That user could not be deleted.'))

      return { message: `${user.email} deleted` }
    },
  }),
}

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------

const settingsHandlers: Record<string, WriteHandler> = {
  'settings.store': handler({
    permission: 'settings:write',
    entity: 'StoreSettings',
    action: 'update',
    requiresRecord: false,
    schema: z.object({
      businessName: optionalText,
      supportEmail: optionalText,
      supportPhone: optionalText,
      businessAddress: optionalText,
      allowGuestCheckout: boolean,
      minimumOrderCents: optionalInt,
      defaultLowStockThreshold: optionalInt,
    }),
    async run(values, { actor }) {
      const data = {
        businessName: values.businessName,
        supportEmail: values.supportEmail,
        supportPhone: values.supportPhone,
        businessAddress: values.businessAddress,
        allowGuestCheckout: values.allowGuestCheckout,
        minimumOrderCents: values.minimumOrderCents ?? 0,
        defaultLowStockThreshold: values.defaultLowStockThreshold ?? 5,
        updatedById: actor.id,
      }

      const settings = await prisma.storeSettings
        .upsert({
          where: { singleton: 'singleton' },
          create: { singleton: 'singleton', ...data },
          update: data,
          select: { id: true },
        })
        .catch((error) => friendly(error, 'Those settings could not be saved.'))

      return { message: 'Store settings saved', recordId: settings.id }
    },
  }),

  'settings.seo': handler({
    permission: 'settings:write',
    entity: 'SeoConfiguration',
    action: 'update',
    requiresRecord: false,
    schema: z.object({
      siteName: required('Site name'),
      siteUrl: required('Site URL').url('That is not a valid URL'),
      siteDescription: required('Site description').max(SEO_DESCRIPTION_MAX, `${SEO_DESCRIPTION_MAX} characters at most`),
      twitterHandle: optionalText,
      defaultOgImage: optionalText,
      robotsTxt: optionalText,
    }),
    async run(values, context) {
      const existing =
        context.recordId ?? (await prisma.seoConfiguration.findFirst({ select: { id: true } }))?.id ?? null

      const data = {
        siteName: values.siteName,
        siteUrl: values.siteUrl.replace(/\/$/, ''),
        siteDescription: values.siteDescription,
        twitterHandle: values.twitterHandle,
        defaultOgImage: values.defaultOgImage,
        robotsTxt: values.robotsTxt,
      }

      const config = existing
        ? await prisma.seoConfiguration
            .update({ where: { id: existing }, data, select: { id: true } })
            .catch((error) => friendly(error, 'Those settings could not be saved.'))
        : await prisma.seoConfiguration
            .create({ data: { ...data, defaultKeywords: [] }, select: { id: true } })
            .catch((error) => friendly(error, 'Those settings could not be saved.'))

      return { message: 'Search settings saved', recordId: config.id }
    },
  }),
}


// ---------------------------------------------------------------------------
// returns & shipping
// ---------------------------------------------------------------------------

/**
 * Moves an RMA to one status, and stamps the date that status is defined by.
 *
 * Deliberately not COMPLETED. That transition settles the refund, store credit
 * or exchange, restocks what came back in a usable condition and emits
 * `order.returned` — and it is terminal, so a status written without the money
 * behind it can never be re-driven. It stays on `/admin/returns/[id]`, which
 * owns that orchestration; the shell links out to it.
 */
function returnStatusOp(
  status: 'APPROVED' | 'RECEIVED' | 'REJECTED',
  stamp: 'approvedAt' | 'receivedAt' | null,
  past: string,
): WriteHandler {
  return handler({
    permission: 'orders:write',
    entity: 'ReturnRequest',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const request = await prisma.returnRequest
        .update({
          where: { id },
          data: {
            status,
            ...(stamp ? { [stamp]: new Date() } : {}),
            ...(status === 'APPROVED' ? { approvedById: context.actor.id } : {}),
          },
          select: { rmaNumber: true },
        })
        .catch((error) => friendly(error, 'That return could not be updated.'))

      return { message: `${request.rmaNumber} ${past}`, recordId: id }
    },
  })
}

const returnHandlers: Record<string, WriteHandler> = {
  'return.edit': handler({
    permission: 'orders:write',
    entity: 'ReturnRequest',
    action: 'update',
    schema: z.object({
      // No COMPLETED: see `returnStatusOp`. Settling is not a status change.
      status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'CANCELLED']),
      resolution: z.enum(['REFUND', 'EXCHANGE', 'STORE_CREDIT']),
      reason: z.enum([
        'DAMAGED',
        'WRONG_ITEM',
        'NOT_AS_DESCRIBED',
        'ARRIVED_LATE',
        'CHANGED_MIND',
        'QUALITY_ISSUE',
        'OTHER',
      ]),
      restockingFee: optionalNumber,
      adminNote: optionalText,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const request = await prisma.returnRequest
        .update({
          where: { id },
          data: {
            status: values.status,
            resolution: values.resolution,
            reason: values.reason,
            restockingFee: optionalDecimal(values.restockingFee),
            adminNote: values.adminNote,
          },
          select: { rmaNumber: true },
        })
        .catch((error) => friendly(error, 'That return could not be saved.'))

      return { message: `${request.rmaNumber} saved`, recordId: id }
    },
  }),

  'return.approve': returnStatusOp('APPROVED', 'approvedAt', 'approved'),
  'return.receive': returnStatusOp('RECEIVED', 'receivedAt', 'marked received'),
  'return.reject': returnStatusOp('REJECTED', null, 'rejected'),
}

// ---------------------------------------------------------------------------
// suppliers & stockists
// ---------------------------------------------------------------------------

const supplierPageHandlers: Record<string, WriteHandler> = {
  'supplier.edit': handler({
    permission: 'inventory:write',
    entity: 'Supplier',
    action: 'update',
    schema: z.object({
      name: required('Supplier name'),
      contactName: optionalText,
      email: optionalText,
      phone: optionalText,
      city: optionalText,
      state: optionalText,
      notes: optionalText,
      isActive: boolean,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const supplier = await prisma.supplier
        .update({
          where: { id },
          data: {
            name: values.name,
            contactName: values.contactName,
            email: values.email,
            phone: values.phone,
            city: values.city,
            state: values.state,
            notes: values.notes,
            isActive: values.isActive,
          },
          select: { name: true },
        })
        .catch((error) => friendly(error, 'That supplier could not be saved.'))

      return { message: `${supplier.name} saved`, recordId: id }
    },
  }),

  'supplier.deactivate': handler({
    permission: 'inventory:write',
    entity: 'Supplier',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const supplier = await prisma.supplier
        .update({ where: { id }, data: { isActive: false }, select: { name: true } })
        .catch((error) => friendly(error, 'That supplier could not be deactivated.'))

      return { message: `${supplier.name} deactivated`, recordId: id }
    },
  }),
}

const locationShape = {
  businessName: required('Business name'),
  address: required('Address'),
  city: required('City'),
  state: required('State'),
  zipCode: optionalText,
  phone: optionalText,
  website: optionalText,
  isActive: boolean,
}

const locationHandlers: Record<string, WriteHandler> = {
  'location.create': handler({
    permission: 'content:write',
    entity: 'RetailLocation',
    action: 'create',
    schema: z.object(locationShape),
    async run(values) {
      const location = await prisma.retailLocation
        .create({
          data: {
            businessName: values.businessName,
            address: values.address,
            city: values.city,
            state: values.state.toUpperCase(),
            zipCode: values.zipCode,
            phone: values.phone,
            website: values.website,
            isActive: values.isActive,
          },
          select: { id: true, businessName: true },
        })
        .catch((error) => friendly(error, 'That stockist could not be added.'))

      return { message: `${location.businessName} added`, recordId: location.id }
    },
  }),

  'location.edit': handler({
    permission: 'content:write',
    entity: 'RetailLocation',
    action: 'update',
    schema: z.object(locationShape),
    async run(values, context) {
      const id = requireRecord(context)
      const location = await prisma.retailLocation
        .update({
          where: { id },
          data: {
            businessName: values.businessName,
            address: values.address,
            city: values.city,
            state: values.state.toUpperCase(),
            zipCode: values.zipCode,
            phone: values.phone,
            website: values.website,
            isActive: values.isActive,
          },
          select: { businessName: true },
        })
        .catch((error) => friendly(error, 'That stockist could not be saved.'))

      return { message: `${location.businessName} saved`, recordId: id }
    },
  }),

  'location.delete': handler({
    permission: 'content:write',
    entity: 'RetailLocation',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const location = await prisma.retailLocation
        .delete({ where: { id }, select: { businessName: true } })
        .catch((error) => friendly(error, 'That stockist could not be removed.'))

      return { message: `${location.businessName} removed from the locator` }
    },
  }),
}

// ---------------------------------------------------------------------------
// manifests & arena
// ---------------------------------------------------------------------------

const manifestHandlers: Record<string, WriteHandler> = {
  'manifest.edit': handler({
    permission: null,
    entity: 'EventManifest',
    action: 'update',
    schema: z.object({
      status: z.enum(['DRAFT', 'PACKED', 'RETURNED']),
      notes: optionalText,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const manifest = await prisma.eventManifest
        .update({
          where: { id },
          data: {
            status: values.status,
            notes: values.notes,
            // The two dates a manifest is really about: when the van was loaded
            // and when what came back was counted. Stamped on the transition
            // rather than typed, so they cannot disagree with the status.
            ...(values.status === 'PACKED' ? { packedAt: new Date() } : {}),
            ...(values.status === 'RETURNED' ? { returnedAt: new Date() } : {}),
          },
          select: { event: { select: { title: true } } },
        })
        .catch((error) => friendly(error, 'That manifest could not be saved.'))

      return { message: `${manifest.event.title} manifest saved`, recordId: id }
    },
  }),
}

const arenaHandlers: Record<string, WriteHandler> = {
  'team.edit': handler({
    permission: 'orders:write',
    entity: 'FundraiserTeam',
    action: 'update',
    schema: z.object({
      name: required('Team name'),
      school: required('School'),
      status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'ENDED']),
      goalAmount: optionalInt,
      contactName: optionalText,
      contactEmail: optionalText,
      tagline: optionalText,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const team = await prisma.fundraiserTeam
        .update({
          where: { id },
          data: {
            name: values.name,
            school: values.school,
            status: values.status,
            ...(values.goalAmount === null ? {} : { goalAmount: values.goalAmount }),
            ...(values.contactName === null ? {} : { contactName: values.contactName }),
            ...(values.contactEmail === null ? {} : { contactEmail: values.contactEmail }),
            tagline: values.tagline,
          },
          select: { name: true },
        })
        .catch((error) => friendly(error, 'That team could not be saved.'))

      return { message: `${team.name} saved`, recordId: id }
    },
  }),

  'team.approve': handler({
    permission: 'orders:write',
    entity: 'FundraiserTeam',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const team = await prisma.fundraiserTeam
        .update({
          where: { id },
          data: { status: 'ACTIVE', approvedAt: new Date(), approvedBy: context.actor.id },
          select: { name: true },
        })
        .catch((error) => friendly(error, 'That team could not be approved.'))

      return { message: `${team.name} is in the arena`, recordId: id }
    },
  }),

  'team.suspend': handler({
    permission: 'orders:write',
    entity: 'FundraiserTeam',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const team = await prisma.fundraiserTeam
        .update({ where: { id }, data: { status: 'SUSPENDED' }, select: { name: true } })
        .catch((error) => friendly(error, 'That team could not be suspended.'))

      return { message: `${team.name} suspended`, recordId: id }
    },
  }),

  'gameCode.create': handler({
    permission: 'orders:write',
    entity: 'ArenaGameCode',
    action: 'create',
    schema: z
      .object({
        groupName: z.string().trim().max(40).optional(),
        fundraiserId: z.string().min(1).optional(),
      })
      .refine((v) => v.groupName || v.fundraiserId, { message: 'Give a group name or pick a fundraiser', path: ['groupName'] }),
    async run(values, context) {
      let groupName = values.groupName?.replace(/\s+/g, ' ') || ''
      const fundraiserId = values.fundraiserId ?? null
      if (fundraiserId) {
        const fundraiser = await prisma.fundraiser.findUnique({
          where: { id: fundraiserId },
          select: { organizationName: true, name: true },
        })
        if (!fundraiser) throw new WriteError('That fundraiser no longer exists.', 'fundraiserId')
        groupName ||= (fundraiser.organizationName || fundraiser.name).slice(0, 40)
      }

      // a clash in a trillion codes is unlikely, but retry rather than fail on one
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const code = await prisma.arenaGameCode.create({
            data: { code: generateGameCode(), groupName, fundraiserId, createdBy: context.actor.id },
          })
          return { message: `${code.groupName}: ${code.code}`, recordId: code.id }
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
            return friendly(error, 'That code could not be made.')
          }
        }
      }
      throw new WriteError('Could not make a unique code, try again.')
    },
  }),

  'gameCode.revoke': handler({
    permission: 'orders:write',
    entity: 'ArenaGameCode',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const code = await prisma.arenaGameCode
        .update({ where: { id }, data: { revokedAt: new Date() }, select: { code: true } })
        .catch((error) => friendly(error, 'That code could not be revoked.'))

      return { message: `${code.code} revoked`, recordId: id }
    },
  }),

  'gameCode.restore': handler({
    permission: 'orders:write',
    entity: 'ArenaGameCode',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const code = await prisma.arenaGameCode
        .update({ where: { id }, data: { revokedAt: null }, select: { code: true } })
        .catch((error) => friendly(error, 'That code could not be restored.'))

      return { message: `${code.code} restored`, recordId: id }
    },
  }),
}

// ---------------------------------------------------------------------------
// email marketing: automations, lists, subscribers, suppressions, brand
// ---------------------------------------------------------------------------

const emailPageHandlers: Record<string, WriteHandler> = {
  'automation.edit': handler({
    permission: 'content:write',
    entity: 'EmailAutomation',
    action: 'update',
    schema: z.object({
      name: required('Name'),
      description: optionalText,
      isActive: boolean,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const automation = await prisma.emailAutomation
        .update({
          where: { id },
          data: { name: values.name, description: values.description, isActive: values.isActive },
          select: { name: true },
        })
        .catch((error) => friendly(error, 'That automation could not be saved.'))

      return { message: `${automation.name} saved`, recordId: id }
    },
  }),

  'automation.activate': handler({
    permission: 'content:write',
    entity: 'EmailAutomation',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const automation = await prisma.emailAutomation
        .update({ where: { id }, data: { isActive: true }, select: { name: true } })
        .catch((error) => friendly(error, 'That automation could not be started.'))

      return { message: `${automation.name} is running`, recordId: id }
    },
  }),

  'automation.pause': handler({
    permission: 'content:write',
    entity: 'EmailAutomation',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const automation = await prisma.emailAutomation
        .update({ where: { id }, data: { isActive: false }, select: { name: true } })
        .catch((error) => friendly(error, 'That automation could not be paused.'))

      return { message: `${automation.name} paused`, recordId: id }
    },
  }),

  'list.create': handler({
    permission: 'content:write',
    entity: 'MailingList',
    action: 'create',
    schema: z.object({ name: required('List name'), description: optionalText, isDefault: boolean }),
    async run(values, { actor }) {
      const list = await prisma.mailingList
        .create({
          data: {
            name: values.name,
            description: values.description,
            isDefault: values.isDefault,
            createdById: actor.id,
          },
          select: { id: true, name: true },
        })
        .catch((error) => friendly(error, 'That list could not be created.'))

      return { message: `${list.name} created`, recordId: list.id }
    },
  }),

  'list.edit': handler({
    permission: 'content:write',
    entity: 'MailingList',
    action: 'update',
    schema: z.object({ name: required('List name'), description: optionalText, isDefault: boolean }),
    async run(values, context) {
      const id = requireRecord(context)
      const list = await prisma.mailingList
        .update({
          where: { id },
          data: { name: values.name, description: values.description, isDefault: values.isDefault },
          select: { name: true },
        })
        .catch((error) => friendly(error, 'That list could not be saved.'))

      return { message: `${list.name} saved`, recordId: id }
    },
  }),

  'subscriber.create': handler({
    permission: 'content:write',
    entity: 'MailingListSubscriber',
    action: 'create',
    schema: z.object({
      listId: required('List'),
      email: required('Email').email('That is not a valid email address'),
      firstName: optionalText,
      lastName: optionalText,
      source: optionalText,
    }),
    async run(values) {
      const subscriber = await prisma.mailingListSubscriber
        .create({
          data: {
            listId: values.listId,
            email: values.email.toLowerCase(),
            firstName: values.firstName,
            lastName: values.lastName,
            source: values.source ?? 'desktop',
          },
          select: { id: true, email: true },
        })
        .catch((error) => friendly(error, 'That subscriber could not be added.'))

      return { message: `${subscriber.email} added`, recordId: subscriber.id }
    },
  }),

  'subscriber.edit': handler({
    permission: 'content:write',
    entity: 'MailingListSubscriber',
    action: 'update',
    schema: z.object({
      email: required('Email').email('That is not a valid email address'),
      firstName: optionalText,
      lastName: optionalText,
      status: z.enum(['SUBSCRIBED', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED']),
      tags: stringList,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const subscriber = await prisma.mailingListSubscriber
        .update({
          where: { id },
          data: {
            email: values.email.toLowerCase(),
            firstName: values.firstName,
            lastName: values.lastName,
            status: values.status,
            tags: values.tags,
            unsubscribedAt: values.status === 'UNSUBSCRIBED' ? new Date() : null,
          },
          select: { email: true },
        })
        .catch((error) => friendly(error, 'That subscriber could not be saved.'))

      return { message: `${subscriber.email} saved`, recordId: id }
    },
  }),

  'subscriber.unsubscribe': handler({
    permission: 'content:write',
    entity: 'MailingListSubscriber',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const subscriber = await prisma.mailingListSubscriber
        .update({
          where: { id },
          data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
          select: { email: true },
        })
        .catch((error) => friendly(error, 'That subscriber could not be unsubscribed.'))

      return { message: `${subscriber.email} unsubscribed`, recordId: id }
    },
  }),

  'subscriber.delete': handler({
    permission: 'content:write',
    entity: 'MailingListSubscriber',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const subscriber = await prisma.mailingListSubscriber
        .delete({ where: { id }, select: { email: true } })
        .catch((error) => friendly(error, 'That subscriber could not be removed.'))

      return { message: `${subscriber.email} removed` }
    },
  }),

  'suppression.create': handler({
    permission: 'content:write',
    entity: 'EmailSuppression',
    action: 'create',
    schema: z.object({
      email: required('Email').email('That is not a valid email address'),
      reason: z.enum(['HARD_BOUNCE', 'SOFT_BOUNCE', 'SPAM_COMPLAINT', 'MANUAL', 'UNSUBSCRIBE', 'ADMIN']),
      notes: optionalText,
    }),
    async run(values) {
      const suppression = await prisma.emailSuppression
        .create({
          data: {
            email: values.email.toLowerCase(),
            reason: values.reason,
            source: 'desktop',
            notes: values.notes,
          },
          select: { id: true, email: true },
        })
        .catch((error) => friendly(error, 'That address could not be suppressed.'))

      return { message: `${suppression.email} suppressed`, recordId: suppression.id }
    },
  }),

  'suppression.delete': handler({
    permission: 'content:write',
    entity: 'EmailSuppression',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const suppression = await prisma.emailSuppression
        .delete({ where: { id }, select: { email: true } })
        .catch((error) => friendly(error, 'That suppression could not be lifted.'))

      return { message: `${suppression.email} may be emailed again` }
    },
  }),

  'settings.brand': handler({
    permission: 'settings:write',
    entity: 'BrandKit',
    action: 'update',
    requiresRecord: false,
    schema: z.object({
      logoUrl: optionalText,
      primaryColor: optionalText,
      secondaryColor: optionalText,
      accentColor: optionalText,
      fontFamily: optionalText,
      websiteUrl: optionalText,
      physicalAddress: optionalText,
    }),
    async run(values, context) {
      const existing =
        context.recordId ?? (await prisma.brandKit.findFirst({ select: { id: true } }))?.id ?? null

      const data = {
        logoUrl: values.logoUrl,
        primaryColor: values.primaryColor,
        secondaryColor: values.secondaryColor,
        accentColor: values.accentColor,
        fontFamily: values.fontFamily,
        websiteUrl: values.websiteUrl,
        physicalAddress: values.physicalAddress,
      }

      const kit = existing
        ? await prisma.brandKit
            .update({ where: { id: existing }, data, select: { id: true } })
            .catch((error) => friendly(error, 'The brand kit could not be saved.'))
        : await prisma.brandKit
            .create({ data, select: { id: true } })
            .catch((error) => friendly(error, 'The brand kit could not be saved.'))

      return { message: 'Brand kit saved', recordId: kit.id }
    },
  }),
}

// ---------------------------------------------------------------------------
// content: pages, banners, FAQs, redirects
// ---------------------------------------------------------------------------

const CONTENT_STATUS_VALUES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const

const cmsPageShape = {
  title: required('Title'),
  slug: required('Slug'),
  kind: z.enum(['LANDING', 'SYSTEM']).default('LANDING'),
  status: z.enum(CONTENT_STATUS_VALUES).default('DRAFT'),
  scheduledFor: optionalDate,
  canonicalUrl: optionalText,
  seoTitle: optionalText,
  seoDescription: optionalText,
  noIndex: boolean,
}

/**
 * The two numbers Google actually shows, checked before the row is written.
 *
 * Part 18 of the repo guide holds every page to the budget `lib/blog/schemas.ts`
 * already enforces for articles, against the *effective* values rather than the
 * override alone.
 */
function checkPageSeo(values: {
  title: string
  seoTitle: string | null
  seoDescription: string | null
  status: string
  noIndex: boolean
}) {
  // A page kept out of the index has no snippet to fill, so the budget does not
  // apply to it.
  if (values.noIndex) return

  // Otherwise the same rule as an article, including the minimum: a CMS page is
  // a public URL with a search snippet like any other. A page has no excerpt, so
  // the meta description stands alone.
  const problem = checkPostSeo({
    status: values.status,
    title: values.title,
    excerpt: values.seoDescription ?? '',
    seoTitle: values.seoTitle,
    seoDescription: values.seoDescription,
  })
  if (problem) {
    throw new WriteError(problem, values.seoTitle ? 'seoTitle' : 'title')
  }
}

const cmsHandlers: Record<string, WriteHandler> = {
  'page.create': handler({
    permission: 'content:write',
    entity: 'Page',
    action: 'create',
    schema: z.object(cmsPageShape),
    async run(values, { actor }) {
      checkPageSeo(values)

      const page = await prisma.page
        .create({
          data: {
            title: values.title,
            slug: slugify(values.slug),
            kind: values.kind,
            status: values.status,
            scheduledFor: values.scheduledFor,
            publishedAt: values.status === 'PUBLISHED' ? new Date() : null,
            canonicalUrl: values.canonicalUrl,
            seoTitle: values.seoTitle,
            seoDescription: values.seoDescription,
            noIndex: values.noIndex,
            createdById: actor.id,
          },
          select: { id: true, title: true },
        })
        .catch((error) => friendly(error, 'That page could not be created.'))

      return { message: `${page.title} created`, recordId: page.id }
    },
  }),

  'page.edit': handler({
    permission: 'content:write',
    entity: 'Page',
    action: 'update',
    schema: z.object(cmsPageShape),
    async run(values, context) {
      const id = requireRecord(context)
      checkPageSeo(values)

      const current = await prisma.page.findUnique({ where: { id }, select: { publishedAt: true } })

      const page = await prisma.page
        .update({
          where: { id },
          data: {
            title: values.title,
            slug: slugify(values.slug),
            kind: values.kind,
            status: values.status,
            scheduledFor: values.scheduledFor,
            publishedAt:
              values.status === 'PUBLISHED' ? (current?.publishedAt ?? new Date()) : current?.publishedAt ?? null,
            canonicalUrl: values.canonicalUrl,
            seoTitle: values.seoTitle,
            seoDescription: values.seoDescription,
            noIndex: values.noIndex,
          },
          select: { title: true },
        })
        .catch((error) => friendly(error, 'That page could not be saved.'))

      return { message: `${page.title} saved`, recordId: id }
    },
  }),

  'page.publish': handler({
    permission: 'content:write',
    entity: 'Page',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const page = await prisma.page
        .update({
          where: { id },
          data: { status: 'PUBLISHED', publishedAt: new Date(), scheduledFor: null },
          select: { title: true, slug: true },
        })
        .catch((error) => friendly(error, 'That page could not be published.'))

      return { message: `${page.title} is live at /${page.slug}`, recordId: id }
    },
  }),

  'page.delete': handler({
    permission: 'content:write',
    entity: 'Page',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const page = await prisma.page
        .delete({ where: { id }, select: { title: true } })
        .catch((error) => friendly(error, 'That page could not be deleted.'))

      return { message: `${page.title} deleted` }
    },
  }),

  'banner.create': handler({
    permission: 'content:write',
    entity: 'Banner',
    action: 'create',
    schema: z.object({
      name: required('Name'),
      placement: z
        .enum(['SITE_WIDE_TOP', 'HOMEPAGE_HERO', 'CATEGORY', 'CHECKOUT', 'FUNDRAISING'])
        .default('SITE_WIDE_TOP'),
      status: z.enum(CONTENT_STATUS_VALUES).default('DRAFT'),
      headline: optionalText,
      body: optionalText,
      ctaText: optionalText,
      ctaHref: optionalText,
      imageUrl: optionalText,
      startsAt: optionalDate,
      endsAt: optionalDate,
      priority: optionalInt,
    }),
    async run(values) {
      const banner = await prisma.banner
        .create({
          data: {
            name: values.name,
            placement: values.placement,
            status: values.status,
            headline: values.headline,
            body: values.body,
            ctaText: values.ctaText,
            ctaHref: values.ctaHref,
            imageUrl: values.imageUrl,
            startsAt: values.startsAt,
            endsAt: values.endsAt,
            priority: values.priority ?? 0,
          },
          select: { id: true, name: true },
        })
        .catch((error) => friendly(error, 'That banner could not be created.'))

      return { message: `${banner.name} created`, recordId: banner.id }
    },
  }),

  'banner.edit': handler({
    permission: 'content:write',
    entity: 'Banner',
    action: 'update',
    schema: z.object({
      name: required('Name'),
      placement: z.enum(['SITE_WIDE_TOP', 'HOMEPAGE_HERO', 'CATEGORY', 'CHECKOUT', 'FUNDRAISING']),
      status: z.enum(CONTENT_STATUS_VALUES),
      headline: optionalText,
      body: optionalText,
      ctaText: optionalText,
      ctaHref: optionalText,
      imageUrl: optionalText,
      startsAt: optionalDate,
      endsAt: optionalDate,
      priority: optionalInt,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const banner = await prisma.banner
        .update({
          where: { id },
          data: {
            name: values.name,
            placement: values.placement,
            status: values.status,
            headline: values.headline,
            body: values.body,
            ctaText: values.ctaText,
            ctaHref: values.ctaHref,
            imageUrl: values.imageUrl,
            startsAt: values.startsAt,
            endsAt: values.endsAt,
            priority: values.priority ?? 0,
          },
          select: { name: true },
        })
        .catch((error) => friendly(error, 'That banner could not be saved.'))

      return { message: `${banner.name} saved`, recordId: id }
    },
  }),

  'banner.delete': handler({
    permission: 'content:write',
    entity: 'Banner',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const banner = await prisma.banner
        .delete({ where: { id }, select: { name: true } })
        .catch((error) => friendly(error, 'That banner could not be deleted.'))

      return { message: `${banner.name} deleted` }
    },
  }),

  'faq.create': handler({
    permission: 'content:write',
    entity: 'FaqItem',
    action: 'create',
    schema: z.object({
      question: required('Question'),
      answer: required('Answer'),
      status: z.enum(CONTENT_STATUS_VALUES).default('PUBLISHED'),
      sortOrder: optionalInt,
    }),
    async run(values) {
      const faq = await prisma.faqItem
        .create({
          data: {
            question: values.question,
            answer: values.answer,
            status: values.status,
            sortOrder: values.sortOrder ?? 0,
          },
          select: { id: true, question: true },
        })
        .catch((error) => friendly(error, 'That FAQ could not be created.'))

      return { message: `“${excerptLabel(faq.question)}” created`, recordId: faq.id }
    },
  }),

  'faq.edit': handler({
    permission: 'content:write',
    entity: 'FaqItem',
    action: 'update',
    schema: z.object({
      question: required('Question'),
      answer: required('Answer'),
      status: z.enum(CONTENT_STATUS_VALUES),
      sortOrder: optionalInt,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const faq = await prisma.faqItem
        .update({
          where: { id },
          data: {
            question: values.question,
            answer: values.answer,
            status: values.status,
            sortOrder: values.sortOrder ?? 0,
          },
          select: { question: true },
        })
        .catch((error) => friendly(error, 'That FAQ could not be saved.'))

      return { message: `“${excerptLabel(faq.question)}” saved`, recordId: id }
    },
  }),

  'faq.delete': handler({
    permission: 'content:write',
    entity: 'FaqItem',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const faq = await prisma.faqItem
        .delete({ where: { id }, select: { question: true } })
        .catch((error) => friendly(error, 'That FAQ could not be deleted.'))

      return { message: `“${excerptLabel(faq.question)}” deleted` }
    },
  }),

  'redirect.create': handler({
    permission: 'content:write',
    entity: 'Redirect',
    action: 'create',
    schema: z.object({
      source: required('From'),
      destination: required('To'),
      permanent: boolean,
      isActive: boolean,
      note: optionalText,
    }),
    async run(values) {
      const redirect = await prisma.redirect
        .create({
          data: {
            source: normalisePath(values.source),
            destination: values.destination.trim(),
            permanent: values.permanent,
            isActive: values.isActive,
            note: values.note,
          },
          select: { id: true, source: true },
        })
        .catch((error) => friendly(error, 'That redirect could not be created.'))

      return { message: `${redirect.source} redirects now`, recordId: redirect.id }
    },
  }),

  'redirect.edit': handler({
    permission: 'content:write',
    entity: 'Redirect',
    action: 'update',
    schema: z.object({
      source: required('From'),
      destination: required('To'),
      permanent: boolean,
      isActive: boolean,
      note: optionalText,
    }),
    async run(values, context) {
      const id = requireRecord(context)
      const redirect = await prisma.redirect
        .update({
          where: { id },
          data: {
            source: normalisePath(values.source),
            destination: values.destination.trim(),
            permanent: values.permanent,
            isActive: values.isActive,
            note: values.note,
          },
          select: { source: true },
        })
        .catch((error) => friendly(error, 'That redirect could not be saved.'))

      return { message: `${redirect.source} saved`, recordId: id }
    },
  }),

  'redirect.toggle': handler({
    permission: 'content:write',
    entity: 'Redirect',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const current = await prisma.redirect.findUnique({ where: { id }, select: { isActive: true } })
      if (!current) throw new WriteError('That redirect no longer exists.')

      const redirect = await prisma.redirect
        .update({ where: { id }, data: { isActive: !current.isActive }, select: { source: true, isActive: true } })
        .catch((error) => friendly(error, 'That redirect could not be changed.'))

      return {
        message: `${redirect.source} ${redirect.isActive ? 'is redirecting' : 'is off'}`,
        recordId: id,
      }
    },
  }),

  'redirect.delete': handler({
    permission: 'content:write',
    entity: 'Redirect',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const redirect = await prisma.redirect
        .delete({ where: { id }, select: { source: true } })
        .catch((error) => friendly(error, 'That redirect could not be deleted.'))

      return { message: `${redirect.source} deleted` }
    },
  }),
}

/** A redirect source is a path; a bare word is a mistake worth fixing quietly. */
function normalisePath(value: string): string {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/** Enough of a long string to name it in a toast. */
function excerptLabel(value: string, limit = 48): string {
  return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value
}

// ---------------------------------------------------------------------------
// notifications & integrations
// ---------------------------------------------------------------------------

const opsHandlers: Record<string, WriteHandler> = {
  'notification.markRead': handler({
    permission: null,
    entity: 'Notification',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)

      // Scoped to the actor: a notification belongs to one person, and marking
      // somebody else's as read would hide it from them.
      const notification = await prisma.notification.findFirst({
        where: { id, userId: context.actor.id },
        select: { id: true, entityType: true, entityId: true },
      })
      if (!notification) throw new WriteError('That notification is not yours to clear.')

      // A customer-email alert clears only once its steps are done. The rule lives in
      // lib/inbox/resolution.ts so this window and the web panel cannot disagree about
      // whether something has been handled.
      const verdict = await canClearNotification(notification)
      if (!verdict.allowed) {
        throw new WriteError(
          `${verdict.reason} Still open: ${verdict.outstanding.slice(0, 3).join('; ')}`,
        )
      }

      await prisma.notification.update({
        where: { id: notification.id },
        data: { isRead: true, readAt: new Date() },
      })

      return { message: 'Marked read', recordId: id }
    },
  }),

  'inboundEmail.completeStep': handler({
    permission: 'messaging:reply',
    entity: 'InboundEmail',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const stepId = requireRecord(context)
      const email = await completeStep({ stepId, userId: context.actor.id })

      const open = email.steps.filter((step) => !step.isOptional && step.completedAt === null)

      return {
        message:
          open.length === 0
            ? 'Step completed — everything is done, the alert is cleared.'
            : `Step completed — ${open.length} still open.`,
        recordId: email.id,
      }
    },
  }),

  'inboundEmail.reopenStep': handler({
    permission: 'messaging:reply',
    entity: 'InboundEmail',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const stepId = requireRecord(context)
      const email = await reopenStep({ stepId, userId: context.actor.id })
      return { message: 'Step re-opened', recordId: email.id }
    },
  }),

  'notification.markAllRead': handler({
    permission: null,
    entity: 'Notification',
    action: 'update',
    requiresRecord: false,
    schema: z.object({}),
    async run(_values, context) {
      // Through the shared helper rather than a bulk update, so a "mark everything read"
      // cannot do what a single click is refused: customer-email alerts with open steps
      // are left behind, and the count says how many actually cleared.
      const changed = await markAllNotificationsRead(context.actor.id)

      return { message: changed === 0 ? 'Nothing left unread' : `${changed} marked read` }
    },
  }),

  'integration.enable': handler({
    permission: 'api_keys:manage',
    entity: 'ThirdPartyIntegration',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const integration = await prisma.thirdPartyIntegration.findUnique({
        where: { id },
        select: { name: true, isConfigured: true },
      })
      if (!integration) throw new WriteError('That integration no longer exists.')
      // Turning on an integration with no credentials only produces failures at
      // the first call, so the refusal happens here where it can be explained.
      if (!integration.isConfigured) {
        throw new WriteError(`${integration.name} has no credentials yet. Configure it before enabling.`)
      }

      await prisma.thirdPartyIntegration
        .update({ where: { id }, data: { isActive: true, lastError: null } })
        .catch((error) => friendly(error, 'That integration could not be enabled.'))

      return { message: `${integration.name} enabled`, recordId: id }
    },
  }),

  'integration.disable': handler({
    permission: 'api_keys:manage',
    entity: 'ThirdPartyIntegration',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const integration = await prisma.thirdPartyIntegration
        .update({ where: { id }, data: { isActive: false }, select: { name: true } })
        .catch((error) => friendly(error, 'That integration could not be disabled.'))

      return { message: `${integration.name} disabled`, recordId: id }
    },
  }),

  'settings.shipping': handler({
    permission: 'settings:write',
    entity: 'ShippingSettings',
    action: 'update',
    requiresRecord: false,
    schema: z.object({
      originStreet: optionalText,
      originCity: optionalText,
      originState: optionalText,
      originZip: optionalText,
      defaultCarrier: optionalText,
      flatRateCents: optionalInt,
      weightSurchargeThresholdLb: optionalInt,
      weightSurchargeBaseCents: optionalInt,
      weightSurchargePerLbCents: optionalInt,
      internationalRateCents: optionalInt,
    }),
    async run(values, { actor }) {
      const origin =
        values.originStreet || values.originCity || values.originState || values.originZip
          ? {
              street1: values.originStreet,
              city: values.originCity,
              state: values.originState?.toUpperCase() ?? null,
              zip: values.originZip,
              country: 'US',
            }
          : Prisma.DbNull

      const settings = await prisma.shippingSettings
        .upsert({
          where: { singleton: 'singleton' },
          create: {
            singleton: 'singleton',
            originAddress: origin,
            defaultCarrier: values.defaultCarrier,
            flatRateCents: values.flatRateCents,
            weightSurchargeThresholdLb: values.weightSurchargeThresholdLb,
            weightSurchargeBaseCents: values.weightSurchargeBaseCents,
            weightSurchargePerLbCents: values.weightSurchargePerLbCents,
            internationalRateCents: values.internationalRateCents,
            updatedById: actor.id,
          },
          update: {
            originAddress: origin,
            defaultCarrier: values.defaultCarrier,
            flatRateCents: values.flatRateCents,
            weightSurchargeThresholdLb: values.weightSurchargeThresholdLb,
            weightSurchargeBaseCents: values.weightSurchargeBaseCents,
            weightSurchargePerLbCents: values.weightSurchargePerLbCents,
            internationalRateCents: values.internationalRateCents,
            updatedById: actor.id,
          },
          select: { id: true },
        })
        .catch((error) => friendly(error, 'Those shipping settings could not be saved.'))

      return { message: 'Shipping settings saved', recordId: settings.id }
    },
  }),
}

// ---------------------------------------------------------------------------
// the registry
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// loyalty rewards
// ---------------------------------------------------------------------------

/** The rules live in lib/loyalty-rewards, shared with the web screen; this only translates refusals. */
async function rewardWrite<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof RewardAdminError) throw new WriteError(error.message, error.field)
    return friendly(error, 'That reward could not be saved.')
  }
}

const rewardHandlers: Record<string, WriteHandler> = {
  'reward.create': handler({
    permission: 'settings:write',
    entity: 'LoyaltyReward',
    action: 'create',
    schema: rewardInputSchema,
    async run(values) {
      const reward = await rewardWrite(() => createReward(values))
      return { message: `${reward.name} added to the reward catalog`, recordId: reward.id }
    },
  }),

  'reward.edit': handler({
    permission: 'settings:write',
    entity: 'LoyaltyReward',
    action: 'update',
    schema: rewardInputSchema,
    async run(values, context) {
      const id = requireRecord(context)
      const reward = await rewardWrite(() => updateReward(id, values))
      return { message: `${reward.name} saved`, recordId: id }
    },
  }),

  'reward.toggle': handler({
    permission: 'settings:write',
    entity: 'LoyaltyReward',
    action: 'update',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      const current = await prisma.loyaltyReward.findUnique({ where: { id }, select: { isActive: true, name: true } })
      if (!current) throw new WriteError('That reward no longer exists.')
      await rewardWrite(() => setRewardActive(id, !current.isActive))
      return { message: `${current.name} ${current.isActive ? 'is off' : 'can be redeemed'}`, recordId: id }
    },
  }),

  'reward.delete': handler({
    permission: 'settings:write',
    entity: 'LoyaltyReward',
    action: 'delete',
    schema: z.object({}),
    async run(_values, context) {
      const id = requireRecord(context)
      await rewardWrite(() => deleteReward(id))
      return { message: 'Reward deleted' }
    },
  }),
}

export const WRITE_HANDLERS: Record<string, WriteHandler> = {
  ...orderHandlers,
  ...productHandlers,
  ...customerHandlers,
  ...fundraiserHandlers,
  ...eventHandlers,
  ...purchaseHandlers,
  ...invoiceHandlers,
  ...wholesaleHandlers,
  ...ledgerHandlers,
  ...campaignHandlers,
  ...socialHandlers,
  ...contentHandlers,
  ...leadHandlers,
  ...reviewHandlers,
  ...mediaHandlers,
  ...messageHandlers,
  ...userHandlers,
  ...settingsHandlers,
  ...returnHandlers,
  ...supplierPageHandlers,
  ...locationHandlers,
  ...manifestHandlers,
  ...arenaHandlers,
  ...emailPageHandlers,
  ...cmsHandlers,
  ...opsHandlers,
  ...rewardHandlers,
}

export function findWriteHandler(op: WriteOpId | string): WriteHandler | undefined {
  return WRITE_HANDLERS[op]
}
