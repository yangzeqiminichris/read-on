// Builds dist/readon-<version>.zip for Chrome Web Store upload.
// Uses `git archive` so only tracked files ship; dev-only artifacts are excluded.
import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const out = join(root, 'dist', `readon-${version}.zip`);

mkdirSync(join(root, 'dist'), { recursive: true });

execFileSync('git', [
  'archive', '--format=zip', '-o', out, 'HEAD',
  'manifest.json', 'src',
  ':(exclude)src/icons/*.mjs',
  ':(exclude)src/icons/source.png',
  ':(exclude)src/icons/design-philosophy.md',
  ':(exclude)src/lib/.gitkeep',
], { cwd: root, stdio: 'inherit' });

console.log(`✓ ${out}`);
console.log('Note: packages the latest commit (HEAD). Commit your changes first.');
