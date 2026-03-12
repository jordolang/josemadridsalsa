'use client'

import { useState } from 'react'
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
import { Loader2 } from 'lucide-react'

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

  const {
    register,
    handleSubmit,
    reset,
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

  const onSubmit = async (data: CredentialFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const url = mode === 'edit' && credential
        ? `/api/admin/credentials/${credential.id}`
        : '/api/admin/credentials'
      const method = mode === 'edit' ? 'PUT' : 'POST'

      // Remove empty optional fields
      const body: Record<string, string> = {
        serviceName: data.serviceName,
        label: data.label,
      }
      if (data.username) body.username = data.username
      if (data.password) body.password = data.password
      if (data.url) body.url = data.url
      if (data.notes) body.notes = data.notes

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
      <DialogContent>
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
                Service Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="serviceName"
                placeholder="e.g. AWS, Stripe, GitHub"
                {...register('serviceName')}
              />
              {errors.serviceName && (
                <p className="text-sm text-red-600">{errors.serviceName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">
                Label <span className="text-red-500">*</span>
              </Label>
              <Input
                id="label"
                placeholder="e.g. Production API Key"
                {...register('label')}
              />
              {errors.label && (
                <p className="text-sm text-red-600">{errors.label.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="e.g. admin@example.com"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {mode === 'create' && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={mode === 'edit' ? 'Leave blank to keep current' : 'Enter password'}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
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
                <p className="text-sm text-red-600">{errors.url.message}</p>
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
                <p className="text-sm text-red-600">{errors.notes.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
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
