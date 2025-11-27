'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Code, Send, Save, AlertCircle, CheckCircle2, Variable } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { substituteVariables } from '@/lib/email/sender'

interface Template {
  id: string
  key: string
  name: string
  subject: string
  html: string
  text: string | null
  variables: any
  category: string
  isActive: boolean
}

interface TemplateEditorProps {
  template: Template
}

export function TemplateEditor({ template }: TemplateEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: template.name,
    subject: template.subject,
    html: template.html,
    text: template.text || '',
    isActive: template.isActive,
  })

  const variables = template.variables as Record<string, string> || {}
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>(
    Object.keys(variables).reduce((acc, key) => {
      acc[key] = `Sample ${key}`
      return acc
    }, {} as Record<string, string>)
  )

  const handleSave = async () => {
    setError(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/email-templates/${template.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        const result = await response.json()

        if (!response.ok) {
          setError(result.error || 'Failed to save template')
        } else {
          router.push('/admin/emails')
          router.refresh()
        }
      } catch (err) {
        setError('Failed to save template')
      }
    })
  }

  const handleSendTest = async () => {
    if (!testEmail) {
      setTestResult({ success: false, message: 'Please enter an email address' })
      return
    }

    try {
      const response = await fetch(`/api/admin/email-templates/${template.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: testEmail,
          variables: previewVariables,
        }),
      })

      const result = await response.json()
      setTestResult(result)
    } catch (err) {
      setTestResult({ success: false, message: 'Failed to send test email' })
    }
  }

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('html-editor') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = formData.html
      const before = text.substring(0, start)
      const after = text.substring(end, text.length)
      
      setFormData({
        ...formData,
        html: before + `{{${variable}}}` + after,
      })

      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4)
      }, 0)
    }
  }

  const previewHtml = substituteVariables(formData.html, previewVariables)

  return (
    <div className="space-y-6">
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <p className="text-sm text-red-900">{error}</p>
          </div>
        </Card>
      )}

      {/* Template Info */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-slate-300"
            />
            <Label htmlFor="isActive" className="font-normal cursor-pointer">
              Template is active
            </Label>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium">
              {template.category}
            </span>
            <span className="text-slate-400">•</span>
            <span>Key: {template.key}</span>
          </div>
        </div>
      </Card>

      {/* Variables */}
      {Object.keys(variables).length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Variable className="h-5 w-5" />
            Available Variables
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.keys(variables).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => insertVariable(key)}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
              >
                {`{{${key}}}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Click to insert variable at cursor position
          </p>
        </Card>
      )}

      {/* Editor Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'edit' ? 'default' : 'outline'}
            onClick={() => setActiveTab('edit')}
            size="sm"
          >
            <Code className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant={activeTab === 'preview' ? 'default' : 'outline'}
            onClick={() => setActiveTab('preview')}
            size="sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowTestDialog(true)}
            size="sm"
          >
            <Send className="h-4 w-4 mr-2" />
            Send Test
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            size="sm"
          >
            {isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      {activeTab === 'edit' ? (
        <div className="space-y-4">
          <Card className="p-6">
            <Label htmlFor="html-editor">HTML Content</Label>
            <textarea
              id="html-editor"
              value={formData.html}
              onChange={(e) => setFormData({ ...formData, html: e.target.value })}
              className="mt-2 w-full h-96 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Card>

          <Card className="p-6">
            <Label htmlFor="text-editor">Plain Text Version</Label>
            <textarea
              id="text-editor"
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              placeholder="Plain text fallback for email clients that don't support HTML"
              className="mt-2 w-full h-48 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Card>
        </div>
      ) : (
        <Card className="p-6">
          <div className="mb-4">
            <Label>Preview Variables</Label>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {Object.keys(variables).map((key) => (
                <Input
                  key={key}
                  placeholder={key}
                  value={previewVariables[key] || ''}
                  onChange={(e) => setPreviewVariables({
                    ...previewVariables,
                    [key]: e.target.value,
                  })}
                  className="text-sm"
                />
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-white">
            <div className="mb-4 pb-4 border-b">
              <p className="text-sm text-slate-600">Subject:</p>
              <p className="font-medium">{substituteVariables(formData.subject, previewVariables)}</p>
            </div>
            <div 
              dangerouslySetInnerHTML={{ __html: previewHtml }}
              className="prose prose-sm max-w-none"
            />
          </div>
        </Card>
      )}

      {/* Test Email Dialog */}
      {showTestDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full m-4 p-6">
            <h3 className="text-lg font-semibold mb-4">Send Test Email</h3>

            {testResult && (
              <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                testResult.success 
                  ? 'bg-green-50 text-green-900' 
                  : 'bg-red-50 text-red-900'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <p className="text-sm">{testResult.message}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="testEmail">Recipient Email</Label>
                <Input
                  id="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="mt-1.5"
                />
              </div>

              {Object.keys(variables).length > 0 && (
                <div>
                  <Label>Test Variables</Label>
                  <div className="mt-2 space-y-2">
                    {Object.keys(variables).map((key) => (
                      <Input
                        key={key}
                        placeholder={key}
                        value={previewVariables[key] || ''}
                        onChange={(e) => setPreviewVariables({
                          ...previewVariables,
                          [key]: e.target.value,
                        })}
                        className="text-sm"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTestDialog(false)
                  setTestResult(null)
                }}
              >
                Close
              </Button>
              <Button onClick={handleSendTest}>
                <Send className="h-4 w-4 mr-2" />
                Send Test
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
