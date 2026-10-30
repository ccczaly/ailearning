<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { getAgentReferenceDemo } from '../agent-reference-demos.ts';
import type { AgentReferenceDemoId } from '../agent-reference-demos.ts';

const props = defineProps<{ demoId: AgentReferenceDemoId; title: string; prompt: string }>();
const demo = computed(() => getAgentReferenceDemo(props.demoId));
const frame = ref<HTMLIFrameElement>();
const height = ref(860);
const loading = ref(true);
const loadError = ref(false);
const attempt = ref(0);
let mounted = false;
let disposed = false;
let loadTimer: ReturnType<typeof setTimeout> | undefined;

function clearLoadTimer() {
  if (loadTimer !== undefined) clearTimeout(loadTimer);
  loadTimer = undefined;
}
function retireFrame() {
  // Navigating away also cancels the embedded page's pending timers and animations.
  frame.value?.setAttribute('src', 'about:blank');
}
function fail() {
  if (disposed) return;
  clearLoadTimer();
  retireFrame();
  loading.value = false;
  loadError.value = true;
}
function restart() {
  clearLoadTimer();
  retireFrame();
  height.value = 860;
  loading.value = true;
  loadError.value = false;
  attempt.value++;
  if (mounted && demo.value) loadTimer = setTimeout(fail, 15_000);
}
function resize(event: MessageEvent) {
  const contentWindow = frame.value?.contentWindow;
  if (disposed || loadError.value || !contentWindow || event.origin !== window.location.origin
    || event.source !== contentWindow) return;
  const data = event.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || data.type !== 'agent-reference-height' || data.demoId !== props.demoId
    || typeof data.height !== 'number' || !Number.isFinite(data.height) || data.height <= 0) return;
  height.value = Math.max(360, Math.min(6000, Math.ceil(data.height)));
  clearLoadTimer();
  loading.value = false;
}

watch(() => props.demoId, restart);
onMounted(() => {
  mounted = true;
  window.addEventListener('message', resize);
  if (demo.value) loadTimer = setTimeout(fail, 15_000);
});
onBeforeUnmount(() => {
  disposed = true;
  mounted = false;
  clearLoadTimer();
  window.removeEventListener('message', resize);
  retireFrame();
});
</script>

<template>
  <section class="reference-lab" :aria-label="title">
    <div class="reference-heading"><strong>{{ title }}</strong><span>预设教学案例 · 无真实模型调用</span></div>
    <p class="reference-prompt">{{ prompt }}</p>
    <p v-if="demo && loading" class="loading-note" role="status">正在准备演示…</p>
    <div v-if="!demo || loadError" class="load-error" role="alert">
      <span>演示暂时没有加载成功。</span>
      <button v-if="demo" type="button" @click="restart">重试</button>
    </div>
    <iframe v-if="demo && !loadError" :key="demo.demoId + ':' + attempt" ref="frame"
      :src="demo.path" :title="title" :style="{ height: height + 'px' }"
      :aria-busy="loading" referrerpolicy="same-origin" @error="fail"></iframe>
    <a v-if="demo" :href="demo.path" target="_blank" rel="noopener noreferrer">在独立窗口中操作 ↗</a>
  </section>
</template>

<style scoped>
.reference-lab { min-width:0; margin-top:18px; color:#334969; font-size:14px; line-height:1.75; }
.reference-heading { display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; }
.reference-heading strong { color:#254c82; font-size:16px; }
.reference-heading span { color:#61728d; font-size:12px; }
.reference-prompt { color:#52677e; }
.loading-note { color:#61728d; font-size:13px; }
.load-error { display:flex; align-items:center; gap:12px; padding:18px; border:1px solid #c8d6e7; border-radius:12px; background:#f8faff; }
.load-error button { padding:6px 12px; border:1px solid #bacce6; border-radius:8px; background:white; color:#345a93; font:inherit; cursor:pointer; }
iframe { display:block; box-sizing:border-box; width:100%; border:1px solid #c8d6e7; border-radius:16px; background:#f8faff; }
a { display:inline-block; margin-top:12px; font-size:13px; color:#254c82; }
button:focus-visible, a:focus-visible { outline:2px solid #436bb5; outline-offset:3px; }
</style>
