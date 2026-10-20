import type { PunchLocation } from "@/lib/timeclock";

/**
 * Ask the browser for one GPS fix to stamp on a punch. Resolves to null —
 * never rejects — when location is unsupported, refused, or too slow, so a
 * punch is never blocked waiting on it.
 */
export function getPunchLocation(timeoutMs = 10_000): Promise<PunchLocation | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      position =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: timeoutMs }
    );
  });
}
