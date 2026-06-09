'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { developerContactSchema, type DeveloperContactInput } from '@/lib/developer/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

export function DeveloperContactForm() {
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DeveloperContactInput>({
    resolver: zodResolver(developerContactSchema),
  })

  const onSubmit = async (data: DeveloperContactInput) => {
    setStatus('submitting')
    setErrorMessage('')

    try {
      const res = await fetch('/api/developer/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.status === 429) {
        setStatus('error')
        setErrorMessage('Too many requests. Please try again in a few minutes.')
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setStatus('error')
        setErrorMessage(body.error || 'Something went wrong. Please try again.')
        return
      }

      setStatus('success')
      reset()
    } catch {
      setStatus('error')
      setErrorMessage('Network error. Please check your connection and try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm p-12 text-center">
        <CheckCircle className="w-16 h-16 text-verde-400 mx-auto mb-4" />
        <h3 className="text-2xl font-serif font-bold text-white mb-2">Message Sent!</h3>
        <p className="text-salsa-100 mb-6">
          Thank you for reaching out. I&apos;ll get back to you as soon as possible.
        </p>
        <Button
          variant="outline"
          className="border-white/30 text-white hover:bg-white/10"
          onClick={() => setStatus('idle')}
        >
          Send Another Message
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm p-8 space-y-5">
        {status === 'error' && (
          <div className="flex items-start gap-3 rounded-lg bg-red-500/20 border border-red-400/30 p-4">
            <AlertCircle className="w-5 h-5 text-red-300 mt-0.5 shrink-0" />
            <p className="text-red-100 text-sm">{errorMessage}</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="contact-name" className="text-white/90 text-sm font-medium">
              Name
            </Label>
            <Input
              id="contact-name"
              placeholder="Your name"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-red-300 text-xs">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email" className="text-white/90 text-sm font-medium">
              Email
            </Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="your@email.com"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-red-300 text-xs">{errors.email.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-subject" className="text-white/90 text-sm font-medium">
            Subject
          </Label>
          <Input
            id="contact-subject"
            placeholder="What's this about?"
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40"
            {...register('subject')}
          />
          {errors.subject && (
            <p className="text-red-300 text-xs">{errors.subject.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-message" className="text-white/90 text-sm font-medium">
            Message
          </Label>
          <Textarea
            id="contact-message"
            rows={5}
            placeholder="Your message..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 resize-none"
            {...register('message')}
          />
          {errors.message && (
            <p className="text-red-300 text-xs">{errors.message.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          type="submit"
          disabled={status === 'submitting'}
          size="lg"
          className="bg-white text-salsa-700 hover:bg-white/90 font-semibold px-8"
        >
          {status === 'submitting' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            'Send Message'
          )}
        </Button>
      </div>
    </form>
  )
}
