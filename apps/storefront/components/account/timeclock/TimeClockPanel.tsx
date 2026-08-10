"use client";

import { Fragment, useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  formatBusinessTime,
  formatDayLabel,
  formatDecimalHours,
  formatDuration,
  parseDateInput,
  sumDayPayrollHours,
} from "@/lib/timeclock";
import type { TimeClockView } from "@/lib/timeclock-server";
import { ElapsedTimer, LiveClock } from "./LiveClock";

/**
 * Format digits as the user types them, so `08012026` becomes `08/01/2026`
 * without the user ever reaching for a date picker.
 */
function maskDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function time(iso: string): string {
  return formatBusinessTime(new Date(iso));
}

export function TimeClockPanel({ initialView }: { initialView: TimeClockView }) {
  const [view, setView] = useState(initialView);
  const [start, setStart] = useState(initialView.range.start);
  const [end, setEnd] = useState(initialView.range.end);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [clockOutOpen, setClockOutOpen] = useState(false);

  const rangeIsValid = parseDateInput(start) !== null && parseDateInput(end) !== null;

  const load = useCallback(async (from: string, to: string) => {
    const params = new URLSearchParams({ start: from, end: to });
    const response = await fetch(`/api/account/timeclock?${params}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error ?? "Failed to load timeclock");
    return data as TimeClockView;
  }, []);

  const applyRange = useCallback(async () => {
    if (!rangeIsValid) return;
    setBusy(true);
    setError(null);
    try {
      const next = await load(start, end);
      setView(next);
      // The server clamps to the allowed window — reflect what it actually used.
      setStart(next.range.start);
      setEnd(next.range.end);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load timeclock");
    } finally {
      setBusy(false);
    }
  }, [end, load, rangeIsValid, start]);

  const punch = useCallback(
    async (url: string, body?: unknown) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Something went wrong");
        setView(await load(start, end));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [end, load, start]
  );

  const clockIn = () => punch("/api/account/timeclock");

  const confirmClockOut = async () => {
    const succeeded = await punch("/api/account/timeclock/clock-out", {
      notes: notes.trim() || undefined,
    });
    if (succeeded) {
      setClockOutOpen(false);
      setNotes("");
    }
  };

  const onClock = view.openEntry !== null;
  // Summed from the day rows on screen, so the column reconciles.
  const periodHours = sumDayPayrollHours(view.days);

  return (
    <div className="grid gap-6">
      <Card className="p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <LiveClock serverTime={view.serverTime} />

          <div className="flex flex-col items-start gap-3 sm:items-end">
            {onClock ? (
              <>
                <Badge className="bg-verde-600 hover:bg-verde-600">On the clock</Badge>
                <div className="text-sm text-muted-foreground">
                  Since {time(view.openEntry!.clockInAt)} · <ElapsedTimer since={view.openEntry!.clockInAt} />
                </div>
                <Button
                  size="lg"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setClockOutOpen(true)}
                >
                  Clock Out (End Shift)
                </Button>
              </>
            ) : (
              <>
                <Badge variant="secondary">Off the clock</Badge>
                <div className="text-sm text-muted-foreground">Not currently clocked in</div>
                <Button size="lg" disabled={busy} onClick={clockIn}>
                  Clock In (Start Shift)
                </Button>
              </>
            )}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <p className="mt-4 text-xs text-muted-foreground">
          Punch times are recorded by the server and cannot be edited afterwards. Your IP address is
          logged with every punch. Clocking out for lunch and back in is fine — each pair is timed
          separately and the day&apos;s total adds up.
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-medium">Pay Period</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Type any dates between {view.bounds.earliest} and {view.bounds.latest}.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="timeclock-start">Start date</Label>
            <Input
              id="timeclock-start"
              value={start}
              onChange={e => setStart(maskDateInput(e.target.value))}
              onKeyDown={e => {
                if (e.key === "Enter") applyRange();
              }}
              placeholder="MM/DD/YYYY"
              inputMode="numeric"
              autoComplete="off"
              className="w-40 font-mono"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="timeclock-end">End date</Label>
            <Input
              id="timeclock-end"
              value={end}
              onChange={e => setEnd(maskDateInput(e.target.value))}
              onKeyDown={e => {
                if (e.key === "Enter") applyRange();
              }}
              placeholder="MM/DD/YYYY"
              inputMode="numeric"
              autoComplete="off"
              className="w-40 font-mono"
            />
          </div>
          <Button variant="secondary" disabled={busy || !rangeIsValid} onClick={applyRange}>
            Apply
          </Button>
          {!rangeIsValid ? (
            <p className="text-sm text-red-600">Enter both dates as MM/DD/YYYY.</p>
          ) : null}
        </div>

        <Separator className="my-6" />

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total for period
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums">
              {periodHours.toFixed(2)} hrs
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {formatDuration(periodHours * 3_600_000)}
          </div>
          <div className="text-sm text-muted-foreground">
            {view.days.length} day{view.days.length === 1 ? "" : "s"} worked
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-medium">Work History</h2>

        {view.days.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No punches recorded between {view.range.start} and {view.range.end}.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Notes / Job Duties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.days.map(day => (
                  <Fragment key={day.dayKey}>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={4} className="font-medium">
                        {formatDayLabel(day.dayKey)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium tabular-nums">
                        {formatDecimalHours(day.totalMs)} hrs
                      </TableCell>
                    </TableRow>
                    {day.entries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono tabular-nums">
                          {time(entry.clockInAt)}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {entry.clockOutAt ? (
                            time(entry.clockOutAt)
                          ) : (
                            <span className="text-amber-600">In progress</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {entry.clockOutAt ? formatDecimalHours(entry.durationMs) : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {entry.clockInIp ?? "—"}
                          {entry.clockOutIp && entry.clockOutIp !== entry.clockInIp
                            ? ` → ${entry.clockOutIp}`
                            : ""}
                        </TableCell>
                        <TableCell className="max-w-xs whitespace-pre-wrap text-sm">
                          {entry.notes ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={clockOutOpen} onOpenChange={open => !busy && setClockOutOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clock Out</DialogTitle>
            <DialogDescription>
              Record what you worked on during this shift. Notes cannot be changed once you clock
              out.
            </DialogDescription>
          </DialogHeader>

          {view.openEntry ? (
            <div className="text-sm text-muted-foreground">
              Clocked in at {time(view.openEntry.clockInAt)} ·{" "}
              <ElapsedTimer since={view.openEntry.clockInAt} /> elapsed
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="timeclock-notes">Notes / Job Duties</Label>
            <Textarea
              id="timeclock-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Packed and shipped web orders, restocked jar inventory"
              rows={5}
              maxLength={2000}
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button variant="secondary" disabled={busy} onClick={() => setClockOutOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={confirmClockOut}>
              {busy ? "Clocking out…" : "Clock Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
