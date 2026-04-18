'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapPin, Navigation, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const BUSINESS_ADDRESS = '601 Putnam Ave, Zanesville, OH 43701'
const BUSINESS_NAME = 'Jose Madrid Salsa'
// Precise coordinates for 601 Putnam Ave, Zanesville, OH 43701 (from Google Place ID)
const LATITUDE = 39.929682
const LONGITUDE = -82.007174

export function LocationMap() {
  const [viewMode, setViewMode] = useState<'map' | 'street'>('map')
  const [panoId, setPanoId] = useState<string | null>(
    process.env.NEXT_PUBLIC_GOOGLE_STREETVIEW_PANO || null
  )
  const [streetHeading, setStreetHeading] = useState<number>(210)
  const [streetPitch] = useState<number>(0)
  const [streetFov] = useState<number>(90)
  
  // Get API key from environment
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // Encode address for URLs
  const encodedAddress = encodeURIComponent(BUSINESS_ADDRESS)
  
  // Prefer place_id if provided. Sanitize aggressively: Google's Embed API
  // returns "Invalid 'q' parameter" for any of these env-variable pitfalls —
  // trailing whitespace/newlines, an accidentally included "place_id:" prefix,
  // or wrapping quotes. Strip them before building the URL.
  const rawPlaceId = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID || process.env.GOOGLE_PLACE_ID || ''
  const placeId = rawPlaceId
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^place_id:/i, '')
    .trim()

  // Google Maps Embed URL — the keyless `maps.google.com/maps?output=embed`
  // endpoint silently ignores `z=` when combined with `q=place_id:`, which
  // drops the map to the world view. Use Embed API v1 `/place` instead (same
  // API the Street View embed below already relies on).
  const mapEmbedUrl = useMemo(() => {
    if (!apiKey) return ''
    const base = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&zoom=17`
    if (placeId) {
      return `${base}&q=place_id:${encodeURIComponent(placeId)}`
    }
    return `${base}&q=${encodedAddress}`
  }, [apiKey, placeId, encodedAddress])

  // Google Street View Embed URL
  // Prefer the Embed API v1 with key if available (needs Maps Embed API enabled),
  // otherwise fall back to the keyless streetview URL format.
  const streetViewUrl = useMemo(() => {
    if (apiKey) {
      const base = `https://www.google.com/maps/embed/v1/streetview?key=${apiKey}`
      const common = `&heading=${streetHeading}&pitch=${streetPitch}&fov=${streetFov}&source=outdoor`
      if (panoId) {
        return `${base}&pano=${encodeURIComponent(panoId)}${common}`
      }
      return `${base}&location=${LATITUDE},${LONGITUDE}${common}`
    }
    // Keyless fallback: standard maps URL centred on coordinates
    return `https://maps.google.com/maps?q=${LATITUDE},${LONGITUDE}&output=embed&z=18`
  }, [apiKey, panoId, streetHeading, streetPitch, streetFov])

  // Directions URL
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`

  // NOTE: Street View pano lookup has been removed. Each lookup fired 1-3 Street View
  // Static API calls per homepage load, which is a billable API at $0.007/call.
  // Set NEXT_PUBLIC_GOOGLE_STREETVIEW_PANO in your environment variables to a
  // hardcoded pano ID (look it up once manually via Maps) to re-enable Street View.

  if (!apiKey) {
    return (
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <MapPin className="w-16 h-16 mx-auto mb-4 text-salsa-600" />
            <h2 className="text-4xl font-bold font-serif text-foreground mb-4">
              Visit Our Location
            </h2>
            <p className="text-xl text-muted-foreground mb-6">
              {BUSINESS_NAME}
            </p>
            <p className="text-lg text-foreground mb-8">
              {BUSINESS_ADDRESS}
            </p>
            <Button
              asChild
              className="bg-salsa-600 hover:bg-salsa-700"
            >
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Get Directions
              </a>
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-20 bg-gradient-to-b from-background to-verde-50/20 dark:to-verde-950/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-salsa-100 dark:bg-salsa-900/30 rounded-full mb-6">
            <MapPin className="w-8 h-8 text-salsa-600" />
          </div>
          <h2 className="text-4xl font-bold font-serif text-foreground mb-4">
            Visit Our Location
          </h2>
          <p className="text-xl text-muted-foreground mb-2">
            {BUSINESS_NAME}
          </p>
          <p className="text-lg text-foreground mb-8">
            {BUSINESS_ADDRESS}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Map/Street View */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden surface-shadow">
              {/* View Toggle */}
              <div className="bg-white dark:bg-gray-800 border-b border-border p-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={viewMode === 'map' ? 'default' : 'outline'}
                    onClick={() => setViewMode('map')}
                    className={viewMode === 'map' ? 'bg-salsa-600 hover:bg-salsa-700' : ''}
                  >
                    Map View
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'street' ? 'default' : 'outline'}
                    onClick={() => setViewMode('street')}
                    className={viewMode === 'street' ? 'bg-salsa-600 hover:bg-salsa-700' : ''}
                    title={
                      panoId
                        ? 'Street View uses the closest outdoor panorama'
                        : 'Finding best Street View…'
                    }
                  >
                    Street View
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  asChild
                  className="text-salsa-600"
                >
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in Maps
                  </a>
                </Button>
              </div>

              {/* Map Container */}
              <div className="relative w-full h-[400px] lg:h-[500px]">
                {viewMode === 'map' && mapEmbedUrl && (
                  <iframe
                    src={mapEmbedUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Jose Madrid Salsa Location Map"
                  />
                )}
                {viewMode === 'street' && streetViewUrl && (
                  <iframe
                    src={streetViewUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Jose Madrid Salsa Street View"
                  />
                )}
              </div>
            </Card>
          </div>

          {/* Information Sidebar */}
          <div className="space-y-6">
            {/* Building Photo */}
            <Card className="overflow-hidden surface-shadow">
              <div className="relative w-full h-48">
                {/* eslint-disable-next-line @next/next/no-img-element -- Using local static image */}
                <img
                  src="/images/jose-madrid-building.jpeg"
                  alt="Jose Madrid Salsa Store Front - 601 Putnam Ave, Zanesville, OH"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Our Store
                </h3>
                <p className="text-muted-foreground text-sm">
                  Visit us in person to explore our full range of gourmet salsas and specialty products.
                </p>
              </div>
            </Card>

            {/* Quick Info */}
            <Card className="p-6 surface-shadow">
              <h3 className="text-lg font-bold text-foreground mb-4">
                Store Information
              </h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-salsa-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground text-sm">Address</p>
                    <p className="text-muted-foreground text-sm">
                      {BUSINESS_ADDRESS}
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-border">
                  <Button
                    asChild
                    className="w-full bg-salsa-600 hover:bg-salsa-700"
                  >
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Get Directions
                    </a>
                  </Button>
                </div>
              </div>
            </Card>

            {/* Contact Card */}
            <Card className="p-6 surface-shadow bg-gradient-to-br from-salsa-50 to-chile-50 dark:from-salsa-900/20 dark:to-chile-900/20">
              <h3 className="text-lg font-bold text-foreground mb-2">
                Get in Touch
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Have questions? We'd love to hear from you!
              </p>
              <Button
                asChild
                variant="outline"
                className="w-full border-salsa-600 text-salsa-600 hover:bg-salsa-50 dark:hover:bg-salsa-900/20"
              >
                <a href="/contact">
                  Contact Us
                </a>
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}
