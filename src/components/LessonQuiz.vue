<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
type Question = { id: string; text: string; options: string[] };
type Quiz = { version: number; passScore: number; questions: Question[] };
type Review = { questionId: string; question: string; options: string[]; selectedOption: number; correctOption: number; correct: boolean; explanation: string };
type Attempt = { id: number; score: number; total: number; passed: boolean; submittedAt: string; answers: Review[] };
const props = defineProps<{ slug: string; sectionId: number }>();
const emit = defineEmits<{ passed: [] }>();
const quiz = ref<Quiz>();
const history = ref<Attempt[]>([]);
const answers = ref<Record<string, number>>({});
const result = ref<Attempt>();
const error = ref('');
const loading = ref(true);
const submitting = ref(false);
const started = ref(false);
const ready = computed(() => quiz.value?.questions.every(q => answers.value[q.id] !== undefined));
const base = `/learning/quizzes/${encodeURIComponent(props.slug)}/sections/${props.sectionId}`;
async function load() {
  loading.value = true; error.value = '';
  try {
    const [definition, attempts] = await Promise.all([api<Quiz>(base), api<Attempt[]>(`${base}/attempts`)]);
    quiz.value = definition; history.value = attempts;
  } catch { error.value = '测验加载失败，请重试。'; }
  finally { loading.value = false; }
}
function start() { answers.value = {}; result.value = undefined; error.value = ''; started.value = true; }
async function submit() {
  if (!quiz.value || !ready.value || submitting.value) return;
  submitting.value = true; error.value = '';
  try {
    const attempt = await api<Attempt>(`${base}/attempts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: quiz.value.version, answers: answers.value }) });
    result.value = attempt; history.value.unshift(attempt); started.value = false;
    if (attempt.passed) emit('passed');
  } catch { error.value = '提交未确认，请重新加载查看记录后再决定是否重试。'; }
  finally { submitting.value = false; }
}
onMounted(load);
</script>

<template>
  <section class="lesson-quiz" aria-label="本节测验">
    <h3>本节测验</h3>
    <p>3 道单选题，答对至少 2 道即通过。每次提交都会保存，可回看答案与解析。</p>
    <p v-if="loading" role="status">正在加载测验…</p>
    <div v-if="error" role="alert">{{ error }} <button :disabled="loading || submitting" @click="load">重新加载</button></div>
    <template v-if="quiz && !loading">
      <button v-if="!started" class="quiz-button" @click="start">{{ history.length ? '重新测验' : '开始本节测验' }}</button>
      <form v-if="started" @submit.prevent="submit">
        <fieldset v-for="(question, index) in quiz.questions" :key="question.id" :disabled="submitting">
          <legend>{{ index + 1 }}. {{ question.text }}</legend>
          <label v-for="(option, optionIndex) in question.options" :key="optionIndex"><input v-model="answers[question.id]" type="radio" :name="question.id" :value="optionIndex">{{ option }}</label>
        </fieldset>
        <button class="quiz-button" :disabled="!ready || submitting">{{ submitting ? '正在提交…' : '提交答案' }}</button>
      </form>
      <div v-if="result" class="quiz-result" role="status"><strong>{{ result.passed ? '测验通过' : '暂未通过，可回看正文后重试' }} · {{ result.score }} / {{ result.total }}</strong></div>
      <details v-for="attempt in history" :key="attempt.id" :open="result?.id === attempt.id">
        <summary>{{ attempt.passed ? '已通过' : '未通过' }} · {{ attempt.score }} / {{ attempt.total }} · {{ new Date(attempt.submittedAt).toLocaleString('zh-CN') }}</summary>
        <div v-for="answer in attempt.answers" :key="answer.questionId" class="quiz-review"><strong>{{ answer.correct ? '✓' : '✗' }} {{ answer.question }}</strong><p>你的答案：{{ answer.options[answer.selectedOption] }}</p><p>正确答案：{{ answer.options[answer.correctOption] }}</p><p>{{ answer.explanation }}</p></div>
      </details>
    </template>
  </section>
</template>

<style scoped>
.lesson-quiz { margin-top: 28px; padding: 22px; background: #f0f5ff; border: 1px solid #dce6fb; border-radius: 16px; font-size: 14px; line-height: 1.7; }
h3 { margin: 0 0 8px; color: #294777; }
fieldset { margin: 16px 0; padding: 16px; border: 1px solid #d5e0f2; border-radius: 12px; }
legend { font-weight: 600; }
label { display: flex; align-items: baseline; gap: 10px; padding: 7px 0; cursor: pointer; }
.quiz-button { padding: 10px 16px; background: #386cff; color: white; border-radius: 10px; }
button:disabled { opacity: .5; cursor: default; }
.quiz-result { margin: 18px 0; }
details { margin-top: 12px; padding: 12px; background: white; border-radius: 10px; }
summary { cursor: pointer; color: #46628e; }
.quiz-review { padding: 14px 0; border-bottom: 1px solid #edf1f7; }
.quiz-review p { margin: 5px 0; }
</style>
