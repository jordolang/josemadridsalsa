'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
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

type RegisterState = {
  name: string
  email: string
  password: string
  confirmPassword: string
}

const initialState: RegisterState = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export default function SignUpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams?.get('callbackUrl') || '/'

  const [formState, setFormState] = useState<RegisterState>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (formState.password !== formState.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          email: formState.email,
          password: formState.password,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Unable to create account.')
      }

      const signInResult = await signIn('credentials', {
        email: formState.email,
        password: formState.password,
        redirect: false,
        callbackUrl,
      })

      if (signInResult?.error) {
        setError('Account created, but automatic sign in failed. Please sign in manually.')
        setIsSubmitting(false)
        return
      }

      router.push(callbackUrl)
      router.refresh()
    } catch (error) {
      console.error('Registration error:', error)
      setError(
        error instanceof Error ? error.message : 'Unable to create account. Please try again.'
      )
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-16">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-3xl font-serif text-gray-900">
            Join Jose Madrid Salsa
          </CardTitle>
          <CardDescription>
            Create an account to save your details and keep track of your orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                value={formState.name}
                onChange={handleChange}
                placeholder="Jane Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formState.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formState.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formState.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                required
                minLength={8}
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
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 text-sm text-gray-600">
          <div className="text-center">
            <Link href="/auth/signin" className="text-salsa-600 hover:text-salsa-700">
              Already have an account? Sign in
            </Link>
          </div>
          <p className="text-center text-xs text-gray-500">
            Passwords must be at least 8 characters. By creating an account you agree to our terms of
            service and privacy policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
