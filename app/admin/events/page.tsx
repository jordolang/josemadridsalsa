'use client'

import { useEffect, useState } from 'react'
import { Calendar, MapPin, Plus, RefreshCw, Edit, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface FeaturedEvent {
  id: string
  title: string
  description?: string
  location?: string
  startDate: string
  endDate?: string
  featuredFrom: string
  featuredTo?: string
  isWhereIsJose: boolean
  googleEventId?: string
  manuallyModified: boolean
  displayPriority: number
}

export default function EventsPage() {
  const [events, setEvents] = useState<FeaturedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    try {
      const response = await fetch('/api/admin/events')
      if (response.ok) {
        const data = await response.json()
        setEvents(data)
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const response = await fetch('/api/admin/events/calendar-sync', {
        method: 'POST',
      })
      if (response.ok) {
        await fetchEvents()
      }
    } catch (error) {
      console.error('Failed to sync calendar:', error)
    } finally {
      setSyncing(false)
    }
  }

  const whereIsJoseEvents = events.filter(e => e.isWhereIsJose)
  const featuredEvents = events.filter(e => !e.isWhereIsJose)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-slate-600">Manage featured events and Google Calendar sync</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSync} disabled={syncing || !isConnected} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Calendar
          </Button>
          <Link href="/admin/events/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </Link>
        </div>
      </div>

      {/* Sync Status Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Google Calendar Integration</h2>
            <p className="text-sm text-slate-600 mb-4">
              Sync events from your Google Calendar to display on your website
            </p>
            <Badge className={isConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
          <Link href="/api/auth/google-oauth?redirect=/admin/events">
            <Button>
              {isConnected ? 'Reconnect' : 'Connect'} Google Calendar
            </Button>
          </Link>
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
        {whereIsJoseEvents.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p>No "Where is Jose?" events scheduled</p>
          </div>
        ) : (
          <div className="space-y-3">
            {whereIsJoseEvents.map(event => (
              <EventCard key={event.id} event={event} onRefresh={fetchEvents} />
            ))}
          </div>
        )}
      </Card>

      {/* Featured Events */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Featured Events</h2>
            <p className="text-sm text-slate-600">Events displayed on your homepage</p>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : featuredEvents.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p>No featured events</p>
          </div>
        ) : (
          <div className="space-y-3">
            {featuredEvents.map(event => (
              <EventCard key={event.id} event={event} onRefresh={fetchEvents} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function EventCard({ event, onRefresh }: { event: FeaturedEvent; onRefresh: () => void }) {
  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const response = await fetch(`/api/admin/events/${event.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
    }
  }

  return (
    <div className="border rounded-lg p-4 hover:bg-slate-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{event.title}</h3>
            {event.googleEventId && (
              <Badge variant="outline" className="text-xs">
                <ExternalLink className="h-3 w-3 mr-1" />
                Google
              </Badge>
            )}
            {event.manuallyModified && (
              <Badge variant="outline" className="text-xs bg-blue-50">
                Modified
              </Badge>
            )}
          </div>
          {event.description && (
            <p className="text-sm text-slate-600 mb-2">{event.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(event.startDate).toLocaleDateString()}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {event.location}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 ml-4">
          <Link href={`/admin/events/${event.id}/edit`}>
            <Button size="sm" variant="ghost">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
