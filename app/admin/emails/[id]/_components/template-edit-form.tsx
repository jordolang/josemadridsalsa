'use client'

import { useEffect, useState, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export type TemplateEditState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

const INITIAL_STATE: TemplateEditState = { status: 'idle' }

interface TemplateMeta {
  key: string
  createdAt: string
  updatedAt: string
}

interface TemplateEditFormProps {
  action: (state: TemplateEditState, formData: FormData) => Promise<TemplateEditState>
  template: {
    name: string
    subject: string
    html: string
    text: string | null
  }
  meta: TemplateMeta
  canEdit: boolean
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  )
}

export function TemplateEditForm({
  action,
  template,
  meta,
  canEdit,
}: TemplateEditFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE)
  const [name, setName] = useState(template.name)
  const [subject, setSubject] = useState(template.subject)
  const [html, setHtml] = useState(template.html)
  const [text, setText] = useState(template.text ?? '')

  useEffect(() => {
    if (state.status === 'success') {
      toast.success(state.message)
    } else if (state.status === 'error') {
      toast.error(state.message)
    }
  }, [state])

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <Card className="p-6">
        <form action={formAction} className="space-y-5">
          {state.status === 'success' && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-primary/5 px-4 py-3 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {state.message}
            </div>
          )}
          {state.status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="name">
              Template name
            </label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canEdit}
              className="mt-2"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="subject">
              Email subject
            </label>
            <Input
              id="subject"
              name="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              disabled={!canEdit}
              className="mt-2"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground" htmlFor="html">
                HTML content
              </label>
              <span className="text-xs text-muted-foreground">
                Supports Handlebars-style variables: <code>{'{{variable}}'}</code>
              </span>
            </div>
            <Textarea
              id="html"
              name="html"
              value={html}
              onChange={(event) => setHtml(event.target.value)}
              disabled={!canEdit}
              className="mt-2 h-64 font-mono text-xs"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="text">
              Plain text fallback
            </label>
            <Textarea
              id="text"
              name="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={!canEdit}
              className="mt-2 h-40 font-mono text-xs"
            />
          </div>

          {canEdit ? (
            <div className="flex items-center justify-end">
              <SaveButton />
            </div>
          ) : (
            <p className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              You have read-only access to this template.
            </p>
          )}
        </form>
      </Card>

      <Card className="space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold">Template Details</h2>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Template key:</span>{' '}
              <span className="font-mono">{meta.key}</span>
            </p>
            <p>
              <span className="font-medium text-foreground">Created:</span>{' '}
              {meta.createdAt}
            </p>
            <p>
              <span className="font-medium text-foreground">Last updated:</span>{' '}
              {meta.updatedAt}
            </p>
            <p>
              <span className="font-medium text-foreground">Plain text version:</span>{' '}
              {text.trim().length > 0 ? 'Yes' : 'No'}
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold">HTML Preview</h2>
          {/*
            Sandboxed iframe — admin-authored email HTML renders isolated from
            the host page styles. No 'allow-scripts' means embedded JS cannot execute.
          */}
          <iframe
            title="Email HTML preview"
            srcDoc={html}
            sandbox=""
            className="mt-3 h-[480px] w-full rounded-lg border border-border bg-white"
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold">Plain Text Preview</h2>
          <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs text-foreground">
            {text.length > 0
              ? text
              : 'No plain text fallback yet. Edits to the field on the left will appear here.'}
          </pre>
        </div>
      </Card>
    </div>
  )
}
