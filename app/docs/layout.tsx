import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Documentation | José Madrid Salsa',
  description: 'Complete documentation for the José Madrid Salsa e-commerce platform',
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  )
}
