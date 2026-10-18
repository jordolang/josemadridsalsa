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
    accent: 'from-chile-600 to-salsa-700',
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
    label: 'Major Releases',
    value: 14,
    icon: GitCommit,
    description: 'From v0.1.0 (Foundation) → v1.10.1 (Credential Vault)',
    accent: 'from-verde-500 to-verde-700',
    format: 'number',
  },
] as const

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
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

      {/* Delivery */}
      <div>
        <DeveloperScrollSection>
          <div className="text-center mb-10">
            <h3 className="text-2xl lg:text-3xl font-serif font-bold text-foreground mb-3">
              Delivery
            </h3>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Designed, built and released in versioned increments.
            </p>
          </div>
        </DeveloperScrollSection>

        <div className="grid sm:grid-cols-2 gap-5">
          {projectStats.map((stat, i) => (
            <DeveloperScrollSection key={stat.label} delay={i * 0.1} direction="scale">
              <StatCard stat={stat} />
            </DeveloperScrollSection>
          ))}
        </div>
      </div>
    </div>
  )
}
