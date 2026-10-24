import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../android/', import.meta.url));
const windows = process.platform === 'win32';
const result = windows
  ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat assembleDebug'], { cwd, stdio: 'inherit' })
  : spawnSync('./gradlew', ['assembleDebug'], { cwd, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
if (result.status === 0) console.log('APK: mobile/android/app/build/outputs/apk/debug/app-debug.apk');
process.exitCode = result.status ?? 1;
