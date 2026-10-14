#!/usr/bin/env node
/**
 * The size of the build in dist/, by kind: what a provider's size budget asks
 * about. Code and text are counted gzipped, as a CDN serves them; images and
 * sound are already compressed and counted as they are. Lazy chunks (other
 * languages, the QA panel) are listed apart: a player's first visit skips them.
 *
 * What a first visit really downloads is measured by `npm run lowend`.
 * Run after `npm run build`: npm run size
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const TEXT = new Set(['.js', '.css', '.html', '.json', '.svg']);
const KINDS = {
  '.js': 'code',
  '.css': 'code',
  '.html': 'code',
  '.json': 'data',
  '.webp': 'images',
  '.jpg': 'images',
  '.png': 'images',
  '.svg': 'images',
  '.m4a': 'sound',
  '.ogg': 'sound',
  '.webm': 'sound',
};
/** Chunks only some sessions load: other languages and the QA panel. */
const LAZY = /^assets\/(debug|[a-z]{2}(-[A-Za-z]+)?)-[\w-]{8}\.(js|css)$/;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

let all;
try {
  all = files(DIST);
} catch {
  console.error('No dist/ here: run npm run build first.');
  process.exit(1);
}

const rows = new Map();
let total = 0;
for (const path of all) {
  const file = relative(DIST, path);
  const ext = extname(file);
  const raw = readFileSync(path);
  const size = TEXT.has(ext) ? gzipSync(raw, { level: 9 }).length : raw.length;
  const kind = LAZY.test(file) ? 'lazy chunks' : (KINDS[ext] ?? 'other');
  const row = rows.get(kind) ?? { files: 0, bytes: 0 };
  row.files += 1;
  row.bytes += size;
  rows.set(kind, row);
  total += size;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`.padStart(9);
console.log('kind          files       size');
for (const [kind, row] of [...rows].sort((a, b) => b[1].bytes - a[1].bytes))
  console.log(`${kind.padEnd(12)} ${String(row.files).padStart(6)} ${kb(row.bytes)}`);
console.log(`${'total'.padEnd(12)} ${String(all.length).padStart(6)} ${kb(total)}`);
console.log('\ncode and data gzipped; images and sound as stored');
