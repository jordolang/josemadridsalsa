'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Gift, ArrowRight } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

type GiftBoxOption = {
  id: string
  name: string
  size: number
  price: number
  image: string
  description: string
}

const giftBoxOptions: GiftBoxOption[] = [
  {
    id: 'choose-3',
    name: 'Choose 3 Pack',
    size: 3,
    price: 23.00,
    image: '/images/new-products/3-product-box.jpeg',
    description: 'Perfect gift for trying new flavors',
  },
  {
    id: 'choose-5',
    name: 'Choose 5 Pack',
    size: 5,
    price: 28.00,
    image: '/images/new-products/6-products.jpeg',
    description: 'Great variety for any occasion',
  },
  {
    id: 'choose-6',
    name: 'Choose 6 Pack',
    size: 6,
    price: 32.00,
    image: '/images/new-products/6-products.jpeg',
    description: 'Popular choice for families',
  },
  {
    id: 'choose-12',
    name: 'Choose 12 Pack',
    size: 12,
    price: 60.00,
    image: '/images/new-products/12-products.jpeg',
    description: 'Best value - stock up and save',
  },
]

export function GiftBoxQuickAdd() {
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
          {giftBoxOptions.map((box) => (
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
                <div className="absolute top-3 left-3">
                  <Badge className="bg-salsa-500 text-white">
                    Save ${((box.size * 7) - box.price).toFixed(2)}
                  </Badge>
                </div>
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
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(box.size * 7)}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {box.size} jars
                  </span>
                </div>

                <Link href="/bundles" className="w-full">
                  <Button className="w-full bg-salsa-500 hover:bg-salsa-600">
                    <Gift className="w-4 h-4 mr-2" />
                    Customize Box
                  </Button>
                </Link>
              </div>
            </div>
          ))}
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
