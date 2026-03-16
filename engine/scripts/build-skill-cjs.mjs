#!/usr/bin/env node
/**
 * Build privguard.cjs — single-file bundle for skill integration.
 * Output: dist/privguard.cjs  (and optionally copied to privguard-skill)
 *
 * Usage:
 *   node scripts/build-skill-cjs.mjs
 *   node scripts/build-skill-cjs.mjs --sync   # also copy to ../privguard-skill
 */
import { build } from 'esbuild';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outfile = resolve(root, 'dist', 'privguard.cjs');
const skillDest = resolve(root, '..', '..', 'privguard-skill', 'privguard', 'scripts', 'privguard.cjs');

await build({
  entryPoints: [resolve(root, 'src', 'cli.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile,
  treeShaking: true,
  packages: 'bundle',
  logLevel: 'warning',
});

console.log(`✅ Built: ${outfile}`);

const shouldSync = process.argv.includes('--sync');
if (shouldSync) {
  if (!existsSync(resolve(root, '..', '..', 'privguard-skill'))) {
    console.warn('⚠️  privguard-skill not found alongside PrivGuardEngine, skipping sync');
  } else {
    copyFileSync(outfile, skillDest);
    console.log(`✅ Synced: ${skillDest}`);
  }
}
