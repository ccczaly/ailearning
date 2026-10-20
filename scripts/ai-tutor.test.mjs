import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileScript, parse } from '@vue/compiler-sfc';
import { createRenderer, h, nextTick, reactive } from 'vue';
import ts from 'typescript';
import { createAiDrawerState, createAiHistory } from '../src/ai-history.ts';

function moduleUrl(source) {
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
const source = readFileSync(new URL('../src/components/AiTutor.vue', import.meta.url), 'utf8');
const script = compileScript(parse(source).descriptor, { id: 'ai-tutor-regression' }).content;
const historyUrl = moduleUrl(readFileSync(new URL('../src/ai-history.ts', import.meta.url), 'utf8'));
const vueUrl = import.meta.resolve('vue');
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode: () => null, nextSibling: () => null,
});
const contexts = new Map();
globalThis.__aiTutorTestContexts = contexts;
let sequence = 0;
const general = { userId: 1 };
const conversation = (id, sectionId = null) => ({ id, sectionId, title: `问题 ${id}`, updatedAt: '2026-10-13T10:00:00Z' });
const message = (content) => ({ role: 'assistant', content, status: 'COMPLETED' });
function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
async function settle() { await nextTick(); await new Promise(resolve => setImmediate(resolve)); await nextTick(); }

// Mount the actual SFC setup through Vue's renderer so runtime Boolean prop
// defaults, lifecycle hooks and scope watchers are exercised together.
async function mount({ props = {}, local = storage(), session = storage(), list, load, stream } = {}) {
  const previous = { window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement };
  globalThis.window = { localStorage: local, sessionStorage: session };
  globalThis.document = { activeElement: null, addEventListener() {}, removeEventListener() {} };
  globalThis.HTMLElement = class {};
  const calls = [];
  const id = ++sequence;
  const context = {
    auth: reactive({ user: { id: 1 }, ready: true }),
    async listConversations(sectionId, signal) { calls.push({ type: 'list', sectionId, signal }); return list ? list(sectionId, signal) : [conversation(3), conversation(2)]; },
    async listMessages(conversationId, signal) { calls.push({ type: 'messages', id: conversationId, signal }); return load ? load(conversationId, signal) : [message(`回答 ${conversationId}`)]; },
    async streamAiChat(request, callbacks, signal) {
      calls.push({ type: 'chat', request, signal });
      if (stream) return stream(request, callbacks, signal);
      callbacks.meta({ conversationId: request.conversationId ?? 7, sectionId: request.sectionId ?? null });
      callbacks.delta('新的回答'); callbacks.done();
    },
  };
  contexts.set(id, context);
  const contextCode = `const context = globalThis.__aiTutorTestContexts.get(${id});`;
  const aiUrl = moduleUrl(`${contextCode} export const listConversations = context.listConversations; export const listMessages = context.listMessages; export const streamAiChat = context.streamAiChat; export const aiErrorText = error => error.message ?? '加载失败';`);
  const authUrl = moduleUrl(`${contextCode} export const auth = context.auth;`);
  const imageUrl = moduleUrl("export default '';");
  const markdownUrl = moduleUrl('export const renderAiMarkdown = value => value;');
  const compiled = script
    .replaceAll("from 'vue'", `from '${vueUrl}'`)
    .replaceAll("from '../ai'", `from '${aiUrl}'`)
    .replaceAll("from '../auth'", `from '${authUrl}'`)
    .replaceAll("from '../ai-history'", `from '${historyUrl}'`)
    .replaceAll("from '../ai-markdown'", `from '${markdownUrl}'`)
    .replaceAll("from '../assets/xiaobaozi.png'", `from '${imageUrl}'`);
  const component = (await import(moduleUrl(compiled))).default;
  component.render = () => null;
  const rootProps = reactive(props);
  const app = renderer.createApp({ render: () => h(component, { ...rootProps }) });
  app.mount({});
  const instance = app._instance.subTree.component;
  return {
    state: instance.setupState, exposed: instance.exposed, props: rootProps, context, calls, local, session,
    unmount() {
      app.unmount(); contexts.delete(id);
      for (const key of ['window', 'document', 'HTMLElement']) {
        if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key];
      }
    },
  };
}

test('homepage tutor with omitted readiness prop loads its latest historical messages', async () => {
  const tutor = await mount();
  try {
    await tutor.exposed.open();
    assert.equal(tutor.state.historyLoading, false);
    assert.equal(tutor.state.conversationId, 3);
    assert.equal(tutor.state.messages[0].content, '回答 3');
    assert.deepEqual(tutor.calls.map(call => call.type), ['list', 'messages']);
  } finally { tutor.unmount(); }
});

test('a previously open homepage tutor restores on mount without sending a model request', async () => {
  const session = storage();
  createAiDrawerState(() => session).rememberOpen(general, true);
  const tutor = await mount({ session });
  try {
    await settle();
    assert.equal(tutor.state.visible, true);
    assert.equal(tutor.state.historyLoading, false);
    assert.equal(tutor.state.messages[0].content, '回答 3');
    assert.equal(tutor.calls.some(call => call.type === 'chat'), false);
    tutor.state.close();
    assert.equal(createAiDrawerState(() => session).wasOpen(general), false);
  } finally { tutor.unmount(); }
});

test('lesson auto-restore waits for a ready lesson and never fetches general conversations', async () => {
  const session = storage();
  createAiDrawerState(() => session).rememberOpen({ userId: 1, sectionId: 41 }, true);
  const tutor = await mount({ props: { contextReady: false }, session, list: async () => [conversation(8, 41)] });
  try {
    await settle();
    assert.equal(tutor.calls.length, 0);
    tutor.props.sectionId = 41; tutor.props.contextReady = true;
    await settle();
    assert.equal(tutor.state.visible, true);
    assert.equal(tutor.state.conversationId, 8);
    assert.equal(tutor.state.messages[0].content, '回答 8');
    assert.deepEqual(tutor.calls.filter(call => call.type === 'list').map(call => call.sectionId), [41]);
  } finally { tutor.unmount(); }
});

test('homepage question waits for selected historical messages before sending in that conversation', async () => {
  const local = storage();
  createAiHistory({ storage: () => local }).remember(general, 2);
  const pendingList = deferred(); const pendingMessages = deferred();
  const tutor = await mount({ local, list: async () => pendingList.promise, load: async () => pendingMessages.promise });
  try {
    const opening = tutor.exposed.open('继续昨天的问题');
    await settle();
    assert.equal(tutor.calls.some(call => call.type === 'chat'), false);
    pendingList.resolve([conversation(3), conversation(2)]);
    await settle();
    assert.equal(tutor.calls.some(call => call.type === 'chat'), false);
    pendingMessages.resolve([message('昨天的回答')]);
    await opening;
    const chats = tutor.calls.filter(call => call.type === 'chat');
    assert.equal(chats.length, 1);
    assert.equal(chats[0].request.conversationId, 2);
    assert.equal(chats[0].request.message, '继续昨天的问题');
    assert.equal(tutor.state.messages[0].content, '昨天的回答');
  } finally { tutor.unmount(); }
});

test('failed history preserves homepage draft and GET retry never automatically sends it', async () => {
  let attempts = 0;
  const tutor = await mount({ load: async () => {
    if (++attempts === 1) throw Error('网络中断');
    return [message('恢复的历史')];
  } });
  try {
    await tutor.exposed.open('保留这个问题');
    assert.equal(tutor.state.historyFailed, true);
    assert.equal(tutor.state.draft, '保留这个问题');
    await tutor.state.send();
    assert.equal(tutor.calls.some(call => call.type === 'chat'), false);
    await tutor.state.retryHistory();
    assert.equal(tutor.state.historyFailed, false);
    assert.equal(tutor.state.draft, '保留这个问题');
    assert.equal(tutor.calls.some(call => call.type === 'chat'), false);
    await tutor.state.send();
    assert.equal(tutor.calls.filter(call => call.type === 'chat').length, 1);
  } finally { tutor.unmount(); }
});

test('stopping a first turn retains the minted conversation in the picker and rejects late callbacks', async () => {
  const pending = deferred(); let callbacks;
  const tutor = await mount({ list: async () => [], stream: async (_request, handlers) => {
    callbacks = handlers; handlers.meta({ conversationId: 7, sectionId: null }); handlers.delta('已收到的回答');
    return pending.promise;
  } });
  try {
    await tutor.exposed.open();
    tutor.state.draft = '新的问题';
    const sending = tutor.state.send();
    await settle();
    tutor.state.stop();
    assert.equal(tutor.state.conversationId, 7);
    assert.equal(tutor.state.conversations[0].title, '新的问题');
    assert.equal(tutor.state.messages[1].status, 'CANCELLED');
    callbacks.delta('不应显示'); callbacks.done(); pending.resolve(); await sending;
    assert.equal(tutor.state.messages[1].content, '已收到的回答');
    assert.equal(tutor.state.messages[1].status, 'CANCELLED');
    assert.deepEqual([...tutor.local.values.values()], ['7']);
  } finally { tutor.unmount(); }
});

test('completed replies store structured actions without inserting them into text', async () => {
  const actions = [{ type: 'continue_learning', label: '接着学', url: '/knowledge/rag?section=12' }];
  const tutor = await mount({ stream: async (request, callbacks) => {
    callbacks.meta({ conversationId: 7, sectionId: null });
    callbacks.delta('已完成 8 节'); callbacks.done(actions);
  } });
  try {
    await tutor.exposed.open();
    await tutor.state.send('学习进度');
    const reply = tutor.state.messages.at(-1);
    assert.equal(reply.content, '已完成 8 节');
    assert.deepEqual(reply.actions, actions);
    assert.equal(reply.status, 'COMPLETED');
  } finally { tutor.unmount(); }
});
