'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Pause, Play, Square, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  launchCampaign,
  resumeCampaign,
  pauseCampaign,
  cancelCampaign,
  deleteCampaign,
} from '../../actions'
import { retryCampaignFailuresAction } from '../actions'

interface CampaignActionsProps {
  campaignId: string
  status: string
  failedCount: number
}

export function CampaignActions({ campaignId, status, failedCount }: CampaignActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const handleAction = (action: () => Promise<{ error?: string; success?: boolean }>) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await deleteCampaign(campaignId)
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/admin/email-campaigns')
      }
    })
  }

  const handleCancel = () => {
    if (!confirmCancel) {
      setConfirmCancel(true)
      return
    }
    handleAction(() => cancelCampaign(campaignId))
    setConfirmCancel(false)
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {/* Start: Launch a DRAFT campaign */}
        {status === 'DRAFT' && (
          <Button onClick={() => handleAction(() => launchCampaign(campaignId))} disabled={isPending}>
            <Send className="mr-2 h-4 w-4" />
            {isPending ? 'Launching...' : 'Launch Campaign'}
          </Button>
        )}

        {/* Resume: Continue a PAUSED campaign */}
        {status === 'PAUSED' && (
          <Button onClick={() => handleAction(() => resumeCampaign(campaignId))} disabled={isPending}>
            <Play className="mr-2 h-4 w-4" />
            {isPending ? 'Resuming...' : 'Resume'}
          </Button>
        )}

        {/* Pause: Temporarily stop a SENDING campaign */}
        {status === 'SENDING' && (
          <Button variant="outline" onClick={() => handleAction(() => pauseCampaign(campaignId))} disabled={isPending}>
            <Pause className="mr-2 h-4 w-4" />
            {isPending ? 'Pausing...' : 'Pause'}
          </Button>
        )}

        {/* Stop/Cancel: Hard stop for SENDING, PAUSED, or SCHEDULED */}
        {(status === 'SENDING' || status === 'PAUSED' || status === 'SCHEDULED') && (
          <Button
            variant={confirmCancel ? 'destructive' : 'outline'}
            onClick={handleCancel}
            disabled={isPending}
            onBlur={() => setConfirmCancel(false)}
          >
            <Square className="mr-2 h-4 w-4" />
            {confirmCancel ? 'Confirm Stop' : 'Stop Campaign'}
          </Button>
        )}

        {/* Retry: Re-send failed recipients */}
        {failedCount > 0 && (status === 'SENT' || status === 'FAILED' || status === 'PAUSED') && (
          <Button
            variant="outline"
            onClick={() => handleAction(() => retryCampaignFailuresAction(campaignId))}
            disabled={isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {isPending ? 'Retrying...' : `Retry ${failedCount} Failed`}
          </Button>
        )}

        {/* Delete: Only for terminal or draft states */}
        {(status === 'DRAFT' || status === 'SENT' || status === 'FAILED' || status === 'CANCELLED') && (
          <Button
            variant={confirmDelete ? 'destructive' : 'outline'}
            onClick={handleDelete}
            disabled={isPending}
            onBlur={() => setConfirmDelete(false)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {confirmDelete ? 'Confirm Delete' : 'Delete'}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
