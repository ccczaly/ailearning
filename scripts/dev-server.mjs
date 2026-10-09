import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

// Watch inputs only: Maven's target directory must never trigger another build.
export function fingerprint(paths) {
  const hash = createHash('sha256');
  function visit(path) {
    hash.update(path);
    if (!existsSync(path)) { hash.update('missing'); return; }
    try {
      const entries = readdirSync(path, { withFileTypes: true });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isSymbolicLink()) visit(join(path, entry.name));
      }
    } catch (error) {
      if (error.code !== 'ENOTDIR') throw error;
      hash.update(readFileSync(path));
    }
  }
  paths.forEach(visit);
  return hash.digest('hex');
}

export function watchServer({ command, args, cwd, paths, interval = 500, quietPeriod = 800, log = console.log }) {
  let child;
  let childClosed;
  let stopping = false;
  let restarting = false;
  let pending = false;
  let changedAt = 0;
  let previous = fingerprint(paths);

  function launch() {
    log('[backend] Starting backend...');
    child = spawn(command, args, { cwd, stdio: 'inherit', windowsHide: true });
    const current = child;
    childClosed = new Promise(resolveClosed => {
      current.once('error', error => log(`[backend] Cannot start: ${error.message}`));
      current.once('close', code => {
        if (child === current) child = undefined;
        if (!stopping && !restarting) log(`[backend] Exited (${code}). Fix the error and save a watched file to retry.`);
        resolveClosed();
      });
    });
  }

  async function stopChild() {
    if (!child?.pid) return;
    const closed = childClosed;
    if (process.platform === 'win32') {
      // Only terminate the process tree created by this watcher, never a port owner.
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      await new Promise((resolveKill, rejectKill) => {
        killer.once('error', rejectKill);
        killer.once('close', resolveKill);
      });
    } else {
      child.kill('SIGTERM');
    }
    await closed;
  }

  launch();
  log('[backend] Watching server/src/main, pom.xml, .env.local and startup script. Ctrl+C to stop.');
  const timer = setInterval(async () => {
    if (stopping || restarting) return;
    try {
      const current = fingerprint(paths);
      if (current !== previous) {
        previous = current;
        pending = true;
        changedAt = Date.now();
      }
      if (!pending || restarting || Date.now() - changedAt < quietPeriod) return;
      restarting = true;
      pending = false;
      log('[backend] Changes detected. Recompiling and restarting...');
      await stopChild();
      if (!stopping) launch();
    } catch (error) {
      log(`[backend] Watch/restart failed: ${error.message}`);
    } finally {
      restarting = false;
    }
  }, interval);

  return async () => {
    stopping = true;
    clearInterval(timer);
    await stopChild();
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stop = watchServer({
    command: 'powershell.exe',
    args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'server/start-local.ps1')],
    cwd: root,
    paths: ['server/src/main', 'server/pom.xml', 'server/.env.local', 'server/start-local.ps1'].map(path => join(root, path)),
  });
  let exiting = false;
  const shutdown = async () => {
    if (exiting) return;
    exiting = true;
    try { await stop(); process.exit(0); }
    catch (error) { console.error(error.message); process.exit(1); }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
