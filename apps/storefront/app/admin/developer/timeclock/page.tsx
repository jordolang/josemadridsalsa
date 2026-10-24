import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Clock } from 'lucide-react'
import { getCurrentUser, isDeveloper } from '@/lib/rbac'
import { loadDeveloperTimeclock } from '@/lib/timeclock-developer'
import {
  businessDayKey,
  formatBusinessDateTimeInput,
  formatBusinessTime,
  formatDayLabel,
  formatDecimalHours,
  punchDurationMs,
} from '@/lib/timeclock'
import EditPunchDialog from '@/components/admin/timeclock/EditPunchDialog'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Timeclock - Developer Console - Jose Madrid Salsa Admin',
  description: 'Review and correct staff timeclock punches.',
  pathname: '/admin/developer/timeclock',
})

function param(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export default async function DeveloperTimeclockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  // Punch corrections are held to developer accounts, not just console access.
  if (!user || !isDeveloper(user)) {
    redirect('/admin/developer')
  }

  const query = await searchParams
  const view = await loadDeveloperTimeclock({
    userId: param(query.user),
    startInput: param(query.start),
    endInput: param(query.end),
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timeclock
          </CardTitle>
          <CardDescription>
            Every employee&apos;s punches. Times are Zanesville time; each correction needs a
            reason and is saved to the audit log. Dates between {view.bounds.earliest} and{' '}
            {view.bounds.latest}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="timeclock-employee">Employee</Label>
              <select
                id="timeclock-employee"
                name="user"
                defaultValue={view.selectedUserId ?? ''}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All employees</option>
                {view.employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="timeclock-start">Start date</Label>
              <Input
                id="timeclock-start"
                name="start"
                defaultValue={view.range.start}
                placeholder="MM/DD/YYYY"
                className="w-36 font-mono"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="timeclock-end">End date</Label>
              <Input
                id="timeclock-end"
                name="end"
                defaultValue={view.range.end}
                placeholder="MM/DD/YYYY"
                className="w-36 font-mono"
              />
            </div>
            <Button type="submit" variant="secondary">
              Apply
            </Button>
          </form>

          {view.totals.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {view.totals.map((total) => (
                <div key={total.employeeId}>
                  <span className="text-muted-foreground">{total.name}:</span>{' '}
                  <span className="font-mono font-medium tabular-nums">
                    {formatDecimalHours(total.totalMs)} hrs
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {view.punches.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No punches between {view.range.start} and {view.range.end}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead>Job duties</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.punches.map((punch) => (
                    <TableRow key={punch.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {punch.employee.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDayLabel(businessDayKey(punch.clockInAt))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono tabular-nums">
                        {formatBusinessTime(punch.clockInAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono tabular-nums">
                        {punch.clockOutAt ? (
                          formatBusinessTime(punch.clockOutAt)
                        ) : (
                          <Badge variant="outline">On the clock</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {punch.clockOutAt ? formatDecimalHours(punchDurationMs(punch)) : '—'}
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-pre-wrap text-muted-foreground">
                        {punch.notes ?? '—'}
                      </TableCell>
                      <TableCell>
                        <EditPunchDialog
                          punchId={punch.id}
                          employeeName={punch.employee.name}
                          clockInAt={formatBusinessDateTimeInput(punch.clockInAt)}
                          clockOutAt={
                            punch.clockOutAt ? formatBusinessDateTimeInput(punch.clockOutAt) : null
                          }
                          notes={punch.notes}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
