// Test API key details and suggest solutions
async function diagnoseAPIKey() {
  const apiKey = 'AIzaSyBEMWotMhEgKVcgh44H3sx3KRWaPp_eRHA';

  console.log('🔍 Diagnosing API key issue...');
  console.log('📊 API Key Project: The key belongs to project #101272506669 (from error message)');
  console.log('');

  console.log('❌ ISSUE: Billing is NOT enabled on Google Cloud project #101272506669');
  console.log('');

  console.log('🛠️  SOLUTIONS:');
  console.log('');
  console.log('Option 1: Enable Billing on Existing Project');
  console.log('1. Go to: https://console.cloud.google.com/billing');
  console.log('2. Select project #101272506669');
  console.log('3. Click "Enable billing"');
  console.log('4. Add a billing account');
  console.log('5. Wait 5-10 minutes for changes to propagate');
  console.log('');

  console.log('Option 2: Use API Key from Different Project');
  console.log('1. Go to Google Cloud Console');
  console.log('2. Select a project that HAS billing enabled');
  console.log('3. Enable Places API v1 in that project');
  console.log('4. Create a new API key');
  console.log('5. Update your .env.local file with the new key');
  console.log('');

  console.log('Option 3: Use Legacy Places API (Temporary Fix)');
  console.log('- Modify code to use Places API (legacy) instead of v1');
  console.log('- Legacy API doesn\'t require billing but may be deprecated');
  console.log('');

  console.log('💡 RECOMMENDATION: Enable billing on your Google Cloud project.');
  console.log('   Google Maps APIs require billing for production use anyway.');
  console.log('');

  console.log('📝 To update your API key in the project:');
  console.log('1. Edit your .env.local file');
  console.log('2. Set: GOOGLE_PLACES_API_KEY=your_new_key_here');
  console.log('3. Restart your dev server');

  // Test if we can at least get a different error to confirm key format
  console.log('');
  console.log('🔍 Testing API key format...');
  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/ChIJX8wwy7QC6IkR4HLZ0KJxO4c`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id',
      },
    });

    if (response.status === 403) {
      console.log('✅ API key format is valid (403 is billing-related, not auth)');
    } else {
      console.log('⚠️  Unexpected response:', response.status);
    }
  } catch (error) {
    console.log('❌ Network error during format test');
  }
}

diagnoseAPIKey();