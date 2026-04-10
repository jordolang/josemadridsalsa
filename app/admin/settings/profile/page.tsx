'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, EyeOff, CheckCircle2, AlertCircle, Shield, User, Phone, Lock } from 'lucide-react'

type ProfileData = {
  id: string
  name: string | null
  email: string
  phone: string | null
  role: string
  isEmailVerified: boolean
  createdAt: string
  lastLoginAt: string | null
}

type FieldErrors = {
  name?: string
  phone?: string
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-destructive/10 text-destructive',
  DEVELOPER: 'bg-purple-100 text-purple-700',
  STAFF: 'bg-blue-100 text-blue-700',
  WHOLESALE: 'bg-amber-100 text-amber-700',
  CUSTOMER: 'bg-muted text-foreground',
}

function SaveBanner({ message, isError }: { message: string; isError: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
        isError
          ? 'bg-destructive/10 text-destructive'
          : 'bg-emerald-50 text-emerald-700'
      }`}
    >
      {isError ? (
        <AlertCircle className="h-4 w-4 shrink-0" />
      ) : (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      )}
      {message}
    </div>
  )
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Profile form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ text: string; error: boolean } | null>(null)
  const [profileErrors, setProfileErrors] = useState<FieldErrors>({})

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null)
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({})

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/settings/profile')
        if (res.ok) {
          const data: ProfileData = await res.json()
          setProfile(data)
          setName(data.name || '')
          setPhone(data.phone || '')
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  function flashMsg(
    setter: (v: { text: string; error: boolean } | null) => void,
    text: string,
    error: boolean
  ) {
    setter({ text, error })
    if (!error) {
      setTimeout(() => setter(null), 4000)
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setProfileErrors({})
    setProfileMsg(null)
    setProfileSaving(true)

    const errors: FieldErrors = {}
    if (!name.trim()) errors.name = 'Name is required.'
    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors)
      setProfileSaving(false)
      return
    }

    try {
      const res = await fetch('/api/admin/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      })
      if (res.ok) {
        setProfile((prev) => prev ? { ...prev, name: name.trim(), phone: phone.trim() || null } : prev)
        flashMsg(setProfileMsg, 'Profile updated successfully.', false)
      } else {
        const err = await res.json()
        flashMsg(setProfileMsg, err.error || 'Failed to save.', true)
      }
    } catch {
      flashMsg(setProfileMsg, 'Network error. Please try again.', true)
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault()
    setPasswordErrors({})
    setPasswordMsg(null)

    const errors: FieldErrors = {}
    if (!currentPassword) errors.currentPassword = 'Current password is required.'
    if (!newPassword) errors.newPassword = 'New password is required.'
    else if (newPassword.length < 8) errors.newPassword = 'Password must be at least 8 characters.'
    if (!confirmPassword) errors.confirmPassword = 'Please confirm your new password.'
    else if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match.'

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors)
      return
    }

    setPasswordSaving(true)
    try {
      const res = await fetch('/api/admin/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (res.ok) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        flashMsg(setPasswordMsg, 'Password changed successfully.', false)
      } else {
        const err = await res.json()
        if (err.field === 'currentPassword') {
          setPasswordErrors({ currentPassword: err.error })
        } else {
          flashMsg(setPasswordMsg, err.error || 'Failed to change password.', true)
        }
      }
    } catch {
      flashMsg(setPasswordMsg, 'Network error. Please try again.', true)
    } finally {
      setPasswordSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-input border-t-foreground" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Failed to load profile.</p>
      </div>
    )
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const lastLogin = profile.lastLoginAt
    ? new Date(profile.lastLoginAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never recorded'

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account information and security settings.
        </p>
      </div>

      {/* Account overview card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar circle */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-salsa-400 to-salsa-600 text-2xl font-bold text-white shadow-sm">
              {(profile.name || profile.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {profile.name || '(no name set)'}
              </p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge className={`text-xs ${roleColors[profile.role] || 'bg-muted text-foreground'}`}>
                  {profile.role}
                </Badge>
                {profile.isEmailVerified && (
                  <Badge className="bg-emerald-100 text-xs text-emerald-700">
                    Email verified
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-1 text-right text-xs text-muted-foreground">
            <p>Member since {memberSince}</p>
            <p>Last login: {lastLogin}</p>
          </div>
        </div>
      </div>

      {/* Personal info form */}
      <form onSubmit={handleProfileSave} className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Personal Information</h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setProfileErrors((prev) => ({ ...prev, name: undefined }))
              }}
              placeholder="Your full name"
              className={profileErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {profileErrors.name && (
              <p className="text-xs text-destructive">{profileErrors.name}</p>
            )}
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              value={profile.email}
              readOnly
              disabled
              className="bg-muted/50 text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              Email changes are handled by an administrator.
            </p>
          </div>

          {/* Phone */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="phone" className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              Phone number
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
              className="max-w-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="submit"
            disabled={profileSaving}
            className="bg-salsa-500 hover:bg-salsa-600 text-white"
          >
            {profileSaving ? 'Saving…' : 'Save changes'}
          </Button>
          {profileMsg && <SaveBanner message={profileMsg.text} isError={profileMsg.error} />}
        </div>
      </form>

      {/* Password form */}
      <form onSubmit={handlePasswordSave} className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
        </div>

        <div className="max-w-sm space-y-4">
          {/* Current password */}
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value)
                  setPasswordErrors((prev) => ({ ...prev, currentPassword: undefined }))
                }}
                placeholder="••••••••"
                className={`pr-10 ${passwordErrors.currentPassword ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-muted-foreground"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordErrors.currentPassword && (
              <p className="text-xs text-destructive">{passwordErrors.currentPassword}</p>
            )}
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setPasswordErrors((prev) => ({ ...prev, newPassword: undefined }))
                }}
                placeholder="Min 8 characters"
                className={`pr-10 ${passwordErrors.newPassword ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-muted-foreground"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordErrors.newPassword && (
              <p className="text-xs text-destructive">{passwordErrors.newPassword}</p>
            )}
            {/* Strength hint */}
            {newPassword.length > 0 && (
              <div className="flex gap-1 pt-0.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      newPassword.length >= i * 4
                        ? i <= 1
                          ? 'bg-destructive/80'
                          : i <= 2
                          ? 'bg-amber-400'
                          : i <= 3
                          ? 'bg-yellow-400'
                          : 'bg-emerald-500'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setPasswordErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                }}
                placeholder="••••••••"
                className={`pr-10 ${passwordErrors.confirmPassword ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-muted-foreground"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordErrors.confirmPassword && (
              <p className="text-xs text-destructive">{passwordErrors.confirmPassword}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="submit"
            disabled={passwordSaving}
            variant="outline"
            className="border-input"
          >
            {passwordSaving ? 'Updating…' : 'Update password'}
          </Button>
          {passwordMsg && <SaveBanner message={passwordMsg.text} isError={passwordMsg.error} />}
        </div>
      </form>

      {/* Security info card */}
      <div className="rounded-xl border border-border bg-muted/50 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Security notes</h2>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            Your password is stored using bcrypt with a 12-round salt — never in plaintext.
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            All profile changes are recorded in the audit log.
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            Role and email changes require an administrator.
          </li>
        </ul>
      </div>
    </div>
  )
}
