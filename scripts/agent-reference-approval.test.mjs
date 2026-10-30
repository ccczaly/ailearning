import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// These checks run the authored page logic with a small DOM and controlled clock.
// They cover cancellation and displayed evidence, not browser layout or rendering.
function pageHarness(demoId) {
  const file = new URL(`../public/demos/agent-reference/${demoId}/index.html`, import.meta.url);
  const html = readFileSync(file, 'utf8');
  const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => !/\bsrc\s*=/.test(match[1]));
  const elements = new Map();
  const jobs = new Map();
  const listeners = new Map();
  let nextJob = 1;

  function createElement() {
    const classes = new Set();
    return {
      textContent: '', innerHTML: '', disabled: false, style: {}, dataset: {}, children: [],
      scrollTop: 0, scrollHeight: 0,
      classList: {
        add: value => classes.add(value),
        remove: value => classes.delete(value),
        contains: value => classes.has(value),
        toggle(value, enabled) {
          if (enabled) classes.add(value); else classes.delete(value);
          return Boolean(enabled);
        },
      },
      appendChild(child) { this.children.push(child); return child; },
      setAttribute() {}, addEventListener() {},
    };
  }
  function element(id) {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  }
  const context = vm.createContext({
    document: {
      body: createElement(),
      getElementById: element,
      querySelectorAll: () => [],
      createElement,
    },
    window: {
      addEventListener(name, callback) {
        const callbacks = listeners.get(name) || [];
        callbacks.push(callback);
        listeners.set(name, callbacks);
      },
    },
    MutationObserver: class { observe() {} },
    setTimeout(callback, delay = 0) {
      const id = nextJob++;
      jobs.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { jobs.delete(id); },
    requestAnimationFrame(callback) { callback(0); },
  });
  for (const [index, block] of inline.entries()) {
    vm.runInContext(block[2], context, { filename: `${file.pathname}#inline-${index}` });
  }
  function step() {
    const entry = jobs.entries().next().value;
    assert.ok(entry, 'expected a scheduled simulation step');
    jobs.delete(entry[0]);
    entry[1].callback();
  }
  function dispatch(name) {
    for (const callback of listeners.get(name) || []) callback();
  }
  return { context, element, jobs, step, dispatch };
}

function startPendingConfirmation(harness) {
  harness.context.runSim();
  // Reading and searching pass automatically; editing then waits for the user.
  harness.step();
  harness.step();
  harness.step();
  assert.equal(typeof harness.context.confirmResolver, 'function');
  assert.equal(harness.element('confirmPopup').classList.contains('show'), true);
}

test('approval reset settles a pending decision without resuming the old run', async () => {
  const harness = pageHarness('approval');
  startPendingConfirmation(harness);
  const previousGeneration = harness.context.simGeneration;
  harness.context.resetSim();
  await Promise.resolve();

  assert.ok(harness.context.simGeneration > previousGeneration);
  assert.equal(harness.context.confirmResolver, null);
  assert.equal(harness.jobs.size, 0);
  assert.equal(harness.context.simRunning, false);
  assert.equal(harness.element('btnRun').disabled, false);
  assert.equal(harness.element('confirmPopup').classList.contains('show'), false);
});

test('approval changing mode invalidates the decision belonging to the old mode', async () => {
  const harness = pageHarness('approval');
  startPendingConfirmation(harness);
  harness.context.pickMode(2);
  await Promise.resolve();

  assert.equal(harness.context.curMode, 2);
  assert.equal(harness.context.confirmResolver, null);
  assert.equal(harness.jobs.size, 0);
  assert.equal(harness.context.simRunning, false);
  assert.match(harness.element('simHint').textContent, /智能模式/);
});

test('approval responds to the shared cancellation event while awaiting a decision', async () => {
  const harness = pageHarness('approval');
  startPendingConfirmation(harness);
  harness.dispatch('agent-demo-cancel');
  await Promise.resolve();

  assert.equal(harness.context.confirmResolver, null);
  assert.equal(harness.jobs.size, 0);
});

test('approval refusal records the refusal and schedules the next operation', async () => {
  const harness = pageHarness('approval');
  startPendingConfirmation(harness);
  harness.context.resolveConfirm(false);
  await Promise.resolve();

  assert.match(harness.element('result_2').innerHTML, /用户已拒绝/);
  assert.equal(harness.context.confirmResolver, null);
  assert.equal(harness.element('confirmPopup').classList.contains('show'), false);
  assert.equal(harness.jobs.size, 1);
});

test('tracing tool counter and completion text match the six displayed tool starts', () => {
  const harness = pageHarness('tracing');
  const starts = harness.context.EVENTS.filter(event => event.type === 'tool_start').length;
  assert.equal(starts, 6);
  harness.context.runTask();
  while (harness.jobs.size) harness.step();

  assert.equal(Number(harness.element('sTool').textContent), starts);
  const completion = harness.context.EVENTS.find(event => event.type === 'done');
  assert.match(completion.meta, new RegExp(`工具 ${starts} 次`));
  assert.equal(harness.element('eventArea').children.length, harness.context.EVENTS.length);
  assert.match(harness.element('ctrlStatus').innerHTML, /已完成/);
});
