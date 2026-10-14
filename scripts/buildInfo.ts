/**
 * The build's commit, shown on the rules screen next to the game version. Support
 * and the provider's QA quote it to say exactly which client a report is about.
 *
 * In order:
 * 1. `GIT_COMMIT` from the environment: a CI that builds from an archive sets it.
 * 2. `git` in this project's own repository. "-dirty" marks a build with
 *    uncommitted changes: it cannot be rebuilt from the hash alone.
 * 3. "unknown", so a build without git still works.
 *
 * Runs in Node, from vite.config.ts.
 */
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

/** Runs git with `args` in `cwd` and returns its trimmed output; throws if git fails. */
export type GitRunner = (args: string[], cwd: string) => string;

const runGit: GitRunner = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** Seven hex digits, as `git rev-parse --short` prints by default. */
const HASH_LENGTH = 7;

export function buildHash(
  root: string,
  env: Record<string, string | undefined> = process.env,
  git: GitRunner = runGit,
): string {
  const fromEnv = env.GIT_COMMIT?.trim();
  if (fromEnv && /^[0-9a-f]{7,40}$/i.test(fromEnv)) return fromEnv.slice(0, HASH_LENGTH);
  try {
    // an archive unpacked inside some other repository must not take that repository's hash
    const top = git(['rev-parse', '--show-toplevel'], root);
    if (realpathSync(top) !== realpathSync(root)) return 'unknown';
    const hash = git(['rev-parse', `--short=${HASH_LENGTH}`, 'HEAD'], root);
    const dirty = git(['status', '--porcelain'], root) !== '';
    return dirty ? `${hash}-dirty` : hash;
  } catch {
    return 'unknown';
  }
}
