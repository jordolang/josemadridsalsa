'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, RefreshCw, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ScheduleEvent = {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  location: string | null;
  description: string | null;
  link: string | null;
  isAllDay: boolean;
};

type LatLngLiteral = { lat: number; lng: number };

const DEFAULT_CENTER: LatLngLiteral = { lat: 39.9403, lng: -82.0132 };
const MAP_SCRIPT_ID = 'google-maps-sdk';

let googleMapsPromise: Promise<any> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only be loaded in the browser.'));
  }

  if ((window as any).google?.maps) {
    return Promise.resolve((window as any).google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(MAP_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve((window as any).google?.maps));
      existingScript.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.id = MAP_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve((window as any).google?.maps));
    script.addEventListener('error', (error) => reject(error));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function escapeHtml(input: string | null | undefined) {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseLatLngFromString(location: string): LatLngLiteral | null {
  const match = location.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  return {
    lat: Number.parseFloat(match[1]),
    lng: Number.parseFloat(match[2]),
  };
}

function formatEventDate(
  event: ScheduleEvent,
  timedFormatter: Intl.DateTimeFormat,
  allDayFormatter: Intl.DateTimeFormat
) {
  if (!event.start) return 'Date to be announced';
  const date = new Date(event.start);
  if (Number.isNaN(date.getTime())) {
    return 'Date to be announced';
  }
  if (event.isAllDay) {
    return allDayFormatter.format(date);
  }
  return timedFormatter.format(date);
}

export function GoogleScheduleMap() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const geocodeCacheRef = useRef<Map<string, LatLngLiteral>>(new Map());
  const infoWindowRef = useRef<any>(null);
  const activeFetchRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const headingFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'full',
        timeStyle: 'short',
      }),
    []
  );
  const allDayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'full',
      }),
    []
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeFetchRef.current?.abort();
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!apiKey) {
      setMapError(
        'Google Maps API key is not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable the map.'
      );
      return;
    }

    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !maps) {
          return;
        }
        mapsRef.current = maps;
        if (!mapContainerRef.current) return;

        mapInstanceRef.current = new maps.Map(mapContainerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 6,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
        });
        setMapReady(true);
      })
      .catch((error) => {
        console.error('Failed to load Google Maps', error);
        if (!cancelled) {
          setMapError('Unable to load Google Maps at the moment. Please try again later.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const fetchEvents = useCallback(
    async ({ skipCache = false, asRefresh = false } = {}) => {
      const controller = new AbortController();
      activeFetchRef.current?.abort();
      activeFetchRef.current = controller;

      if (!mountedRef.current) return;
      setEventsError(null);
      if (asRefresh) {
        setIsRefreshing(true);
      } else {
        setEventsLoading(true);
      }

      try {
        const params = new URLSearchParams();
        if (skipCache) {
          params.set('skipCache', 'true');
        }
        const response = await fetch(`/api/calendar${params.toString() ? `?${params}` : ''}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            typeof data?.message === 'string' && data.message.length
              ? data.message
              : 'Failed to load schedule events.'
          );
        }

        const data = await response.json();
        if (!mountedRef.current) return;
        setEvents(Array.isArray(data?.events) ? data.events : []);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          return;
        }
        console.error('Error loading schedule events', error);
        if (!mountedRef.current) return;
        setEventsError(
          error instanceof Error && error.message
            ? error.message
            : 'Unable to load events. Please try again later.'
        );
      } finally {
        if (!mountedRef.current) return;
        if (asRefresh) {
          setIsRefreshing(false);
        } else {
          setEventsLoading(false);
        }
        if (activeFetchRef.current === controller) {
          activeFetchRef.current = null;
        }
      }
    },
    []
  );

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsRef.current) return;

    let cancelled = false;
    const maps = mapsRef.current;
    const map = mapInstanceRef.current;
    const geocoder = new maps.Geocoder();
    const infoWindow =
      infoWindowRef.current || new maps.InfoWindow({ maxWidth: 240, disableAutoPan: false });
    infoWindowRef.current = infoWindow;

    const nextMarkers: any[] = [];
    const geocodeCache = geocodeCacheRef.current;

    async function resolveLocation(location: string): Promise<LatLngLiteral | null> {
      if (!location) return null;
      const cached = geocodeCache.get(location);
      if (cached) return cached;

      const parsed = parseLatLngFromString(location);
      if (parsed) {
        geocodeCache.set(location, parsed);
        return parsed;
      }

      return new Promise<LatLngLiteral | null>((resolve) => {
        geocoder.geocode({ address: location }, (results: any, status: string) => {
          if (status === 'OK' && Array.isArray(results) && results[0]) {
            const { geometry } = results[0];
            const resolved = {
              lat: geometry.location.lat(),
              lng: geometry.location.lng(),
            };
            geocodeCache.set(location, resolved);
            resolve(resolved);
          } else {
            resolve(null);
          }
        });
      });
    }

    async function placeMarkers() {
      if (!events.length) {
        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];
        map.setCenter(DEFAULT_CENTER);
        map.setZoom(6);
        return;
      }

      let hasMarker = false;
      const bounds = new maps.LatLngBounds();

      for (const event of events) {
        if (!event.location) continue;
        const position = await resolveLocation(event.location);
        if (cancelled || !position) continue;

        const marker = new maps.Marker({
          map,
          position,
          title: event.title,
        });

        marker.addListener('click', () => {
          const content = `
                <div style="max-width:220px">
                  <h3 style="margin:0 0 4px;font-weight:600;">${escapeHtml(event.title)}</h3>
                  <p style="margin:0 0 4px;font-size:13px;color:#475569;">${escapeHtml(
                formatEventDate(event, headingFormatter, allDayFormatter)
              )}</p>
                  <p style="margin:0;font-size:13px;color:#1f2937;font-weight:500;">${escapeHtml(
                event.location
              )}</p>
            </div>
          `;
          infoWindow.setContent(content);
          infoWindow.open({ map, anchor: marker });
        });

        nextMarkers.push(marker);
        bounds.extend(position);
        hasMarker = true;
      }

      if (cancelled) {
        nextMarkers.forEach((marker) => marker.setMap(null));
        return;
      }

      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = nextMarkers;

      if (hasMarker) {
        if (nextMarkers.length === 1) {
          map.setCenter(nextMarkers[0].getPosition());
          map.setZoom(10);
        } else {
          map.fitBounds(bounds, 64);
        }
      } else {
        map.setCenter(DEFAULT_CENTER);
        map.setZoom(6);
      }
    }

    placeMarkers();

    return () => {
      cancelled = true;
    };
  }, [events, mapReady, headingFormatter, allDayFormatter]);

  const handleRefresh = useCallback(() => {
    fetchEvents({ skipCache: true, asRefresh: true });
  }, [fetchEvents]);

  const hasEventsToShow = events.some((event) => Boolean(event.location));

  return (
    <Card className="border-0 bg-white shadow-xl">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-salsa-600">
              On the Move
            </p>
            <h3 className="text-2xl font-serif font-bold text-slate-900">
              Live schedule from Google Calendar
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {eventsError ? (
              <Badge variant="destructive">Offline</Badge>
            ) : (
              <Badge className="bg-verde-100 text-verde-800">
                {eventsLoading && !events.length ? 'Loading...' : 'Synced'}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || eventsLoading}
            >
              {isRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="relative h-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
            <div ref={mapContainerRef} className="absolute inset-0" />
            {(!mapReady || eventsLoading) && !mapError && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur">
                <div className="flex flex-col items-center gap-3 text-slate-700">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm font-medium">Synchronizing the route...</span>
                </div>
              </div>
            )}
            {mapError && (
              <div className="absolute inset-0 flex items-center justify-center bg-white px-6 text-center text-sm text-slate-600">
                {mapError}
              </div>
            )}
            {mapReady && !mapError && !hasEventsToShow && !eventsLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90 px-6 text-center text-sm text-slate-600">
                Calendar is configured, but there are no upcoming events with locations yet.
              </div>
            )}
          </div>

          <div className="flex max-h-[420px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 text-slate-700">
              <Calendar className="h-4 w-4 text-salsa-600" />
              <span className="text-sm font-semibold uppercase tracking-widest">
                Upcoming stops
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {eventsLoading && !events.length ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="space-y-3">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  ))}
                </div>
              ) : !hasEventsToShow ? (
                <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
                  We&apos;ll sync Jose&apos;s next stops here as soon as they are on the calendar.
                </div>
              ) : (
                <ul className="space-y-5">
                  {events
                    .filter((event) => Boolean(event.location))
                    .map((event) => (
                      <li key={event.id} className="rounded-xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-salsa-600/10">
                            <MapPin className="h-5 w-5 text-salsa-600" />
                          </div>
                          <div className="space-y-2">
                            <div>
                              <h4 className="text-base font-semibold text-slate-900">
                                {event.title}
                              </h4>
                              <p className="text-sm text-slate-500">
                                {formatEventDate(event, headingFormatter, allDayFormatter)}
                              </p>
                            </div>
                            <p className="text-sm font-medium text-slate-700">{event.location}</p>
                            {event.link && (
                              <a
                                href={event.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  'inline-flex items-center text-sm font-medium text-salsa-600 hover:text-salsa-700'
                                )}
                              >
                                View in Google Calendar
                              </a>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {eventsError && (
          <div className="border-t border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
            {eventsError}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
