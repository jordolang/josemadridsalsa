import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { sendOrderConfirmationEmail } from '@/lib/email/automation'
import { deductReservedInventoryInTx, checkAndUpdateAlerts } from '@/lib/inventory-manager'
import { PAID_PAYMENT_STATUS, isPaid } from '@/lib/payments/status'
import { emitDomainEvent } from '@/lib/domain-events/emit'
import { dedupeKeys, notifyOperators, severityFor } from '@/lib/notifications/dispatch'
import { redeemOrderCodesInTx } from '@/lib/orders/redeem-codes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Stripe webhook handler
export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 }
    )
  }

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const error = err as Error
    console.error('Webhook signature verification failed:', error.message)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${error.message}` },
      { status: 400 }
    )
  }

  try {
    // Idempotency check: prevent duplicate processing of the same webhook event
    const existingWebhookEvent = await prisma.webhookEvent.findUnique({
      where: { stripeEventId: event.id },
    })

    if (existingWebhookEvent?.processed) {
      console.log('Webhook event already processed, skipping:', event.id)
      return NextResponse.json({ received: true })
    }

    // Create webhook event record (or update if exists but not processed)
    await prisma.webhookEvent.upsert({
      where: { stripeEventId: event.id },
      create: {
        stripeEventId: event.id,
        type: event.type,
        processed: false,
      },
      update: {
        type: event.type,
      },
    })

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (!orderId) {
          console.warn('Payment intent missing orderId in metadata:', paymentIntent.id)
          return NextResponse.json({ received: true })
        }

        // Find the order
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            items: true,
            giftCertificates: true,
          },
        })

        if (!order) {
          console.error('Order not found for payment intent:', paymentIntent.id, 'orderId:', orderId)
          return NextResponse.json({ received: true })
        }

        // Skip if already paid
        if (isPaid(order.paymentStatus)) {
          console.log('Order already marked as paid:', orderId)
          return NextResponse.json({ received: true })
        }

        // Update order status and payment record
        const deductionResults = await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: PAID_PAYMENT_STATUS,
              status: 'CONFIRMED',
              stripePaymentId: paymentIntent.id,
            },
          })

          await emitDomainEvent(
            {
              type: 'payment.completed',
              entityType: 'order',
              entityId: order.id,
              payload: {
                provider: 'STRIPE',
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                paymentIntentId: paymentIntent.id,
              },
            },
            tx
          )

          // Update or create Payment record
          await tx.payment.upsert({
            where: { stripePaymentIntentId: paymentIntent.id },
            create: {
              stripePaymentIntentId: paymentIntent.id,
              orderId: order.id,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              status: 'SUCCEEDED',
              paymentMethod: paymentIntent.payment_method_types?.[0],
            },
            update: {
              status: 'SUCCEEDED',
              paymentMethod: paymentIntent.payment_method_types?.[0],
            },
          })

          // Deduct reserved inventory for product orders (not gift certificates).
          // Uses deductReservedInventoryInTx to atomically decrement both
          // `inventory` and `stockReserved`, preventing double-counting.
          // Item-level idempotency: skip items that already have an
          // ORDER_COMPLETION transaction for this order to guard against
          // the race between transaction commit and the `processed` marker.
          const deductionResults: Array<{
            productId: string
            newInventory: number
            lowStockThreshold: number
          }> = []

          if (order.items.length > 0) {
            for (const item of order.items) {
              const existingDeduction = await tx.inventoryTransaction.findFirst({
                where: {
                  productId: item.productId,
                  orderId: order.id,
                  reason: 'ORDER_COMPLETION',
                },
              })

              if (existingDeduction) {
                continue
              }

              const result = await deductReservedInventoryInTx(
                {
                  productId: item.productId,
                  quantity: item.quantity,
                  orderId: order.id,
                  notes: `Webhook deduction for order ${order.orderNumber}`,
                },
                tx
              )

              deductionResults.push({
                productId: item.productId,
                newInventory: result.newInventory,
                lowStockThreshold: result.product.lowStockThreshold,
              })
            }
          }

          // Redeem the codes recorded on the order. Idempotent on orderId, because
          // /api/checkout/complete completes the same order in parallel.
          await redeemOrderCodesInTx(tx, {
            orderId: order.id,
            userId: order.userId,
            discountCode: order.discountCode,
            discountAmount: Number(order.discountAmount),
            giftCertificateCode: order.giftCertificateCode,
            giftCertificateAmount: Number(order.giftCertificateAmount),
            orderTotal: Number(order.total),
          })

          return deductionResults
        })

        // Fire inventory alerts after the transaction commits
        for (const d of deductionResults) {
          checkAndUpdateAlerts(d.productId, d.newInventory, d.lowStockThreshold).catch(
            (err) => console.error(`Alert sync failed for product ${d.productId}:`, err)
          )
        }

        console.log('Order payment confirmed via webhook:', orderId)

        if (!order.confirmationEmailSentAt) {
          sendOrderConfirmationEmail(order.id).catch((error) => {
            console.error('Failed to send confirmation email', { orderId, error })
          })
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          await prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: orderId },
              data: {
                paymentStatus: 'FAILED',
              },
            })

            // Update Payment record
            await tx.payment.upsert({
              where: { stripePaymentIntentId: paymentIntent.id },
              create: {
                stripePaymentIntentId: paymentIntent.id,
                orderId,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: 'FAILED',
                paymentMethod: paymentIntent.payment_method_types?.[0],
              },
              update: {
                status: 'FAILED',
              },
            })
          })

          // Notified outside the transaction: a failed notification must not roll back the
          // record of the failed payment.
          await notifyOperators({
            type: 'PAYMENT_FAILED',
            severity: severityFor('PAYMENT_FAILED'),
            title: 'Payment failed',
            message: `Payment on order ${orderId} did not go through`,
            entityType: 'order',
            entityId: orderId,
            link: '/admin/orders?view=payment-failed',
            dedupeKey: dedupeKeys.paymentFailed(orderId),
          })

          console.log('Order payment failed via webhook:', orderId)
        }
        break
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          await prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: orderId },
              data: {
                paymentStatus: 'FAILED',
                status: 'CANCELLED',
              },
            })

            await emitDomainEvent(
              {
                type: 'payment.failed',
                entityType: 'order',
                entityId: orderId,
                payload: { provider: 'STRIPE', paymentIntentId: paymentIntent.id },
              },
              tx
            )

            // Update Payment record
            await tx.payment.upsert({
              where: { stripePaymentIntentId: paymentIntent.id },
              create: {
                stripePaymentIntentId: paymentIntent.id,
                orderId,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: 'CANCELED',
                paymentMethod: paymentIntent.payment_method_types?.[0],
              },
              update: {
                status: 'CANCELED',
              },
            })
          })
          console.log('Order payment canceled via webhook:', orderId)
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const stripe = getStripe()

        const chargePaymentIntentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id

        // orderId lives on the PaymentIntent's metadata (set in StripeProvider.createPayment).
        // Stripe does not copy PaymentIntent metadata onto the Charge, so charge.metadata is
        // empty here and this handler used to bail on every refund. Fall back to the intent.
        let orderId = charge.metadata?.orderId

        if (!orderId && chargePaymentIntentId) {
          const chargeIntent = await stripe.paymentIntents.retrieve(chargePaymentIntentId)
          orderId = chargeIntent.metadata?.orderId
        }

        if (!orderId) {
          console.warn('Skipping refund processing: cannot resolve orderId for charge:', charge.id)
          return NextResponse.json({ received: true })
        }

        const isFullRefund = charge.amount_refunded === charge.amount

        // Since Stripe API 2022-11-15 the Charge no longer auto-expands its refunds, so
        // charge.refunds is absent on the webhook payload and this was skipping every refund.
        let stripeRefund = charge.refunds?.data?.[0]

        if (!stripeRefund) {
          const refunds = await stripe.refunds.list({ charge: charge.id, limit: 1 })
          stripeRefund = refunds.data[0]
        }

        if (!stripeRefund) {
          console.warn('Skipping refund processing: no refund found for charge:', charge.id)
          return NextResponse.json({ received: true })
        }

        // Fetch order with items to restore inventory
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        })

        if (!order) {
          console.error('Order not found for refund:', orderId)
          return NextResponse.json({ received: true })
        }

        // Find the payment record
        const payment = await prisma.payment.findFirst({
          where: { orderId },
        })

        if (!payment) {
          console.error('Payment not found for order:', orderId)
          return NextResponse.json({ received: true })
        }

        await prisma.$transaction(async (tx) => {
          // Update order status
          await tx.order.update({
            where: { id: orderId },
            data: {
              status: isFullRefund ? 'REFUNDED' : order.status,
              paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            },
          })

          // Update payment status
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            },
          })

          // Create refund record
          await tx.refund.upsert({
            where: { stripeRefundId: stripeRefund.id },
            create: {
              stripeRefundId: stripeRefund.id,
              paymentId: payment.id,
              amount: stripeRefund.amount,
              reason: stripeRefund.reason || undefined,
              status: 'SUCCEEDED',
            },
            update: {
              status: 'SUCCEEDED',
            },
          })

          // Restore inventory on full refunds only
          // Note: Partial refunds do not restore inventory as they may not correspond to specific items being returned.
          // For partial refunds, inventory must be manually adjusted by an administrator.
          if (isFullRefund && order.items.length > 0) {
            await Promise.all(
              order.items.map((item) =>
                tx.product.update({
                  where: { id: item.productId },
                  data: {
                    inventory: { increment: item.quantity },
                  },
                })
              )
            )
          }

          // Create audit log entry to track this refund processing
          await tx.auditLog.create({
            data: {
              action: 'webhook.refund',
              entityType: 'order',
              entityId: orderId,
              changes: {
                refundId: stripeRefund.id,
                chargeId: charge.id,
                isFullRefund,
                amountRefunded: charge.amount_refunded,
                inventoryRestored: isFullRefund && order.items.length > 0,
              },
            },
          })
        })

        console.log('Order refund processed via webhook:', orderId, isFullRefund ? 'FULL' : 'PARTIAL')
        break
      }

      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session
        const {
          extractFundraiserTeamId,
          extractFundraiserSeasonId,
          extractFundraiserCharacterId,
          resolveDonorFromStripeSession,
        } = await import('@/lib/arena/stripe-donor')
        const fundraiserTeamId = extractFundraiserTeamId(checkoutSession)
        if (!fundraiserTeamId) {
          console.log('checkout.session.completed — no fundraiserTeamId, skipping')
          break
        }

        // Subscription-mode checkouts settle via invoice.payment_succeeded
        // so recurring donations only trigger damage + receipts once per
        // billing period.
        if (checkoutSession.mode === 'subscription') {
          console.log(
            `checkout.session.completed — subscription mode, deferring to invoice.payment_succeeded (session=${checkoutSession.id})`,
          )
          break
        }

        // Season linkage policy:
        //   - metadata seasonId matches team.seasonId → apply damage.
        //   - metadata missing, team.seasonId present → warn + fall back.
        //   - metadata present, team.seasonId differs → warn (season rotated
        //     mid-checkout) + fall back to team's current season.
        //   - BOTH missing → error, skip damage entirely (team isn't in any
        //     season). The purchase itself still settles; we just don't
        //     apply combat.
        const metadataSeasonId = extractFundraiserSeasonId(checkoutSession)
        let skipDamage = false
        try {
          const { prisma: db } = await import('@/lib/prisma')
          const teamRow = await db.fundraiserTeam.findUnique({
            where: { id: fundraiserTeamId },
            select: { seasonId: true },
          })
          const teamSeasonId = teamRow?.seasonId ?? null
          if (!metadataSeasonId && !teamSeasonId) {
            console.error(
              `checkout.session.completed — team ${fundraiserTeamId} has no season (metadata + team both null), skipping damage (session=${checkoutSession.id})`,
            )
            skipDamage = true
          } else if (!metadataSeasonId) {
            console.warn(
              `checkout.session.completed — legacy session without fundraiserSeasonId (session=${checkoutSession.id}), falling back to team.seasonId=${teamSeasonId}`,
            )
          } else if (teamSeasonId && teamSeasonId !== metadataSeasonId) {
            console.warn(
              `season mismatch for team ${fundraiserTeamId}: metadata=${metadataSeasonId} team=${teamSeasonId} (session=${checkoutSession.id})`,
            )
          }
        } catch (err) {
          // Lookup failed — fall through and let applyPurchaseDamage try.
          // It's its own source of truth for the damage decision; we'd
          // rather under-log than double-block a purchase on a DB blip.
          console.error('season guard lookup failed:', err)
        }

        const amountCents = checkoutSession.amount_total ?? 0
        const amountDollars = amountCents / 100
        const donor = resolveDonorFromStripeSession(checkoutSession)

        let saleEventId: string | null = null
        let isReplay = false
        if (!skipDamage) {
          try {
            const { applyPurchaseDamage } = await import('@/lib/arena/damage')
            const result = await applyPurchaseDamage({
              sellingTeamId: fundraiserTeamId,
              saleAmount: amountDollars,
              orderId: checkoutSession.id,
              sellingCharacterId: extractFundraiserCharacterId(checkoutSession),
              donor,
            })
            saleEventId = result.saleEventId
            isReplay = result.idempotentHit === true
            console.log(
              `Fundraiser damage applied for team ${fundraiserTeamId}: $${amountDollars} dealt to ${result.damagedTeams.length} opponents${isReplay ? ' (idempotent replay)' : ''}`,
            )
          } catch (err) {
            // Do NOT rethrow — a damage engine failure must not block the
            // rest of the webhook from marking itself processed.
            console.error('applyPurchaseDamage failed inside webhook:', err)
          }
        }

        // Donor receipt. Skip on replay (already sent), on missing email,
        // and swallow any failure so it can't block the webhook ACK.
        if (!isReplay && donor.email) {
          try {
            const { prisma: db } = await import('@/lib/prisma')
            const team = await db.fundraiserTeam.findUnique({
              where: { id: fundraiserTeamId },
              select: { name: true, school: true, slug: true },
            })
            if (team) {
              const { sendFundraiserDonationReceipt } = await import('@/lib/email/automation')
              await sendFundraiserDonationReceipt({
                donorEmail: donor.email,
                donorName: donor.name,
                donorUserId: donor.userId,
                isAnonymous: donor.isAnonymous,
                teamName: team.name,
                teamSchool: team.school,
                teamSlug: team.slug,
                amountCents,
                currency: (checkoutSession.currency ?? 'usd').toUpperCase(),
                receiptId: saleEventId ?? checkoutSession.id,
                comment: donor.comment,
              })
            }
          } catch (err) {
            console.error('sendFundraiserDonationReceipt failed:', err)
          }
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        // Stripe moved the subscription reference across API versions —
        // look in every documented location before giving up.
        const invAny = invoice as unknown as {
          subscription?: string | Stripe.Subscription | null
          subscription_details?:
            | { subscription?: string | Stripe.Subscription | null }
            | null
          parent?: {
            subscription_details?: {
              subscription?: string | Stripe.Subscription | null
            } | null
          } | null
        }
        const subRef =
          invAny.subscription ??
          invAny.subscription_details?.subscription ??
          invAny.parent?.subscription_details?.subscription ??
          null
        const subscriptionId =
          typeof subRef === 'string' ? subRef : (subRef?.id ?? null)
        if (!subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const {
          extractFundraiserTeamId,
          extractFundraiserSeasonId,
          extractFundraiserCharacterId,
          resolveDonorFromStripeSession,
        } = await import('@/lib/arena/stripe-donor')

        const metaSource = {
          metadata: subscription.metadata,
          customer_details: {
            email: invoice.customer_email ?? null,
            name: invoice.customer_name ?? null,
          },
        }
        const fundraiserTeamId = extractFundraiserTeamId(metaSource)
        if (!fundraiserTeamId) {
          console.log(
            `invoice.payment_succeeded — subscription ${subscriptionId} is not a fundraiser, skipping`,
          )
          break
        }

        // Season linkage policy mirrors checkout.session.completed. For
        // recurring donations a rollover mismatch is normal — log as info,
        // not an audit warning. Only error-and-skip if BOTH sources lack a
        // seasonId (team has no season at all).
        const metadataSeasonId = extractFundraiserSeasonId(metaSource)
        let skipDamage = false
        try {
          const { prisma: db } = await import('@/lib/prisma')
          const teamRow = await db.fundraiserTeam.findUnique({
            where: { id: fundraiserTeamId },
            select: { seasonId: true },
          })
          const teamSeasonId = teamRow?.seasonId ?? null
          if (!metadataSeasonId && !teamSeasonId) {
            console.error(
              `invoice.payment_succeeded — team ${fundraiserTeamId} has no season (metadata + team both null), skipping damage (sub=${subscriptionId})`,
            )
            skipDamage = true
          } else if (metadataSeasonId && teamSeasonId && teamSeasonId !== metadataSeasonId) {
            console.log(
              `recurring donation season rollover for team ${fundraiserTeamId}: metadata=${metadataSeasonId} team=${teamSeasonId} (sub=${subscriptionId})`,
            )
          }
        } catch (err) {
          console.error('season guard lookup failed (recurring):', err)
        }

        const amountCents = invoice.amount_paid ?? 0
        const amountDollars = amountCents / 100
        const donor = resolveDonorFromStripeSession(metaSource)

        let saleEventId: string | null = null
        let isReplay = false
        if (!skipDamage) {
          try {
            const { applyPurchaseDamage } = await import('@/lib/arena/damage')
            const result = await applyPurchaseDamage({
              sellingTeamId: fundraiserTeamId,
              saleAmount: amountDollars,
              orderId: invoice.id ?? undefined,
              sellingCharacterId: extractFundraiserCharacterId(metaSource),
              donor,
            })
            saleEventId = result.saleEventId
            isReplay = result.idempotentHit === true
            console.log(
              `Fundraiser recurring damage for team ${fundraiserTeamId} (sub=${subscriptionId}): $${amountDollars} across ${result.damagedTeams.length} opponents${isReplay ? ' (idempotent replay)' : ''}`,
            )
          } catch (err) {
            console.error('applyPurchaseDamage failed inside invoice webhook:', err)
          }
        }

        if (!isReplay && donor.email) {
          try {
            const { prisma: db } = await import('@/lib/prisma')
            const team = await db.fundraiserTeam.findUnique({
              where: { id: fundraiserTeamId },
              select: { name: true, school: true, slug: true },
            })
            if (team) {
              const { sendFundraiserDonationReceipt } = await import('@/lib/email/automation')
              await sendFundraiserDonationReceipt({
                donorEmail: donor.email,
                donorName: donor.name,
                donorUserId: donor.userId,
                isAnonymous: donor.isAnonymous,
                teamName: team.name,
                teamSchool: team.school,
                teamSlug: team.slug,
                amountCents,
                currency: (invoice.currency ?? 'usd').toUpperCase(),
                receiptId: saleEventId ?? invoice.id ?? subscriptionId,
                comment: donor.comment,
              })
            }
          } catch (err) {
            console.error('sendFundraiserDonationReceipt failed (recurring):', err)
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // Mark webhook event as processed
    await prisma.webhookEvent.update({
      where: { stripeEventId: event.id },
      data: { processed: true },
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
