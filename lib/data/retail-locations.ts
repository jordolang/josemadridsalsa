import locationsData from '../locations/locations-data.json'

export type RetailLocationSeedData = {
  id?: string
  businessName: string
  address: string
  city: string
  state: string
  zipCode: string | null
  phone: string | null
  website: string | null
  photoUrl: string | null
  photoGallery?: string[]
  latitude: string | null
  longitude: string | null
  googlePlacesId: string | null
  county?: string | null
  isActive?: boolean
  sortOrder?: number
}

// JSON structure from locations-data.json
type LocationJSON = {
  id: string
  businessName: string
  address: string
  city: string
  state: string
  zipCode: string | null
  phone: string | null
  website: string | null
  photoUrl: string | null
  latitude: string | null
  longitude: string | null
  googlePlaceId: string | null // Note: JSON has googlePlaceId, not googlePlacesId
}

// Export the retail locations data from the JSON file
export const retailLocationsData: RetailLocationSeedData[] = (locationsData as LocationJSON[]).map((location, index) => ({
  id: location.id,
  businessName: location.businessName,
  address: location.address,
  city: location.city,
  state: location.state,
  zipCode: location.zipCode,
  phone: location.phone,
  website: location.website,
  photoUrl: location.photoUrl,
  latitude: location.latitude,
  longitude: location.longitude,
  // Map googlePlaceId from JSON to googlePlacesId for Prisma
  googlePlacesId: location.googlePlaceId,
  isActive: true,
  sortOrder: index,
}))
