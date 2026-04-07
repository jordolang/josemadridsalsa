'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  stage: 'search' | 'parse' | 'email' | 'system';
  message: string;
  detail?: string;
}

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  success: 'text-green-400',
};

const STAGE_LABELS: Record<LogEntry['stage'], string> = {
  search: 'SEARCH',
  parse: 'PARSE',
  email: 'EMAIL',
  system: 'SYSTEM',
};

const STAGE_COLORS: Record<LogEntry['stage'], string> = {
  search: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  parse: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  email: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  system: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

export function ScraperMonitor({ campaignId }: { campaignId: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = `/api/admin/scraper-logs/${campaignId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const entry: LogEntry = JSON.parse(event.data);
        setLogs((prev) => {
          const next = [...prev, entry];
          // Keep last 500 entries in the UI
          return next.length > 500 ? next.slice(-500) : next;
        });
      } catch {
        // Ignore unparseable events
      }
    };

    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [campaignId]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  function formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '??:??:??';
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-950">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm font-medium text-zinc-200">
              Scraper Monitor
            </CardTitle>
            <Badge
              variant="outline"
              className={
                connected
                  ? 'border-green-500/50 bg-green-500/10 text-green-400 text-xs'
                  : 'border-red-500/50 bg-red-500/10 text-red-400 text-xs'
              }
            >
              <span
                className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                  connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                }`}
              />
              {connected ? 'LIVE' : 'DISCONNECTED'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
              onClick={() => setAutoScroll((v) => !v)}
            >
              {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
              onClick={() => setLogs([])}
            >
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={scrollRef}
          className="h-[350px] overflow-y-auto font-mono text-xs leading-relaxed px-4 pb-4"
        >
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-zinc-600">
              Waiting for scraper activity...
            </div>
          ) : (
            logs.map((entry, i) => (
              <div key={i} className="flex gap-2 py-0.5 hover:bg-zinc-900/50">
                <span className="text-zinc-600 shrink-0">
                  {formatTime(entry.timestamp)}
                </span>
                <span
                  className={`shrink-0 inline-flex items-center rounded border px-1.5 text-[10px] font-medium ${
                    STAGE_COLORS[entry.stage]
                  }`}
                >
                  {STAGE_LABELS[entry.stage]}
                </span>
                <span className={LEVEL_COLORS[entry.level]}>
                  {entry.message}
                </span>
                {entry.detail && (
                  <span className="text-zinc-600 truncate" title={entry.detail}>
                    {entry.detail}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
