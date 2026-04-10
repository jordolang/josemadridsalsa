import { redirect } from 'next/navigation'
import { CreditCard, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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
      description: 'In-person and online payments with Square.',
      status: 'not_configured',
      statusDetail: 'Square integration is not yet configured.',
      setupInstructions:
        'To enable Square, add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID to your environment variables. You can obtain these from the Square Developer Dashboard.',
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

export default async function PaymentSettingsPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'settings:read'))) {
    redirect('/admin')
  }

  const providers = getProviders()

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
      </div>
    </div>
  )
}
