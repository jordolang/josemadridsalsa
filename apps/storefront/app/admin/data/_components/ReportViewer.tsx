import { AlertTriangle, Info } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import type { ReportResult, VizType } from '@/lib/data-studio/types'

import { ReportChart } from './ReportChart'
import { ReportKpis } from './ReportKpis'
import { ReportTable } from './ReportTable'

/**
 * One result, shown the way the spec asked for.
 *
 * Every view carries its provenance strip: which book the figures come from, which timezone the
 * buckets were cut in, and how many rows had no figure recorded. That is not decoration — a reader
 * comparing this to a filed return needs to know it is looking at the ledger and not the return, and
 * a tax-year total is meaningless without knowing which midnight it used.
 */
interface Props {
  result: ReportResult
  vizType: VizType
  emptyStateNote?: string
  printWidth?: number
}

const BASIS_LABEL: Record<ReportResult['meta']['basis'], string> = {
  ledger: 'Bookkeeping ledger',
  operational: 'Operational records',
  summary: 'Filed / attested figures',
  quickbooks: 'QuickBooks',
}

export function ReportViewer({ result, vizType, emptyStateNote, printWidth }: Props) {
  const unknownTotal = Object.values(result.meta.unknownCounts).reduce((sum, n) => sum + n, 0)
  const isEmpty = result.meta.rowsScanned === 0

  return (
    <div className="space-y-4">
      {result.meta.truncated && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This query matched more rows than can be totalled accurately, so the totals have been
            withheld rather than shown partially. Narrow the date range or add a filter.
          </AlertDescription>
        </Alert>
      )}

      {isEmpty && emptyStateNote && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>{emptyStateNote}</AlertDescription>
        </Alert>
      )}

      {vizType === 'kpi' && <ReportKpis result={result} />}
      {vizType === 'table' && <ReportTable result={result} />}
      {vizType !== 'kpi' && vizType !== 'table' && (
        <>
          <ReportChart result={result} vizType={vizType} printWidth={printWidth} />
          <ReportTable result={result} />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{BASIS_LABEL[result.meta.basis]}</Badge>
        <span>{result.meta.rowsScanned.toLocaleString('en-US')} rows read</span>
        <span aria-hidden>·</span>
        <span>Buckets cut in {result.meta.timezone}</span>
        {unknownTotal > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>{unknownTotal.toLocaleString('en-US')} values not recorded</span>
          </>
        )}
      </div>
    </div>
  )
}
