<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { aiErrorText, listConversations, listMessages, streamAiChat } from '../ai';
import type { AiConversation, AiMessage } from '../ai';
import { auth } from '../auth';
import { createAiDrawerState, createAiHistory } from '../ai-history';
import type { AiHistoryContext } from '../ai-history';
import { renderAiMarkdown } from '../ai-markdown';
import mentorImage from '../assets/xiaobaozi.png';

const props = withDefaults(defineProps<{ sectionId?: number; sectionTitle?: string; contextReady?: boolean }>(), { contextReady: true });
type DisplayMessage = Omit<AiMessage, 'status'> & { status: AiMessage['status'] | 'GENERATING' };
const visible = ref(false);
const dialog = ref<HTMLElement>();
const input = ref<HTMLTextAreaElement>();
const scrollArea = ref<HTMLElement>();
const draft = ref('');
const messages = ref<DisplayMessage[]>([]);
const conversations = ref<AiConversation[]>([]);
const conversationId = ref<number>();
const streaming = ref(false);
const historyLoading = ref(false);
const historyFailed = ref(false);
const error = ref('');
const scopeLabel = computed(() => props.sectionTitle || '学习与 AI 入门');
const quickPrompts = computed(() => props.sectionId === undefined
  ? ['我的学习进度怎么样？上次学到哪里了？', '用简单的例子解释大语言模型', '帮我制定今天的学习计划']
  : ['请用通俗的话解释这节内容。', '请结合这节内容举一个生活中的例子。', '请根据这节内容出一道题，先不要告诉我答案。']);
let generation: AbortController | undefined;
let pendingAssistant: DisplayMessage | undefined;
const history = createAiHistory({ listConversations, listMessages });
const drawer = createAiDrawerState();
let panelContext: AiHistoryContext | undefined;
let mayAutoRestore = true;
let revision = 0;
let previousFocus: HTMLElement | undefined;
let followBottom = true;

function onScroll() {
  const area = scrollArea.value;
  if (area) followBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
}
async function scrollToBottom() {
  await nextTick();
  if (followBottom && scrollArea.value) scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
}
watch(() => messages.value.map(message => message.content).join(''), () => { void scrollToBottom(); });

function cancelHistory() { history.cancel(); historyLoading.value = false; }
function stop() {
  generation?.abort(); generation = undefined;
  if (pendingAssistant?.status === 'GENERATING') pendingAssistant.status = 'CANCELLED';
  pendingAssistant = undefined; streaming.value = false;
  cancelHistory(); revision++;
}
function close() {
  if (panelContext) drawer.rememberOpen(panelContext, false);
  panelContext = undefined;
  stop(); visible.value = false;
  if (previousFocus?.isConnected) previousFocus.focus();
}
function historyContext(): AiHistoryContext | undefined {
  return auth.user ? { userId: auth.user.id, sectionId: props.sectionId } : undefined;
}
async function refreshConversations(current: number) {
  const context = historyContext();
  if (!context) return;
  try {
    const result = await history.list(context);
    if (result && current === revision && visible.value) conversations.value = result;
  } catch (failure) {
    if (current === revision && visible.value && !error.value) error.value = `历史列表刷新失败。${aiErrorText(failure)}`;
  }
}
async function restoreHistory(current: number, selectedId?: number) {
  const context = historyContext();
  historyLoading.value = true; historyFailed.value = false; error.value = '';
  conversationId.value = undefined; messages.value = [];
  try {
    if (!context) throw new Error('Login required');
    const restored = await history.restore(context, selectedId);
    if (!restored || current !== revision || !visible.value) return false;
    conversations.value = restored.conversations;
    conversationId.value = restored.conversationId; messages.value = restored.messages;
    followBottom = true; await scrollToBottom();
    return current === revision && visible.value;
  } catch (failure) {
    if (current === revision && visible.value) {
      historyFailed.value = true;
      error.value = context ? `历史对话加载失败。${aiErrorText(failure)}` : '登录已过期，请重新登录。';
    }
    return false;
  } finally { if (current === revision) historyLoading.value = false; }
}
async function open(question?: string) {
  mayAutoRestore = false;
  if (!visible.value) previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  stop();
  visible.value = true; error.value = '';
  panelContext = props.contextReady === false ? undefined : historyContext();
  if (panelContext) drawer.rememberOpen(panelContext, true);
  const current = ++revision;
  historyLoading.value = true;
  if (question) draft.value = question;
  await nextTick(); dialog.value?.focus();
  if (current !== revision || !visible.value) return;
  if (props.contextReady === false) return;
  const restored = await restoreHistory(current);
  if (visible.value && current === revision) input.value?.focus();
  if (question && restored && visible.value && current === revision) await send();
}
defineExpose({ open });

function restoreOpenDrawer() {
  if (!mayAutoRestore || props.contextReady === false || !auth.user) return;
  mayAutoRestore = false;
  const context = historyContext();
  if (context && drawer.wasOpen(context)) void open();
}

function newConversation() {
  if (streaming.value || props.contextReady === false) return;
  cancelHistory(); revision++;
  const context = historyContext();
  if (context) history.remember(context, null);
  conversationId.value = undefined; messages.value = []; draft.value = ''; error.value = ''; historyFailed.value = false;
  followBottom = true; input.value?.focus();
}
async function chooseConversation(event: Event) {
  if (streaming.value) return;
  const id = Number((event.target as HTMLSelectElement).value);
  if (!id) { newConversation(); return; }
  const current = ++revision;
  cancelHistory();
  const context = historyContext();
  if (context) history.remember(context, id);
  await restoreHistory(current, id);
}
async function retryHistory() {
  if (streaming.value || historyLoading.value) return;
  const current = ++revision;
  await restoreHistory(current);
  if (current === revision && visible.value) input.value?.focus();
}
async function send(question = draft.value) {
  const message = question.trim();
  if (streaming.value || historyLoading.value || historyFailed.value || props.contextReady === false || !message) return;
  if (message.length > 1000) { error.value = '请输入 1–1000 字的问题。'; return; }
  const context = historyContext();
  if (!context) { error.value = '登录已过期，请重新登录。'; return; }
  // A list refresh from the preceding answer must not compete with this turn.
  history.cancel();
  const current = revision;
  const controller = new AbortController(); generation = controller;
  const assistant = reactive<DisplayMessage>({ role: 'assistant', content: '', status: 'GENERATING' });
  pendingAssistant = assistant;
  messages.value.push({ role: 'user', content: message, status: 'COMPLETED' }, assistant);
  draft.value = ''; error.value = ''; streaming.value = true; followBottom = true;
  await scrollToBottom();
  try {
    if (controller.signal.aborted || current !== revision || !visible.value) return;
    await streamAiChat({ message, sectionId: context.sectionId, conversationId: conversationId.value }, {
      meta(data) {
        if (current !== revision || controller.signal.aborted || !visible.value) return;
        conversationId.value = data.conversationId;
        history.remember(context, data.conversationId);
        if (!conversations.value.some(conversation => conversation.id === data.conversationId)) {
          conversations.value.unshift({ id: data.conversationId, title: message.slice(0, 80), sectionId: data.sectionId, updatedAt: new Date().toISOString() });
        }
      },
      delta(text) { if (current === revision && !controller.signal.aborted) assistant.content += text; },
      done(actions = []) {
        if (current === revision && !controller.signal.aborted) {
          assistant.actions = actions; assistant.status = 'COMPLETED';
          void scrollToBottom();
        }
      },
    }, controller.signal);
  } catch (failure) {
    assistant.status = controller.signal.aborted ? 'CANCELLED' : 'FAILED';
    if (!controller.signal.aborted && current === revision && visible.value) error.value = aiErrorText(failure);
  } finally {
    if (generation === controller) { generation = undefined; pendingAssistant = undefined; streaming.value = false; }
    if (current === revision && visible.value) await refreshConversations(current);
  }
}
function keydown(event: KeyboardEvent) {
  if (!visible.value) return;
  if (event.key === 'Escape') { event.preventDefault(); close(); return; }
  if (event.key !== 'Tab' || !dialog.value) return;
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')]
    .filter(element => element.getClientRects().length > 0);
  const first = focusable[0]; const last = focusable[focusable.length - 1];
  if (!first || !last) { event.preventDefault(); dialog.value.focus(); return; }
  if (!dialog.value.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); return; }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
function inputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void send(); }
}
watch(() => [props.sectionId, props.contextReady] as const, () => {
  stop(); const current = ++revision;
  conversationId.value = undefined; messages.value = []; conversations.value = []; draft.value = ''; error.value = ''; historyFailed.value = false;
  if (visible.value) {
    if (props.contextReady === false) { historyLoading.value = true; return; }
    panelContext = historyContext();
    if (panelContext) drawer.rememberOpen(panelContext, true);
    void restoreHistory(current);
  } else restoreOpenDrawer();
});
watch(() => auth.user?.id, () => {
  mayAutoRestore = false;
  close(); messages.value = []; conversations.value = []; conversationId.value = undefined; draft.value = ''; error.value = ''; historyFailed.value = false;
});
onMounted(() => { document.addEventListener('keydown', keydown); restoreOpenDrawer(); });
onBeforeUnmount(() => { stop(); document.removeEventListener('keydown', keydown); });
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="ai-backdrop" @click.self="close">
      <section ref="dialog" class="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-tutor-title" aria-describedby="ai-tutor-scope" tabindex="-1">
        <header class="ai-header">
          <img :src="mentorImage" alt="" class="ai-avatar" />
          <div><span class="ai-eyebrow">你的学习伙伴</span><h2 id="ai-tutor-title">小包子 AI 助教</h2></div>
          <button class="ai-close" type="button" aria-label="关闭 AI 助教" @click="close">×</button>
        </header>
        <div id="ai-tutor-scope" class="ai-scope"><span aria-hidden="true">✦</span><span>{{ scopeLabel }}</span></div>
        <div class="ai-toolbar">
          <label class="ai-history"><span class="ai-history-label">历史对话（{{ conversations.length }}）</span><select :value="conversationId ?? ''" :disabled="streaming || historyLoading" @change="chooseConversation"><option value="">新的对话</option><option v-for="conversation in conversations" :key="conversation.id" :value="conversation.id">{{ conversation.title }}</option></select></label>
          <button type="button" :disabled="streaming || contextReady === false" @click="newConversation">＋ 新对话</button>
        </div>
        <div ref="scrollArea" class="ai-messages" :aria-busy="streaming || historyLoading" @scroll="onScroll">
          <p v-if="historyLoading && !messages.length" class="ai-loading" role="status">正在加载对话…</p>
          <div v-else-if="!messages.length" class="ai-welcome">
            <span class="ai-welcome-icon" aria-hidden="true">✧</span><h3>一起把知识学明白</h3>
            <p>{{ sectionId === undefined ? '可以问我当前账号的学习进度，或从一个小问题开始。' : '我会结合当前课节，帮你理解概念、举例和练习。' }}</p>
            <p v-if="conversations.length" class="ai-history-hint">已保存 {{ conversations.length }} 段对话，可在上方选择并继续。</p>
            <div class="ai-prompts"><button v-for="(prompt, index) in quickPrompts" :key="prompt" type="button" :disabled="historyLoading || historyFailed" @click="send(prompt)"><span>{{ sectionId === undefined ? ['学习进度', '概念解释', '学习计划'][index] : ['解释这节', '举个例子', '考考我'][index] }}</span><span aria-hidden="true">↗</span></button></div>
          </div>
          <ol v-else class="ai-message-list" aria-label="对话消息">
            <li v-for="(message, index) in messages" :key="message.id ?? `local-${index}`" class="ai-message" :class="message.role">
              <span class="ai-message-name">{{ message.role === 'user' ? '你' : '小包子' }}</span>
              <div v-if="message.role === 'assistant' && message.content" class="ai-markdown" v-html="renderAiMarkdown(message.content)"></div>
              <p v-else-if="message.content" class="ai-user-text">{{ message.content }}</p>
              <span v-else-if="message.status === 'GENERATING'" class="ai-thinking">正在思考<span class="ai-dots" aria-hidden="true">···</span></span>
              <span v-else class="ai-empty">{{ message.status === 'CANCELLED' ? '回答已停止。' : '这次没有收到回答。' }}</span>
              <div v-if="message.role === 'assistant' && message.status === 'COMPLETED' && message.actions?.length" class="ai-message-actions">
                <a v-for="action in message.actions" :key="action.type" :href="action.url" class="ai-continue-learning" :data-action-type="action.type">{{ action.label }} <span aria-hidden="true">→</span></a>
              </div>
              <span v-if="message.role === 'assistant' && message.content && message.status === 'CANCELLED'" class="ai-message-status">已停止生成</span>
              <span v-if="message.role === 'assistant' && message.content && message.status === 'FAILED'" class="ai-message-status">回答未完成</span>
            </li>
          </ol>
        </div>
        <div v-if="error || historyFailed" class="ai-error" role="alert"><span>{{ error || '请重新加载历史对话后继续提问。' }}</span><button v-if="historyFailed" class="ai-history-retry" type="button" :disabled="historyLoading" @click="retryHistory">重新加载</button><button v-else type="button" aria-label="关闭错误提示" @click="error = ''">×</button></div>
        <form class="ai-composer" @submit.prevent="send()">
          <label class="ai-sr-only" for="ai-question">向 AI 助教提问</label>
          <textarea id="ai-question" ref="input" v-model="draft" :disabled="streaming || historyLoading" maxlength="1000" rows="3" placeholder="把你的问题告诉小包子…" @keydown="inputKeydown"></textarea>
          <div class="ai-compose-actions"><span>{{ draft.length }}/1000 <span class="ai-key-hint">· Shift + Enter 换行</span></span><button v-if="streaming" class="ai-stop" type="button" @click="stop"><span aria-hidden="true">■</span> 停止生成</button><button v-else class="ai-send" type="submit" :disabled="!draft.trim() || historyLoading || historyFailed">发送 <span aria-hidden="true">↑</span></button></div>
        </form>
        <p class="ai-footnote" role="status">{{ streaming ? '正在生成回答…' : 'AI 回答可能有误，可结合课程内容核对。' }}</p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.ai-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; justify-content: flex-end; background: #172b5247; backdrop-filter: blur(3px); }
.ai-dialog { width: min(540px, 100%); height: 100%; display: flex; flex-direction: column; background: #f8faff; box-shadow: -14px 0 60px #172b5226; color: #203558; outline: 0; }
.ai-header { display: flex; align-items: center; gap: 14px; padding: 23px 25px 18px; background: white; flex-shrink: 0; }
.ai-avatar { width: 51px; height: 51px; object-fit: contain; background: #eef4ff; border: 1px solid #e4ecfc; border-radius: 18px; }
.ai-eyebrow { font-size: 11px; letter-spacing: 1px; color: #8a9aba; }
.ai-header h2 { margin: 5px 0 0; font-size: 20px; color: #203a70; font-weight: 650; }
.ai-close { margin-left: auto; width: 34px; height: 34px; border-radius: 10px; background: #f1f5fb; color: #657797; font-size: 26px; line-height: 1; }
.ai-scope { display: flex; align-items: center; gap: 8px; padding: 12px 25px; font-size: 12px; background: #edf3ff; color: #5977b0; border-bottom: 1px solid #e5edfc; }
.ai-scope > span:last-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ai-toolbar { display: flex; align-items: center; gap: 14px; padding: 15px 25px; flex-shrink: 0; }
.ai-history { flex: 1; min-width: 0; }
.ai-history-label { display: block; color: #8192b0; font-size: 11px; margin-bottom: 6px; }
.ai-history select { width: 100%; border: 1px solid #dfe7f7; border-radius: 11px; padding: 10px 12px; background: white; font: inherit; color: #607599; text-overflow: ellipsis; }
.ai-toolbar > button { padding: 10px 12px; border-radius: 10px; background: #e9effd; color: #506fb8; font-size: 12px; white-space: nowrap; }
.ai-messages { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 25px 24px; scroll-behavior: auto; }
.ai-loading { text-align: center; color: #8493ac; padding-top: 45px; }
.ai-welcome { display: flex; flex-direction: column; align-items: center; padding: 35px 5px 12px; text-align: center; }
.ai-welcome-icon { display: grid; place-items: center; width: 66px; height: 66px; margin-bottom: 7px; color: #7592db; border-radius: 24px; background: linear-gradient(145deg, #e5efff, #f0ecff); font-size: 40px; }
.ai-welcome h3 { font-size: 21px; font-weight: 600; margin: 16px 0 8px; }
.ai-welcome > p { color: #7d8eab; font-size: 13px; line-height: 1.9; margin: 0; max-width: 310px; }
.ai-welcome > .ai-history-hint { margin-top: 12px; color: #5977b0; font-size: 12px; }
.ai-prompts { width: 100%; display: flex; flex-direction: column; gap: 10px; margin-top: 28px; }
.ai-prompts button { display: flex; justify-content: space-between; padding: 16px 18px; border: 1px solid #e0e8f9; background: white; border-radius: 13px; font-size: 13px; color: #58719c; text-align: left; }
.ai-prompts button:hover { border-color: #a8bff2; background: #f3f7ff; }
.ai-message-list { display: flex; flex-direction: column; list-style: none; gap: 18px; padding: 0; margin: 8px 0 0; }
.ai-message { max-width: 100%; padding: 17px 18px; border: 1px solid #e7edf7; border-radius: 16px; background: white; overflow-wrap: anywhere; }
.ai-message.user { align-self: flex-end; max-width: 92%; border-color: #dee8fc; background: #eaf1ff; }
.ai-message-name { display: block; color: #8192b0; font-size: 11px; margin-bottom: 8px; }
.ai-user-text { margin: 0; white-space: pre-wrap; font-size: 14px; line-height: 1.8; }
.ai-markdown { font-size: 14px; line-height: 1.9; color: #3b4d6b; }
.ai-markdown :deep(p) { margin: 0 0 12px; }
.ai-markdown :deep(> :last-child) { margin-bottom: 0; }
.ai-markdown :deep(h1), .ai-markdown :deep(h2), .ai-markdown :deep(h3), .ai-markdown :deep(h4) { margin: 18px 0 8px; font-size: 16px; line-height: 1.5; color: #25446f; }
.ai-markdown :deep(> :first-child) { margin-top: 0; }
.ai-markdown :deep(ul), .ai-markdown :deep(ol) { margin: 10px 0; padding-left: 22px; }
.ai-markdown :deep(li) { margin: 5px 0; }
.ai-markdown :deep(pre) { overflow-x: auto; border-radius: 9px; padding: 12px; background: #f0f4fa; white-space: pre; line-height: 1.7; }
.ai-markdown :deep(code) { font-family: Consolas, monospace; font-size: .88em; padding: 2px 4px; background: #f0f4fa; border-radius: 4px; }
.ai-markdown :deep(pre code) { padding: 0; }
.ai-markdown :deep(blockquote) { margin: 12px 0; border-left: 3px solid #b3c7f0; padding-left: 12px; color: #6d7f9e; }
.ai-markdown :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
.ai-markdown :deep(th), .ai-markdown :deep(td) { border: 1px solid #dfe7f5; padding: 7px 11px; min-width: 75px; text-align: left; }
.ai-markdown :deep(th) { background: #f2f6fd; }
.ai-markdown :deep(a) { color: #4674c8; text-decoration: underline; text-underline-offset: 3px; }
.ai-markdown :deep(img) { max-width: 100%; height: auto; }
.ai-thinking, .ai-empty { color: #8c9ab2; font-size: 13px; }
.ai-dots { letter-spacing: 4px; padding-left: 5px; }
.ai-message-status { display: block; color: #a0abc0; font-size: 11px; margin-top: 10px; }
.ai-error { display: flex; align-items: flex-start; gap: 8px; margin: 0 25px 12px; padding: 12px 14px; background: #fff6ee; border: 1px solid #f4ddc4; border-radius: 11px; color: #9a683d; line-height: 1.7; font-size: 12px; flex-shrink: 0; }
.ai-error button { margin-left: auto; font-size: 18px; padding: 0 4px; }
.ai-error .ai-history-retry { padding: 2px 5px; font-size: 12px; white-space: nowrap; text-decoration: underline; }
.ai-composer { display: block; margin: 0 25px; padding: 12px 14px; border: 1px solid #dbe5f7; border-radius: 15px; background: white; box-shadow: 0 3px 14px #46669e08; flex-shrink: 0; }
.ai-composer:focus-within { border-color: #a3bbed; box-shadow: 0 0 0 3px #e9f0ff; }
.ai-composer textarea { display: block; width: 100%; border: 0; outline: 0; resize: none; background: transparent; font: inherit; line-height: 1.8; color: #2b4266; }
.ai-composer textarea::placeholder { color: #a0acc1; }
.ai-compose-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 8px; }
.ai-compose-actions > span { font-size: 10px; color: #a0abc0; }
.ai-compose-actions button { padding: 8px 14px; border-radius: 10px; font-size: 12px; white-space: nowrap; }
.ai-send { background: #5c80db; color: white; }
.ai-stop { background: #edf2fc; color: #617ab0; }
.ai-footnote { flex-shrink: 0; text-align: center; font-size: 10px; color: #9aa7bd; margin: 12px 0 16px; }
.ai-dialog button:disabled, .ai-dialog select:disabled { opacity: .5; cursor: default; }
.ai-dialog textarea:disabled { opacity: .65; }
.ai-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 560px) { .ai-header { padding: 18px 18px 15px; }.ai-toolbar, .ai-scope { padding-left: 18px; padding-right: 18px; }.ai-messages { padding-left: 18px; padding-right: 18px; }.ai-composer, .ai-error { margin-left: 18px; margin-right: 18px; }.ai-key-hint { display: none; }.ai-welcome { padding-top: 18px; }.ai-welcome-icon { width: 52px; height: 52px; }.ai-prompts { margin-top: 20px; } }
.ai-message-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.ai-continue-learning { display: inline-flex; align-items: center; padding: 10px 18px; border-radius: 12px; background: #e9effd; color: #365da8; font-weight: 600; text-decoration: none; }
.ai-continue-learning:hover { background: #dce7ff; }
.ai-continue-learning:focus-visible { outline: 2px solid #587dcc; outline-offset: 3px; }
</style>
