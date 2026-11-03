<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import { auth } from '../auth';
import { aiErrorText } from '../ai';
import type { LearningModule } from '../data/learning';
import { dateKey, moduleOrder, schedulePlan, type PlanLesson, type Preferences, type SavedPlan } from '../learning-plan';

type Point = { sections: { id: number; title: string; nodeType: string; estimatedMinutes: number | null }[] };
type Progress = { sections: { sectionId: number; status: string }[] };
const goals = [{ id: 'agent', title: '掌握 Agent', text: '理解工具调用，走进智能体开发', icon: '✦' }, { id: 'app', title: '开发 AI 应用', text: '从模型调用到完整应用', icon: '⌘' }, { id: 'rag', title: '构建知识库', text: '学习检索与增强生成', icon: '▤' }, { id: 'foundation', title: '建立 AI 基础', text: '从原理开始，循序渐进', icon: '◎' }];
const week = ['日', '一', '二', '三', '四', '五', '六'];
const preferences = ref<Preferences>({ goal: 'agent', level: 'beginner', minutes: 30, days: [1, 3, 5, 6] });
const saved = ref<SavedPlan | null>(null);
const lessons = ref<PlanLesson[]>([]);
const loading = ref(false);
const error = ref('');
const storageNotice = ref('');
const editing = ref(false);
const step = ref(0);
const tab = ref('week');
const aiInput = ref('');
const aiBusy = ref(false);
const aiReply = ref('');
const aiFailure = ref('');
async function askPlanAgent() {
  if (aiBusy.value || loading.value || !aiInput.value.trim()) return;
  aiBusy.value = true; aiFailure.value = ''; aiReply.value = '';
  try {
    const result = await api<{ message: string; proposal: Preferences | null }>('/ai/plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: aiInput.value.trim(), current: effective.value }),
    });
    aiReply.value = result.message;
    if (result.proposal) {
      preferences.value = result.proposal; editing.value = true;
      await loadLessons();
      if (!error.value) step.value = 3;
      else step.value = 2;
    }
  } catch (failure) { aiFailure.value = aiErrorText(failure); }
  finally { aiBusy.value = false; }
}
const key = `learnai:plan:v1:${auth.user!.id}`;
const today = dateKey(new Date());
const effective = computed(() => editing.value ? preferences.value : saved.value?.preferences ?? preferences.value);
const goal = computed(() => goals.find(item => item.id === effective.value.goal)!);
const tasks = computed(() => schedulePlan(lessons.value, effective.value, editing.value ? today : saved.value?.started ?? today));
const firstDate = computed(() => tasks.value[0]?.date);
const nextTasks = computed(() => tasks.value.filter(task => task.date === firstDate.value));
const dates = computed(() => [...new Set(tasks.value.map(task => task.date))].slice(0, 7));
const modules = computed(() => [...new Set(lessons.value.map(lesson => lesson.slug))].map(slug => ({ slug, title: lessons.value.find(item => item.slug === slug)!.module, all: lessons.value.filter(item => item.slug === slug) })));
const completed = computed(() => lessons.value.filter(item => item.completed).length);
const percent = computed(() => lessons.value.length ? Math.round(completed.value / lessons.value.length * 100) : 0);
const finish = computed(() => tasks.value.at(-1)?.date);
function pretty(value: string | undefined) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }) : '已完成'; }
function toggleDay(day: number) { preferences.value.days = preferences.value.days.includes(day) ? preferences.value.days.filter(item => item !== day) : [...preferences.value.days, day]; }
function create() { preferences.value = saved.value ? JSON.parse(JSON.stringify(saved.value.preferences)) : { goal: 'agent', level: 'beginner', minutes: 30, days: [1, 3, 5, 6] }; editing.value = true; step.value = 0; error.value = ''; }
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
async function preview() { await loadLessons(); if (!error.value) step.value = 3; }
async function cancel() { editing.value = false; error.value = ''; if (saved.value) await loadLessons(); }
function activate() {
  const plan: SavedPlan = { version: 1, preferences: JSON.parse(JSON.stringify(preferences.value)), started: today };
  try { localStorage.setItem(key, JSON.stringify(plan)); storageNotice.value = ''; }
  catch { storageNotice.value = '浏览器未能保存计划，本次可使用，刷新后可能丢失。'; }
  saved.value = plan; editing.value = false;
}
onMounted(async () => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value?.version === 1 && goals.some(item => item.id === value.preferences?.goal) && ['beginner', 'familiar', 'experienced'].includes(value.preferences?.level) && [15, 30, 45, 60].includes(value.preferences?.minutes) && Array.isArray(value.preferences?.days) && value.preferences.days.length && value.preferences.days.every((day: number) => Number.isInteger(day) && day >= 0 && day <= 6) && /^\d{4}-\d{2}-\d{2}$/.test(value.started)) saved.value = value;
  } catch { storageNotice.value = '本地计划无法读取，请重新创建。'; }
  if (saved.value) await loadLessons();
});
</script>

<template>
  <div class="plan-page">
    <header class="plan-header"><RouterLink to="/" class="plan-brand">✦ LearnAI</RouterLink><nav><RouterLink to="/">知识宇宙</RouterLink><span>学习计划</span></nav><span>{{ auth.user?.displayName }}</span></header>
    <main class="plan-main">
      <div class="page-heading"><div><p class="eyebrow">MY LEARNING JOURNEY</p><h1>把想学，变成每天的一小步。</h1><p class="muted">按你的目标与节奏，走出自己的学习路线。</p></div><button v-if="saved && !editing" class="secondary" @click="create">调整学习计划 ↗</button></div>
      <p v-if="storageNotice" class="message" role="status">{{ storageNotice }}</p>
      <section class="plan-agent" aria-label="小包子计划 Agent">
        <div><span class="eyebrow">✧ 小包子 · 计划 AGENT</span><h2>计划，交给我一起想。</h2><p class="muted">告诉我你想怎么学，我会结合当前设置和真实进度，调用工具生成调整预览。</p></div>
        <div class="agent-examples"><button v-for="text in ['我想学 Agent，没有编程基础，每周一三五各学30分钟', '改成只在周末学，每次45分钟，其他不变', '我想把学习目标改成构建知识库']" :key="text" :disabled="aiBusy || loading" @click="aiInput = text">{{ text }}</button></div>
        <form class="agent-form" @submit.prevent="askPlanAgent"><label class="sr-label" for="plan-request">学习计划需求</label><textarea id="plan-request" v-model="aiInput" rows="2" maxlength="1000" :disabled="aiBusy" placeholder="例如：工作日太忙，帮我改成周六、周日各学 45 分钟…"></textarea><button class="primary" :disabled="aiBusy || loading || !aiInput.trim()">{{ aiBusy ? '正在分析与调用工具…' : '让小包子安排 ↗' }}</button></form>
        <p v-if="aiReply" class="agent-reply" role="status">{{ aiReply }}</p><p v-if="aiFailure" class="message error" role="alert">{{ aiFailure }}</p><p class="footnote">AI 调整先生成预览；点击「应用新安排 / 开始这个计划」后才保存。也可以使用下方手动创建。</p>
      </section>
      <div v-if="error" class="message error" role="alert">{{ error }} <button @click="step === 2 ? preview() : loadLessons()">重试</button></div>
      <section v-if="editing" class="creator">
        <div class="creator-top"><span class="eyebrow">✧ 和小包子一起规划</span><button @click="cancel">取消</button></div>
        <ol class="steps"><li v-for="(label, index) in ['学习目标', '当前基础', '时间安排', '计划预览']" :key="label" :class="{ current: step === index, passed: step > index }"><span>{{ index + 1 }}</span>{{ label }}</li></ol>
        <template v-if="step === 0"><h2>这段旅程，你想收获什么？</h2><p class="muted">先选一个目标，我们会匹配现有课程。</p><div class="goal-grid"><button v-for="item in goals" :key="item.id" class="choice" :class="{ selected: preferences.goal === item.id }" :aria-pressed="preferences.goal === item.id" @click="preferences.goal = item.id"><i>{{ item.icon }}</i><strong>{{ item.title }}</strong><small>{{ item.text }}</small></button></div></template>
        <template v-if="step === 1"><h2>从适合你的起点出发。</h2><p class="muted">选择最接近当前情况的一项，已完成课节会自动排除。</p><div class="level-list"><button v-for="item in [{ id: 'beginner', title: '刚刚起步', text: '编程经验较少，需要先学习工程基础' }, { id: 'familiar', title: '有编程基础', text: '能读写简单代码，从模型应用开始' }, { id: 'experienced', title: '有 AI 使用或开发经验', text: '沿目标课程查漏补缺，接续未完成内容' }]" :key="item.id" class="choice" :class="{ selected: preferences.level === item.id }" :aria-pressed="preferences.level === item.id" @click="preferences.level = item.id"><strong>{{ item.title }}</strong><small>{{ item.text }}</small></button></div><p class="footnote">本版根据自评安排起点，尚未接入能力诊断；已读状态不代表能力评定。</p></template>
        <template v-if="step === 2"><h2>给学习留一点刚刚好的时间。</h2><p class="muted">按你的真实生活安排。长课节会拆成多次阅读，不挤占每日预算。</p><h3>每个学习日，我可以投入</h3><div class="options"><button v-for="minutes in [15, 30, 45, 60]" :key="minutes" :class="{ selected: preferences.minutes === minutes }" :aria-pressed="preferences.minutes === minutes" @click="preferences.minutes = minutes">{{ minutes }} 分钟</button></div><h3>这些日子适合学习</h3><div class="options"><button v-for="day in [1, 2, 3, 4, 5, 6, 0]" :key="day" :class="{ selected: preferences.days.includes(day) }" :aria-pressed="preferences.days.includes(day)" @click="toggleDay(day)">周{{ week[day] }}</button></div><p class="time-summary">每周 {{ preferences.days.length }} 天 · 共 {{ preferences.days.length * preferences.minutes }} 分钟</p></template>
        <template v-if="step === 3"><h2>你的「{{ goal.title }}」路线已准备好。</h2><p class="muted">根据现有课程、你的基础和真实进度生成，确认后开始。</p><div class="preview-stats"><div><strong>{{ lessons.length - completed }}</strong><span>待学课节</span></div><div><strong>{{ preferences.minutes }} 分钟</strong><span>每个学习日</span></div><div><strong>{{ pretty(finish) }}</strong><span>预计完成 · 可调整</span></div></div><div class="preview-route"><span v-for="(module, index) in modules" :key="module.slug">{{ index + 1 }}. {{ module.title }} <small> / {{ module.all.length }} 节</small></span></div><p class="footnote">已排除 {{ completed }} 节已完成内容。时长来自课程估计，缺少时长的课节按 20 分钟安排。时间不足时会拆分阅读；实际完成以课程页记录为准。</p></template>
        <div class="creator-actions"><button v-if="step > 0" class="secondary" :disabled="loading" @click="step--">上一步</button><span v-else></span><button v-if="step < 2" class="primary" @click="step++">下一步 →</button><button v-else-if="step === 2" class="primary" :disabled="!preferences.days.length || loading" @click="preview">{{ loading ? '正在读取课程与进度…' : '生成我的计划 ✦' }}</button><button v-else class="primary" @click="activate">{{ saved ? '应用新安排' : '开始这个计划' }} →</button></div>
      </section>
      <template v-else-if="saved">
        <div v-if="loading" class="empty-state" role="status">正在同步课程进度…</div>
        <template v-else-if="!error">
          <section class="plan-banner"><div><span class="pill">属于你的成长路线</span><h2>{{ goal.title }}，从今天开始。</h2><p>每周 {{ effective.days.length }} 天 · 每次 {{ effective.minutes }} 分钟 · 预计 {{ pretty(finish) }}完成</p><span class="footnote">漏学内容保留原安排，可通过“调整学习计划”从今天重新排期。</span></div><div class="progress-ring" :style="{ '--progress': percent + '%' }"><div><strong>{{ percent }}<small>%</small></strong><span>课程完成度</span></div></div></section>
          <div class="dashboard"><section class="today-card"><div class="card-heading"><span class="eyebrow">YOUR NEXT STEP</span><span class="pill">{{ firstDate && firstDate < today ? '待补学' : firstDate === today ? '今日任务' : '下次学习' }}</span></div><h2>{{ tasks.length ? '每一次开始，都算数。' : '这段旅程，已经完成！' }}</h2><p class="muted">{{ pretty(firstDate) }}<template v-if="tasks.length"> · 预计 {{ nextTasks.reduce((sum, task) => sum + task.duration, 0) }} 分钟</template></p><div v-for="task in nextTasks" :key="`${task.slug}-${task.id}-${task.part}`" class="task-row"><span class="task-dot">○</span><div><strong>{{ task.title }}</strong><small>{{ task.module }} · {{ task.duration }} 分钟 <template v-if="task.parts > 1">· 分段阅读 {{ task.part }}/{{ task.parts }}</template></small></div><RouterLink :to="{ path: `/knowledge/${task.slug}`, query: { section: task.id } }">去学习 ↗</RouterLink></div><p class="footnote">在课程页标记完成后，返回此页即可同步。分段阅读需自行接续阅读位置。</p></section><aside class="rhythm-card"><span class="eyebrow">YOUR PACE</span><h2>稳定前进就很好。</h2><div class="day-dots"><span v-for="day in [1, 2, 3, 4, 5, 6, 0]" :key="day" :class="{ active: effective.days.includes(day) }">{{ week[day] }}</span></div><p>每周留给自己 <strong>{{ effective.days.length * effective.minutes }} 分钟</strong></p><p class="muted">已完成 {{ completed }} / {{ lessons.length }} 节课程</p><button class="secondary" @click="loadLessons">刷新学习进度</button><p class="footnote">计划保存在当前浏览器，仅当前账号可见。</p></aside></div>
          <section class="schedule-card"><div class="card-heading"><h2>一步一步，看见成长</h2><div class="tabs"><button :class="{ active: tab === 'week' }" @click="tab = 'week'">近期安排</button><button :class="{ active: tab === 'route' }" @click="tab = 'route'">阶段路线</button></div></div><div v-if="tab === 'week'" class="schedule-list"><div v-for="date in dates" :key="date" class="schedule-row"><strong>{{ pretty(date) }}<small v-if="date < today">待补学</small></strong><div><RouterLink v-for="task in tasks.filter(item => item.date === date)" :key="`${task.slug}-${task.id}-${task.part}`" :to="{ path: `/knowledge/${task.slug}`, query: { section: task.id } }">{{ task.title }} <small v-if="task.parts > 1">（{{ task.part }}/{{ task.parts }}）</small><span>{{ task.duration }} 分钟 ↗</span></RouterLink></div></div><p v-if="!tasks.length" class="muted">所有课节均已完成，可以调整目标开启下一段旅程。</p></div><div v-else class="route-list"><div v-for="(module, index) in modules" :key="module.slug"><span class="stage-number">{{ String(index + 1).padStart(2, '0') }}</span><div><h3>{{ module.title }}</h3><p class="muted">{{ module.all.filter(item => item.completed).length }} / {{ module.all.length }} 节已完成</p></div><RouterLink :to="`/knowledge/${module.slug}`">查看课程 ↗</RouterLink></div></div></section>
        </template>
      </template>
      <section v-else class="empty-state"><div class="empty-art">✦<span>◎</span>✧</div><span class="eyebrow">A LITTLE EVERY DAY</span><h2>下一站，成为更好的自己。</h2><p class="muted">不必一次学完所有内容。告诉我们你的目标、基础和时间，<br>让现有课程变成一条适合你的学习路线。</p><button class="primary" @click="create">✦ 创建我的学习计划</button><p class="footnote">3 个简单步骤 · 自动衔接已有学习进度</p></section>
      <footer>✧ 计划可以调整，每一步积累都值得被看见。</footer>
    </main>
  </div>
</template>

<style scoped>
.plan-agent{padding:25px 30px;border:1px solid #dddff5;border-radius:22px;background:linear-gradient(120deg,#fff,#f3f2ff);margin-bottom:24px}.plan-agent h2{font-size:21px}.agent-examples{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0}.agent-examples button{border:1px solid #e1e4f4;border-radius:20px;background:#fff;padding:8px 12px;color:#7380a7;font-size:12px}.agent-form{display:flex;align-items:center;gap:15px}.agent-form textarea{flex:1;min-width:0;border:1px solid #dce1f3;border-radius:12px;padding:14px;font:inherit;resize:vertical;background:#fff;color:#32446b}.agent-reply{white-space:pre-wrap;line-height:1.9;color:#576d9b;padding:15px 20px;border-radius:12px;background:#eef1ff}.sr-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.plan-page{height:100dvh;overflow:auto;background:radial-gradient(ellipse at 85% 5%,#eaeaff80,transparent 45%),#f7f9fe;color:#233253}.plan-header{height:76px;display:flex;align-items:center;justify-content:space-between;padding:0 5%;border-bottom:1px solid #e5eaf4;background:#ffffffb0}.plan-brand{font-size:23px;font-weight:750;color:#5067bc;text-decoration:none}.plan-header nav{display:flex;gap:34px}.plan-header nav a{color:#7a869e;text-decoration:none}.plan-header nav span{color:#536bc4}.plan-main{max-width:1180px;margin:auto;padding:44px 28px}.page-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:30px}.eyebrow{font-size:11px;font-weight:750;letter-spacing:2px;color:#7e86b1}.page-heading h1{font-size:30px;letter-spacing:-1px;margin:12px 0}.muted{color:#7b869c;line-height:1.9}.primary,.secondary{border-radius:12px;padding:13px 23px;font-weight:600}.primary{background:#6275d7;color:white;box-shadow:0 7px 18px #6275d72b}.secondary{background:#eef1fc;color:#5e70b6;border:1px solid #dce3f6}button:disabled{opacity:.5;cursor:wait}button:focus-visible,a:focus-visible{outline:3px solid #8599ec;outline-offset:4px}.empty-state,.creator,.today-card,.rhythm-card,.schedule-card{background:#fff;border:1px solid #e5eaf5;border-radius:22px}.empty-state{text-align:center;padding:55px 25px}.empty-state h2{font-size:28px}.empty-state .primary{margin:20px 0 7px}.empty-art{display:flex;align-items:center;justify-content:center;gap:40px;color:#a5a5e6;font-size:35px;margin-bottom:30px}.empty-art span{font-size:95px;color:#7d8ddc;text-shadow:0 12px 30px #a8b1ed70}.footnote{font-size:12px;line-height:1.8;color:#8b95aa}.creator{padding:30px 40px}.creator-top,.card-heading{display:flex;align-items:center;justify-content:space-between;gap:15px}.creator-top button{color:#8892a8}.steps{display:flex;list-style:none;padding:0;margin:30px 0 38px;gap:20px}.steps li{flex:1;display:flex;align-items:center;gap:10px;color:#a1a8b9;font-size:13px}.steps li span{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#f0f2f8}.steps .current{color:#6275d7;font-weight:700}.steps .current span,.steps .passed span{color:white;background:#7383d4}h2{font-size:23px;margin:15px 0}h3{font-size:14px;margin-top:27px}.goal-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin:30px 0}.choice{text-align:left;border:1px solid #e0e5ef;border-radius:15px;padding:22px;display:flex;flex-direction:column;gap:9px;background:#fff}.choice i{font-style:normal;font-size:24px;color:#7b88ce}.choice strong{font-size:16px}.choice small{color:#8b95aa}.selected{border-color:#7e8de0!important;background:#f0f2ff!important;color:#5268bc!important;box-shadow:0 0 0 1px #7e8de020}.level-list{display:grid;gap:12px;margin-top:25px}.creator-actions{display:flex;justify-content:space-between;border-top:1px solid #edf0f6;padding-top:25px;margin-top:30px}.options{display:flex;gap:12px;flex-wrap:wrap}.options button{border:1px solid #dfe5f0;padding:14px 23px;border-radius:11px}.time-summary{background:#f7f8fd;padding:18px;color:#6c7caf;border-radius:12px;margin-top:28px}.preview-stats{display:flex;gap:50px;background:#f6f7fe;padding:26px;border-radius:16px;margin:25px 0}.preview-stats div{display:flex;flex-direction:column;gap:9px}.preview-stats strong{font-size:21px;color:#5d6fc5}.preview-stats span{color:#8993a9;font-size:12px}.preview-route{display:flex;flex-direction:column;gap:17px;padding:10px}.preview-route small{color:#8a94ab}.plan-banner{display:flex;align-items:center;justify-content:space-between;background:linear-gradient(110deg,#edf0ff,#eff6ff 65%,#ebf7f4);border:1px solid #e1e6f8;border-radius:22px;padding:30px 38px;margin-bottom:24px}.plan-banner h2{font-size:29px;margin:20px 0 15px}.plan-banner p{color:#7383a4}.pill{font-size:11px;color:#7182be;background:#ffffffa8;padding:7px 12px;border-radius:20px}.progress-ring{width:126px;height:126px;border-radius:50%;background:conic-gradient(#7e91d9 var(--progress),#dfe7f4 0);padding:8px;flex-shrink:0}.progress-ring>div{width:100%;height:100%;border-radius:50%;background:#f0f6fb;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:5px}.progress-ring strong{font-size:30px}.progress-ring small{font-size:14px}.progress-ring span{font-size:11px;color:#8994ad}.dashboard{display:grid;grid-template-columns:1.7fr 1fr;gap:24px}.today-card,.rhythm-card{padding:27px}.task-row{display:flex;align-items:center;gap:13px;padding:20px 0;border-bottom:1px solid #edf0f6}.task-row>div{flex:1}.task-row strong{font-size:14px;line-height:1.6}.task-row small{display:block;color:#9099ae;font-size:11px;margin-top:7px}.task-row a,.route-list a{font-size:12px;white-space:nowrap;color:#657bc8;text-decoration:none}.task-dot{font-size:24px;color:#adb9db}.day-dots{display:flex;gap:8px;margin:28px 0}.day-dots span{display:grid;place-items:center;background:#f2f4f9;border-radius:50%;width:31px;height:31px;color:#a2abc0}.day-dots .active{color:#667cc3;background:#e9edff}.rhythm-card>p{font-size:13px;color:#7f8ba5}.schedule-card{margin-top:24px;padding:25px 30px}.schedule-card h2{font-size:18px}.tabs{display:flex;background:#f4f6fb;border-radius:10px;padding:4px}.tabs button{padding:8px 16px;font-size:12px;color:#8b94a9;border-radius:7px}.tabs .active{background:white;color:#6478bd;box-shadow:0 2px 5px #243d7c0a}.schedule-row{display:grid;grid-template-columns:175px 1fr;gap:20px;padding:22px 0;border-top:1px solid #edf0f7}.schedule-row>strong{font-size:13px;color:#7381a3;padding-top:7px}.schedule-row>strong small{display:block;color:#b49572;margin-top:5px}.schedule-row a{display:block;color:#475a80;text-decoration:none;padding:8px 0}.schedule-row a span{float:right;color:#939fb7;font-size:12px}.route-list>div{display:flex;align-items:center;gap:22px;border-top:1px solid #edf0f7;padding:18px 0}.route-list>div>div{flex:1}.route-list h3{margin:0}.route-list p{margin-bottom:0;font-size:12px}.stage-number{font-size:23px;color:#9ba8d5}.message{padding:15px 20px;border-radius:12px;background:#fff4df;color:#94794b}.error{background:#fff0ed;color:#b76352}.message button{text-decoration:underline}footer{text-align:center;color:#a2abc0;font-size:12px;padding:30px 0 0}@media(max-width:800px){.dashboard{grid-template-columns:1fr}.plan-main{padding:25px 18px}.page-heading{align-items:flex-start;gap:15px}.page-heading h1{font-size:23px}.creator{padding:22px}.steps{gap:8px}.steps li{font-size:11px;gap:5px}.goal-grid{grid-template-columns:1fr}.preview-stats{gap:20px;flex-wrap:wrap}.plan-banner{padding:25px;gap:15px}.plan-banner h2{font-size:23px}.schedule-row{grid-template-columns:1fr;gap:5px}.options button{padding:12px 15px}}
</style>

