import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = await mkdtemp(join(tmpdir(), 'autoflow-assets-'));
try {
  // Apenas o gerador oficial adapta os tamanhos; a logo original é preservada.
  await copyFile(join(root, 'public/logo-autoflow.jpg'), join(assets, 'logo.jpg'));
  const result = spawnSync(process.execPath, [
    join(root, 'node_modules/@capacitor/assets/bin/capacitor-assets'), 'generate', '--android',
    '--assetPath', relative(root, assets), '--iconBackgroundColor', '#000000', '--iconBackgroundColorDark', '#000000',
    '--splashBackgroundColor', '#000000', '--splashBackgroundColorDark', '#000000', '--logoSplashScale', '0.3',
  ], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { await rm(assets, { recursive: true, force: true }); }
