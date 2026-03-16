#!/usr/bin/env node
/**
 * Build privguard-gui.cjs — single-file bundle for the Web GUI.
 * Static files (HTML/CSS/JS) are inlined as string constants via esbuild plugin.
 *
 * Usage:
 *   node scripts/build-gui-cjs.mjs
 *   node scripts/build-gui-cjs.mjs --sync   # also copy to privguard-skill
 */
import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outfile = resolve(root, 'dist', 'privguard-gui.cjs');
const skillDir = resolve(root, '..', '..', 'privguard-skill', 'privguard', 'scripts');
const skillDest = resolve(skillDir, 'privguard-gui.cjs');

mkdirSync(resolve(root, 'dist'), { recursive: true });

// Plugin: inline static files (html/css) as text strings.
// app.js is a plain JS file in static/ — we give it a .staticjs extension
// to avoid conflicting with esbuild's normal .js handling.
const inlineStaticPlugin = {
  name: 'inline-static',
  setup(build) {
    // Intercept imports of static files by path pattern
    build.onLoad({ filter: /\/static\/(index|login)\.html$/ }, (args) => ({
      contents: readFileSync(args.path, 'utf-8'),
      loader: 'text',
    }));
    build.onLoad({ filter: /\/static\/style\.css$/ }, (args) => ({
      contents: readFileSync(args.path, 'utf-8'),
      loader: 'text',
    }));
    build.onLoad({ filter: /\/static\/app\.js$/ }, (args) => ({
      contents: readFileSync(args.path, 'utf-8'),
      loader: 'text',
    }));
  },
};

await build({
  entryPoints: [resolve(root, 'src', 'gui-cli.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile,
  treeShaking: true,
  packages: 'bundle',
  logLevel: 'warning',
  plugins: [inlineStaticPlugin],
  define: {
    'import.meta.url': '"file://__bundled__"',
  },
});

console.log(`✅ Built: ${outfile}`);

const shouldSync = process.argv.includes('--sync');
if (shouldSync) {
  const skillRoot = resolve(root, '..', '..', 'privguard-skill');
  if (!existsSync(skillRoot)) {
    console.warn('⚠️  privguard-skill not found alongside PrivGuardEngine, skipping sync');
  } else {
    mkdirSync(skillDir, { recursive: true });
    copyFileSync(outfile, skillDest);
    console.log(`✅ Synced: ${skillDest}`);
  }
}
