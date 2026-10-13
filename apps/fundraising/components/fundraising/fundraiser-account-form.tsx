'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { KIT_IDS, ORDER_KITS, type KitId } from '@/lib/fundraising/flavor-kits'
import { FULFILLMENT_OPTIONS, ONLINE_LINK_NOTE, RESALE_NUMBER_NOTE } from '@/lib/fundraising/fulfillment'
import { useUploadThing } from '@/lib/uploadthing-client'
import type { FulfillmentMethod } from '@prisma/client'
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
  resaleNumber: string
  missionStatement: string
  bio: string
}

const initialState: FundraiserRegisterState = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  organizationName: '',
  contactPhone: '',
  resaleNumber: '',
  missionStatement: '',
  bio: '',
}

type ColorKey = 'brandColor' | 'secondaryColor' | 'accentColor'

// What an unchosen picker shows. Not white or black: the native input only reports a change,
// so a school picking the color already shown would never register its choice.
const UNCHOSEN = '#808080'

const COLOR_FIELDS: { key: ColorKey; label: string; hint: string }[] = [
  {
    key: 'brandColor',
    label: 'Main color',
    hint: "Your school, team or business's main color. It leads your page: the bar across the top and the frame around your logo.",
  },
  { key: 'secondaryColor', label: 'Secondary color', hint: 'Your second color, for badges and highlights.' },
  { key: 'accentColor', label: 'Accent color', hint: 'A third color for buttons and milestones.' },
]

const PACKAGE_ORDER = [...KIT_IDS].sort((a, b) => Number(a) - Number(b))

/** A radio-card: the whole box is the click target, the ring shows the choice. */
const CHOICE =
  'block cursor-pointer rounded-lg border p-3 text-sm transition-colors has-[:checked]:border-salsa-500 has-[:checked]:bg-salsa-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-salsa-500'

/**
 * Fundraiser account sign-up (creates a PENDING account for review).
 * `siteUrl` is the main storefront's origin, for hosts that are not it — the
 * portal and sign-in pages only exist there.
 */
export function FundraiserAccountForm({ siteUrl = '' }: { siteUrl?: string }) {
  const [formState, setFormState] = useState<FundraiserRegisterState>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // No default package: it decides which salsas the store sells, so the group picks it.
  const [flavorPackage, setFlavorPackage] = useState<KitId | null>(null)
  // Most groups run the classic paper drive, so it starts selected.
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>('ORDER_FORMS_AND_BULK')
  // No default colors either: each group matches its own school, team or business.
  const [colors, setColors] = useState<Record<ColorKey, string | null>>({
    brandColor: null,
    secondaryColor: null,
    accentColor: null,
  })
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null)
  const logoUpload = useUploadThing('fundraiserSignupImage', {
    onClientUploadComplete: (res) => res?.[0] && setLogoUrl(res[0].url),
    onUploadError: (e) => setError(e.message),
  })
  const coverUpload = useUploadThing('fundraiserSignupImage', {
    onClientUploadComplete: (res) => res?.[0] && setCoverPhotoUrl(res[0].url),
    onUploadError: (e) => setError(e.message),
  })
  const collecting = fulfillment === 'ORDER_FORMS_AND_BULK'

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
    if (!flavorPackage) {
      setError('Please choose a 9, 16 or 25 flavor package.')
      return
    }
    if (COLOR_FIELDS.some(({ key }) => !colors[key])) {
      setError('Please choose your main, secondary and accent colors.')
      return
    }
    if (logoUpload.isUploading || coverUpload.isUploading) {
      setError('Please wait for your images to finish uploading.')
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
          flavorPackage,
          fulfillmentMethod: fulfillment,
          resaleNumber: collecting ? formState.resaleNumber || undefined : undefined,
          ...colors,
          logoUrl: logoUrl ?? undefined,
          coverPhotoUrl: coverPhotoUrl ?? undefined,
          missionStatement: formState.missionStatement || undefined,
          bio: formState.bio || undefined,
        }),
      })

      if (!response.ok) {
        // A gateway error page is HTML, not JSON; say something useful either way.
        const errorData = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(errorData.error || 'Unable to create account.')
      }

      // Registering creates the account but no session, and the portal sends
      // anyone signed out to sign-in. Go there directly, and on to the pending
      // page once they have signed in with the password they just chose.
      const callbackUrl = encodeURIComponent('/fundraiser-portal/pending')
      window.location.assign(`${siteUrl}/auth/signin?callbackUrl=${callbackUrl}`)
    } catch (error) {
      console.error('Fundraiser registration error:', error)
      setError(
        error instanceof Error ? error.message : 'Unable to create account. Please try again.'
      )
      setIsSubmitting(false)
    }
  }

  return (
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

          <fieldset className="space-y-3 border-t pt-5">
            <legend className="sr-only">Salsa package</legend>
            <div>
              <p className="font-semibold text-gray-900">Choose your salsa package *</p>
              <p className="text-xs text-gray-600">
                This is the line-up your supporters choose from, on your order forms and your web
                page. Fewer flavors keeps sorting simple; more gives buyers more choice.
              </p>
            </div>
            {PACKAGE_ORDER.map((id) => (
              <label key={id} className={CHOICE}>
                <span className="flex items-center gap-2 font-semibold">
                  <input
                    type="radio"
                    name="flavorPackage"
                    value={id}
                    checked={flavorPackage === id}
                    onChange={() => setFlavorPackage(id)}
                    className="accent-salsa-500"
                  />
                  {id} flavors
                </span>
                <span className="mt-1 block pl-5 text-xs leading-relaxed text-gray-600">
                  {ORDER_KITS[id].flavors.map((flavor) => flavor.name).join(' · ')}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-3 border-t pt-5">
            <legend className="sr-only">Fulfillment</legend>
            <div>
              <p className="font-semibold text-gray-900">How will you run your fundraiser? *</p>
              <p className="text-xs text-gray-600">Most groups do one or the other.</p>
            </div>
            {FULFILLMENT_OPTIONS.map((opt) => (
              <label key={opt.value} className={CHOICE}>
                <span className="flex items-center gap-2 font-semibold">
                  <input
                    type="radio"
                    name="fulfillment"
                    value={opt.value}
                    checked={fulfillment === opt.value}
                    onChange={() => setFulfillment(opt.value)}
                    className="accent-salsa-500"
                  />
                  {opt.value === 'ORDER_FORMS_AND_BULK' ? 'Order forms + bulk delivery' : 'Online only'}
                </span>
                <span className="mt-1 block pl-5 text-xs leading-relaxed text-gray-600">
                  {opt.tagline}. {opt.tradeOff}
                </span>
              </label>
            ))}
            <p className="text-xs text-gray-500">{ONLINE_LINK_NOTE}</p>
            {collecting && (
              <div className="space-y-2">
                <Label htmlFor="resaleNumber">Resale certificate number (optional for now)</Label>
                <Input id="resaleNumber" name="resaleNumber" value={formState.resaleNumber} onChange={handleChange} maxLength={60} />
                <p className="text-xs text-gray-500">{RESALE_NUMBER_NOTE}</p>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-4 border-t pt-5">
            <legend className="sr-only">Branding</legend>
            <div>
              <p className="font-semibold text-gray-900">Brand your page</p>
              <p className="text-xs text-gray-600">
                How your fundraiser page looks to supporters. Your three colors are required; the
                rest is optional. All of it can be changed later.
              </p>
            </div>
            {COLOR_FIELDS.map(({ key, label, hint }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <div className="flex items-center gap-3">
                  <input
                    id={key}
                    type="color"
                    value={colors[key] ?? UNCHOSEN}
                    onChange={(e) => setColors((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="h-9 w-12 cursor-pointer rounded border"
                  />
                  <span className="font-mono text-sm uppercase">{colors[key] ?? 'Not chosen'}</span>
                </div>
                <p className="text-xs text-gray-500">{hint}</p>
              </div>
            ))}
            {([
              ['logo', 'Logo', logoUrl, logoUpload, 'Square works best, up to 4MB.'],
              ['cover', 'Cover photo', coverPhotoUrl, coverUpload, 'A wide photo for the top of your page, up to 4MB.'],
            ] as const).map(([key, label, url, upload, hint]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`${key}-upload`}>{label}</Label>
                {url && (
                  <img src={url} alt={`${label} preview`} className="h-20 w-full rounded border bg-gray-50 object-contain" />
                )}
                <Input
                  id={`${key}-upload`}
                  type="file"
                  accept="image/*"
                  disabled={upload.isUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void upload.startUpload([file])
                  }}
                />
                <p className="text-xs text-gray-500">{upload.isUploading ? 'Uploading…' : hint}</p>
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="missionStatement">Mission statement</Label>
              <Textarea
                id="missionStatement"
                name="missionStatement"
                value={formState.missionStatement}
                onChange={handleChange}
                maxLength={500}
                rows={2}
                placeholder="One or two sentences: what you are raising money for and why."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">About us</Label>
              <Textarea
                id="bio"
                name="bio"
                value={formState.bio}
                onChange={handleChange}
                maxLength={5000}
                rows={5}
                placeholder="Who you are, what your group does, and what this season looks like."
              />
            </div>
          </fieldset>

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
          <Link href={`${siteUrl}/auth/signin`} className="text-salsa-600 hover:text-salsa-700">
            Already have an account? Sign in
          </Link>
        </div>
        <p className="text-center text-xs text-gray-500">
          Your account will be reviewed by our team before activation. You&apos;ll receive
          an email once your account is approved.
        </p>
      </CardFooter>
    </Card>
  )
}
