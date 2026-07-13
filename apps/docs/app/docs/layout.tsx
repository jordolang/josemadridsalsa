import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Banner } from 'fumadocs-ui/components/banner';
import type { ReactNode } from 'react';
import Image from 'next/image';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      search={{
        options: {
          type: 'static',
        },
      }}
      theme={{
        enabled: true,
        defaultTheme: 'system',
        attribute: 'class',
      }}
    >
      <Banner
        variant="rainbow"
        id="jms-docs-v1"
      >
        Welcome to the Jose Madrid Salsa developer docs — explore features, APIs, and deployment guides.
      </Banner>
      <DocsLayout
        tree={source.getPageTree()}
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
                JMS Docs
              </span>
            </div>
          ),
          url: '/docs',
        }}
        sidebar={{
          defaultOpenLevel: 1,
          banner: (
            <div className="rounded-xl bg-gradient-to-br from-red-500/10 via-amber-500/5 to-green-500/5 border border-red-200/40 dark:border-red-800/25 p-3.5 mb-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                  Developer Docs
                </p>
              </div>
              <p className="text-[11px] text-red-600/60 dark:text-red-400/50 leading-relaxed">
                Guides, API reference, and everything you need to build with Jose Madrid Salsa.
              </p>
            </div>
          ),
          footer: (
            <div className="px-2 py-3 border-t border-fd-border">
              <a
                href="https://www.josemadrid.net"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-fd-muted-foreground hover:text-fd-primary transition-colors"
              >
                <Image
                  src="/images/logo-image.png"
                  alt=""
                  width={16}
                  height={16}
                  className="rounded opacity-60"
                />
                josemadrid.net
              </a>
            </div>
          ),
        }}
        links={[
          {
            text: 'Main Site',
            url: 'https://www.josemadrid.net',
            external: true,
          },
          {
            text: 'Products',
            url: 'https://www.josemadrid.net/products',
            external: true,
          },
        ]}
        githubUrl="https://github.com/jordolang/josemadridsalsa"
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
