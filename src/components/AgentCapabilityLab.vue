<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { AgentCapabilityLab } from '../agent-interaction';
import { capabilityDemo } from '../agent-capability-demo';

const props = defineProps<{ lab: AgentCapabilityLab }>();
const tools = ref<string[]>([]);
const position = ref(1);
const baselineSeen = ref(false);
const steps = computed(() => capabilityDemo(props.lab, tools.value));
const visibleSteps = computed(() => steps.value.slice(0, position.value));
const finished = computed(() => position.value >= steps.value.length);
function next() {
  if (!finished.value) position.value++;
  if (!tools.value.length && finished.value) baselineSeen.value = true;
}
function toggleTool(id: string) {
  if (!baselineSeen.value || !props.lab.tools.some(tool => tool.id === id)) return;
  tools.value = tools.value.includes(id) ? tools.value.filter(tool => tool !== id) : [...tools.value, id];
  position.value = 1;
}
function reset() { tools.value = []; position.value = 1; baselineSeen.value = false; }
watch(() => props.lab, reset);
</script>

<template>
  <div class="capability-lab">
    <header><span class="tag">动手试试</span><span>预设教学演示 · 不调用真实模型</span></header>
    <h4>{{ lab.title }}</h4>
    <p>{{ lab.prompt }}</p>
    <div class="task"><small>交给助手的任务</small><p>{{ lab.task }}</p></div>
    <fieldset>
      <legend>给助手接上工具 <small>已接 {{ tools.length }} / 3 项</small></legend>
      <p v-if="!baselineSeen" class="hint">先看下方的请求，再点击“下一步”查看没有工具时的回答，然后接上工具比较。</p>
      <div class="tool-cards">
        <button v-for="tool in lab.tools" :key="tool.id" :disabled="!baselineSeen" :aria-pressed="tools.includes(tool.id)" @click="toggleTool(tool.id)">
          <strong>{{ tool.label }}</strong><span>{{ tool.description }}</span>
          <small>{{ tools.includes(tool.id) ? '✓ 已接上 · 点击移除' : '+ 接上工具' }}</small>
        </button>
      </div>
    </fieldset>
    <div class="flow" aria-label="工具调用流程">发送输入 → 模型提出调用 → 程序执行 → 回传结果 → 再次请求模型</div>
    <section class="workbench" aria-label="接口调用过程">
      <div class="progress" role="status">{{ tools.length ? '已接工具的运行过程' : '没有工具时的运行过程' }} · {{ position }} / {{ steps.length }} 步</div>
      <ol>
        <li v-for="(step, index) in visibleSteps" :key="tools.join(',') + ':' + index">
          <h5><span>{{ index + 1 }}</span>{{ step.title }}</h5>
          <p class="step-summary">{{ step.summary }}</p>
          <p>{{ step.explanation }}</p>
          <details>
            <summary>查看代码与参数</summary>
            <pre>{{ JSON.stringify(step.payload, null, 2) }}</pre>
          </details>
        </li>
      </ol>
      <div class="controls">
        <button class="next" :disabled="finished" @click="next">{{ finished ? '本次演示已结束' : '下一步：' + steps[position]?.title }}</button>
        <button v-if="position > 1" @click="position = 1">重看本次过程</button>
      </div>
      <p v-if="finished" class="hint">{{ !tools.includes('search') ? '接上搜索工具，观察请求中增加的工具定义。' : !tools.includes('read') ? '接上阅读工具，看看网页入口如何变成可用资料。' : !tools.includes('save') ? '接上保存工具，观察模型提出保存请求后，程序如何执行并返回回执。' : '完成了。保存成功来自程序执行的回执，模型收到回执后才确认交付。也可以移除一个工具比较差异。' }}</p>
    </section>
    <footer><span>输入、模型回复、课程资料和保存回执均为预设示例；实际接入时由模型和工具服务返回。</span><button @click="reset">从头试试</button></footer>
  </div>
</template>

<style scoped>
.capability-lab { margin-top:18px; padding:26px; border:1px solid #d6e4e1; border-radius:20px; background:linear-gradient(145deg,#f3faf7,#f7f9ff); color:#30445b; font-size:14px; line-height:1.8; }
header, footer, .controls { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
header, footer, .hint, .progress { font-size:12px; color:#60766e; }
.tag { padding:3px 12px; background:#e0f2e9; border-radius:20px; color:#287362; font-weight:700; }
h4 { margin:16px 0 8px; font-size:23px; color:#204a41; }
.task { padding:14px 18px; border-left:3px solid #79ab99; background:#ffffffb0; border-radius:0 10px 10px 0; }
.task p { margin:4px 0; font-weight:600; }
fieldset { margin:22px 0; padding:0; border:0; min-width:0; }
legend { font-weight:650; } legend small { margin-left:12px; font-weight:400; color:#60766e; }
.tool-cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:10px; }
button { font:inherit; cursor:pointer; border:1px solid #b9cecf; border-radius:9px; padding:9px 12px; color:#365a52; background:white; }
button:focus-visible { outline:3px solid #4c8c78; outline-offset:3px; } button:disabled { opacity:.55; cursor:default; }
.tool-cards button { display:flex; flex-direction:column; gap:8px; align-items:flex-start; text-align:left; padding:16px; }
.tool-cards button[aria-pressed=true] { background:#eaf6ef; border-color:#69a389; box-shadow:inset 0 0 0 1px #69a389; }
.tool-cards span, .tool-cards small { font-size:12px; }
.flow { margin:18px 0; font-size:12px; color:#317459; }
.workbench { padding:18px; border:1px solid #dce6e6; background:white; border-radius:14px; }
ol { list-style:none; margin:12px 0; padding:0; display:grid; gap:16px; }
li { min-width:0; border-top:1px solid #e0e8e4; padding-top:14px; }
h5 { margin:0; font-size:15px; color:#294e44; } h5 span { display:inline-block; margin-right:9px; color:#678073; }
li p { font-size:12px; margin:8px 0; color:#627369; }
.step-summary { font-size:14px; color:#294e44; white-space:pre-line; }
pre { max-height:320px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; font:12px/1.7 Consolas,monospace; background:#f5f9f7; border:1px solid #dce5dd; padding:14px; border-radius:8px; }
summary { cursor:pointer; font-size:12px; color:#317459; }
summary:focus-visible { outline:3px solid #4c8c78; outline-offset:3px; }
.controls { justify-content:flex-start; padding:12px 0; }
.next { background:#2d705a; color:white; border-color:#2d705a; }
footer { margin-top:18px; } footer button { font-size:12px; flex-shrink:0; }
@media(max-width:600px) { .capability-lab { padding:16px; } .tool-cards { grid-template-columns:1fr; } h4 { font-size:20px; } .workbench { padding:12px; } }
</style>
