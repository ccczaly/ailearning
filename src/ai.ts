import { api, ApiError, clearCsrf, refreshCsrf } from './api';

export type AiConversation = { id: number; title: string; sectionId: number | null; updatedAt: string };
export type AiAction = { type: 'continue_learning' | 'review_course'; label: string; url: string };
export type AiMessage = { id?: number; role: 'user' | 'assistant'; content: string; status: 'COMPLETED' | 'CANCELLED' | 'FAILED'; createdAt?: string; actions?: AiAction[] };
export type ChatRequest = { message: string; sectionId?: number; conversationId?: number };
type ChatCallbacks = {
  meta: (data: { conversationId: number; sectionId: number | null }) => void;
  delta: (text: string) => void;
  done: (actions: AiAction[]) => void;
};

export function listConversations(sectionId?: number, signal?: AbortSignal) {
  return api<AiConversation[]>(`/ai/conversations${sectionId === undefined ? '' : `?sectionId=${sectionId}`}`, { signal });
}
// Share validation between streamed replies and restored history. Unknown actions
// are ignored so a newer backend can add operations without breaking old clients.
export function parseAiActions(value: unknown): AiAction[] {
  if (!Array.isArray(value)) return [];
  return value.filter((action): action is AiAction => Boolean(action) && typeof action === 'object'
    && ['continue_learning', 'review_course'].includes(action.type)
    && typeof action.label === 'string' && action.label.trim().length > 0
    && typeof action.url === 'string' && /^\/knowledge\/[a-z0-9-]+\?section=[1-9]\d*$/.test(action.url));
}
export async function listMessages(id: number, signal?: AbortSignal) {
  const messages = await api<AiMessage[]>(`/ai/conversations/${id}/messages`, { signal });
  return messages.map(message => ({ ...message, actions: message.role === 'assistant' && message.status === 'COMPLETED' ? parseAiActions(message.actions) : [] }));
}

// Keep incomplete lines between chunks, including a CR whose LF arrives later.
// UTF-8 decoding happens before this parser, with TextDecoder's streaming mode.
export function createSseParser(onEvent: (event: string, data: string) => void) {
  let pending = '';
  let event = 'message';
  let data: string[] = [];
  function line(value: string) {
    if (!value) {
      const currentEvent = event;
      const currentData = data;
      event = 'message'; data = [];
      if (currentData.length) onEvent(currentEvent, currentData.join('\n'));
      return;
    }
    if (value.startsWith(':')) return;
    const separator = value.indexOf(':');
    const field = separator < 0 ? value : value.slice(0, separator);
    let content = separator < 0 ? '' : value.slice(separator + 1);
    if (content.startsWith(' ')) content = content.slice(1);
    if (field === 'event') event = content;
    if (field === 'data') data.push(content);
  }
  function consume(final: boolean) {
    while (true) {
      const boundary = pending.search(/[\r\n]/);
      if (boundary < 0) break;
      const cr = pending[boundary] === '\r';
      if (cr && boundary === pending.length - 1 && !final) break;
      const end = boundary + (cr && pending[boundary + 1] === '\n' ? 2 : 1);
      const value = pending.slice(0, boundary);
      pending = pending.slice(end);
      line(value);
    }
    // An event needs its blank line delimiter; truncated data is not completion.
    if (final && pending) { line(pending); pending = ''; }
  }
  return { feed(chunk: string) { pending += chunk; consume(false); }, finish() { consume(true); } };
}

export async function consumeAiStream(body: ReadableStream<Uint8Array>, callbacks: ChatCallbacks, signal: AbortSignal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let completed = false;
  const parser = createSseParser((event, raw) => {
    if (completed || !['meta', 'delta', 'done', 'error'].includes(event)) return;
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw) as Record<string, unknown>; }
    catch { throw new ApiError(502, 'AI_PROTOCOL_ERROR'); }
    if (!data || typeof data !== 'object') throw new ApiError(502, 'AI_PROTOCOL_ERROR');
    if (event === 'error') throw new ApiError(502, typeof data.code === 'string' ? data.code : 'AI_PROVIDER_ERROR');
    if (event === 'meta') {
      if (typeof data.conversationId !== 'number' || !Number.isInteger(data.conversationId) || data.conversationId < 1 ||
          !(data.sectionId === null || typeof data.sectionId === 'number')) throw new ApiError(502, 'AI_PROTOCOL_ERROR');
      callbacks.meta({ conversationId: data.conversationId, sectionId: data.sectionId });
    }
    if (event === 'delta') {
      if (typeof data.text !== 'string') throw new ApiError(502, 'AI_PROTOCOL_ERROR');
      callbacks.delta(data.text);
    }
    if (event === 'done') {
      if (data.status !== 'COMPLETED') throw new ApiError(502, 'AI_PROTOCOL_ERROR');
      completed = true; callbacks.done(parseAiActions(data.actions));
    }
  });
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    while (!completed) {
      const { value, done } = await reader.read();
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (done) { parser.feed(decoder.decode()); parser.finish(); break; }
      parser.feed(decoder.decode(value, { stream: true }));
    }
    if (!completed) throw new ApiError(502, 'AI_STREAM_INTERRUPTED');
  } finally {
    signal.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function streamAiChat(request: ChatRequest, callbacks: ChatCallbacks, signal: AbortSignal) {
  const message = request.message.trim();
  if (!message || message.length > 1000) throw new ApiError(400, 'AI_INPUT_INVALID');
  const token = await refreshCsrf();
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  // A request may spend credits, so errors are never retried automatically.
  const response = await fetch('/api/ai/chat', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', [token.headerName]: token.token },
    body: JSON.stringify({ ...request, message }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (data.code === 'CSRF_INVALID') clearCsrf();
    if (response.status === 401) window.dispatchEvent(new Event('auth-expired'));
    throw new ApiError(response.status, data.code ?? 'AI_REQUEST_FAILED');
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new ApiError(502, 'AI_PROTOCOL_ERROR');
  await consumeAiStream(response.body, callbacks, signal);
}

export function aiErrorText(error: unknown): string {
  if (!(error instanceof ApiError)) return '连接中断，请检查网络后手动重试。';
  const messages: Record<string, string> = {
    AI_UNAVAILABLE: 'AI 助教暂不可用，请联系管理员检查配置。',
    AI_BALANCE_INSUFFICIENT: 'AI 账户余额不足，请联系管理员充值后再试。',
    AI_CREDENTIALS_INVALID: 'AI 服务凭据不可用，请联系管理员检查配置。',
    AI_PROVIDER_BUSY: 'AI 服务正忙，请稍后手动重试。',
    AI_INPUT_INVALID: '请输入 1–1000 字的问题。',
    AI_INVALID_REQUEST: '提问内容或对话信息无效，请检查问题后重新发送。',
    AI_SECTION_NOT_FOUND: '这节内容暂不可用，请选择已发布的课节。',
    AI_CONVERSATION_NOT_FOUND: '这段对话已不可用，请新建对话。',
    AI_CONVERSATION_SCOPE_MISMATCH: '这段对话属于其他课节，请新建当前课节的对话。',
    AI_RESPONSE_TOO_LONG: '回答超出了长度限制，已收到的内容会保留。请把问题拆成更小的部分。',
    AI_STREAM_INTERRUPTED: '回答意外中断，已收到的内容保留在对话中。请手动重新提问。',
    AI_PROTOCOL_ERROR: 'AI 回答未能完整接收，请稍后手动重试。',
    AI_PROVIDER_ERROR: 'AI 服务暂时不可用，请稍后手动重试。',
    AI_TIMEOUT: 'AI 回答等待超时，请稍后手动重试。',
    AI_PROGRESS_UNAVAILABLE: '学习进度暂时查询失败，请稍后重试；当前没有得到有效的进度结果。',
    AI_TOOL_ARGUMENTS_INVALID: 'AI 生成的进度查询参数格式有误，请重新提问。',
    AI_TOOL_LIMIT: '本次进度查询已达到次数限制，请重新提问。',
    CSRF_INVALID: '页面验证已失效，请刷新页面后再提问。',
    CSRF_UNAVAILABLE: '无法完成页面验证，请刷新页面后再试。',
  };
  if (error.status === 401) return '登录已过期，请重新登录。';
  return messages[error.code] ?? (error.status === 429 ? '暂时无法继续提问，请稍后手动重试。' : 'AI 助教暂时无法回答，请稍后手动重试。');
}
