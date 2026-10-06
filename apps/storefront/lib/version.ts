/**
 * The project's version scheme.
 *
 * `MAJOR.MINOR` with an optional letter suffix:
 *
 * ```
 * 2.0    2.1    2.1a   2.1b   2.2    3.0
 * ```
 *
 * - **A large feature bumps the minor** — `2.0` → `2.1`. A new admin area, a new subsystem, a
 *   capability the business did not have yesterday.
 * - **Everything smaller takes a letter** — `2.1` → `2.1a` → `2.1b`. Bug fixes, data changes,
 *   filling gaps in a feature that already shipped, corrections to documentation.
 * - **Major is a deliberate rollout** — `2.x` → `3.0`, for a release the business is calling a
 *   new version of the platform. **Only ever on an explicit instruction.** No amount of
 *   accumulated feature work bumps the major on its own, and neither does a breaking change;
 *   `suggestBump()` cannot return it.
 *
 * This is deliberately **not** SemVer, which is why it needs its own module. SemVer's third
 * component is for consumers deciding whether an upgrade is safe; nothing consumes this
 * repository as a package, and `2.6a` says "small change on top of 2.6" more legibly to the
 * person running the business than `2.6.1` does.
 *
 * npm still requires valid SemVer in `package.json`, so the two coexist: the letter is the
 * canonical project version, and `toSemver()` derives the number npm gets. The mapping is
 * positional and stable — `a` is patch 1, `b` is patch 2 — so the two can always be read off
 * each other.
 */

export type VersionBump = 'major' | 'feature' | 'increment'

export interface ProjectVersion {
  major: number
  minor: number
  /** `undefined` on a feature release, otherwise `a`, `b`, … `z`, `aa`, `ab`, … */
  suffix?: string
}

const VERSION_PATTERN = /^(\d+)\.(\d+)([a-z]+)?$/

export function parseProjectVersion(value: string): ProjectVersion {
  const match = VERSION_PATTERN.exec(value.trim())
  if (!match) {
    throw new Error(
      `"${value}" is not a project version. Expected MAJOR.MINOR with an optional lowercase letter, like 2.1 or 2.6a.`
    )
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    suffix: match[3],
  }
}

export function formatProjectVersion(version: ProjectVersion): string {
  return `${version.major}.${version.minor}${version.suffix ?? ''}`
}

/**
 * Letter suffixes as a base-26 sequence: a…z, then aa, ab, …
 *
 * Twenty-six increments between features is not a limit worth hitting, but running out of
 * letters silently — or wrapping back to `a` and colliding with a released version — would be
 * much worse than an ugly `2.1aa`.
 */
export function nextSuffix(suffix: string | undefined): string {
  if (!suffix) return 'a'

  const chars = suffix.split('')
  let index = chars.length - 1

  while (index >= 0) {
    if (chars[index] === 'z') {
      chars[index] = 'a'
      index -= 1
    } else {
      chars[index] = String.fromCharCode(chars[index].charCodeAt(0) + 1)
      return chars.join('')
    }
  }

  // Every position wrapped: z → aa, zz → aaa.
  return `a${chars.join('')}`
}

/** Position of a suffix in the sequence. `a` is 1, `z` is 26, `aa` is 27. */
export function suffixOrdinal(suffix: string | undefined): number {
  if (!suffix) return 0

  let ordinal = 0
  for (const char of suffix) {
    ordinal = ordinal * 26 + (char.charCodeAt(0) - 96)
  }
  return ordinal
}

export function bumpProjectVersion(current: string, bump: VersionBump): string {
  const version = parseProjectVersion(current)

  switch (bump) {
    case 'major':
      return formatProjectVersion({ major: version.major + 1, minor: 0 })
    case 'feature':
      // Drops the suffix: 2.1b's next feature release is 2.2, not 2.2b.
      return formatProjectVersion({ major: version.major, minor: version.minor + 1 })
    case 'increment':
      return formatProjectVersion({ ...version, suffix: nextSuffix(version.suffix) })
  }
}

/**
 * The SemVer string npm gets. `2.1` → `2.1.0`, `2.1a` → `2.1.1`, `2.1b` → `2.1.2`.
 *
 * Monotonic within a minor, which is what matters: npm and any tooling that compares versions
 * still order releases correctly even though the letters are the names we use.
 */
export function toSemver(projectVersion: string): string {
  const version = parseProjectVersion(projectVersion)
  return `${version.major}.${version.minor}.${suffixOrdinal(version.suffix)}`
}

/**
 * Recover the project version from a SemVer string, for reading an existing `package.json`.
 * Inverse of `toSemver` for every version this scheme produces.
 */
export function fromSemver(semver: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(semver.trim())
  if (!match) {
    throw new Error(`"${semver}" is not a version number`)
  }

  const patch = Number(match[3])
  let suffix: string | undefined

  if (patch > 0) {
    // Walk the sequence rather than inverting base-26, which has no clean digit mapping
    // because 'a' is 1 rather than 0.
    suffix = undefined
    for (let i = 0; i < patch; i += 1) {
      suffix = nextSuffix(suffix)
    }
  }

  return formatProjectVersion({ major: Number(match[1]), minor: Number(match[2]), suffix })
}

/**
 * Which bump a set of changes deserves.
 *
 * Deliberately conservative: it only reports `feature` when a change looks like new capability,
 * because over-bumping the minor makes the version number stop meaning anything. The caller
 * decides; this is a suggestion for the commit-time prompt, not a rule.
 */
export function suggestBump(changelogEntries: string[]): VersionBump {
  const featureSignals = /\b(new admin|new page|adds? a|introduce|first-class|subsystem|dashboard|engine)\b/i
  const looksLikeFeature = changelogEntries.some((entry) => featureSignals.test(entry))
  return looksLikeFeature ? 'feature' : 'increment'
}

/**
 * The workspaces whose `package.json` carries the platform version.
 *
 * The two desktop apps read their version from different places: the macOS
 * bundle takes the root's (see `apps/macos-admin/build-app.sh`), while
 * electron-builder stamps the Windows installer and its `latest.yml` update
 * feed from `apps/windows-admin` instead. Leaving that one out is not cosmetic:
 * it produces a release whose `.exe` still calls itself by the previous number,
 * so the feed advertises the old version and electron-updater never offers the
 * update to anyone already running it.
 *
 * `apps/docs` and `apps/agent` version themselves and stay out on purpose.
 */
export const VERSIONED_PACKAGE_FILES = [
  'package.json',
  'apps/storefront/package.json',
  'apps/fundraising/package.json',
  'apps/admin/package.json',
  'apps/windows-admin/package.json',
  'packages/core/package.json',
] as const
