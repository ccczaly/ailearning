import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fingerprint, watchServer } from './dev-server.mjs';

test('watcher restarts on edits, additions and deletions; recovers after failed start; stops its child', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ailearning-watch-'));
  const input = join(dir, 'src');
  mkdirSync(input);
  const source = join(input, 'example.java');
  const record = join(dir, 'starts.txt');
  const worker = join(dir, 'worker.cjs');
  writeFileSync(source, 'valid');
  writeFileSync(record, '');
  writeFileSync(worker, `
    const fs = require('node:fs');
    fs.appendFileSync(${JSON.stringify(record)}, process.pid + '\\n');
    if (fs.readFileSync(${JSON.stringify(source)}, 'utf8') === 'invalid') process.exit(1);
    setInterval(() => {}, 1000);
  `);
  const starts = () => readFileSync(record, 'utf8').trim().split('\n').filter(Boolean).map(Number);
  async function waitFor(count) {
    const deadline = Date.now() + 10000;
    while (starts().length < count && Date.now() < deadline) await delay(50);
    assert.equal(starts().length, count);
  }
  const stop = watchServer({ command: process.execPath, args: [worker], cwd: dir, paths: [input], interval: 50, quietPeriod: 100, log: () => {} });
  try {
    await waitFor(1);
    writeFileSync(source, 'edit');
    await waitFor(2);
    assert.throws(() => process.kill(starts()[0], 0));
    writeFileSync(join(input, 'new.java'), 'new');
    await waitFor(3);
    rmSync(join(input, 'new.java'));
    await waitFor(4);
    writeFileSync(source, 'invalid');
    await waitFor(5);
    await delay(300);
    writeFileSync(source, 'fixed');
    await waitFor(6);
    // Build output is deliberately outside the watched inputs.
    const before = fingerprint([input]);
    writeFileSync(join(dir, 'compiled.class'), 'output');
    assert.equal(fingerprint([input]), before);
    await delay(300);
    assert.equal(starts().length, 6);
  } finally {
    await stop();
    for (const pid of starts()) assert.throws(() => process.kill(pid, 0));
    rmSync(dir, { recursive: true, force: true });
  }
});
