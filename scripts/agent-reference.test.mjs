import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileScript, parse } from '@vue/compiler-sfc';
import { createRenderer, createSSRApp, h, markRaw, nextTick, reactive } from 'vue';
import { renderToString } from '@vue/server-renderer';
import ts from 'typescript';
import { agentReferenceDemos, getAgentReferenceDemo } from '../src/agent-reference-demos.ts';
import { parseAgentInteraction } from '../src/agent-interaction.ts';

const expected = {
  'tool-call': 'tool-schema', 'tool-messages': 'tool-messages', 'tool-design': 'tool-design',
  orchestration: 'tool-orchestration', react: 'agent-loop', 'context-window': 'context-budget',
  compression: 'context-retrieval', 'vector-search': 'agent-embedding', skill: 'agent-skill',
  'skill-file': 'agent-skill-file', mcp: 'agent-mcp', failures: 'idempotency',
  approval: 'approval-state', tracing: 'agent-trace', 'multi-agent': 'agent-organization', harness: 'system-design',
};
const config = { kind: 'reference-demo', title: '工具调用演示', prompt: '逐步观察工具调用。', demoId: 'tool-call' };
async function component(inlineTemplate = false) {
  const source = compileScript(parse(readFileSync(new URL('../src/components/AgentReferenceLab.vue', import.meta.url), 'utf8')).descriptor,
    { id: 'reference-lab-test', inlineTemplate }).content
    .replaceAll('from "vue"', `from '${import.meta.resolve('vue')}'`)
    .replaceAll("from 'vue'", `from '${import.meta.resolve('vue')}'`)
    .replaceAll("from '../agent-reference-demos.ts'", `from '${new URL('../src/agent-reference-demos.ts', import.meta.url).href}'`);
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return (await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)).default;
}
const renderer = createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null });

async function mount(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const listeners = new Map();
  globalThis.window = { location: { origin: 'https://learn.example' },
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: (type, callback) => { if (listeners.get(type) === callback) listeners.delete(type); } };
  const Component = await component();
  Component.render = () => null;
  const props = reactive({ demoId: 'tool-call', title: config.title, prompt: config.prompt });
  const app = renderer.createApp({ render: () => h(Component, props) });
  app.mount({});
  const state = app._instance.subTree.component.setupState;
  const navigations = [];
  const contentWindow = {};
  state.frame = markRaw({ contentWindow, setAttribute: (name, value) => navigations.push([name, value]) });
  const message = overrides => ({ origin: 'https://learn.example', source: contentWindow,
    data: { type: 'agent-reference-height', demoId: 'tool-call', height: 1200.2 }, ...overrides });
  t.after(() => {
    app.unmount();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  });
  return { app, state, props, listeners, navigations, message, contentWindow };
}

test('the local registry contains exactly the 16 approved lesson mappings and fixed paths', () => {
  assert.equal(agentReferenceDemos.length, 16);
  assert.deepEqual(Object.fromEntries(agentReferenceDemos.map(demo => [demo.demoId, demo.lessonKey])), expected);
  assert.equal(new Set(agentReferenceDemos.map(demo => demo.lessonKey)).size, 16);
  assert.equal(Object.isFrozen(agentReferenceDemos), true);
  for (const demo of agentReferenceDemos) {
    assert.equal(Object.isFrozen(demo), true);
    assert.equal(demo.path, `/demos/agent-reference/${demo.demoId}/index.html`);
    assert.equal(getAgentReferenceDemo(demo.demoId), demo);
    assert.deepEqual(parseAgentInteraction(JSON.stringify({ ...config, demoId: demo.demoId })), { ...config, demoId: demo.demoId });
  }
});

test('authored config cannot choose arbitrary iframe URLs or bypass the identifier whitelist', () => {
  for (const demoId of [null, undefined, 1, {}, [], '', '__proto__', 'constructor', '../approval', 'tool-call?x=1',
    '/demos/agent-intro/index.html', 'https://example.com', 'javascript:alert(1)', '<iframe>']) {
    assert.equal(getAgentReferenceDemo(demoId), undefined);
    assert.equal(parseAgentInteraction(JSON.stringify({ ...config, demoId })), undefined);
  }
  for (const extra of ['url', 'src', 'path', 'html', 'script', 'onload'])
    assert.equal(parseAgentInteraction(JSON.stringify({ ...config, [extra]: 'https://example.com' })), undefined);
  for (const field of ['title', 'prompt'])
    assert.equal(parseAgentInteraction(JSON.stringify({ ...config, [field]: ' ' })), undefined);
});

test('the container renders only registered local sources and escapes authored prose', async () => {
  const Component = await component(true);
  for (const demo of agentReferenceDemos) {
    const html = await renderToString(createSSRApp({ render: () => h(Component,
      { ...config, demoId: demo.demoId, prompt: '<script>alert(1)</script>', src: 'https://example.com' }) }));
    assert.ok(html.includes(`src="${demo.path}"`));
    assert.ok(html.includes(`href="${demo.path}"`));
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /正在准备演示/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.doesNotMatch(html, /<script>|<iframe[^>]*src="https:/);
  }
  const invalid = await renderToString(createSSRApp({ render: () => h(Component, { ...config, demoId: '../approval' }) }));
  assert.doesNotMatch(invalid, /<iframe|<a /);
  assert.match(invalid, /role="alert"/);
});

test('height reports require the current frame, same origin, matching identifier and a finite positive number', async t => {
  const { state, listeners, message } = await mount(t);
  const receive = listeners.get('message');
  for (const overrides of [
    { origin: 'https://other.example' }, { source: {} }, { source: null }, { data: null }, { data: [] },
    { data: { type: 'other', demoId: 'tool-call', height: 1000 } },
    { data: { type: 'agent-reference-height', demoId: 'skill', height: 1000 } },
    ...[NaN, Infinity, -1, 0, '1200', null].map(height => ({ data: { type: 'agent-reference-height', demoId: 'tool-call', height } })),
  ]) receive(message(overrides));
  assert.equal(state.height, 860);
  assert.equal(state.loading, true);
  receive(message());
  assert.equal(state.height, 1201);
  assert.equal(state.loading, false);
  receive(message({ data: { type: 'agent-reference-height', demoId: 'tool-call', height: 20 } }));
  assert.equal(state.height, 360);
  receive(message({ data: { type: 'agent-reference-height', demoId: 'tool-call', height: 100_000 } }));
  assert.equal(state.height, 6000);
  t.mock.timers.tick(20_000);
  assert.equal(state.loadError, false);
});

test('missing readiness reports fail with retry; native loading failures also retire the old page', async t => {
  const { state, navigations, message } = await mount(t);
  t.mock.timers.tick(15_000);
  assert.equal(state.loadError, true);
  assert.equal(state.loading, false);
  assert.deepEqual(navigations.at(-1), ['src', 'about:blank']);
  state.resize(message());
  assert.equal(state.height, 860);
  const attempt = state.attempt;
  state.restart();
  assert.equal(state.attempt, attempt + 1);
  assert.equal(state.loadError, false);
  assert.equal(state.loading, true);
  state.resize(message());
  assert.equal(state.loading, false);
  state.fail();
  assert.equal(state.loadError, true);
  assert.deepEqual(navigations.at(-1), ['src', 'about:blank']);
});

test('lesson switches reset dimensions and reject previous reports; unmount cancels waiting and removes its listener', async t => {
  const { app, state, props, listeners, navigations, message } = await mount(t);
  const receive = listeners.get('message');
  receive(message());
  props.demoId = 'skill';
  await nextTick();
  assert.equal(state.height, 860);
  assert.equal(state.loading, true);
  assert.deepEqual(navigations.at(-1), ['src', 'about:blank']);
  receive(message());
  assert.equal(state.loading, true);
  const nextWindow = {};
  state.frame = markRaw({ contentWindow: nextWindow, setAttribute: (name, value) => navigations.push([name, value]) });
  receive(message({ data: { type: 'agent-reference-height', demoId: 'skill', height: 1500 } }));
  assert.equal(state.height, 860);
  receive(message({ source: nextWindow, data: { type: 'agent-reference-height', demoId: 'skill', height: 1500 } }));
  assert.equal(state.height, 1500);
  state.restart();
  app.unmount();
  assert.equal(listeners.size, 0);
  assert.deepEqual(navigations.at(-1), ['src', 'about:blank']);
  receive(message({ source: nextWindow, data: { type: 'agent-reference-height', demoId: 'skill', height: 2200 } }));
  t.mock.timers.tick(20_000);
  assert.equal(state.height, 860);
  assert.equal(state.loadError, false);
});
