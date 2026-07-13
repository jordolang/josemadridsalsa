import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Get the last modified date for a given file.
 *
 * Tries `git log -1` first (so it reflects the last commit that touched the
 * file, not the filesystem mtime). Falls back to `fs.statSync().mtime` when
 * git is unavailable (e.g. non-git deploys).
 */
export function getLastModified(absolutePath: string): Date | null {
  try {
    const iso = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', absolutePath],
      {
        cwd: dirname(resolve(absolutePath)),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();

    if (iso) {
      const parsed = new Date(iso);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  } catch {
    // git not available or file not tracked — fall through to fs.stat
  }

  try {
    return statSync(absolutePath).mtime;
  } catch {
    return null;
  }
}
