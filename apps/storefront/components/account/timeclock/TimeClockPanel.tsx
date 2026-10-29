"use client";

import { Fragment, useCallback, useState } from "react";
import { Pencil } from "lucide-react";
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
  businessCalendarDate,
  businessDayKey,
  formatBusinessDateTimeInput,
  formatBusinessTime,
  formatDayLabel,
  formatDateInput,
  formatDecimalHours,
  formatDuration,
  formatPunchLocation,
  parseDateInput,
  punchLocationMapUrl,
  sumDayPayrollHours,
  type PunchLocation,
} from "@/lib/timeclock";
import type { SerializedPunch, TimeClockView } from "@/lib/timeclock-server";
import { getPunchLocation } from "./getPunchLocation";
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

function LocationLink({ location }: { location: PunchLocation | null }) {
  if (!location) return <span>—</span>;
  return (
    <a
      href={punchLocationMapUrl(location)}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:text-foreground"
    >
      {formatPunchLocation(location)}
    </a>
  );
}

export function TimeClockPanel({
  initialView,
  canEditClockOut = false,
}: {
  initialView: TimeClockView;
  /** Developer accounts may correct the clock-out time of their own punches. */
  canEditClockOut?: boolean;
}) {
  const [view, setView] = useState(initialView);
  const [start, setStart] = useState(initialView.range.start);
  const [end, setEnd] = useState(initialView.range.end);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const [editing, setEditing] = useState<SerializedPunch | null>(null);
  const [editClockOut, setEditClockOut] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [newPeriodOpen, setNewPeriodOpen] = useState(false);
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodError, setNewPeriodError] = useState<string | null>(null);

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
    async (url: string, body?: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        setLocating(true);
        const location = await getPunchLocation();
        setLocating(false);
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, location: location ?? undefined }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Something went wrong");
        setView(await load(start, end));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        return false;
      } finally {
        setLocating(false);
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

  const openEditClockOut = (entry: SerializedPunch) => {
    setEditing(entry);
    setEditClockOut(
      formatBusinessDateTimeInput(entry.clockOutAt ? new Date(entry.clockOutAt) : new Date())
    );
    setEditReason("");
    setEditError(null);
  };

  const saveClockOut = async () => {
    if (!editing) return;
    setBusy(true);
    setEditError(null);
    try {
      const response = await fetch(`/api/account/timeclock/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clockOutAt: editClockOut, reason: editReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to update clock-out");
      setView(await load(start, end));
      setEditing(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to update clock-out");
    } finally {
      setBusy(false);
    }
  };

  const today = () => formatDateInput(businessCalendarDate(new Date()));

  const openNewPeriod = () => {
    setNewPeriodStart(today());
    setNewPeriodError(null);
    setNewPeriodOpen(true);
  };

  const startNewPeriod = async () => {
    setBusy(true);
    setNewPeriodError(null);
    try {
      const response = await fetch("/api/account/timeclock/pay-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: newPeriodStart }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to start pay period");
      // Show the new period from its first day through today.
      const next = await load(data.start, today());
      setView(next);
      setStart(next.range.start);
      setEnd(next.range.end);
      setNewPeriodOpen(false);
    } catch (e) {
      setNewPeriodError(e instanceof Error ? e.message : "Failed to start pay period");
    } finally {
      setBusy(false);
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
                  {locating ? "Getting location…" : "Clock In (Start Shift)"}
                </Button>
              </>
            )}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <p className="mt-4 text-xs text-muted-foreground">
          Punch times are recorded by the server and cannot be edited afterwards. Your IP address and,
          if you allow it, your device&apos;s location are logged with every punch. Clocking out for lunch and back in is fine — each pair is timed
          separately and the day&apos;s total adds up.
        </p>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Pay Period</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {view.payPeriodStart
                ? `Current pay period started ${view.payPeriodStart} and runs until you start a new one.`
                : "No pay period started yet, so all of your hours are shown."}{" "}
              All punches are kept; type any dates between {view.bounds.earliest} and{" "}
              {view.bounds.latest} to look back.
            </p>
          </div>
          <Button variant="outline" disabled={busy} onClick={openNewPeriod}>
            Start new pay period
          </Button>
        </div>

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
                  <TableHead>Location</TableHead>
                  <TableHead>Notes / Job Duties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.days.map(day => (
                  <Fragment key={day.dayKey}>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={5} className="font-medium">
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
                          <div className="flex items-center gap-1">
                            {entry.clockOutAt ? (
                              time(entry.clockOutAt)
                            ) : (
                              <span className="text-amber-600">In progress</span>
                            )}
                            {canEditClockOut ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                aria-label="Edit clock-out time"
                                disabled={busy}
                                onClick={() => openEditClockOut(entry)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            ) : null}
                          </div>
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
                        <TableCell className="text-xs text-muted-foreground">
                          <div>
                            In: <LocationLink location={entry.clockInLocation} />
                          </div>
                          {entry.clockOutAt ? (
                            <div>
                              Out: <LocationLink location={entry.clockOutLocation} />
                            </div>
                          ) : null}
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

      <Dialog open={editing !== null} onOpenChange={open => !busy && !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Clock-Out Time</DialogTitle>
            <DialogDescription>
              Times are Zanesville time. The change and your reason are saved to the audit log.
            </DialogDescription>
          </DialogHeader>

          {editing ? (
            <div className="text-sm text-muted-foreground">
              {formatDayLabel(businessDayKey(new Date(editing.clockInAt)))}{" "}
              · clocked in at {time(editing.clockInAt)}
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="timeclock-edit-clock-out">Clock out</Label>
            <Input
              id="timeclock-edit-clock-out"
              type="datetime-local"
              value={editClockOut}
              onChange={e => setEditClockOut(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="timeclock-edit-reason">Reason for correction</Label>
            <Input
              id="timeclock-edit-reason"
              value={editReason}
              onChange={e => setEditReason(e.target.value)}
              placeholder="e.g. Forgot to clock out"
              maxLength={500}
            />
          </div>

          {editError ? <p className="text-sm text-red-600">{editError}</p> : null}

          <DialogFooter>
            <Button variant="secondary" disabled={busy} onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !editClockOut || editReason.trim().length < 3}
              onClick={saveClockOut}
            >
              {busy ? "Saving…" : "Save clock-out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newPeriodOpen} onOpenChange={open => !busy && setNewPeriodOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Pay Period</DialogTitle>
            <DialogDescription>
              The new period runs from this day until you start the next one. Earlier punches are
              kept and can still be viewed.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="timeclock-new-period">First day of the period</Label>
            <Input
              id="timeclock-new-period"
              value={newPeriodStart}
              onChange={e => setNewPeriodStart(maskDateInput(e.target.value))}
              placeholder="MM/DD/YYYY"
              inputMode="numeric"
              autoComplete="off"
              className="w-40 font-mono"
            />
          </div>

          {newPeriodError ? <p className="text-sm text-red-600">{newPeriodError}</p> : null}

          <DialogFooter>
            <Button variant="secondary" disabled={busy} onClick={() => setNewPeriodOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || parseDateInput(newPeriodStart) === null}
              onClick={startNewPeriod}
            >
              {busy ? "Starting…" : "Start pay period"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {locating ? "Getting location…" : busy ? "Clocking out…" : "Clock Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
