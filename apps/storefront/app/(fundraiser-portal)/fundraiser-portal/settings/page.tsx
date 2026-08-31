'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type SettingsState = {
  subdomain: string
  contactEmail: string
  contactPhone: string
  bio: string
  missionStatement: string
  thankYouHeadline: string
  thankYouMessage: string
  thankYouImageUrl: string
  thankYouCtaLabel: string
  thankYouCtaUrl: string
}

export default function FundraiserSettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({
    subdomain: '',
    contactEmail: '',
    contactPhone: '',
    bio: '',
    missionStatement: '',
    thankYouHeadline: '',
    thankYouMessage: '',
    thankYouImageUrl: '',
    thankYouCtaLabel: '',
    thankYouCtaUrl: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [subdomainError, setSubdomainError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/fundraiser-portal/settings')
        if (res.ok) {
          const data = await res.json()
          setSettings({
            subdomain: data.subdomain || '',
            contactEmail: data.contactEmail || '',
            contactPhone: data.contactPhone || '',
            bio: data.bio || '',
            missionStatement: data.missionStatement || '',
            thankYouHeadline: data.thankYouHeadline || '',
            thankYouMessage: data.thankYouMessage || '',
            thankYouImageUrl: data.thankYouImageUrl || '',
            thankYouCtaLabel: data.thankYouCtaLabel || '',
            thankYouCtaUrl: data.thankYouCtaUrl || '',
          })
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setSettings((prev) => ({ ...prev, [name]: value }))
    if (name === 'subdomain') {
      setSubdomainError(null)
    }
  }

  const handleSubdomainBlur = () => {
    const cleaned = settings.subdomain
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    setSettings((prev) => ({ ...prev, subdomain: cleaned }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)
    setSubdomainError(null)

    try {
      const res = await fetch('/api/fundraiser-portal/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (res.ok) {
        setMessage('Settings saved!')
      } else {
        const err = await res.json()
        if (err.field === 'subdomain') {
          setSubdomainError(err.error)
        } else {
          setMessage(`Error: ${err.error}`)
        }
      }
    } catch {
      setMessage('Error saving. Please try again.')
    } finally {
      setIsSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-6 font-serif text-2xl font-bold text-gray-900">
        Settings
      </h1>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
        {/* Subdomain */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Page URL</h2>
          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdomain</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">josemadrid.net/f/</span>
              <Input
                id="subdomain"
                name="subdomain"
                value={settings.subdomain}
                onChange={handleChange}
                onBlur={handleSubdomainBlur}
                placeholder="your-fundraiser"
                className="max-w-xs"
              />
            </div>
            {subdomainError && (
              <p className="text-sm text-red-600">{subdomainError}</p>
            )}
            <p className="text-xs text-gray-500">
              Only lowercase letters, numbers, and hyphens.
            </p>
          </div>
        </div>

        {/* Contact info */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Contact Information</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                value={settings.contactEmail}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                value={settings.contactPhone}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Profile content */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Profile Content</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="missionStatement">Mission Statement</Label>
              <Textarea
                id="missionStatement"
                name="missionStatement"
                value={settings.missionStatement}
                onChange={handleChange}
                rows={4}
                placeholder="Tell supporters about your cause and what you're raising funds for..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio / About</Label>
              <Textarea
                id="bio"
                name="bio"
                value={settings.bio}
                onChange={handleChange}
                rows={4}
                placeholder="Share more about your organization..."
              />
            </div>
          </div>
        </div>

        {/* Thank-you page */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900">Thank-You Page</h2>
          <p className="mb-4 mt-1 text-sm text-gray-500">
            What supporters see right after they order from your store. Leave anything blank
            and we&apos;ll use standard wording written around your organization&apos;s name.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="thankYouHeadline">Headline</Label>
              <Input
                id="thankYouHeadline"
                name="thankYouHeadline"
                value={settings.thankYouHeadline}
                onChange={handleChange}
                placeholder="Thank you for supporting our team!"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thankYouMessage">Message</Label>
              <Textarea
                id="thankYouMessage"
                name="thankYouMessage"
                value={settings.thankYouMessage}
                onChange={handleChange}
                rows={4}
                placeholder="Tell your supporters what their order makes possible..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thankYouImageUrl">Image URL</Label>
              <Input
                id="thankYouImageUrl"
                name="thankYouImageUrl"
                value={settings.thankYouImageUrl}
                onChange={handleChange}
                placeholder="Defaults to your logo"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="thankYouCtaLabel">Button Label</Label>
                <Input
                  id="thankYouCtaLabel"
                  name="thankYouCtaLabel"
                  value={settings.thankYouCtaLabel}
                  onChange={handleChange}
                  placeholder="Share our campaign"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thankYouCtaUrl">Button Link</Label>
                <Input
                  id="thankYouCtaUrl"
                  name="thankYouCtaUrl"
                  value={settings.thankYouCtaUrl}
                  onChange={handleChange}
                  placeholder="Defaults to your campaign page"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-salsa-500 hover:bg-salsa-600"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
          {message && (
            <span className={`text-sm ${message.startsWith('Error') ? 'text-red-600' : 'text-verde-600'}`}>
              {message}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
