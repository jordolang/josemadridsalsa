'use client'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function CopyReferralLink({ link }: { link: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy. Select the link and copy it instead.')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 break-all rounded-md border bg-muted/40 px-3 py-2 text-sm">{link}</code>
      <Button type="button" variant="outline" onClick={copy}>
        Copy link
      </Button>
    </div>
  )
}
