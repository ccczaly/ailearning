import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileScript, parse } from '@vue/compiler-sfc';
import { createRenderer, h, markRaw, nextTick, reactive } from 'vue';
import ts from 'typescript';
import { getRagDemo, parseRagInteraction } from '../src/rag-interaction.ts';
const config={kind:'rag-demo',demoId:'rag-boundary',title:'RAG 演示'};
async function component(inlineTemplate = false) {
  const source = compileScript(parse(readFileSync(new URL('../src/components/RagInteraction.vue', import.meta.url), 'utf8')).descriptor,
    { id: 'reference-lab-test', inlineTemplate }).content
    .replaceAll('from "vue"', `from '${import.meta.resolve('vue')}'`)
    .replaceAll("from 'vue'", `from '${import.meta.resolve('vue')}'`)
    .replaceAll("from '../rag-interaction.ts'", `from '${new URL('../src/rag-interaction.ts', import.meta.url).href}'`);
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
  const props = reactive({ interaction: { ...config } });
  const app = renderer.createApp({ render: () => h(Component, props) });
  app.mount({});
  const state = app._instance.subTree.component.setupState;
  const navigations = [];
  const contentWindow = {};
  state.frame = markRaw({ contentWindow, setAttribute: (name, value) => navigations.push([name, value]) });
  const message = overrides => ({ origin: 'https://learn.example', source: contentWindow,
    data: { type: 'rag-demo-height', demoId: 'rag-boundary', height: 1200.2 }, ...overrides });
  t.after(() => {
    app.unmount();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  });
  return { app, state, props, listeners, navigations, message, contentWindow };
}

test('height reports require the current frame, same origin, matching identifier and a finite positive number', async t => {
  const { state, listeners, message } = await mount(t);
  const receive = listeners.get('message');
  for (const overrides of [
    { origin: 'https://other.example' }, { source: {} }, { source: null }, { data: null }, { data: [] },
    { data: { type: 'other', demoId: 'rag-boundary', height: 1000 } },
    { data: { type: 'rag-demo-height', demoId: 'chunking', height: 1000 } },
    ...[NaN, Infinity, -1, 0, '1200', null].map(height => ({ data: { type: 'rag-demo-height', demoId: 'rag-boundary', height } })),
  ]) receive(message(overrides));
  assert.equal(state.height, 860);
  assert.equal(state.loading, true);
  receive(message());
  assert.equal(state.height, 1201);
  assert.equal(state.loading, false);
  receive(message({ data: { type: 'rag-demo-height', demoId: 'rag-boundary', height: 20 } }));
  assert.equal(state.height, 360);
  receive(message({ data: { type: 'rag-demo-height', demoId: 'rag-boundary', height: 100_000 } }));
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
  props.interaction.demoId = 'chunking';
  await nextTick();
  assert.equal(state.height, 860);
  assert.equal(state.loading, true);
  assert.deepEqual(navigations.at(-1), ['src', 'about:blank']);
  receive(message());
  assert.equal(state.loading, true);
  const nextWindow = {};
  state.frame = markRaw({ contentWindow: nextWindow, setAttribute: (name, value) => navigations.push([name, value]) });
  receive(message({ data: { type: 'rag-demo-height', demoId: 'chunking', height: 1500 } }));
  assert.equal(state.height, 860);
  receive(message({ source: nextWindow, data: { type: 'rag-demo-height', demoId: 'chunking', height: 1500 } }));
  assert.equal(state.height, 1500);
  state.restart();
  app.unmount();
  assert.equal(listeners.size, 0);
  assert.deepEqual(navigations.at(-1), ['src', 'about:blank']);
  receive(message({ source: nextWindow, data: { type: 'rag-demo-height', demoId: 'chunking', height: 2200 } }));
  t.mock.timers.tick(20_000);
  assert.equal(state.height, 860);
  assert.equal(state.loadError, false);
});

test('RAG frame registry rejects untrusted sources',()=> {
 for(const demoId of ['../approval','https://example.com','__proto__',null,{}]) {
 assert.equal(getRagDemo(demoId),undefined);assert.equal(parseRagInteraction(JSON.stringify({...config,demoId})),undefined);
 }
 assert.equal(parseRagInteraction(JSON.stringify({...config,url:'https://example.com'})),undefined);
});

