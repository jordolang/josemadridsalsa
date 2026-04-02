'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { timelineEntries, projectStats } from '@/lib/developer/timeline-data'
import { DeveloperTimelineItem } from './developer-timeline-item'

export function DeveloperTimeline() {
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll progress for the vertical connector line
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })
  const lineHeight = useTransform(scrollYProgress, [0, 0.9], ['0%', '100%'])

  return (
    <div ref={containerRef} className="relative">
      {/* Project stats bar */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <StatCard
          value={projectStats.totalCommits.toLocaleString()}
          label="Commits"
        />
        <StatCard
          value={`${Math.round(projectStats.linesOfCode / 1000)}K+`}
          label="Lines of Code"
        />
        <StatCard
          value={projectStats.totalFiles.toLocaleString()}
          label="Files"
        />
        <StatCard
          value={`${projectStats.durationMonths} mo`}
          label="Development"
        />
      </motion.div>

      {/* Desktop: animated center line that draws as you scroll */}
      <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-[8rem] bottom-0 w-0.5">
        <div className="absolute inset-0 bg-border/30" />
        <motion.div
          className="absolute top-0 left-0 right-0 bg-gradient-to-b from-salsa-500 to-chile-500 origin-top"
          style={{ height: lineHeight }}
        />
      </div>

      {/* Timeline entries */}
      <div className="relative space-y-4 lg:space-y-12">
        {timelineEntries.map((entry, index) => (
          <DeveloperTimelineItem
            key={entry.id}
            entry={entry}
            index={index}
            isLast={index === timelineEntries.length - 1}
          />
        ))}
      </div>

      {/* Bottom flourish */}
      <motion.div
        className="text-center mt-16"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-salsa-100 to-chile-100 dark:from-salsa-950/50 dark:to-chile-950/50 px-6 py-3 rounded-full">
          <span className="w-2 h-2 bg-verde-500 rounded-full animate-pulse-slow" />
          <p className="text-sm font-semibold text-salsa-700 dark:text-salsa-300">
            And the journey continues...
          </p>
        </div>
      </motion.div>
    </div>
  )
}

interface StatCardProps {
  value: string
  label: string
}

function StatCard({ value, label }: StatCardProps) {
  return (
    <motion.div
      className="rounded-xl border border-border bg-card p-5 text-center shadow-sm hover:shadow-md transition-shadow"
      whileHover={{ y: -2, scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <p className="text-2xl lg:text-3xl font-bold font-serif bg-gradient-to-r from-salsa-600 to-chile-600 bg-clip-text text-transparent">
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wider">
        {label}
      </p>
    </motion.div>
  )
}
