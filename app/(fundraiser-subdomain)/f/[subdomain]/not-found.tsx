import Link from 'next/link'

export default function FundraiserNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md">
        <h1 className="mb-4 font-serif text-4xl font-bold text-gray-900">
          Fundraiser Not Found
        </h1>
        <p className="mb-6 text-lg text-gray-600">
          We couldn&apos;t find a fundraiser at this address. It may have been
          moved or is no longer active.
        </p>
        <Link
          href="https://josemadridsalsa.com/fundraising"
          className="inline-block rounded-md bg-salsa-500 px-6 py-3 text-white hover:bg-salsa-600"
        >
          Learn About Fundraising
        </Link>
      </div>
    </div>
  )
}
