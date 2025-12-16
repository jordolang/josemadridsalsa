#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACES_API_BASE = 'https://places.googleapis.com/v1';

// Test with Campbell's Foodland
const testPlaceId = 'ChIJR75CR8jvN4gR26bHdO_P5K8';

async function testAPI() {
  console.log('Testing Google Places API...\n');
  console.log('API Key:', API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NOT FOUND');
  console.log('Place ID:', testPlaceId);
  console.log('');

  try {
    const response = await fetch(`${PLACES_API_BASE}/places/${testPlaceId}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': [
          'rating',
          'userRatingCount',
          'internationalPhoneNumber',
          'nationalPhoneNumber',
          'websiteUri',
          'regularOpeningHours.weekdayDescriptions',
          'currentOpeningHours.weekdayDescriptions',
        ].join(','),
      },
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const text = await response.text();
      console.error('Error response:', text);
      return;
    }

    const data = await response.json();
    console.log('\n=== RESPONSE DATA ===');
    console.log('Rating:', data.rating);
    console.log('Review Count:', data.userRatingCount);
    console.log('Phone:', data.nationalPhoneNumber || data.internationalPhoneNumber);
    console.log('Website:', data.websiteUri);
    console.log('Hours:', data.currentOpeningHours?.weekdayDescriptions || data.regularOpeningHours?.weekdayDescriptions || 'None');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI();
