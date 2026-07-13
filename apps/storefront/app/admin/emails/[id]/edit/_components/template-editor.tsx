'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Code, Send, Save, AlertCircle, Variable } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Client-side variable substitution (can't import from sender.ts due to nodemailer)
function substituteVariables(
  template: string,
  variables: Record<string, string>,
): string {
  let result = template
  Object.keys(variables).forEach((key) => {
    const value = variables[key] ?? ''
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    result = result.replace(regex, String(value))
  })
  return result
}

interface Template {
  id: string
  key: string
  name: string
  subject: string
  html: string
  text: string | null
  variables: unknown
  category: string
  isActive: boolean
}

interface TemplateEditorProps {
  template: Template
}

type TestResult = { success: boolean; message: string }

export function TemplateEditor({ template }: TemplateEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: template.name,
    subject: template.subject,
    html: template.html,
    text: template.text || '',
    isActive: template.isActive,
  })

  const variables = (template.variables as Record<string, string>) || {}
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>(
    Object.keys(variables).reduce(
      (acc, key) => {
        acc[key] = `Sample ${key}`
        return acc
      },
      {} as Record<string, string>,
    ),
  )

  const handleSave = async () => {
    setError(null)

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/admin/email-templates/${template.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          },
        )

        const result = await response.json()

        if (!response.ok) {
          setError(result.error || 'Failed to save template')
        } else {
          router.push('/admin/emails')
          router.refresh()
        }
      } catch {
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
      const response = await fetch(
        `/api/admin/email-templates/${template.id}/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: testEmail,
            variables: previewVariables,
          }),
        },
      )

      const result: TestResult = await response.json()
      setTestResult(result)
    } catch {
      setTestResult({ success: false, message: 'Failed to send test email' })
    }
  }

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('html-editor') as HTMLTextAreaElement | null
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = formData.html
    const before = text.substring(0, start)
    const after = text.substring(end, text.length)

    setFormData({
      ...formData,
      html: before + `{{${variable}}}` + after,
    })

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + variable.length + 4,
        start + variable.length + 4,
      )
    }, 0)
  }

  const previewHtml = substituteVariables(formData.html, previewVariables)

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Template Info */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isActive: checked === true })
              }
            />
            <Label htmlFor="isActive" className="font-normal">
              Template is active
            </Label>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{template.category}</Badge>
            <span>•</span>
            <span>Key: {template.key}</span>
          </div>
        </CardContent>
      </Card>

      {/* Variables */}
      {Object.keys(variables).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Variable className="h-5 w-5" />
              Available Variables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.keys(variables).map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => insertVariable(key)}
                >
                  {`{{${key}}}`}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Click to insert variable at cursor position
            </p>
          </CardContent>
        </Card>
      )}

      {/* Editor Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'edit' | 'preview')}
        >
          <TabsList>
            <TabsTrigger value="edit">
              <Code className="mr-2 h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTestDialog(true)} size="sm">
            <Send className="mr-2 h-4 w-4" />
            Send Test
          </Button>
          <Button onClick={handleSave} disabled={isPending} size="sm">
            <Save className="mr-2 h-4 w-4" />
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      {activeTab === 'edit' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">HTML Content</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                id="html-editor"
                value={formData.html}
                onChange={(e) => setFormData({ ...formData, html: e.target.value })}
                className="h-96 font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plain Text Version</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                id="text-editor"
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                placeholder="Plain text fallback for email clients that don't support HTML"
                className="h-48 font-mono text-sm"
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label>Preview Variables</Label>
              <div className="grid grid-cols-3 gap-3">
                {Object.keys(variables).map((key) => (
                  <Input
                    key={key}
                    placeholder={key}
                    value={previewVariables[key] || ''}
                    onChange={(e) =>
                      setPreviewVariables({
                        ...previewVariables,
                        [key]: e.target.value,
                      })
                    }
                    className="text-sm"
                  />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card">
              <div className="border-b p-4">
                <p className="text-sm text-muted-foreground">Subject:</p>
                <p className="font-medium">
                  {substituteVariables(formData.subject, previewVariables)}
                </p>
              </div>
              {/*
                Sandboxed iframe — admin-authored email HTML renders isolated from
                the host page. No 'allow-scripts' means embedded JS cannot execute.
              */}
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                sandbox=""
                className="h-[600px] w-full rounded-b-lg border-0 bg-white"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Email Dialog */}
      <Dialog
        open={showTestDialog}
        onOpenChange={(open) => {
          setShowTestDialog(open)
          if (!open) setTestResult(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
          </DialogHeader>

          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="testEmail">Recipient Email</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </div>

            {Object.keys(variables).length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Test Variables</Label>
                  <div className="space-y-2">
                    {Object.keys(variables).map((key) => (
                      <Input
                        key={key}
                        placeholder={key}
                        value={previewVariables[key] || ''}
                        onChange={(e) =>
                          setPreviewVariables({
                            ...previewVariables,
                            [key]: e.target.value,
                          })
                        }
                        className="text-sm"
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
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
              <Send className="mr-2 h-4 w-4" />
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
