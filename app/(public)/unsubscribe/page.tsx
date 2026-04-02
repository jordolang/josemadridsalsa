import { Suspense } from 'react'
import { UnsubscribeForm } from './UnsubscribeForm'

export const metadata = {
  title: 'Unsubscribe - Jose Madrid Salsa',
  description: 'Manage your email preferences',
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Email Preferences</h1>
            <p className="text-muted-foreground mt-2">
              Manage what emails you receive from Jose Madrid Salsa
            </p>
          </div>
          <Suspense fallback={<div className="text-center py-4">Loading...</div>}>
            <UnsubscribeForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
