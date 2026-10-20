import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiDrawerState, createAiHistory } from '../src/ai-history.ts';

const general = { userId: 1 };
const conversation = (id, sectionId = null) => ({ id, title: `问题 ${id}`, sectionId, updatedAt: '2026-10-13T10:00:00Z' });
const message = (text) => ({ role: 'assistant', content: text, status: 'COMPLETED' });
function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function history({ saved = storage(), conversations = [conversation(3), conversation(2)], messages = {}, load } = {}) {
  const calls = [];
  return {
    calls, saved,
    session: createAiHistory({
      storage: () => saved,
      async listConversations(sectionId, signal) { calls.push({ type: 'list', sectionId, signal }); return conversations; },
      async listMessages(id, signal) { calls.push({ type: 'messages', id, signal }); return load ? load(id, signal) : messages[id] ?? [message(`回答 ${id}`)]; },
    }),
  };
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('a fresh page restores the latest conversation and reads its messages from the API', async () => {
  const { session, calls } = history();
  const restored = await session.restore(general);
  assert.equal(restored.conversationId, 3);
  assert.equal(restored.messages[0].content, '回答 3');
  assert.deepEqual(calls.map(call => call.type), ['list', 'messages']);
});

test('an older selected conversation survives a full session recreation with freshly updated messages', async () => {
  const first = history();
  await first.session.restore(general, 2);
  const reloaded = history({ saved: first.saved, messages: { 2: [message('服务器上的新回答')] } });
  const restored = await reloaded.session.restore(general);
  assert.equal(restored.conversationId, 2);
  assert.equal(restored.messages[0].content, '服务器上的新回答');
  // Local persistence contains only the ID, never the private message or title.
  assert.deepEqual([...first.saved.values.values()], ['2']);
});

test('remembered selections are isolated by both account and lesson scope', async () => {
  const saved = storage();
  const first = history({ saved });
  first.session.remember(general, 2);
  first.session.remember({ userId: 2 }, 3);
  first.session.remember({ userId: 1, sectionId: 41 }, 9);
  first.session.remember({ userId: 1, sectionId: 42 }, null);
  const reloaded = history({ saved, conversations: [conversation(3), conversation(2), conversation(10, 41), conversation(9, 41), conversation(11, 42)] });
  assert.equal((await reloaded.session.restore(general)).conversationId, 2);
  assert.equal((await reloaded.session.restore({ userId: 2 })).conversationId, 3);
  assert.equal((await reloaded.session.restore({ userId: 1, sectionId: 41 })).conversationId, 9);
  assert.equal((await reloaded.session.restore({ userId: 1, sectionId: 42 })).conversationId, undefined);
  assert.equal((await reloaded.session.restore({ userId: 3 })).conversationId, 3);
});

test('a deleted remembered ID falls back to the current latest available conversation', async () => {
  const saved = storage();
  history({ saved }).session.remember(general, 99);
  const reloaded = history({ saved });
  assert.equal((await reloaded.session.restore(general)).conversationId, 3);
  assert.deepEqual(reloaded.calls.filter(call => call.type === 'messages').map(call => call.id), [3]);
  assert.deepEqual([...saved.values.values()], ['3']);
});

test('a conversation deleted between listing and message loading falls back safely', async () => {
  const { session, calls } = history({ load: async id => {
    if (id === 3) throw { status: 404, code: 'AI_CONVERSATION_NOT_FOUND' };
    return [message('仍可继续的对话')];
  } });
  const restored = await session.restore(general);
  assert.equal(restored.conversationId, 2);
  assert.deepEqual(restored.conversations.map(item => item.id), [2]);
  assert.deepEqual(calls.filter(call => call.type === 'messages').map(call => call.id), [3, 2]);
});

test('choosing new remains blank after reload until a minted conversation ID is remembered', async () => {
  const saved = storage();
  history({ saved }).session.remember(general, null);
  const reloaded = history({ saved });
  const blank = await reloaded.session.restore(general);
  assert.equal(blank.conversationId, undefined);
  assert.deepEqual(blank.messages, []);
  assert.equal(blank.conversations.length, 2);
  assert.deepEqual(reloaded.calls.map(call => call.type), ['list']);
  reloaded.session.remember(general, 2);
  assert.equal((await history({ saved }).session.restore(general)).conversationId, 2);
});

test('empty or entirely unavailable history resolves to a safe new conversation', async () => {
  const empty = history({ conversations: [] });
  empty.session.remember(general, 99);
  assert.deepEqual(await empty.session.restore(general), { conversations: [], messages: [] });
  assert.equal(empty.saved.values.size, 0);
  const missing = history({ load: async () => { throw { status: 404 }; } });
  assert.deepEqual(await missing.session.restore(general), { conversations: [], messages: [] });
});

test('denied browser storage still allows history loading and in-session selections', async () => {
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }, removeItem() { throw Error('denied'); } };
  const { session } = history({ saved: denied });
  assert.equal((await session.restore(general)).conversationId, 3);
  await session.restore(general, 2);
  assert.equal((await session.restore(general)).conversationId, 2);
  session.remember(general, null);
  assert.deepEqual((await session.restore(general)).messages, []);
});

test('failed storage writes cannot let an old readable ID override the in-session new selection', async () => {
  const saved = storage();
  history({ saved }).session.remember(general, 3);
  saved.setItem = () => { throw Error('quota exceeded'); };
  const { session } = history({ saved });
  session.remember(general, null);
  assert.equal((await session.restore(general)).conversationId, undefined);
  await session.restore(general, 2);
  assert.equal((await session.restore(general)).conversationId, 2);
});

test('transient message failures reject instead of selecting a different or ambiguous conversation', async () => {
  const { session, calls, saved } = history({ load: async () => { throw { status: 503, code: 'UNAVAILABLE' }; } });
  session.remember(general, 2);
  await assert.rejects(session.restore(general), { status: 503 });
  assert.deepEqual(calls.filter(call => call.type === 'messages').map(call => call.id), [2]);
  assert.deepEqual([...saved.values.values()], ['2']);
});

test('a failed history GET is retried only when requested and can recover', async () => {
  let attempts = 0;
  const { session, calls } = history({ load: async () => {
    if (++attempts === 1) throw Error('network unavailable');
    return [message('网络恢复后的历史')];
  } });
  await assert.rejects(session.restore(general), /network unavailable/);
  assert.equal(attempts, 1);
  const retry = await session.restore(general);
  assert.equal(retry.messages[0].content, '网络恢复后的历史');
  assert.equal(attempts, 2);
  assert.ok(calls.every(call => ['list', 'messages'].includes(call.type)));
});

test('switching lessons cancels delayed message requests even when transport ignores abort', async () => {
  const pending = deferred();
  const { session, calls, saved } = history({ conversations: [conversation(3), conversation(8, 41)], load: async id => id === 3 ? pending.promise : [message('课节 41 的历史')] });
  const old = session.restore(general);
  await Promise.resolve();
  const current = await session.restore({ userId: 1, sectionId: 41 });
  assert.equal(current.conversationId, 8);
  pending.resolve([message('不应显示的旧历史')]);
  assert.equal(await old, undefined);
  assert.equal(calls.find(call => call.type === 'messages' && call.id === 3).signal.aborted, true);
  assert.deepEqual([...saved.values.values()], ['8']);
});

test('closing cancels an outstanding list request with no late message GET or persisted selection', async () => {
  const pending = deferred();
  const saved = storage();
  let signal;
  let messageCalls = 0;
  const session = createAiHistory({ storage: () => saved,
    listConversations: async (_sectionId, requestSignal) => { signal = requestSignal; return pending.promise; },
    listMessages: async () => { messageCalls++; return [message('迟到的历史')]; },
  });
  const closed = session.restore(general);
  session.cancel();
  pending.resolve([conversation(3)]);
  assert.equal(await closed, undefined);
  assert.equal(signal.aborted, true);
  assert.equal(messageCalls, 0);
  assert.equal(saved.values.size, 0);
});

test('changing accounts prevents a delayed old response from overwriting the new selection', async () => {
  const pending = deferred();
  let requests = 0;
  const { session, saved } = history({ load: async () => ++requests === 1 ? pending.promise : [message('账号 2 的历史')] });
  const old = session.restore(general, 2);
  await Promise.resolve();
  const current = await session.restore({ userId: 2 }, 3);
  pending.resolve([message('账号 1 的私密历史')]);
  assert.equal(await old, undefined);
  assert.equal(current.conversationId, 3);
  assert.deepEqual([...saved.values.values()], ['3']);
});

test('an open tutor is remembered across page recreation and explicit close clears it', () => {
  const saved = storage();
  const first = createAiDrawerState(() => saved);
  assert.equal(first.wasOpen(general), false);
  first.rememberOpen(general, true);
  const refreshed = createAiDrawerState(() => saved);
  assert.equal(refreshed.wasOpen(general), true);
  refreshed.rememberOpen(general, false);
  assert.equal(createAiDrawerState(() => saved).wasOpen(general), false);
  assert.equal(saved.values.size, 0);
});

test('drawer-open flags are isolated by user and lesson and contain no message content', () => {
  const saved = storage();
  const drawer = createAiDrawerState(() => saved);
  drawer.rememberOpen({ userId: 1, sectionId: 41 }, true);
  assert.equal(drawer.wasOpen(general), false);
  assert.equal(drawer.wasOpen({ userId: 2, sectionId: 41 }), false);
  assert.equal(drawer.wasOpen({ userId: 1, sectionId: 42 }), false);
  assert.equal(drawer.wasOpen({ userId: 1, sectionId: 41 }), true);
  assert.deepEqual([...saved.values.values()], ['true']);
});

test('drawer controls still work when session storage access fails', () => {
  const drawer = createAiDrawerState(() => { throw Error('blocked'); });
  assert.equal(drawer.wasOpen(general), false);
  drawer.rememberOpen(general, true);
  assert.equal(drawer.wasOpen(general), true);
  drawer.rememberOpen(general, false);
  assert.equal(drawer.wasOpen(general), false);
});
