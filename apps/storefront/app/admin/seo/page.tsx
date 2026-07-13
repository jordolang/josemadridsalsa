'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GeneralSettings } from '@/components/admin/seo/general-settings'
import { MetaTemplates } from '@/components/admin/seo/meta-templates'
import { StructuredDataEditor } from '@/components/admin/seo/structured-data-editor'
import { RobotsSitemap } from '@/components/admin/seo/robots-sitemap'
import { SeoAnalysisPanel } from '@/components/admin/seo/seo-analysis'
import { SearchConsolePanel } from '@/components/admin/seo/search-console'
import type { SeoConfigForm } from '@/components/admin/seo/types'

// Tabs whose fields live on the shared configuration object and are persisted
// by the global Save button (the other tabs save through their own endpoints)
const CONFIG_TABS = ['general', 'templates', 'robots']

export default function SEOPage() {
  const [config, setConfig] = useState<SeoConfigForm>({
    siteName: '',
    siteDescription: '',
    siteUrl: '',
  })
  const [activeTab, setActiveTab] = useState('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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
    setSaveError(null)
    try {
      // Search Console fields are saved from their own tab; credentials are write-only
      const { hasGscCredentials, googleSiteVerification, gscProperty, ...payload } = config
      const response = await fetch('/api/admin/seo/configuration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (response.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        const data = await response.json()
        setSaveError(data.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Failed to save SEO config:', error)
      setSaveError(String(error))
    } finally {
      setSaving(false)
    }
  }

  function updateConfig<K extends keyof SeoConfigForm>(field: K, value: SeoConfigForm[K]) {
    setConfig((prev) => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return <div className="p-8 text-center">Loading SEO configuration...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SEO Manager</h1>
          <p className="text-muted-foreground">
            Global settings, meta templates, structured data, sitemap, analysis, and Search Console
          </p>
        </div>
        {CONFIG_TABS.includes(activeTab) && (
          <Button onClick={handleSave} disabled={saving}>
            {saved ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </>
            )}
          </Button>
        )}
      </div>
      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="templates">Meta Templates</TabsTrigger>
          <TabsTrigger value="structured-data">Structured Data</TabsTrigger>
          <TabsTrigger value="robots">Robots &amp; Sitemap</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="search-console">Search Console</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralSettings config={config} updateConfig={updateConfig} />
        </TabsContent>
        <TabsContent value="templates" className="mt-6">
          <MetaTemplates config={config} updateConfig={updateConfig} />
        </TabsContent>
        <TabsContent value="structured-data" className="mt-6">
          <StructuredDataEditor />
        </TabsContent>
        <TabsContent value="robots" className="mt-6">
          <RobotsSitemap config={config} updateConfig={updateConfig} />
        </TabsContent>
        <TabsContent value="analysis" className="mt-6">
          <SeoAnalysisPanel />
        </TabsContent>
        <TabsContent value="search-console" className="mt-6">
          <SearchConsolePanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
