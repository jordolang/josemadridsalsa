import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, Phone, ExternalLink, Navigation2, ChevronLeft } from 'lucide-react'
import { getLocationByIdFromDB } from '@/lib/locations/db-query'
import { getLocationImageUrl } from '@/lib/utils/image'
import { LocationImage } from './_components/LocationImage'
import { LocationShare } from './_components/LocationShare'

export const dynamic = 'force-dynamic'

type LocationPageProps = {
  params: Promise<{
    locationId: string
  }>
}

const sanitizePhone = (value?: string | null) => value?.replace(/[^0-9+]/g, '') ?? ''

export const revalidate = 3600

export async function generateMetadata({ params }: LocationPageProps): Promise<Metadata> {
  const { locationId } = await params
  const location = await getLocationByIdFromDB(locationId)
  if (!location) {
    return {
      title: 'Store not found · Jose Madrid Salsa',
    }
  }

  return {
    title: `${location.businessName} · Find Jose Madrid Salsa`,
    description: `Directions, hours, and contact information for ${location.businessName} in ${location.city}, ${location.state}.`,
    alternates: {
      canonical: `/find-us/${location.id}`,
    },
  }
}

export default async function LocationDetailPage({ params }: LocationPageProps) {
  const { locationId } = await params
  const location = await getLocationByIdFromDB(locationId)

  if (!location) {
    notFound()
  }

  const gallerySource =
    location.photoGallery && location.photoGallery.length > 0
      ? location.photoGallery
      : location.photoUrl
        ? [location.photoUrl]
        : []
  const gallery = gallerySource as string[]
  // Try stored photo URL first; Place ID is used as fallback if no stored URL exists
  const heroImage = getLocationImageUrl(gallery[0] ?? location.photoUrl, location.googlePlaceId)
  const phone = location.phone
  const website = location.website
  const directionsUrl = location.directionsUrl
  const mapsUrl = location.googleMapsUrl
  const fullAddress = `${location.address}, ${location.city}, ${location.state}${location.zipCode ? ` ${location.zipCode}` : ''}`

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/find-us" className="inline-flex items-center gap-2 text-sm text-salsa-600 underline underline-offset-4">
        <ChevronLeft className="h-4 w-4" />
        Back to store map
      </Link>

      <div className="grid gap-8 lg:grid-cols-[3fr,2fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg">
          <div className="relative h-80 w-full sm:h-[26rem]">
            <LocationImage src={heroImage} alt={`${location.businessName} storefront`} fill className="object-cover" priority fallbackPlaceId={location.googlePlaceId} />
          </div>
          {gallery.length > 1 ? (
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Tap to swipe through {gallery.length} photos
            </div>
          ) : null}
        </div>

        <div className="space-y-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Retail partner</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">{location.businessName}</h1>
            <p className="text-sm text-slate-500">
              {location.city}, {location.state}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3 text-sm text-slate-700">
              <MapPin className="mt-0.5 h-5 w-5 text-verde-600" />
              <div>
                <p className="font-medium text-slate-900">{fullAddress}</p>
                {mapsUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-salsa-600 underline">
                    View on Google Maps
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {phone ? (
              <a
                href={`tel:${sanitizePhone(phone)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-verde-600 to-verde-700 px-4 py-3 text-sm font-semibold text-white shadow hover:from-verde-700 hover:to-verde-800"
              >
                <Phone className="h-4 w-4" />
                Call
              </a>
            ) : (
              <span className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-center text-xs text-slate-400">
                Phone unavailable
              </span>
            )}

            {website ? (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700"
              >
                <ExternalLink className="h-4 w-4" />
                Website
              </a>
            ) : (
              <span className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-center text-xs text-slate-400">
                Website unavailable
              </span>
            )}

            {directionsUrl ? (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              >
                <Navigation2 className="h-4 w-4" />
                Directions
              </a>
            ) : (
              <span className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-center text-xs text-slate-400">
                Directions unavailable
              </span>
            )}
          </div>

          {/* Social Sharing */}
          <LocationShare location={{
            id: location.id,
            businessName: location.businessName,
            city: location.city,
            state: location.state,
            address: location.address,
            photoUrl: location.photoUrl,
          }} />
        </div>
      </div>

      {gallery.length > 1 ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Gallery</p>
            <h2 className="text-2xl font-semibold text-slate-900">More views from Google</h2>
          </div>
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
            {gallery.map((imageUrl, index) => (
              <div key={`${imageUrl}-${index}`} className="snap-start flex-shrink-0">
                <div className="relative h-56 w-80 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 shadow">
                  <LocationImage src={getLocationImageUrl(imageUrl)} alt={`${location.businessName} photo ${index + 1}`} fill className="object-cover" fallbackPlaceId={location.googlePlaceId} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
        <h3 className="text-xl font-semibold text-slate-900">Need help finding this store?</h3>
        <p className="mt-2 text-sm text-slate-600">
          Share this page with friends or tap directions to open the route in Google Maps without leaving your current tab.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-salsa-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-salsa-700"
            >
              <Navigation2 className="h-4 w-4" />
              Open in Maps
            </a>
          ) : null}
          <Link
            href="/find-us"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            Explore other locations
          </Link>
        </div>
      </div>
    </section>
  )
}
