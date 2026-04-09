/**
 * Patches fumadocs-mdx to remove `packages: "external"` from its esbuild
 * config. This prevents esbuild 0.25+ from externalizing the entry point
 * `source.config.ts`, which causes a build failure.
 *
 * Instead of externalizing all packages, we let esbuild bundle them.
 * The compiled output is a small config file so bundling is fine.
 */
const fs = require('fs');
const path = require('path');

const targetFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'fumadocs-mdx',
  'dist',
  'load-from-file-vlVZ_DdD.js'
);

// Also check for any other file that might contain the compileConfig function
const distDir = path.join(__dirname, '..', 'node_modules', 'fumadocs-mdx', 'dist');

if (!fs.existsSync(distDir)) {
  console.log('[patch-fumadocs] fumadocs-mdx dist not found, skipping');
  process.exit(0);
}

let patched = false;

for (const file of fs.readdirSync(distDir)) {
  if (!file.endsWith('.js')) continue;

  const filePath = path.join(distDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('packages: "external"') && content.includes('source.config')) {
    const updated = content.replace(
      /packages:\s*"external",?\s*/g,
      ''
    );
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`[patch-fumadocs] Patched ${file}: removed packages:"external" from esbuild config`);
    patched = true;
  }
}

if (!patched) {
  console.log('[patch-fumadocs] No files needed patching (already patched or different version)');
}
