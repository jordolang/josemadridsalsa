/**
 * Patches fumadocs-mdx to replace `packages: "external"` with a plugin
 * that externalizes node_modules without catching the entry point.
 *
 * esbuild 0.25+ treats `packages: "external"` as also externalizing
 * entry points, which breaks fumadocs-mdx's compilation of source.config.ts.
 *
 * The fix: use an esbuild plugin with an onResolve filter that only
 * externalizes imports that look like bare package specifiers, excluding
 * anything that could be an entry point (like "source.config.ts").
 */
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'node_modules', 'fumadocs-mdx', 'dist');

if (!fs.existsSync(baseDir)) {
  console.log('[patch-fumadocs] fumadocs-mdx dist not found, skipping');
  process.exit(0);
}

/**
 * The plugin externalizes bare package specifiers (e.g. "fumadocs-mdx/config",
 * "esbuild", "@scope/pkg") but NOT:
 * - Relative paths ("./foo", "../bar")
 * - Absolute paths ("/foo/bar")
 * - The entry point file ("source.config.ts" or similar)
 *
 * We detect entry points by checking if the path ends in a known config
 * extension pattern.
 */
const PLUGIN_CODE = `plugins: [{
        name: "externalize-deps",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            if (args.kind === "entry-point") return undefined;
            if (args.path.startsWith(".") || args.path.startsWith("/")) return undefined;
            if (args.path.includes("source.config")) return undefined;
            return { path: args.path, external: true };
          });
        }
      }]`;

let patched = false;

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDir(fullPath);
      continue;
    }

    if (!entry.name.endsWith('.js') && !entry.name.endsWith('.cjs') && !entry.name.endsWith('.mjs')) {
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    if (content.includes('packages: "external"') || content.includes("packages: 'external'")) {
      const updated = content
        .replace(/packages:\s*"external"/g, PLUGIN_CODE)
        .replace(/packages:\s*'external'/g, PLUGIN_CODE);

      fs.writeFileSync(fullPath, updated, 'utf8');
      const relPath = path.relative(baseDir, fullPath);
      console.log(`[patch-fumadocs] Patched ${relPath}: replaced packages:"external" with externalize plugin`);
      patched = true;
    }
  }
}

scanDir(baseDir);

if (!patched) {
  console.log('[patch-fumadocs] No files needed patching (already patched or different version)');
}
