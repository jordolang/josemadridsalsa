/**
 * Patches fumadocs-mdx to make its esbuild entry point use an absolute
 * path via path.resolve(). This prevents esbuild 0.25+'s
 * `packages: "external"` from matching the entry point as a package.
 *
 * The root cause: fumadocs-mdx passes configPath as "source.config.ts"
 * (a bare name) to esbuild's entryPoints. With `packages: "external"`,
 * esbuild 0.25+ treats this bare name as a package and externalizes it.
 * By resolving it to an absolute path first, esbuild recognizes it as
 * a file path and doesn't externalize it.
 */
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'node_modules', 'fumadocs-mdx', 'dist');

if (!fs.existsSync(baseDir)) {
  console.log('[patch-fumadocs] fumadocs-mdx dist not found, skipping');
  process.exit(0);
}

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

    // Look for the compileConfig function that has the esbuild build() call
    // with `in: configPath` in the entryPoints
    if ((content.includes('packages: "external"') || content.includes("packages: 'external'"))
        && content.includes('in: configPath')) {

      // Wrap configPath with path.resolve() so esbuild gets an absolute path.
      // Also add `const __path = require("path");` or import if not present.
      let updated = content;

      // For CJS files
      if (entry.name.endsWith('.cjs')) {
        // Add path require at the top if not already there
        if (!updated.includes('require("node:path")') && !updated.includes("require('node:path')")) {
          if (!updated.includes('require("path")') && !updated.includes("require('path')")) {
            updated = `const __patchPath = require("path");\n` + updated;
          }
        }

        // Replace `in: configPath` with `in: require("path").resolve(configPath)`
        updated = updated.replace(
          /in:\s*configPath,\s*\n?\s*out:\s*"source\.config"/g,
          'in: require("path").resolve(configPath),\n\t\t\tout: "source.config"'
        );
      } else {
        // For ESM files - use the already-imported path or add import
        // Replace `in: configPath` with resolved version
        // Use inline import since the file likely already has node:url imported
        updated = updated.replace(
          /in:\s*configPath,\s*\n?\s*out:\s*"source\.config"/g,
          'in: configPath.startsWith("/") ? configPath : process.cwd() + "/" + configPath,\n\t\t\tout: "source.config"'
        );
      }

      if (updated !== content) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        const relPath = path.relative(baseDir, fullPath);
        console.log(`[patch-fumadocs] Patched ${relPath}: resolved configPath to absolute for esbuild entry point`);
        patched = true;
      }
    }
  }
}

scanDir(baseDir);

if (!patched) {
  console.log('[patch-fumadocs] No files needed patching (already patched or different version)');
}
