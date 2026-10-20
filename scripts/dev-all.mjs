import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { watchServer } from './dev-server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const stopBackend = watchServer({
  command: 'powershell.exe',
  args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'server/start-local.ps1')],
  cwd: root,
  paths: ['server/src/main', 'server/pom.xml', 'server/.env.local', 'server/start-local.ps1'].map(path => join(root, path)),
});
const frontend = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js')], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
});
let frontendClosed = false;
let stopping = false;
const closed = new Promise(resolve => frontend.once('close', code => {
  frontendClosed = true;
  resolve();
  if (!stopping) void shutdown(code ?? 1);
}));

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  try {
    await stopBackend();
    if (!frontendClosed && frontend.pid) {
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/PID', String(frontend.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        await new Promise((resolve, reject) => {
          killer.once('error', reject);
          killer.once('close', resolve);
        });
      } else {
        frontend.kill('SIGTERM');
      }
      await closed;
    }
    process.exitCode = code;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

frontend.on('error', error => {
  console.error(`[frontend] Cannot start: ${error.message}`);
  void shutdown(1);
});
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
