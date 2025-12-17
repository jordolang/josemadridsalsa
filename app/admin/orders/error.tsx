'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function OrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Orders] Error:', error)
  }, [error])

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="max-w-md p-6">
        <div className="flex flex-col items-center text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Unable to Load Orders</h2>
          <p className="text-muted-foreground mb-6">
            {error.message || 'An error occurred while loading the orders page.'}
          </p>
          <div className="flex gap-3">
            <Button onClick={reset} variant="default">
              Try Again
            </Button>
            <Button onClick={() => window.location.href = '/admin'} variant="outline">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
