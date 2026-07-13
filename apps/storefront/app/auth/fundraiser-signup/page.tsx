'use client'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
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

type FundraiserRegisterState = {
  name: string
  email: string
  password: string
  confirmPassword: string
  organizationName: string
  contactPhone: string
}

const initialState: FundraiserRegisterState = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  organizationName: '',
  contactPhone: '',
}

function FundraiserSignUpFormInner() {
  const router = useRouter()

  const [formState, setFormState] = useState<FundraiserRegisterState>(initialState)
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
      const response = await fetch('/api/auth/fundraiser-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          email: formState.email,
          password: formState.password,
          organizationName: formState.organizationName,
          contactPhone: formState.contactPhone || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Unable to create account.')
      }

      router.push('/fundraiser-portal/pending')
    } catch (error) {
      console.error('Fundraiser registration error:', error)
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
          <CardTitle className="font-serif text-3xl text-gray-900">
            Start a Fundraiser
          </CardTitle>
          <CardDescription>
            Create a fundraiser account to set up your organization&apos;s custom sales page
            and start earning commission on every order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                name="name"
                value={formState.name}
                onChange={handleChange}
                placeholder="Jane Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization Name</Label>
              <Input
                id="organizationName"
                name="organizationName"
                value={formState.organizationName}
                onChange={handleChange}
                placeholder="West Muskingum Boys Soccer"
                required
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
              <Label htmlFor="contactPhone">Phone (optional)</Label>
              <Input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                value={formState.contactPhone}
                onChange={handleChange}
                placeholder="(555) 123-4567"
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
              <Label htmlFor="confirmPassword">Confirm Password</Label>
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
              {isSubmitting ? 'Creating account...' : 'Create Fundraiser Account'}
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
            Your account will be reviewed by our team before activation. You&apos;ll receive
            an email once your account is approved.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function FundraiserSignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <FundraiserSignUpFormInner />
    </Suspense>
  )
}
