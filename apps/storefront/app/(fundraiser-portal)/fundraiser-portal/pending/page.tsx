import Link from 'next/link'

export default function FundraiserPendingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-chile-100">
          <svg className="h-8 w-8 text-chile-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="mb-4 font-serif text-3xl font-bold text-gray-900">
          Account Pending Approval
        </h1>
        <p className="mb-6 text-gray-600">
          Thank you for signing up! Your fundraiser account is being reviewed by our team.
          You&apos;ll receive an email once your account has been approved and you can start
          customizing your fundraiser page.
        </p>
        <p className="mb-8 text-sm text-gray-500">
          This usually takes 1-2 business days. If you have questions, reach out to{' '}
          <a href="mailto:mike@josemadridsalsa.com" className="text-salsa-600 hover:text-salsa-700">
            mike@josemadridsalsa.com
          </a>
        </p>
        <Link
          href="/"
          className="inline-block rounded-md bg-salsa-500 px-6 py-3 text-white hover:bg-salsa-600"
        >
          Back to Jose Madrid Salsa
        </Link>
      </div>
    </div>
  )
}
