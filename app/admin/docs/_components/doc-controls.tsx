'use client'

import { useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DocVisibility } from '@/lib/docs/source'
import { updateDocPublishingAction, updateDocVisibilityAction } from '../actions'

interface DocControlsProps {
  slug: string
  isPublished: boolean
  visibility: DocVisibility
  canManage: boolean
}

export function DocControls({ slug, isPublished, visibility, canManage }: DocControlsProps) {
  const [isPending, startTransition] = useTransition()
  const disabled = !canManage || isPending
  const controlId = slug.replace(/\//g, '-')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Label htmlFor={`publish-${controlId}`} className="text-sm font-medium">
          Published
        </Label>
        <Switch
          id={`publish-${controlId}`}
          checked={isPublished}
          disabled={disabled}
          onCheckedChange={(checked) => {
            startTransition(() => updateDocPublishingAction(slug, checked))
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-sm font-medium">Visibility</Label>
        <Select
          disabled={disabled}
          value={visibility}
          onValueChange={(value: DocVisibility) => {
            startTransition(() => updateDocVisibilityAction(slug, value))
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="developer">Developer</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
