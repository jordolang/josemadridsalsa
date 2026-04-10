'use client'

import { useEffect, useState } from 'react'
import { Search, FileText, Globe, Save, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface SeoConfig {
  siteName: string
  siteDescription: string
  siteUrl: string
  defaultOgImage?: string
  twitterHandle?: string
  facebookAppId?: string
  productTitleTemplate?: string
  productDescTemplate?: string
  recipeTitleTemplate?: string
  recipeDescTemplate?: string
  robotsTxt?: string
}

export default function SEOPage() {
  const [config, setConfig] = useState<SeoConfig>({
    siteName: '',
    siteDescription: '',
    siteUrl: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [])

  async function fetchConfig() {
    try {
      const response = await fetch('/api/admin/seo/configuration')
      if (response.ok) {
        const data = await response.json()
        if (data && Object.keys(data).length > 0) {
          setConfig(data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch SEO config:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const response = await fetch('/api/admin/seo/configuration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (response.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (error) {
      console.error('Failed to save SEO config:', error)
    } finally {
      setSaving(false)
    }
  }

  function updateConfig(field: keyof SeoConfig, value: string) {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return <div className="p-8 text-center">Loading SEO configuration...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SEO Manager</h1>
          <p className="text-muted-foreground">Manage global SEO settings and meta templates</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saved ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save All Changes'}
            </>
          )}
        </Button>
      </div>

      {/* Global SEO Settings */}
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
              placeholder="https://josemadridsalsa.com"
            />
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

      {/* Meta Defaults */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Default Meta Templates
        </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="productMetaTemplate">Product Meta Title Template</Label>
            <Input id="productMetaTemplate" placeholder="{product_name} | Jose Madrid Salsa" disabled />
            <p className="text-xs text-muted-foreground">Use &#123;product_name&#125;, &#123;category&#125;, &#123;heat_level&#125; as variables</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipeMetaTemplate">Recipe Meta Title Template</Label>
            <Input id="recipeMetaTemplate" placeholder="{recipe_name} Recipe | Jose Madrid" disabled />
          </div>
          <Button disabled>Save Templates</Button>
        </div>
      </Card>

      {/* Structured Data */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Search className="h-5 w-5" />
          Structured Data (Schema.org)
        </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Organization Schema</Label>
            <p className="text-sm text-muted-foreground mb-2">Configure organization information for rich search results</p>
            <Button variant="outline" disabled>Configure Organization</Button>
          </div>
          <div className="space-y-2">
            <Label>Product Schema</Label>
            <p className="text-sm text-muted-foreground mb-2">Automatically generated from product data</p>
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          </div>
          <div className="space-y-2">
            <Label>Recipe Schema</Label>
            <p className="text-sm text-muted-foreground mb-2">Automatically generated from recipe data</p>
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          </div>
        </div>
      </Card>

      {/* Robots.txt & Sitemap */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">robots.txt & Sitemap</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Sitemap Generation</Label>
              <p className="text-sm text-muted-foreground">Automatically generated at /sitemap.xml</p>
            </div>
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Robots.txt</Label>
              <p className="text-sm text-muted-foreground">Located at /robots.txt</p>
            </div>
            <Button variant="outline" disabled>Edit Robots.txt</Button>
          </div>
        </div>
      </Card>

      {/* Implementation Note */}
      <Card className="p-6 border-blue-200 bg-blue-50">
        <h3 className="font-semibold text-blue-900 mb-2">SEO Manager - Coming Soon</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>Planned Features:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Global site SEO configuration storage</li>
            <li>Meta tag template system with variables</li>
            <li>Schema.org structured data editor</li>
            <li>Robots.txt and sitemap configuration</li>
            <li>SEO analysis and recommendations per page</li>
            <li>Google Search Console integration</li>
          </ul>
          <p className="mt-4"><strong>Note:</strong> Individual pages (Products, Recipes, Categories) already have SEO fields that are functional.</p>
        </div>
      </Card>
    </div>
  )
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>
}
