import { Download, FileArchive, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const DOWNLOAD_DIR = '/fundraising/downloads'

const ORDER_FORMS = [
  { href: `${DOWNLOAD_DIR}/2026-Fundraiser-Kit-25-Flavors.zip`, label: '2026 fundraiser kit: 25 flavors', meta: 'ZIP, 2.5 MB' },
  { href: `${DOWNLOAD_DIR}/2026-Fundraiser-Kit-16-Flavors.zip`, label: '2026 fundraiser kit: 16 flavors', meta: 'ZIP, 3.2 MB' },
  { href: `${DOWNLOAD_DIR}/2026-Fundraiser-Kit-9-Flavors.zip`, label: '2026 fundraiser kit: 9 flavors', meta: 'ZIP, 2.5 MB' },
] as const

const FLIERS = [
  { href: `${DOWNLOAD_DIR}/sample-flier-2023.pdf`, label: 'Sample flier', meta: 'PDF, 277 KB' },
  { href: `${DOWNLOAD_DIR}/flyer-template.pdf`, label: 'Flier template', meta: 'PDF, 382 KB' },
] as const

function DownloadLink({ href, label, meta, zip }: { href: string; label: string; meta: string; zip?: boolean }) {
  const Icon = zip ? FileArchive : FileText
  return (
    <a
      href={href}
      download
      className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-salsa-400 hover:bg-salsa-50"
    >
      <Icon className="h-5 w-5 shrink-0 text-salsa-600" aria-hidden />
      <span className="flex-1 font-medium text-foreground">
        {label} <span className="text-sm font-normal text-muted-foreground">({meta})</span>
      </span>
      <Download className="h-4 w-4 text-muted-foreground" aria-hidden />
    </a>
  )
}

/** Order form packs and fliers, shown on the home page and the start page. */
export function FundraiserDownloads({ className }: { className?: string }) {
  return (
    <section className={cn('py-14', className)}>
      <div className="container mx-auto grid gap-10 px-4 lg:grid-cols-2">
        <div>
          <h2 className="font-serif text-2xl font-bold text-foreground">Order form packs</h2>
          <p className="mt-2 text-muted-foreground">Each button downloads a zip file with the forms for that sale.</p>
          <div className="mt-5 space-y-3">
            {ORDER_FORMS.map((file) => (
              <DownloadLink key={file.href} {...file} zip />
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-serif text-2xl font-bold text-foreground">Fliers</h2>
          <p className="mt-2 text-muted-foreground">Print them, post them, or share them with your supporters.</p>
          <div className="mt-5 space-y-3">
            {FLIERS.map((file) => (
              <DownloadLink key={file.href} {...file} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
