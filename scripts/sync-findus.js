const fs = require('fs');
const path = require('path');

const spaced = path.join(process.cwd(), 'public', 'Find Us Locally', 'Find Us Locally.md');
const kebab = path.join(process.cwd(), 'public', 'find-us-locally', 'find-us-locally.md');

try {
  if (fs.existsSync(spaced)) {
    const content = fs.readFileSync(spaced, 'utf-8');
    fs.mkdirSync(path.dirname(kebab), { recursive: true });
    fs.writeFileSync(kebab, content, 'utf-8');
    console.log('Synced find-us markdown to kebab-case path');
  } else {
    console.log('Spaced find-us markdown not found; skipping sync');
  }
} catch (e) {
  console.error('Failed to sync find-us markdown:', e.message);
  process.exit(0);
}


