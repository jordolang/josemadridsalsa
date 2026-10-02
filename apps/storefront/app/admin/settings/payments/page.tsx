import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CreditCard, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SquareDisconnectButton } from '@/components/admin/settings/square-disconnect-button'
import { getSquareConnectionStatus, squareOAuthRedirectUrl } from '@/lib/square/oauth'

type ConnectionStatus = 'connected' | 'not_configured' | 'error'

interface PaymentProvider {
  id: string
  name: string
  description: string
  status: ConnectionStatus
  statusDetail: string
  setupInstructions?: string
  docsUrl?: string
}

function getStripeStatus(): ConnectionStatus {
  const hasSecretKey = !!process.env.STRIPE_SECRET_KEY
  const hasPublishableKey = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

  if (hasSecretKey && hasPublishableKey) return 'connected'
  if (hasSecretKey || hasPublishableKey) return 'error'
  return 'not_configured'
}

function getStripeStatusDetail(): string {
  const hasSecretKey = !!process.env.STRIPE_SECRET_KEY
  const hasPublishableKey = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

  if (hasSecretKey && hasPublishableKey) {
    return 'Both API keys are configured. Stripe payments are active.'
  }
  if (hasSecretKey && !hasPublishableKey) {
    return 'STRIPE_SECRET_KEY is set but NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing.'
  }
  if (!hasSecretKey && hasPublishableKey) {
    return 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set but STRIPE_SECRET_KEY is missing.'
  }
  return 'No Stripe API keys configured. Add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your environment.'
}

function getSquareStatus(): ConnectionStatus {
  const hasToken = !!process.env.SQUARE_ACCESS_TOKEN
  const hasLocation = !!process.env.SQUARE_LOCATION_ID
  if (hasToken && hasLocation) return 'connected'
  if (hasToken || hasLocation) return 'error'
  return 'not_configured'
}

function getSquareStatusDetail(): string {
  const sandbox = process.env.SQUARE_SANDBOX !== 'false'
  switch (getSquareStatus()) {
    case 'connected':
      return sandbox
        ? 'Square is configured against the SANDBOX. Payments are test payments; set SQUARE_SANDBOX=false for live sales.'
        : 'SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID are set. Square takes live payments.'
    case 'error':
      return process.env.SQUARE_ACCESS_TOKEN
        ? 'SQUARE_ACCESS_TOKEN is set but SQUARE_LOCATION_ID is missing.'
        : 'SQUARE_LOCATION_ID is set but SQUARE_ACCESS_TOKEN is missing.'
    default:
      return 'Square integration is not yet configured.'
  }
}

function getProviders(): PaymentProvider[] {
  return [
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Credit cards, debit cards, Apple Pay, Google Pay, and Link.',
      status: getStripeStatus(),
      statusDetail: getStripeStatusDetail(),
      docsUrl: 'https://dashboard.stripe.com/apikeys',
    },
    {
      id: 'paypal',
      name: 'PayPal',
      description: 'PayPal balance, cards, Pay Later, and Venmo via PayPal.',
      status: 'not_configured',
      statusDetail: 'PayPal integration is not yet configured.',
      setupInstructions:
        'To enable PayPal, add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to your environment variables. You can obtain these from the PayPal Developer Dashboard.',
      docsUrl: 'https://developer.paypal.com/dashboard/applications',
    },
    {
      id: 'square',
      name: 'Square',
      description: 'In-person payments at the POS and the kiosk.',
      status: getSquareStatus(),
      statusDetail: getSquareStatusDetail(),
      setupInstructions:
        'To enable Square, add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID to your environment variables, and SQUARE_SANDBOX=false for live payments. You can obtain these from the Square Developer Dashboard.',
      docsUrl: 'https://developer.squareup.com/apps',
    },
  ]
}

const statusConfig: Record<
  ConnectionStatus,
  { label: string; badgeClass: string; Icon: typeof CheckCircle2 }
> = {
  connected: {
    label: 'Connected',
    badgeClass: 'bg-primary/10 text-primary',
    Icon: CheckCircle2,
  },
  not_configured: {
    label: 'Not configured',
    badgeClass: 'bg-muted text-muted-foreground',
    Icon: XCircle,
  },
  error: {
    label: 'Partial setup',
    badgeClass: 'bg-yellow-100 text-yellow-800',
    Icon: XCircle,
  },
}

export default async function PaymentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ square?: string; reason?: string }>
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'settings:read'))) {
    redirect('/admin')
  }

  const providers = getProviders()
  const [square, canWrite, { square: squareResult, reason }] = await Promise.all([
    getSquareConnectionStatus(),
    hasPermission(user, 'settings:write'),
    searchParams,
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payment Providers</h1>
        <p className="text-muted-foreground">
          Manage payment provider connections and configuration.
        </p>
      </div>

      <div className="space-y-4">
        {providers.map((provider) => {
          const config = statusConfig[provider.status]
          const StatusIcon = config.Icon

          return (
            <Card key={provider.id} className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-muted p-3">
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-foreground">
                        {provider.name}
                      </h2>
                      <Badge className={config.badgeClass}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {config.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {provider.description}
                    </p>
                  </div>
                </div>

                {provider.docsUrl && (
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Dashboard
                    </a>
                  </Button>
                )}
              </div>

              <div className="mt-4 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-foreground">{provider.statusDetail}</p>
              </div>

              {provider.setupInstructions && provider.status === 'not_configured' && (
                <div className="mt-3 rounded-lg border border-border bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Setup instructions
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {provider.setupInstructions}
                  </p>
                </div>
              )}
            </Card>
          )
        })}

        <SquareReaderCard square={square} canWrite={canWrite} result={squareResult} reason={reason} />
      </div>
    </div>
  )
}

/**
 * The kiosk iPad's Square Reader signs in with an OAuth connection, which Square requires
 * for its Mobile Payments SDK; the API keys above are not enough for it.
 */
function SquareReaderCard({
  square,
  canWrite,
  result,
  reason,
}: {
  square: Awaited<ReturnType<typeof getSquareConnectionStatus>>
  canWrite: boolean
  result?: string
  reason?: string
}) {
  const config = statusConfig[square.connected ? 'connected' : square.configured ? 'not_configured' : 'error']
  const StatusIcon = config.Icon
  const expires = square.expiresAt ? new Date(square.expiresAt) : null

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-muted p-3">
            <CreditCard className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">Square card reader (kiosk)</h2>
              <Badge className={config.badgeClass}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {square.connected ? 'Connected' : square.configured ? 'Not connected' : 'Needs setup'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Lets the kiosk iPad take cards on a Bluetooth Square Reader. Square requires a connection made here, not
              the API keys above.
            </p>
          </div>
        </div>

        {canWrite && square.configured && (
          square.connected ? (
            <SquareDisconnectButton />
          ) : (
            <Button size="sm" asChild className="shrink-0">
              {/* No prefetch: the route starts an authorization and redirects to Square. */}
              <Link href="/api/admin/square/oauth/connect" prefetch={false}>
                Connect Square
              </Link>
            </Button>
          )
        )}
      </div>

      {result === 'connected' && (
        <div className="mt-4 rounded-lg bg-primary/10 p-4 text-sm text-primary">Square is connected. Kiosks sign in on their next launch or reload.</div>
      )}
      {result === 'error' && (
        <div className="mt-4 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{reason ?? 'Connect Square failed.'}</div>
      )}

      <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-foreground">
        {square.connected ? (
          <>
            Connected to Square account <span className="font-mono">{square.merchantId}</span>
            {square.connectedAt ? ` since ${new Date(square.connectedAt).toLocaleDateString('en-US')}` : ''}. The token
            renews itself{expires ? `; the current one runs to ${expires.toLocaleDateString('en-US')}` : ''}.
          </>
        ) : square.configured ? (
          'Not connected yet. Use Connect Square and sign in with the Square account the kiosk sells for.'
        ) : (
          <>
            Add <span className="font-mono">SQUARE_APPLICATION_ID</span> and{' '}
            <span className="font-mono">SQUARE_APPLICATION_SECRET</span> (Square Developer Dashboard › your app ›
            OAuth), and register <span className="font-mono">{squareOAuthRedirectUrl()}</span> as the redirect URL there.
          </>
        )}
      </div>
    </Card>
  )
}
