/**
 * Map of the package's last known carrier scan.
 *
 * Carriers report a city and state, not coordinates, so this centres a Google Maps embed on
 * that place. The Embed API has no per-load charge. Renders nothing without a key or a place.
 */
export function ShipmentMap({ location, delivered }: { location: string | null; delivered: boolean }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey || !location) return null

  const src =
    `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}` +
    `&q=${encodeURIComponent(location)}&zoom=9`

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {delivered ? 'Delivered near' : 'Last scanned in'}{' '}
        <span className="font-medium text-foreground">{location}</span>
      </p>
      <div className="aspect-video w-full overflow-hidden rounded-lg border">
        <iframe
          title={`Map of ${location}`}
          src={src}
          className="size-full border-0"
          loading="lazy"
          // Origin only: the order page's query string carries the order access token, which
          // must not reach Google in the Referer. The origin still satisfies key restrictions.
          referrerPolicy="strict-origin"
          allowFullScreen
        />
      </div>
    </div>
  )
}
