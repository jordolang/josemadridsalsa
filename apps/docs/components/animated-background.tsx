'use client';

import { motion } from 'framer-motion';

/** Floating pepper/spice orbs that drift across the hero */
function FloatingOrb({
  size,
  color,
  x,
  y,
  delay,
  duration,
}: {
  size: number;
  color: string;
  x: string;
  y: string;
  delay: number;
  duration: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full blur-3xl pointer-events-none"
      style={{
        width: size,
        height: size,
        background: color,
        left: x,
        top: y,
      }}
      animate={{
        y: [0, -40, 15, -25, 0],
        x: [0, 20, -15, 10, 0],
        scale: [1, 1.15, 0.95, 1.08, 1],
        opacity: [0.3, 0.5, 0.25, 0.45, 0.3],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

/** Animated chile pepper SVG icons that float around */
function FloatingPepper({
  x,
  y,
  rotate,
  delay,
  size,
}: {
  x: string;
  y: string;
  rotate: number;
  delay: number;
  size: number;
}) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, rotate: rotate - 20, scale: 0.5 }}
      animate={{
        opacity: [0, 0.15, 0.1, 0.15, 0],
        rotate: [rotate - 20, rotate + 10, rotate - 5, rotate + 15, rotate - 20],
        y: [0, -30, -10, -25, 0],
        scale: [0.5, 1, 0.9, 1.05, 0.5],
      }}
      transition={{
        duration: 12,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        className="text-red-500/20 dark:text-red-400/15"
      >
        <path
          d="M32 4C24 4 18 12 16 20C14 28 16 40 24 50C28 55 32 58 32 58C32 58 36 55 40 50C48 40 50 28 48 20C46 12 40 4 32 4Z"
          fill="currentColor"
        />
        <path
          d="M30 4C30 4 28 0 32 0C36 0 34 4 34 4"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
      </svg>
    </motion.div>
  );
}

/** Grid pattern overlay */
function GridPattern() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
      style={{
        backgroundImage: `
          linear-gradient(rgba(229, 62, 62, 0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(229, 62, 62, 0.5) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }}
    />
  );
}

/** Animated gradient mesh */
function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%]"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(229, 62, 62, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(245, 158, 11, 0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(34, 197, 94, 0.04) 0%, transparent 50%)
          `,
        }}
        animate={{
          rotate: [0, 3, -2, 1, 0],
          scale: [1, 1.02, 0.99, 1.01, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}

export function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <GradientMesh />
      <GridPattern />

      {/* Floating color orbs */}
      <FloatingOrb size={500} color="rgba(229, 62, 62, 0.08)" x="5%" y="10%" delay={0} duration={15} />
      <FloatingOrb size={400} color="rgba(245, 158, 11, 0.06)" x="70%" y="5%" delay={2} duration={18} />
      <FloatingOrb size={350} color="rgba(34, 197, 94, 0.04)" x="40%" y="60%" delay={4} duration={13} />
      <FloatingOrb size={300} color="rgba(229, 62, 62, 0.05)" x="85%" y="50%" delay={1} duration={16} />
      <FloatingOrb size={250} color="rgba(245, 158, 11, 0.04)" x="15%" y="70%" delay={3} duration={14} />

      {/* Floating pepper icons */}
      <FloatingPepper x="8%" y="15%" rotate={-15} delay={0} size={48} />
      <FloatingPepper x="85%" y="25%" rotate={30} delay={3} size={36} />
      <FloatingPepper x="75%" y="65%" rotate={-25} delay={6} size={44} />
      <FloatingPepper x="20%" y="75%" rotate={20} delay={2} size={32} />
      <FloatingPepper x="50%" y="10%" rotate={-10} delay={5} size={40} />
      <FloatingPepper x="92%" y="80%" rotate={45} delay={1} size={28} />
      <FloatingPepper x="35%" y="85%" rotate={-35} delay={4} size={36} />
    </div>
  );
}

/** Smaller animated bg for the docs sidebar area */
export function DocsBackground() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 80%, rgba(229, 62, 62, 0.3) 0%, transparent 40%),
            radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.2) 0%, transparent 40%)
          `,
        }}
      />
    </div>
  );
}
