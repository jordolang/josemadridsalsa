'use client'

import { useEffect, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export type TemplateEditState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

const INITIAL_STATE: TemplateEditState = { status: 'idle' }

interface TemplateEditFormProps {
  action: (state: TemplateEditState, formData: FormData) => Promise<TemplateEditState>
  template: {
    name: string
    subject: string
    html: string
    text: string | null
  }
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

export function TemplateEditForm({ action, template, canEdit }: TemplateEditFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE)

  useEffect(() => {
    if (state.status === 'success') {
      toast.success(state.message)
    } else if (state.status === 'error') {
      toast.error(state.message)
    }
  }, [state])

  return (
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
          defaultValue={template.name}
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
          defaultValue={template.subject}
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
          defaultValue={template.html}
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
          defaultValue={template.text || ''}
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
  )
}
