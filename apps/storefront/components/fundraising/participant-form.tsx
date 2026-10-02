'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import Link from 'next/link'
import type { FundraiserParticipant } from '@prisma/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type FormState = {
  name: string
  email: string
  phone: string
  status: 'ACTIVE' | 'INACTIVE'
}

export function ParticipantForm({
  participant,
  fundraiserId,
}: {
  participant: FundraiserParticipant
  fundraiserId: string
}) {
  const router = useRouter()
  const [formState, setFormState] = useState<FormState>({
    name: participant.name,
    email: participant.email ?? '',
    phone: participant.phone || '',
    status: participant.status,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch(
        `/api/fundraisers/${fundraiserId}/participants/${participant.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formState),
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Unable to update participant')
      }

      toast.success('Participant updated', {
        description: 'Participant details have been successfully updated',
      })

      router.push(`/admin/fundraisers/${fundraiserId}/participants/${participant.id}`)
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update participant'
      toast.error('Failed to update participant', { description: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/fundraisers/${fundraiserId}/participants/${participant.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Participant
            </Link>
          </Button>
        </div>

        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                required
                value={formState.name}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Participant name"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formState.email}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="participant@example.com"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formState.phone}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="(555) 555-5555"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formState.status}
                onValueChange={(value: 'ACTIVE' | 'INACTIVE') =>
                  setFormState((prev) => ({ ...prev, status: value }))
                }
                disabled={isSubmitting}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <h4 className="mb-2 font-medium">Referral Code</h4>
            <p className="mb-1 text-sm text-slate-600">
              This participant's unique referral code:
            </p>
            <code className="inline-block rounded bg-white px-3 py-2 font-mono text-sm">
              {participant.referralCode}
            </code>
            <p className="mt-2 text-xs text-slate-500">
              Note: Referral codes cannot be changed after creation
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(
                  `/admin/fundraisers/${fundraiserId}/participants/${participant.id}`
                )
              }
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
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </Card>
    </form>
  )
}
