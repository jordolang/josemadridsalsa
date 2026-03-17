/**
 * Minimal ICS (iCalendar) parser for Jose Madrid Salsa event schedule.
 *
 * Reads the local .ics file, extracts VEVENT blocks, filters to
 * upcoming public events with real physical locations, and returns
 * the same ScheduleEvent shape used by the Google Calendar integration.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ScheduleEvent } from './google-calendar';

// ──────────────────────────────────────────────────────────────────────────────
// ICS line unfolding + property parsing
// ──────────────────────────────────────────────────────────────────────────────

/** RFC 5545 §3.1 — fold continuation lines into a single logical line. */
function unfold(raw: string): string[] {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '') // remove fold
    .split('\n');
}

interface ICSProp {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): ICSProp | null {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;

  const rawName = line.slice(0, colonIdx);
  const value = unescapeValue(line.slice(colonIdx + 1));

  // Split "DTSTART;TZID=America/New_York" → name="DTSTART", params={TZID:...}
  const parts = rawName.split(';');
  const name = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq !== -1) {
      params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1);
    } else {
      params[parts[i].toUpperCase()] = '';
    }
  }
  return { name, params, value };
}

/** RFC 5545 text escaping: \n → newline, \, → comma, \; → semicolon, \\ → backslash */
function unescapeValue(val: string): string {
  return val
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// ──────────────────────────────────────────────────────────────────────────────
// Date parsing
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Parse DTSTART / DTEND values into an ISO string (or null).
 * Handles:
 *   VALUE=DATE          → "20260324"          → "2026-03-24"
 *   TZID=...            → "20260327T100000"   → local-aware ISO string
 *   (implicit UTC)      → "20260219T124000Z"  → UTC ISO string
 */
function parseICSDate(value: string, params: Record<string, string>): { iso: string; isAllDay: boolean } | null {
  if (!value) return null;

  // All-day date: VALUE=DATE or pure 8-digit string
  if (params['VALUE'] === 'DATE' || /^\d{8}$/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return { iso: `${y}-${m}-${d}`, isAllDay: true };
  }

  // Date-time
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!match) return null;

  const [, yr, mo, dy, hr, mi, sc, utc] = match;

  if (utc === 'Z') {
    return { iso: `${yr}-${mo}-${dy}T${hr}:${mi}:${sc}Z`, isAllDay: false };
  }

  // Timezone-aware: just build an ISO string with a colon-separated time.
  // For display purposes, the exact TZ offset doesn't matter much, and
  // adding the TZID string isn't valid ISO; just treat as local naive.
  return { iso: `${yr}-${mo}-${dy}T${hr}:${mi}:${sc}`, isAllDay: false };
}

// ──────────────────────────────────────────────────────────────────────────────
// Filtering helpers
// ──────────────────────────────────────────────────────────────────────────────

const VIRTUAL_LOCATION_PATTERNS = [
  /zoom\.us/i,
  /teams\.microsoft\.com/i,
  /meet\.google\.com/i,
  /webex\.com/i,
  /^https?:\/\//i,
  /^phone/i,
  /^zoom$/i,
  /^microsoft teams meeting$/i,
  /^i will call/i,
];

function isVirtualLocation(location: string): boolean {
  return VIRTUAL_LOCATION_PATTERNS.some((re) => re.test(location.trim()));
}

const SKIP_TITLE_PREFIXES = [
  'stay at ',
  'deadline',
  'apply ',
  'applied ',
  'mindy off',
  'stan off',
  'sean off',
  "mike's birthday",
  'reserve ',
  'do folders',
  'recently posted',
  'fda updates',
  'safeguard your',
];

const SKIP_TITLE_EXACT = new Set([
  'end',
  'mindy off',
  'stan off',
  'sean off',
]);

function shouldSkipTitle(title: string): boolean {
  const lower = title.toLowerCase().trim();
  if (SKIP_TITLE_EXACT.has(lower)) return true;
  return SKIP_TITLE_PREFIXES.some((p) => lower.startsWith(p));
}

// ──────────────────────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────────────────────

export function parseICSFile(filePath: string): ScheduleEvent[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = unfold(raw);

  const events: ScheduleEvent[] = [];
  let inEvent = false;
  let props: Record<string, ICSProp> = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      props = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      inEvent = false;

      const summary = props['SUMMARY']?.value ?? '';
      const classVal = (props['CLASS']?.value ?? '').toUpperCase();
      const location = props['LOCATION']?.value ?? null;
      const description = props['DESCRIPTION']?.value ?? null;
      const uid = props['UID']?.value ?? Math.random().toString(36);

      // Skip private events
      if (classVal === 'PRIVATE') {
        continue;
      }

      // Skip events with titles that are clearly not public show events
      if (shouldSkipTitle(summary)) {
        continue;
      }

      // Must have a real physical location
      if (!location || isVirtualLocation(location)) {
        continue;
      }

      const startProp = props['DTSTART'];
      const endProp = props['DTEND'];
      if (!startProp) continue;

      const startParsed = parseICSDate(startProp.value, startProp.params);
      if (!startParsed) continue;

      const endParsed = endProp ? parseICSDate(endProp.value, endProp.params) : null;

      events.push({
        id: uid,
        title: summary || 'Event',
        start: startParsed.iso,
        end: endParsed?.iso ?? null,
        location,
        description,
        link: null,
        isAllDay: startParsed.isAllDay,
      });

      continue;
    }

    if (inEvent) {
      const parsed = parseLine(line);
      if (parsed) {
        // Keep only first occurrence of each property (ignore RECURRENCE-ID overrides for simplicity)
        if (!props[parsed.name]) {
          props[parsed.name] = parsed;
        }
      }
    }
  }

  // ── Filter to upcoming events only ──────────────────────────────────────────
  const nowIso = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  const upcoming = events.filter((ev) => {
    if (!ev.start) return false;
    // Compare date prefix only — works for both all-day and timed events
    const startDate = ev.start.slice(0, 10);
    return startDate >= nowIso;
  });

  // Sort ascending by start date
  upcoming.sort((a, b) => {
    const as = a.start ?? '';
    const bs = b.start ?? '';
    return as < bs ? -1 : as > bs ? 1 : 0;
  });

  return upcoming;
}

export function getICSFilePath(): string {
  return path.join(process.cwd(), 'data', 'mike@josemadridsalsa.ics');
}
