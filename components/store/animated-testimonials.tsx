'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Star, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReviewsData } from '@/lib/server/google-data'

const googleBusinessUrl =
  process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL ??
  'https://g.page/jose-madrid-salsa/review'

const facebookUrl =
  process.env.NEXT_PUBLIC_FACEBOOK_URL ??
  'https://www.facebook.com/josemadridsalsa'

type Review = ReviewsData['reviews'][number]

type AnimatedTestimonialsProps = {
  /** Pre-fetched reviews data passed from the server component — NO client API call needed */
  reviewsData: ReviewsData
  autoplay?: boolean
}

export function AnimatedTestimonials({ reviewsData, autoplay = true }: AnimatedTestimonialsProps) {
  // Shuffle once on mount (client-side randomization is fine since data is already here)
  const [reviews] = useState<Review[]>(() => {
    const shuffled = [...reviewsData.reviews].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 5)
  })
  const [active, setActive] = useState(0)
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({})

  const { totalRating, totalReviews } = reviewsData

  const handleNext = useCallback(() => {
    setActive((prev) => (prev + 1) % reviews.length)
  }, [reviews.length])

  const handlePrev = () => {
    setActive((prev) => (prev - 1 + reviews.length) % reviews.length)
  }

  useEffect(() => {
    if (!autoplay || reviews.length === 0) return
    const interval = setInterval(handleNext, 5000)
    return () => clearInterval(interval)
  }, [autoplay, handleNext, reviews.length])

  const handleImageError = useCallback((index: number) => {
    setFailedImages((prev) => ({ ...prev, [index]: true }))
  }, [])

  const isActive = (index: number) => index === active

  const randomRotate = () => `${Math.floor(Math.random() * 16) - 8}deg`

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-5 h-5 ${
            i < Math.floor(rating)
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-300 text-gray-300'
          }`}
        />
      ))}
    </div>
  )

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  if (reviews.length === 0) {
    return (
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-serif text-foreground mb-4">
              What Our Customers Say
            </h2>
            <p className="text-xl text-muted-foreground mb-8">No reviews available at this time.</p>
            <Button asChild className="bg-salsa-500 hover:bg-salsa-600">
              <a href={googleBusinessUrl} target="_blank" rel="noopener noreferrer">
                Leave a Review
              </a>
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-20 bg-background relative overflow-hidden">
      <style jsx>{`
        @keyframes animate-grid {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        .animated-grid {
          width: 200%;
          height: 200%;
          background-image: 
            linear-gradient(to right, hsl(var(--muted)) 1px, transparent 1px), 
            linear-gradient(to bottom, hsl(var(--muted)) 1px, transparent 1px);
          background-size: 3rem 3rem;
          animation: animate-grid 40s linear infinite alternate;
        }
      `}</style>
      <div className="animated-grid absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold font-serif text-foreground mb-4">
            What Our Customers Say
          </h2>
          {totalRating > 0 && totalReviews > 0 && (
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-6 h-6 ${
                        i < Math.round(totalRating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'fill-gray-300 text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-2xl font-bold text-foreground">
                  {totalRating.toFixed(1)}
                </span>
              </div>
              <span className="text-lg text-muted-foreground">
                Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center max-w-5xl mx-auto">
          {/* Avatar stack */}
          <div className="flex items-center justify-center order-2 lg:order-1">
            <div className="relative h-80 w-full max-w-xs">
              <AnimatePresence>
                {reviews.map((review, index) => {
                  const showPhoto = Boolean((review as any).profilePhotoUrl) && !failedImages[index]
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9, y: 50, rotate: randomRotate() }}
                      animate={{
                        opacity: isActive(index) ? 1 : 0.5,
                        scale: isActive(index) ? 1 : 0.9,
                        y: isActive(index) ? 0 : 20,
                        zIndex: isActive(index) ? reviews.length : reviews.length - Math.abs(index - active),
                        rotate: isActive(index) ? '0deg' : randomRotate(),
                      }}
                      exit={{ opacity: 0, scale: 0.9, y: -50 }}
                      transition={{ duration: 0.5, ease: 'easeInOut' }}
                      className="absolute inset-0 origin-bottom"
                    >
                      {showPhoto ? (
                        <Image
                          src={(review as any).profilePhotoUrl ?? ''}
                          alt={review.authorName}
                          fill
                          className="rounded-3xl object-cover shadow-2xl"
                          sizes="(min-width: 1024px) 320px, 100vw"
                          onError={() => handleImageError(index)}
                        />
                      ) : null}
                      <div
                        className={`h-full w-full rounded-3xl shadow-2xl bg-gradient-to-br from-salsa-500 to-chile-600 items-center justify-center ${showPhoto ? 'hidden' : 'flex'}`}
                      >
                        <span className="text-white text-6xl font-bold">
                          {getInitials(review.authorName)}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Review text + controls */}
          <div className="flex flex-col justify-center py-4 order-1 lg:order-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="flex flex-col justify-between"
              >
                <div>
                  <div className="mb-4">{renderStars(reviews[active].rating)}</div>
                  <h3 className="text-2xl font-bold text-foreground">
                    {reviews[active].authorName}
                  </h3>
                  {reviews[active].relativePublishTime && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {reviews[active].relativePublishTime}
                    </p>
                  )}
                  <motion.p className="mt-6 text-lg text-foreground/90 leading-relaxed">
                    &ldquo;{reviews[active].text}&rdquo;
                  </motion.p>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex gap-4 pt-12">
              <button
                onClick={handlePrev}
                aria-label="Previous testimonial"
                className="group flex h-12 w-12 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <ArrowLeft className="h-5 w-5 text-secondary-foreground transition-transform duration-300 group-hover:-translate-x-1" />
              </button>
              <button
                onClick={handleNext}
                aria-label="Next testimonial"
                className="group flex h-12 w-12 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <ArrowRight className="h-5 w-5 text-secondary-foreground transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button asChild className="bg-salsa-600 hover:bg-salsa-700 text-lg px-8 py-3">
              <a href={googleBusinessUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Write a Review
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="text-salsa-600 border-salsa-600 hover:bg-salsa-50 dark:hover:bg-salsa-900/20 text-lg px-8 py-3"
            >
              <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Follow on Facebook
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
