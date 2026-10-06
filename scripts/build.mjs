import { access, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vicinaeRoot = path.join(root, 'vicinae-extension');
const vici = path.join(vicinaeRoot, 'node_modules', '@vicinae', 'api', 'dist', 'bin.js');
const vicinaeOutput = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, 'dist', 'codex-status-vicinae');

try {
  await access(vici);
} catch {
  process.stderr.write('Vicinae build tools are missing. Run npm install --prefix vicinae-extension.\n');
  process.exit(1);
}

for (const command of [['build', '--out', vicinaeOutput], ['lint']]) {
  const result = spawnSync(process.execPath, [vici, ...command], {
    cwd: vicinaeRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

await mkdir(path.join(root, 'dist'), { recursive: true });
const packageResult = spawnSync('python3', ['scripts/package.py', vicinaeOutput], {
  cwd: root,
  stdio: 'inherit',
});
if (packageResult.status !== 0) process.exit(packageResult.status || 1);
