/**
 * Card payments with Square's Mobile Payments SDK: Tap to Pay on iPhone or Android, a card number
 * keyed in for an order taken over the phone, or a paired Square Reader. Money goes to Jose
 * Madrid's Square account; the storefront confirms every payment with Square before the order
 * counts as paid.
 *
 * The SDK is native code, so it only exists in a development or store build (not Expo Go or the
 * web). It is loaded lazily: importing it where the native module is missing throws.
 */
import { NativeModules, Platform } from 'react-native'
import { randomUUID } from 'expo-crypto'
import type * as SquareSdk from 'mobile-payments-sdk-react-native'

export const cardPaymentsAvailable = Platform.OS !== 'web' && !!NativeModules.MobilePaymentsSdkReactNative

function sdk(): typeof SquareSdk {
  return require('mobile-payments-sdk-react-native') as typeof SquareSdk
}

type Call = <T>(path: string, options?: { method?: 'GET' | 'POST'; body?: unknown }) => Promise<T>

interface SquareAuthorization {
  accessToken: string
  locationId: string
}

/**
 * Sign the SDK in to the shop's Square account. Asked of the storefront every time, so a group
 * whose card payments were switched off stops here even on a phone that was signed in before.
 */
async function authorize(call: Call): Promise<SquareAuthorization> {
  const auth = await call<SquareAuthorization>('/square/authorization')
  const square = sdk()
  const state = String(await square.getAuthorizationState())
  const location = state === 'AUTHORIZED' ? await square.getAuthorizedLocation().catch(() => null) : null
  if (location?.id !== auth.locationId) {
    if (state === 'AUTHORIZED') await square.deauthorize().catch(() => undefined)
    await square.authorize(auth.accessToken, auth.locationId)
  }
  return auth
}

/** Signing out of the phone also signs it out of Square, so no payments token is left behind. */
export async function deauthorizeSquare() {
  if (!cardPaymentsAvailable) return
  await sdk().deauthorize().catch(() => undefined)
}

/**
 * Tap to Pay on iPhone needs the shop's Apple account linked once per phone (Apple shows its terms).
 * Android needs nothing extra. Failing here still leaves keyed entry and a Square Reader.
 */
async function prepareTapToPay() {
  if (Platform.OS !== 'ios') return
  const { TapToPaySettings } = sdk()
  try {
    if ((await TapToPaySettings.isDeviceCapable()) && !(await TapToPaySettings.isAppleAccountLinked())) {
      await TapToPaySettings.linkAppleAccount()
    }
  } catch {
    // Not linked; the payment screen still offers keyed entry and a reader.
  }
}

/**
 * Sign the SDK in and link Tap to Pay before the first sale, so tapping Charge goes straight to
 * Square's "hold the card near the phone" screen. Safe to call repeatedly.
 */
export async function warmUpCardReader(call: Call) {
  if (!cardPaymentsAvailable) return
  await authorize(call)
  await prepareTapToPay()
}

/** Square's reader screen: pair a Square Reader, check Tap to Pay, see the signed-in location. */
export async function openCardReaderSettings(call: Call) {
  await authorize(call)
  await prepareTapToPay()
  await sdk().showSettings()
}

export type CardResult =
  | { status: 'paid'; orderNumber: string }
  | { status: 'failed'; message: string }

function sdkErrorMessage(error: unknown): string {
  const info = (error as { userInfo?: { debugMessage?: string; message?: string } } | null)?.userInfo
  const message = info?.message ?? info?.debugMessage ?? (error instanceof Error ? error.message : '')
  return message && !/^\s*$/.test(message) ? message : 'The card was not charged.'
}

/**
 * Take the card for an order the storefront recorded as waiting on one, then have the storefront
 * confirm it with Square. A retry first asks whether an earlier attempt went through, so a
 * customer is never charged twice.
 */
export async function chargeOrder(
  call: Call,
  order: { id: string; orderNumber: string; amountCents: number },
  options: { retry?: boolean } = {}
): Promise<CardResult> {
  if (options.retry) {
    // Charge again only once the storefront has checked Square and found no payment for this
    // order. If that check itself fails, an earlier charge may have gone through: stop here.
    let earlier: { status: string; orderNumber: string }
    try {
      earlier = await call<{ status: string; orderNumber: string }>(`/orders/${order.id}/card`)
    } catch (error) {
      return {
        status: 'failed',
        message: `Could not check whether the card was already charged (${
          error instanceof Error ? error.message : String(error)
        }). Try again in a moment; the customer will not be charged twice.`,
      }
    }
    if (earlier.status === 'COMPLETED') return { status: 'paid', orderNumber: earlier.orderNumber }
    if (earlier.status !== 'PENDING') return { status: 'failed', message: 'This card order can no longer be charged.' }
  }

  let payment: SquareSdk.Payment
  try {
    const auth = await authorize(call)
    await prepareTapToPay()
    const { AdditionalPaymentMethodType, CurrencyCode, ProcessingMode, PromptMode, startPayment } = sdk()
    payment = await startPayment(
      {
        amountMoney: { amount: order.amountCents, currencyCode: CurrencyCode.USD },
        paymentAttemptId: randomUUID(),
        // Online only: the storefront has to see the payment in Square to mark the order paid.
        processingMode: ProcessingMode.ONLINE_ONLY,
        allowCardSurcharge: false,
        autocomplete: true,
        referenceId: order.id,
        locationId: auth.locationId,
        note: `Fundraiser order ${order.orderNumber}`,
      },
      {
        additionalMethods: [AdditionalPaymentMethodType.TAP_TO_PAY, AdditionalPaymentMethodType.KEYED],
        mode: PromptMode.DEFAULT,
      }
    )
  } catch (error) {
    return { status: 'failed', message: sdkErrorMessage(error) }
  }

  // The card went through on Square's side; now the storefront confirms it. A dropped connection
  // here is retried, and failing that the order is found by its reference later.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const confirmed = await call<{ status: string; orderNumber: string }>(`/orders/${order.id}/card`, {
        method: 'POST',
        body: { paymentId: String(payment.id) },
      })
      if (confirmed.status === 'COMPLETED') return { status: 'paid', orderNumber: confirmed.orderNumber }
    } catch (error) {
      if (attempt === 2) {
        return {
          status: 'failed',
          message: `The card was charged but the order could not be confirmed yet (${
            error instanceof Error ? error.message : String(error)
          }). Tap "Try card again" to check — it will not charge twice.`,
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
  }
  return { status: 'failed', message: 'Square has not confirmed the payment yet. Tap "Try card again" to check.' }
}

/** Give up on the card. The storefront cancels the order unless Square says it was paid after all. */
export async function cancelCardOrder(call: Call, orderId: string) {
  return call<{ status: 'COMPLETED' | 'CANCELED'; orderNumber: string }>(`/orders/${orderId}/card/cancel`, {
    method: 'POST',
  })
}
