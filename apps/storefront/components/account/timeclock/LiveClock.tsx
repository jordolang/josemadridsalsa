"use client";

import { useEffect, useRef, useState } from "react";
import { TIMECLOCK_TIMEZONE } from "@/lib/timeclock";

/**
 * The clock repaints ~25 times a second, so it is deliberately isolated in its
 * own component — nothing else on the page re-renders with it.
 */

const TICK_MS = 40;

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMECLOCK_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMECLOCK_TIMEZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const zoneFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMECLOCK_TIMEZONE,
  timeZoneName: "short",
});

function zoneAbbreviation(date: Date): string {
  return zoneFormatter.formatToParts(date).find(p => p.type === "timeZoneName")?.value ?? "";
}

/**
 * A ticking wall clock, offset onto the server's time so what a user sees
 * matches what a punch will actually record. Purely a display — the recorded
 * timestamp always comes from the server.
 */
export function LiveClock({ serverTime }: { serverTime: string }) {
  const offsetRef = useRef(0);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    offsetRef.current = new Date(serverTime).getTime() - Date.now();
  }, [serverTime]);

  useEffect(() => {
    let frame = 0;
    let last = 0;

    const loop = (timestamp: number) => {
      if (timestamp - last >= TICK_MS) {
        last = timestamp;
        setNow(new Date(Date.now() + offsetRef.current));
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Render nothing time-dependent until mounted, so the server-rendered markup
  // and the first client paint agree.
  if (!now) {
    return (
      <div className="font-mono text-4xl tabular-nums tracking-tight sm:text-5xl">--:--:--.---</div>
    );
  }

  const parts = timeFormatter.formatToParts(now);
  const read: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") read[part.type] = part.value;
  }
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

  return (
    <div>
      <div className="font-mono text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
        {read.hour}:{read.minute}:{read.second}
        <span className="text-2xl text-muted-foreground sm:text-3xl">.{milliseconds}</span>
        <span className="ml-2 text-xl text-muted-foreground sm:text-2xl">{read.dayPeriod}</span>
      </div>
      <div className="mt-1 text-sm text-muted-foreground">
        {dateFormatter.format(now)} · {zoneAbbreviation(now)}
      </div>
    </div>
  );
}

/** Elapsed time on an open shift, refreshed once a second. */
export function ElapsedTimer({ since }: { since: string }) {
  const startedAt = new Date(since).getTime();
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setElapsed(Date.now() - startedAt);
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (elapsed === null) return <span className="font-mono tabular-nums">--:--:--</span>;

  const seconds = Math.max(0, Math.floor(elapsed / 1000));
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <span className="font-mono tabular-nums">
      {hh}:{mm}:{ss}
    </span>
  );
}
