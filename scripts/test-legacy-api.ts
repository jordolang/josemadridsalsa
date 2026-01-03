// Test legacy Places API with the provided key
async function testLegacyAPI() {
  const apiKey = 'AIzaSyBEMWotMhEgKVcgh44H3sx3KRWaPp_eRHA';

  console.log('🔑 Testing legacy Places API...');

  // Test place search
  const query = 'Meijer Adrian Ohio';
  const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address,photos&key=${apiKey}`;

  try {
    console.log('📍 Testing place search...');
    const response = await fetch(searchUrl);

    console.log('📊 Search response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Search result:', data.status);

      if (data.candidates && data.candidates.length > 0) {
        const place = data.candidates[0];
        console.log('🏪 Found place:', place.name);
        console.log('📍 Address:', place.formatted_address);

        if (place.photos && place.photos.length > 0) {
          console.log('🖼️  Photos found:', place.photos.length);

          // Test photo fetch
          const photoRef = place.photos[0].photo_reference;
          const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?photoreference=${photoRef}&key=${apiKey}&maxwidth=400`;

          console.log('🖼️  Testing photo fetch...');
          const photoResponse = await fetch(photoUrl);
          console.log('🖼️  Photo response status:', photoResponse.status);

          if (photoResponse.ok) {
            console.log('🎉 Legacy API works! Images should load now.');
          } else {
            console.log('❌ Photo fetch failed');
          }
        } else {
          console.log('❌ No photos found for this place');
        }
      } else {
        console.log('❌ No places found');
      }
    } else {
      console.log('❌ Search failed');
    }

  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

testLegacyAPI();