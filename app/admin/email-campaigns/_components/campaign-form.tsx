'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Mail, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createCampaign } from '../actions'

interface Template {
  id: string
  name: string
  subject: string
  category: string
  variables: any
}

interface CampaignFormProps {
  templates: Template[]
}

export function CampaignForm({ templates }: CampaignFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [recipientsSource, setRecipientsSource] = useState<'csv' | 'text' | 'paste'>('csv')
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
    formData.append('recipientsData', fileContent || formData.get('pasteRecipients') as string)

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-900">{error}</p>
              {parseErrors.length > 0 && (
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {parseErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {parseErrors.length > 5 && (
                    <li>...and {parseErrors.length - 5} more errors</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Campaign Details</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Campaign Name *</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g., November Newsletter 2025"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="templateId">Email Template *</Label>
            <select
              id="templateId"
              name="templateId"
              required
              className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              onChange={(e) => {
                const template = templates.find((t) => t.id === e.target.value)
                setSelectedTemplate(template || null)
              }}
            >
              <option value="">Select a template...</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.category})
                </option>
              ))}
            </select>
          </div>

          {selectedTemplate && (
            <div>
              <Label htmlFor="subject">Email Subject *</Label>
              <Input
                id="subject"
                name="subject"
                required
                defaultValue={selectedTemplate.subject}
                placeholder="Subject line"
                className="mt-1.5"
              />
              <p className="text-xs text-slate-500 mt-1">
                You can customize the subject or use the template default
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Recipients</h2>

        <div className="space-y-4">
          <div>
            <Label>Upload Method</Label>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setRecipientsSource('csv')
                  setFileContent('')
                  setFileName('')
                }}
                className={`p-4 border-2 rounded-lg text-sm font-medium transition-colors ${
                  recipientsSource === 'csv'
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <FileText className="h-6 w-6 mx-auto mb-2" />
                CSV File
              </button>

              <button
                type="button"
                onClick={() => {
                  setRecipientsSource('text')
                  setFileContent('')
                  setFileName('')
                }}
                className={`p-4 border-2 rounded-lg text-sm font-medium transition-colors ${
                  recipientsSource === 'text'
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <FileText className="h-6 w-6 mx-auto mb-2" />
                Text File
              </button>

              <button
                type="button"
                onClick={() => {
                  setRecipientsSource('paste')
                  setFileContent('')
                  setFileName('')
                }}
                className={`p-4 border-2 rounded-lg text-sm font-medium transition-colors ${
                  recipientsSource === 'paste'
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Mail className="h-6 w-6 mx-auto mb-2" />
                Paste List
              </button>
            </div>
          </div>

          {recipientsSource === 'csv' && (
            <div>
              <Label htmlFor="csvFile">Upload CSV File *</Label>
              <div className="mt-2">
                <input
                  type="file"
                  id="csvFile"
                  accept=".csv"
                  onChange={handleFileUpload}
                  required={recipientsSource === 'csv'}
                  className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
              </div>
              {fileName && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ {fileName} uploaded
                </p>
              )}
              <p className="text-xs text-slate-500 mt-2">
                CSV must have an "email" column. Optional: "name" column and custom variables.
              </p>
            </div>
          )}

          {recipientsSource === 'text' && (
            <div>
              <Label htmlFor="textFile">Upload Text File *</Label>
              <div className="mt-2">
                <input
                  type="file"
                  id="textFile"
                  accept=".txt"
                  onChange={handleFileUpload}
                  required={recipientsSource === 'text'}
                  className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
              </div>
              {fileName && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ {fileName} uploaded
                </p>
              )}
              <p className="text-xs text-slate-500 mt-2">
                One email address per line
              </p>
            </div>
          )}

          {recipientsSource === 'paste' && (
            <div>
              <Label htmlFor="pasteRecipients">Paste Email Addresses *</Label>
              <textarea
                id="pasteRecipients"
                name="pasteRecipients"
                required={recipientsSource === 'paste'}
                rows={8}
                placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
              <p className="text-xs text-slate-500 mt-2">
                One email address per line
              </p>
            </div>
          )}
        </div>
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
          {isPending ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Creating...
            </>
          ) : (
            'Create Campaign'
          )}
        </Button>
      </div>
    </form>
  )
}
