<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { api } from '../api';
import { auth } from '../auth';
import AiTutor from './AiTutor.vue';
import { pendingPlanProposal } from '../plan-proposal';
import type { LearningModule } from '../data/learning';
import { dateKey, moduleOrder, schedulePlan, validSchedule, minuteOf, type PlanLesson, type Preferences, type SavedPlan } from '../learning-plan';

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
const step = ref(0);
const tutor = ref<InstanceType<typeof AiTutor>>();
async function receiveProposal(value: Preferences) {
  preferences.value = { ...value, minutes: value.minutes ?? 30, days: value.days ?? [] }; editing.value = true;
  await loadLessons(); step.value = error.value ? 2 : 3;
}
const key = `learnai:plan:v1:${auth.user!.id}`;
const today = dateKey(new Date());
const effective = computed(() => editing.value ? preferences.value : saved.value?.preferences ?? preferences.value);
const planContext = computed(() => effective.value);
const goal = computed(() => goals.find(item => item.id === effective.value.goal)!);
const tasks = computed(() => schedulePlan(lessons.value, effective.value, editing.value ? today : saved.value?.started ?? today));
const selectedDate = ref(today);
const calendarMode = ref<'week' | 'month'>('week');
const calendarAnchor = ref(today);
const showEarlyHours = ref(false);
const studyStart = ref('08:00');
const timeScroll = ref<HTMLElement>();
async function focusCourses() {
  await nextTick();
  const blocks = calendarDays.value.flatMap(day => timedTasks(day.items));
  if (!timeScroll.value || !blocks.length) return;
  const first = Math.min(...blocks.map(block => block.start));
  timeScroll.value.scrollTop = Math.max(0, (first - axisStart.value - 30) * 1.6);
}
function selectDay(date: string) { selectedDate.value = date; calendarAnchor.value = date; monthAnchor.value = date; }
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

const axisStart = computed(() => showEarlyHours.value ? 0 : 8 * 60);
const timeTicks = computed(() => Array.from({ length: (1440 - axisStart.value) / 15 + 1 }, (_, index) => axisStart.value + index * 15));
function clockLabel(minutes: number) { return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0'); }
function timedTasks(items: typeof tasks.value) {
  const [hours = 8, minutes = 0] = studyStart.value.split(':').map(Number);
  let cursor = hours * 60 + minutes;
  const blocks: (typeof tasks.value[number] & { start: number; end: number; count: number })[] = [];
  for (const task of items) {
    cursor = task.startMinute ?? cursor;
    const previous = blocks.at(-1);
    if (previous && previous.slug === task.slug && previous.end === cursor) {
      previous.end += task.duration; previous.count++;
      previous.title = task.module + ' · ' + previous.count + ' 节';
    } else blocks.push({ ...task, title: task.module + ' · 1 节', start: cursor, end: cursor + task.duration, count: 1 });
    cursor += task.duration;
  }
  return blocks;
}
function addDate() {
  const schedule = preferences.value.schedule ??= [];
  const date = schedule.length ? shiftDate(schedule.at(-1)!.date, 1) : today;
  schedule.push({ date, weekday: asDate(date).getDay() || 7, slots: [{ startTime: '09:00', endTime: '10:00' }] });
}
function updateDate(index: number, value: string) {
  const day = preferences.value.schedule?.[index];
  if (day) { day.date = value; day.weekday = asDate(value).getDay() || 7; }
}
function migrateSchedule(value: Preferences, start: string): Preferences {
  if (value.schedule) return value;
  const horizon = schedulePlan(lessons.value, value, start).at(-1)?.date ?? shiftDate(start, 27);
  const schedule = [];
  for (let date = start; date <= horizon; date = shiftDate(date, 1)) {
    if (!value.days.includes(asDate(date).getDay())) continue;
    const startTime = value.startTime ?? studyStart.value;
    const end = Math.min(1440, minuteOf(startTime) + value.minutes);
    schedule.push({ date, weekday: asDate(date).getDay() || 7, slots: [{ startTime, endTime: clockLabel(end) }] });
  }
  return { ...value, schedule };
}
const scheduleMinutes = computed(() => effective.value.schedule?.reduce((sum, day) => sum + day.slots.reduce((total, slot) => total + minuteOf(slot.endTime) - minuteOf(slot.startTime), 0), 0) ?? 0);
const unscheduledMinutes = computed(() => Math.max(0, lessons.value.filter(lesson => !lesson.completed).reduce((sum, lesson) => sum + lesson.minutes, 0) - tasks.value.reduce((sum, task) => sum + task.duration, 0)));
function asDate(value: string) { return new Date(value + 'T12:00:00'); }
function shiftDate(value: string, days: number) { const date = asDate(value); date.setDate(date.getDate() + days); return dateKey(date); }
const calendarDays = computed(() => {
  const anchor = asDate(calendarAnchor.value);
  if (calendarMode.value === 'month') anchor.setDate(1);
  anchor.setDate(anchor.getDate() - (anchor.getDay() + 6) % 7);
  const start = dateKey(anchor);
  const count = calendarMode.value === 'week' ? 7 : 42;
  return Array.from({ length: count }, (_, index) => {
    const date = shiftDate(start, index);
    const items = tasks.value.filter(task => task.date === date);
    return { date, day: asDate(date).getDate(), items, minutes: items.reduce((sum, item) => sum + item.duration, 0) };
  });
});
const calendarTitle = computed(() => calendarMode.value === 'month'
  ? asDate(calendarAnchor.value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
  : pretty(calendarDays.value[0]?.date) + ' — ' + pretty(calendarDays.value[6]?.date));
const selectedTasks = computed(() => tasks.value.filter(task => task.date === selectedDate.value));
function moveCalendar(direction: number) {
  const date = asDate(calendarAnchor.value);
  if (calendarMode.value === 'month') { date.setDate(1); date.setMonth(date.getMonth() + direction); }
  else date.setDate(date.getDate() + direction * 7);
  calendarAnchor.value = dateKey(date); selectedDate.value = calendarAnchor.value; monthAnchor.value = calendarAnchor.value;
}
function showToday() { selectedDate.value = today; calendarAnchor.value = today; monthAnchor.value = today; void focusCourses(); }
watch([calendarAnchor, calendarMode, loading, showEarlyHours], () => { void focusCourses(); });

const modules = computed(() => [...new Set(lessons.value.map(lesson => lesson.slug))].map(slug => ({ slug, title: lessons.value.find(item => item.slug === slug)!.module, all: lessons.value.filter(item => item.slug === slug) })));
const completed = computed(() => lessons.value.filter(item => item.completed).length);
const percent = computed(() => lessons.value.length ? Math.round(completed.value / lessons.value.length * 100) : 0);
const finish = computed(() => tasks.value.at(-1)?.date);
function pretty(value: string | undefined) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }) : '已完成'; }

function create() { preferences.value = saved.value ? JSON.parse(JSON.stringify(saved.value.preferences)) : { goal: 'agent', level: 'beginner', minutes: 30, days: [1, 3, 5, 6] }; preferences.value = migrateSchedule(preferences.value, today); editing.value = true; step.value = 0; error.value = ''; }
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
const validMinutes = computed(() => !!preferences.value.schedule && validSchedule(preferences.value.schedule));
async function preview() { if (!validMinutes.value) return; await loadLessons(); if (!error.value) step.value = 3; }
async function cancel() { editing.value = false; error.value = ''; if (saved.value) await loadLessons(); }
function activate() {
  const plan: SavedPlan = { version: 1, preferences: JSON.parse(JSON.stringify({ ...preferences.value, startTime: preferences.value.startTime ?? studyStart.value })), started: today };
  try { localStorage.setItem(key, JSON.stringify(plan)); storageNotice.value = ''; }
  catch { storageNotice.value = '浏览器未能保存计划，本次可使用，刷新后可能丢失。'; }
  saved.value = plan; studyStart.value = plan.preferences.startTime ?? studyStart.value;
  try { localStorage.setItem(key + ':start', studyStart.value); } catch { /* Plan retains the time if the separate display setting cannot be stored. */ }
  editing.value = false;
}
onMounted(async () => {
  const pending = pendingPlanProposal.value;
  pendingPlanProposal.value = null;
  try {
    const start = localStorage.getItem(key + ':start');
    if (start && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)) {
      studyStart.value = start;
      if (start < '08:00') showEarlyHours.value = true;
    }
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value?.version === 1 && goals.some(item => item.id === value.preferences?.goal) && ['beginner', 'familiar', 'experienced'].includes(value.preferences?.level) && (value.preferences.schedule ? validSchedule(value.preferences.schedule) : Number.isSafeInteger(value.preferences?.minutes) && value.preferences.minutes >= 1 && Array.isArray(value.preferences?.days) && value.preferences.days.length && value.preferences.days.every((day: number) => Number.isInteger(day) && day >= 0 && day <= 6)) && /^\d{4}-\d{2}-\d{2}$/.test(value.started)) saved.value = value;
  } catch { storageNotice.value = '本地计划无法读取，请重新创建。'; }
  if (saved.value) {
    if (saved.value.preferences.startTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(saved.value.preferences.startTime)) studyStart.value = saved.value.preferences.startTime;
    await loadLessons();
    saved.value.preferences = migrateSchedule(saved.value.preferences, saved.value.started);
  }
  if (pending && pending.userId === auth.user?.id) await receiveProposal(pending.preferences);
});
</script>

<template>
  <div class="plan-page">
    <header class="plan-header"><RouterLink to="/" class="plan-brand">✦ LearnAI</RouterLink><nav><RouterLink to="/">知识宇宙</RouterLink><span>学习计划</span></nav><span>{{ auth.user?.displayName }}</span></header>
    <main class="plan-main">
      <div v-if="!saved || editing" class="page-heading"><div><h1>学习计划</h1></div><button v-if="saved && !editing" class="secondary" @click="tutor?.openPlan()">调整计划</button></div>
      <p v-if="storageNotice" class="message" role="status">{{ storageNotice }}</p>
      <div v-if="error" class="message error" role="alert">{{ error }} <button @click="step === 2 ? preview() : loadLessons()">重试</button></div>
      <section v-if="editing" class="creator">
        <div class="creator-top"><span class="eyebrow">手动设置</span><button @click="cancel">取消</button></div>
        <ol class="steps"><li v-for="(label, index) in ['学习目标', '当前基础', '时间安排', '计划预览']" :key="label" :class="{ current: step === index, passed: step > index }"><span>{{ index + 1 }}</span>{{ label }}</li></ol>
        <template v-if="step === 0"><h2>选择学习目标</h2><p class="muted">根据目标匹配课程。</p><div class="goal-grid"><button v-for="item in goals" :key="item.id" class="choice" :class="{ selected: preferences.goal === item.id }" :aria-pressed="preferences.goal === item.id" @click="preferences.goal = item.id"><i>{{ item.icon }}</i><strong>{{ item.title }}</strong><small>{{ item.text }}</small></button></div></template>
        <template v-if="step === 1"><h2>选择当前基础</h2><p class="muted">选择最接近当前情况的一项，已完成课节会自动排除。</p><div class="level-list"><button v-for="item in [{ id: 'beginner', title: '刚刚起步', text: '编程经验较少，需要先学习工程基础' }, { id: 'familiar', title: '有编程基础', text: '能读写简单代码，从模型应用开始' }, { id: 'experienced', title: '有 AI 使用或开发经验', text: '沿目标课程查漏补缺，接续未完成内容' }]" :key="item.id" class="choice" :class="{ selected: preferences.level === item.id }" :aria-pressed="preferences.level === item.id" @click="preferences.level = item.id"><strong>{{ item.title }}</strong><small>{{ item.text }}</small></button></div><p class="footnote">本版根据自评安排起点，尚未接入能力诊断；已读状态不代表能力评定。</p></template>
        <template v-if="step === 2"><h2>设置学习时段</h2><p class="muted">每个日期可添加多个时段，精确到分钟；不添加时段表示休息。</p><div v-for="(day, index) in preferences.schedule" :key="index" class="date-editor"><input type="date" :value="day.date" aria-label="学习日期" @change="updateDate(index, ($event.target as HTMLInputElement).value)"><span>周{{ week[day.weekday % 7] }}</span><button @click="preferences.schedule?.splice(index, 1)">删除日期</button><div v-for="(slot, slotIndex) in day.slots" :key="slotIndex" class="slot-editor"><input v-model="slot.startTime" type="time" step="60" aria-label="开始时间"><span>至</span><input v-model="slot.endTime" type="text" placeholder="HH:mm" aria-label="结束时间"><button @click="day.slots.splice(slotIndex, 1)">删除时段</button></div><button class="secondary" @click="day.slots.push({ startTime: '14:00', endTime: '15:00' })">添加时段</button></div><button class="secondary" @click="addDate">添加日期</button><p v-if="!validMinutes" class="message">请检查日期、周几和时段：同一日期不能重复，时段按顺序排列且不能重叠。</p></template>
        <template v-if="step === 3"><h2>{{ goal.title }} · 计划预览</h2><p class="muted">确认课程顺序和时间安排后保存。按具体日期和时段安排。</p><div class="preview-stats"><div><strong>{{ lessons.length - completed }}</strong><span>待学课节</span></div><div><strong>{{ scheduleMinutes }} 分钟</strong><span>已设置时间</span></div><div><strong>{{ unscheduledMinutes ? '时段不足' : pretty(finish) }}</strong><span>预计完成 · 可调整</span></div></div><p v-if="unscheduledMinutes" class="message">所选时段不足，还有 {{ unscheduledMinutes }} 分钟课程未排入，请增加日期或时段。</p><div class="preview-route"><span v-for="(module, index) in modules" :key="module.slug">{{ index + 1 }}. {{ module.title }} <small> / {{ module.all.length }} 节</small></span></div><p class="footnote">已排除 {{ completed }} 节已完成内容。时长来自课程估计，缺少时长的课节按 20 分钟安排。时间不足时会拆分阅读；实际完成以课程页记录为准。</p></template>
        <div class="creator-actions"><button v-if="step > 0" class="secondary" :disabled="loading" @click="step--">上一步</button><span v-else></span><button v-if="step < 2" class="primary" @click="step++">下一步 →</button><button v-else-if="step === 2" class="primary" :disabled="!validMinutes || loading" @click="preview">{{ loading ? '正在读取课程与进度…' : '生成计划预览' }}</button><button v-else class="primary" @click="activate">{{ saved ? '应用新安排' : '保存计划' }} →</button></div>
      </section>
      <template v-else-if="saved">
        <div v-if="loading" class="empty-state" role="status">正在同步课程进度…</div>
        <template v-else-if="!error">
          <div class="calendar-layout">
          <section class="calendar-card" aria-label="学习日历">
            <div class="calendar-toolbar"><h2>{{ calendarTitle }}</h2><div class="calendar-controls"><button aria-label="上一期" @click="moveCalendar(-1)">‹</button><button @click="showToday">今天</button><button aria-label="下一期" @click="moveCalendar(1)">›</button></div></div>
            <div v-if="calendarMode === 'week'" class="time-calendar">
              <div class="time-settings"><span>按每天的实际学习时段安排</span><button :aria-expanded="showEarlyHours" @click="showEarlyHours = !showEarlyHours">{{ showEarlyHours ? '折叠' : '展开' }} 00:00–08:00</button></div>
              <div ref="timeScroll" class="time-scroll"><div class="time-sheet">
                <div class="time-head"><span class="time-zone">时间</span><button v-for="day in calendarDays" :key="day.date" :class="{ active: day.date === selectedDate, 'is-today': day.date === today }" :aria-pressed="day.date === selectedDate" @click="selectDay(day.date)"><strong>{{ day.day }}</strong> 周{{ week[asDate(day.date).getDay()] }}<small>{{ day.minutes ? day.minutes + ' 分钟' : '无安排' }}</small></button></div>
                <div class="time-body" :style="{ height: (1440 - axisStart) * 1.6 + 'px' }">
                  <div class="time-axis"><span v-for="minute in timeTicks.slice(0, -1)" :key="minute" :class="{ hour: minute % 60 === 0 }" :style="{ top: (minute - axisStart) * 1.6 + 'px' }">{{ clockLabel(minute) }}</span></div>
                  <div v-for="day in calendarDays" :key="day.date" class="time-column" :class="{ 'selected-column': day.date === selectedDate }">
                    <template v-for="task in timedTasks(day.items)" :key="task.id + '-' + task.part">
                      <button v-if="task.end > axisStart && task.start < 1440" class="time-event" :class="['course-color-' + (modules.findIndex(module => module.slug === task.slug) % 3), { compact: task.end - task.start < 25 }]" :style="{ top: (Math.max(task.start, axisStart) - axisStart) * 1.6 + 'px', height: (Math.min(task.end, 1440) - Math.max(task.start, axisStart)) * 1.6 - 2 + 'px' }" :title="task.title + ' · ' + clockLabel(task.start) + '–' + clockLabel(task.end)" @click="selectDay(day.date)"><strong>{{ task.title }}</strong><small>{{ clockLabel(task.start) }}–{{ clockLabel(task.end) }}</small></button>
                    </template>
                  </div>
                </div>
                <div class="time-end">24:00</div>
              </div></div>
              <p v-if="calendarDays.some(day => timedTasks(day.items).some(task => task.end > 1440))" class="message" role="status">部分课程超出 24:00，请提前开始时间；完整课程仍可在下方查看。</p>
            </div>
          </section>
          <aside class="plan-sidebar">
            <div class="sidebar-heading"><h1>学习计划</h1><button class="secondary" @click="tutor?.openPlan()">调整计划</button></div>
          <section class="plan-summary"><div><h2>{{ goal.title }}</h2><p class="muted">{{ effective.schedule?.length ?? 0 }} 个日期 · 共 {{ scheduleMinutes }} 分钟 · {{ unscheduledMinutes ? '还有 ' + unscheduledMinutes + ' 分钟课程未排入' : finish ? '预计 ' + pretty(finish) + '完成' : '课程已全部完成' }}</p></div><div><strong>{{ percent }}%</strong><p class="muted">已完成 {{ completed }} / {{ lessons.length }} 节</p></div><button class="secondary" @click="loadLessons">刷新进度</button></section>
            <section class="mini-calendar" aria-label="按月选择日期">
              <div class="month-toolbar"><h2>{{ monthTitle }}</h2><button aria-label="上个月" @click="moveMonth(-1)">‹</button><button aria-label="下个月" @click="moveMonth(1)">›</button></div>
              <div class="month-grid"><span v-for="day in ['一','二','三','四','五','六','日']" :key="day" class="month-weekday">{{ day }}</span>
                <button v-for="day in monthDays" :key="day.date" :class="{ chosen: day.date === selectedDate, today: day.date === today, outside: day.date.slice(0,7) !== monthAnchor.slice(0,7) }" :aria-label="pretty(day.date) + (day.scheduled ? '，有学习安排' : '，无安排')" :aria-pressed="day.date === selectedDate" @click="selectDay(day.date)">{{ day.day }}<i v-if="day.scheduled" /></button>
              </div>
            </section>
            <section class="day-detail" aria-label="当天安排"><h2>当天安排</h2><p class="muted">{{ pretty(selectedDate) }} · {{ selectedTasks.reduce((sum, task) => sum + task.duration, 0) }} 分钟</p>
              <p v-if="!selectedTasks.length" class="muted">当天无学习安排</p>
              <div v-for="task in selectedTasks" :key="task.id + '-' + task.part" class="task-row"><div><strong>{{ task.title }}</strong><small>{{ task.startMinute != null ? clockLabel(task.startMinute) + ' · ' : '' }}{{ task.duration }} 分钟 · 待学习<template v-if="task.parts > 1"> · {{ task.part }}/{{ task.parts }}</template></small></div><RouterLink :to="{ path: '/knowledge/' + task.slug, query: { section: task.id } }">开始学习 ↗</RouterLink></div>
              <RouterLink v-if="!selectedTasks.length && lessons.some(lesson => !lesson.completed)" :to="{ path: '/knowledge/' + lessons.find(lesson => !lesson.completed)!.slug, query: { section: lessons.find(lesson => !lesson.completed)!.id } }" class="resume-course">继续未完成课程 →</RouterLink>
            </section>
          </aside></div>
          <p class="footnote">计划保存在当前浏览器，仅当前账号可见。日历展示待学安排，已完成课节自动排除。</p>
        </template>
      </template>
      <section v-else class="empty-state"><h2>尚未创建学习计划</h2><p class="muted">选择学习目标、当前基础和学习时间，生成课程安排。</p><button class="primary" @click="tutor?.openPlan()">创建学习计划</button><button class="secondary" @click="create">手动设置</button><p class="footnote">已完成的课节会自动排除。</p></section>

    </main>
    <button class="tutor-entry secondary" @click="tutor?.open()">小包子助教</button>
    <AiTutor ref="tutor" :plan-context="planContext" @proposal="receiveProposal" />
  </div>
</template>

<style scoped>
.date-editor{padding:18px 0;border-bottom:1px solid #edf0f6;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.date-editor input{font:inherit;padding:9px;border:1px solid #dfe5f0;border-radius:8px;max-width:160px}.slot-editor{display:flex;gap:10px;align-items:center;flex-basis:100%;flex-wrap:wrap}
.duration-label{display:block;margin-top:24px;font-size:14px;font-weight:600}.duration-input{display:flex;align-items:center;gap:10px;margin-top:12px}.duration-input input{width:140px;padding:12px;border:1px solid #dfe5f0;border-radius:10px;font:inherit;color:inherit}.duration-input span{font-size:13px;color:#7381a3}
.time-settings{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:0 20px 16px;font-size:12px;color:#75819a}.time-settings label{display:flex;align-items:center;gap:8px;color:#435272}.time-settings select{font:inherit;border:1px solid #dfe4f0;border-radius:7px;padding:7px;background:white;color:#435272}.time-settings button{margin-left:auto;color:#6475ba;padding:7px}.time-scroll{max-height:690px;overflow:auto;border-top:1px solid #edf0f6;scrollbar-gutter:stable}.time-sheet{min-width:910px}.time-head{display:grid;grid-template-columns:70px repeat(7,minmax(0,1fr));position:sticky;top:0;background:white;z-index:4;border-bottom:1px solid #e8ecf4}.time-head>button{padding:12px 6px;color:#8a92a7;font-size:12px;border-right:1px solid #f0f2f7;background:white}.time-head strong{font-size:16px;margin-right:5px;color:#485675}.time-head small{display:block;margin-top:5px;font-size:10px}.time-head .active{background:#f0edfc;color:#715bcc}.time-head .is-today strong{color:#715bcc}.time-zone{align-self:center;text-align:center;color:#8b95aa;font-size:11px}.time-body{display:grid;grid-template-columns:70px repeat(7,minmax(0,1fr));position:relative}.time-axis{position:sticky;left:0;background:white;z-index:2}.time-axis>span{position:absolute;right:10px;font-size:9px;color:#a8afbd;transform:translateY(-50%);font-variant-numeric:tabular-nums}.time-axis>span:first-child{transform:none}.time-axis>span.hour{color:#6e7d97;font-size:11px}.time-column{position:relative;border-left:1px solid #edf0f6;background:repeating-linear-gradient(to bottom,#edf0f6 0px,#edf0f6 1px,transparent 1px,transparent 24px),repeating-linear-gradient(to bottom,#dbe1ed 0px,#dbe1ed 1px,transparent 1px,transparent 96px)}.time-column.selected-column{background-color:#faf9ff}.time-event{position:absolute;left:5px;right:5px;border-radius:7px;padding:7px 8px;display:flex;flex-direction:column;gap:2px;text-align:left;overflow:hidden;border-left:3px solid #7ab4ca;background:#d9eff6;color:#35647b}.time-event strong{font-size:12px;line-height:1.3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;width:100%;flex-shrink:0}.time-event small{font-size:11px;white-space:nowrap;font-variant-numeric:tabular-nums}.time-event.course-color-1{background:#f0e4f7;border-color:#b992cc;color:#77528b}.time-event.course-color-2{background:#f5edf0;border-color:#c7a6b3;color:#805b6b}.time-event:hover{filter:brightness(.97)}.time-end{font-size:11px;padding:5px 10px 10px;width:70px;text-align:right;color:#6e7d97;box-sizing:border-box}

.plan-summary{display:flex;align-items:center;gap:30px;margin-bottom:24px}.plan-summary>div:first-child{flex:1}.plan-summary h2{margin:0}.plan-summary strong{font-size:24px;color:#536bc4}.plan-summary p{margin:6px 0 0}.calendar-card,.day-detail{background:white;border:1px solid #e1e6f0;border-radius:18px;overflow:hidden}.calendar-toolbar{display:flex;align-items:center;justify-content:space-between;padding:20px;gap:16px;flex-wrap:wrap}.calendar-toolbar h2{font-size:18px;margin:0}.calendar-controls{display:flex;gap:6px}.calendar-controls button{padding:8px 12px;border-radius:8px;background:#f2f4fa}.calendar-controls [aria-pressed=true]{background:#6275d7;color:white}.calendar-scroll{overflow-x:auto}.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));min-width:630px}.weekday{padding:12px;text-align:center;background:#f7f8fc;color:#6c7892;font-size:13px}.calendar-day{display:flex;flex-direction:column;gap:8px;min-height:130px;padding:12px;text-align:left;border-top:1px solid #edf0f6;border-right:1px solid #edf0f6;overflow:hidden;background:white}.week .calendar-day{min-height:230px}.calendar-day.chosen{background:#f0f3ff;box-shadow:inset 0 0 0 2px #7385d6}.calendar-day.today .day-number{color:#536bc4;font-weight:700}.calendar-day.outside{opacity:.5}.day-number{display:flex;justify-content:space-between}.day-number small,.day-duration{font-size:11px}.day-duration{color:#6678b7}.day-duration small{color:#a16c36}.calendar-task{font-size:12px;line-height:1.5;background:#edf0fa;color:#435984;border-radius:5px;padding:6px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.day-detail{margin-top:20px;padding:22px}.day-detail h2{font-size:18px;margin:0}.tutor-entry{position:fixed;bottom:24px;right:24px;box-shadow:0 4px 20px #23325320;z-index:10}@media(max-width:650px){.plan-summary{flex-wrap:wrap;gap:12px}.plan-summary>div:first-child{flex-basis:100%}.calendar-toolbar{padding:15px}.day-detail{padding:16px}}

.plan-page{height:100dvh;overflow:auto;background:radial-gradient(ellipse at 85% 5%,#eaeaff80,transparent 45%),#f7f9fe;color:#233253}.plan-header{height:var(--app-header-height);display:flex;align-items:center;justify-content:space-between;padding:0 5%;border-bottom:1px solid #e5eaf4;background:#ffffffb0}.plan-brand{font-size:23px;font-weight:750;color:#5067bc;text-decoration:none}.plan-header nav{display:flex;gap:34px}.plan-header nav a{color:#7a869e;text-decoration:none}.plan-header nav span{color:#536bc4}.plan-main{max-width:1180px;margin:auto;padding:44px 28px}.page-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:30px}.eyebrow{font-size:11px;font-weight:750;letter-spacing:2px;color:#7e86b1}.page-heading h1{font-size:30px;letter-spacing:-1px;margin:0}.muted{color:#7b869c;line-height:1.9}.primary,.secondary{border-radius:12px;padding:13px 23px;font-weight:600}.primary{background:#6275d7;color:white;box-shadow:0 7px 18px #6275d72b}.secondary{background:#eef1fc;color:#5e70b6;border:1px solid #dce3f6}button:disabled{opacity:.5;cursor:wait}button:focus-visible,a:focus-visible{outline:3px solid #8599ec;outline-offset:4px}.empty-state,.creator,.today-card,.rhythm-card,.schedule-card{background:#fff;border:1px solid #e5eaf5;border-radius:22px}.empty-state{text-align:center;padding:55px 25px}.empty-state h2{font-size:28px}.empty-state .primary{margin:20px 0 7px}.empty-art{display:flex;align-items:center;justify-content:center;gap:40px;color:#a5a5e6;font-size:35px;margin-bottom:30px}.empty-art span{font-size:95px;color:#7d8ddc;text-shadow:0 12px 30px #a8b1ed70}.footnote{font-size:12px;line-height:1.8;color:#8b95aa}.creator{padding:30px 40px}.creator-top,.card-heading{display:flex;align-items:center;justify-content:space-between;gap:15px}.creator-top button{color:#8892a8}.steps{display:flex;list-style:none;padding:0;margin:30px 0 38px;gap:20px}.steps li{flex:1;display:flex;align-items:center;gap:10px;color:#a1a8b9;font-size:13px}.steps li span{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#f0f2f8}.steps .current{color:#6275d7;font-weight:700}.steps .current span,.steps .passed span{color:white;background:#7383d4}h2{font-size:23px;margin:15px 0}h3{font-size:14px;margin-top:27px}.goal-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin:30px 0}.choice{text-align:left;border:1px solid #e0e5ef;border-radius:15px;padding:22px;display:flex;flex-direction:column;gap:9px;background:#fff}.choice i{font-style:normal;font-size:24px;color:#7b88ce}.choice strong{font-size:16px}.choice small{color:#8b95aa}.selected{border-color:#7e8de0!important;background:#f0f2ff!important;color:#5268bc!important;box-shadow:0 0 0 1px #7e8de020}.level-list{display:grid;gap:12px;margin-top:25px}.creator-actions{display:flex;justify-content:space-between;border-top:1px solid #edf0f6;padding-top:25px;margin-top:30px}.options{display:flex;gap:12px;flex-wrap:wrap}.options button{border:1px solid #dfe5f0;padding:14px 23px;border-radius:11px}.time-summary{background:#f7f8fd;padding:18px;color:#6c7caf;border-radius:12px;margin-top:28px}.preview-stats{display:flex;gap:50px;background:#f6f7fe;padding:26px;border-radius:16px;margin:25px 0}.preview-stats div{display:flex;flex-direction:column;gap:9px}.preview-stats strong{font-size:21px;color:#5d6fc5}.preview-stats span{color:#8993a9;font-size:12px}.preview-route{display:flex;flex-direction:column;gap:17px;padding:10px}.preview-route small{color:#8a94ab}.plan-banner{display:flex;align-items:center;justify-content:space-between;background:linear-gradient(110deg,#edf0ff,#eff6ff 65%,#ebf7f4);border:1px solid #e1e6f8;border-radius:22px;padding:30px 38px;margin-bottom:24px}.plan-banner h2{font-size:29px;margin:0 0 12px}.plan-banner p{color:#7383a4}.pill{font-size:11px;color:#7182be;background:#ffffffa8;padding:7px 12px;border-radius:20px}.progress-ring{width:126px;height:126px;border-radius:50%;background:conic-gradient(#7e91d9 var(--progress),#dfe7f4 0);padding:8px;flex-shrink:0}.progress-ring>div{width:100%;height:100%;border-radius:50%;background:#f0f6fb;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:5px}.progress-ring strong{font-size:30px}.progress-ring small{font-size:14px}.progress-ring span{font-size:11px;color:#8994ad}.dashboard{display:grid;grid-template-columns:1.7fr 1fr;gap:24px}.today-card,.rhythm-card{padding:27px}.task-row{display:flex;align-items:center;gap:13px;padding:20px 0;border-bottom:1px solid #edf0f6}.task-row>div{flex:1}.task-row strong{font-size:14px;line-height:1.6}.task-row small{display:block;color:#9099ae;font-size:11px;margin-top:7px}.task-row a,.route-list a{font-size:12px;white-space:nowrap;color:#657bc8;text-decoration:none}.task-dot{font-size:24px;color:#adb9db}.day-dots{display:flex;gap:8px;margin:28px 0}.day-dots span{display:grid;place-items:center;background:#f2f4f9;border-radius:50%;width:31px;height:31px;color:#a2abc0}.day-dots .active{color:#667cc3;background:#e9edff}.rhythm-card>p{font-size:13px;color:#7f8ba5}.schedule-card{margin-top:24px;padding:25px 30px}.schedule-card h2{font-size:18px}.tabs{display:flex;background:#f4f6fb;border-radius:10px;padding:4px}.tabs button{padding:8px 16px;font-size:12px;color:#8b94a9;border-radius:7px}.tabs .active{background:white;color:#6478bd;box-shadow:0 2px 5px #243d7c0a}.schedule-row{display:grid;grid-template-columns:175px 1fr;gap:20px;padding:22px 0;border-top:1px solid #edf0f7}.schedule-row>strong{font-size:13px;color:#7381a3;padding-top:7px}.schedule-row>strong small{display:block;color:#b49572;margin-top:5px}.schedule-row a{display:block;color:#475a80;text-decoration:none;padding:8px 0}.schedule-row a span{float:right;color:#939fb7;font-size:12px}.route-list>div{display:flex;align-items:center;gap:22px;border-top:1px solid #edf0f7;padding:18px 0}.route-list>div>div{flex:1}.route-list h3{margin:0}.route-list p{margin-bottom:0;font-size:12px}.stage-number{font-size:23px;color:#9ba8d5}.message{padding:15px 20px;border-radius:12px;background:#fff4df;color:#94794b}.error{background:#fff0ed;color:#b76352}.message button{text-decoration:underline}footer{text-align:center;color:#a2abc0;font-size:12px;padding:30px 0 0}@media(max-width:800px){.agent-form{flex-direction:column;align-items:stretch}.plan-agent{padding:22px}.dashboard{grid-template-columns:1fr}.plan-main{padding:25px 18px}.page-heading{align-items:flex-start;gap:15px}.page-heading h1{font-size:23px}.creator{padding:22px}.steps{gap:8px}.steps li{font-size:11px;gap:5px}.goal-grid{grid-template-columns:1fr}.preview-stats{gap:20px;flex-wrap:wrap}.plan-banner{padding:25px;gap:15px}.plan-banner h2{font-size:23px}.schedule-row{grid-template-columns:1fr;gap:5px}.options button{padding:12px 15px}}

/* Keep the time grid quiet; course blocks carry the visual emphasis. */
.plan-main{max-width:1380px;padding-top:24px}
.page-heading{margin-bottom:18px}.page-heading h1{font-size:25px}
.plan-summary{margin-bottom:18px}.plan-summary h2{font-size:19px}.plan-summary p{font-size:12px}
.calendar-card{border:0;box-shadow:0 4px 28px #283b5c06}
.time-scroll{max-height:clamp(420px,68vh,780px);border-top:0}
.time-head{border-bottom:0;padding-bottom:8px}
.time-head>button{border:0;margin:4px 12px;border-radius:9px;font-size:13px}
.time-head strong{font-size:20px}.time-head small{font-size:11px}
.time-head .active{background:#7563cf;color:white}.time-head .active strong{color:white}
.time-head .active small{color:#eee9ff}
.time-column{border:0;background:repeating-linear-gradient(to bottom,#f5f6f9 0px,#f5f6f9 1px,transparent 1px,transparent 96px)}
.time-column.selected-column{background-color:transparent}
.time-axis>span{font-size:10px;color:#c0c6d1}.time-axis>span.hour{font-size:12px;color:#8591a5}
.time-event{left:9px;right:9px;border:0;border-radius:10px;background:#d4edf4;color:#285e76;padding:10px 11px;gap:5px;box-shadow:0 3px 8px #285e7609;transition:filter .15s,box-shadow .15s}
.time-event strong{font-size:13px;line-height:1.4;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.time-event small{font-size:11px}
.time-event:hover{box-shadow:0 3px 12px #285e7625;filter:brightness(.98)}
.time-event.compact{padding:2px 7px;gap:0;border-radius:5px}
.time-event.compact strong{font-size:11px;white-space:nowrap;display:block}
.time-event.compact small{display:none}
.detail-backdrop{position:fixed;inset:0;background:#23325330;z-index:30;display:flex;justify-content:flex-end}
.detail-backdrop .day-detail{margin:0;width:min(460px,100%);box-sizing:border-box;height:100%;overflow:auto;border:0;border-radius:20px 0 0 20px;padding:28px;box-shadow:-10px 0 40px #23325312}
.day-detail .card-heading{flex-wrap:wrap}.day-detail .card-heading>.muted{flex-basis:100%;font-size:12px}.day-detail .card-heading button{color:#67758e}
@media(max-width:650px){.time-head>button{margin:4px 8px}.calendar-toolbar{gap:10px}.plan-main{padding-top:20px}.time-settings{gap:8px}}

.plan-main{max-width:1800px;padding:24px 28px}.calendar-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:24px;align-items:start}.calendar-layout>.calendar-card{min-width:0}.plan-sidebar{display:flex;flex-direction:column;gap:20px}.sidebar-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.sidebar-heading h1{font-size:23px;margin:0}.sidebar-heading button{padding:9px 14px}.plan-sidebar .plan-summary{display:flex;flex-wrap:wrap;gap:12px;margin:0;padding:18px;background:#fff;border-radius:16px}.plan-sidebar .plan-summary>div:first-child{flex-basis:100%}.plan-sidebar .plan-summary>button{margin-left:auto;padding:8px 12px}.plan-sidebar .plan-summary strong{font-size:20px}.mini-calendar{padding:18px;background:white;border-radius:16px}.month-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:16px}.month-toolbar h2{margin:0 auto 0 0;font-size:16px}.month-toolbar button{font-size:24px;width:28px;height:32px;border-radius:8px;background:#f5f6fa}.month-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center}.month-weekday{font-size:11px;color:#929caf;padding-bottom:8px}.month-grid button{position:relative;aspect-ratio:1;border-radius:10px;font-size:12px}.month-grid button:hover{background:#f0edfc}.month-grid .outside{color:#bcc2cf}.month-grid .today{box-shadow:inset 0 0 0 1px #8876d8}.month-grid .chosen{background:#7563cf;color:white}.month-grid i{position:absolute;width:4px;height:4px;background:currentColor;border-radius:50%;bottom:4px;left:calc(50% - 2px)}.plan-sidebar .day-detail{margin:0;padding:20px;border:0}.day-detail>h2{font-size:17px}.day-detail>p{font-size:12px}.plan-sidebar .task-row{flex-wrap:wrap;padding:15px 0;gap:9px}.plan-sidebar .task-row>div{flex-basis:100%}.resume-course{display:inline-block;font-size:13px;color:#657bc8;margin-top:10px}.time-sheet{min-width:760px}.time-head>button{margin:4px 5px}.time-scroll{max-height:calc(100dvh - 230px);min-height:380px}.calendar-toolbar h2{font-size:17px}
@media(max-width:1100px){.calendar-layout{grid-template-columns:minmax(0,1fr) 280px;gap:16px}.plan-main{padding:20px 16px}}@media(max-width:800px){.calendar-layout{display:flex;flex-direction:column}.calendar-layout>.calendar-card,.plan-sidebar{width:100%}.plan-sidebar{display:grid;grid-template-columns:1fr 1fr}.sidebar-heading,.plan-sidebar .plan-summary{grid-column:1/-1}.time-scroll{max-height:60dvh}}@media(max-width:480px){.plan-sidebar{display:flex}.calendar-toolbar h2{font-size:14px}}
</style>

