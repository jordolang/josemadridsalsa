'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const googleBusinessUrl =
  process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL ??
  'https://g.page/jose-madrid-salsa/review'

type Review = {
  authorName: string
  rating: number
  text: string
  relativePublishTime: string | null
}

export function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalRating, setTotalRating] = useState(0)
  const [totalReviews, setTotalReviews] = useState(0)

  useEffect(() => {
    async function fetchReviews() {
      try {
        const response = await fetch('/api/reviews/google')
        if (!response.ok) {
          throw new Error('Failed to fetch reviews')
        }
        const data = await response.json()
        const allReviews = data.reviews || []
        
        // Shuffle reviews client-side for true randomization on each page load
        const shuffled = [...allReviews].sort(() => Math.random() - 0.5)
        
        // Select 9 random reviews
        const selectedReviews = shuffled.slice(0, 9)
        
        setReviews(selectedReviews)
        setTotalRating(data.totalRating || 0)
        setTotalReviews(data.totalReviews || 0)
      } catch (err) {
        console.error('Error loading reviews:', err)
        setError('Unable to load reviews at this time')
      } finally {
        setLoading(false)
      }
    }

    fetchReviews()
  }, [])

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5 && rating % 1 < 1

    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => {
          if (i < fullStars) {
            return (
              <Star
                key={i}
                className="w-5 h-5 fill-yellow-400 text-yellow-400"
              />
            )
          } else if (i === fullStars && hasHalfStar) {
            return (
              <div key={i} className="relative w-5 h-5">
                <Star className="w-5 h-5 fill-gray-300 text-gray-300" />
                <div className="absolute inset-0 overflow-hidden w-1/2">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                </div>
              </div>
            )
          } else {
            return (
              <Star
                key={i}
                className="w-5 h-5 fill-gray-300 text-gray-300"
              />
            )
          }
        })}
        <span className="ml-2 text-sm font-medium text-gray-700">
          {rating.toFixed(1)}
        </span>
      </div>
    )
  }

  if (loading) {
    return (
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-serif text-gray-900 mb-4">
              What Our Customers Say
            </h2>
            <p className="text-xl text-gray-600">Loading reviews...</p>
          </div>
        </div>
      </section>
    )
  }

  if (error || reviews.length === 0) {
    return (
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-serif text-gray-900 mb-4">
              What Our Customers Say
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              {error || 'No reviews available at this time.'}
            </p>
            <Button
              asChild
              className="bg-salsa-500 hover:bg-salsa-600"
            >
              <a
                href={googleBusinessUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Leave a Review
              </a>
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold font-serif text-gray-900 mb-4">
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
                <span className="text-2xl font-bold text-gray-900">
                  {totalRating.toFixed(1)}
                </span>
              </div>
              <span className="text-lg text-gray-600">
                Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          )}
          <Button
            asChild
            className="bg-salsa-500 hover:bg-salsa-600 text-lg px-8 py-3"
          >
            <a
              href={googleBusinessUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Write a Review
            </a>
          </Button>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review, index) => (
            <Card
              key={index}
              className="p-6 hover:shadow-lg transition-shadow duration-300 h-full flex flex-col"
            >
              <div className="space-y-4 flex flex-col flex-1">
                {/* Rating and Name */}
                <div className="border-b border-gray-100 pb-3">
                  {renderStars(review.rating)}
                  <p className="mt-2 font-semibold text-gray-900">
                    {review.authorName}
                  </p>
                  {review.relativePublishTime && (
                    <p className="text-sm text-gray-500 mt-1">
                      {review.relativePublishTime}
                    </p>
                  )}
                </div>

                {/* Review Text */}
                <p className="text-gray-700 leading-relaxed flex-1">
                  {review.text}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* View More Link */}
        <div className="text-center mt-10">
          <Button
            variant="outline"
            asChild
            className="text-salsa-600 border-salsa-600 hover:bg-salsa-50"
          >
            <a
              href={googleBusinessUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View All Reviews on Google
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}

