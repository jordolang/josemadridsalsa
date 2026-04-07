'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Pause, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { launchCampaign, pauseCampaign, deleteCampaign } from '../../actions'
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

  const handleLaunch = () => {
    setError(null)
    startTransition(async () => {
      const result = await launchCampaign(campaignId)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  const handlePause = () => {
    setError(null)
    startTransition(async () => {
      const result = await pauseCampaign(campaignId)
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

  const handleRetry = () => {
    setError(null)
    startTransition(async () => {
      const result = await retryCampaignFailuresAction(campaignId)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {status === 'DRAFT' && (
          <Button onClick={handleLaunch} disabled={isPending}>
            <Send className="mr-2 h-4 w-4" />
            {isPending ? 'Launching...' : 'Launch Campaign'}
          </Button>
        )}

        {status === 'SENDING' && (
          <Button variant="outline" onClick={handlePause} disabled={isPending}>
            <Pause className="mr-2 h-4 w-4" />
            {isPending ? 'Pausing...' : 'Pause'}
          </Button>
        )}

        {failedCount > 0 && (status === 'SENT' || status === 'FAILED') && (
          <Button variant="outline" onClick={handleRetry} disabled={isPending}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {isPending ? 'Retrying...' : `Retry ${failedCount} Failed`}
          </Button>
        )}

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
