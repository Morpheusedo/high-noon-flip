#!/usr/bin/env node
/**
 * Puts the build on Netlify as a preview for the provider (docs/PREVIEW.md):
 *
 * 1. Refuses uncommitted changes: the build named on the rules screen must be a
 *    commit anyone can check out.
 * 2. Runs the checks and the smoke test, which builds dist/.
 * 3. Uploads dist/ as a draft with its own address, named by version and commit:
 *    https://v0-1-0-a1b2c3d--<site>.netlify.app. Drafts never change the site's
 *    main address; `npm run preview:deploy -- --prod` moves the main address to
 *    this build too.
 *
 * Once per machine: `npx netlify-cli@<NETLIFY version> login`, then `link` or
 * NETLIFY_SITE_ID. Run: npm run preview:deploy
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Pinned like every dependency; run through npx so its own hundred packages stay out of ours. */
const NETLIFY = 'netlify-cli@27.10.2';
const prod = process.argv.includes('--prod');

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const run = (...args) => execFileSync('npm', args, { stdio: 'inherit' });

if (git('status', '--porcelain') !== '') {
  console.error('Uncommitted changes: commit them first, so the build hash names a real commit.');
  process.exit(1);
}
const hash = git('rev-parse', '--short=7', 'HEAD');
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

run('run', 'typecheck');
run('run', 'lint');
run('test');
run('run', 'smoke');

const target = prod ? ['--prod'] : ['--alias', `v${version.replaceAll('.', '-')}-${hash}`];
const output = execFileSync(
  'npx',
  [
    '--yes',
    NETLIFY,
    'deploy',
    '--no-build',
    '--dir',
    'dist',
    '--message',
    `${version} (${hash})`,
    '--json',
    ...target,
  ],
  { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] },
);
const deploy = JSON.parse(output.slice(output.indexOf('{')));
// a draft's alias address, or the main address of a production deploy
const url = prod ? deploy.url : deploy.deploy_url;

console.log(`
High Noon Flip ${version}, build ${hash}
  Player:   ${url}/
  QA panel: ${url}/?debug=1
  This build, for good: ${deploy.deploy_url}/
`);
