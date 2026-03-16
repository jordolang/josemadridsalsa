'use client'

import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

export function CopyButton({
  text,
  label,
  size = 'sm',
}: {
  text: string
  label?: string
  size?: 'sm' | 'default' | 'lg'
}) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Copied!',
        description: label ? `${label} copied to clipboard` : 'Copied to clipboard',
      })
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Please copy manually',
        variant: 'destructive',
      })
    }
  }

  return (
    <Button size={size} variant="outline" onClick={handleCopy} title={`Copy ${label || 'text'}`}>
      <Copy className="h-4 w-4" />
    </Button>
  )
}
