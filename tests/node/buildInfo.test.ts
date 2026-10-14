import { describe, expect, it } from 'vitest';
import { buildHash, type GitRunner } from '../../scripts/buildInfo';

const root = process.cwd();

/** A git that answers from a table, or fails like git outside a repository. */
function fakeGit(answers: Record<string, string> | null): GitRunner {
  return (args) => {
    const answer = answers?.[args.join(' ')];
    if (answer === undefined) throw new Error('fatal: not a git repository');
    return answer;
  };
}

const clean = {
  'rev-parse --show-toplevel': root,
  'rev-parse --short=7 HEAD': 'a1b2c3d',
  'status --porcelain': '',
};

describe('build hash', () => {
  it('is the short commit of a clean checkout', () => {
    expect(buildHash(root, {}, fakeGit(clean))).toBe('a1b2c3d');
  });

  it('marks uncommitted changes', () => {
    const git = fakeGit({ ...clean, 'status --porcelain': ' M src/main.ts' });
    expect(buildHash(root, {}, git)).toBe('a1b2c3d-dirty');
  });

  it('takes GIT_COMMIT from a CI first, shortened', () => {
    const env = { GIT_COMMIT: '0123456789abcdef0123456789abcdef01234567' };
    expect(buildHash(root, env, fakeGit(clean))).toBe('0123456');
  });

  it('ignores a GIT_COMMIT that is not a hash', () => {
    expect(buildHash(root, { GIT_COMMIT: '<script>' }, fakeGit(clean))).toBe('a1b2c3d');
  });

  it('is "unknown" without git', () => {
    expect(buildHash(root, {}, fakeGit(null))).toBe('unknown');
  });

  it('is "unknown" inside some other repository', () => {
    const git = fakeGit({ ...clean, 'rev-parse --show-toplevel': `${root}/..` });
    expect(buildHash(root, {}, git)).toBe('unknown');
  });

  it('reads this repository for real', () => {
    expect(buildHash(root, {})).toMatch(/^[0-9a-f]{7}(-dirty)?$/);
  });
});
