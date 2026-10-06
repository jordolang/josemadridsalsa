'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
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
import { SocialLoginButtons, SocialLoginDivider } from '@/components/auth/social-login-buttons'

const signInSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Must be a valid email address').trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type SignInFormData = z.infer<typeof signInSchema>

function SignInFormInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams?.get('callbackUrl') || '/'

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Revealed only after the password has been accepted and the account turns out to have a
  // second factor, so the form never advertises which accounts are protected.
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: SignInFormData) => {
    setError(null)
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        // Only sent once the account has asked for it; harmless otherwise.
        totp: twoFactorCode.trim() || undefined,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        // The password was right but a second factor is needed. Reveal the code field
        // rather than reporting a credential failure, which would be misleading.
        if (result.error.includes('TWO_FACTOR_REQUIRED')) {
          setNeedsTwoFactor(true)
          setError(null)
          setIsLoading(false)
          return
        }

        if (result.error.includes('TWO_FACTOR_INVALID')) {
          setNeedsTwoFactor(true)
          setError('That authentication code was not valid. Try again, or use a recovery code.')
          setIsLoading(false)
          return
        }

        // Provide more specific error messages
        if (result.error === 'CredentialsSignin') {
          setError('Invalid email or password. Please try again.')
        } else {
          setError(`Sign in failed: ${result.error}. Please try again.`)
        }
        setIsLoading(false)
        return
      }

      if (result?.ok) {
        router.push(callbackUrl)
        router.refresh()
      } else {
        setError('Unable to sign in. Please try again.')
        setIsLoading(false)
      }
    } catch (_error) {
      setError('Unable to sign in. Please check your connection and try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-16">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-3xl font-serif text-gray-900">
            Welcome back
          </CardTitle>
          <CardDescription>
            Sign in to manage your orders and explore the latest Jose Madrid Salsa releases.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SocialLoginButtons />
          <SocialLoginDivider />
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                aria-invalid={!!errors.email}
                aria-describedby="email-error"
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-salsa-600 hover:text-salsa-700 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                aria-invalid={!!errors.password}
                aria-describedby="password-error"
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" role="alert" className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {needsTwoFactor && (
              <div className="space-y-2">
                <Label htmlFor="totp">Authentication code</Label>
                <Input
                  id="totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="123456"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-gray-500">
                  Enter the code from your authenticator app, or one of your recovery codes.
                </p>
              </div>
            )}

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
              {isLoading ? 'Signing in…' : needsTwoFactor ? 'Verify and sign in' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 text-sm text-gray-600">
          <div className="text-center">
            <Link href="/auth/signup" className="text-salsa-600 hover:text-salsa-700">
              Need an account? Create one
            </Link>
          </div>
          <p className="text-center text-xs text-gray-500">
            By signing in you agree to our terms of service and privacy policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SignInFormInner />
    </Suspense>
  )
}
