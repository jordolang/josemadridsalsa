import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: 'noindex',
}

export default function FundraiserSubdomainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  )
}
