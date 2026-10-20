import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { renderAiMarkdown } from '../src/ai-markdown.ts';

function moduleUrl(source) {
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
const apiUrl = moduleUrl(readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8'));
const api = await import(apiUrl);
const ai = await import(moduleUrl(readFileSync(new URL('../src/ai.ts', import.meta.url), 'utf8').replace("from './api'", `from '${apiUrl}'`)));
const encoder = new TextEncoder();
function stream(chunks) {
  return new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } });
}
function callbacks() {
  const output = { meta: [], text: '', completed: 0 };
  return { output, handlers: { meta(data) { output.meta.push(data); }, delta(text) { output.text += text; }, done() { output.completed++; } } };
}

test('UTF-8, CRLF, event names and JSON tolerate splitting at every byte', async () => {
  const wire = ': heartbeat\r\n\r\nevent: meta\r\ndata: {"conversationId":7,"sectionId":12}\r\n\r\nevent: delta\r\ndata: {"text":"你好，AI！\\n下一行"}\r\n\r\nevent: done\r\ndata: {"status":"COMPLETED"}\r\n\r\n';
  const bytes = encoder.encode(wire);
  const { output, handlers } = callbacks();
  await ai.consumeAiStream(stream([...bytes].map(byte => Uint8Array.of(byte))), handlers, new AbortController().signal);
  assert.deepEqual(output, { meta: [{ conversationId: 7, sectionId: 12 }], text: '你好，AI！\n下一行', completed: 1 });
});

test('SSE comments, multiline data and lone CR line endings are parsed', () => {
  const events = [];
  const parser = ai.createSseParser((event, data) => events.push({ event, data }));
  parser.feed(': keepalive\revent: delta\rdata: first\rdata: second\r');
  parser.feed('\revent: done\ndata: complete\n\n');
  parser.finish();
  assert.deepEqual(events, [{ event: 'delta', data: 'first\nsecond' }, { event: 'done', data: 'complete' }]);
});

test('an error after partial output preserves text and does not count as completed', async () => {
  const { output, handlers } = callbacks();
  await assert.rejects(ai.consumeAiStream(stream([encoder.encode('event: delta\ndata: {"text":"保留这段"}\n\nevent: error\ndata: {"code":"AI_BALANCE_INSUFFICIENT"}\n\n')]), handlers, new AbortController().signal), { code: 'AI_BALANCE_INSUFFICIENT' });
  assert.equal(output.text, '保留这段');
  assert.equal(output.completed, 0);
});

test('EOF without a complete done event is a failure, even after partial output', async () => {
  for (const ending of ['', 'event: done\ndata: {"status":"COMPLETED"}\n']) {
    const { output, handlers } = callbacks();
    await assert.rejects(ai.consumeAiStream(stream([encoder.encode(`event: delta\ndata: {"text":"半段回答"}\n\n${ending}`)]), handlers, new AbortController().signal), { code: 'AI_STREAM_INTERRUPTED' });
    assert.equal(output.text, '半段回答'); assert.equal(output.completed, 0);
  }
});

test('abort cancels a live reader and never reports completion', async () => {
  let cancelled = false;
  const controller = new AbortController();
  const { output, handlers } = callbacks();
  const live = new ReadableStream({ start(source) { source.enqueue(encoder.encode('event: delta\ndata: {"text":"一点内容"}\n\n')); }, cancel() { cancelled = true; } });
  await assert.rejects(ai.consumeAiStream(live, { ...handlers, delta(text) { handlers.delta(text); controller.abort(); } }, controller.signal), { name: 'AbortError' });
  assert.equal(cancelled, true); assert.equal(output.completed, 0); assert.equal(output.text, '一点内容');
});

test('HTTP 403 clears invalid CSRF state and never replays the paid POST', async (t) => {
  api.clearCsrf();
  let csrfCalls = 0; let chatCalls = 0;
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    if (path === '/api/auth/csrf') { csrfCalls++; return Response.json({ headerName: 'X-CSRF-TOKEN', token: `token-${csrfCalls}` }); }
    if (path === '/api/ai/chat') {
      chatCalls++; assert.equal(options.headers['X-CSRF-TOKEN'], 'token-1');
      assert.equal(options.credentials, 'same-origin');
      return Response.json({ code: 'CSRF_INVALID' }, { status: 403 });
    }
    assert.equal(options.headers.get('X-CSRF-TOKEN'), 'token-2');
    return Response.json({ ok: true });
  });
  const { handlers } = callbacks();
  await assert.rejects(ai.streamAiChat({ message: '测试' }, handlers, new AbortController().signal), { code: 'CSRF_INVALID' });
  await api.api('/test', { method: 'POST' });
  assert.equal(csrfCalls, 2); assert.equal(chatCalls, 1);
});

test('HTTP 401 notifies session expiry once without replaying the request', async (t) => {
  const previousWindow = globalThis.window;
  globalThis.window = new EventTarget();
  let expiryEvents = 0; let chatCalls = 0;
  window.addEventListener('auth-expired', () => { expiryEvents++; });
  t.mock.method(globalThis, 'fetch', async path => {
    if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'token' });
    chatCalls++; return Response.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  });
  try {
    const { handlers } = callbacks();
    await assert.rejects(ai.streamAiChat({ message: '测试' }, handlers, new AbortController().signal), { status: 401 });
    assert.equal(expiryEvents, 1); assert.equal(chatCalls, 1);
  } finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
});

test('malformed terminal events and non-SSE responses cannot succeed', async (t) => {
  const { handlers } = callbacks();
  await assert.rejects(ai.consumeAiStream(stream([encoder.encode('event: done\ndata: {"status":"FAILED"}\n\n')]), handlers, new AbortController().signal), { code: 'AI_PROTOCOL_ERROR' });
  t.mock.method(globalThis, 'fetch', async path => path === '/api/auth/csrf'
    ? Response.json({ headerName: 'X-CSRF-TOKEN', token: 'token' }) : Response.json({ unexpected: true }));
  await assert.rejects(ai.streamAiChat({ message: '测试' }, handlers, new AbortController().signal), { code: 'AI_PROTOCOL_ERROR' });
});

test('backend error codes give specific actionable messages', () => {
  for (const [code, text] of [
    ['AI_BALANCE_INSUFFICIENT', /余额不足/], ['AI_CREDENTIALS_INVALID', /凭据不可用/],
    ['AI_CONVERSATION_SCOPE_MISMATCH', /其他课节/],
    ['AI_RESPONSE_TOO_LONG', /长度限制/], ['AI_TIMEOUT', /超时/],
  ]) assert.match(ai.aiErrorText(new api.ApiError(502, code)), text);
});

test('AI markdown keeps HTML inert, rejects executable links and never loads remote images', () => {
  const html = renderAiMarkdown('<script>alert(1)</script>\n\n[坏链接](javascript:alert(1))\n\n![<svg onload=alert(1)>](https://example.com/leak?text=private)\n\n[参考](https://example.com/paper)');
  assert.doesNotMatch(html, /<script|<svg|<img|src=|href="javascript:|leak\?text/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /图片：/);
  assert.match(html, /&lt;svg onload=alert\(1\)&gt;/);
  assert.match(html, /href="https:\/\/example.com\/paper"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('Markdown links stay text links, even when they use action labels', () => {
  const html = renderAiMarkdown('[继续学习 →](/knowledge/rag?section=12)');
  assert.doesNotMatch(html, /ai-continue-learning/);
  assert.match(html, /target="_blank"/);
});

test('structured actions arrive separately from text in the done event', async () => {
  const action = { type: 'continue_learning', label: '接着学', url: '/knowledge/rag?section=12' };
  let actions;
  const { output, handlers } = callbacks();
  const wire = 'event: delta\ndata: {"text":"已完成 8 节"}\n\nevent: done\ndata: '
    + JSON.stringify({ status: 'COMPLETED', actions: [action] }) + '\n\n';
  await ai.consumeAiStream(stream([encoder.encode(wire)]), { ...handlers, done(value) { actions = value; handlers.done(); } }, new AbortController().signal);
  assert.equal(output.text, '已完成 8 节');
  assert.deepEqual(actions, [action]);
});

test('only supported actions with local course URLs are accepted', () => {
  const valid = { type: 'review_course', label: '复习课程', url: '/knowledge/rag?section=12' };
  assert.deepEqual(ai.parseAiActions([null, valid, { ...valid, url: 'javascript:alert(1)' },
    { ...valid, url: 'https://example.com' }, { ...valid, type: 'delete_account' }]), [valid]);
  assert.deepEqual(ai.parseAiActions(undefined), []);
});
