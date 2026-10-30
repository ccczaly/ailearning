<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { AgentInteraction, AgentOutcome } from '../agent-interaction';
import { selectionCost } from '../agent-interaction';
import AgentCapabilityLab from './AgentCapabilityLab.vue';
import AgentWorkflowLab from './AgentWorkflowLab.vue';
import AgentIntroLab from './AgentIntroLab.vue';
import AgentReferenceLab from './AgentReferenceLab.vue';

const props = defineProps<{ interaction: AgentInteraction }>();
const position = ref(0);
const picked = ref<number | null>(null);
const selected = ref<number[]>([]);
const revealed = ref(false);
const prediction = ref('');
const cost = computed(() => props.interaction.kind === 'select' ? selectionCost(props.interaction.items, selected.value) : 0);
const currentStep = computed(() => props.interaction.kind === 'trace' ? props.interaction.steps[position.value] : undefined);
const outcome = computed<AgentOutcome | undefined>(() =>
  (props.interaction.kind === 'branch' || props.interaction.kind === 'compare') && picked.value !== null
    ? props.interaction.options[picked.value] : undefined);
function reset() {
  position.value = 0; picked.value = null; selected.value = []; revealed.value = false; prediction.value = '';
}
function toggle(index: number) {
  if (props.interaction.kind !== 'select') return;
  const item = props.interaction.items[index];
  if (!item || (!selected.value.includes(index) && cost.value + item.cost > props.interaction.capacity)) return;
  selected.value = selected.value.includes(index) ? selected.value.filter(i => i !== index) : [...selected.value, index];
  revealed.value = false;
}
watch(() => props.interaction, reset);
</script>

<template>
  <AgentIntroLab v-if="interaction.kind === 'intro-demo'" :key="interaction.title" :title="interaction.title" :prompt="interaction.prompt" />
  <AgentReferenceLab v-else-if="interaction.kind === 'reference-demo'" :key="interaction.demoId" :demo-id="interaction.demoId" :title="interaction.title" :prompt="interaction.prompt" />
  <AgentCapabilityLab v-else-if="interaction.kind === 'capability'" :lab="interaction" />
  <AgentWorkflowLab v-else-if="interaction.kind === 'workflow'" :key="interaction.title" :title="interaction.title" :prompt="interaction.prompt" />
  <div v-else class="agent-lab">
    <div class="lab-heading"><strong>{{ interaction.title }}</strong><span>预设教学案例 · 无真实模型调用</span></div>
    <p class="lab-prompt">{{ interaction.prompt }}</p>
    <label class="prediction">先写下你的预测与依据（可选，仅保留在当前页面）
      <textarea v-model="prediction" rows="2" placeholder="我预计下一步会……因为……"></textarea>
    </label>

    <template v-if="interaction.kind === 'trace'">
      <p>步骤 {{ position + 1 }} / {{ interaction.steps.length }} · {{ currentStep?.label }}</p>
      <div v-if="!revealed" class="lab-empty">先预测这一步的输入、动作和状态，再展开观察。</div>
      <dl v-else-if="currentStep" class="trace-fields" aria-live="polite">
        <dt>当前上下文／执行条件</dt><dd>{{ currentStep.context }}</dd>
        <dt>实际动作</dt><dd>{{ currentStep.action }}</dd>
        <dt>观察结果</dt><dd>{{ currentStep.observation }}</dd>
        <dt>任务状态</dt><dd><code>{{ currentStep.state }}</code></dd>
      </dl>
      <div class="lab-actions">
        <button :disabled="position === 0" @click="position--; revealed = false">← 上一步</button>
        <button v-if="!revealed" @click="revealed = true">展开本步</button>
        <button v-else :disabled="position === interaction.steps.length - 1" @click="position++; revealed = false">下一步 →</button>
      </div>
    </template>

    <template v-else-if="interaction.kind === 'select'">
      <fieldset>
        <legend>选择信息 · 已用 {{ cost }} / {{ interaction.capacity }} 单位</legend>
        <label v-for="(item, index) in interaction.items" :key="index" class="selection-item">
          <input type="checkbox" :checked="selected.includes(index)" :disabled="!selected.includes(index) && cost + item.cost > interaction.capacity" @change="toggle(index)">
          <span>{{ item.label }} <small>{{ item.cost }} 单位</small></span>
        </label>
      </fieldset>
      <button :disabled="!selected.length" @click="revealed = true">查看选择与遗漏的后果</button>
      <div v-if="revealed" class="selection-feedback" aria-live="polite">
        <p>{{ interaction.summary }}</p>
        <details v-for="(item, index) in interaction.items" :key="index" :open="selected.includes(index) !== item.recommended">
          <summary>{{ selected.includes(index) ? '已选择' : '未选择' }} · {{ item.label }} · {{ item.recommended ? '本案例建议保留' : '本案例可省略' }}</summary>
          <p><strong>保留时：</strong>{{ item.effect }}</p><p><strong>依据：</strong>{{ item.reason }}</p><p><strong>条件变化：</strong>{{ item.when }}</p>
        </details>
      </div>
    </template>

    <template v-else>
      <div class="lab-options" role="group" :aria-label="interaction.kind === 'compare' ? '选择对照条件' : '选择行动'">
        <button v-for="(item, index) in interaction.options" :key="index" :aria-pressed="picked === index" @click="picked = index">{{ item.label }}</button>
      </div>
      <div v-if="outcome" class="outcome" aria-live="polite">
        <div v-if="interaction.kind === 'compare' && picked !== 0" class="baseline"><strong>基线：{{ interaction.options[0]?.label }}</strong><p>{{ interaction.options[0]?.effect }}</p></div>
        <div><strong>{{ interaction.kind === 'compare' ? '当前条件' : '行动后果' }}</strong><p>{{ outcome.effect }}</p><p><strong>为什么：</strong>{{ outcome.reason }}</p><p><strong>什么条件下合理：</strong>{{ outcome.when }}</p></div>
      </div>
      <p v-else class="lab-empty">选择一个{{ interaction.kind === 'compare' ? '条件，查看与基线的差异' : '行动，查看后果和适用条件' }}。</p>
    </template>
    <button class="lab-reset" @click="reset">重新推演</button>
  </div>
</template>

<style scoped>
.agent-lab { margin-top: 18px; padding: 22px; border: 1px solid #d7e3f3; border-radius: 16px; background: #f8faff; color: #334969; font-size: 14px; line-height: 1.75; }
.lab-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
.lab-heading strong { color: #254c82; font-size: 16px; }
.lab-heading span, small { color: #61728d; font-size: 12px; }
.lab-prompt { font-size: 15px; }
.prediction { display: grid; gap: 6px; margin: 16px 0; font-size: 12px; }
textarea { box-sizing: border-box; width: 100%; resize: vertical; padding: 10px; border: 1px solid #bbcbe3; border-radius: 8px; background: white; color: #334969; font: inherit; font-size: 14px; }
button { padding: 9px 13px; border: 1px solid #bacce6; border-radius: 8px; background: white; color: #345a93; font: inherit; cursor: pointer; }
button:hover:not(:disabled), button[aria-pressed=true] { background: #e8f0ff; border-color: #5b7ebb; }
button:disabled { opacity: .5; cursor: default; }
button:focus-visible, textarea:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid #436bb5; outline-offset: 3px; }
.lab-options, .lab-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0; }
.lab-empty { padding: 18px; border: 1px dashed #bdcce3; border-radius: 10px; color: #5f728f; }
.trace-fields { display: grid; grid-template-columns: minmax(100px, 1fr) 3fr; gap: 10px 16px; padding: 16px; border-radius: 10px; background: white; overflow-wrap: anywhere; }
dt { font-weight: 600; color: #345a86; } dd { margin: 0; }
.outcome { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 16px; margin-top: 16px; }
.outcome > div { background: white; border: 1px solid #dce5f1; border-radius: 10px; padding: 16px; }
.outcome p { margin: 8px 0; }
fieldset { border: 0; padding: 0; margin: 16px 0; }
legend { margin-bottom: 8px; font-weight: 600; }
.selection-item { display: flex; align-items: baseline; gap: 10px; padding: 10px; margin: 5px 0; border: 1px solid #dce5f1; border-radius: 8px; background: white; }
input { accent-color: #456eb0; } .selection-item small { margin-left: 8px; }
.selection-feedback details { margin: 10px 0; padding: 10px 14px; background: white; border: 1px solid #dce5f1; border-radius: 8px; }
summary { cursor: pointer; } .selection-feedback p { margin: 8px 0; }
.lab-reset { display: block; margin-top: 18px; font-size: 12px; padding: 5px 10px; }
@media(max-width: 550px) { .agent-lab { padding: 14px; } .trace-fields { grid-template-columns: 1fr; gap: 5px; } dd { margin-bottom: 12px; } }
</style>
