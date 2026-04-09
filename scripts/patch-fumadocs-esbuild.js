/**
 * Patches fumadocs-mdx to replace `packages: "external"` with a plugin
 * that externalizes node_modules without catching the entry point.
 *
 * esbuild 0.25+ treats `packages: "external"` as also externalizing
 * entry points, which breaks fumadocs-mdx's compilation of source.config.ts.
 *
 * The fix: use an esbuild plugin with a filter that only externalizes
 * bare specifiers (package imports), not file paths (entry points).
 */
const fs = require('fs');
const path = require('path');

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
    // Replace `packages: "external"` with a plugin that externalizes bare
    // specifiers (node_modules) but not file paths or entry points.
    const updated = content.replace(
      /packages:\s*"external"/g,
      `plugins: [{
        name: "externalize-packages",
        setup(b) {
          b.onResolve({ filter: /^[^./]/ }, (args) => ({
            path: args.path,
            external: true
          }));
        }
      }]`
    );
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`[patch-fumadocs] Patched ${file}: replaced packages:"external" with externalize plugin`);
    patched = true;
  }
}

if (!patched) {
  console.log('[patch-fumadocs] No files needed patching (already patched or different version)');
}
