import { Badge } from '@/components/ui/badge'

/** Status choices shared by every CMS resource form. */
export const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PUBLISHED: 'default',
  SCHEDULED: 'secondary',
  DRAFT: 'outline',
  ARCHIVED: 'destructive',
}

const LABELS: Record<string, string> = {
  PUBLISHED: 'Published',
  SCHEDULED: 'Scheduled',
  DRAFT: 'Draft',
  ARCHIVED: 'Archived',
}

export function statusBadge(row: Record<string, unknown>) {
  const status = String(row.status ?? 'DRAFT')
  return <Badge variant={VARIANTS[status] ?? 'outline'}>{LABELS[status] ?? status}</Badge>
}
