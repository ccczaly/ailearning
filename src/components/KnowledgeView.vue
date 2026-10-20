<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError } from '../api';
import { auth } from '../auth';
import { rememberReadingSection, restoreReadingSection } from '../reading-position';
import { renderLessonMarkdown } from '../markdown';
import ReadingIcon from './ReadingIcon.vue';
import HistoricalLesson from './HistoricalLesson.vue';
import AiTutor from './AiTutor.vue';
import LessonQuiz from './LessonQuiz.vue';
import { courseCatalog } from '../data/course-catalog';

type Section = { id: number; parentId: number | null; nodeType: 'DIRECTORY' | 'LESSON'; title: string; contentMarkdown: string | null; estimatedMinutes: number | null; hasQuiz?: boolean };
type Point = { title: string; summary: string; learningObjectives: string; estimatedMinutes: number | null; moduleTitle: string; sections: Section[] };
type Progress = { total: number; completed: number; lastSectionId: number | null; sections: { sectionId: number; status: string }[] };
const progress = ref<Progress>();
const progressError = ref('');
const showQuiz = ref(false);
const hasQuiz = computed(() => Boolean(selected.value?.hasQuiz));
async function refreshProgress() {
  const current = requestId;
  try {
    const value = await api<Progress>(`/learning/progress/${encodeURIComponent(String(route.params.slug))}`);
    if (current === requestId) { progress.value = value; progressError.value = ''; }
  } catch { if (current === requestId) progressError.value = '学习进度读取失败，请重试。'; }
}
const completedIds = computed(() => new Set(progress.value?.sections.filter(s => s.status === 'COMPLETED').map(s => s.sectionId)));
const startedIds = computed(() => new Set(progress.value?.sections.map(s => s.sectionId)));
const percent = computed(() => progress.value?.total ? Math.round(progress.value.completed / progress.value.total * 100) : 0);
// Serialize writes so rapid navigation cannot reorder the latest visited lesson.
let progressWrites = Promise.resolve();
function saveProgress(id: number): Promise<boolean> {
  const slug = String(route.params.slug);
  const current = requestId;
  let succeeded = false;
  const task = progressWrites.then(async () => {
    try {
      const result = await api<Progress>(`/learning/progress/${encodeURIComponent(slug)}/sections/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      succeeded = true;
      if (current === requestId) { progress.value = result; progressError.value = ''; }
    } catch { if (current === requestId) progressError.value = '学习进度保存失败，请重试。'; }
  });
  progressWrites = task;
  return task.then(() => succeeded);
}
const route = useRoute();
const router = useRouter();
const point = ref<Point>();
const selectedId = ref<number>();
const loading = ref(false);
const error = ref('');
const article = ref<HTMLElement>();
const tutor = ref<InstanceType<typeof AiTutor>>();
let requestId = 0;
const selected = computed(() => point.value?.sections.find(s => s.id === selectedId.value));
const lessons = computed(() => point.value?.sections.filter(s => s.nodeType === 'LESSON') ?? []);
const position = computed(() => lessons.value.findIndex(s => s.id === selectedId.value));
const lessonHtml = computed(() => renderLessonMarkdown(selected.value?.contentMarkdown ?? ''));
const takeaways = computed(() => [...(selected.value?.contentMarkdown ?? '').matchAll(/^## (.+)$/gm)]
  .map(match => match[1]!)
  .filter(title => !/历史背景|小实验|小练习|自测|参考|下一站/.test(title)).slice(0, 3));
const selectedChapter = computed(() => point.value?.sections.find(s => s.id === selected.value?.parentId)?.title);
const courseInfo = computed(() => courseCatalog[String(route.params.slug)]);
const historicalChapter = computed(() => {
  if (courseInfo.value) {
    const chapterIndex = point.value?.sections.filter(s => s.nodeType === 'DIRECTORY').findIndex(s => s.id === selected.value?.parentId) ?? -1;
    return courseInfo.value.stages[chapterIndex];
  }
  if (route.params.slug !== 'llm-basics') return undefined;
  if (selectedChapter.value?.startsWith('1950')) return { year: '1950', label: '思想的起点', topic: '历史序章' };
  if (selectedChapter.value?.startsWith('1966')) return { year: '1966', label: '规则的对话', topic: '规则对话' };
  if (selectedChapter.value?.startsWith('统计阶段')) return { year: '统计', label: '从计数出发', topic: '统计语言模型' };
  if (selectedChapter.value?.startsWith('2003')) return { year: '2003', label: '可学习的表示', topic: '神经语言模型' };
  if (selectedChapter.value?.startsWith('2013')) return { year: '2013', label: '词语的关系', topic: '词向量' };
  if (selectedChapter.value?.startsWith('2014')) return { year: '2014–15', label: '序列与注意力', topic: '序列模型' };
  if (selectedChapter.value?.startsWith('2017')) return { year: '2017', label: '注意力的转折', topic: 'Transformer' };
  if (selectedChapter.value?.startsWith('2018')) return { year: '2018', label: '先学再适配', topic: '预训练' };
  if (selectedChapter.value?.startsWith('2020')) return { year: '2020', label: '从提示中学习', topic: '上下文学习' };
  if (selectedChapter.value?.startsWith('2021')) return { year: '2021–22', label: '从续写到助手', topic: '指令与对齐' };
  if (selectedChapter.value?.startsWith('2022')) return { year: '2022', label: '步骤与对话', topic: '推理与交互' };
  if (selectedChapter.value?.startsWith('2023')) return { year: '2023+', label: '模型的适配', topic: '开放权重' };
  if (selectedChapter.value?.startsWith('2024')) return { year: '2024–25', label: '计算的分配', topic: '推理模型' };
  return { year: '实践', label: '能力与证据', topic: '课程收尾' };
});
const isHistoricalChapter = computed(() => Boolean(historicalChapter.value));
const historicalTitle = computed(() => selected.value?.title.replace(/^\d{4}[：:]\s*/, ''));
const canContinue = computed(() => position.value >= 0 && position.value < lessons.value.length - 1);
const outline = computed(() => {
  const depths = new Map<number, number>();
  return (point.value?.sections ?? []).map(s => {
    const depth = s.parentId === null ? 0 : (depths.get(s.parentId) ?? 0) + 1;
    depths.set(s.id, depth);
    return { ...s, depth };
  });
});
function restoreSelection() {
  selectedId.value = restoreReadingSection(auth.user?.id, String(route.params.slug), lessons.value, route.query.section ?? (progress.value?.lastSectionId ? String(progress.value.lastSectionId) : undefined));
  if (selectedId.value !== undefined) {
    rememberReadingSection(auth.user?.id, String(route.params.slug), selectedId.value);
    void saveProgress(selectedId.value);
  }
  if (article.value) article.value.scrollTop = 0;
}
function select(id: number) {
  if (!lessons.value.some(lesson => lesson.id === id)) return;
  if (selectedId.value === id) return;
  selectedId.value = id;
  void saveProgress(id);
  rememberReadingSection(auth.user?.id, String(route.params.slug), id);
  if (article.value) article.value.scrollTop = 0;
  void router.replace({ query: { ...route.query, section: String(id) } });
}
async function load() {
  const current = ++requestId;
  loading.value = true; error.value = ''; point.value = undefined; progress.value = undefined; progressError.value = '';
  try {
    const data = await api<Point>(`/knowledge/${encodeURIComponent(String(route.params.slug))}`);
    if (current !== requestId) return;
    try {
      const saved = await api<Progress>(`/learning/progress/${encodeURIComponent(String(route.params.slug))}`);
      if (current !== requestId) return;
      progress.value = saved;
    } catch { if (current === requestId) progressError.value = '学习进度读取失败，可继续阅读并重试。'; }
    if (current !== requestId) return;
    point.value = data;
    restoreSelection();
  } catch (e) {
    if (current !== requestId) return;
    error.value = e instanceof ApiError && e.status === 404 ? '这个知识点暂未发布。' : '内容加载失败，请检查网络后重试。';
  } finally { if (current === requestId) loading.value = false; }
}
watch(selectedId, () => { showQuiz.value = false; });
watch(() => route.params.slug, load, { immediate: true });
watch(() => route.query.section, () => { if (point.value && !loading.value) restoreSelection(); });
</script>

<template>
  <div class="knowledge-page">
    <header class="reading-header">
      <RouterLink to="/" class="reading-brand">✦ LearnAI</RouterLink>
      <div class="reading-breadcrumb"><RouterLink to="/">知识库</RouterLink><span>›</span><span>{{ point?.moduleTitle ?? '知识阅读' }}</span><template v-if="selectedChapter"><span>›</span><span class="breadcrumb-chapter">{{ selectedChapter }}</span></template></div>
      <button class="reading-tutor" :disabled="!selected || loading" @click="tutor?.open()">✧ 问问小包子</button>
      <RouterLink to="/" class="reading-return">← 返回知识地图</RouterLink>
    </header>
    <div v-if="loading" class="reading-state" role="status">正在加载知识内容…</div>
    <div v-else-if="error" class="reading-state" role="alert">
      <p>{{ error }}</p><button class="reading-action" @click="load">重新加载</button>
    </div>
    <div v-else-if="point" class="reading-layout">
      <aside class="reading-sidebar">
        <div class="course-overview">
          <span class="course-icon"><ReadingIcon name="book" /></span>
          <div><h1>{{ point.moduleTitle }}</h1>
          <p class="reading-subtitle">{{ point.title }}</p>
          <p class="reading-meta">{{ lessons.length }} 节内容 · 约 {{ point.estimatedMinutes }} 分钟</p></div>
        </div>
        <div v-if="progress" class="course-progress"><span>已完成 {{ progress.completed }} / {{ progress.total }} 节 · {{ percent }}%</span><progress :value="progress.completed" :max="progress.total || 1" aria-label="课程完成进度"></progress></div>
        <div v-if="progressError" class="progress-error" role="alert">{{ progressError }} <button @click="load">重试</button></div>
        <nav class="reading-outline" aria-label="知识目录">
          <template v-for="item in outline" :key="item.id">
            <div v-if="item.nodeType === 'DIRECTORY'" class="directory" :class="{ 'current-chapter': item.id === selected?.parentId }" :style="{ marginLeft: `${item.depth * 16}px` }"><span class="timeline-node"></span>{{ item.title }}</div>
            <button v-else :class="{ selected: selectedId === item.id }" :aria-current="selectedId === item.id ? 'page' : undefined" :style="{ marginLeft: `${12 + item.depth * 16}px` }" @click="select(item.id)"><span class="lesson-node"></span>{{ item.title }}<span class="lesson-status">{{ completedIds.has(item.id) ? (item.hasQuiz ? '✓ 已通过' : '✓ 已读') : startedIds.has(item.id) ? '学习中' : '' }}</span></button>
          </template>
        </nav>
        <p class="reading-hint">{{ courseInfo?.hint ?? '沿时间线阅读，理解每次技术转折。' }}</p>
        <a v-if="courseInfo" class="course-download" :href="courseInfo.download" download>↓ 下载配套 Python 示例 <span>含运行说明 · 本地运行</span></a>
      </aside>
      <main ref="article" class="reading-main">
        <div class="reading-content">
          <article v-if="selected" :class="{ 'historical-story': isHistoricalChapter }">
            <header v-if="isHistoricalChapter" class="history-heading">
              <div class="history-year" :class="{ 'long-period': (historicalChapter?.year.length ?? 0) > 4, 'text-period': /统计|实践/.test(historicalChapter?.year ?? '') }" aria-hidden="true">{{ historicalChapter?.year }}<span>{{ historicalChapter?.label }}</span></div>
              <div class="history-title"><div class="reading-meta">{{ historicalChapter?.topic }} · 第 {{ position + 1 }} / {{ lessons.length }} 节 · 约 {{ selected.estimatedMinutes }} 分钟</div><h2>{{ historicalTitle }}</h2></div>
            </header>
            <template v-else><div class="reading-meta">{{ selectedChapter }} · 第 {{ position + 1 }} / {{ lessons.length }} 节 · 约 {{ selected.estimatedMinutes }} 分钟</div><h2>{{ selected.title }}</h2></template>
            <HistoricalLesson v-if="isHistoricalChapter" :key="selected.id" :source="selected.contentMarkdown ?? ''" />
            <div v-else :key="selected.id" class="lesson-body">
              <div class="lesson-prose" v-html="lessonHtml"></div>
            </div>
            <details v-if="hasQuiz" :key="selected.id" class="lesson-check" @toggle="showQuiz = ($event.target as HTMLDetailsElement).open"><summary><span>课后测验</span><small>{{ completedIds.has(selected.id) ? '✓ 已通过 · 再练一次' : '读完后，检验一下理解 →' }}</small></summary><LessonQuiz v-if="showQuiz" :slug="String(route.params.slug)" :section-id="selected.id" @passed="refreshProgress" /></details>
            <footer class="lesson-navigation" :class="{ 'story-navigation': isHistoricalChapter }">
              <div v-if="isHistoricalChapter && canContinue" class="story-next"><span>下一节</span><strong>{{ lessons[position + 1]?.title }}</strong></div>
              <div v-if="takeaways.length && !isHistoricalChapter" class="lesson-recap"><ReadingIcon name="check"/><div><strong>本节要点回顾</strong><ul><li v-for="title in takeaways" :key="title">{{ title }}</li></ul></div></div>
              <div class="lesson-actions"><button v-if="position > 0" class="reading-action previous" @click="select(lessons[position - 1]!.id)">← 上一节</button>
              <button class="reading-action continue" :disabled="!canContinue" @click="select(lessons[position + 1]!.id)">{{ !canContinue ? (position >= lessons.length - 1 ? '已到最后一节' : '下一段历史，尚未展开') : isHistoricalChapter ? '继续阅读 →' : '继续学习 →' }}</button></div>
            </footer>
          </article>
          <p v-else class="reading-state">知识内容正在准备中。</p>
        </div>
      </main>
    </div>
    <AiTutor ref="tutor" :section-id="selected?.id" :section-title="selected?.title" :context-ready="Boolean(selected) && !loading" />
  </div>
</template>

<style scoped>
.course-download { display: grid; gap: 4px; margin: 18px 0; padding: 12px; border: 1px solid #dfe7f3; border-radius: 10px; color: #4568a4; font-size: 13px; text-decoration: none; }
.course-download:hover { background: #f1f5fc; }
.course-download span { color: #8191aa; font-size: 11px; }
.lesson-check { margin-top: 26px; border-top: 1px solid #e6edf5; padding-top: 18px; }
.lesson-check > summary { display: flex; justify-content: space-between; align-items: center; gap: 15px; cursor: pointer; font-size: 13px; color: #586e94; }
.lesson-check > summary small { color: #92a1b8; font-size: 11px; }

.course-progress { display: grid; gap: 8px; margin-top: 16px; font-size: 12px; color: #5675a2; }
.course-progress progress { width: 100%; height: 8px; accent-color: #386cff; }
.lesson-status { margin-left: auto; flex-shrink: 0; color: #399684; font-size: 11px; }
.progress-error { margin-top: 12px; color: #b04f4f; font-size: 12px; }
.progress-error button { text-decoration: underline; }
.lesson-actions { flex-wrap: wrap; }
.knowledge-page { height: 100%; display: flex; flex-direction: column; background: radial-gradient(at top left, #eef5ff, transparent 60%), #f7faff; color: #102557; }
.reading-header { display: flex; align-items: center; gap: 36px; padding: 20px 36px; background: white; border-bottom: 1px solid #e5eaf5; }
.reading-breadcrumb { display: flex; align-items: center; gap: 16px; flex: 1; min-width: 0; color: #7786a6; font-size: 13px; }
.breadcrumb-chapter { color: #304776; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reading-return { flex-shrink: 0; padding: 9px 14px; border: 1px solid #dce7ff; border-radius: 12px; background: #edf3ff; color: #35569a; font-size: 13px; }
.reading-brand { font-size: 23px; font-weight: 750; color: #5977d5; }
.reading-tutor { flex-shrink: 0; padding: 9px 14px; border: 1px solid #dce7ff; border-radius: 12px; background: #edf3ff; color: #35569a; font-size: 13px; }
.reading-tutor:disabled { opacity: .45; cursor: default; }
.reading-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: 345px minmax(0, 1fr); gap: 20px; padding: 12px 24px 20px; }
.reading-sidebar { overflow: auto; padding: 26px 22px; background: #ffffffa6; border: 1px solid #f0f4fc; border-radius: 24px; }
.course-overview { display: flex; align-items: center; gap: 14px; padding-bottom: 22px; border-bottom: 1px solid #edf1f9; }
.course-icon { display: grid; place-items: center; flex-shrink: 0; width: 52px; height: 56px; border-radius: 22px; color: #386cff; background: #eaf0ff; }
.course-icon svg { width: 28px; height: 28px; }
h1 { font-size: 19px; margin: 0 0 3px; }
.reading-subtitle { margin: 0 0 6px; color: #647494; font-size: 13px; line-height: 1.6; }
.course-overview .reading-meta { margin: 0; font-size: 12px; }
.reading-meta, .reading-hint { color: #7a849e; font-size: 13px; }
.reading-outline { position: relative; display: flex; flex-direction: column; align-items: stretch; height: auto; gap: 5px; margin-top: 22px; }
.reading-outline::before { content: ''; position: absolute; left: 8px; top: 15px; bottom: 20px; width: 0; border-left: 2px dashed #dce5f5; }
.reading-outline .directory { position: relative; font-weight: 650; color: #152d60; padding: 22px 0 10px 42px; font-size: 14px; line-height: 1.7; }
.reading-outline .directory:first-child { padding-top: 0; }
.timeline-node { position: absolute; left: 0; top: 26px; width: 18px; height: 18px; border: 3px solid #a5b2cb; border-radius: 50%; background: #f9fbff; }
.directory:first-child .timeline-node { top: 3px; }
.current-chapter .timeline-node { border: 4px solid #386cff; }
.reading-outline button { display: flex; align-items: flex-start; gap: 12px; height: auto; text-align: left; line-height: 1.6; padding: 8px 10px; border-radius: 11px; font-size: 13px; color: #5a6d96; }
.lesson-node { flex-shrink: 0; width: 15px; height: 15px; margin-top: 3px; border: 2px solid #9aaac6; border-radius: 5px; position: relative; }
.lesson-node::after { content: ''; position: absolute; inset: 3px; background: currentColor; border-radius: 2px; }
.selected .lesson-node { border-color: #386cff; }
.reading-outline button:hover { background: #f0f3fc; }
.reading-outline button.selected { color: #3064ff; background: #e8efff; box-shadow: inset 0 0 0 1px #d9e5ff; font-weight: 650; }
.reading-hint { margin-top: 40px; padding-left: 12px; }
.reading-main { display: block; overflow-y: auto; min-height: 0; padding: 28px 46px; border-radius: 26px; background: #ffffffeb; border: 1px solid #f0f4fc; }
.reading-content { width: 100%; max-width: 1120px; margin: 0 auto; display: flex; flex-direction: column; }
article { display: flex; flex-direction: column; }
article > .reading-meta, article > h2, article > .lesson-navigation { flex-shrink: 0; }
h2 { font-size: 34px; margin: 14px 0 18px; letter-spacing: -.6px; }
.lesson-body { font-size: 16px; line-height: 1.9; color: #3f4e6b; overflow-wrap: anywhere; }
.lesson-prose :deep(p) { margin: 0 0 18px; }
.lesson-prose :deep(h2), .lesson-prose :deep(h3) { margin: 24px 0 12px; color: #102557; font-size: 22px; letter-spacing: 0; }
.lesson-prose:first-child :deep(> h2:first-child) { margin-top: 0; }
.lesson-prose :deep(p > strong) { color: #3064ff; background: #eaf1ff; border-radius: 18px; padding: 2px 9px; font-size: .94em; box-decoration-break: clone; }
.lesson-prose :deep(.lesson-callout) { position: relative; padding: 18px 24px 6px 68px; margin: 22px 0; border: 1px solid #dceaff; border-radius: 15px; background: #f0f7ff; }
.lesson-prose :deep(.lesson-callout::before) { content: ''; position: absolute; top: 22px; left: 21px; width: 30px; height: 30px; border-radius: 50%; background: #ffd36a url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M9 18h6M10 21h4M8 13a7 7 0 1 1 8 0l-1 3H9l-1-3Z'/%3E%3C/svg%3E") center / 24px no-repeat; box-shadow: 0 0 0 6px #fff5d7; }
.lesson-prose :deep(.lesson-callout-review) { background: #effaf8; border-color: #dff2ed; }
.lesson-prose :deep(.lesson-callout-review::before) { background: #88d5c7 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 12 4 4 8-8'/%3E%3C/svg%3E") center / 24px no-repeat; box-shadow: none; }
.lesson-prose :deep(.lesson-callout h2) { margin-top: 0; font-size: 19px; }
.lesson-prose :deep(h4) { font-size: 17px; margin: 24px 0 10px; }
.lesson-prose :deep(ul), .lesson-prose :deep(ol) { padding-left: 24px; margin: 12px 0 20px; }
.lesson-prose :deep(li) { margin: 6px 0; }
.lesson-prose :deep(blockquote) { margin: 20px 0; padding: 14px 20px; border-left: 4px solid #8fa7ed; background: #f2f5fd; border-radius: 0 10px 10px 0; }
.lesson-prose :deep(blockquote p:last-child) { margin-bottom: 0; }
.lesson-prose :deep(pre) { overflow-x: auto; padding: 18px; background: #f1f4fa; border: 1px solid #e0e7f3; border-radius: 10px; line-height: 1.7; white-space: pre; }
.lesson-prose :deep(code) { font-family: Consolas, monospace; font-size: .88em; background: #f1f4fa; padding: 2px 5px; border-radius: 4px; }
.lesson-prose :deep(pre code) { padding: 0; background: none; }
.lesson-prose :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
.lesson-prose :deep(th), .lesson-prose :deep(td) { border: 1px solid #dfe6f3; padding: 7px 16px; min-width: 110px; text-align: left; }
.lesson-prose :deep(table) { width: 100%; display: table; border-radius: 12px; overflow: hidden; }
.lesson-prose :deep(th) { background: #f1f5fd; }
.lesson-prose :deep(a) { color: #4165be; text-decoration: underline; text-underline-offset: 3px; }
.lesson-prose :deep(img) { max-width: 100%; height: auto; }
.lesson-navigation { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 24px; padding: 18px 22px; background: #effaf8; border: 1px solid #e1f2ef; border-radius: 16px; }
.historical-story { width: 100%; max-width: 920px; align-self: center; padding: 6px 0; container-type: inline-size; container-name: historical-article; }
.history-heading { display: flex; align-items: center; gap: 30px; padding-bottom: 25px; border-bottom: 1px solid #e5ebf5; }
.history-year { display: flex; flex-direction: column; flex-shrink: 0; padding-right: 30px; border-right: 1px solid #e3eaf7; font-family: Georgia, serif; font-size: 70px; line-height: 1; letter-spacing: -4px; color: #6682c1; }
.history-year span { margin-top: 11px; font-family: Inter, "Microsoft YaHei", sans-serif; font-size: 11px; line-height: 1.4; letter-spacing: 3px; color: #8394b4; text-align: center; }
.history-year.long-period { font-size: 42px; letter-spacing: -2px; }
.history-year.text-period { font-family: Inter, "Microsoft YaHei", sans-serif; font-size: 46px; letter-spacing: 2px; }
.history-title h2 { margin: 12px 0 0; font-size: 30px; font-weight: 650; letter-spacing: -.5px; line-height: 1.4; }
.history-title .reading-meta { font-size: 12px; color: #8291ad; }
.story-navigation { justify-content: space-between; flex-wrap: wrap; padding: 22px 0 0; margin-top: 28px; border: 0; border-top: 1px solid #e6eaf1; border-radius: 0; background: transparent; }
.story-next { display: flex; flex-direction: column; flex: 1 1 200px; gap: 7px; min-width: 0; }
.story-next span { color: #8b99b1; font-size: 11px; }
.story-next strong { font-size: 13px; font-weight: 500; color: #5e7297; }
.lesson-recap { display: flex; align-items: flex-start; gap: 12px; font-size: 13px; }
.lesson-recap svg { width: 26px; height: 26px; flex-shrink: 0; color: #71c5b9; }
.lesson-recap ul { list-style: none; padding: 0; margin: 6px 0 0; color: #50658b; line-height: 1.8; }
.lesson-recap li::before { content: '✓'; margin-right: 8px; }
.lesson-actions { display: flex; gap: 12px; flex-shrink: 0; }
.continue { background: #386cff !important; color: white !important; padding: 12px 22px !important; border-radius: 12px !important; }
.reading-action { padding: 10px 16px; background: #edf2ff; border-radius: 8px; color: #506bbe; }
.reading-action:disabled { opacity: .4; cursor: default; }
.reading-state { padding: 70px 30px; text-align: center; }
@media (max-width: 800px) {
  .reading-layout { grid-template-columns: 230px minmax(0, 1fr); padding: 10px; gap: 10px; }
  .reading-header { gap: 16px; padding: 16px; }
  .breadcrumb-chapter { display: none; }
  .reading-main { padding: 20px 16px; }
  article { padding: 22px 20px; }
  h2 { font-size: 23px; }
  .history-heading { gap: 18px; }
  .history-year { font-size: 46px; padding-right: 18px; letter-spacing: -2px; }
  .history-year span { font-size: 9px; letter-spacing: 1px; }
  .history-title h2 { font-size: 23px; }
  .lesson-navigation { flex-direction: column; align-items: stretch; }
  .lesson-actions { justify-content: flex-end; }
  .lesson-prose :deep(table) { display: block; }
}
@media (max-width: 560px) {
  .reading-layout { display: flex; flex-direction: column; overflow-y: auto; }
  .reading-sidebar { flex-shrink: 0; max-height: 260px; border-right: 0; border-bottom: 1px solid #e5eaf5; padding: 20px; }
  .reading-main { overflow: visible; flex-shrink: 0; }
  .reading-hint { display: none; }
  .reading-breadcrumb { display: none; }
  .reading-return { margin-left: auto; }
  .lesson-navigation { gap: 8px; }
  .reading-action { padding: 10px; }
}
@container historical-article (max-width: 580px) {
  .history-heading { gap: 18px; }
  .history-year { font-size: 46px; padding-right: 18px; letter-spacing: -2px; }
  .history-year span { font-size: 9px; letter-spacing: 1px; }
  .history-title h2 { font-size: 23px; }
  .story-next { flex-basis: auto; }
  .history-year.long-period { font-size: 28px; letter-spacing: -1px; }
  .history-year.text-period { font-size: 34px; }
}
</style>
