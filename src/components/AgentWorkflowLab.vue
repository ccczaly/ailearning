<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

defineProps<{ title: string; prompt: string }>();
const frame = ref<HTMLIFrameElement>();
const height = ref(1080);
function resize(event: MessageEvent) {
  if (event.origin !== window.location.origin || event.source !== frame.value?.contentWindow) return;
  if (event.data?.type === 'agent-workflow-height' && Number.isFinite(event.data.height)) {
    height.value = Math.max(400, Math.min(6000, Math.ceil(event.data.height)));
  }
}
onMounted(() => window.addEventListener('message', resize));
onUnmounted(() => window.removeEventListener('message', resize));
</script>

<template>
  <section class="workflow-lab" :aria-label="title">
    <small>预设教学案例 · 可播放、暂停与逐步对照</small>
    <p>{{ prompt }}</p>
    <iframe ref="frame" src="/demos/agent-workflow/index.html" :title="title" :style="{ height: height + 'px' }" loading="lazy"></iframe>
    <a href="/demos/agent-workflow/index.html" target="_blank" rel="noopener noreferrer">在独立窗口中操作 ↗</a>
  </section>
</template>

<style scoped>
.workflow-lab { margin-top:18px; }
.workflow-lab > p { color:#52677e; line-height:1.8; }
iframe { display:block; width:100%; border:1px solid #c8d6e7; border-radius:16px; background:#f8faff; }
a { display:inline-block; margin-top:12px; font-size:13px; color:#254c82; }
</style>
