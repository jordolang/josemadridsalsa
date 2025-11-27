'use client'

import { Calendar, MapPin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function EventsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-slate-600">Manage featured events and Google Calendar sync</p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Add Event
        </Button>
      </div>

      {/* Sync Status Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Google Calendar Integration</h2>
            <p className="text-sm text-slate-600 mb-4">
              Sync events from your Google Calendar to display on your website
            </p>
            <Badge className="bg-yellow-100 text-yellow-800">Not Connected</Badge>
          </div>
          <Button disabled>Connect Google Calendar</Button>
        </div>
      </Card>

      {/* Where is Jose Section */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">"Where is Jose?" Events</h2>
            <p className="text-sm text-slate-600">Special events marked for the "Where is Jose?" feature</p>
          </div>
        </div>
        <div className="text-center py-12 text-slate-500">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <p>No "Where is Jose?" events scheduled</p>
        </div>
      </Card>

      {/* Featured Events */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Featured Events</h2>
            <p className="text-sm text-slate-600">Events displayed on your homepage</p>
          </div>
        </div>
        <div className="text-center py-12 text-slate-500">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <p>No featured events</p>
          <Button className="mt-4" disabled>
            <Plus className="mr-2 h-4 w-4" />
            Add Featured Event
          </Button>
        </div>
      </Card>

      {/* Implementation Note */}
      <Card className="p-6 border-blue-200 bg-blue-50">
        <h3 className="font-semibold text-blue-900 mb-2">Events Management - Coming Soon</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>Planned Features:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Google Calendar OAuth integration</li>
            <li>Automatic event sync from calendar</li>
            <li>Manual event creation and editing</li>
            <li>"Where is Jose?" special event tracking</li>
            <li>Homepage event display controls</li>
            <li>Event tagging system</li>
          </ul>
          <p className="mt-4"><strong>Database Schema:</strong> FeaturedEvent model with eventTags relation already exists in database.</p>
        </div>
      </Card>
    </div>
  )
}
