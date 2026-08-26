'use client'

import { motion } from 'framer-motion'
import {
  Code2,
  Database,
  Palette,
  CreditCard,
  Shield,
  BarChart3,
  Mail,
  Cloud,
  Layers,
  CheckCircle2,
  Boxes,
  type LucideIcon,
} from 'lucide-react'
import { DeveloperScrollSection } from './developer-scroll-section'

type SkillCategory = 'frontend' | 'backend' | 'payments' | 'infrastructure'

interface Skill {
  readonly name: string
  readonly icon: LucideIcon
  readonly category: SkillCategory
  readonly color: string
}

const skills: readonly Skill[] = [
  { name: 'Next.js', icon: Code2, category: 'frontend', color: 'from-foreground to-foreground/70' },
  { name: 'React', icon: Layers, category: 'frontend', color: 'from-sky-500 to-sky-600' },
  { name: 'TypeScript', icon: Code2, category: 'frontend', color: 'from-blue-500 to-blue-700' },
  { name: 'Tailwind CSS', icon: Palette, category: 'frontend', color: 'from-cyan-400 to-cyan-600' },
  { name: 'shadcn/ui', icon: Boxes, category: 'frontend', color: 'from-foreground to-foreground/70' },
  { name: 'Framer Motion', icon: Palette, category: 'frontend', color: 'from-purple-500 to-pink-500' },
  { name: 'Zustand', icon: Layers, category: 'frontend', color: 'from-amber-500 to-amber-700' },
  { name: 'Zod', icon: CheckCircle2, category: 'frontend', color: 'from-blue-400 to-indigo-500' },
  { name: 'PostgreSQL', icon: Database, category: 'backend', color: 'from-blue-600 to-blue-800' },
  { name: 'Prisma', icon: Database, category: 'backend', color: 'from-indigo-500 to-purple-600' },
  { name: 'Resend', icon: Mail, category: 'backend', color: 'from-foreground to-foreground/70' },
  { name: 'Stripe', icon: CreditCard, category: 'payments', color: 'from-indigo-500 to-purple-500' },
  { name: 'PayPal', icon: CreditCard, category: 'payments', color: 'from-blue-500 to-blue-700' },
  { name: 'Square', icon: CreditCard, category: 'payments', color: 'from-foreground to-foreground/70' },
  { name: 'Vercel', icon: Cloud, category: 'infrastructure', color: 'from-foreground to-foreground/70' },
  { name: 'Sentry', icon: Shield, category: 'infrastructure', color: 'from-purple-600 to-pink-600' },
  { name: 'Amplitude', icon: BarChart3, category: 'infrastructure', color: 'from-blue-500 to-indigo-600' },
] as const

const categoryLabels: Record<SkillCategory, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  payments: 'Payments',
  infrastructure: 'Infrastructure',
}

const categoryColors: Record<SkillCategory, string> = {
  frontend: 'bg-salsa-100 text-salsa-700 dark:bg-salsa-950/50 dark:text-salsa-300',
  backend: 'bg-verde-100 text-verde-700 dark:bg-verde-950/50 dark:text-verde-300',
  payments: 'bg-chile-100 text-chile-700 dark:bg-chile-950/50 dark:text-chile-300',
  infrastructure: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
}

export function DeveloperSkills() {
  const categories = Object.keys(categoryLabels) as SkillCategory[]

  return (
    <div>
      {categories.map((category, catIndex) => {
        const categorySkills = skills.filter((s) => s.category === category)
        return (
          <div key={category} className="mb-10 last:mb-0">
            <DeveloperScrollSection delay={catIndex * 0.1}>
              <div className="flex items-center gap-3 mb-5">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${categoryColors[category]}`}
                >
                  {categoryLabels[category]}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </DeveloperScrollSection>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {categorySkills.map((skill, skillIndex) => (
                <DeveloperScrollSection
                  key={skill.name}
                  direction="scale"
                  delay={catIndex * 0.1 + skillIndex * 0.05}
                >
                  <SkillCard skill={skill} />
                </DeveloperScrollSection>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SkillCard({ skill }: { skill: Skill }) {
  const Icon = skill.icon

  return (
    <motion.div
      className="group relative rounded-xl border border-border bg-card p-4 text-center shadow-sm hover:shadow-md transition-all cursor-default"
      whileHover={{ y: -3, scale: 1.03 }}
      transition={{ duration: 0.2 }}
    >
      {/* Hover glow */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-salsa-500/0 to-chile-500/0 group-hover:from-salsa-500/5 group-hover:to-chile-500/5 transition-all pointer-events-none" />

      <div
        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${skill.color} flex items-center justify-center mx-auto mb-2.5 shadow-sm`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-sm font-semibold text-foreground group-hover:text-salsa-600 dark:group-hover:text-salsa-400 transition-colors">
        {skill.name}
      </p>
    </motion.div>
  )
}
