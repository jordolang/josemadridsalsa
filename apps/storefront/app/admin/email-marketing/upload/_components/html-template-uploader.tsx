'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Save, Code, Eye, AlertCircle, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createTemplateFromUpload } from '../actions'

function slugifyKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function HtmlTemplateUploader() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [keyEdited, setKeyEdited] = useState(false)
  const [key, setKey] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('MARKETING')
  const [html, setHtml] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)

  // Keep the key in sync with the name until the user edits the key by hand.
  const handleNameChange = (value: string) => {
    setName(value)
    if (!keyEdited) setKey(slugifyKey(value))
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    const contents = await file.text()
    setHtml(contents)
    setFileName(file.name)
    // Prefill name/key from the filename if the user hasn't entered one yet.
    if (!name) {
      const base = file.name.replace(/\.html?$/i, '')
      handleNameChange(base)
    }
  }

  const save = (thenCreateCampaign: boolean) => {
    setError(null)
    startTransition(async () => {
      const result = await createTemplateFromUpload({ name, key, subject, category, html })
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (thenCreateCampaign) {
        // Hand off to the campaign builder to pick recipients (CSV) and send.
        router.push(`/admin/email-campaigns/new?templateId=${result.templateId}`)
      } else {
        router.push(`/admin/emails/${result.templateId}`)
      }
      router.refresh()
    })
  }

  const canSave = name.trim() && subject.trim() && html.trim() && !isPending

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Upload + configure ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Upload &amp; configure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,text/html"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {fileName ? `Replace file (${fileName})` : 'Upload .html file'}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              The file&apos;s contents load into the editor below. You can also paste or edit
              markup directly.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Template name</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Fundraising price update 2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-key">Template key</Label>
              <Input
                id="tpl-key"
                value={key}
                onChange={(e) => {
                  setKeyEdited(true)
                  setKey(e.target.value)
                }}
                placeholder="fundraising_price_update_2026"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase with underscores. Used when sending programmatically.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-subject">Email subject</Label>
              <Input
                id="tpl-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="An Important Update on Our Fundraising Pricing"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="tpl-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="TRANSACTIONAL">Transactional</SelectItem>
                  <SelectItem value="ADMINISTRATIVE">Administrative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Split editor: code | live preview ──────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Edit &amp; preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Code className="h-4 w-4" />
                HTML source
              </div>
              <Textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder="Upload a file or paste your email HTML here…"
                className="h-[600px] font-mono text-xs"
                spellCheck={false}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Eye className="h-4 w-4" />
                Live preview
              </div>
              {/*
                Sandboxed iframe — admin-authored email HTML renders isolated from
                the host page. No 'allow-scripts' means embedded JS cannot execute.
              */}
              <iframe
                title="Email preview"
                srcDoc={html}
                sandbox=""
                className="h-[600px] w-full rounded-md border border-border bg-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Actions ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" onClick={() => save(false)} disabled={!canSave}>
          <Save className="mr-2 h-4 w-4" />
          {isPending ? 'Saving…' : 'Save template'}
        </Button>
        <Button onClick={() => save(true)} disabled={!canSave}>
          <Rocket className="mr-2 h-4 w-4" />
          Save &amp; set up mass send
        </Button>
      </div>
    </div>
  )
}
