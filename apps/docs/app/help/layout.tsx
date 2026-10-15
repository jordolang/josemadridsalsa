import { helpSource } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      search={{
        options: {
          type: 'static',
          api: '/api/search/help',
        },
      }}
      theme={{
        enabled: true,
        defaultTheme: 'system',
        attribute: 'class',
      }}
    >
      <DocsLayout
        tree={helpSource.getPageTree()}
        nav={{
          title: (
            <div className="flex items-center gap-2.5">
              <Image
                src="/images/logo-image.png"
                alt="Jose Madrid Salsa"
                width={30}
                height={30}
                className="rounded-lg"
              />
              <span
                className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-amber-500"
                style={{ fontFamily: 'var(--font-volkhov), Volkhov, Georgia, serif' }}
              >
                Help Center
              </span>
            </div>
          ),
          url: '/help',
        }}
        sidebar={{
          defaultOpenLevel: 1,
          banner: (
            <div className="rounded-xl bg-gradient-to-br from-amber-500/10 via-red-500/5 to-green-500/5 border border-amber-200/50 dark:border-amber-800/25 p-3.5 mb-1">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">
                Customer Help
              </p>
              <p className="text-[11px] text-stone-600/80 dark:text-stone-400/70 leading-relaxed">
                Can&apos;t find your answer?{' '}
                <a href="https://www.josemadridsalsa.com/contact" className="underline hover:text-red-600">
                  Contact us
                </a>{' '}
                and a real person will help.
              </p>
            </div>
          ),
          footer: (
            <div className="px-2 py-3 border-t border-fd-border">
              <Link
                href="/docs"
                className="text-xs text-fd-muted-foreground hover:text-fd-primary transition-colors"
              >
                Looking for developer docs? →
              </Link>
            </div>
          ),
        }}
        links={[
          { text: 'Shop Salsa', url: 'https://www.josemadridsalsa.com/products', external: true },
          { text: 'Fundraising', url: 'https://www.josemadridsalsa.com/fundraising', external: true },
          { text: 'Contact Us', url: 'https://www.josemadridsalsa.com/contact', external: true },
        ]}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
