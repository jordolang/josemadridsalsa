'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const EMAIL_CATEGORIES = [
  { id: 'marketing', label: 'Marketing emails', description: 'Product launches, promotions, and special offers' },
  { id: 'newsletter', label: 'Newsletter', description: 'Weekly updates and new recipes' },
  { id: 'promotions', label: 'Promotional offers', description: 'Exclusive deals and discounts' },
  { id: 'announcements', label: 'Announcements', description: 'Company news and important updates' },
]

function UnsubscribeFormInner() {
  const searchParams = useSearchParams()
  const emailParam = searchParams?.get('email') || ''

  const [email, setEmail] = useState(emailParam)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [unsubscribeAll, setUnsubscribeAll] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPreferences = async () => {
    try {
      const response = await fetch(`/api/unsubscribe?email=${encodeURIComponent(email)}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedCategories(data.unsubscribedFrom || [])
        setUnsubscribeAll(data.unsubscribeAll || false)
      }
    } catch (err) {
      // Silently fail - user can still select preferences
    }
  }

  // Fetch current preferences
  useEffect(() => {
    if (email) {
      fetchPreferences()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    )
    // If toggling individual categories, uncheck "unsubscribe all"
    if (unsubscribeAll) {
      setUnsubscribeAll(false)
    }
  }

  const handleUnsubscribeAllToggle = () => {
    const newValue = !unsubscribeAll
    setUnsubscribeAll(newValue)
    if (newValue) {
      // If unsubscribing from all, select all categories
      setSelectedCategories(EMAIL_CATEGORIES.map(c => c.id))
    } else {
      // If re-subscribing, clear all categories
      setSelectedCategories([])
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          categories: selectedCategories,
          unsubscribeAll,
        }),
      })

      if (response.ok) {
        setSuccess(true)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update preferences. Please try again.')
      }
    } catch (err) {
      setError('Unable to update preferences. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-16">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl font-serif text-gray-900">
              Preferences Updated
            </CardTitle>
            <CardDescription className="mt-2">
              Your email preferences have been successfully updated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-gray-600">
              You can update your preferences at any time by returning to this page.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-16">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif text-gray-900">
            Email Preferences
          </CardTitle>
          <CardDescription>
            Manage your email subscription preferences for Jose Madrid Salsa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-4">
              <Label className="text-base">What would you like to unsubscribe from?</Label>

              <div className="space-y-3">
                {EMAIL_CATEGORIES.map((category) => (
                  <div key={category.id} className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id={category.id}
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => handleCategoryToggle(category.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-salsa-600 focus:ring-salsa-500"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={category.id}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {category.label}
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        {category.description}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="border-t pt-3 mt-4">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="unsubscribe-all"
                      checked={unsubscribeAll}
                      onChange={handleUnsubscribeAllToggle}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-salsa-600 focus:ring-salsa-500"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="unsubscribe-all"
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        Unsubscribe from all emails
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        You will no longer receive any emails from us (except transactional emails like order confirmations)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-salsa-500 hover:bg-salsa-600"
              disabled={isLoading}
            >
              {isLoading ? 'Updating...' : 'Update Preferences'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500">
            We're sorry to see you go. You can update your preferences at any time.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <UnsubscribeFormInner />
    </Suspense>
  )
}
