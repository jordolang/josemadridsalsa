'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        setIsSubmitted(true)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch (err) {
      setError('Unable to process request. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-16">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-3xl font-serif text-gray-900">
            {isSubmitted ? 'Check your email' : 'Forgot your password?'}
          </CardTitle>
          <CardDescription>
            {isSubmitted
              ? 'If an account exists with that email, we\'ve sent a password reset link.'
              : 'Enter your email address and we\'ll send you a link to reset your password.'}
          </CardDescription>
        </CardHeader>

        {!isSubmitted ? (
          <>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
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
                  {isLoading ? 'Sending...' : 'Send reset link'}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 text-sm text-gray-600">
              <div className="text-center">
                <Link
                  href="/auth/signin"
                  className="text-salsa-600 hover:text-salsa-700"
                >
                  Back to sign in
                </Link>
              </div>
            </CardFooter>
          </>
        ) : (
          <CardContent className="space-y-6">
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <p className="font-medium">Reset link sent!</p>
              <p className="mt-1">
                Check your inbox and follow the link to reset your password. The link will expire in 1 hour.
              </p>
            </div>
            <div className="text-center">
              <Link
                href="/auth/signin"
                className="text-salsa-600 hover:text-salsa-700"
              >
                Return to sign in
              </Link>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
