'use client'

import { Download } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface ExportButtonProps {
  /** Export route, e.g. `/api/admin/customers/export`. */
  endpoint: string
  label?: string
}

/**
 * Downloads a CSV from an export route, forwarding the current page's filter
 * querystring so the export mirrors what the user is looking at.
 */
export function ExportButton({ endpoint, label = 'Export CSV' }: ExportButtonProps) {
  const searchParams = useSearchParams()
  const qs = searchParams.toString()
  const href = qs ? `${endpoint}?${qs}` : endpoint

  return (
    <Button asChild variant="outline">
      <a href={href} download>
        <Download className="mr-2 size-4" />
        {label}
      </a>
    </Button>
  )
}
