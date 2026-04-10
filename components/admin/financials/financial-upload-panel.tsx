"use client"

import { useState } from "react"
import { Inbox, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FinancialUploadPanelProps = {
  acceptedExtensions: string[]
}

export function FinancialUploadPanel({ acceptedExtensions }: FinancialUploadPanelProps) {
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) {
      return
    }
    setFiles(Array.from(event.target.files))
  }

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files.length > 0) {
      setFiles(Array.from(event.dataTransfer.files))
    }
  }

  const acceptedText = acceptedExtensions.join(", ")

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-salsa-500">Statements</p>
          <h2 className="font-serif text-xl font-semibold text-foreground">Upload financial exports</h2>
          <p className="text-sm text-muted-foreground">
            Drop bank statements, payroll registers, or invoice batches to reconcile inside Jose Madrid Salsa.
          </p>
        </div>
        <Inbox className="h-9 w-9 text-muted-foreground/60" />
      </div>

      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-input bg-muted/50 px-6 py-10 text-center transition",
          isDragging ? "border-salsa-300 bg-salsa-50" : "hover:border-salsa-300 hover:bg-salsa-50/60"
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Drag & drop files here or <span className="font-semibold text-salsa-600">browse</span> your computer
          </p>
          <p className="text-xs text-muted-foreground">Accepted: {acceptedText}</p>
        </div>
        <input
          type="file"
          name="financialFiles"
          className="hidden"
          multiple
          accept={acceptedExtensions.join(",")}
          onChange={handleFileChange}
        />
      </label>

      {files.length > 0 ? (
        <div className="rounded-xl border border-border bg-muted/50 p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Files queued</p>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {files.map((file) => (
              <li key={file.name} className="flex items-center justify-between gap-3">
                <span className="truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-xs text-muted-foreground">
            Files upload after you confirm inside the reconciliation drawer.
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Need recurring imports? Set up automated feeds through your QuickBooks or Xero integration.</span>
        <Button variant="outline" size="sm" asChild>
          <a href="/admin/settings/integrations?service=quickbooks">Configure automations</a>
        </Button>
      </div>
    </div>
  )
}
