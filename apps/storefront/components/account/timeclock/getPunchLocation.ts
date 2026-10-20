import type { PunchLocation } from "@/lib/timeclock";

/**
 * Ask the browser for one GPS fix to stamp on a punch. Resolves to null —
 * never rejects — when location is unsupported, refused, or too slow, so a
 * punch is never blocked waiting on it.
 *
 * The browser's own `timeout` only starts once permission is granted, so an
 * ignored permission prompt would wait forever; `maxWaitMs` caps the whole
 * call, prompt included.
 */
export function getPunchLocation(
  timeoutMs = 10_000,
  maxWaitMs = 20_000
): Promise<PunchLocation | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    const giveUp = setTimeout(() => resolve(null), maxWaitMs);
    const finish = (location: PunchLocation | null) => {
      clearTimeout(giveUp);
      resolve(location);
    };
    navigator.geolocation.getCurrentPosition(
      position =>
        finish({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        }),
      () => finish(null),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: timeoutMs }
    );
  });
}
