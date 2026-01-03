import 'dotenv/config';

// Test Google Places API key directly
async function testGooglePlacesAPI() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('❌ No API key found in environment variables');
    console.log('Please check that GOOGLE_PLACES_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set in your .env.local file');
    return;
  }

  console.log('🔑 API Key found:', apiKey.substring(0, 10) + '...');
  console.log('🔗 Testing Google Places API v1...');

  // Test with a known place ID (a Meijer store)
  const testPlaceId = 'ChIJX8wwy7QC6IkR4HLZ0KJxO4c'; // Example place ID

  try {
    console.log('📍 Testing place details fetch...');
    const response = await fetch(`https://places.googleapis.com/v1/places/${testPlaceId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,photos',
      },
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success! Place data:', {
        id: data.id,
        displayName: data.displayName?.text,
        photosCount: data.photos?.length || 0,
      });

      // Test photo URL if photos exist
      if (data.photos && data.photos.length > 0) {
        console.log('🖼️  Testing photo fetch...');
        const photoName = data.photos[0].name;
        const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${apiKey}&maxWidthPx=400`;

        const photoResponse = await fetch(photoUrl);
        console.log('🖼️  Photo response status:', photoResponse.status);

        if (photoResponse.ok) {
          console.log('✅ Photo fetch successful!');
        } else {
          const error = await photoResponse.text();
          console.log('❌ Photo fetch failed:', error.substring(0, 200));
        }
      }

      console.log('\n🎉 Google Places API is working correctly!');
      console.log('💡 The issue might be with specific place IDs or quota limits.');

    } else {
      const errorText = await response.text();
      console.log('❌ API call failed:', errorText.substring(0, 500));

      if (response.status === 403) {
        console.log('\n🚫 403 Forbidden - Common causes:');
        console.log('  • API key is invalid or expired');
        console.log('  • API key does not have Places API enabled');
        console.log('  • API key has exceeded quota');
        console.log('  • API key has wrong restrictions (IP/domain)');
        console.log('\n🔧 Solutions:');
        console.log('  1. Check Google Cloud Console for API key status');
        console.log('  2. Enable Places API v1 in Google Cloud Console');
        console.log('  3. Check API key restrictions');
        console.log('  4. Verify billing is enabled');
      } else if (response.status === 400) {
        console.log('\n❌ 400 Bad Request - Check API key format');
      }
    }

  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

testGooglePlacesAPI();