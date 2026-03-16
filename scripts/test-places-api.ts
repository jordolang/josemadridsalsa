// Test the Google Places API key directly
async function testPlacesApiKey() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.error('No API key found')
    return
  }

  console.log('API Key present:', !!apiKey)
  console.log('API Key length:', apiKey?.length)

  // Test a simple Places API call
  const testPlaceId = 'ChIJX8wwy7QC6IkR4HLZ0KJxO4c' // A known place ID

  try {
    const url = `https://places.googleapis.com/v1/places/${testPlaceId}`
    console.log('Testing URL:', url.replace(/key=[^&]+/, 'key=***'))

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName',
      },
    })

    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))

    if (response.ok) {
      const data = await response.json()
      console.log('Success! Place data:', data)
    } else {
      const error = await response.text()
      console.log('Error response:', error)
    }
  } catch (error) {
    console.error('Network error:', error)
  }
}

testPlacesApiKey()