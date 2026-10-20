<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { api, ApiError } from '../api';
const panel = ref<HTMLElement>();
const previousFocus = document.activeElement as HTMLElement | null;
function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;
  const controls = panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)');
  if (!controls?.length) return;
  const first = controls[0]!; const last = controls[controls.length - 1]!;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
const emit = defineEmits<{ close: [] }>();
type Memory = { enabled: boolean; preferredName: string; technicalBackground: string; learningGoal: string; responsePreference: string; version: number; lockedFields: number };
const memory = ref<Memory>();
const busy = ref(false);
const loading = ref(true);
const error = ref('');
const notice = ref('');
const fields = [
  { key: 'preferredName', label: '希望怎么称呼你', max: 80, placeholder: '例如：小陈' },
  { key: 'technicalBackground', label: '技术背景', max: 240, placeholder: '例如：Java 后端，刚开始学 Python' },
  { key: 'learningGoal', label: '学习目标', max: 240, placeholder: '例如：搭建企业知识库助手' },
  { key: 'responsePreference', label: '回答偏好', max: 240, placeholder: '例如：简洁一些，先举例再讲原理' },
] as const;
async function load() {
  loading.value = true; error.value = '';
  try { memory.value = await api<Memory>('/me/memory'); }
  catch { error.value = '记忆加载失败，请重试。'; }
  finally { loading.value = false; }
}
async function save(clear = false) {
  if (!memory.value || busy.value) return;
  busy.value = true; error.value = ''; notice.value = '';
  try {
    memory.value = await api<Memory>(clear ? `/me/memory?version=${memory.value.version}` : '/me/memory', {
      method: clear ? 'DELETE' : 'PUT',
      ...(clear ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(memory.value) }),
    });
    notice.value = clear ? '已清空。清空的字段不会被自动重新填入，可手动填写。' : '已保存。';
  } catch (failure) {
    error.value = failure instanceof ApiError && failure.status === 409
      ? '记忆已发生变化，请重新加载后再修改。'
      : '保存失败，请检查内容长度，勿填写密码或密钥。';
  } finally { busy.value = false; }
}
onMounted(() => { panel.value?.querySelector<HTMLElement>('button')?.focus(); void load(); });
onBeforeUnmount(() => previousFocus?.focus());
</script>
<template>
  <div class="memory-overlay" @click.self="!busy && emit('close')" @keydown.esc="!busy && emit('close')">
    <section ref="panel" class="memory-panel" @keydown="trapFocus" role="dialog" aria-modal="true" aria-labelledby="memory-title">
      <header><h2 id="memory-title">小包子的长期记忆</h2><button autofocus :disabled="busy" aria-label="关闭设置" @click="emit('close')">×</button></header>
      <p>只保存称呼、技术背景、学习目标和回答偏好，帮助小包子在新会话中了解你。</p>
      <p v-if="loading" role="status">正在加载…</p>
      <form v-else-if="memory" @submit.prevent="save()">
        <label class="memory-switch"><input v-model="memory.enabled" type="checkbox" :disabled="busy">启用长期记忆</label>
        <small>关闭并保存后，不读取或自动记录，已有内容仍保留。</small>
        <label v-for="field in fields" :key="field.key" class="memory-field">
          {{ field.label }}
          <textarea v-model="memory[field.key]" :maxlength="field.max" :placeholder="field.placeholder" :disabled="busy" rows="2" />
        </label>
        <small>聊天中明确表达的长期信息会自动记录。你手动修改或清空的字段不会被自动覆盖；请勿填写密码、密钥等秘密。</small>
        <footer><button type="button" :disabled="busy" @click="save(true)">清空全部记忆</button><button type="submit" :disabled="busy">{{ busy ? '正在保存…' : '保存设置' }}</button></footer>
      </form>
      <p v-if="error" role="alert">{{ error }} <button :disabled="busy || loading" @click="load">重新加载</button></p>
      <p v-if="notice" role="status">{{ notice }}</p>
    </section>
  </div>
</template>
<style scoped>
.memory-overlay { position: fixed; inset: 0; z-index: 200; background: #15234466; display: grid; place-items: center; padding: 24px; }
.memory-panel { width: min(540px, 100%); max-height: calc(100vh - 48px); overflow: auto; background: #fff; border-radius: 20px; padding: 26px; color: #30425e; box-shadow: 0 24px 80px #15234433; }
header, footer { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
h2 { font-size: 21px; margin: 0; } p, small { line-height: 1.65; } small { display: block; color: #65738b; }
.memory-switch { display: flex; align-items: center; gap: 8px; margin-top: 18px; }
.memory-field { display: grid; gap: 6px; margin: 15px 0; font-size: 14px; }
textarea { box-sizing: border-box; width: 100%; border: 1px solid #cdd7e8; border-radius: 8px; padding: 10px; font: inherit; color: inherit; resize: vertical; background: #f9fbff; }
button { border: 1px solid #cdd7e8; border-radius: 8px; padding: 8px 12px; background: #edf3ff; color: #405f9a; cursor: pointer; } button:disabled { opacity: .55; cursor: wait; } footer { margin-top: 20px; } [role=alert] { color: #ad3c3c; }
</style>
