import { Metadata } from 'next';
import { LocationCard } from './_components/LocationCard';
import { LocationsMap } from './_components/LocationsMap';
import { parseFindUsMarkdown, readFindUsMarkdownAbsolute, buildStreetViewOrMapImageUrl } from '@/lib/find-us-parser';
import { MapPin } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { createMetadata } from '@/lib/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Find Us Locally - Jose Madrid Salsa',
  description: 'Find Jose Madrid Salsa at retail stores near you. Browse our locations by city and state across Ohio, Pennsylvania, Kentucky, Michigan, Indiana, and Wisconsin.',
  pathname: '/find-us',
});

// Ensure Node.js runtime so fs access works on Vercel
export const runtime = 'nodejs';

// Force dynamic rendering to avoid prerender issues with file system access
export const dynamic = 'force-dynamic';

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
  // Load from markdown file to get all 155 locations
  const mdPath = await readFindUsMarkdownAbsolute();
  const parsedLocations = await parseFindUsMarkdown(mdPath);
  
  // Try to load from database for photos, but fallback if database is unavailable (during build)
  let dbLocations: Array<{
    businessName: string;
    address: string;
    phone: string | null;
    website: string | null;
    photoUrl: string | null;
  }> = [];
  
  try {
    dbLocations = await prisma.retailLocation.findMany({
      where: { isActive: true },
      select: {
        businessName: true,
        address: true,
        phone: true,
        website: true,
        photoUrl: true,
      },
      orderBy: [
        { state: 'asc' },
        { city: 'asc' },
        { sortOrder: 'asc' },
        { businessName: 'asc' },
      ],
    });
  } catch (error) {
    // Database not available during build - that's okay, we'll use markdown data only
    console.log('Database not available during build, using markdown data only');
  }

  // Create a map of database locations by business name + address for photo lookup
  const dbLocationMap = new Map(
    dbLocations.map(loc => [`${loc.businessName}-${loc.address}`, loc])
  );

  // Merge markdown data with database photos
  const locations = parsedLocations.map(loc => {
    const dbLoc = dbLocationMap.get(`${loc.businessName}-${loc.address}`);
    return {
      id: loc.id,
      businessName: loc.businessName,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      zipCode: loc.zipCode,
      phone: loc.phone || dbLoc?.phone || null,
      website: loc.website || dbLoc?.website || null,
      photoUrl: dbLoc?.photoUrl || buildStreetViewOrMapImageUrl(loc.address, loc.city, loc.state),
    };
  });

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
            
            {/* Interactive Map with All Locations */}
            <LocationsMap locations={locations} />

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
