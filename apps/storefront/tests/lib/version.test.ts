import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  VERSIONED_PACKAGE_FILES,
  bumpProjectVersion,
  formatProjectVersion,
  fromSemver,
  nextSuffix,
  parseProjectVersion,
  suffixOrdinal,
  suggestBump,
  toSemver,
} from '@/lib/version'

describe('parseProjectVersion', () => {
  it('reads a feature version', () => {
    expect(parseProjectVersion('2.1')).toEqual({ major: 2, minor: 1, suffix: undefined })
  })

  it('reads a lettered version', () => {
    expect(parseProjectVersion('2.6a')).toEqual({ major: 2, minor: 6, suffix: 'a' })
  })

  it('reads a double-lettered version', () => {
    expect(parseProjectVersion('2.1aa')).toEqual({ major: 2, minor: 1, suffix: 'aa' })
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseProjectVersion('  2.1b \n')).toEqual({ major: 2, minor: 1, suffix: 'b' })
  })

  it('rejects a three-part semver, which is a different scheme', () => {
    expect(() => parseProjectVersion('2.1.0')).toThrow(/not a project version/)
  })

  it('rejects an uppercase suffix so 2.1A and 2.1a cannot both exist', () => {
    expect(() => parseProjectVersion('2.1A')).toThrow()
  })

  it('rejects nonsense', () => {
    expect(() => parseProjectVersion('')).toThrow()
    expect(() => parseProjectVersion('v2.1')).toThrow()
    expect(() => parseProjectVersion('2')).toThrow()
  })
})

describe('bumpProjectVersion', () => {
  it('bumps the minor for a large feature', () => {
    expect(bumpProjectVersion('2.0', 'feature')).toBe('2.1')
  })

  it('drops the letter when a feature lands on top of increments', () => {
    // 2.1b's next feature release is 2.2, not 2.2b — the letter counts increments within a
    // minor and means nothing once the minor moves.
    expect(bumpProjectVersion('2.1b', 'feature')).toBe('2.2')
  })

  it('adds the first letter for an incremental change', () => {
    expect(bumpProjectVersion('2.1', 'increment')).toBe('2.1a')
  })

  it('walks the letters', () => {
    expect(bumpProjectVersion('2.1a', 'increment')).toBe('2.1b')
    expect(bumpProjectVersion('2.6a', 'increment')).toBe('2.6b')
  })

  it('goes to a whole new major only when asked, resetting the minor', () => {
    expect(bumpProjectVersion('2.7c', 'major')).toBe('3.0')
  })
})

describe('nextSuffix', () => {
  it('starts at a', () => {
    expect(nextSuffix(undefined)).toBe('a')
  })

  it('carries past z rather than wrapping onto a released version', () => {
    expect(nextSuffix('z')).toBe('aa')
    expect(nextSuffix('az')).toBe('ba')
    expect(nextSuffix('zz')).toBe('aaa')
  })

  it('increments within a position', () => {
    expect(nextSuffix('a')).toBe('b')
    expect(nextSuffix('aa')).toBe('ab')
  })
})

describe('suffixOrdinal', () => {
  it('numbers the sequence from one', () => {
    expect(suffixOrdinal(undefined)).toBe(0)
    expect(suffixOrdinal('a')).toBe(1)
    expect(suffixOrdinal('z')).toBe(26)
    expect(suffixOrdinal('aa')).toBe(27)
  })

  it('agrees with walking the sequence', () => {
    let suffix: string | undefined
    for (let expected = 1; expected <= 60; expected += 1) {
      suffix = nextSuffix(suffix)
      expect(suffixOrdinal(suffix)).toBe(expected)
    }
  })
})

describe('toSemver', () => {
  it('maps a feature release to patch zero', () => {
    expect(toSemver('2.1')).toBe('2.1.0')
  })

  it('maps letters to patch numbers', () => {
    expect(toSemver('2.1a')).toBe('2.1.1')
    expect(toSemver('2.1b')).toBe('2.1.2')
    expect(toSemver('2.6a')).toBe('2.6.1')
  })

  it('stays monotonic, so npm still orders releases correctly', () => {
    const ordered = ['2.1', '2.1a', '2.1b', '2.2', '2.2a', '3.0']
    const patches = ordered.map((v) => toSemver(v))
    for (let i = 1; i < patches.length; i += 1) {
      expect(compareSemver(patches[i], patches[i - 1])).toBeGreaterThan(0)
    }
  })
})

describe('fromSemver', () => {
  it('recovers the project version', () => {
    expect(fromSemver('2.1.0')).toBe('2.1')
    expect(fromSemver('2.1.1')).toBe('2.1a')
    expect(fromSemver('2.6.2')).toBe('2.6b')
  })

  it('round-trips every version the scheme can produce in a minor', () => {
    let version = '2.0'
    for (let i = 0; i < 40; i += 1) {
      expect(fromSemver(toSemver(version))).toBe(version)
      version = bumpProjectVersion(version, 'increment')
    }
  })

  it('ignores a prerelease tail rather than throwing', () => {
    expect(fromSemver('2.1.1-canary.3')).toBe('2.1a')
  })
})

describe('suggestBump', () => {
  it('suggests a feature bump when a change reads like new capability', () => {
    expect(suggestBump(['**Margin dashboard** — adds a new page under analytics'])).toBe('feature')
  })

  it('suggests an increment for a fix', () => {
    expect(suggestBump(['**Square fee lookup** — the parser existed; the call was missing'])).toBe(
      'increment'
    )
  })

  it('never suggests a major bump, which is only ever done on request', () => {
    expect(suggestBump(['breaking change', 'removes the old API', 'incompatible'])).not.toBe('major')
  })

  it('is an increment for no entries rather than throwing', () => {
    expect(suggestBump([])).toBe('increment')
  })
})

describe('formatProjectVersion', () => {
  it('omits an absent suffix', () => {
    expect(formatProjectVersion({ major: 2, minor: 1 })).toBe('2.1')
    expect(formatProjectVersion({ major: 2, minor: 1, suffix: 'c' })).toBe('2.1c')
  })
})

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i]
  }
  return 0
}

describe('VERSIONED_PACKAGE_FILES', () => {
  const ROOT = resolve(__dirname, '..', '..', '..', '..')

  it('names files that actually exist', () => {
    for (const file of VERSIONED_PACKAGE_FILES) {
      expect(existsSync(join(ROOT, file)), `${file} is listed but not on disk`).toBe(true)
    }
  })

  it('includes the workspace the Windows installer is stamped from', () => {
    // The desktop apps take their version from two different places: the
    // macOS bundle from the root package.json (build-app.sh), the Windows
    // installer and its latest.yml update feed from the windows-admin
    // workspace. Leaving that one out cuts a release whose .exe still carries
    // the previous number, so latest.yml advertises the old version and
    // electron-updater never offers the update to anyone already running it.
    expect(VERSIONED_PACKAGE_FILES).toContain('apps/windows-admin/package.json')
  })

  it('keeps every listed workspace on one version', () => {
    // They are bumped together, so if they have drifted apart the next release
    // will paper over it rather than anyone noticing.
    const versions = VERSIONED_PACKAGE_FILES.map((file) => ({
      file,
      version: JSON.parse(readFileSync(join(ROOT, file), 'utf-8')).version as string,
    }))

    const root = versions[0].version
    for (const entry of versions) {
      expect(entry.version, `${entry.file} is out of step with the root`).toBe(root)
    }
  })

  it('keeps package-lock.json on the same version as the packages', () => {
    // npm stores each workspace's version in the lockfile too. Left behind, the
    // next `npm install` rewrites the tracked file right after a release commit,
    // and anything reading package metadata out of the lock reports the previous
    // version. `version-bump` carries them; this is what notices when it stops.
    const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf-8')) as {
      version: string
      packages: Record<string, { version?: string }>
    }
    const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as { version: string }

    expect(lock.version, 'the lockfile version is behind the root package').toBe(root.version)
    expect(lock.packages['']?.version, 'the lockfile root entry is behind').toBe(root.version)

    for (const file of VERSIONED_PACKAGE_FILES) {
      if (file === 'package.json') continue
      const workspace = file.replace(/\/package\.json$/, '')
      const entry = lock.packages[workspace]
      if (!entry?.version) continue
      expect(entry.version, `${workspace} is behind in package-lock.json`).toBe(root.version)
    }
  })

  it('agrees with the canonical projectVersion at the root', () => {
    const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as {
      version: string
      projectVersion: string
    }
    expect(toSemver(root.projectVersion)).toBe(root.version)
  })
})
