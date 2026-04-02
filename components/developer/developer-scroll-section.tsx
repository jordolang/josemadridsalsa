'use client'

import { ReactNode } from 'react'
import { motion, type Variants } from 'framer-motion'

type AnimationDirection = 'up' | 'left' | 'right' | 'scale'

interface DeveloperScrollSectionProps {
  children: ReactNode
  className?: string
  direction?: AnimationDirection
  delay?: number
}

const directionVariants: Record<AnimationDirection, Variants> = {
  up: {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  },
  left: {
    hidden: { opacity: 0, x: -60 },
    visible: { opacity: 1, x: 0 },
  },
  right: {
    hidden: { opacity: 0, x: 60 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
  },
}

export function DeveloperScrollSection({
  children,
  className = '',
  direction = 'up',
  delay = 0,
}: DeveloperScrollSectionProps) {
  const variants = directionVariants[direction]

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  )
}
