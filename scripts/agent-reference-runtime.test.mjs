import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the shipped browser scripts with deterministic native clocks. These checks
// exercise cancellation and messaging without relying on a browser or real delays.
function runtime({ hidden = false, reducedMotion = false, standalone = false, lesson = false } = {}) {
  let now = 0, nextHandle = 1;
  const scheduled = new Map(), observers = [], nodes = [], messages = [];
  const schedule = (callback, delay = 0, frame = false, interval = false) => {
    const handle = nextHandle++;
    scheduled.set(handle, { callback, due: now + (frame ? 16 : Math.max(0, Number(delay) || 0)), frame, interval, delay });
    return handle;
  };
  function advance(duration) {
    const end = now + duration;
    let steps = 0;
    while (true) {
      const next = [...scheduled].filter(([, job]) => job.due <= end).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!next) break;
      if (++steps > 10_000) throw new Error('The simulated clock failed to settle');
      const [handle, job] = next;
      scheduled.delete(handle);
      now = job.due;
      job.callback(...(job.frame ? [now] : []));
      if (job.interval && !scheduled.has(handle)) {
        job.due = now + job.delay;
        scheduled.set(handle, job);
      }
    }
    now = end;
  }
  class Events {
    listeners = new Map();
    addEventListener(type, callback) {
      const items = this.listeners.get(type) || [];
      items.push(callback); this.listeners.set(type, items);
    }
    removeEventListener(type, callback) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== callback)); }
    dispatchEvent(event) {
      for (const callback of [...(this.listeners.get(event.type) || [])]) callback(event);
      return true;
    }
  }
  class Element extends Events {
    constructor(tag) {
      super(); this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.dataset = {};
      this.scrollHeight = 1000; this.offsetHeight = 1000; this.clientHeight = 1000; this.style = {};
      const classes = new Set();
      this.classList = { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) };
      nodes.push(this);
    }
    append(...items) { this.children.push(...items); }
    appendChild(item) { this.children.push(item); return item; }
    prepend(...items) { this.children.unshift(...items); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] || null; }
    getBoundingClientRect() { return { height: this.offsetHeight, width: 800, top: 0, left: 0, bottom: this.offsetHeight, right: 800 }; }
  }
  const document = new Events();
  Object.assign(document, { hidden, readyState: 'loading', documentElement: new Element('html'), body: new Element('body'), head: new Element('head'),
    createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }),
    getElementById: id => nodes.find(node => node.id === id),
    querySelector: selector => selector === 'meta[name="upstream-source"]' ? { content: 'https://example.com/original' }
      : selector === '.learnai-source' ? nodes.find(node => node.className === 'learnai-source') : null,
    querySelectorAll: () => [],
  });
  function observerClass(kind) {
    return class {
      constructor(callback) { this.callback = callback; this.kind = kind; this.disconnected = false; this.targets = []; observers.push(this); }
      observe(target) { this.targets.push(target); }
      unobserve(target) { this.targets = this.targets.filter(item => item !== target); }
      disconnect() { this.disconnected = true; this.targets = []; }
    };
  }
  const windowEvents = new Events();
  const sandbox = {
    document, location: { pathname: '/demos/agent-reference/tool-call/index.html', origin: 'https://learn.example' },
    performance: { now: () => now }, matchMedia: () => ({ matches: reducedMotion }), scrollY: 0,
    setTimeout: (callback, delay) => schedule(callback, delay), clearTimeout: handle => scheduled.delete(handle),
    setInterval: (callback, delay) => schedule(callback, delay, false, true), clearInterval: handle => scheduled.delete(handle),
    requestAnimationFrame: callback => schedule(callback, 0, true), cancelAnimationFrame: handle => scheduled.delete(handle),
    addEventListener: windowEvents.addEventListener.bind(windowEvents), removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
    dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
    CustomEvent: class { constructor(type) { this.type = type; } },
    ResizeObserver: observerClass('resize'), MutationObserver: observerClass('mutation'), IntersectionObserver: observerClass('intersection'),
    console,
  };
  sandbox.window = sandbox;
  sandbox.parent = standalone ? sandbox : { postMessage: (value, origin) => messages.push({ value: { ...value }, origin }) };
  const context = vm.createContext(sandbox);
  for (const script of ['embed.js', ...(lesson ? ['lesson.js'] : [])])
    vm.runInContext(readFileSync(new URL(`../public/demos/agent-reference/shared/${script}`, import.meta.url), 'utf8'), context, { filename: script });
  const ready = () => { document.readyState = 'complete'; document.dispatchEvent({ type: 'DOMContentLoaded' }); };
  const click = handler => document.dispatchEvent({ type: 'click', target: { closest: () => ({ getAttribute: () => handler }) } });
  return { window: sandbox, document, observers, nodes, messages, scheduled, advance, ready, click, Element };
}

test('reset, replay and scenario switches cancel old timeouts, intervals and animation frames', () => {
  const page = runtime();
  let fired = 0, cancelled = 0;
  page.window.addEventListener('agent-demo-cancel', () => cancelled++);
  for (const handler of ['reset()', 'resetSim()', 'resetAll()', 'replayLoop()', 'pickMode(1)', 'pickScene(2)',
    'pickExp(1)', 'selectMode(2)', 'setMode(1)']) {
    page.window.setTimeout(() => fired++, 50);
    page.window.setInterval(() => fired++, 20);
    page.window.requestAnimationFrame(() => fired++);
    const staleCallbacks = [...page.scheduled.values()].map(job => job.callback);
    page.click(handler);
    for (const stale of staleCallbacks) stale(100);
    page.advance(200);
    assert.equal(fired, 0, handler);
    assert.equal(page.scheduled.size, 0, handler);
  }
  assert.equal(cancelled, 9);
  page.window.setTimeout(() => fired++, 10);
  page.click('playStep()');
  page.advance(10);
  assert.equal(fired, 1);
});

test('pause preserves remaining delay, resumes intervals once, and forwards timer arguments and frame timestamps', () => {
  const page = runtime();
  const calls = [];
  page.window.setTimeout((a, b) => calls.push([a, b]), 100, 'result', 42);
  const interval = page.window.setInterval(() => calls.push('interval'), 80);
  page.advance(30);
  page.window.learnaiDemo.setPaused(true);
  page.advance(500);
  assert.deepEqual(calls, []);
  page.window.learnaiDemo.setPaused(false);
  page.advance(49); assert.deepEqual(calls, []);
  page.advance(1); assert.deepEqual(calls, ['interval']);
  page.advance(20); assert.deepEqual(calls, ['interval', ['result', 42]]);
  page.advance(60); assert.deepEqual(calls, ['interval', ['result', 42], 'interval']);
  page.window.clearInterval(interval);
  page.window.learnaiDemo.setPaused(true);
  page.window.requestAnimationFrame(timestamp => calls.push(timestamp));
  page.advance(200);
  assert.equal(calls.length, 3);
  page.window.learnaiDemo.setPaused(false);
  page.advance(16);
  assert.equal(typeof calls.at(-1), 'number');
  assert.equal(page.scheduled.size, 0);
});

test('reduced motion starts paused and the toolbar resumes playback explicitly', () => {
  const page = runtime({ reducedMotion: true });
  page.ready();
  const button = page.document.getElementById('learnai-pause');
  assert.equal(button.textContent, '继续演示');
  let fired = false;
  page.window.setTimeout(() => { fired = true; }, 20);
  page.advance(100);
  assert.equal(fired, false);
  button.dispatchEvent({ type: 'click' });
  page.advance(20);
  assert.equal(fired, true);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
});

test('visibility changes pause pending callbacks and initially hidden documents also start paused', () => {
  const page = runtime();
  let fired = false;
  page.window.setTimeout(() => { fired = true; }, 100);
  page.advance(40);
  page.document.hidden = true;
  page.document.dispatchEvent({ type: 'visibilitychange' });
  page.advance(200);
  assert.equal(fired, false);
  assert.equal(page.window.learnaiDemo.paused, true);
  const hidden = runtime({ hidden: true });
  hidden.window.setTimeout(() => { fired = true; }, 10);
  hidden.advance(200);
  assert.equal(fired, false);
  assert.equal(hidden.window.learnaiDemo.paused, true);
});

test('height readiness reports use the local identifier and exact parent origin, including when paused', () => {
  const page = runtime({ reducedMotion: true });
  page.ready();
  page.advance(59); assert.equal(page.messages.length, 0);
  page.advance(1);
  assert.deepEqual(page.messages, [{ value: { type: 'agent-reference-height', demoId: 'tool-call', height: 1016 }, origin: 'https://learn.example' }]);
  const standalone = runtime({ standalone: true });
  standalone.ready(); standalone.advance(100);
  assert.deepEqual(standalone.messages, []);
});

test('a collapsed or reset demo can report a smaller content height than its old iframe viewport', () => {
  const page = runtime();
  page.ready(); page.advance(60);
  page.document.documentElement.scrollHeight = 2400;
  page.document.documentElement.clientHeight = 2400;
  page.document.body.scrollHeight = 600;
  page.document.body.offsetHeight = 600;
  page.document.body.clientHeight = 600;
  page.document.querySelector('.learnai-source').offsetHeight = 600;
  page.observers.find(observer => observer.kind === 'resize').callback([]);
  page.advance(60);
  assert.equal(page.messages.at(-1).value.height, 616);
  page.window.scrollY = 120;
  page.document.querySelector('.learnai-source').getBoundingClientRect = () => ({ bottom: 480 });
  page.observers.find(observer => observer.kind === 'resize').callback([]);
  page.advance(60);
  assert.equal(page.messages.at(-1).value.height, 616);
});

test('pagehide cancels all scheduled work and disconnects height observers, including queued notifications', () => {
  const page = runtime();
  page.ready();
  let fired = 0;
  page.window.setTimeout(() => fired++, 100);
  page.window.setInterval(() => fired++, 100);
  page.window.requestAnimationFrame(() => fired++);
  page.window.dispatchEvent({ type: 'pagehide' });
  assert.equal(page.scheduled.size, 0);
  assert.ok(page.observers.every(observer => observer.disconnected));
  for (const observer of page.observers) observer.callback([]);
  assert.equal(page.scheduled.size, 0);
  page.advance(1000);
  assert.equal(fired, 0);
  assert.deepEqual(page.messages, []);
});

test('lessonOnView observers cannot start a stale demo after pagehide', () => {
  const page = runtime({ lesson: true });
  const target = new page.Element('section');
  let fired = 0;
  page.window.lessonOnView(target, () => fired++);
  const observer = page.observers.find(item => item.kind === 'intersection');
  page.window.dispatchEvent({ type: 'pagehide' });
  assert.equal(observer.disconnected, true);
  observer.callback([{ target, isIntersecting: true }]);
  assert.equal(fired, 0);
});

test('lessonOnView starts its callback once even if further intersection entries were already queued', () => {
  const page = runtime({ lesson: true });
  const target = new page.Element('section');
  let fired = 0;
  page.window.lessonOnView(target, () => fired++);
  const observer = page.observers.find(item => item.kind === 'intersection');
  observer.callback([{ target, isIntersecting: true }, { target, isIntersecting: true }]);
  observer.callback([{ target, isIntersecting: true }]);
  assert.equal(fired, 1);
  assert.equal(observer.disconnected, true);
});
