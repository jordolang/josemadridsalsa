'use client'

import { Globe } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { SeoConfigForm, UpdateConfig } from './types'

interface Props {
  config: SeoConfigForm
  updateConfig: UpdateConfig
}

export function GeneralSettings({ config, updateConfig }: Props) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Globe className="h-5 w-5" />
        Global SEO Settings
      </h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="siteName">Site Name</Label>
          <Input
            id="siteName"
            value={config.siteName}
            onChange={(e) => updateConfig('siteName', e.target.value)}
            placeholder="Jose Madrid Salsa"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="siteDescription">Site Description</Label>
          <Textarea
            id="siteDescription"
            value={config.siteDescription}
            onChange={(e) => updateConfig('siteDescription', e.target.value)}
            placeholder="Premium handcrafted salsa from Jose Madrid"
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="siteUrl">Site URL</Label>
          <Input
            id="siteUrl"
            value={config.siteUrl}
            onChange={(e) => updateConfig('siteUrl', e.target.value)}
            placeholder="https://www.josemadridsalsa.com"
          />
          <p className="text-xs text-muted-foreground">
            Used as the base URL for the sitemap and canonical links.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultOgImage">Default OG Image URL</Label>
          <Input
            id="defaultOgImage"
            value={config.defaultOgImage || ''}
            onChange={(e) => updateConfig('defaultOgImage', e.target.value)}
            placeholder="https://example.com/og-image.jpg"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultKeywords">Default Keywords</Label>
          <Input
            id="defaultKeywords"
            value={(config.defaultKeywords || []).join(', ')}
            onChange={(e) =>
              updateConfig(
                'defaultKeywords',
                e.target.value
                  .split(',')
                  .map((k) => k.trim())
                  .filter(Boolean)
              )
            }
            placeholder="salsa, gourmet, hot sauce"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated. Also used by the SEO analysis to check keyword usage.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="twitterHandle">Twitter Handle</Label>
            <Input
              id="twitterHandle"
              value={config.twitterHandle || ''}
              onChange={(e) => updateConfig('twitterHandle', e.target.value)}
              placeholder="@josemadridsalsa"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facebookAppId">Facebook App ID</Label>
            <Input
              id="facebookAppId"
              value={config.facebookAppId || ''}
              onChange={(e) => updateConfig('facebookAppId', e.target.value)}
              placeholder="123456789"
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
