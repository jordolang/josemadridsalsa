import { Metadata } from 'next';
import { LocationCard } from './_components/LocationCard';
import { parseFindUsMarkdown, readFindUsMarkdownAbsolute, buildStreetViewOrMapImageUrl } from '@/lib/find-us-parser';
import { MapPin } from 'lucide-react';
import fs from 'fs/promises';
import path from 'path';

export const metadata: Metadata = {
  title: 'Find Us Locally - Jose Madrid Salsa',
  description: 'Find Jose Madrid Salsa at retail stores near you. Browse our locations by city and state across Ohio, Pennsylvania, Kentucky, Michigan, Indiana, and Wisconsin.',
  openGraph: {
    title: 'Find Us Locally - Jose Madrid Salsa',
    description: 'Find Jose Madrid Salsa at retail stores near you. Browse our locations across multiple states.',
    images: ['/og-find-us.jpg'],
  },
};

// Type for grouped locations
type LocationsByCity = Record<string, Array<{
  id: string;
  businessName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string | null;
  phone: string | null;
  website: string | null;
  photoUrl: string | null;
}>>;

type LocationsByState = Record<string, LocationsByCity>;

export default async function FindUsPage() {
  // Read and parse markdown into locations
  const mdPath = await readFindUsMarkdownAbsolute();
  const parsed = await parseFindUsMarkdown(mdPath);

  // Optional: overlay photo URLs from a pre-generated map (Google Places photos)
  const photosMapPath = path.join(process.cwd(), 'public', 'location-photos.json');
  let photosMap: Record<string, string> = {};
  try {
    const file = await fs.readFile(photosMapPath, 'utf-8');
    photosMap = JSON.parse(file) as Record<string, string>;
  } catch {
    // no pre-generated photos map, fall back to Street View
  }

  // Enrich with photoUrl using pre-generated photo map or Street View fallback
  const locations = parsed.map(loc => ({
    ...loc,
    photoUrl: photosMap[loc.id] || buildStreetViewOrMapImageUrl(loc.address, loc.city, loc.state),
  }));

  // Separate Ohio from other states
  const ohioLocations = locations.filter(loc => loc.state === 'OH');
  const otherLocations = locations.filter(loc => loc.state !== 'OH');

  // Group Ohio by city
  const ohioByCity: LocationsByCity = {};
  ohioLocations.forEach(location => {
    const cityKey = location.city.toLowerCase();
    if (!ohioByCity[cityKey]) {
      ohioByCity[cityKey] = [];
    }
    ohioByCity[cityKey].push(location);
  });

  // Sort Ohio cities alphabetically
  const sortedOhioCities = Object.keys(ohioByCity).sort((a, b) => 
    ohioByCity[a][0].city.localeCompare(ohioByCity[b][0].city)
  );

  // Group other states by state, then city
  const otherByState: LocationsByState = {};
  otherLocations.forEach(location => {
    const stateKey = location.state;
    const cityKey = location.city.toLowerCase();
    
    if (!otherByState[stateKey]) {
      otherByState[stateKey] = {};
    }
    if (!otherByState[stateKey][cityKey]) {
      otherByState[stateKey][cityKey] = [];
    }
    otherByState[stateKey][cityKey].push(location);
  });

  // Sort states and cities
  const sortedStates = Object.keys(otherByState).sort();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-salsa-600 via-salsa-500 to-chile-600 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative container mx-auto px-4 py-16 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <MapPin className="w-16 h-16 mx-auto mb-6 text-white/90" />
            <h1 className="text-4xl lg:text-6xl font-serif font-bold mb-6 text-shadow-lg">
              Find Us Locally
            </h1>
            <p className="text-xl lg:text-2xl text-salsa-100 max-w-2xl mx-auto leading-relaxed">
              Discover Jose Madrid Salsa at retail stores near you. Available at {locations.length} locations across multiple states.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            
            {/* TODO: Ohio County Map - Coming Soon */}
            {/* 
              Future Feature: Interactive Ohio County Map
              - Display clickable county map of Ohio
              - On county click, filter and display only businesses in that county
              - Requires county data for each location (currently null)
              - Map implementation options: react-simple-maps, custom SVG, or map library
            */}
            <div className="mb-16 card surface-shadow border-2 border-dashed border-salsa-300 p-12 text-center">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-salsa-400" />
              <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
                Ohio County Map
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Interactive county map coming soon! Click on any Ohio county to see locations in that area.
              </p>
            </div>

            {/* Ohio Locations */}
            {ohioLocations.length > 0 && (
              <div className="mb-16">
                <div className="mb-10">
                  <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-4">
                    Ohio Locations
                  </h2>
                  <div className="h-1 w-24 bg-gradient-to-r from-salsa-500 to-chile-500 rounded-full"></div>
                  <p className="mt-4 text-muted-foreground text-lg">
                    {ohioLocations.length} locations across Ohio
                  </p>
                </div>

                {sortedOhioCities.map(cityKey => {
                  const cityLocations = ohioByCity[cityKey];
                  const cityName = cityLocations[0].city;

                  return (
                    <div key={cityKey} className="mb-12">
                      <h3 className="text-2xl font-serif font-semibold text-foreground mb-6">
                        {cityName}
                        <span className="text-sm font-normal text-muted-foreground ml-3">
                          ({cityLocations.length} location{cityLocations.length > 1 ? 's' : ''})
                        </span>
                      </h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {cityLocations.map(location => (
                          <LocationCard
                            key={location.id}
                            businessName={location.businessName}
                            address={location.address}
                            city={location.city}
                            state={location.state}
                            zipCode={location.zipCode}
                            phone={location.phone}
                            website={location.website}
                            photoUrl={location.photoUrl}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Additional Locations (Other States) */}
            {otherLocations.length > 0 && (
              <div>
                <div className="mb-10">
                  <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-4">
                    Additional Locations
                  </h2>
                  <div className="h-1 w-24 bg-gradient-to-r from-verde-500 to-salsa-500 rounded-full"></div>
                  <p className="mt-4 text-muted-foreground text-lg">
                    {otherLocations.length} locations in Pennsylvania, Kentucky, Michigan, Indiana, and Wisconsin
                  </p>
                </div>

                {sortedStates.map(state => {
                  const stateCities = otherByState[state];
                  const sortedCities = Object.keys(stateCities).sort((a, b) => 
                    stateCities[a][0].city.localeCompare(stateCities[b][0].city)
                  );

                  const stateNames: Record<string, string> = {
                    PA: 'Pennsylvania',
                    KY: 'Kentucky',
                    MI: 'Michigan',
                    IN: 'Indiana',
                    WI: 'Wisconsin',
                  };

                  return (
                    <div key={state} className="mb-12">
                      <h3 className="text-2xl font-serif font-semibold text-verde-700 mb-6">
                        {stateNames[state] || state}
                      </h3>

                      {sortedCities.map(cityKey => {
                        const cityLocations = stateCities[cityKey];
                        const cityName = cityLocations[0].city;

                        return (
                          <div key={`${state}-${cityKey}`} className="mb-10">
                            <h4 className="text-xl font-semibold text-foreground mb-4">
                              {cityName}
                              <span className="text-sm font-normal text-muted-foreground ml-3">
                                ({cityLocations.length} location{cityLocations.length > 1 ? 's' : ''})
                              </span>
                            </h4>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {cityLocations.map(location => (
                                <LocationCard
                                  key={location.id}
                                  businessName={location.businessName}
                                  address={location.address}
                                  city={location.city}
                                  state={location.state}
                                  zipCode={location.zipCode}
                                  phone={location.phone}
                                  website={location.website}
                                  photoUrl={location.photoUrl}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TODO: Future Enhancements */}
            {/*
              - Add search/filter UI using the /api/locations endpoint
              - Implement geolocation-based distance sorting
              - Add map view toggle (list vs. map)
              - Cache and revalidate location data (ISR)
            */}

          </div>
        </div>
      </section>
    </div>
  );
}
