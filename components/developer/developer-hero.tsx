'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink, Code2, Heart } from 'lucide-react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef, useState } from 'react'

export function DeveloperHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const [imageError, setImageError] = useState(false)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0px', '-60px'])

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      {/* Animated gradient background with parallax */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-salsa-700 via-salsa-800 to-chile-700"
        style={{ y: backgroundY }}
      />

      {/* Radial light overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(245,158,11,0.1),transparent_60%)]" />

      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEuNSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg==')]" />

      <div className="relative container mx-auto px-4 py-20 lg:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Text content */}
            <div className="text-center lg:text-left order-2 lg:order-1">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
                  <Code2 className="w-4 h-4 text-chile-300" />
                  <span className="text-chile-200 text-sm font-medium">Full-Stack Developer</span>
                </div>
              </motion.div>

              <motion.h1
                className="text-4xl lg:text-6xl font-serif font-bold text-white mb-6 leading-tight"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
              >
                Jordan Lang
              </motion.h1>

              <motion.p
                className="text-lg lg:text-xl text-salsa-100 mb-6 leading-relaxed max-w-lg mx-auto lg:mx-0"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
              >
                Builder of this project from start to finish. Jose Madrid Salsa&apos;s entire
                digital platform — designed, developed, and delivered completely free, as originally
                promised.
              </motion.p>

              {/* Faith statement */}
              <motion.div
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 mb-8 max-w-lg mx-auto lg:mx-0"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
              >
                <div className="flex items-start gap-3">
                  <Heart className="w-5 h-5 text-chile-300 mt-0.5 shrink-0" />
                  <p className="text-salsa-100 font-serif italic leading-relaxed">
                    &ldquo;Soli Deo Gloria&rdquo; — To God alone be the glory. All work on this site
                    is done to honor Jesus Christ of Nazareth. Every line of code, every feature,
                    every late night — all for His glory.
                  </p>
                </div>
              </motion.div>

              {/* CTA buttons */}
              <motion.div
                className="flex flex-wrap gap-4 justify-center lg:justify-start"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.45, ease: 'easeOut' }}
              >
                <Link
                  href="https://jlang.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white text-salsa-800 font-semibold px-6 py-3 rounded-lg hover:bg-salsa-50 transition-colors shadow-lg shadow-black/20"
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit jlang.dev
                </Link>
                <Link
                  href="#timeline"
                  className="inline-flex items-center gap-2 border border-white/30 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition-colors backdrop-blur-sm"
                >
                  View Project Timeline
                </Link>
              </motion.div>
            </div>

            {/* Profile image */}
            <motion.div
              className="flex justify-center order-1 lg:order-2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2, type: 'spring', stiffness: 100 }}
            >
              <div className="relative">
                {/* Glow ring behind image */}
                <div className="absolute -inset-4 bg-gradient-to-br from-chile-400/30 via-salsa-500/20 to-salsa-700/30 rounded-full blur-2xl" />

                <div className="relative w-64 h-64 lg:w-80 lg:h-80 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl shadow-black/30">
                  {imageError ? (
                    <div className="absolute inset-0 bg-gradient-to-br from-salsa-600 to-chile-600 flex items-center justify-center">
                      <Code2 className="w-20 h-20 text-white/60" />
                    </div>
                  ) : (
                    <Image
                      src="/images/developer/jordan-profile.webp"
                      alt="Jordan Lang — Developer of Jose Madrid Salsa"
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 256px, 320px"
                      priority
                      onError={() => setImageError(true)}
                    />
                  )}
                </div>

                {/* Decorative floating elements */}
                <motion.div
                  className="absolute -top-2 -right-2 w-8 h-8 bg-chile-400 rounded-full shadow-lg shadow-chile-400/50"
                  animate={{ y: [-4, 4, -4] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute -bottom-1 -left-3 w-6 h-6 bg-verde-400 rounded-full shadow-lg shadow-verde-400/50"
                  animate={{ y: [3, -3, 3] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom wave divider */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto"
          preserveAspectRatio="none"
        >
          <path
            d="M0 40C240 80 480 0 720 40C960 80 1200 0 1440 40V80H0V40Z"
            className="fill-background"
          />
        </svg>
      </div>
    </section>
  )
}
