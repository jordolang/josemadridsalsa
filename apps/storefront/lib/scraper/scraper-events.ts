/**
 * In-memory event log for scraper activity, with SSE broadcast support.
 * Each campaign gets its own ring buffer of log entries.
 */

export interface ScraperLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  stage: 'search' | 'parse' | 'email' | 'system';
  message: string;
  detail?: string;
}

type Listener = (entry: ScraperLogEntry) => void;

const MAX_ENTRIES_PER_CAMPAIGN = 500;

const logs = new Map<string, ScraperLogEntry[]>();
const listeners = new Map<string, Set<Listener>>();

function getOrCreateLog(campaignId: string): ScraperLogEntry[] {
  let entries = logs.get(campaignId);
  if (!entries) {
    entries = [];
    logs.set(campaignId, entries);
  }
  return entries;
}

export function emitScraperEvent(
  campaignId: string,
  level: ScraperLogEntry['level'],
  stage: ScraperLogEntry['stage'],
  message: string,
  detail?: string
): void {
  const entry: ScraperLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    stage,
    message,
    detail,
  };

  const entries = getOrCreateLog(campaignId);
  entries.push(entry);

  // Trim to ring buffer size
  if (entries.length > MAX_ENTRIES_PER_CAMPAIGN) {
    entries.splice(0, entries.length - MAX_ENTRIES_PER_CAMPAIGN);
  }

  // Broadcast to SSE listeners
  const campaignListeners = listeners.get(campaignId);
  if (campaignListeners) {
    for (const fn of campaignListeners) {
      try {
        fn(entry);
      } catch {
        // Listener may have been cleaned up
      }
    }
  }
}

export function getScraperLogs(campaignId: string): ScraperLogEntry[] {
  return logs.get(campaignId) ?? [];
}

export function clearScraperLogs(campaignId: string): void {
  logs.delete(campaignId);
}

export function subscribeToScraperEvents(
  campaignId: string,
  listener: Listener
): () => void {
  let campaignListeners = listeners.get(campaignId);
  if (!campaignListeners) {
    campaignListeners = new Set();
    listeners.set(campaignId, campaignListeners);
  }
  campaignListeners.add(listener);

  return () => {
    campaignListeners!.delete(listener);
    if (campaignListeners!.size === 0) {
      listeners.delete(campaignId);
    }
  };
}
