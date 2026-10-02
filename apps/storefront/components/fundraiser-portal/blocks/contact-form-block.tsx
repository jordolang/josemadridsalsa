'use client'

import { useState } from 'react'
import type { ContactFormBlock as ContactFormBlockType } from '@/lib/fundraiser-page-config'

type Props = {
  block: ContactFormBlockType
  blockIndex: number
  fundraiserSlug: string
}

type FormData = Record<string, string>

export function ContactFormBlock({ block, blockIndex, fundraiserSlug }: Props) {
  const { title, fields, submitLabel } = block
  const [formData, setFormData] = useState<FormData>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/fundraiser-portal/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, fundraiserSlug, blockIndex }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Failed to send. Please check your connection.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <section className="px-4 py-10">
        <div className="mx-auto max-w-xl rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <p className="text-lg font-semibold text-green-800">
            Message sent! We will be in touch soon.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-xl">
        {title && (
          <h2 className="mb-6 font-serif text-2xl font-bold text-gray-900">{title}</h2>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {fields.includes('name') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Your Name</label>
              <input
                type="text"
                value={formData.name ?? ''}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-salsa-400 focus:outline-none focus:ring-1 focus:ring-salsa-400"
                placeholder="Your Name"
              />
            </div>
          )}
          {fields.includes('email') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email Address</label>
              <input
                type="email"
                value={formData.email ?? ''}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-salsa-400 focus:outline-none focus:ring-1 focus:ring-salsa-400"
                placeholder="Email Address"
              />
            </div>
          )}
          {fields.includes('phone') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                value={formData.phone ?? ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-salsa-400 focus:outline-none focus:ring-1 focus:ring-salsa-400"
                placeholder="Phone Number"
              />
            </div>
          )}
          {fields.includes('organization') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Organization</label>
              <input
                type="text"
                value={formData.organization ?? ''}
                onChange={(e) => handleChange('organization', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-salsa-400 focus:outline-none focus:ring-1 focus:ring-salsa-400"
                placeholder="Organization"
              />
            </div>
          )}
          {fields.includes('message') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
              <textarea
                rows={4}
                value={formData.message ?? ''}
                onChange={(e) => handleChange('message', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-salsa-400 focus:outline-none focus:ring-1 focus:ring-salsa-400"
                placeholder="Message"
              />
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-salsa-500 px-4 py-3 font-semibold text-white transition hover:bg-salsa-600 disabled:opacity-60"
          >
            {isSubmitting ? 'Sending...' : (submitLabel || 'Send Message')}
          </button>
        </form>
      </div>
    </section>
  )
}
