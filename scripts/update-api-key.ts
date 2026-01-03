// Update .env.local with the new API key
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
const newApiKey = 'AIzaSyBEMWotMhEgKVcgh44H3sx3KRWaPp_eRHA';

console.log('🔧 Updating .env.local with new API key...');

// Read current .env.local content
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf-8');
  console.log('✅ Read existing .env.local');
} catch (error) {
  console.log('⚠️  .env.local not found, creating new one');
}

// Update or add GOOGLE_PLACES_API_KEY
const keyPattern = /^GOOGLE_PLACES_API_KEY=.*$/m;
if (keyPattern.test(envContent)) {
  envContent = envContent.replace(keyPattern, `GOOGLE_PLACES_API_KEY=${newApiKey}`);
  console.log('✅ Updated existing GOOGLE_PLACES_API_KEY');
} else {
  envContent += `\nGOOGLE_PLACES_API_KEY=${newApiKey}\n`;
  console.log('✅ Added GOOGLE_PLACES_API_KEY');
}

// Write back to file
fs.writeFileSync(envPath, envContent);
console.log('✅ Saved .env.local');

console.log('🔄 Please restart your dev server for changes to take effect.');
console.log('   Run: npm run dev');
console.log('');
console.log('📝 After restarting, test the find-us page to see if images load from Google Places.');