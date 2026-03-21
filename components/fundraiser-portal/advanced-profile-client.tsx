'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function AdvancedProfileClient({ fundraiserId }: { fundraiserId: string }) {
  const [profile, setProfile] = useState({
    customCss: '',
    liveStreamUrl: '',
    youtubeVideoUrl: '',
    tiktokFeedUrl: '',
    isAdvancedMode: false,
    aiFeedEnabled: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/fundraisers/${fundraiserId}/profile`)
        if (res.ok) {
          const data = await res.json()
          setProfile({
            customCss: data.customCss || '',
            liveStreamUrl: data.liveStreamUrl || '',
            youtubeVideoUrl: data.youtubeVideoUrl || '',
            tiktokFeedUrl: data.tiktokFeedUrl || '',
            isAdvancedMode: data.isAdvancedMode || false,
            aiFeedEnabled: data.aiFeedEnabled || false,
          })
        }
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProfile()
  }, [fundraiserId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)
    
    try {
      const res = await fetch(`/api/fundraisers/${fundraiserId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      
      if (res.ok) {
        setMessage('Advanced profile settings saved successfully.')
      } else {
        setMessage('Failed to save advanced profile settings.')
      }
    } catch {
      setMessage('An error occurred while saving. Please try again.')
    } finally {
      setIsSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setProfile((prev) => ({ ...prev, [name]: checked }))
    } else {
      setProfile((prev) => ({ ...prev, [name]: value }))
    }
  }

  if (isLoading) {
    return <div className="p-6 text-gray-500">Loading your profile settings...</div>
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-2 font-serif text-2xl font-bold text-gray-900">
        Advanced Customization
      </h1>
      <p className="mb-6 text-gray-600">
        Take full control of your page and wow your audience with custom content, streams, and styles.
      </p>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
        
        {/* Toggle Integrations */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">General Advanced Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isAdvancedMode"
                name="isAdvancedMode"
                checked={profile.isAdvancedMode}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-salsa-600 focus:ring-salsa-600"
              />
              <Label htmlFor="isAdvancedMode" className="cursor-pointer">
                Enable Advanced Features (Shows custom CSS, AI feeds, and live streams on your profile)
              </Label>
            </div>
          </div>
        </div>

        {/* Custom CSS */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-semibold text-gray-900">Custom Styling (CSS)</h2>
          <p className="mb-4 text-sm text-gray-500">Add your own CSS here to override default styles.</p>
          <div className="space-y-2">
            <Textarea
              id="customCss"
              name="customCss"
              value={profile.customCss}
              onChange={handleChange}
              rows={10}
              placeholder=".fundraiser-hero { background-color: #000; } /* your custom css here */"
              className="font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Media Integrations */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-semibold text-gray-900">Media & Live Streams</h2>
          <p className="mb-4 text-sm text-gray-500">Link your active streams or feeds here.</p>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="liveStreamUrl">Live Stream URL (Twitch, Kick, etc.)</Label>
              <Input
                id="liveStreamUrl"
                name="liveStreamUrl"
                type="url"
                value={profile.liveStreamUrl}
                onChange={handleChange}
                placeholder="https://twitch.tv/..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="youtubeVideoUrl">YouTube Video / Playlist URL</Label>
              <Input
                id="youtubeVideoUrl"
                name="youtubeVideoUrl"
                type="url"
                value={profile.youtubeVideoUrl}
                onChange={handleChange}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tiktokFeedUrl">TikTok Profile / Feed URL</Label>
              <Input
                id="tiktokFeedUrl"
                name="tiktokFeedUrl"
                type="url"
                value={profile.tiktokFeedUrl}
                onChange={handleChange}
                placeholder="https://tiktok.com/@..."
              />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-salsa-500 hover:bg-salsa-600 font-semibold"
          >
            {isSaving ? 'Saving...' : 'Save Advanced Profile'}
          </Button>
          {message && (
            <span className={`text-sm ${message.includes('error') || message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
