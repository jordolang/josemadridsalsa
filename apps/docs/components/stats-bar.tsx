'use client';

import { motion } from 'framer-motion';
import { FileText, Code, Layers, Zap } from 'lucide-react';

const stats = [
  { label: 'Documentation Pages', value: '19+', icon: FileText },
  { label: 'API Endpoints', value: '40+', icon: Code },
  { label: 'Feature Guides', value: '9', icon: Layers },
  { label: 'Integration Docs', value: '5+', icon: Zap },
];

export function StatsBar() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.6 + i * 0.1 }}
          className="relative flex flex-col items-center p-4 rounded-xl bg-white/60 dark:bg-stone-800/40 backdrop-blur-sm border border-stone-200/50 dark:border-stone-700/50"
        >
          <stat.icon className="w-5 h-5 text-red-500 mb-2" strokeWidth={1.5} />
          <span className="text-2xl font-bold text-stone-900 dark:text-white">
            {stat.value}
          </span>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 text-center mt-0.5">
            {stat.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
