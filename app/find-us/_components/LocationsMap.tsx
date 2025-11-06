'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

declare global {
  interface Window {
    google?: {
      maps: {
        importLibrary?: (library: string) => Promise<any>
        Map?: any
        LatLngBounds?: any
        InfoWindow?: any
      }
      maps?: {
        marker?: {
          AdvancedMarkerElement?: any
        }
      }
    }
    initMap?: () => Promise<void>
  }
}

type Location = {
  id: string
  businessName: string
  address: string
  city: string
  state: string
  zipCode: string | null
  phone: string | null
  website: string | null
  position?: { lat: number; lng: number }
}

type LocationsMapProps = {
  locations: Location[]
}

export function LocationsMap({ locations }: LocationsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [geocodedLocations, setGeocodedLocations] = useState<Location[]>([])
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoWindowsRef = useRef<any[]>([])

  // Generate 2-letter abbreviation from city name
  function getCityAbbreviation(city: string): string {
    const words = city.trim().split(/\s+/)
    if (words.length === 1) {
      // Single word: take first 2 letters
      return city.substring(0, 2).toUpperCase()
    } else {
      // Multiple words: take first letter of first two words
      return (words[0][0] + (words[1]?.[0] || '')).toUpperCase()
    }
  }

  // Get first word of business name
  function getFirstWord(text: string): string {
    return text.trim().split(/\s+/)[0]
  }

  // Generate marker label based on city and business count
  function generateMarkerLabel(location: Location, cityCount: number): string {
    const cityAbbr = getCityAbbreviation(location.city)
    if (cityCount === 1) {
      return cityAbbr
    } else {
      const firstWord = getFirstWord(location.businessName)
      return `${cityAbbr} - ${firstWord}`
    }
  }

  // Geocode addresses to get coordinates using Google Maps Geocoding API
  useEffect(() => {
    async function geocodeLocations() {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        setError('Google Maps API key not configured')
        setIsLoading(false)
        return
      }

      try {
        // Batch geocode with delays to respect rate limits
        const geocoded: Location[] = []
        const batchSize = 10
        const delay = 200 // ms between batches

        for (let i = 0; i < locations.length; i += batchSize) {
          const batch = locations.slice(i, i + batchSize)
          
          const batchResults = await Promise.all(
            batch.map(async (loc) => {
              const fullAddress = `${loc.address}, ${loc.city}, ${loc.state}${loc.zipCode ? ` ${loc.zipCode}` : ''}`
              
              try {
                const response = await fetch(
                  `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`
                )
                const data = await response.json()
                
                if (data.results && data.results.length > 0) {
                  const { lat, lng } = data.results[0].geometry.location
                  return { ...loc, position: { lat, lng } }
                }
              } catch (err) {
                console.warn(`Failed to geocode ${loc.businessName}:`, err)
              }
              
              return loc
            })
          )

          geocoded.push(...batchResults)

          // Delay between batches to avoid rate limits
          if (i + batchSize < locations.length) {
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }

        // Filter out locations without coordinates
        const validLocations = geocoded.filter((loc) => loc.position)
        setGeocodedLocations(validLocations)
      } catch (err) {
        console.error('Error geocoding locations:', err)
        setError('Failed to load location data')
      } finally {
        setIsLoading(false)
      }
    }

    geocodeLocations()
  }, [locations])

  // Initialize map once geocoding is complete
  useEffect(() => {
    if (isLoading || !mapRef.current || geocodedLocations.length === 0) return

    async function initMap() {
      try {
        if (!window.google?.maps) {
          throw new Error('Google Maps library not loaded')
        }

        // Calculate center point (average of all locations)
        const avgLat = geocodedLocations.reduce((sum, loc) => sum + (loc.position?.lat || 0), 0) / geocodedLocations.length
        const avgLng = geocodedLocations.reduce((sum, loc) => sum + (loc.position?.lng || 0), 0) / geocodedLocations.length
        const center = { lat: avgLat, lng: avgLng }

        let map: any
        let bounds: any
        let InfoWindow: any

        // Try new API first, fallback to classic API
        if (window.google.maps.importLibrary) {
          try {
            const mapsLib = await window.google.maps.importLibrary('maps')
            const markerLib = await window.google.maps.importLibrary('marker')
            const coreLib = await window.google.maps.importLibrary('core')
            
            const MapClass = mapsLib.Map
            const AdvancedMarkerElement = markerLib.AdvancedMarkerElement
            const LatLngBoundsClass = coreLib.LatLngBounds
            InfoWindow = window.google.maps.InfoWindow

            // Create map with new API
            map = new MapClass(mapRef.current as HTMLElement, {
              zoom: 6,
              center,
              mapId: '9873b6859aa7ba6a2c1fdcdf',
              disableDefaultUI: false,
              zoomControl: true,
              mapTypeControl: true,
              scaleControl: true,
              streetViewControl: true,
              rotateControl: true,
              fullscreenControl: true,
            })

            mapInstanceRef.current = map
            bounds = new LatLngBoundsClass()

            // Count locations per city
            const cityCounts = new Map<string, number>()
            geocodedLocations.forEach((loc) => {
              const cityKey = `${loc.city}-${loc.state}`
              cityCounts.set(cityKey, (cityCounts.get(cityKey) || 0) + 1)
            })

            // Clear existing markers and info windows
            markersRef.current.forEach((marker) => {
              marker.map = null
            })
            infoWindowsRef.current.forEach((iw) => {
              iw.close()
            })
            markersRef.current = []
            infoWindowsRef.current = []

            // Create markers with new API
            geocodedLocations.forEach((location) => {
              if (!location.position) return

              const cityKey = `${location.city}-${location.state}`
              const cityCount = cityCounts.get(cityKey) || 1
              const label = generateMarkerLabel(location, cityCount)

              const markerContent = buildMarkerContent(label)
              const marker = new AdvancedMarkerElement({
                map,
                content: markerContent,
                position: location.position,
                title: location.businessName,
              })

              const infoContent = buildInfoWindowContent(location)
              const infoWindow = new InfoWindow({
                content: infoContent,
              })

              marker.addListener('click', () => {
                infoWindowsRef.current.forEach((iw) => {
                  iw.close()
                })
                infoWindow.open({
                  anchor: marker,
                  map,
                })
              })

              markersRef.current.push(marker)
              infoWindowsRef.current.push(infoWindow)
              bounds.extend(location.position)
            })

            if (geocodedLocations.length > 0) {
              map.fitBounds(bounds, { padding: 50 })
            }
            return
          } catch (newApiError) {
            console.warn('New API failed, falling back to classic API:', newApiError)
            // Fall through to classic API
          }
        }

        // Classic API fallback
        const MapClass = window.google.maps.Map
        const Marker = window.google.maps.Marker
        const LatLngBoundsClass = window.google.maps.LatLngBounds
        InfoWindow = window.google.maps.InfoWindow

        map = new MapClass(mapRef.current as HTMLElement, {
          zoom: 6,
          center,
          mapId: '9873b6859aa7ba6a2c1fdcdf',
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: true,
          scaleControl: true,
          streetViewControl: true,
          rotateControl: true,
          fullscreenControl: true,
        })

        mapInstanceRef.current = map
        bounds = new LatLngBoundsClass()

        // Count locations per city
        const cityCounts = new Map<string, number>()
        geocodedLocations.forEach((loc) => {
          const cityKey = `${loc.city}-${loc.state}`
          cityCounts.set(cityKey, (cityCounts.get(cityKey) || 0) + 1)
        })

        // Clear existing markers and info windows
        markersRef.current.forEach((marker) => {
          marker.setMap(null)
        })
        infoWindowsRef.current.forEach((iw) => {
          iw.close()
        })
        markersRef.current = []
        infoWindowsRef.current = []

        // Create markers with classic API
        geocodedLocations.forEach((location) => {
          if (!location.position) return

          const cityKey = `${location.city}-${location.state}`
          const cityCount = cityCounts.get(cityKey) || 1
          const label = generateMarkerLabel(location, cityCount)

          const marker = new Marker({
            map,
            position: location.position,
            title: location.businessName,
            label: {
              text: label,
              color: 'white',
              fontWeight: 'bold',
              fontSize: '11px',
            },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 20,
              fillColor: '#dc2626',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          })

          const infoContent = buildInfoWindowContent(location)
          const infoWindow = new InfoWindow({
            content: infoContent,
          })

          marker.addListener('click', () => {
            infoWindowsRef.current.forEach((iw) => {
              iw.close()
            })
            infoWindow.open(map, marker)
          })

          markersRef.current.push(marker)
          infoWindowsRef.current.push(infoWindow)
          bounds.extend(location.position)
        })

        if (geocodedLocations.length > 0) {
          map.fitBounds(bounds, { padding: 50 })
        }
      } catch (err) {
        console.error('Error initializing map:', err)
        setError('Failed to initialize map')
      }
    }

    // Load Google Maps script if not already loaded
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setError('Google Maps API key not configured')
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    
    if (existingScript) {
      // Script exists, wait for it to be ready
      const checkReady = () => {
        if (window.google?.maps) {
          // Wait a bit more for libraries to be fully initialized
          setTimeout(() => {
            try {
              initMap()
            } catch (err) {
              console.error('Error initializing map after script load:', err)
              setError('Failed to initialize map. Please refresh the page.')
            }
          }, 200)
        } else {
          setTimeout(checkReady, 50)
        }
      }
      checkReady()
    } else if (window.google?.maps) {
      // Maps already loaded
      try {
        initMap()
      } catch (err) {
        console.error('Error initializing map:', err)
        setError('Failed to initialize map. Please refresh the page.')
      }
    } else {
      // Need to load script
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=marker`
      script.async = true
      script.defer = true
      script.onerror = () => {
        setError('Failed to load Google Maps. Please check your API key and try again.')
      }
      script.onload = () => {
        // Wait for Google Maps to be fully initialized
        const checkReady = () => {
          if (window.google?.maps) {
            // Give it a moment for all libraries to be available
            setTimeout(() => {
              try {
                initMap()
              } catch (err) {
                console.error('Error initializing map after script load:', err)
                setError('Failed to initialize map. Please refresh the page.')
              }
            }, 300)
          } else {
            setTimeout(checkReady, 50)
          }
        }
        checkReady()
      }
      document.head.appendChild(script)
    }
  }, [isLoading, geocodedLocations])

  function buildMarkerContent(label: string) {
    const content = document.createElement('div')
    content.className = 'location-marker-icon'
    content.innerHTML = `
      <div class="marker-icon-badge">
        <span class="marker-label">${label}</span>
      </div>
    `
    return content
  }

  function buildInfoWindowContent(location: Location) {
    const content = document.createElement('div')
    content.className = 'info-window-content'
    content.innerHTML = `
      <div class="info-window">
        <h3 class="info-window-title">${location.businessName}</h3>
        <div class="info-window-details">
          <p class="info-window-address">
            <strong>Address:</strong><br/>
            ${location.address}<br/>
            ${location.city}, ${location.state}${location.zipCode ? ` ${location.zipCode}` : ''}
          </p>
          ${location.phone ? `<p class="info-window-phone"><strong>Phone:</strong> <a href="tel:${location.phone}">${location.phone}</a></p>` : ''}
          ${location.website ? `<p class="info-window-website"><strong>Website:</strong> <a href="${location.website}" target="_blank" rel="noopener noreferrer">Visit Website</a></p>` : ''}
        </div>
      </div>
    `
    return content
  }

  if (error) {
    return (
      <div className="mb-16 card surface-shadow border-2 border-dashed border-red-300 p-12 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="mb-16">
      <div className="card surface-shadow overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
            Find Us on the Map
          </h2>
          <p className="text-muted-foreground">
            {geocodedLocations.length > 0 
              ? `${geocodedLocations.length} locations displayed on the map`
              : 'Loading locations...'}
          </p>
        </div>
        <div className="relative" style={{ height: '600px', width: '100%' }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-salsa-600" />
                <p className="text-muted-foreground">Loading map and locations...</p>
              </div>
            </div>
          )}
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>
      
      <style jsx global>{`
        .location-marker-icon {
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .marker-icon-badge {
          background: #dc2626;
          color: white;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          border: 2px solid white;
          transition: all 0.2s;
        }
        
        .location-marker-icon:hover .marker-icon-badge {
          transform: scale(1.15);
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.5);
          z-index: 1000;
        }
        
        .marker-label {
          font-weight: 700;
          font-size: 11px;
          text-align: center;
          line-height: 1;
          letter-spacing: 0.5px;
        }
        
        .info-window-content {
          min-width: 250px;
          max-width: 300px;
        }
        
        .info-window {
          padding: 0;
        }
        
        .info-window-title {
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 12px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid #dc2626;
        }
        
        .info-window-details {
          font-size: 14px;
          color: #4b5563;
        }
        
        .info-window-address {
          margin: 0 0 8px 0;
          line-height: 1.5;
        }
        
        .info-window-phone,
        .info-window-website {
          margin: 8px 0;
        }
        
        .info-window-phone a,
        .info-window-website a {
          color: #dc2626;
          text-decoration: none;
        }
        
        .info-window-phone a:hover,
        .info-window-website a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

