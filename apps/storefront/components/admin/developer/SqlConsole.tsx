'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Database, Download, Loader2, Play, Search, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const ROW_LIMITS = [50, 100, 200, 500, 1000] as const

interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
}

interface SchemaTable {
  name: string
  columns: SchemaColumn[]
}

interface ReadResult {
  status: 'ok'
  kind: 'read'
  command: string
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  truncated: boolean
  durationMs: number
}

interface PendingWrite {
  status: 'confirmation_required'
  kind: 'write'
  command: string
  affectedRows: number
  unscoped: boolean
  note?: string
  confirmation: string
  expiresAt: number
  durationMs: number
}

interface CommittedWrite {
  status: 'committed'
  kind: 'write'
  command: string
  affectedRows: number
  durationMs: number
}

type ConsoleResult = ReadResult | CommittedWrite

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [columns.join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\n')
}

export function SqlConsole() {
  const [sql, setSql] = useState('SELECT id, "orderNumber", status, total, "createdAt"\nFROM orders\nORDER BY "createdAt" DESC')
  const [limit, setLimit] = useState<number>(200)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ConsoleResult | null>(null)
  const [pendingWrite, setPendingWrite] = useState<PendingWrite | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tables, setTables] = useState<SchemaTable[]>([])
  const [schemaFilter, setSchemaFilter] = useState('')
  const [openTable, setOpenTable] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/developer/admin/sql')
      .then((response) => (response.ok ? response.json() : { tables: [] }))
      .then((data) => {
        if (!cancelled) setTables(data.tables ?? [])
      })
      .catch(() => {
        /* the reference panel is optional — the console still works without it */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const run = useCallback(
    async (confirmation?: string) => {
      setRunning(true)
      setError(null)
      if (!confirmation) {
        setResult(null)
        setPendingWrite(null)
      }

      try {
        const response = await fetch('/api/developer/admin/sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, limit, ...(confirmation ? { confirmation } : {}) }),
        })
        const data = await response.json()

        if (!response.ok) {
          setError(data.error ?? 'The statement could not be executed.')
          setPendingWrite(null)
          return
        }

        if (data.status === 'confirmation_required') {
          setPendingWrite(data as PendingWrite)
          return
        }

        setPendingWrite(null)
        setResult(data as ConsoleResult)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Request failed.')
      } finally {
        setRunning(false)
      }
    },
    [sql, limit]
  )

  const filteredTables = useMemo(() => {
    const needle = schemaFilter.trim().toLowerCase()
    if (!needle) return tables
    return tables.filter(
      (table) =>
        table.name.toLowerCase().includes(needle) ||
        table.columns.some((column) => column.name.toLowerCase().includes(needle))
    )
  }, [tables, schemaFilter])

  const downloadCsv = useCallback(() => {
    if (!result || result.kind !== 'read') return
    const blob = new Blob([toCsv(result.columns, result.rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `query-result-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [result])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Console
            </CardTitle>
            <CardDescription>
              One statement at a time. Reads run read-only and capped; inserts, updates and deletes
              are previewed against real data and rolled back until you confirm them. Schema changes
              belong in a migration and are refused here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={sql}
              onChange={(event) => setSql(event.target.value)}
              spellCheck={false}
              rows={10}
              className="font-mono text-sm"
              aria-label="SQL statement"
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault()
                  if (!running) void run()
                }
              }}
            />

            <div className="flex flex-wrap items-end gap-3">
              <Button onClick={() => void run()} disabled={running || sql.trim().length === 0}>
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Run statement
              </Button>

              <div className="space-y-1">
                <Label htmlFor="row-limit" className="text-xs text-muted-foreground">
                  Row limit
                </Label>
                <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
                  <SelectTrigger id="row-limit" className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROW_LIMITS.map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                ⌘/Ctrl + Enter runs. Every statement is written to the audit log.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="font-mono text-xs leading-relaxed">{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {result?.kind === 'read' && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">
                  {result.rowCount.toLocaleString()} {result.rowCount === 1 ? 'row' : 'rows'}
                </CardTitle>
                <CardDescription>
                  {result.command} · {result.durationMs} ms
                  {result.truncated ? ` · capped at ${limit} rows` : ''}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={downloadCsv} disabled={result.rowCount === 0}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </CardHeader>
            <CardContent>
              {result.rowCount === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No rows returned.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {result.columns.map((column) => (
                          <th key={column} className="whitespace-nowrap px-3 py-2 font-medium">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, index) => (
                        <tr key={index} className="border-t">
                          {result.columns.map((column) => (
                            <td key={column} className="max-w-xs truncate px-3 py-1.5 font-mono text-xs">
                              {renderCell(row[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {result?.kind === 'write' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                Committed
              </CardTitle>
              <CardDescription>
                {result.command} affected {result.affectedRows.toLocaleString()}{' '}
                {result.affectedRows === 1 ? 'row' : 'rows'} in {result.durationMs} ms.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Schema</CardTitle>
          <CardDescription>{tables.length} tables in the public schema.</CardDescription>
          <div className="pt-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={schemaFilter}
                onChange={(event) => setSchemaFilter(event.target.value)}
                placeholder="Filter tables and columns"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="max-h-[60vh] overflow-y-auto">
          <ul className="space-y-1 text-sm">
            {filteredTables.map((table) => (
              <li key={table.name}>
                <button
                  type="button"
                  onClick={() => setOpenTable(openTable === table.name ? null : table.name)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-muted"
                >
                  <span className="font-mono text-xs">{table.name}</span>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    {table.columns.length}
                  </Badge>
                </button>
                {openTable === table.name && (
                  <ul className="mb-2 ml-2 border-l pl-3 text-xs text-muted-foreground">
                    {table.columns.map((column) => (
                      <li key={column.name} className="py-0.5 font-mono">
                        {column.name}
                        <span className="ml-1 opacity-60">
                          {column.type}
                          {column.nullable ? '?' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            {filteredTables.length === 0 && (
              <li className="py-6 text-center text-muted-foreground">No matching tables.</li>
            )}
          </ul>
        </CardContent>
      </Card>

      <AlertDialog open={pendingWrite !== null} onOpenChange={(open) => !open && setPendingWrite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm {pendingWrite?.command}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Run against real data and rolled back: this statement would change{' '}
                  <strong>{pendingWrite?.affectedRows.toLocaleString()}</strong>{' '}
                  {pendingWrite?.affectedRows === 1 ? 'row' : 'rows'}. Confirming runs it again and
                  commits.
                </p>
                {pendingWrite?.unscoped && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive">
                    This {pendingWrite.command} has no WHERE clause — it affects every row in the table.
                  </p>
                )}
                {pendingWrite?.note && <p className="text-muted-foreground">{pendingWrite.note}</p>}
                <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">{sql}</pre>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const token = pendingWrite?.confirmation
                setPendingWrite(null)
                if (token) void run(token)
              }}
            >
              Commit {pendingWrite?.affectedRows.toLocaleString()}{' '}
              {pendingWrite?.affectedRows === 1 ? 'row' : 'rows'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
