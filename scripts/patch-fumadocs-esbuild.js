/**
 * Forces fumadocs-mdx to use esbuild 0.24.2 by installing it directly
 * into fumadocs-mdx's node_modules directory.
 *
 * esbuild 0.25+ changed `packages: "external"` to also externalize
 * entry points, breaking fumadocs-mdx's compilation of source.config.ts.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.join(__dirname, '..');
const fumadocsDir = path.join(projectRoot, 'node_modules', 'fumadocs-mdx');

if (!fs.existsSync(fumadocsDir)) {
  console.log('[patch-fumadocs] fumadocs-mdx not found, skipping');
  process.exit(0);
}

// Check the hoisted esbuild version
const hoistedEsbuild = path.join(projectRoot, 'node_modules', 'esbuild', 'package.json');
if (fs.existsSync(hoistedEsbuild)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(hoistedEsbuild, 'utf8'));
    if (pkg.version && pkg.version.startsWith('0.24.')) {
      console.log(`[patch-fumadocs] hoisted esbuild is ${pkg.version} (compatible), skipping`);
      process.exit(0);
    }
    console.log(`[patch-fumadocs] hoisted esbuild is ${pkg.version} (incompatible with fumadocs-mdx)`);
  } catch (e) {
    // Continue
  }
}

// Install esbuild 0.24.2 into a temp location, then move it
const tmpDir = path.join(projectRoot, '.esbuild-patch-tmp');

try {
  // Clean up any previous temp dir
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  // Write a minimal package.json
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    name: "esbuild-patch",
    private: true,
    dependencies: { "esbuild": "0.24.2" }
  }));

  console.log('[patch-fumadocs] Installing esbuild@0.24.2...');
  execFileSync('npm', ['install', '--ignore-scripts'], {
    cwd: tmpDir,
    stdio: 'pipe',
    timeout: 120000,
  });

  // Move esbuild into fumadocs-mdx/node_modules
  const fumadocsNodeModules = path.join(fumadocsDir, 'node_modules');
  const targetEsbuildDir = path.join(fumadocsNodeModules, 'esbuild');

  if (!fs.existsSync(fumadocsNodeModules)) {
    fs.mkdirSync(fumadocsNodeModules, { recursive: true });
  }

  // Remove existing esbuild in fumadocs-mdx if present
  if (fs.existsSync(targetEsbuildDir)) {
    fs.rmSync(targetEsbuildDir, { recursive: true, force: true });
  }

  // Copy esbuild and its platform-specific binary
  const srcEsbuildDir = path.join(tmpDir, 'node_modules', 'esbuild');
  if (fs.existsSync(srcEsbuildDir)) {
    cpRecursive(srcEsbuildDir, targetEsbuildDir);

    // Also copy the platform-specific esbuild binary package
    const tmpNodeModules = path.join(tmpDir, 'node_modules');
    for (const entry of fs.readdirSync(tmpNodeModules)) {
      if (entry.startsWith('@esbuild')) {
        const srcScopeDir = path.join(tmpNodeModules, entry);
        const targetScopeDir = path.join(fumadocsNodeModules, entry);
        if (!fs.existsSync(targetScopeDir)) {
          fs.mkdirSync(targetScopeDir, { recursive: true });
        }
        for (const pkg of fs.readdirSync(srcScopeDir)) {
          const srcPkg = path.join(srcScopeDir, pkg);
          const targetPkg = path.join(targetScopeDir, pkg);
          if (fs.existsSync(targetPkg)) {
            fs.rmSync(targetPkg, { recursive: true, force: true });
          }
          cpRecursive(srcPkg, targetPkg);
        }
      }
    }

    // Verify
    const installed = JSON.parse(fs.readFileSync(path.join(targetEsbuildDir, 'package.json'), 'utf8'));
    console.log(`[patch-fumadocs] Successfully installed esbuild@${installed.version} for fumadocs-mdx`);
  } else {
    console.error('[patch-fumadocs] esbuild not found in temp install');
  }
} catch (error) {
  console.error('[patch-fumadocs] Failed:', error.message);
} finally {
  // Clean up temp dir
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function cpRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      cpRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
