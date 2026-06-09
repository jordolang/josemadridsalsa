'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Copy, Mail, Phone, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import type { FundraiserParticipant } from '@prisma/client'

type ParticipantWithStats = FundraiserParticipant

export function ParticipantList({
  participants,
  fundraiserId,
  canWrite,
  baseUrl,
}: {
  participants: ParticipantWithStats[]
  fundraiserId: string
  canWrite: boolean
  baseUrl: string
}) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function copyReferralLink(code: string) {
    const link = `${baseUrl}/${code}`
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copied!', { description: 'Referral link copied to clipboard' })
    } catch (error) {
      toast.error('Failed to copy', { description: 'Please copy the link manually' })
    }
  }

  async function deleteParticipant(participantId: string, participantName: string) {
    if (!confirm(`Are you sure you want to remove ${participantName} from this campaign?`)) {
      return
    }

    setDeletingId(participantId)
    try {
      const response = await fetch(
        `/api/fundraisers/${fundraiserId}/participants/${participantId}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Failed to delete participant')
      }

      toast.success('Participant removed', {
        description: `${participantName} has been removed from the campaign`,
      })
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete participant'
      toast.error('Error', { description: message })
    } finally {
      setDeletingId(null)
    }
  }

  if (participants.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-slate-500">No participants yet. Add your first participant to get started.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Participant</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Referral Code</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Commission</TableHead>
            <TableHead>Status</TableHead>
            {canWrite && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {participants.map((participant) => (
            <TableRow key={participant.id}>
              <TableCell>
                <Link
                  href={`/admin/fundraisers/${fundraiserId}/participants/${participant.id}`}
                  className="font-medium hover:underline"
                >
                  {participant.name}
                </Link>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center gap-1 text-slate-600">
                    <Mail className="h-3 w-3" />
                    <span>{participant.email}</span>
                  </div>
                  {participant.phone && (
                    <div className="flex items-center gap-1 text-slate-600">
                      <Phone className="h-3 w-3" />
                      <span>{participant.phone}</span>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-slate-100 px-2 py-1 text-sm font-mono">
                    {participant.referralCode}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyReferralLink(participant.referralCode)}
                    title="Copy referral link"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                    title="Open referral link"
                  >
                    <a
                      href={`${baseUrl}/${participant.referralCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </TableCell>
              <TableCell className="text-right font-medium">
                {participant.totalOrders}
              </TableCell>
              <TableCell className="text-right font-medium">
                ${Number(participant.totalRevenue).toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-medium">
                ${Number(participant.totalCommission).toFixed(2)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={participant.status === 'ACTIVE' ? 'default' : 'secondary'}
                >
                  {participant.status}
                </Badge>
              </TableCell>
              {canWrite && (
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteParticipant(participant.id, participant.name)}
                    disabled={deletingId === participant.id}
                    title="Remove participant"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
