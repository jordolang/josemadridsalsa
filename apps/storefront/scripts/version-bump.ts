/**
 * Cut a release: bump the version everywhere and close off the changelog.
 *
 *   npm run version:feature   --workspace @jose-madrid/storefront   # 2.0  → 2.1
 *   npm run version:increment --workspace @jose-madrid/storefront   # 2.1  → 2.1a
 *   npm run version:major     --workspace @jose-madrid/storefront   # 2.7c → 3.0
 *
 * Options: `--title "Returns & Reporting"` names the release, `--dry-run` prints the plan and
 * writes nothing.
 *
 * What it changes:
 *
 * 1. `projectVersion` in the root `package.json` — the canonical version, letters and all.
 * 2. `version` in the root and every workspace `package.json` — the SemVer form npm needs.
 * 3. `CHANGELOG.md` — renames the `## [Unreleased]` heading to the new version with today's
 *    date, and opens a fresh empty `## [Unreleased]` above it.
 *
 * It deliberately does **not** commit, tag, or push. A release that tags itself before anyone
 * has looked at the diff is how a wrong version number becomes permanent.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import {
  bumpProjectVersion,
  fromSemver,
  toSemver,
  VERSIONED_PACKAGE_FILES,
  type VersionBump,
} from '../lib/version'

/** Monorepo root, from `apps/storefront/scripts`. */
const ROOT = resolve(__dirname, '..', '..', '..')

const PACKAGE_FILES = VERSIONED_PACKAGE_FILES

function parseArgs(argv: string[]) {
  const bump = argv.find((arg) => ['major', 'feature', 'increment'].includes(arg)) as
    | VersionBump
    | undefined

  // Everything after --title up to the next flag, rejoined. npm strips the quotes when
  // forwarding args through `npm run … --`, so a multi-word title arrives as several argv
  // entries and reading only the next one would title the release "Returns,".
  const titleIndex = argv.indexOf('--title')
  let title: string | undefined
  if (titleIndex >= 0) {
    const words: string[] = []
    for (let i = titleIndex + 1; i < argv.length; i += 1) {
      if (argv[i].startsWith('--')) break
      words.push(argv[i])
    }
    title = words.join(' ').trim() || undefined
  }

  return { bump, title, dryRun: argv.includes('--dry-run') }
}

/**
 * Read the current version.
 *
 * `projectVersion` wins when present. Falling back to deriving it from `version` is what makes
 * the very first run work on a repository that only has SemVer — 2.0.0 reads as 2.0.
 */
async function readCurrentVersion(): Promise<string> {
  const raw = await readFile(join(ROOT, 'package.json'), 'utf-8')
  const pkg = JSON.parse(raw) as { version?: string; projectVersion?: string }

  if (pkg.projectVersion) return pkg.projectVersion
  if (pkg.version) return fromSemver(pkg.version)

  throw new Error('Root package.json has neither projectVersion nor version')
}

async function updatePackageFile(
  relativePath: string,
  semver: string,
  projectVersion: string | null,
  dryRun: boolean
): Promise<string | null> {
  const path = join(ROOT, relativePath)

  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch {
    // A workspace that is not checked out is not an error worth stopping a release for.
    return null
  }

  // Edited as text rather than re-serialised from JSON.parse, so key order, indentation and the
  // trailing newline survive. A release should not reformat six package.json files.
  let next = raw.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${semver}"`)

  if (projectVersion !== null) {
    if (/"projectVersion"\s*:/.test(next)) {
      next = next.replace(/("projectVersion"\s*:\s*)"[^"]*"/, `$1"${projectVersion}"`)
    } else {
      // Sits directly after "version" so the two are read together.
      next = next.replace(
        /("version"\s*:\s*"[^"]*",)/,
        `$1\n  "projectVersion": "${projectVersion}",`
      )
    }
  }

  if (next === raw) return null
  if (!dryRun) await writeFile(path, next, 'utf-8')
  return relativePath
}

/**
 * Carry the new version into `package-lock.json`.
 *
 * npm keeps a copy of each workspace's version in the lockfile — once at the top,
 * once in `packages[""]`, and once per workspace entry. Leaving them behind does
 * not break a build, but the next `npm install` rewrites the tracked file, so the
 * bump commit is followed by a mystery diff; and anything reading package
 * metadata out of the lock reports the previous release.
 *
 * Edited as text for the same reason the package files are: re-serialising a
 * 30,000-line lockfile to change six numbers would bury the release in noise.
 */
async function updateLockfile(
  files: readonly string[],
  semver: string,
  dryRun: boolean
): Promise<string | null> {
  const path = join(ROOT, 'package-lock.json')

  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch {
    return null
  }

  // The two at the top: the lockfile's own version, and the root package entry.
  let next = raw.replace(/^(\s*"version"\s*:\s*)"[^"]*"/m, `$1"${semver}"`)
  next = next.replace(
    /("": \{\n(?:\s+"name": "[^"]*",\n)?\s*"version": )"[^"]*"/,
    `$1"${semver}"`
  )

  // Then one per versioned workspace, matched on its own path key so a
  // dependency that happens to sit at the same version is left alone.
  for (const file of files) {
    if (file === 'package.json') continue
    const workspace = file.replace(/\/package\.json$/, '')
    const pattern = new RegExp(
      `("${workspace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}": \\{\\n(?:\\s+"name": "[^"]*",\\n)?\\s*"version": )"[^"]*"`
    )
    next = next.replace(pattern, `$1"${semver}"`)
  }

  if (next === raw) return null
  if (!dryRun) await writeFile(path, next, 'utf-8')
  return 'package-lock.json'
}

/**
 * Turn `## [Unreleased]` into the released heading and open a new empty one.
 *
 * Refuses when Unreleased has no entries under it: a version with an empty changelog section is
 * worse than no version bump, because it looks like a release nobody documented.
 */
function releaseChangelog(
  content: string,
  version: string,
  date: string,
  title: string | undefined
): { content: string; entryCount: number } {
  const lines = content.split('\n')
  const headingIndex = lines.findIndex((line) => /^## \[Unreleased\]/.test(line))

  if (headingIndex === -1) {
    throw new Error('CHANGELOG.md has no "## [Unreleased]" heading to release')
  }

  const nextHeadingOffset = lines
    .slice(headingIndex + 1)
    .findIndex((line) => /^## \[/.test(line))
  const end = nextHeadingOffset === -1 ? lines.length : headingIndex + 1 + nextHeadingOffset

  const entryCount = lines
    .slice(headingIndex + 1, end)
    .filter((line) => /^\s*-\s+\S/.test(line)).length

  const heading = title
    ? `## [${version}] — ${date} — ${title}`
    : `## [${version}] — ${date}`

  const released = [...lines]
  released[headingIndex] = heading
  released.splice(headingIndex, 0, '## [Unreleased]', '')

  return { content: released.join('\n'), entryCount }
}

async function main() {
  const { bump, title, dryRun } = parseArgs(process.argv.slice(2))

  if (!bump) {
    console.error(
      'Usage: version-bump <major|feature|increment> [--title "Release name"] [--dry-run]\n\n' +
        '  feature    a large feature — 2.0 → 2.1\n' +
        '  increment  fixes, data, filling gaps — 2.1 → 2.1a\n' +
        '  major      a deliberate platform release — 2.x → 3.0 (only when asked)\n'
    )
    process.exit(1)
  }

  const current = await readCurrentVersion()
  const next = bumpProjectVersion(current, bump)
  const semver = toSemver(next)
  const date = new Date().toISOString().slice(0, 10)

  console.log(`${current} → ${next}  (package.json ${semver})`)

  const changelogPath = join(ROOT, 'CHANGELOG.md')
  const changelog = await readFile(changelogPath, 'utf-8')
  const { content, entryCount } = releaseChangelog(changelog, next, date, title)

  if (entryCount === 0) {
    console.error(
      '\nRefusing: [Unreleased] has no entries. Write the changelog before cutting a version.'
    )
    process.exit(1)
  }

  console.log(`Changelog: ${entryCount} entr${entryCount === 1 ? 'y' : 'ies'} under ${next}`)

  if (!dryRun) await writeFile(changelogPath, content, 'utf-8')

  const updated: string[] = []
  for (const file of PACKAGE_FILES) {
    // Only the root carries projectVersion; the workspaces just track the SemVer number.
    const result = await updatePackageFile(file, semver, file === 'package.json' ? next : null, dryRun)
    if (result) updated.push(result)
  }

  const lock = await updateLockfile(PACKAGE_FILES, semver, dryRun)
  if (lock) updated.push(lock)

  console.log(`Updated: ${updated.join(', ')}`)

  if (dryRun) {
    console.log('\nDry run — nothing written.')
  } else {
    console.log(`\nReview the diff, then: git tag v${next}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
