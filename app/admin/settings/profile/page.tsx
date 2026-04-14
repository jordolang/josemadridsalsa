'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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

const roleVariant = (
  role: string,
): 'default' | 'secondary' | 'outline' | 'destructive' => {
  switch (role) {
    case 'ADMIN':
      return 'destructive'
    case 'DEVELOPER':
    case 'STAFF':
      return 'default'
    case 'WHOLESALE':
      return 'secondary'
    default:
      return 'outline'
  }
}

function SaveBanner({ message, isError }: { message: string; isError: boolean }) {
  return (
    <Alert variant={isError ? 'destructive' : 'default'} className="py-2">
      {isError ? (
        <AlertCircle className="h-4 w-4" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
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
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (!profile) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load profile.</AlertDescription>
      </Alert>
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                  {(profile.name || profile.email).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {profile.name || '(no name set)'}
                </p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={roleVariant(profile.role)}>
                    {profile.role}
                  </Badge>
                  {profile.isEmailVerified && (
                    <Badge variant="secondary">Email verified</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-1 text-right text-xs text-muted-foreground">
              <p>Member since {memberSince}</p>
              <p>Last login: {lastLogin}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal info form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSave} className="space-y-5">
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
                  aria-invalid={!!profileErrors.name}
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

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
              <Button type="submit" disabled={profileSaving}>
                {profileSaving ? 'Saving…' : 'Save changes'}
              </Button>
              {profileMsg && <SaveBanner message={profileMsg.text} isError={profileMsg.error} />}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSave} className="space-y-5">
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
                    aria-invalid={!!passwordErrors.currentPassword}
                    className={`pr-10 ${passwordErrors.currentPassword ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground hover:bg-transparent"
                    tabIndex={-1}
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="sr-only">
                      {showCurrent ? 'Hide password' : 'Show password'}
                    </span>
                  </Button>
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
                    aria-invalid={!!passwordErrors.newPassword}
                    className={`pr-10 ${passwordErrors.newPassword ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground hover:bg-transparent"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="sr-only">
                      {showNew ? 'Hide password' : 'Show password'}
                    </span>
                  </Button>
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
                          newPassword.length >= i * 4 ? 'bg-primary' : 'bg-muted'
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
                    aria-invalid={!!passwordErrors.confirmPassword}
                    className={`pr-10 ${passwordErrors.confirmPassword ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground hover:bg-transparent"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="sr-only">
                      {showConfirm ? 'Hide password' : 'Show password'}
                    </span>
                  </Button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="text-xs text-destructive">{passwordErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
              <Button type="submit" disabled={passwordSaving} variant="outline">
                {passwordSaving ? 'Updating…' : 'Update password'}
              </Button>
              {passwordMsg && <SaveBanner message={passwordMsg.text} isError={passwordMsg.error} />}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security info card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Security notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Your password is stored using bcrypt with a 12-round salt — never in plaintext.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              All profile changes are recorded in the audit log.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Role and email changes require an administrator.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
