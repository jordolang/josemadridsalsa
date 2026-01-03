// Test the image proxy endpoint
async function testImageProxy() {
  const testPlaceId = 'ChIJX8wwy7QC6IkR4HLZ0KJxO4c' // Example Google Place ID for a Meijer store

  try {
    console.log('Testing image-proxy with Place ID...')
    const response = await fetch(`http://localhost:3000/api/image-proxy?placeId=${testPlaceId}`)
    console.log('Status:', response.status)
    console.log('Content-Type:', response.headers.get('content-type'))
    console.log('Response OK:', response.ok)

    if (response.ok) {
      console.log('Image proxy working!')
    } else {
      const error = await response.text()
      console.log('Error:', error)
    }
  } catch (error) {
    console.error('Network error:', error)
  }
}

testImageProxy()