'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function RedeemRewardButton({
  rewardId,
  disabledReason,
}: {
  rewardId: string
  disabledReason: string | null
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function redeem() {
    setPending(true)
    try {
      const res = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        data?: { discountCode?: string | null }
      }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not redeem reward')
        return
      }
      toast.success(`Your code: ${data.data?.discountCode ?? ''}`, {
        description: 'Enter it at checkout.',
      })
      router.refresh()
    } catch {
      // The redemption may have committed before the response was lost, so show the
      // account's current codes before the customer tries again.
      toast.error('Connection lost. Check your codes below before trying again.')
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  if (disabledReason) {
    return <p className="text-xs text-muted-foreground">{disabledReason}</p>
  }
  return (
    <Button size="sm" onClick={redeem} disabled={pending}>
      {pending ? 'Redeeming…' : 'Redeem'}
    </Button>
  )
}
