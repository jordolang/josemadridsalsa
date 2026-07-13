'use client'

import { useState } from 'react'
import { ExternalLink, QrCode, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/fundraising/copy-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface ReferralLinkDisplayProps {
  url: string
  code: string
  participantName?: string
  variant?: 'default' | 'compact' | 'card'
  showQRCode?: boolean
  showExternalLink?: boolean
}

export function ReferralLinkDisplay({
  url,
  code,
  participantName,
  variant = 'default',
  showQRCode = true,
  showExternalLink = true,
}: ReferralLinkDisplayProps) {
  const [qrDialogOpen, setQrDialogOpen] = useState(false)

  // Generate QR code URL using a free QR code API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: participantName
            ? `Support ${participantName}'s Fundraiser`
            : 'Fundraiser Referral Link',
          text: participantName
            ? `Support ${participantName} by ordering through this link!`
            : 'Support this fundraiser by ordering through this link!',
          url,
        })
      } catch (error) {
        // User cancelled share or share failed
        if (error instanceof Error && error.name !== 'AbortError') {
          toast.error('Share failed', { description: 'Unable to share link' })
        }
      }
    } else {
      // Fallback to copy
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied!', { description: 'Referral link copied to clipboard' })
      } catch (error) {
        toast.error('Failed to copy', { description: 'Please copy manually' })
      }
    }
  }

  // Compact variant - single line with buttons
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={url}
          className="flex-1 rounded border bg-slate-50 px-3 py-2 text-sm font-mono"
        />
        <CopyButton text={url} label="Referral URL" />
        {showExternalLink && (
          <Button
            size="sm"
            variant="outline"
            asChild
            title="Open URL"
          >
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
        {showQRCode && (
          <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" title="Show QR Code">
                <QrCode className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>QR Code</DialogTitle>
                <DialogDescription>
                  Scan this QR code to open the referral link
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center space-y-4">
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  className="rounded-lg border"
                  width={300}
                  height={300}
                />
                <p className="text-center text-sm text-slate-600 font-mono break-all">
                  {url}
                </p>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    )
  }

  // Card variant - full card display
  if (variant === 'card') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shareable Referral Link</CardTitle>
          <CardDescription>
            {participantName
              ? `Share this link so supporters can order and ${participantName} gets credit`
              : 'Share this link so supporters can order and you get credit'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Referral Code</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-slate-100 px-3 py-2 font-mono text-sm">
                {code}
              </code>
              <CopyButton text={code} label="Referral code" />
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Full URL</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={url}
                className="flex-1 rounded border bg-slate-50 px-3 py-2 text-sm font-mono"
              />
              <CopyButton text={url} label="Referral URL" />
            </div>
          </div>
          <div className="flex gap-2">
            {showExternalLink && (
              <Button variant="outline" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Link
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            {showQRCode && (
              <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <QrCode className="mr-2 h-4 w-4" />
                    Show QR Code
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>QR Code</DialogTitle>
                    <DialogDescription>
                      Scan this QR code to open the referral link
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col items-center space-y-4">
                    <img
                      src={qrCodeUrl}
                      alt="QR Code"
                      className="rounded-lg border"
                      width={300}
                      height={300}
                    />
                    <p className="text-center text-sm text-slate-600 font-mono break-all px-4">
                      {url}
                    </p>
                    <div className="flex gap-2">
                      <CopyButton text={url} label="URL" size="default" />
                      <Button variant="outline" asChild>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open
                        </a>
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Default variant - simple display with code and URL
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm text-slate-600">Referral Code</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-slate-100 px-3 py-2 font-mono text-sm">
            {code}
          </code>
          <CopyButton text={code} label="Referral code" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm text-slate-600">Referral URL</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={url}
            className="flex-1 rounded border bg-slate-50 px-3 py-2 text-sm font-mono"
          />
          <CopyButton text={url} label="Referral URL" />
          {showExternalLink && (
            <Button
              size="sm"
              variant="outline"
              asChild
              title="Open URL"
            >
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          {showQRCode && (
            <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" title="Show QR Code">
                  <QrCode className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>QR Code</DialogTitle>
                  <DialogDescription>
                    Scan this QR code to open the referral link
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center space-y-4">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    className="rounded-lg border"
                    width={300}
                    height={300}
                  />
                  <p className="text-center text-sm text-slate-600 font-mono break-all px-4">
                    {url}
                  </p>
                  <div className="flex gap-2">
                    <CopyButton text={url} label="URL" size="default" />
                    <Button variant="outline" asChild>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open
                      </a>
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  )
}
