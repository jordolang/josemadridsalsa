import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout
        tree={source.getPageTree()}
        nav={{
          title: 'Jose Madrid Salsa',
          url: '/docs',
        }}
        links={[
          { text: 'Shop', url: '/' },
          { text: 'Products', url: '/products' },
          { text: 'Recipes', url: '/recipes' },
        ]}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
