'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Rocket,
  Flame,
  Globe,
  Settings,
  Cloud,
  BookOpen,
  ShoppingCart,
  CreditCard,
  Truck,
} from 'lucide-react';
import { AnimatedBackground } from '@/components/animated-background';
import { FeatureCard } from '@/components/feature-card';
import { StatsBar } from '@/components/stats-bar';

const sections = [
  {
    title: 'Getting Started',
    description: 'Set up your development environment, install dependencies, and run the project locally in under five minutes.',
    href: '/docs/getting-started',
    icon: Rocket,
    gradient: 'from-red-500 to-red-600',
  },
  {
    title: 'Features',
    description: 'Deep-dive into checkout flows, payment processing, shipping logic, and the fundraiser battle arena.',
    href: '/docs/features',
    icon: Flame,
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    title: 'API Reference',
    description: 'REST API endpoints, authentication headers, request/response schemas, and rate limiting.',
    href: '/docs/api',
    icon: Globe,
    gradient: 'from-emerald-500 to-green-600',
  },
  {
    title: 'Configuration',
    description: 'Environment variables, database connections, Stripe keys, and third-party service setup.',
    href: '/docs/configuration',
    icon: Settings,
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    title: 'Deployment',
    description: 'Deploy to Vercel, manage preview and production environments, and configure CI/CD.',
    href: '/docs/deployment',
    icon: Cloud,
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    title: 'Guides',
    description: 'Step-by-step walkthroughs for common development tasks and operational workflows.',
    href: '/docs/guides',
    icon: BookOpen,
    gradient: 'from-pink-500 to-rose-600',
  },
];

const highlights = [
  {
    title: 'E-Commerce Platform',
    description: 'Full-featured online store with cart, checkout, and order management.',
    icon: ShoppingCart,
  },
  {
    title: 'Payment Integration',
    description: 'Stripe, PayPal, and Square for flexible payment processing.',
    icon: CreditCard,
  },
  {
    title: 'Shipping & Fulfillment',
    description: 'Calculated shipping rates, label generation, and tracking.',
    icon: Truck,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 overflow-hidden">
      {/* ─── HERO ─── */}
      <section className="relative min-h-[90vh] flex flex-col">
        <AnimatedBackground />

        {/* Nav */}
        <nav className="relative z-20 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo-image.png"
              alt="Jose Madrid Salsa"
              width={44}
              height={44}
              className="rounded-xl shadow-md"
            />
            <span
              className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-amber-500"
              style={{ fontFamily: 'var(--font-volkhov), Volkhov, Georgia, serif' }}
            >
              Jose Madrid Salsa
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="https://www.josemadrid.net"
              className="hidden md:inline text-sm text-stone-500 hover:text-red-600 transition-colors"
            >
              Main Site
            </Link>
            <Link
              href="https://github.com/jordolang/josemadridsalsa"
              className="hidden md:inline text-sm text-stone-500 hover:text-red-600 transition-colors"
            >
              GitHub
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-500 rounded-xl hover:from-red-700 hover:to-red-600 transition-all shadow-lg hover:shadow-xl hover:shadow-red-600/25 hover:-translate-y-0.5 active:translate-y-0"
            >
              <BookOpen className="w-4 h-4" />
              Documentation
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-xs font-bold tracking-widest text-red-700 dark:text-red-400 bg-red-100/80 dark:bg-red-900/30 border border-red-200 dark:border-red-800/40 rounded-full uppercase backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            Developer Documentation
          </div>

          {/* Title */}
          <h1
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-stone-900 dark:text-white mb-6 leading-[1.05]"
            style={{ fontFamily: 'var(--font-volkhov), Volkhov, Georgia, serif' }}
          >
            Build with
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 animate-[gradient-shift_6s_ease_infinite] bg-[length:200%_auto]">
              Jose Madrid Salsa
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-stone-500 dark:text-stone-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Feature guides, API reference, configuration blueprints, and deployment
            workflows for the Jose Madrid Salsa e-commerce platform.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
            <Link
              href="/docs/getting-started"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-red-600 to-red-500 rounded-2xl hover:from-red-700 hover:to-red-600 transition-all shadow-xl hover:shadow-2xl hover:shadow-red-500/30 hover:-translate-y-1 active:translate-y-0"
            >
              <Rocket className="w-5 h-5" />
              Get Started
            </Link>
            <Link
              href="/docs/api"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-bold text-stone-700 dark:text-stone-200 bg-white/80 dark:bg-stone-800/80 backdrop-blur-sm rounded-2xl border border-stone-200 dark:border-stone-700 hover:border-red-300 dark:hover:border-red-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0"
            >
              <Globe className="w-5 h-5" />
              API Reference
            </Link>
          </div>

          {/* Stats */}
          <StatsBar />
        </div>

        {/* Product image strip */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 -mb-24">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-stone-900/20 dark:shadow-black/40 border border-stone-200/50 dark:border-stone-800/50">
            <Image
              src="/images/hero-image-10-jars-vegetables.png"
              alt="Jose Madrid Salsa Products"
              width={1200}
              height={400}
              className="w-full h-auto object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900/40 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
              <div>
                <p className="text-white/90 text-sm font-semibold">Premium Gourmet Salsas</p>
                <p className="text-white/60 text-xs">Handcrafted in Ohio with the finest ingredients</p>
              </div>
              <Link
                href="https://www.josemadrid.net/products"
                className="text-xs text-white/80 hover:text-white border border-white/30 rounded-lg px-3 py-1.5 backdrop-blur-sm hover:bg-white/10 transition-all"
              >
                View Products
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURE CARDS ─── */}
      <section className="relative pt-36 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2
              className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-white mb-4"
              style={{ fontFamily: 'var(--font-volkhov), Volkhov, Georgia, serif' }}
            >
              Explore the Documentation
            </h2>
            <p className="text-stone-500 dark:text-stone-400 max-w-lg mx-auto">
              Everything you need to understand, build upon, and deploy the platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sections.map((section, i) => (
              <FeatureCard key={section.href} {...section} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── HIGHLIGHTS ─── */}
      <section className="relative py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-red-600 to-red-800 dark:from-red-700 dark:to-red-900 p-10 md:p-16">
            {/* Background pattern */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                backgroundSize: '32px 32px',
              }}
            />

            <div className="relative z-10">
              <h2
                className="text-3xl md:text-4xl font-bold text-white mb-3"
                style={{ fontFamily: 'var(--font-volkhov), Volkhov, Georgia, serif' }}
              >
                Platform Capabilities
              </h2>
              <p className="text-red-200 mb-10 max-w-lg">
                The Jose Madrid Salsa platform is a full-featured e-commerce system purpose-built for gourmet food sales.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {highlights.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-6 hover:bg-white/15 transition-colors"
                  >
                    <item.icon className="w-8 h-8 text-amber-300 mb-4" strokeWidth={1.5} />
                    <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-red-100/80 leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo-image.png"
              alt="Jose Madrid Salsa"
              width={28}
              height={28}
              className="rounded-lg opacity-70"
            />
            <div>
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
                Jose Madrid Salsa
              </p>
              <p className="text-xs text-stone-400">Developer Documentation</p>
            </div>
          </div>
          <div className="flex items-center gap-8 text-sm text-stone-500">
            <Link href="https://www.josemadrid.net" className="hover:text-red-600 transition-colors">
              josemadrid.net
            </Link>
            <Link href="https://github.com/jordolang/josemadridsalsa" className="hover:text-red-600 transition-colors">
              GitHub
            </Link>
            <Link href="https://www.josemadrid.net/products" className="hover:text-red-600 transition-colors">
              Products
            </Link>
            <Link href="https://www.josemadrid.net/fundraising" className="hover:text-red-600 transition-colors">
              Fundraising
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
