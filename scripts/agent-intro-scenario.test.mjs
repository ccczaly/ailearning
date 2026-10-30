import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { CODE_FIXTURES, SCENARIO } from '../public/demos/agent-intro/scenario.js';

const bundledPython = 'C:/Users/cza/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const python = process.env.AILEARNING_TEST_PYTHON || (existsSync(bundledPython) ? bundledPython : process.platform === 'win32' ? 'python' : 'python3');

test('the single coding case connects project memory, planning, tools and evidence-based reflection', () => {
  assert.equal(new Set(SCENARIO.steps.map(step => step.id)).size, SCENARIO.steps.length);
  assert.deepEqual(new Set(SCENARIO.steps.flatMap(step => step.mechanisms)), new Set(['plan', 'memory', 'tool', 'reflect']));
  const memory = SCENARIO.steps.find(step => step.id === 'read-memory');
  assert.equal(memory.file, 'AGENTS.md');
  assert.equal(memory.code, CODE_FIXTURES.projectRules);
  assert.match(memory.summary, /保存在文件中.*读取后.*上下文/);
  const failure = SCENARIO.steps.findIndex(step => step.id === 'regression-failure');
  const reflection = SCENARIO.steps.findIndex(step => step.id === 'reflect');
  const verified = SCENARIO.steps.findIndex(step => step.id === 'verified');
  assert.ok(failure < reflection && reflection < verified);
  assert.equal(SCENARIO.steps[failure].status, 'failed');
  assert.equal(SCENARIO.steps[verified].status, 'passed');
});

test('the displayed repair really fails, exposes the empty-cart regression, then passes all three tests', () => {
  const directory = mkdtempSync(join(tmpdir(), 'learnai-agent-intro-'));
  const cart = join(directory, 'cart.py');
  const tests = join(directory, 'test_cart.py');
  try {
    writeFileSync(tests, CODE_FIXTURES.tests);
    const runVersion = (source) => {
      writeFileSync(cart, source);
      const result = spawnSync(python, ['-B', '-m', 'unittest', '-v'], {
        cwd: directory, encoding: 'utf8', timeout: 10000, windowsHide: true,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONIOENCODING: 'utf-8' },
      });
      if (result.error) throw result.error;
      return { status: result.status, output: result.stdout + result.stderr };
    };
    const initial = runVersion(CODE_FIXTURES.initial);
    assert.equal(initial.status, 1, initial.output);
    assert.match(initial.output, /TypeError: unsupported operand type\(s\) for \+: 'int' and 'str'/);
    assert.match(initial.output, /FAILED \(failures=1, errors=2\)/);

    const first = runVersion(CODE_FIXTURES.firstPatch);
    assert.equal(first.status, 1, first.output);
    assert.match(first.output, /test_empty_returns_decimal[^\n]*FAIL/);
    assert.match(first.output, /test_quantity[^\n]*ok/);
    assert.match(first.output, /test_decimal_exact[^\n]*ok/);
    assert.match(first.output, /FAILED \(failures=1\)/);

    const final = runVersion(CODE_FIXTURES.final);
    assert.equal(final.status, 0, final.output);
    assert.match(final.output, /Ran 3 tests/);
    assert.match(final.output, /\nOK\s*$/);
    assert.equal(readFileSync(cart, 'utf8'), CODE_FIXTURES.final);
  } finally {
    // Only remove the two files created above, then the now-empty temporary folder.
    if (existsSync(cart)) unlinkSync(cart);
    if (existsSync(tests)) unlinkSync(tests);
    rmdirSync(directory);
  }
});
