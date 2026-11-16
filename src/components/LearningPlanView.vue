<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { api } from '../api';
import { auth } from '../auth';
import AiTutor from './AiTutor.vue';
import { pendingPlanProposal } from '../plan-proposal';
import type { LearningModule } from '../data/learning';
import { dateKey, moduleOrder, schedulePlan, minuteOf, type PlanLesson, type Preferences, type SavedPlan } from '../learning-plan';
import { taskKey, moveTasks } from '../plan-arrangement';
import { layoutTimeBlocks } from '../learning-plan-layout';

type Point = { sections: { id: number; title: string; nodeType: string; estimatedMinutes: number | null }[] };
type Progress = { sections: { sectionId: number; status: string }[] };
const goals = [{ id: 'all', title: '全部课程', text: '按顺序学习全部内容', icon: '◎' }, { id: 'agent', title: '掌握 Agent', text: '工具调用与智能体开发', icon: '✦' }, { id: 'app', title: '开发 AI 应用', text: '从模型调用到完整应用', icon: '⌘' }, { id: 'rag', title: '构建知识库', text: '学习检索与增强生成', icon: '▤' }, { id: 'foundation', title: '建立 AI 基础', text: '模型原理与工程基础', icon: '◎' }];
const week = ['日', '一', '二', '三', '四', '五', '六'];
const preferences = ref<Preferences>({ goal: 'agent', level: 'beginner', minutes: 30, days: [1, 3, 5, 6] });
const saved = ref<SavedPlan | null>(null);
const lessons = ref<PlanLesson[]>([]);
const loading = ref(false);
const error = ref('');
const storageNotice = ref('');
const editing = ref(false);
const tutor = ref<InstanceType<typeof AiTutor>>();
async function receiveProposal(value: Preferences) {
  preferences.value = { ...value, minutes: value.minutes ?? 30, days: value.days ?? [] }; editing.value = true;
  await loadLessons();
}

const today = dateKey(new Date());
const effective = computed(() => editing.value ? preferences.value : saved.value?.preferences ?? preferences.value);
const planContext = computed(() => effective.value);
const goal = computed(() => goals.find(item => item.id === effective.value.goal)!);
const tasks = computed(() => editing.value || !saved.value ? schedulePlan(lessons.value, effective.value, today) : saved.value.tasks.filter(task => !task.completed));
const selectedDate = ref(today);
const calendarAnchor = ref(today);
const studyStart = ref('08:00');
const datePicker = ref<HTMLDetailsElement>();
const dayList = ref<HTMLElement>();
const timeBody = ref<HTMLElement>();
const gridHeight = ref(560);
const activeModule = ref('');
let gridObserver: ResizeObserver | undefined;
function selectDay(date: string) {
  selectedDate.value = date; calendarAnchor.value = date; monthAnchor.value = date;
  activeModule.value = '';
  if (datePicker.value) datePicker.value.open = false;
  if (dayList.value) dayList.value.scrollTop = 0;
}
function moveDay(direction: number) { selectDay(shiftDate(selectedDate.value, direction)); }
function moveWeek(direction: number) { moveDay(direction * 7); }
async function selectBlock(date: string, slug: string) {
  selectDay(date); activeModule.value = slug;
  await nextTick();
  const list = dayList.value;
  const group = list?.querySelector<HTMLElement>(`[data-module="${slug}"]`);
  if (list && group) list.scrollTo({ top: list.scrollTop + group.getBoundingClientRect().top - list.getBoundingClientRect().top - 16, behavior: 'smooth' });
}
function dismissDatePicker(event: PointerEvent) {
  if (event.target instanceof Element && !event.target.closest('.split-popover')) splitTarget.value = null;
  if (event.target instanceof Node && !datePicker.value?.contains(event.target) && datePicker.value) datePicker.value.open = false;
}
const monthAnchor = ref(today);
const monthTitle = computed(() => asDate(monthAnchor.value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }));
const monthDays = computed(() => {
  const start = asDate(monthAnchor.value); start.setDate(1);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return Array.from({ length: 42 }, (_, index) => {
    const date = shiftDate(dateKey(start), index);
    return { date, day: asDate(date).getDate(), scheduled: tasks.value.some(task => task.date === date) };
  });
});
function moveMonth(direction: number) { const date = asDate(monthAnchor.value); date.setDate(1); date.setMonth(date.getMonth() + direction); monthAnchor.value = dateKey(date); }

const timeTicks = Array.from({ length: 17 }, (_, index) => 480 + index * 60);
function clockLabel(minutes: number) { return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0'); }
function timedTasks(items: typeof tasks.value) {
  const [hours = 8, minutes = 0] = studyStart.value.split(':').map(Number);
  let cursor = hours * 60 + minutes;
  const blocks: (typeof tasks.value[number] & { start: number; end: number; count: number; members: typeof tasks.value })[] = [];
  for (const task of [...items].sort((a,b) => (a.startMinute ?? 0) - (b.startMinute ?? 0))) {
    cursor = task.startMinute ?? cursor;
    const previous = blocks.at(-1);
    if (previous && previous.slug === task.slug && previous.end === cursor && (previous.blockId ?? null) === (task.blockId ?? null)) {
      previous.end += task.duration; previous.count++; previous.members.push(task);
      previous.title = task.module + ' · ' + previous.count + ' 节';
    } else blocks.push({ ...task, title: task.module + ' · 1 节', start: cursor, end: cursor + task.duration, count: 1, members: [task] });
    cursor += task.duration;
  }
  return blocks;
}
const arranging = ref(false);
const arrangementNotice = ref('');
const draggedKeys = ref<string[]>([]);
const dropPreview = ref<{ date: string; minute: number } | null>(null);
const splitTarget = ref<{ members: typeof tasks.value; x: number; y: number } | null>(null);
const splitIndex = ref(1);
const splitBefore = computed(() => splitTarget.value?.members.slice(0, splitIndex.value) ?? []);
const splitAfter = computed(() => splitTarget.value?.members.slice(splitIndex.value) ?? []);
function openSplit(event: MouseEvent, members: typeof tasks.value) {
  if (arranging.value) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  splitIndex.value = Math.max(1, Math.floor(members.length / 2));
  splitTarget.value = { members, x: Math.max(12, Math.min(event.clientX || rect.left, window.innerWidth - 356)), y: Math.max(12, Math.min(event.clientY || rect.bottom, window.innerHeight - 360)) };
  nextTick(() => splitPopover.value?.querySelector<HTMLInputElement>('input')?.focus());
}
const splitPopover = ref<HTMLElement>();
function startDrag(event: DragEvent, members: typeof tasks.value) {
  if (arranging.value) { event.preventDefault(); return; }
  splitTarget.value = null;
  draggedKeys.value = members.map(taskKey);
  event.dataTransfer?.setData('text/plain', 'learning-plan');
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function endDrag() { draggedKeys.value = []; dropPreview.value = null; }
function hoverColumn(event: DragEvent, date: string) {
  if (!draggedKeys.value.length || arranging.value) return;
  event.preventDefault();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  dropPreview.value = { date, minute: Math.max(480, Math.min(1435, Math.round((480 + (event.clientY - rect.top) / rect.height * 960) / 5) * 5)) };
}
async function persistArrangement(nextTasks: typeof tasks.value) {
  if (!saved.value || arranging.value) return;
  arranging.value = true; arrangementNotice.value = '';
  try {
    saved.value = await api<SavedPlan>('/learning/plan', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...saved.value, tasks: nextTasks }) });
    arrangementNotice.value = '安排已保存';
    return true;
  } catch { arrangementNotice.value = '保存失败，原安排已保留，请重试'; return false; }
  finally { arranging.value = false; }
}
async function relocate(keys: string[], date: string, minute: number, blockId = crypto.randomUUID()) {
  if (!saved.value || arranging.value) return;
  try {
    const next = moveTasks(saved.value.tasks, keys, date, minute, blockId);
    await persistArrangement(next);
  } catch (cause) { arrangementNotice.value = (cause as Error).message; }
}
async function dropColumn(event: DragEvent) {
  event.preventDefault();
  const target = dropPreview.value, keys = [...draggedKeys.value];
  endDrag();
  if (target && keys.length) await relocate(keys, target.date, target.minute);
}
async function dropOnBlock(event: DragEvent, members: typeof tasks.value) {
  if (!draggedKeys.value.length) return;
  event.preventDefault(); event.stopPropagation();
  const keys = [...draggedKeys.value]; endDrag();
  if (members.some(task => keys.includes(taskKey(task)))) return;
  const moving = tasks.value.filter(task => keys.includes(taskKey(task)));
  if (moving.some(task => task.slug !== members[0]!.slug)) { arrangementNotice.value = '只能合并同一课程的小节'; return; }
  const blockId = crypto.randomUUID();
  const next = saved.value!.tasks.map(task => members.some(member => taskKey(member) === taskKey(task)) ? { ...task, blockId } : task);
  try {
    await persistArrangement(moveTasks(next, keys, members[0]!.date, members.at(-1)!.endMinute!, blockId));
  } catch (cause) { arrangementNotice.value = (cause as Error).message; }
}
async function splitBlock() {
  if (!saved.value || !splitTarget.value || !splitBefore.value.length || !splitAfter.value.length) return;
  const left = new Set(splitBefore.value.map(taskKey));
  const right = new Set(splitAfter.value.map(taskKey));
  const leftId = crypto.randomUUID(), rightId = crypto.randomUUID();
  const success = await persistArrangement(saved.value.tasks.map(task => left.has(taskKey(task)) ? { ...task, blockId: leftId } : right.has(taskKey(task)) ? { ...task, blockId: rightId } : task));
  if (success) splitTarget.value = null;
}
const scheduleMinutes = computed(() => effective.value.schedule?.reduce((sum, day) => sum + day.slots.reduce((total, slot) => total + minuteOf(slot.endTime) - minuteOf(slot.startTime), 0), 0) ?? 0);
const unscheduledMinutes = computed(() => Math.max(0, lessons.value.filter(lesson => !lesson.completed).reduce((sum, lesson) => sum + lesson.minutes, 0) - tasks.value.reduce((sum, task) => sum + task.duration, 0)));
function asDate(value: string) { return new Date(value + 'T12:00:00'); }
function shiftDate(value: string, days: number) { const date = asDate(value); date.setDate(date.getDate() + days); return dateKey(date); }
const calendarDays = computed(() => {
  const anchor = asDate(calendarAnchor.value);
  anchor.setDate(anchor.getDate() - (anchor.getDay() + 6) % 7);
  const start = dateKey(anchor);
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(start, index);
    const items = tasks.value.filter(task => task.date === date);
    return { date, day: asDate(date).getDate(), items, minutes: items.reduce((sum, item) => sum + item.duration, 0) };
  });
});
const selectedTasks = computed(() => tasks.value.filter(task => task.date === selectedDate.value));
const selectedMinutes = computed(() => selectedTasks.value.reduce((sum, task) => sum + task.duration, 0));
const selectedGroups = computed(() => {
  const groups: { slug: string; title: string; items: typeof tasks.value }[] = [];
  for (const task of selectedTasks.value) {
    let group = groups.find(item => item.slug === task.slug);
    if (!group) { group = { slug: task.slug, title: task.module, items: [] }; groups.push(group); }
    group.items.push(task);
  }
  return groups;
});
const weekTitle = computed(() => {
  const start = asDate(calendarDays.value[0]!.date);
  const end = asDate(calendarDays.value[6]!.date);
  return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 — ${end.getMonth() === start.getMonth() ? '' : end.getMonth() + 1 + '月'}${end.getDate()}日`;
});
const outsideHoursTasks = computed(() => selectedTasks.value.filter(task => (task.startMinute ?? minuteOf(studyStart.value)) < 480));
watch(timeBody, element => {
  gridObserver?.disconnect();
  if (!element) return;
  gridObserver = new ResizeObserver(entries => { gridHeight.value = entries[0]!.contentRect.height; });
  gridObserver.observe(element);
}, { flush: 'post' });

const modules = computed(() => [...new Set(lessons.value.map(lesson => lesson.slug))].map(slug => ({ slug, title: lessons.value.find(item => item.slug === slug)!.module, all: lessons.value.filter(item => item.slug === slug) })));
const completed = computed(() => lessons.value.filter(item => item.completed).length);
const finish = computed(() => tasks.value.map(task => task.date).sort().at(-1));
function pretty(value: string | undefined) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }) : '已完成'; }

async function loadLessons() {
  loading.value = true; error.value = '';
  try {
    const available = await api<LearningModule[]>('/learning/modules');
    const order = moduleOrder(effective.value);
    const result = await Promise.all(order.map(async slug => {
      const module = available.find(item => item.entrySlug === slug);
      if (!module) throw new Error('missing course');
      const [point, progress] = await Promise.all([api<Point>(`/knowledge/${slug}`), api<Progress>(`/learning/progress/${slug}`)]);
      return point.sections.filter(section => section.nodeType === 'LESSON').map(section => ({ id: section.id, slug, title: section.title, module: module.title, minutes: section.estimatedMinutes && section.estimatedMinutes > 0 ? section.estimatedMinutes : 20, completed: progress.sections.some(item => item.sectionId === section.id && item.status === 'COMPLETED') }));
    }));
    lessons.value = result.flat();
    if (!lessons.value.length) throw new Error('empty');
  } catch { error.value = '课程或学习进度加载失败，请重试。计划尚未变更。'; }
  finally { loading.value = false; }
}
async function cancel() { editing.value = false; error.value = ''; if (saved.value) await loadLessons(); }
async function activate() {
  if (loading.value) return;
  loading.value = true; error.value = '';
  try {
    const plan: SavedPlan = { version: 1, preferences: JSON.parse(JSON.stringify({ ...preferences.value, startTime: preferences.value.startTime ?? studyStart.value })), started: today, tasks: tasks.value };
    saved.value = await api<SavedPlan>('/learning/plan', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plan) });
    studyStart.value = saved.value.preferences.startTime ?? '08:00';
    editing.value = false;
  } catch { error.value = '计划保存失败，请重试。'; }
  finally { loading.value = false; }
}
onMounted(async () => {
  document.addEventListener('pointerdown', dismissDatePicker);
  const pending = pendingPlanProposal.value;
  pendingPlanProposal.value = null;
  loading.value = true;
  try {
    saved.value = await api<SavedPlan | null>('/learning/plan') ?? null;
    if (saved.value) {
      studyStart.value = saved.value.preferences.startTime ?? '08:00';
      await loadLessons();
    }
  } catch { storageNotice.value = '学习计划加载失败，请刷新重试。'; }
  finally { loading.value = false; }
  if (pending && pending.userId === auth.user?.id) await receiveProposal(pending.preferences);
});
onUnmounted(() => { gridObserver?.disconnect(); document.removeEventListener('pointerdown', dismissDatePicker); });
</script>

<template>
  <div class="plan-page" @keydown.esc="splitTarget = null">
    <header class="plan-header"><RouterLink to="/" class="plan-brand">✦ LearnAI</RouterLink><nav><RouterLink to="/">知识宇宙</RouterLink><span>学习计划</span></nav><span>{{ auth.user?.displayName }}</span></header>
    <main class="plan-main" :class="{ 'dashboard-main': saved && !editing }">
      <div v-if="!saved || editing" class="page-heading"><h1>学习计划</h1></div>
      <p v-if="storageNotice" class="message" role="status">{{ storageNotice }}</p>
      <div v-if="error" class="message error" role="alert">{{ error }} <button @click="loadLessons">重试</button></div>
      <section v-if="editing" class="creator">
        <div class="creator-top"><span class="eyebrow">AI 计划预览</span><button @click="cancel">取消</button></div>
        <template v-if="!loading && !error"><h2>{{ goal.title }} · 计划预览</h2><p class="muted">确认课程顺序和时间安排后保存。按具体日期和时段安排。</p><div class="preview-stats"><div><strong>{{ lessons.length - completed }}</strong><span>待学课节</span></div><div><strong>{{ scheduleMinutes }} 分钟</strong><span>已设置时间</span></div><div><strong>{{ unscheduledMinutes ? '时段不足' : pretty(finish) }}</strong><span>预计完成 · 可调整</span></div></div><p v-if="unscheduledMinutes" class="message">所选时段不足，还有 {{ unscheduledMinutes }} 分钟课程未排入，可通过助教补充学习时间。</p><div class="preview-route"><span v-for="(module, index) in modules" :key="module.slug">{{ index + 1 }}. {{ module.title }} <small> / {{ module.all.length }} 节</small></span></div><p class="footnote">已排除 {{ completed }} 节已完成内容。时长来自课程估计，缺少时长的课节按 20 分钟安排。时间不足时会拆分阅读；实际完成以课程页记录为准。</p></template>
        <div class="creator-actions"><span></span><button class="primary" :disabled="loading || !!error" @click="activate">{{ saved ? '应用计划' : '保存计划' }}</button></div>
      </section>
      <template v-else-if="saved">
        <div v-if="loading" class="empty-state" role="status">正在同步课程进度…</div>
        <template v-else-if="!error">
          <div class="calendar-layout">
            <aside class="day-detail" aria-label="当天课程">
              <header class="day-header">
                <div class="day-title"><h2>当天课程</h2><span>{{ selectedTasks.length }} 节 · {{ selectedMinutes }} 分钟</span></div>
                <div class="date-navigation">
                  <button class="icon-button" aria-label="前一天" @click="moveDay(-1)">‹</button>
                  <details ref="datePicker" class="date-picker" @keydown.esc="datePicker && (datePicker.open = false)">
                    <summary aria-label="选择日期">{{ pretty(selectedDate) }}<span aria-hidden="true">⌄</span></summary>
                    <section class="mini-calendar" aria-label="按月选择日期">
                      <div class="month-toolbar"><h2>{{ monthTitle }}</h2><button class="icon-button" aria-label="上个月" @click="moveMonth(-1)">‹</button><button class="icon-button" aria-label="下个月" @click="moveMonth(1)">›</button></div>
                      <div class="month-grid"><span v-for="day in ['一','二','三','四','五','六','日']" :key="day" class="month-weekday">{{ day }}</span>
                        <button v-for="day in monthDays" :key="day.date" :class="{ chosen: day.date === selectedDate, today: day.date === today, outside: day.date.slice(0,7) !== monthAnchor.slice(0,7) }" :aria-label="pretty(day.date) + (day.scheduled ? '，有学习安排' : '，无安排')" :aria-pressed="day.date === selectedDate" @click="selectDay(day.date)">{{ day.day }}<i v-if="day.scheduled" /></button>
                      </div>
                      <button class="picker-today" @click="selectDay(today)">回到今天</button>
                    </section>
                  </details>
                  <button class="icon-button" aria-label="后一天" @click="moveDay(1)">›</button>
                </div>
              </header>
              <div ref="dayList" class="day-course-list">
                <div v-if="!selectedTasks.length" class="day-empty"><span aria-hidden="true">—</span><h3>这一天没有学习安排</h3><p>选择其他日期查看课程。</p></div>
                <section v-for="group in selectedGroups" :key="group.slug" :data-module="group.slug" class="course-group" :class="['course-' + group.slug, { 'active-group': activeModule === group.slug }]">
                  <div class="course-group-heading"><i aria-hidden="true" /><h3>{{ group.title }}</h3><span>{{ group.items.length }} 节</span></div>
                  <RouterLink v-for="task in group.items" :key="task.id + '-' + task.part" class="lesson-row" :to="{ path: '/knowledge/' + task.slug, query: { section: task.id } }">
                    <span class="lesson-time">{{ task.startMinute != null ? clockLabel(task.startMinute) : '待安排' }}</span>
                    <div class="lesson-content"><strong>{{ task.title }}</strong><div class="lesson-meta"><span>{{ task.duration }} 分钟<template v-if="task.parts > 1"> · 第 {{ task.part }}/{{ task.parts }} 段</template></span><span class="lesson-action">开始学习 <span aria-hidden="true">↗</span></span></div></div>
                  </RouterLink>
                </section>
              </div>
            </aside>
            <section class="calendar-card" aria-label="周学习安排">
              <header class="week-toolbar"><div><h2>周安排</h2><span>{{ weekTitle }}</span></div><div class="week-actions"><button class="icon-button" aria-label="上一周" @click="moveWeek(-1)">‹</button><button class="today-button" @click="selectDay(today)">今天</button><button class="icon-button" aria-label="下一周" @click="moveWeek(1)">›</button></div></header>
              <div class="time-sheet">
                <div class="time-head"><span class="time-zone">时间</span><button v-for="day in calendarDays" :key="day.date" :class="{ active: day.date === selectedDate, 'is-today': day.date === today }" :aria-pressed="day.date === selectedDate" :aria-label="pretty(day.date) + (day.date === today ? '，今天' : '') + '，' + (day.minutes ? day.minutes + ' 分钟' : '无安排')" @click="selectDay(day.date)"><span class="weekday-label">周{{ week[asDate(day.date).getDay()] }}<i v-if="day.date === today" class="today-dot" aria-hidden="true" /></span><strong>{{ day.day }}</strong><small>{{ day.minutes ? day.minutes + ' 分钟' : '无安排' }}</small></button></div>
                <div ref="timeBody" class="time-body">
                  <div class="time-axis"><span v-for="minute in timeTicks" :key="minute" :style="{ top: (minute - 480) / 960 * 100 + '%' }">{{ clockLabel(minute) }}</span></div>
                  <div v-for="day in calendarDays" :key="day.date" class="time-column" @dragover="hoverColumn($event, day.date)" @drop="dropColumn" :class="{ 'selected-column': day.date === selectedDate }">
                    <div v-if="dropPreview?.date === day.date" class="drop-marker" :style="{ top: (dropPreview.minute - 480) / 960 * 100 + '%' }">{{ clockLabel(dropPreview.minute) }}</div>
                    <button v-for="task in layoutTimeBlocks(timedTasks(day.items), gridHeight)" :key="task.id + '-' + task.part" class="time-event" :draggable="!arranging" @dragstart="startDrag($event, task.members)" @dragend="endDrag" @dragover.prevent @drop="dropOnBlock($event, task.members)" :disabled="arranging" :class="['course-' + task.slug, { compact: task.height < 42, 'selected-event': day.date === selectedDate && activeModule === task.slug }]" :style="{ top: task.top + 'px', height: task.height + 'px' }" :title="task.title + ' · ' + clockLabel(task.start) + '–' + clockLabel(task.end)" :aria-label="pretty(day.date) + '，' + task.title + '，' + clockLabel(task.start) + '–' + clockLabel(task.end) + '，拖动调整，右键拆分'" @click="selectBlock(day.date, task.slug)" @contextmenu.prevent="openSplit($event, task.members)"><span class="event-title"><strong>{{ task.module }}</strong><span>{{ task.count }}节</span></span><small>{{ clockLabel(task.start) }}–{{ clockLabel(task.end) }}</small></button>
                  </div>
                </div>
              </div>
              <p v-if="outsideHoursTasks.length" class="hours-notice">选中日期有 08:00 前的课程，详见左侧当天课程。</p>
            </section>
          </div>
        </template>
      </template>
      <section v-else class="empty-state"><h2>尚未创建学习计划</h2><p class="muted">选择学习目标、当前基础和学习时间，生成课程安排。</p><button class="primary" @click="tutor?.openPlan()">创建学习计划</button><p class="footnote">已完成的课节会自动排除。</p></section>

    </main>
    <section v-if="splitTarget" ref="splitPopover" class="split-popover" role="dialog" aria-label="拆分课程块" :style="{ left: splitTarget.x + 'px', top: splitTarget.y + 'px' }" @pointerdown.stop>
      <div class="split-heading"><strong>拆分课程块</strong><button aria-label="关闭拆分" :disabled="arranging" @click="splitTarget = null">×</button></div>
      <template v-if="splitTarget.members.length > 1">
        <div class="split-summary"><span>{{ splitBefore.length }} 小节</span><span>{{ splitAfter.length }} 小节</span></div>
        <input v-model.number="splitIndex" class="split-slider" type="range" min="1" :max="splitTarget.members.length - 1" step="1" aria-label="拆分位置" :aria-valuetext="'前段 ' + splitBefore.length + ' 小节，后段 ' + splitAfter.length + ' 小节'" :disabled="arranging">
        <div class="split-preview"><div><small>前段 · {{ clockLabel(splitBefore[0]!.startMinute!) }}–{{ clockLabel(splitBefore.at(-1)!.endMinute!) }}</small><span>{{ splitBefore.at(-1)!.title }}</span></div><div><small>后段 · {{ clockLabel(splitAfter[0]!.startMinute!) }}–{{ clockLabel(splitAfter.at(-1)!.endMinute!) }}</small><span>{{ splitAfter[0]!.title }}</span></div></div>
        <button class="split-confirm" :disabled="arranging" @click="splitBlock">{{ arranging ? '正在保存…' : '拆成两块' }}</button>
      </template>
      <p v-else class="split-minimum">当前只有一个小节，无需拆分。</p>
    </section>
    <div v-if="arranging || arrangementNotice" class="arrangement-status" role="status">{{ arranging ? '正在保存…' : arrangementNotice }}<button v-if="!arranging" aria-label="关闭提示" @click="arrangementNotice = ''">×</button></div>
    <button class="tutor-entry secondary" @click="tutor?.open()">小包子助教</button>
    <AiTutor ref="tutor" :plan-context="planContext" @proposal="receiveProposal" />
  </div>
</template>

<style scoped>
.split-popover { box-sizing:border-box; position:fixed; z-index:100; width:min(332px,calc(100vw - 24px)); padding:18px; background:#fff; border:1px solid #e1e6f1; border-radius:14px; box-shadow:0 12px 40px #26355c24; }
.split-heading,.split-summary { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.split-heading { margin-bottom:20px; font-size:14px; }
.split-heading button,.arrangement-status button { border:0; background:transparent; color:#7b879c; cursor:pointer; font-size:20px; }
.split-summary { color:#536bc4; font-size:13px; }
.split-slider { display:block; width:100%; margin:14px 0 18px; accent-color:#6275c9; cursor:ew-resize; }
.split-preview { display:grid; gap:12px; margin-bottom:18px; }
.split-preview div { display:grid; gap:4px; }
.split-preview small { color:#7b879c; font-size:11px; }
.split-preview span { font-size:12px; color:#3d4f70; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.split-confirm { width:100%; border:0; border-radius:8px; padding:9px; color:#fff; background:#596fc2; cursor:pointer; }
.split-minimum { font-size:13px; color:#7b879c; }
.arrangement-status { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:110; padding:10px 16px; display:flex; align-items:center; gap:14px; background:#fff; border:1px solid #dfe5f0; border-radius:10px; box-shadow:0 4px 24px #26355c18; font-size:13px; }
.drop-marker { position:absolute; left:0; right:0; border-top:2px solid #536bc4; z-index:10; pointer-events:none; color:#344a77; font-size:11px; background:#eef2ff; }
.time-event[draggable="true"] { cursor:grab; }

.plan-page { height:100dvh; overflow:auto; background:radial-gradient(ellipse at 85% 5%,#eaeaff60,transparent 45%),#f7f9fe; color:#233253; }
.plan-header { height:var(--app-header-height); display:flex; align-items:center; justify-content:space-between; padding:0 4%; border-bottom:1px solid #e5eaf4; background:#ffffffb0; }
.plan-brand { font-size:23px; font-weight:750; color:#5067bc; }
.plan-header nav { display:flex; gap:34px; }
.plan-header nav a { color:#7a869e; }
.plan-header nav span { color:#536bc4; }
.plan-main { max-width:1800px; margin:auto; padding:24px 28px; }
.dashboard-main { height:calc(100dvh - var(--app-header-height)); display:flex; flex-direction:column; padding-bottom:10px; }
.calendar-layout { display:grid; grid-template-columns:minmax(300px,360px) minmax(0,1fr); gap:24px; flex:1; min-height:0; }
.day-detail,.calendar-card { min-width:0; min-height:0; background:white; border:1px solid #e7eaf3; border-radius:18px; box-shadow:0 4px 24px #283b5c03; }
.day-detail { display:flex; flex-direction:column; }
.day-header { padding:22px 22px 16px; border-bottom:1px solid #eef0f6; position:relative; z-index:8; }
.day-title { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:15px; }
.day-title h2 { font-size:18px; margin:0; }
.day-title>span { font-size:12px; color:#78849b; white-space:nowrap; }
.date-navigation { display:flex; align-items:center; gap:5px; background:#f6f7fb; border-radius:10px; padding:3px; }
.icon-button { display:grid; place-items:center; flex-shrink:0; width:30px; height:30px; border-radius:8px; font-size:23px; line-height:1; color:#67758e; }
.icon-button:hover { background:#edf0f8; color:#536bc4; }
.date-picker { flex:1; min-width:0; }
.date-picker summary { list-style:none; display:flex; justify-content:center; align-items:center; gap:10px; padding:4px 0; cursor:pointer; color:#465576; font-size:14px; }
.date-picker summary::-webkit-details-marker { display:none; }
.date-picker summary>span { color:#8490a6; }
.mini-calendar { position:absolute; left:12px; top:calc(100% - 9px); width:310px; padding:18px; background:#fff; border:1px solid #e5e8f2; border-radius:14px; box-shadow:0 12px 40px #26355c20; }
.month-toolbar { display:flex; align-items:center; gap:5px; margin-bottom:14px; }
.month-toolbar h2 { margin:0 auto 0 0; font-size:16px; }
.month-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:4px; text-align:center; }
.month-weekday { font-size:11px; color:#7a869e; padding-bottom:8px; }
.month-grid button { position:relative; aspect-ratio:1; border-radius:9px; font-size:12px; }
.month-grid button:hover { background:#f0edfc; }
.month-grid .outside { color:#b7bfce; }
.month-grid .today { box-shadow:inset 0 0 0 1px #8876d8; }
.month-grid .chosen { background:#7563cf; color:#fff; }
.month-grid i { position:absolute; width:3px; height:3px; background:currentColor; border-radius:50%; bottom:3px; left:calc(50% - 1.5px); }
.picker-today { margin-top:12px; width:100%; padding:9px; border-top:1px solid #edf0f6; color:#6758b3; font-size:12px; }
.day-course-list { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:6px 20px 20px; scrollbar-gutter:stable; }
.course-group { padding:6px 0 5px; }
.course-group-heading { display:flex; align-items:center; gap:8px; padding:12px 0 10px; border-bottom:1px solid #edf0f6; }
.course-group-heading i { width:7px; height:7px; border-radius:2px; background:var(--course-accent); flex-shrink:0; }
.course-group-heading h3 { margin:0; font-size:13px; font-weight:600; color:var(--course-ink); }
.course-group-heading>span { margin-left:auto; font-size:11px; color:#8993a5; }
.active-group .course-group-heading { background:var(--course-bg); margin-left:-8px; margin-right:-8px; padding-left:8px; padding-right:8px; border-radius:7px; border-bottom-color:transparent; }
.lesson-row { display:flex; align-items:flex-start; gap:11px; padding:14px 0; border-bottom:1px solid #f0f2f7; border-radius:5px; }
.lesson-row:last-child { border-bottom-color:transparent; }
.lesson-row:hover { background:#f8f9fd; }
.lesson-time { font-size:11px; color:#7c89a0; flex:0 0 34px; padding-top:3px; font-variant-numeric:tabular-nums; }
.lesson-content { flex:1; min-width:0; }
.lesson-content strong { display:block; font-size:13px; font-weight:500; line-height:1.7; overflow-wrap:anywhere; }
.lesson-meta { display:flex; flex-wrap:wrap; justify-content:space-between; gap:5px; margin-top:6px; font-size:11px; color:#8792a6; }
.lesson-action { color:#6877b6; white-space:nowrap; }
.lesson-row:hover .lesson-action { color:#6651bf; }
.day-empty { padding:40px 4px; text-align:center; }
.day-empty>span { color:#c4c9d8; font-size:30px; }
.day-empty h3 { font-size:15px; font-weight:500; margin:15px 0 8px; }
.day-empty p { color:#8893a8; font-size:12px; line-height:1.8; margin-bottom:20px; }
.calendar-card { display:flex; flex-direction:column; }
.week-toolbar { display:flex; align-items:center; justify-content:space-between; flex-shrink:0; gap:18px; padding:20px 24px; border-bottom:1px solid #eef0f6; }
.week-toolbar>div:first-child { display:flex; align-items:center; gap:15px; }
.week-toolbar h2 { font-size:19px; margin:0; white-space:nowrap; }
.week-toolbar>div>span { font-size:13px; color:#7e8aa1; }
.week-actions { display:flex; align-items:center; gap:5px; }
.today-button { padding:5px 10px; font-size:12px; color:#5c6d97; border:1px solid #e7eaf3; border-radius:8px; }
.today-button:hover { background:#f4f5fc; }
.time-sheet { display:flex; flex-direction:column; flex:1; min-height:0; padding:0 14px 20px 8px; }
.time-head { display:grid; grid-template-columns:50px repeat(7,minmax(0,1fr)); flex-shrink:0; padding:12px 0 13px; }
.time-zone { align-self:center; text-align:center; color:#98a2b3; font-size:10px; }
.time-head>button { display:flex; flex-direction:column; align-items:center; gap:2px; margin:0 7px; padding:8px 3px; border-radius:11px; color:#7d88a0; }
.time-head>button:hover { background:#f4f3fc; }
.weekday-label { font-size:11px; display:flex; gap:4px; align-items:center; }
.today-dot { width:4px; height:4px; background:#7563cf; border-radius:50%; }
.time-head strong { font-size:21px; line-height:1.25; color:#435376; font-weight:600; }
.time-head small { font-size:10px; color:#8a96ad; }
.time-head .is-today strong { color:#7563cf; }
.time-head .active,.time-head .active:hover { background:#f0edfb; box-shadow:inset 0 0 0 1px #e7e1f8; color:#7563cf; }
.time-head .active strong { color:#6d57c1; }
.time-head .active small { color:#8b79bc; }
.time-body { display:grid; grid-template-columns:50px repeat(7,minmax(0,1fr)); position:relative; flex:1; min-height:0; }
.time-axis { position:relative; }
.time-axis>span { position:absolute; right:10px; font-size:10px; color:#8995aa; transform:translateY(-50%); font-variant-numeric:tabular-nums; line-height:1; }
.time-column { position:relative; border-left:1px solid #f1f3f8; border-bottom:1px solid #e9edf5; background-image:linear-gradient(to bottom,#edf0f6 1px,transparent 1px); background-size:100% calc(100% / 16); }
.time-column.selected-column { background-color:#faf9fe; }
.time-event { position:absolute; left:5px; right:5px; display:flex; flex-direction:column; justify-content:center; gap:3px; padding:4px 7px; text-align:left; border-left:2px solid var(--course-accent); border-radius:5px; background:var(--course-bg); color:var(--course-ink); overflow:hidden; transition:filter .15s,box-shadow .15s; z-index:1; }
.event-title { display:flex; align-items:center; gap:4px; width:100%; line-height:1.3; }
.event-title strong { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:12px; font-weight:600; }
.event-title>span { font-size:10px; flex-shrink:0; }
.time-event small { font-size:10px; white-space:nowrap; font-variant-numeric:tabular-nums; opacity:.85; }
.time-event.compact { padding:1px 5px; }
.time-event.compact small { display:none; }
.time-event.compact strong { font-size:11px; }
.time-event:hover,.time-event.selected-event { filter:brightness(.97); box-shadow:inset 0 0 0 1px var(--course-accent); }
.course-group,.time-event { --course-bg:#e8eefb; --course-ink:#496489; --course-accent:#91a7ce; }
.course-engineering-basics { --course-bg:#e7eefb; --course-ink:#4a6590; --course-accent:#9ab0d9; }
.course-llm-basics { --course-bg:#eee7f7; --course-ink:#7a5b93; --course-accent:#b69dcc; }
.course-llm-app-dev { --course-bg:#f8ede3; --course-ink:#976e45; --course-accent:#d5b28b; }
.course-agents { --course-bg:#deeff3; --course-ink:#356e7b; --course-accent:#8dbac4; }
.course-rag { --course-bg:#e7f1e9; --course-ink:#567b63; --course-accent:#a2c4ad; }
.hours-notice { flex-shrink:0; margin:0; padding:4px 24px 10px; font-size:11px; color:#92784e; }
.tutor-entry { position:fixed; bottom:20px; right:24px; padding:10px 16px!important; box-shadow:0 4px 20px #23325314; z-index:10; }
/* AI plan previews use normal document flow. */
.page-heading { margin-bottom:24px; }
.page-heading h1 { font-size:25px; margin:0; }
.primary,.secondary { border-radius:10px; padding:11px 18px; font-weight:600; }
.primary { background:#6275d7; color:white; box-shadow:0 7px 18px #6275d72b; }
.secondary { background:#eef1fc; color:#5e70b6; border:1px solid #dce3f6; }
button:disabled { opacity:.5; cursor:wait; }
button:focus-visible,a:focus-visible,summary:focus-visible { outline:2px solid #8599ec; outline-offset:3px; }
.muted { color:#7b869c; line-height:1.9; }
.footnote { font-size:12px; line-height:1.8; color:#8b95aa; }
.message { padding:15px 20px; border-radius:12px; background:#fff4df; color:#94794b; }
.error { background:#fff0ed; color:#b76352; }
.message button { text-decoration:underline; }
.creator,.empty-state { background:white; border:1px solid #e5eaf5; border-radius:20px; }
.creator { padding:30px 40px; max-width:1100px; margin:auto; }
.creator-top { display:flex; align-items:center; justify-content:space-between; }
.creator-top button { color:#8892a8; }
.eyebrow { font-size:11px; font-weight:700; letter-spacing:2px; color:#7e86b1; }
.creator h2 { font-size:23px; margin:15px 0; }
.creator-actions { display:flex; justify-content:space-between; border-top:1px solid #edf0f6; padding-top:25px; margin-top:30px; }
.preview-stats { display:flex; gap:50px; background:#f6f7fe; padding:26px; border-radius:16px; margin:25px 0; }
.preview-stats div { display:flex; flex-direction:column; gap:9px; }
.preview-stats strong { font-size:21px; color:#5d6fc5; }
.preview-stats span { color:#8993a9; font-size:12px; }
.preview-route { display:flex; flex-direction:column; gap:17px; padding:10px; }
.preview-route small { color:#8a94ab; }
.empty-state { text-align:center; padding:55px 25px; }
.empty-state h2 { font-size:28px; }
.empty-state .primary { margin:20px 8px 7px; }
@media(max-width:1200px) {
  .plan-main { padding:18px 20px 10px; }
  .calendar-layout { grid-template-columns:310px minmax(0,1fr); gap:18px; }
  .week-toolbar { padding:16px; gap:10px; }
  .week-toolbar>div:first-child { flex-wrap:wrap; gap:2px 10px; }
  .week-toolbar>div>span { font-size:11px; }
  .day-header { padding:20px 16px 16px; }
  .day-course-list { padding-left:14px; padding-right:14px; }
  .time-head>button { margin:0 3px; }
  .time-event { left:3px; right:3px; }
}
</style>
