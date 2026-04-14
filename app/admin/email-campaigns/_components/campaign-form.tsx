'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Mail, AlertCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { createCampaign } from '../actions'

interface MailingList {
  id: string
  name: string
  _count: {
    subscribers: number
  }
}

interface Template {
  id: string
  name: string
  subject: string
  category: string
  variables: unknown
}

interface CampaignFormProps {
  templates: Template[]
  mailingLists: MailingList[]
}

type RecipientsSource = 'list' | 'csv' | 'text' | 'paste'

const SOURCE_OPTIONS: {
  value: RecipientsSource
  label: string
  icon: typeof Users
}[] = [
  { value: 'list', label: 'Mailing List', icon: Users },
  { value: 'csv', label: 'CSV File', icon: FileText },
  { value: 'text', label: 'Text File', icon: FileText },
  { value: 'paste', label: 'Paste List', icon: Mail },
]

export function CampaignForm({ templates, mailingLists }: CampaignFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [recipientsSource, setRecipientsSource] = useState<RecipientsSource>(
    mailingLists.length > 0 ? 'list' : 'csv',
  )
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [fileContent, setFileContent] = useState('')
  const [fileName, setFileName] = useState('')

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const content = await file.text()
    setFileContent(content)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setParseErrors([])

    const formData = new FormData(e.currentTarget)
    formData.append('recipientsSource', recipientsSource)
    if (recipientsSource === 'list') {
      if (!selectedListId) {
        setError('Please select a mailing list')
        return
      }
      formData.append('listId', selectedListId)
    } else {
      formData.append(
        'recipientsData',
        fileContent || (formData.get('pasteRecipients') as string),
      )
    }

    startTransition(async () => {
      const result = await createCampaign(formData)

      if (result.error) {
        setError(result.error)
        if (result.parseErrors) {
          setParseErrors(result.parseErrors)
        }
      } else if (result.success) {
        router.push(`/admin/email-campaigns/${result.campaignId}`)
        router.refresh()
      }
    })
  }

  const resetSource = (next: RecipientsSource) => {
    setRecipientsSource(next)
    setFileContent('')
    setFileName('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{error}</AlertTitle>
          {parseErrors.length > 0 && (
            <AlertDescription>
              <ul className="mt-2 list-inside list-disc text-sm">
                {parseErrors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {parseErrors.length > 5 && (
                  <li>...and {parseErrors.length - 5} more errors</li>
                )}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Campaign Name *</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g., November Newsletter 2025"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="templateId">Email Template *</Label>
            <Select
              name="templateId"
              required
              onValueChange={(value) => {
                const template = templates.find((t) => t.id === value)
                setSelectedTemplate(template || null)
              }}
            >
              <SelectTrigger id="templateId">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} ({template.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <div className="space-y-1.5">
              <Label htmlFor="subject">Email Subject *</Label>
              <Input
                id="subject"
                name="subject"
                required
                defaultValue={selectedTemplate.subject}
                placeholder="Subject line"
              />
              <p className="text-xs text-muted-foreground">
                You can customize the subject or use the template default
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Recipients Source</Label>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {SOURCE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  type="button"
                  variant={recipientsSource === value ? 'default' : 'outline'}
                  className={cn(
                    'h-auto flex-col py-4',
                    recipientsSource === value && 'ring-2 ring-primary ring-offset-2',
                  )}
                  onClick={() => resetSource(value)}
                >
                  <Icon className="mb-2 h-6 w-6" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {recipientsSource === 'list' && (
            <div className="space-y-1.5">
              <Label htmlFor="listId">Select Mailing List *</Label>
              <Select value={selectedListId} onValueChange={setSelectedListId}>
                <SelectTrigger id="listId">
                  <SelectValue placeholder="Select a list..." />
                </SelectTrigger>
                <SelectContent>
                  {mailingLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name} ({list._count.subscribers} active)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {recipientsSource === 'csv' && (
            <div className="space-y-1.5">
              <Label htmlFor="csvFile">Upload CSV File *</Label>
              <Input
                type="file"
                id="csvFile"
                accept=".csv"
                onChange={handleFileUpload}
                required={recipientsSource === 'csv'}
              />
              {fileName && (
                <p className="text-sm text-primary">✓ {fileName} uploaded</p>
              )}
              <p className="text-xs text-muted-foreground">
                CSV must have an &quot;email&quot; column. Optional: &quot;name&quot; column and custom variables.
              </p>
            </div>
          )}

          {recipientsSource === 'text' && (
            <div className="space-y-1.5">
              <Label htmlFor="textFile">Upload Text File *</Label>
              <Input
                type="file"
                id="textFile"
                accept=".txt"
                onChange={handleFileUpload}
                required={recipientsSource === 'text'}
              />
              {fileName && (
                <p className="text-sm text-primary">✓ {fileName} uploaded</p>
              )}
              <p className="text-xs text-muted-foreground">
                One email address per line
              </p>
            </div>
          )}

          {recipientsSource === 'paste' && (
            <div className="space-y-1.5">
              <Label htmlFor="pasteRecipients">Paste Email Addresses *</Label>
              <Textarea
                id="pasteRecipients"
                name="pasteRecipients"
                required={recipientsSource === 'paste'}
                rows={8}
                placeholder={`user1@example.com\nuser2@example.com\nuser3@example.com`}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                One email address per line
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating…' : 'Create Campaign'}
        </Button>
      </div>
    </form>
  )
}
