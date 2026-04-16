'use client'

import { motion, AnimatePresence } from 'framer-motion'

/**
 * Animated shield layers: rotating dashed ring + pulsing aura, with an
 * optional burst flash when the shield first activates.
 */
export function ShieldVisuals({ burst = false }: { burst?: boolean }) {
  return (
    <>
      <AnimatePresence>
        {burst && (
          <motion.div
            key="shield-burst"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 rounded-full bg-cyan-400 blur-md"
          />
        )}
      </AnimatePresence>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        className="pointer-events-none absolute inset-[-12px] rounded-full border-2 border-dashed border-cyan-400/40"
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute inset-[-6px] rounded-full bg-cyan-400 blur-sm"
      />
    </>
  )
}
