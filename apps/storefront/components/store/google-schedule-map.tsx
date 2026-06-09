'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, RefreshCw, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ScheduleEvent } from '@/lib/server/google-data';

type LatLngLiteral = { lat: number; lng: number };

// Google Maps type definitions for the specific APIs used in this component
interface GoogleMapsMarker {
  setMap?: (map: unknown | null) => void;
  map?: unknown | null;
  getPosition?: () => LatLngLiteral;
  position?: LatLngLiteral;
  addEventListener?: (event: string, handler: () => void) => void;
  addListener?: (event: string, handler: () => void) => void;
}

interface GoogleMapsGeocodeResult {
  geometry: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
}

const DEFAULT_CENTER: LatLngLiteral = { lat: 39.9403, lng: -82.0132 };
const MAP_SCRIPT_ID = 'google-maps-sdk';

// Module-level promise so Maps JS is only loaded once per browser session
let googleMapsPromise: Promise<any> | null = null;

function removeMarker(marker: GoogleMapsMarker) {
  if (typeof marker?.setMap === 'function') {
    marker.setMap(null);
    return;
  }

  if (marker && 'map' in marker) {
    marker.map = null;
  }
}

function positionFromMarker(marker: GoogleMapsMarker): LatLngLiteral {
  if (typeof marker?.getPosition === 'function') {
    return marker.getPosition();
  }

  if (marker.position) {
    return marker.position as LatLngLiteral;
  }

  throw new Error('Marker has no valid position');
}

function loadGoogleMaps(apiKey: string) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only be loaded in the browser.'));
  }
  if ((window as any).google?.maps) {
    return Promise.resolve((window as any).google.maps);
  }
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(MAP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      const timeout = setTimeout(() => reject(new Error('Timeout loading Google Maps')), 10000);
      (window as any).__googleMapsCallback = () => {
        clearTimeout(timeout);
        resolve((window as any).google.maps);
      };
      return;
    }
    (window as any).__googleMapsCallback = () => resolve((window as any).google.maps);
    const script = document.createElement('script');
    script.id = MAP_SCRIPT_ID;
    // Note: 'places' library removed — it's only needed for Place Search (billable).
    // Geocoder is included in the base Maps JS library at no extra charge.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=__googleMapsCallback&loading=async&v=weekly&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.addEventListener('error', reject);
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function escapeHtml(input: string | null | undefined) {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function parseLatLngFromString(location: string): LatLngLiteral | null {
  const match = location.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { lat: Number.parseFloat(match[1]), lng: Number.parseFloat(match[2]) };
}

function formatEventDate(
  event: ScheduleEvent,
  timedFormatter: Intl.DateTimeFormat,
  allDayFormatter: Intl.DateTimeFormat
) {
  if (!event.start) return 'Date to be announced';
  const date = new Date(event.start);
  if (Number.isNaN(date.getTime())) return 'Date to be announced';
  return event.isAllDay ? allDayFormatter.format(date) : timedFormatter.format(date);
}

type GoogleScheduleMapProps = {
  /**
   * Pre-fetched events from the server — passed as props so ZERO client-side
   * API calls are made on initial load. The Refresh button triggers a single
   * on-demand fetch when the user explicitly requests it.
   */
  initialEvents: ScheduleEvent[];
};

export function GoogleScheduleMap({ initialEvents }: GoogleScheduleMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<any>(null);
  const markerLibraryRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const geocodeCacheRef = useRef<Map<string, LatLngLiteral>>(new Map());
  const infoWindowRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // Start with server-provided events — no fetch needed
  const [events, setEvents] = useState<ScheduleEvent[]>(initialEvents);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const headingFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }),
    []
  );
  const allDayFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }),
    []
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      markersRef.current.forEach(removeMarker);
      markersRef.current = [];
    };
  }, []);

  // Load Google Maps JS once
  useEffect(() => {
    if (!apiKey) {
      setMapError('Google Maps API key is not configured.');
      return;
    }
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(async (maps) => {
        if (cancelled || !maps || !mapContainerRef.current) return;
        const markerLibrary =
          typeof maps.importLibrary === 'function'
            ? await maps.importLibrary('marker').catch(() => null)
            : null;

        if (cancelled || !mapContainerRef.current) return;
        mapsRef.current = maps;
        markerLibraryRef.current = markerLibrary;
        mapInstanceRef.current = new maps.Map(mapContainerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 6,
          mapId: '9873b6859aa7ba6a2c1fdcdf',
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
        });
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError('Unable to load Google Maps. Please try again later.');
      });
    return () => { cancelled = true; };
  }, [apiKey]);

  // Place markers whenever events or map readiness changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsRef.current) return;
    let cancelled = false;
    const maps = mapsRef.current;
    const markerLibrary = markerLibraryRef.current;
    const map = mapInstanceRef.current;
    const geocoder = new maps.Geocoder();
    const infoWindow = infoWindowRef.current || new maps.InfoWindow({ maxWidth: 240 });
    infoWindowRef.current = infoWindow;
    const nextMarkers: GoogleMapsMarker[] = [];
    const geocodeCache = geocodeCacheRef.current;

    async function resolveLocation(location: string): Promise<LatLngLiteral | null> {
      const cached = geocodeCache.get(location);
      if (cached) return cached;
      const parsed = parseLatLngFromString(location);
      if (parsed) { geocodeCache.set(location, parsed); return parsed; }
      return new Promise<LatLngLiteral | null>((resolve) => {
        geocoder.geocode({ address: location }, (results: GoogleMapsGeocodeResult[] | null, status: string) => {
          if (status === 'OK' && results?.[0]) {
            const { lat, lng } = results[0].geometry.location;
            const pos = { lat: lat(), lng: lng() };
            geocodeCache.set(location, pos);
            resolve(pos);
          } else resolve(null);
        });
      });
    }

    (async () => {
      if (!events.length) {
        markersRef.current.forEach((m) => m.setMap(null));
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
        const pin = markerLibrary?.PinElement
          ? new markerLibrary.PinElement({
              background: '#dc2626',
              borderColor: '#ffffff',
              glyphText: 'J',
              glyphColor: '#ffffff',
            })
          : null;
        const marker = markerLibrary?.AdvancedMarkerElement
          ? new markerLibrary.AdvancedMarkerElement({
              map,
              position,
              title: event.title,
              content: pin,
              gmpClickable: true,
            })
          : new maps.Marker({ map, position, title: event.title });

        const openInfoWindow = () => {
          infoWindow.setContent(`
            <div style="max-width:220px">
              <h3 style="margin:0 0 4px;font-weight:600;">${escapeHtml(event.title)}</h3>
              <p style="margin:0 0 4px;font-size:13px;color:#475569;">${escapeHtml(formatEventDate(event, headingFormatter, allDayFormatter))}</p>
              <p style="margin:0;font-size:13px;color:#1f2937;font-weight:500;">${escapeHtml(event.location)}</p>
            </div>`);
          infoWindow.open({ map, anchor: marker });
        };

        if (markerLibrary?.AdvancedMarkerElement && typeof marker.addEventListener === 'function') {
          marker.addEventListener('gmp-click', openInfoWindow);
        } else {
          marker.addListener('click', openInfoWindow);
        }
        nextMarkers.push(marker);
        bounds.extend(position);
        hasMarker = true;
      }
      if (cancelled) { nextMarkers.forEach(removeMarker); return; }
      markersRef.current.forEach(removeMarker);
      markersRef.current = nextMarkers;
      if (hasMarker) {
        if (nextMarkers.length === 1) {
          map.setCenter(positionFromMarker(nextMarkers[0]));
          map.setZoom(10);
        } else {
          map.fitBounds(bounds, 64);
        }
      } else {
        map.setCenter(DEFAULT_CENTER);
        map.setZoom(6);
      }
    })();

    return () => { cancelled = true; };
  }, [events, mapReady, headingFormatter, allDayFormatter]);

  // Manual refresh — only fires when user clicks the button
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch('/api/calendar?skipCache=true');
      if (!res.ok) throw new Error('Failed to refresh');
      const data = await res.json();
      if (mountedRef.current) setEvents(Array.isArray(data?.events) ? data.events : []);
    } catch {
      if (mountedRef.current) setRefreshError('Could not refresh schedule.');
    } finally {
      if (mountedRef.current) setIsRefreshing(false);
    }
  }, []);

  const hasEventsToShow = events.some((e) => Boolean(e.location));

  return (
    <Card className="card surface-shadow">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-salsa-600">On the Move</p>
            <h3 className="text-2xl font-serif font-bold text-foreground">Live schedule from Google Calendar</h3>
          </div>
          <div className="flex items-center gap-3">
            {refreshError
              ? <Badge variant="destructive">Offline</Badge>
              : <Badge className="bg-verde-100 text-verde-800 dark:bg-verde-900/30 dark:text-verde-300">Synced</Badge>
            }
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <RefreshCw className="mr-2 h-4 w-4" />
              }
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="relative h-[420px] overflow-hidden rounded-3xl border border-border bg-muted">
            <div ref={mapContainerRef} className="absolute inset-0" />
            {!mapReady && !mapError && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur">
                <div className="flex flex-col items-center gap-3 text-foreground/80">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm font-medium">Loading map...</span>
                </div>
              </div>
            )}
            {mapError && (
              <div className="absolute inset-0 flex items-center justify-center bg-card px-6 text-center text-sm text-muted-foreground">
                {mapError}
              </div>
            )}
            {mapReady && !mapError && !hasEventsToShow && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/90 px-6 text-center text-sm text-muted-foreground">
                No upcoming events with locations yet.
              </div>
            )}
          </div>

          <div className="flex max-h-[420px] flex-col overflow-hidden rounded-3xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4 text-foreground/80">
              <Calendar className="h-4 w-4 text-salsa-600" />
              <span className="text-sm font-semibold uppercase tracking-widest">Upcoming stops</span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!hasEventsToShow ? (
                <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  We&apos;ll sync Jose&apos;s next stops here as soon as they are on the calendar.
                </div>
              ) : (
                <ul className="space-y-5">
                  {events.filter((e) => Boolean(e.location)).map((event) => (
                    <li key={event.id} className="rounded-xl border border-border p-4 surface-shadow">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-salsa-600/10">
                          <MapPin className="h-5 w-5 text-salsa-600" />
                        </div>
                        <div className="space-y-2">
                          <div>
                            <h4 className="text-base font-semibold text-foreground">{event.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {formatEventDate(event, headingFormatter, allDayFormatter)}
                            </p>
                          </div>
                          <p className="text-sm font-medium text-foreground/90">{event.location}</p>
                          {event.link && (
                            <a
                              href={event.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn('inline-flex items-center text-sm font-medium text-salsa-600 hover:text-salsa-700')}
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

        {refreshError && (
          <div className="border-t border-red-200 bg-red-50 dark:bg-red-900/30 px-6 py-4 text-sm text-red-700 dark:text-red-200">
            {refreshError}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
