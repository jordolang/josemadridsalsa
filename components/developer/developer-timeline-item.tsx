'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  type Variants,
} from 'framer-motion'
import {
  Rocket,
  ShoppingCart,
  Globe,
  Briefcase,
  Brain,
  Shield,
  Heart,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'
import type { TimelineEntry } from '@/lib/developer/timeline-data'

const iconMap: Record<string, LucideIcon> = {
  Rocket,
  ShoppingCart,
  Globe,
  Briefcase,
  Brain,
  Shield,
  Heart,
  CreditCard,
}

interface DeveloperTimelineItemProps {
  entry: TimelineEntry
  index: number
  isLast: boolean
}

const cardVariants: Variants = {
  hidden: (isEven: boolean) => ({
    opacity: 0,
    x: isEven ? 80 : -80,
    scale: 0.92,
  }),
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 80,
      damping: 20,
      mass: 0.8,
    },
  },
}

const highlightGlowVariants: Variants = {
  hidden: { scale: 1 },
  visible: {
    scale: [1, 1.08, 1],
    transition: {
      scale: {
        duration: 0.8,
        ease: 'easeInOut',
      },
    },
  },
}

function formatDate(dateStr: string): string {
  const [year, month] = dateStr.split('-')
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  return `${monthNames[parseInt(month, 10) - 1]} ${year}`
}

export function DeveloperTimelineItem({
  entry,
  index,
  isLast,
}: DeveloperTimelineItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Cursor-driven parallax
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springX = useSpring(mouseX, { stiffness: 150, damping: 15 })
  const springY = useSpring(mouseY, { stiffness: 150, damping: 15 })
  const rotateX = useTransform(springY, [-0.5, 0.5], [4, -4])
  const rotateY = useTransform(springX, [-0.5, 0.5], [-4, 4])

  const isEven = index % 2 === 0
  const Icon = iconMap[entry.icon] ?? Rocket

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    mouseX.set(x)
    mouseY.set(y)
  }

  function handleMouseLeave() {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <div className="relative flex items-start gap-6 lg:gap-0">
      {/* Desktop: alternating layout */}
      {/* Left side content (even items on desktop) */}
      <div className="hidden lg:flex lg:w-1/2 lg:justify-end lg:pr-12">
        {isEven && (
          <TimelineCard
            entry={entry}
            index={index}
            isEven={isEven}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded((prev) => !prev)}
            Icon={Icon}
            cardRef={cardRef}
            rotateX={rotateX}
            rotateY={rotateY}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        )}
      </div>

      {/* Center timeline line + dot */}
      <div className="hidden lg:flex lg:flex-col lg:items-center lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:top-0 lg:bottom-0">
        <motion.div
          className={`w-12 h-12 rounded-full flex items-center justify-center z-10 shadow-lg ${
            entry.highlight
              ? 'bg-gradient-to-br from-chile-400 to-salsa-500 shadow-salsa-500/40'
              : 'bg-gradient-to-br from-salsa-600 to-salsa-700 shadow-salsa-600/30'
          }`}
          whileInView={{ scale: [0, 1.15, 1] }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Icon className="w-5 h-5 text-white" />
        </motion.div>
        {!isLast && (
          <motion.div
            className="w-0.5 flex-1 bg-gradient-to-b from-salsa-400/60 to-salsa-400/20"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{ originY: 0 }}
          />
        )}
      </div>

      {/* Right side content (odd items on desktop) */}
      <div className="hidden lg:flex lg:w-1/2 lg:pl-12">
        {!isEven && (
          <TimelineCard
            entry={entry}
            index={index}
            isEven={isEven}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded((prev) => !prev)}
            Icon={Icon}
            cardRef={cardRef}
            rotateX={rotateX}
            rotateY={rotateY}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        )}
      </div>

      {/* Mobile layout */}
      <div className="flex lg:hidden gap-4 w-full">
        {/* Mobile timeline dot + line */}
        <div className="flex flex-col items-center shrink-0">
          <motion.div
            className={`w-10 h-10 rounded-full flex items-center justify-center z-10 shadow-lg ${
              entry.highlight
                ? 'bg-gradient-to-br from-chile-400 to-salsa-500 shadow-salsa-500/40'
                : 'bg-gradient-to-br from-salsa-600 to-salsa-700 shadow-salsa-600/30'
            }`}
            whileInView={{ scale: [0, 1.15, 1] }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Icon className="w-4 h-4 text-white" />
          </motion.div>
          {!isLast && (
            <motion.div
              className="w-0.5 flex-1 bg-gradient-to-b from-salsa-400/60 to-salsa-400/20"
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              style={{ originY: 0 }}
            />
          )}
        </div>

        {/* Mobile card */}
        <div className="flex-1 pb-12">
          <TimelineCard
            entry={entry}
            index={index}
            isEven={false}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded((prev) => !prev)}
            Icon={Icon}
            cardRef={cardRef}
            rotateX={rotateX}
            rotateY={rotateY}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        </div>
      </div>
    </div>
  )
}

interface TimelineCardProps {
  entry: TimelineEntry
  index: number
  isEven: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  Icon: LucideIcon
  cardRef: React.RefObject<HTMLDivElement | null>
  rotateX: ReturnType<typeof useTransform>
  rotateY: ReturnType<typeof useTransform>
  onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void
  onMouseLeave: () => void
}

function TimelineCard({
  entry,
  index,
  isEven,
  isExpanded,
  onToggleExpand,
  cardRef,
  rotateX,
  rotateY,
  onMouseMove,
  onMouseLeave,
}: TimelineCardProps) {
  return (
    <motion.div
      ref={cardRef}
      custom={isEven}
      variants={entry.highlight ? highlightGlowVariants : cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 800,
      }}
      className="w-full max-w-md"
    >
      <motion.div
        className={`group relative rounded-2xl border bg-card overflow-hidden cursor-pointer transition-colors ${
          entry.highlight
            ? 'border-salsa-400/40 hover:border-salsa-400/70 shadow-lg shadow-salsa-500/10 hover:shadow-xl hover:shadow-salsa-500/20'
            : 'border-border hover:border-salsa-400/30 shadow-sm hover:shadow-lg hover:shadow-salsa-500/10'
        }`}
        onClick={onToggleExpand}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
      >
        {/* Glow overlay for highlighted items */}
        {entry.highlight && (
          <div className="absolute inset-0 bg-gradient-to-br from-salsa-500/5 via-transparent to-chile-500/5 pointer-events-none" />
        )}

        {/* Image section */}
        {entry.image && (
          <div className="relative h-40 overflow-hidden bg-muted">
            <Image
              src={entry.image}
              alt={entry.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, 400px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
          </div>
        )}

        {/* Card content */}
        <div className="p-6">
          {/* Date badge */}
          <div className="inline-flex items-center gap-1.5 bg-salsa-100 dark:bg-salsa-950/50 text-salsa-700 dark:text-salsa-300 px-3 py-1 rounded-full text-xs font-semibold mb-3">
            {formatDate(entry.date)}
            {entry.highlight && (
              <span className="w-1.5 h-1.5 bg-salsa-500 rounded-full animate-pulse-slow" />
            )}
          </div>

          <h3 className="text-xl font-serif font-bold text-foreground mb-2 group-hover:text-salsa-600 dark:group-hover:text-salsa-400 transition-colors">
            {entry.title}
          </h3>

          <div
            className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
            style={{ maxHeight: isExpanded ? '40rem' : '4.5rem' }}
          >
            <p className="text-muted-foreground text-sm leading-relaxed">
              {entry.description}
            </p>
          </div>

          {entry.description.length > 150 && (
            <button
              type="button"
              className="text-salsa-600 dark:text-salsa-400 text-xs font-semibold mt-2 hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand()
              }}
            >
              {isExpanded ? 'Show less' : 'Read more'}
            </button>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-4">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Phase number indicator */}
        <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-foreground/5 flex items-center justify-center">
          <span className="text-xs font-bold text-muted-foreground">
            {index + 1}
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}
