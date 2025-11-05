'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function SuccessContent() {
  const searchParams = useSearchParams()
  const [code, setCode] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  useEffect(() => {
    setCode(searchParams.get('code'))
    setOrderId(searchParams.get('order'))
  }, [searchParams])

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-center text-green-600">
            Gift Certificate Purchase Successful!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <div className="text-6xl">🎁</div>
            <p className="text-lg text-gray-700">
              Thank you for your purchase! Your gift certificate has been created and the recipient will receive it via email.
            </p>
          </div>

          {code && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-medium text-gray-700 mb-1">Gift Certificate Code:</div>
              <div className="text-xl font-mono font-semibold text-gray-900">{code}</div>
            </div>
          )}

          {orderId && (
            <div className="text-sm text-gray-600">
              Order Number: <span className="font-mono">{orderId}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button asChild className="bg-salsa-500 hover:bg-salsa-600">
              <Link href="/gift-certificates/balance">Check Balance</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Continue Shopping</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function GiftCertificateSuccessPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center text-green-600">
              Gift Certificate Purchase Successful!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <div className="text-6xl">🎁</div>
              <p className="text-lg text-gray-700">
                Loading your gift certificate details...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}

