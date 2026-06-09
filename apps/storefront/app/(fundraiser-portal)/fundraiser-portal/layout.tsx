import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getCurrentFundraiserAccount } from '@/lib/rbac'
import { PortalNav } from '@/components/fundraiser-portal/portal-nav'

export default async function FundraiserPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const pathname = headersList.get('x-invoke-path') || ''

  const account = await getCurrentFundraiserAccount()

  if (!account) {
    redirect('/auth/signin')
  }

  if (account.status === 'PENDING') {
    // Allow the pending page to render but nothing else
    const isPendingPage = pathname === '/fundraiser-portal/pending'

    if (!isPendingPage) {
      redirect('/fundraiser-portal/pending')
    }

    return (
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    )
  }

  if (account.status === 'SUSPENDED') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md text-center">
          <h1 className="mb-4 font-serif text-3xl font-bold text-gray-900">
            Account Suspended
          </h1>
          <p className="text-gray-600">
            Your fundraiser account has been suspended. Please contact us at{' '}
            <a href="mailto:fundraising@josemadrid.net" className="text-salsa-600 hover:text-salsa-700">
              fundraising@josemadrid.net
            </a>{' '}
            for more information.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <PortalNav
        fundraiserName={account.fundraiser.name}
        subdomain={account.fundraiser.subdomain}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
