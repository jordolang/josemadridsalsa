// Test the new Google Places API key
async function testNewAPIKey() {
  const apiKey = 'AIzaSyBEMWotMhEgKVcgh44H3sx3KRWaPp_eRHA';

  console.log('🔑 Testing new API key...');

  // Test with a known place ID (a Meijer store)
  const testPlaceId = 'ChIJX8wwy7QC6IkR4HLZ0KJxO4c';

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
          console.log('🎉 New API key works perfectly!');
        } else {
          console.log('❌ Photo fetch failed');
        }
      }

    } else {
      const errorText = await response.text();
      console.log('❌ API call failed:', errorText.substring(0, 200));
    }

  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

testNewAPIKey();