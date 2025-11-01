'use client'

import { Search, FileText, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export default function SEOPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SEO Manager</h1>
          <p className="text-slate-600">Manage global SEO settings and defaults</p>
        </div>
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
            <Input id="siteName" placeholder="Jose Madrid Salsa" disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siteDescription">Site Description</Label>
            <Textarea id="siteDescription" placeholder="Premium handcrafted salsa from Jose Madrid" rows={3} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siteUrl">Site URL</Label>
            <Input id="siteUrl" placeholder="https://josemadridsalsa.com" disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultOgImage">Default OG Image URL</Label>
            <Input id="defaultOgImage" placeholder="https://example.com/og-image.jpg" disabled />
          </div>
          <Button disabled>Save Global Settings</Button>
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
            <p className="text-xs text-slate-500">Use &#123;product_name&#125;, &#123;category&#125;, &#123;heat_level&#125; as variables</p>
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
            <p className="text-sm text-slate-600 mb-2">Configure organization information for rich search results</p>
            <Button variant="outline" disabled>Configure Organization</Button>
          </div>
          <div className="space-y-2">
            <Label>Product Schema</Label>
            <p className="text-sm text-slate-600 mb-2">Automatically generated from product data</p>
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          </div>
          <div className="space-y-2">
            <Label>Recipe Schema</Label>
            <p className="text-sm text-slate-600 mb-2">Automatically generated from recipe data</p>
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
              <p className="text-sm text-slate-600">Automatically generated at /sitemap.xml</p>
            </div>
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Robots.txt</Label>
              <p className="text-sm text-slate-600">Located at /robots.txt</p>
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
