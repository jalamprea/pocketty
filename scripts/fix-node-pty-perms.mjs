/**
 * node-pty 1.1.0 distribuye su binario `spawn-helper` (macOS/Linux) sin el bit
 * de ejecución en algunos prebuilds. Sin él, `pty.spawn` falla con
 * "posix_spawnp failed". Este postinstall le devuelve el +x a cualquier
 * spawn-helper que encuentre dentro de node-pty. No-op en Windows.
 */
import { chmodSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

if (process.platform === 'win32') process.exit(0);

const require = createRequire(import.meta.url);

let nodePtyDir;
try {
  nodePtyDir = path.dirname(require.resolve('node-pty/package.json'));
} catch {
  // node-pty no instalado (ej. instalación parcial): nada que hacer.
  process.exit(0);
}

const candidates = [
  'build/Release/spawn-helper',
  'prebuilds/darwin-arm64/spawn-helper',
  'prebuilds/darwin-x64/spawn-helper',
  'prebuilds/linux-arm64/spawn-helper',
  'prebuilds/linux-x64/spawn-helper',
];

for (const rel of candidates) {
  const full = path.join(nodePtyDir, rel);
  if (!existsSync(full)) continue;
  try {
    const mode = statSync(full).mode;
    if (!(mode & 0o111)) {
      chmodSync(full, mode | 0o755);
      console.log(`[postinstall] +x ${rel}`);
    }
  } catch (err) {
    console.warn(`[postinstall] no pude dar +x a ${rel}: ${err.message}`);
  }
}
