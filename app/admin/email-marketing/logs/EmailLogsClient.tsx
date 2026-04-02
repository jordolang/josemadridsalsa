'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, RefreshCw, ChevronLeft, ChevronRight, Mail, AlertCircle, CheckCircle, MousePointerClick, Eye } from 'lucide-react'
import { format } from 'date-fns'

interface EmailLog {
  id: string
  recipientEmail: string
  recipientName: string | null
  subject: string
  status: string
  from: string | null
  sentAt: string | null
  openedAt: string | null
  clickedAt: string | null
  failedAt: string | null
  bouncedAt: string | null
  errorMessage: string | null
  createdAt: string
}

interface LogsResponse {
  logs: EmailLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  SENDING: 'bg-blue-100 text-blue-800',
  SENT: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  BOUNCED: 'bg-orange-100 text-orange-800',
  OPENED: 'bg-purple-100 text-purple-800',
  CLICKED: 'bg-indigo-100 text-indigo-800',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  SENT: <CheckCircle className="h-3 w-3" />,
  FAILED: <AlertCircle className="h-3 w-3" />,
  BOUNCED: <AlertCircle className="h-3 w-3" />,
  OPENED: <Eye className="h-3 w-3" />,
  CLICKED: <MousePointerClick className="h-3 w-3" />,
  SENDING: <Mail className="h-3 w-3" />,
  PENDING: <Mail className="h-3 w-3" />,
}

export function EmailLogsClient() {
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [searchInput, setSearchInput] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        ...(search ? { search } : {}),
        ...(status !== 'ALL' ? { status } : {}),
      })
      const res = await fetch(`/api/admin/email-logs?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data: LogsResponse = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleStatusChange = (val: string) => {
    setStatus(val)
    setPage(1)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return format(new Date(dateStr), 'MMM d, yyyy h:mm a')
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-2 flex-1 min-w-[240px]">
              <Input
                placeholder="Search email or subject..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="max-w-xs"
              />
              <Button variant="outline" onClick={handleSearch} size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SENDING">Sending</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="OPENED">Opened</SelectItem>
                <SelectItem value="CLICKED">Clicked</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="BOUNCED">Bounced</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <span className="text-sm text-muted-foreground ml-auto">
              {total.toLocaleString()} total logs
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Email Send History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Clicked</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No email logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{log.recipientEmail}</p>
                          {log.recipientName && (
                            <p className="text-xs text-muted-foreground">{log.recipientName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-sm truncate" title={log.subject}>{log.subject}</p>
                        {log.from && (
                          <p className="text-xs text-muted-foreground truncate">From: {log.from}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`gap-1 text-xs ${STATUS_COLORS[log.status] || 'bg-gray-100 text-gray-800'}`}
                          variant="secondary"
                        >
                          {STATUS_ICONS[log.status]}
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.sentAt || log.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.openedAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.clickedAt)}
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        {log.errorMessage ? (
                          <p className="text-xs text-red-600 truncate" title={log.errorMessage}>
                            {log.errorMessage}
                          </p>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
