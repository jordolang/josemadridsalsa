// Test calling the fetch-photos API
async function testFetchPhotos() {
  try {
    const response = await fetch('http://localhost:3000/api/admin/locations/fetch-photos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ force: true }), // Force update all photos
    })

    console.log('Response status:', response.status)

    if (response.ok) {
      const result = await response.json()
      console.log('Result:', result)
    } else {
      const error = await response.text()
      console.log('Error:', error)
    }
  } catch (error) {
    console.error('Network error:', error)
  }
}

testFetchPhotos()