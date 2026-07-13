'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  gradient: string;
  index: number;
}

export function FeatureCard({
  title,
  description,
  href,
  icon: Icon,
  gradient,
  index,
}: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 * index, ease: 'easeOut' }}
    >
      <Link
        href={href}
        className="group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white/80 dark:bg-stone-900/60 backdrop-blur-sm p-6 h-full transition-all duration-300 hover:border-red-300/80 dark:hover:border-red-700/60 hover:shadow-xl hover:shadow-red-500/10 hover:-translate-y-2"
      >
        {/* Gradient corner accent */}
        <div
          className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-bl ${gradient} opacity-10 group-hover:opacity-20 rounded-full transition-all duration-500 group-hover:scale-150`}
        />

        {/* Animated border glow on hover */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${gradient} opacity-[0.08]`} />
        </div>

        {/* Icon */}
        <div
          className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
        >
          <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
        </div>

        {/* Content */}
        <h3 className="relative text-lg font-bold text-stone-900 dark:text-white mb-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
          {title}
        </h3>
        <p className="relative text-sm text-stone-500 dark:text-stone-400 leading-relaxed flex-1">
          {description}
        </p>

        {/* Arrow indicator */}
        <div className="relative mt-4 flex items-center text-sm font-semibold text-red-600 dark:text-red-400">
          <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform -translate-x-2 group-hover:translate-x-0">
            Explore
          </span>
          <motion.span
            className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            →
          </motion.span>
        </div>
      </Link>
    </motion.div>
  );
}
