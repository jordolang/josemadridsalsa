'use client'

import { useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  ACCEPTED_FILE_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  TRAINING_MAX_CHARACTERS,
} from '@/lib/training-data/constants'
import { Label } from '@/components/ui/label'

type UploadState = 'pending' | 'uploading' | 'success' | 'error'

type UploadTask = {
  id: string
  fileName: string
  status: UploadState
  message?: string
}

const ACCEPT_ATTRIBUTE = [...ACCEPTED_FILE_EXTENSIONS, ...ACCEPTED_MIME_TYPES].join(',')
const MAX_FILES_PER_BATCH = 10

function createTaskId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`
}

export function TrainingUploadForm() {
  const router = useRouter()
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [notes, setNotes] = useState('')
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const resetInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const processFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList).slice(0, MAX_FILES_PER_BATCH)
    setIsUploading(true)
    const newTasks: UploadTask[] = files.map((file) => ({
      id: createTaskId(file),
      fileName: file.name,
      status: 'pending',
    }))
    setTasks((prev) => [...newTasks, ...prev])

    for (let index = 0; index < files.length; index += 1) {
      await uploadSingle(files[index], newTasks[index].id)
    }

    setIsUploading(false)
    resetInput()
    router.refresh()
  }

  const uploadSingle = async (file: File | null, taskId: string) => {
    if (!file) return

    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: 'uploading', message: undefined } : task)),
    )

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (notes.trim()) {
        formData.append('notes', notes.trim())
      }

      const response = await fetch('/api/admin/training-data', {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Upload failed')
      }

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, status: 'success', message: 'Ready for training' }
            : task,
        ),
      )
    } catch (error: any) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: 'error',
                message: error?.message ?? 'Something went wrong',
              }
            : task,
        ),
      )
    }
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(event.target.files)
  }

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
    processFiles(event.dataTransfer.files)
  }

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'rounded-lg border border-dashed p-6 text-center transition',
          isDragging ? 'border-primary bg-primary/5' : 'border-input',
        )}
      >
        <input
          id={fileInputId}
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <Label
          htmlFor={fileInputId}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className="flex cursor-pointer flex-col items-center justify-center gap-3"
        >
          <UploadCloud className="h-10 w-10 text-primary" />
          <div className="space-y-1">
            <p className="text-base font-semibold">
              Drag & drop files or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              Supports {ACCEPTED_FILE_EXTENSIONS.join(', ')}
            </p>
          </div>
          <Button type="button" className="mt-4" disabled={isUploading}>
            Select files
          </Button>
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="training-notes">Notes (optional)</Label>
        <Textarea
          id="training-notes"
          placeholder="Add curator notes or reminders about these files."
          maxLength={2000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      {tasks.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <p className="text-sm font-medium">Recent uploads</p>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{task.fileName}</p>
                  {task.message && (
                    <p className="text-xs text-muted-foreground">{task.message}</p>
                  )}
                </div>
                <div>
                  {task.status === 'uploading' && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading
                    </span>
                  )}
                  {task.status === 'success' && (
                    <span className="flex items-center gap-1 text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      Ready
                    </span>
                  )}
                  {task.status === 'error' && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      Failed
                    </span>
                  )}
                  {task.status === 'pending' && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-4 w-4" />
                      Queued
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Tip: limit batches to {MAX_FILES_PER_BATCH} files. Documents longer than{' '}
        {TRAINING_MAX_CHARACTERS.toLocaleString()} characters are automatically truncated.
      </p>
    </div>
  )
}
