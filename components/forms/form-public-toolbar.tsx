'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, FileType2, Printer } from 'lucide-react'

type FormPublicToolbarProps = {
  html: string
  title: string
}

export function FormPublicToolbar({ html, title }: FormPublicToolbarProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(html)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    link.href = url
    link.download = `${safeName}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=960,height=800')
    if (!printWindow) {
      return
    }
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={handleCopy}>
        <FileType2 className="mr-2 h-4 w-4" />
        {copied ? 'Copied!' : 'Copy HTML'}
      </Button>
      <Button variant="outline" onClick={handleDownload}>
        <Download className="mr-2 h-4 w-4" />
        Download
      </Button>
      <Button onClick={handlePrint}>
        <Printer className="mr-2 h-4 w-4" />
        Print now
      </Button>
    </div>
  )
}
