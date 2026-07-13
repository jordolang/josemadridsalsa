'use client'

import { ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { SeoConfigForm, UpdateConfig } from './types'

interface Props {
  config: SeoConfigForm
  updateConfig: UpdateConfig
}

const DEFAULT_ROBOTS = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Sitemap: https://www.josemadridsalsa.com/sitemap.xml`

const SITEMAP_SECTIONS: Array<{ key: string; label: string; fallback: number }> = [
  { key: 'home', label: 'Home page', fallback: 1 },
  { key: 'products', label: 'Product listings', fallback: 0.9 },
  { key: 'product', label: 'Product detail pages', fallback: 0.8 },
  { key: 'recipes', label: 'Recipe listing', fallback: 0.8 },
  { key: 'recipe', label: 'Recipe detail pages', fallback: 0.6 },
  { key: 'locations', label: 'Find-us listing', fallback: 0.7 },
  { key: 'location', label: 'Location detail pages', fallback: 0.5 },
]

export function RobotsSitemap({ config, updateConfig }: Props) {
  const priorities = config.sitemapPriorities || {}

  function setPriority(key: string, raw: string) {
    const next = { ...priorities }
    const value = parseFloat(raw)
    if (raw === '' || Number.isNaN(value)) {
      delete next[key]
    } else {
      next[key] = Math.min(Math.max(value, 0), 1)
    }
    updateConfig('sitemapPriorities', next)
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">robots.txt</h2>
          <a
            href="/robots.txt"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary flex items-center gap-1 hover:underline"
          >
            View live <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="space-y-2">
          <Textarea
            value={config.robotsTxt || ''}
            onChange={(e) => updateConfig('robotsTxt', e.target.value)}
            placeholder={DEFAULT_ROBOTS}
            rows={10}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Supported directives: User-agent, Allow, Disallow, Sitemap. Leave empty to use the
            default (allow everything except /admin/ and /api/).
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Sitemap Priorities</h2>
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary flex items-center gap-1 hover:underline"
          >
            View live <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Priority hints (0.0–1.0) for each section of the auto-generated sitemap at /sitemap.xml.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SITEMAP_SECTIONS.map((section) => (
            <div key={section.key} className="flex items-center justify-between gap-4">
              <Label htmlFor={`priority-${section.key}`} className="flex-1">
                {section.label}
              </Label>
              <Input
                id={`priority-${section.key}`}
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={priorities[section.key] ?? ''}
                onChange={(e) => setPriority(section.key, e.target.value)}
                placeholder={String(section.fallback)}
                className="w-24"
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
