'use client'

import { motion, useInView } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import {
  Code2,
  FileCode2,
  Database,
  GitCommit,
  Layers,
  Server,
  TestTube,
  Calendar,
  Clock,
  DollarSign,
  type LucideIcon,
} from 'lucide-react'
import { DeveloperScrollSection } from './developer-scroll-section'

interface StatItem {
  readonly label: string
  readonly value: number
  readonly suffix?: string
  readonly prefix?: string
  readonly icon: LucideIcon
  readonly description: string
  readonly accent: string
  readonly format?: 'number' | 'compact'
}

const codeStats: readonly StatItem[] = [
  {
    label: 'Lines of Code',
    value: 200479,
    icon: Code2,
    description: 'TypeScript & TSX across the entire codebase',
    accent: 'from-salsa-500 to-salsa-700',
    format: 'number',
  },
  {
    label: 'Source Files',
    value: 1165,
    icon: FileCode2,
    description: '618 .ts + 547 .tsx files authored from scratch',
    accent: 'from-chile-500 to-chile-700',
    format: 'number',
  },
  {
    label: 'React Components',
    value: 242,
    icon: Layers,
    description: 'Custom UI components, forms, layouts & primitives',
    accent: 'from-verde-500 to-verde-700',
    format: 'number',
  },
  {
    label: 'API Routes',
    value: 218,
    icon: Server,
    description: 'REST endpoints powering the storefront, admin & mobile',
    accent: 'from-blue-500 to-blue-700',
    format: 'number',
  },
  {
    label: 'Database Models',
    value: 125,
    icon: Database,
    description: 'Prisma schema with 22 production migrations',
    accent: 'from-purple-500 to-purple-700',
    format: 'number',
  },
  {
    label: 'Test Files',
    value: 74,
    icon: TestTube,
    description: '~30,885 lines of automated tests (Vitest + Playwright)',
    accent: 'from-amber-500 to-amber-700',
    format: 'number',
  },
] as const

const projectStats: readonly StatItem[] = [
  {
    label: 'Days of Development',
    value: 200,
    icon: Calendar,
    description: 'October 10, 2025 → April 28, 2026 — ~6.7 months solo',
    accent: 'from-salsa-500 to-chile-600',
    format: 'number',
  },
  {
    label: 'Hours Invested',
    value: 1500,
    suffix: '+',
    icon: Clock,
    description: 'Hands-on design, development, testing & deployment',
    accent: 'from-chile-500 to-salsa-600',
    format: 'number',
  },
  {
    label: 'Major Releases',
    value: 14,
    icon: GitCommit,
    description: 'From v0.1.0 (Foundation) → v1.10.1 (Credential Vault)',
    accent: 'from-verde-500 to-verde-700',
    format: 'number',
  },
] as const

interface CostTier {
  readonly tier: string
  readonly low: number
  readonly high: number
  readonly description: string
  readonly accent: string
}

const costTiers: readonly CostTier[] = [
  {
    tier: 'Senior Contractor',
    low: 225000,
    high: 300000,
    description:
      '1,500 hrs × $150–$200/hr — a single highly experienced full-stack contractor billing solo rates.',
    accent: 'from-verde-500 to-verde-700',
  },
  {
    tier: 'Mid-Tier US Agency',
    low: 400000,
    high: 600000,
    description:
      'Staffed engagement: tech lead, 1–2 full-stack devs, designer, PM & QA at standard agency margins.',
    accent: 'from-chile-500 to-salsa-600',
  },
  {
    tier: 'Premium Agency / Consultancy',
    low: 750000,
    high: 1200000,
    description:
      'Top-tier US firms (Thoughtbot, Slalom, Big Four digital) for a custom Next.js + Prisma + multi-payment + mobile build.',
    accent: 'from-salsa-600 to-purple-700',
  },
] as const

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  }
  return `$${(n / 1000).toFixed(0)}K`
}

function CountUp({ end, duration = 1.6 }: { end: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(end * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, end, duration])

  return <span ref={ref}>{formatNumber(value)}</span>
}

function StatCard({ stat }: { stat: StatItem }) {
  const Icon = stat.icon
  return (
    <motion.div
      className="group relative rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-lg transition-all"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.accent} flex items-center justify-center mb-4 shadow-lg shadow-black/10`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-1 tabular-nums">
        {stat.prefix}
        <CountUp end={stat.value} />
        {stat.suffix}
      </div>
      <div className="text-sm font-semibold text-foreground/90 mb-1">{stat.label}</div>
      <p className="text-xs text-muted-foreground leading-relaxed">{stat.description}</p>
    </motion.div>
  )
}

export function DeveloperStats() {
  return (
    <div className="space-y-16">
      {/* By the Numbers — codebase scale */}
      <div>
        <DeveloperScrollSection>
          <div className="text-center mb-10">
            <h3 className="text-2xl lg:text-3xl font-serif font-bold text-foreground mb-3">
              By the Numbers
            </h3>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Every figure below is measured directly from the repository — not estimated.
            </p>
          </div>
        </DeveloperScrollSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {codeStats.map((stat, i) => (
            <DeveloperScrollSection key={stat.label} delay={i * 0.08} direction="scale">
              <StatCard stat={stat} />
            </DeveloperScrollSection>
          ))}
        </div>
      </div>

      {/* Time invested */}
      <div>
        <DeveloperScrollSection>
          <div className="text-center mb-10">
            <h3 className="text-2xl lg:text-3xl font-serif font-bold text-foreground mb-3">
              Time Invested
            </h3>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Solo design and development across 14 versioned releases — no team, no agency, no charge.
            </p>
          </div>
        </DeveloperScrollSection>

        <div className="grid sm:grid-cols-3 gap-5">
          {projectStats.map((stat, i) => (
            <DeveloperScrollSection key={stat.label} delay={i * 0.1} direction="scale">
              <StatCard stat={stat} />
            </DeveloperScrollSection>
          ))}
        </div>
      </div>

      {/* What this would cost — agency commission breakdown */}
      <div>
        <DeveloperScrollSection>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-chile-500 to-salsa-700 rounded-xl mb-4 shadow-lg shadow-salsa-500/20">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-2xl lg:text-3xl font-serif font-bold text-foreground mb-3">
              What This Would Cost If Commissioned
            </h3>
            <p className="text-base text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              A custom Next.js e-commerce platform with multi-payment integration, fundraising
              subsystem, iOS app, admin panel, lead-gen scraper, email pipeline, and observability
              stack — built by a US professional firm — would typically command the following:
            </p>
          </div>
        </DeveloperScrollSection>

        <div className="grid lg:grid-cols-3 gap-5 mb-8">
          {costTiers.map((tier, i) => (
            <DeveloperScrollSection key={tier.tier} delay={i * 0.12} direction="scale">
              <div className="relative h-full rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-lg transition-all">
                <div
                  className={`absolute top-0 left-6 right-6 h-1 rounded-b-full bg-gradient-to-r ${tier.accent}`}
                />
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {tier.tier}
                </div>
                <div className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-1 tabular-nums">
                  {formatUSD(tier.low)} – {formatUSD(tier.high)}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                  {tier.description}
                </p>
              </div>
            </DeveloperScrollSection>
          ))}
        </div>

        <DeveloperScrollSection>
          <div className="rounded-2xl border border-border bg-gradient-to-br from-salsa-50 via-chile-50 to-verde-50 dark:from-salsa-950/40 dark:via-chile-950/40 dark:to-verde-950/40 p-6 lg:p-8">
            <div className="grid md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-salsa-700 dark:text-salsa-300 mb-2">
                  Real-world fair-market value
                </div>
                <div className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-2">
                  $250,000 – $750,000+
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Based on 1,500+ documented development hours, 200,000+ lines of production
                  TypeScript, 218 API endpoints, 125 database models, a native iOS app, and a
                  full multi-payment commerce + fundraising stack. Industry comparable: a custom
                  Shopify Plus + Headless Next.js build alone runs $150K–$400K before mobile,
                  fundraising, or admin tooling.
                </p>
              </div>
              <div className="md:text-right">
                <div className="inline-flex flex-col items-center md:items-end">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Actually charged
                  </div>
                  <div className="text-5xl lg:text-6xl font-serif font-bold bg-gradient-to-br from-verde-600 to-verde-800 bg-clip-text text-transparent">
                    $0
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 italic">
                    As originally promised
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DeveloperScrollSection>

        <DeveloperScrollSection delay={0.15}>
          <p className="text-xs text-muted-foreground text-center mt-6 max-w-3xl mx-auto leading-relaxed">
            Cost ranges reference 2025–2026 US market rates: senior full-stack contractors
            ($125–$225/hr), mid-tier digital agencies ($150–$250/hr), and premium consultancies
            ($250–$400/hr) per Clutch, Toptal, and BLS occupational data. Hour totals reflect
            documented solo development across 14 versioned releases.
          </p>
        </DeveloperScrollSection>
      </div>
    </div>
  )
}
