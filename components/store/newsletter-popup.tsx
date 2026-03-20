'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { X, Mail, Tag, Gift, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const SIGNED_UP_KEY = 'jms_newsletter_signed_up'
const VISIT_COUNT_KEY = 'jms_visit_count'

// Show popup after 12–20 seconds on page
const MIN_DELAY_MS = 12000
const MAX_DELAY_MS = 20000

export function NewsletterPopup() {
  const { data: session, status } = useSession()
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Wait until auth state is resolved
    if (status === 'loading') return
    if (typeof window === 'undefined') return

    // Never show to logged-in users
    if (session) return

    // Never show if already subscribed
    if (localStorage.getItem(SIGNED_UP_KEY)) return

    // Increment visit counter and only show on every other visit (2, 4, 6…)
    const currentCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10)
    const newCount = currentCount + 1
    localStorage.setItem(VISIT_COUNT_KEY, newCount.toString())
    if (newCount % 2 !== 0) return  // odd visit → skip

    // Show after a random delay between min/max
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [session, status])

  function dismiss() {
    setVisible(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          source: 'popup:newsletter',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }

      localStorage.setItem(SIGNED_UP_KEY, '1')
      setSuccess(true)
      setTimeout(() => setVisible(false), 3500)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400" />

        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 sm:p-8">
          {success ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <Mail className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-900">You&apos;re in! 🎉</h3>
              <p className="text-slate-600">
                Welcome to the Jose Madrid Salsa family. Check your inbox — your first surprise is on its way.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                  <Mail className="h-7 w-7 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  The Good Stuff — Free.
                </h2>
                <p className="mt-2 text-slate-500 text-sm leading-relaxed">
                  Join thousands of salsa lovers who get exclusive deals, new flavor alerts,
                  and free goodies delivered straight to their inbox.
                </p>
              </div>

              {/* Perks */}
              <ul className="mb-5 space-y-2 text-sm">
                <li className="flex items-center gap-2 text-slate-700">
                  <Tag className="h-4 w-4 flex-shrink-0 text-red-500" />
                  <span><strong>Exclusive discounts</strong> only for subscribers</span>
                </li>
                <li className="flex items-center gap-2 text-slate-700">
                  <Gift className="h-4 w-4 flex-shrink-0 text-orange-500" />
                  <span><strong>Freebies &amp; giveaways</strong> sent straight to you</span>
                </li>
                <li className="flex items-center gap-2 text-slate-700">
                  <Bell className="h-4 w-4 flex-shrink-0 text-yellow-500" />
                  <span><strong>New flavors &amp; products</strong> before anyone else</span>
                </li>
              </ul>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <Input
                  type="text"
                  placeholder="First name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full"
                  disabled={loading}
                />
                <Input
                  type="email"
                  placeholder="Your email address *"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full"
                  disabled={loading}
                />
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                <Button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5"
                >
                  {loading ? 'Signing you up…' : 'Yes, I Want the Perks! 🌶️'}
                </Button>
              </form>

              {/* Fine print */}
              <p className="mt-3 text-center text-xs text-slate-400">
                No spam, ever. Unsubscribe anytime.{' '}
                <button
                  type="button"
                  onClick={dismiss}
                  className="underline hover:text-slate-600"
                >
                  No thanks
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
