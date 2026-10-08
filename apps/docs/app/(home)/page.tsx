import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Cloud,
  Code2,
  Layers,
  LayoutDashboard,
  Plug,
  Rocket,
  Settings,
  ShoppingBag,
  Trophy,
} from 'lucide-react';
import { source } from '@/lib/source';

const serif = { fontFamily: 'var(--font-volkhov), Volkhov, Georgia, serif' };

const sections = [
  {
    title: 'Getting Started',
    description: 'Install the monorepo, connect a database, and run every app locally.',
    slug: 'getting-started',
    icon: Rocket,
  },
  {
    title: 'Features',
    description: 'Every product surface in the platform, and where its code lives.',
    slug: 'features',
    icon: Layers,
  },
  {
    title: 'Guides',
    description: 'Step-by-step walkthroughs for common development and operations tasks.',
    slug: 'guides',
    icon: BookOpen,
  },
  {
    title: 'API Reference',
    description: 'REST endpoints, authentication, and request and response shapes.',
    slug: 'api',
    icon: Code2,
  },
  {
    title: 'Integrations',
    description: 'Every third-party service the platform talks to, and how each is wired.',
    slug: 'integrations',
    icon: Plug,
  },
  {
    title: 'Configuration',
    description: 'Environment variables, credentials, and service setup.',
    slug: 'configuration',
    icon: Settings,
  },
  {
    title: 'Deployment',
    description: 'Hosting on Vercel, environments, releases, and runbooks.',
    slug: 'deployment',
    icon: Cloud,
  },
];

const platform = [
  {
    title: 'Storefront & checkout',
    description: 'Product catalog, customer accounts, cart, and multi-provider payments.',
    icon: ShoppingBag,
  },
  {
    title: 'Fundraising',
    description: 'Campaigns for schools and groups, seller pages, and the battle arena.',
    icon: Trophy,
  },
  {
    title: 'Admin & operations',
    description: 'Orders, inventory, email marketing, POS, and QuickBooks-synced financials.',
    icon: LayoutDashboard,
  },
];

const quickStart = [
  { comment: '# from the repository root' },
  { command: 'npm install --legacy-peer-deps' },
  { command: 'npx prisma migrate dev' },
  { command: 'npm run dev' },
  { comment: '# storefront on http://localhost:3000' },
];

export default function Home() {
  const pages = source.getPages();
  const countPages = (slug: string) => pages.filter((page) => page.slugs[0] === slug).length;

  return (
    <div className="min-h-screen bg-white text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {/* ─── NAV ─── */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/85 backdrop-blur dark:border-stone-800 dark:bg-stone-950/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo-image.png"
              alt="Jose Madrid Salsa"
              width={32}
              height={32}
              className="rounded-md"
            />
            <div className="text-[15px] font-semibold tracking-tight">Jose Madrid Salsa</div>
            <div className="hidden rounded-md border border-stone-200 px-1.5 py-0.5 text-[11px] font-medium text-stone-500 sm:inline dark:border-stone-700 dark:text-stone-400">
              Docs
            </div>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="https://www.josemadridsalsa.com"
              className="hidden text-sm text-stone-600 transition-colors hover:text-stone-900 md:inline dark:text-stone-400 dark:hover:text-white"
            >
              Main site
            </Link>
            <Link
              href="https://github.com/jordolang/josemadridsalsa"
              className="hidden text-sm text-stone-600 transition-colors hover:text-stone-900 md:inline dark:text-stone-400 dark:hover:text-white"
            >
              GitHub
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
            >
              Read the docs
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden border-b border-stone-200/80 dark:border-stone-800">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] dark:opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgb(231 229 228) 1px, transparent 1px), linear-gradient(to bottom, rgb(231 229 228) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:py-28 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <div className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-red-700 dark:text-red-400">
              Platform documentation
            </div>
            <h1
              className="mb-6 text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl lg:text-[3.5rem]"
              style={serif}
            >
              Everything you need to build and run Jose Madrid Salsa.
            </h1>
            <div className="mb-10 max-w-xl text-lg leading-relaxed text-stone-600 dark:text-stone-400">
              Architecture, feature guides, API reference, integrations, and deployment
              runbooks for the storefront, fundraising, and admin apps.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/docs/getting-started"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-800"
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs/api"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-800 transition-colors hover:border-stone-400 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:border-stone-600"
              >
                API reference
              </Link>
            </div>
          </div>

          {/* Quick start */}
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-950 shadow-xl shadow-stone-900/10 dark:border-stone-800">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/15" />
              </div>
              <div className="text-xs text-stone-400">Quick start</div>
            </div>
            <div
              className="overflow-x-auto px-5 py-5 text-[13px] leading-7"
              style={{ fontFamily: 'var(--font-roboto-mono), ui-monospace, monospace' }}
            >
              {quickStart.map((line, i) =>
                line.comment ? (
                  <div key={i} className="text-stone-500">
                    {line.comment}
                  </div>
                ) : (
                  <div key={i} className="flex text-stone-100">
                    <div className="select-none whitespace-pre text-red-400">$ </div>
                    {line.command}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTIONS ─── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="mb-2 text-2xl font-bold tracking-tight md:text-3xl" style={serif}>
                Browse the documentation
              </h2>
              <div className="text-stone-600 dark:text-stone-400">
                {pages.length} pages across {sections.length} sections.
              </div>
            </div>
            <Link
              href="/docs"
              className="inline-flex items-center gap-1 text-sm font-semibold text-red-700 hover:text-red-800 dark:text-red-400"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-2 lg:grid-cols-4 dark:border-stone-800 dark:bg-stone-800">
            {sections.map((section, i) => {
              const count = countPages(section.slug);
              return (
                <Link
                  key={section.slug}
                  href={`/docs/${section.slug}`}
                  className={`group flex flex-col bg-white p-6 ${i === 0 ? 'sm:col-span-2' : ''} transition-colors hover:bg-stone-50 dark:bg-stone-950 dark:hover:bg-stone-900`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-red-700 dark:border-stone-700 dark:bg-stone-900 dark:text-red-400">
                      <section.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    </div>
                    {count > 0 && (
                      <div className="text-xs text-stone-400">
                        {count} {count === 1 ? 'page' : 'pages'}
                      </div>
                    )}
                  </div>
                  <h3 className="mb-1.5 flex items-center gap-1.5 font-semibold">
                    {section.title}
                    <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-stone-400 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </h3>
                  <div className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                    {section.description}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── PLATFORM ─── */}
      <section className="border-t border-stone-200/80 bg-stone-50 py-20 dark:border-stone-800 dark:bg-stone-900/40">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-2 text-2xl font-bold tracking-tight md:text-3xl" style={serif}>
            What the platform covers
          </h2>
          <div className="mb-10 max-w-2xl text-stone-600 dark:text-stone-400">
            One Turborepo monorepo powers the online store, the fundraising program, and the
            back office behind them.
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {platform.map((item) => (
              <div key={item.title} className="border-l-2 border-red-700/80 pl-5">
                <item.icon className="mb-3 h-5 w-5 text-stone-500" strokeWidth={1.75} />
                <h3 className="mb-1.5 font-semibold">{item.title}</h3>
                <div className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                  {item.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-stone-200/80 dark:border-stone-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-8 md:flex-row">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo-image.png"
              alt="Jose Madrid Salsa"
              width={24}
              height={24}
              className="rounded"
            />
            <div className="text-sm text-stone-500">Jose Madrid Salsa · Zanesville, Ohio</div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-stone-500">
            <Link
              href="https://www.josemadridsalsa.com"
              className="inline-flex items-center gap-1 hover:text-stone-900 dark:hover:text-white"
            >
              josemadridsalsa.com
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            <Link
              href="https://fundraising.josemadridsalsa.com"
              className="inline-flex items-center gap-1 hover:text-stone-900 dark:hover:text-white"
            >
              Fundraising
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            <Link
              href="https://github.com/jordolang/josemadridsalsa"
              className="inline-flex items-center gap-1 hover:text-stone-900 dark:hover:text-white"
            >
              GitHub
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
