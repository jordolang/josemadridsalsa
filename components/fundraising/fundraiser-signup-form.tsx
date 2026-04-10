'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

type FormState = {
  contactName: string
  organizationName: string
  email: string
  phone: string
  fundraisingGoal: string
  message: string
}

const initialState: FormState = {
  contactName: '',
  organizationName: '',
  email: '',
  phone: '',
  fundraisingGoal: '',
  message: '',
}

export function FundraiserSignupForm() {
  const [formState, setFormState] = useState<FormState>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/fundraiser-signups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Unable to submit signup')
      }

      setIsSubmitted(true)
      setFormState(initialState)
      toast.success('Thanks for reaching out!', {
        description: 'Our fundraising team will contact you shortly.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit signup'
      toast.error('Submission failed', { description: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-black/5">
      {isSubmitted ? (
        <div className="text-center text-lg text-salsa-600">
          <p className="font-semibold mb-2">You&apos;re on the list!</p>
          <p>We&apos;ll reach out within one business day with next steps.</p>
          <Button
            className="mt-6"
            variant="outline"
            onClick={() => setIsSubmitted(false)}
          >
            Submit another inquiry
          </Button>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Contact Name</label>
              <Input
                required
                value={formState.contactName}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, contactName: event.target.value }))
                }
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Organization</label>
              <Input
                required
                value={formState.organizationName}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, organizationName: event.target.value }))
                }
                placeholder="School, team, or group name"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <Input
                type="email"
                required
                value={formState.email}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Phone (optional)</label>
              <Input
                value={formState.phone}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="(555) 555-5555"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Fundraising Goal (optional)</label>
            <Input
              value={formState.fundraisingGoal}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, fundraisingGoal: event.target.value }))
              }
              placeholder="$5,000 for band trip"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Tell us about your fundraiser</label>
            <Textarea
              rows={4}
              value={formState.message}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, message: event.target.value }))
              }
              placeholder="Timeline, number of sellers, delivery preferences..."
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Request a fundraiser kit'
            )}
          </Button>
        </form>
      )}
    </div>
  )
}
