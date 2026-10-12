<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api, ApiError } from '../api';
import { renderMarkdown } from '../markdown';

type Section = { id: number; parentId: number | null; nodeType: 'DIRECTORY' | 'LESSON'; title: string; contentMarkdown: string | null; estimatedMinutes: number | null };
type Point = { title: string; summary: string; learningObjectives: string; estimatedMinutes: number | null; moduleTitle: string; sections: Section[] };
const route = useRoute();
const point = ref<Point>();
const selectedId = ref<number>();
const loading = ref(false);
const error = ref('');
const article = ref<HTMLElement>();
let requestId = 0;
const selected = computed(() => point.value?.sections.find(s => s.id === selectedId.value));
const lessons = computed(() => point.value?.sections.filter(s => s.nodeType === 'LESSON') ?? []);
const position = computed(() => lessons.value.findIndex(s => s.id === selectedId.value));
const lessonHtml = computed(() => renderMarkdown(selected.value?.contentMarkdown ?? ''));
const selectedChapter = computed(() => point.value?.sections.find(s => s.id === selected.value?.parentId)?.title);
const outline = computed(() => {
  const depths = new Map<number, number>();
  return (point.value?.sections ?? []).map(s => {
    const depth = s.parentId === null ? 0 : (depths.get(s.parentId) ?? 0) + 1;
    depths.set(s.id, depth);
    return { ...s, depth };
  });
});
function select(id: number) { selectedId.value = id; if (article.value) article.value.scrollTop = 0; }
async function load() {
  const current = ++requestId;
  loading.value = true; error.value = ''; point.value = undefined;
  try {
    const data = await api<Point>(`/knowledge/${encodeURIComponent(String(route.params.slug))}`);
    if (current !== requestId) return;
    point.value = data;
    selectedId.value = data.sections.find(s => s.nodeType === 'LESSON')?.id;
  } catch (e) {
    if (current !== requestId) return;
    error.value = e instanceof ApiError && e.status === 404 ? '这个知识点暂未发布。' : '内容加载失败，请检查网络后重试。';
  } finally { if (current === requestId) loading.value = false; }
}
watch(() => route.params.slug, load, { immediate: true });
</script>

<template>
  <div class="knowledge-page">
    <header class="reading-header">
      <RouterLink to="/" class="reading-brand">✦ LearnAI</RouterLink>
      <span>{{ point ? `${point.moduleTitle} / ${point.title}` : '知识阅读' }}</span>
      <RouterLink to="/">← 返回知识星球</RouterLink>
    </header>
    <div v-if="loading" class="reading-state" role="status">正在加载知识内容…</div>
    <div v-else-if="error" class="reading-state" role="alert">
      <p>{{ error }}</p><button class="reading-action" @click="load">重新加载</button>
    </div>
    <div v-else-if="point" class="reading-layout">
      <aside class="reading-sidebar">
        <span class="reading-label">{{ point.moduleTitle }}</span>
        <h1>{{ point.title }}</h1>
        <p class="reading-meta">{{ lessons.length }} 节内容 · 约 {{ point.estimatedMinutes }} 分钟</p>
        <nav class="reading-outline" aria-label="知识目录">
          <template v-for="item in outline" :key="item.id">
            <div v-if="item.nodeType === 'DIRECTORY'" class="directory" :style="{ paddingLeft: `${12 + item.depth * 16}px` }">{{ item.title }}</div>
            <button v-else :class="{ selected: selectedId === item.id }" :aria-current="selectedId === item.id ? 'page' : undefined" :style="{ paddingLeft: `${12 + item.depth * 16}px` }" @click="select(item.id)">{{ item.title }}</button>
          </template>
        </nav>
        <p class="reading-hint">沿时间线阅读，理解每次技术转折。</p>
      </aside>
      <main ref="article" class="reading-main">
        <div class="reading-content">
          <section class="learning-intro">
            <span class="reading-label">课程导读</span>
            <p>{{ point.summary }}</p>
            <p class="objectives"><strong>学习目标</strong><br>{{ point.learningObjectives }}</p>
          </section>
          <article v-if="selected">
            <div class="reading-meta">{{ selectedChapter }} · 第 {{ position + 1 }} / {{ lessons.length }} 节 · 约 {{ selected.estimatedMinutes }} 分钟</div>
            <h2>{{ selected.title }}</h2>
            <div class="lesson-body" v-html="lessonHtml"></div>
            <footer class="lesson-navigation">
              <button class="reading-action" :disabled="position <= 0" @click="select(lessons[position - 1]!.id)">← 上一节</button>
              <span>{{ position + 1 }} / {{ lessons.length }}</span>
              <button class="reading-action" :disabled="position >= lessons.length - 1" @click="select(lessons[position + 1]!.id)">下一节 →</button>
            </footer>
          </article>
          <p v-else class="reading-state">知识内容正在准备中。</p>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.knowledge-page { height: 100%; display: flex; flex-direction: column; background: #f6f8fd; }
.reading-header { display: flex; align-items: center; gap: 36px; padding: 20px 36px; background: white; border-bottom: 1px solid #e5eaf5; }
.reading-header > span { flex: 1; color: #7a849e; }
.reading-brand { font-size: 23px; font-weight: 750; color: #5977d5; }
.reading-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: 320px minmax(0, 1fr); }
.reading-sidebar { overflow: auto; padding: 32px 20px; background: #ffffffa6; border-right: 1px solid #e5eaf5; }
.reading-label { color: #647fcd; font-size: 12px; letter-spacing: 1px; }
h1 { font-size: 26px; margin: 12px 0; }
.reading-meta, .reading-hint { color: #7a849e; font-size: 13px; }
.reading-outline { display: flex; flex-direction: column; align-items: stretch; height: auto; gap: 5px; margin-top: 28px; }
.reading-outline .directory { font-weight: 650; color: #7a849e; padding-top: 18px; padding-bottom: 8px; font-size: 13px; }
.reading-outline button { text-align: left; line-height: 1.6; padding: 12px; border-radius: 10px; }
.reading-outline button:hover { background: #f0f3fc; }
.reading-outline button.selected { color: #4c69bf; background: #eaf0ff; font-weight: 650; }
.reading-hint { margin-top: 40px; padding-left: 12px; }
.reading-main { display: block; overflow-y: auto; min-height: 0; padding: 28px 40px; }
.reading-content { width: 100%; max-width: 880px; margin: 0 auto; display: flex; flex-direction: column; }
.learning-intro { flex-shrink: 0; margin-bottom: 32px; line-height: 1.9; }
.objectives { padding: 18px 22px; border: 1px solid #e0e7f9; background: #edf2fe; border-radius: 14px; color: #536589; }
article { display: flex; flex-direction: column; padding: 28px 36px; border: 1px solid #e5eaf5; border-radius: 20px; background: white; box-shadow: 0 8px 30px #254b9910; }
article > .reading-meta, article > h2, article > .lesson-navigation { flex-shrink: 0; }
h2 { font-size: 28px; margin: 18px 0 30px; }
.lesson-body { font-size: 16px; line-height: 1.9; color: #3f4e6b; overflow-wrap: anywhere; }
.lesson-body :deep(p) { margin: 0 0 18px; }
.lesson-body :deep(h2), .lesson-body :deep(h3) { margin: 28px 0 12px; color: #263c68; font-size: 20px; }
.lesson-body :deep(h4) { font-size: 17px; margin: 24px 0 10px; }
.lesson-body :deep(ul), .lesson-body :deep(ol) { padding-left: 24px; margin: 12px 0 20px; }
.lesson-body :deep(li) { margin: 6px 0; }
.lesson-body :deep(blockquote) { margin: 20px 0; padding: 14px 20px; border-left: 4px solid #8fa7ed; background: #f2f5fd; border-radius: 0 10px 10px 0; }
.lesson-body :deep(blockquote p:last-child) { margin-bottom: 0; }
.lesson-body :deep(pre) { overflow-x: auto; padding: 18px; background: #f1f4fa; border: 1px solid #e0e7f3; border-radius: 10px; line-height: 1.7; white-space: pre; }
.lesson-body :deep(code) { font-family: Consolas, monospace; font-size: .88em; background: #f1f4fa; padding: 2px 5px; border-radius: 4px; }
.lesson-body :deep(pre code) { padding: 0; background: none; }
.lesson-body :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
.lesson-body :deep(th), .lesson-body :deep(td) { border: 1px solid #dfe6f3; padding: 10px 14px; min-width: 110px; text-align: left; }
.lesson-body :deep(th) { background: #f1f5fd; }
.lesson-body :deep(a) { color: #4165be; text-decoration: underline; text-underline-offset: 3px; }
.lesson-body :deep(img) { max-width: 100%; height: auto; }
.lesson-navigation { display: flex; align-items: center; justify-content: space-between; margin-top: 36px; border-top: 1px solid #edf0f7; padding-top: 24px; color: #7a849e; }
.reading-action { padding: 10px 16px; background: #edf2ff; border-radius: 8px; color: #506bbe; }
.reading-action:disabled { opacity: .4; cursor: default; }
.reading-state { padding: 70px 30px; text-align: center; }
@media (max-width: 800px) {
  .reading-layout { grid-template-columns: 230px minmax(0, 1fr); }
  .reading-header { gap: 16px; padding: 16px; }
  .reading-header > span { display: none; }
  .reading-main { padding: 20px 16px; }
  article { padding: 22px 20px; }
  h2 { font-size: 23px; }
}
@media (max-width: 560px) {
  .reading-layout { display: flex; flex-direction: column; overflow-y: auto; }
  .reading-sidebar { flex-shrink: 0; max-height: 260px; border-right: 0; border-bottom: 1px solid #e5eaf5; padding: 20px; }
  .reading-main { overflow: visible; flex-shrink: 0; }
  .reading-hint { display: none; }
  .lesson-navigation { gap: 8px; }
  .reading-action { padding: 10px; }
}
</style>
