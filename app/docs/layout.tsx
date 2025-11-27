import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { docSource } from '@/lib/docs/source'

interface DocsLayoutProps {
  children: ReactNode
}

export default function DocumentationLayout({ children }: DocsLayoutProps) {
  return (
    <DocsLayout
      tree={docSource.pageTree}
      githubUrl="https://github.com/josemadridsalsa/josemadridsalsa"
      nav={{
        title: 'Jose Madrid Salsa Docs',
        url: '/docs',
      }}
      links={[
        { type: 'main', text: 'Storefront', url: '/' },
        { type: 'main', text: 'Admin', url: '/admin' },
      ]}
      sidebar={{
        defaultOpenLevel: 1,
      }}
      themeSwitch={{ enabled: true }}
    >
      {children}
    </DocsLayout>
  )
}
