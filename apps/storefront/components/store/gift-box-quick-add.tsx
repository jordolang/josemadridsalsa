'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Gift, ArrowRight } from 'lucide-react'
import { bundleSavings, offeredBundles, type PackOverrides } from '@/lib/bundles'
import { formatPrice } from '@/lib/utils'

interface GiftBoxQuickAddProps {
  /**
   * What a single jar sells for, from the catalogue the page has already loaded. The "was"
   * price and savings badge are shown only when this is known, rather than against a figure
   * hardcoded here that the catalogue can drift away from.
   */
  jarPrice?: number | null
  /** Live pack prices and availability from BigCommerce, when the storefront sells through it. */
  packOverrides?: PackOverrides
}

export function GiftBoxQuickAdd({ jarPrice = null, packOverrides = {} }: GiftBoxQuickAddProps) {
  return (
    <section className="bg-gradient-to-br from-salsa-50 to-chile-50 dark:from-salsa-950/20 dark:to-chile-950/20 py-12 border-y border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-salsa-100 dark:bg-salsa-900/40 rounded-full flex items-center justify-center">
              <Gift className="w-6 h-6 text-salsa-600 dark:text-salsa-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-serif text-foreground">
                Gift Box Bundle Deals
              </h2>
              <p className="text-muted-foreground">
                Mix & match your favorite salsas - save when you bundle
              </p>
            </div>
          </div>
          <Link href="/bundles" className="hidden md:flex items-center gap-2 text-salsa-600 hover:text-salsa-700 font-medium">
            Customize Your Box
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {offeredBundles(packOverrides).map((box) => {
            const savings = bundleSavings(box, jarPrice)
            return (
            <div
              key={box.id}
              className="group card bg-card hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                <Image
                  src={box.image}
                  alt={box.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                />
                {savings !== null && (
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-salsa-500 text-white">
                      Save {formatPrice(savings)}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="p-4">
                <h3 className="font-bold text-lg text-foreground mb-1">
                  {box.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {box.description}
                </p>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-salsa-600">
                      {formatPrice(box.price)}
                    </span>
                    {savings !== null && jarPrice !== null && (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatPrice(jarPrice * box.size)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {box.size} jars
                  </span>
                </div>

                {box.available ? (
                  <Link href="/bundles" className="w-full">
                    <Button className="w-full bg-salsa-500 hover:bg-salsa-600">
                      <Gift className="w-4 h-4 mr-2" />
                      Customize Box
                    </Button>
                  </Link>
                ) : (
                  <Button className="w-full" disabled>
                    Out of Stock
                  </Button>
                )}
              </div>
            </div>
            )
          })}
        </div>

        <div className="mt-6 text-center md:hidden">
          <Link href="/bundles" className="inline-flex items-center gap-2 text-salsa-600 hover:text-salsa-700 font-medium">
            View All Bundle Options
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
