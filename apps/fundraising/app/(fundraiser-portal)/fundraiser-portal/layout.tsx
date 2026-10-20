import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { getCurrentFundraiserAccount, getCurrentUser } from '@/lib/rbac'
import { PortalNav } from '@/components/fundraiser-portal/portal-nav'

function NoFundraiserAccount() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 font-serif text-3xl font-bold text-gray-900">
          No fundraiser on this account
        </h1>
        <p className="mb-8 text-gray-600">
          You&apos;re signed in, but this account isn&apos;t linked to a fundraiser yet. Start one, or sign in
          with the account you used to set up your fundraiser. Questions? Email{' '}
          <a href="mailto:mike@josemadridsalsa.com" className="text-salsa-600 hover:text-salsa-700">
            mike@josemadridsalsa.com
          </a>
          .
        </p>
        <Link
          href="/start"
          className="inline-block rounded-md bg-salsa-500 px-6 py-3 text-white hover:bg-salsa-600"
        >
          Start a fundraiser
        </Link>
      </div>
    </div>
  )
}

export default async function FundraiserPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  // proxy.ts forwards the path as x-pathname. Nothing sets x-invoke-path, which
  // this used to read: a PENDING account then never matched the pending page
  // and was redirected to it forever.
  const pathname = headersList.get('x-pathname') || ''

  const account = await getCurrentFundraiserAccount()

  if (!account) {
    // Signed in, but this login has no fundraiser. Sending them to sign-in again
    // looked like sign-in was broken, so say what is wrong instead.
    if (await getCurrentUser()) {
      return <NoFundraiserAccount />
    }
    redirect(`/auth/signin?${new URLSearchParams({ callbackUrl: pathname || '/fundraiser-portal/dashboard' })}`)
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
            <a href="mailto:mike@josemadridsalsa.com" className="text-salsa-600 hover:text-salsa-700">
              mike@josemadridsalsa.com
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
