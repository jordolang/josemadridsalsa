'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Wand2, RefreshCw } from 'lucide-react'

const credentialSchema = (mode: 'create' | 'edit') =>
  z.object({
    serviceName: z.string().min(1, 'Service name is required'),
    label: z.string().min(1, 'Label is required'),
    username: z.string().optional(),
    password: mode === 'create'
      ? z.string().min(1, 'Password is required')
      : z.string().optional(),
    url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
    notes: z.string().optional(),
  })

type CredentialFormData = z.infer<ReturnType<typeof credentialSchema>>

interface Credential {
  id: string
  serviceName: string
  label: string
  username: string | null
  url: string | null
  notes: string | null
  updatedAt: string
}

interface CredentialFormDialogProps {
  mode: 'create' | 'edit'
  credential?: Credential
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export default function CredentialFormDialog({
  mode,
  credential,
  open,
  onOpenChange,
  onSuccess,
}: CredentialFormDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordSuggestions, setPasswordSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CredentialFormData>({
    resolver: zodResolver(credentialSchema(mode)),
    defaultValues: {
      serviceName: credential?.serviceName || '',
      label: credential?.label || '',
      username: credential?.username || '',
      password: '',
      url: credential?.url || '',
      notes: credential?.notes || '',
    },
  })

  // Reset form when credential changes
  useEffect(() => {
    if (open) {
      reset({
        serviceName: credential?.serviceName || '',
        label: credential?.label || '',
        username: credential?.username || '',
        password: '',
        url: credential?.url || '',
        notes: credential?.notes || '',
      })
      setError(null)
      setShowSuggestions(false)
      setPasswordSuggestions([])
    }
  }, [open, credential, reset])

  const generatePasswords = async () => {
    try {
      const response = await fetch('/api/admin/credentials/generate-password')
      const result = await response.json()
      if (response.ok) {
        setPasswordSuggestions(result.suggestions)
        setShowSuggestions(true)
      }
    } catch {
      // Generate client-side fallback
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      const generate = () => {
        let result = ''
        for (let i = 0; i < 14; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
      }
      setPasswordSuggestions([generate(), generate(), generate()])
      setShowSuggestions(true)
    }
  }

  const selectSuggestion = (pw: string) => {
    setValue('password', pw, { shouldValidate: true })
    setShowSuggestions(false)
  }

  const onSubmit = async (data: CredentialFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const url = mode === 'edit' && credential
        ? `/api/admin/credentials/${credential.id}`
        : '/api/admin/credentials'
      const method = mode === 'edit' ? 'PUT' : 'POST'

      const body: Record<string, string> = {
        serviceName: data.serviceName,
        label: data.label,
      }
      if (data.username) body.username = data.username
      if (data.password) body.password = data.password
      if (data.url) body.url = data.url
      if (data.notes) body.notes = data.notes
      if (mode === 'edit' && credential?.updatedAt) body.updatedAt = credential.updatedAt

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${mode} credential`)
      }

      reset()
      onOpenChange(false)
      router.refresh()
      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Add Credential' : 'Edit Credential'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'Store a new service credential securely.'
                : 'Update the credential details.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">
                Provider / Service Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="serviceName"
                placeholder="e.g. AT&T, Shopify, Public Works"
                {...register('serviceName')}
              />
              {errors.serviceName && (
                <p className="text-sm text-destructive">{errors.serviceName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">
                Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="label"
                placeholder="e.g. Main Account, Admin Login"
                {...register('label')}
              />
              {errors.label && (
                <p className="text-sm text-destructive">{errors.label.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username / Email</Label>
              <Input
                id="username"
                placeholder="e.g. admin@example.com"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">
                  Password {mode === 'create' && <span className="text-destructive">*</span>}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={generatePasswords}
                >
                  <Wand2 className="h-3 w-3" />
                  Generate
                </Button>
              </div>
              <Input
                id="password"
                type="text"
                placeholder={mode === 'edit' ? 'Leave blank to keep current' : 'Enter password'}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
              {showSuggestions && passwordSuggestions.length > 0 && (
                <div className="mt-2 space-y-1 rounded-lg border border-border bg-muted/50 p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      Suggested Passwords (12-15 chars, alphanumeric)
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={generatePasswords}
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span className="sr-only">Regenerate suggestions</span>
                    </Button>
                  </div>
                  {passwordSuggestions.map((pw, i) => (
                    <Button
                      key={i}
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start px-2 py-1.5 font-mono text-sm"
                      onClick={() => selectSuggestion(pw)}
                    >
                      {pw}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                placeholder="https://example.com"
                {...register('url')}
              />
              {errors.url && (
                <p className="text-sm text-destructive">{errors.url.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                rows={3}
                {...register('notes')}
              />
              {errors.notes && (
                <p className="text-sm text-destructive">{errors.notes.message}</p>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : mode === 'create' ? (
                'Create'
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
