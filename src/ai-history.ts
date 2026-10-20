import type { AiConversation, AiMessage } from './ai';

export type AiHistoryContext = { userId: number; sectionId?: number };
type Selection = number | 'new' | undefined;
type SelectionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type HistoryApi = {
  listConversations: (sectionId?: number, signal?: AbortSignal) => Promise<AiConversation[]>;
  listMessages: (id: number, signal?: AbortSignal) => Promise<AiMessage[]>;
  storage?: () => SelectionStorage;
};
export type AiHistorySnapshot = { conversations: AiConversation[]; conversationId?: number; messages: AiMessage[] };

function selectionKey(context: AiHistoryContext) {
  return `ailearning:ai-selection:v1:user:${context.userId}:scope:${context.sectionId ?? 'general'}`;
}
export function createAiDrawerState(storage: () => SelectionStorage = () => window.sessionStorage) {
  const memory = new Map<string, boolean>();
  const keyFor = (context: AiHistoryContext) => `${selectionKey(context)}:open`;
  return {
    wasOpen(context: AiHistoryContext) {
      const key = keyFor(context);
      if (memory.has(key)) return memory.get(key) === true;
      try { return storage().getItem(key) === 'true'; }
      catch { return false; }
    },
    rememberOpen(context: AiHistoryContext, open: boolean) {
      const key = keyFor(context); memory.set(key, open);
      try {
        if (open) storage().setItem(key, 'true');
        else storage().removeItem(key);
      } catch { /* The current page still works when session storage is unavailable. */ }
    },
  };
}
function unavailable(failure: unknown) {
  if (!failure || typeof failure !== 'object') return false;
  const error = failure as { status?: number; code?: string };
  return error.status === 404 || error.code === 'AI_CONVERSATION_NOT_FOUND';
}

// The browser remembers only a selection. Message bodies always come from the
// authenticated API, including when reopening an already-mounted tutor.
export function createAiHistory(api: HistoryApi) {
  const memory = new Map<string, Selection>();
  const storage = api.storage ?? (() => window.localStorage);
  let active: AbortController | undefined;

  function remember(context: AiHistoryContext, selection: number | null | undefined) {
    const key = selectionKey(context);
    const value = selection === null ? 'new' : selection;
    memory.set(key, value);
    try {
      if (value === undefined) storage().removeItem(key);
      else storage().setItem(key, String(value));
    } catch { /* Private browsing/storage restrictions must not prevent chat. */ }
  }
  function remembered(context: AiHistoryContext): Selection {
    const key = selectionKey(context);
    if (memory.has(key)) return memory.get(key);
    try {
      const value = storage().getItem(key);
      if (value === 'new') return 'new';
      if (value && /^\d+$/.test(value)) {
        const id = Number(value);
        if (Number.isSafeInteger(id) && id > 0) return id;
      }
      return undefined;
    } catch { return memory.get(key); }
  }
  function cancel() { active?.abort(); active = undefined; }
  function begin() {
    cancel();
    const controller = new AbortController(); active = controller;
    return controller;
  }
  function check(controller: AbortController) {
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
  }
  async function list(context: AiHistoryContext) {
    const controller = begin();
    try {
      const conversations = await api.listConversations(context.sectionId, controller.signal);
      check(controller);
      return conversations.filter(conversation => conversation.sectionId === (context.sectionId ?? null));
    } catch (failure) {
      if (!controller.signal.aborted) throw failure;
    } finally { if (active === controller) active = undefined; }
  }
  async function restore(context: AiHistoryContext, selectedId?: number): Promise<AiHistorySnapshot | undefined> {
    const controller = begin();
    try {
      let conversations = await api.listConversations(context.sectionId, controller.signal);
      check(controller);
      conversations = conversations.filter(conversation => conversation.sectionId === (context.sectionId ?? null));
      const selection = selectedId ?? remembered(context);
      if (selection === 'new') return { conversations, messages: [] };
      let id = conversations.find(conversation => conversation.id === selection)?.id ?? conversations[0]?.id;
      while (id !== undefined) {
        let messages: AiMessage[];
        try { messages = await api.listMessages(id, controller.signal); }
        catch (failure) {
          check(controller);
          if (!unavailable(failure)) throw failure;
          // A conversation can disappear between the list and message GETs.
          conversations = conversations.filter(conversation => conversation.id !== id);
          id = conversations[0]?.id;
          continue;
        }
        check(controller);
        remember(context, id);
        return { conversations, conversationId: id, messages };
      }
      remember(context, undefined);
      return { conversations, messages: [] };
    } catch (failure) {
      if (!controller.signal.aborted) throw failure;
    } finally { if (active === controller) active = undefined; }
  }
  return { restore, list, remember, cancel };
}
