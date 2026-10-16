'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { LayerGroup, Map as LeafletMap } from 'leaflet'
import type { ShipmentMapData } from '@/lib/order-tracking/map'

/**
 * Where the salsa is, on an OpenStreetMap map.
 *
 * A salsa bowl sits wherever the package was last seen (headquarters until the carrier scans
 * it), a pin marks the destination, and a blue line traces every stop from headquarters to the
 * bowl. Leaflet only runs in the browser, so it is loaded inside the effect; the server renders
 * the caption and an empty map box.
 */
export function ShipmentMap({ data }: { data: ShipmentMapData }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const layers = useRef<LayerGroup | null>(null)
  const framed = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !container.current) return

      if (!map.current) {
        map.current = L.map(container.current, { scrollWheelZoom: false })
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map.current)
        layers.current = L.layerGroup().addTo(map.current)
      }
      const group = layers.current as LayerGroup
      group.clearLayers()

      const path = data.path.map((stop) => L.latLng(stop.lat, stop.lng))
      if (path.length > 1) {
        L.polyline(path, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(group)
      }
      for (const stop of data.path.slice(1, -1)) {
        L.circleMarker([stop.lat, stop.lng], { radius: 5, color: '#1d4ed8', fillColor: '#fff', fillOpacity: 1, weight: 2 })
          .bindTooltip(stop.label)
          .addTo(group)
      }
      if (data.destination) {
        L.marker([data.destination.lat, data.destination.lng], {
          icon: L.divIcon({ className: '', html: DESTINATION_PIN, iconSize: [36, 36], iconAnchor: [18, 34] }),
          title: `Destination: ${data.destination.label}`,
        })
          .bindTooltip(`${data.delivered ? 'Delivered to' : 'Heading to'} ${data.destination.label}`)
          .addTo(group)
      }
      L.marker([data.salsa.lat, data.salsa.lng], {
        icon: L.divIcon({ className: '', html: SALSA_BOWL, iconSize: [44, 44], iconAnchor: [22, 22] }),
        title: `Your salsa: ${data.salsa.label}`,
        zIndexOffset: 1000,
      })
        .bindTooltip(`Your salsa · ${data.salsa.label}`)
        .addTo(group)

      // Frame every point the first time, and again only when a new stop appears, so the
      // minute-by-minute refresh doesn't undo the customer's own zooming.
      const points = data.destination ? [...path, L.latLng(data.destination.lat, data.destination.lng)] : path
      const key = points.map((p) => `${p.lat},${p.lng}`).join('|')
      if (framed.current !== key) {
        framed.current = key
        map.current.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data])

  useEffect(
    () => () => {
      map.current?.remove()
      map.current = null
    },
    []
  )

  return (
    <div className="space-y-2">
      <div
        ref={container}
        role="img"
        aria-label={caption(data)}
        // `isolate` keeps Leaflet's stacked panes beneath the site header and its menus.
        className="isolate h-72 w-full overflow-hidden rounded-lg border bg-muted sm:h-96"
      />
      <p className="text-sm text-muted-foreground">{caption(data)}</p>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full border border-white bg-[url('/images/shared/salsa-bowl.png')] bg-cover" />
          Your salsa
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full bg-red-600" />
          Destination
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-blue-600" />
          Route so far
        </span>
      </p>
    </div>
  )
}

function caption(data: ShipmentMapData): string {
  if (data.delivered) {
    return data.destination
      ? `Delivered to ${data.destination.label}. Enjoy!`
      : 'Delivered. Enjoy!'
  }
  if (data.path.length > 1) return `Your salsa was last scanned in ${data.salsa.label}.`
  if (data.shipped) {
    return 'Your salsa is packed at Jose Madrid Salsa headquarters in Zanesville, OH, waiting for the carrier to pick it up.'
  }
  return 'Your salsa is at Jose Madrid Salsa headquarters in Zanesville, OH, waiting to be packed and shipped.'
}

const SALSA_BOWL =
  '<img src="/images/shared/salsa-bowl.png" alt="" width="44" height="44" ' +
  'class="size-11 rounded-full border-2 border-white bg-white object-cover shadow-md" />'

const DESTINATION_PIN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" class="drop-shadow-md">' +
  '<path d="M12 23s7.5-7.6 7.5-13A7.5 7.5 0 0 0 4.5 10c0 5.4 7.5 13 7.5 13z" fill="#dc2626" stroke="#fff" stroke-width="1.5"/>' +
  '<path d="M8.5 10.2 12 7.3l3.5 2.9v3.3h-2.4v-2.2h-2.2v2.2H8.5z" fill="#fff"/>' +
  '</svg>'
