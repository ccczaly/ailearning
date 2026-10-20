<script setup lang="ts">
import type { LessonDiagram } from '../markdown';
defineProps<{ diagram: LessonDiagram }>();
</script>

<template>
  <figure class="mechanism-diagram" :class="diagram.kind">
    <div class="mechanism-cards" :style="{ '--step-count': diagram.steps.length }">
      <div v-for="(step, index) in diagram.steps" :key="index" class="mechanism-card">
        <div class="mechanism-title"><span v-if="diagram.kind === 'flow'" class="step-number">{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ step.title }}</strong></div>
        <p>{{ step.description }}</p>
        <svg v-if="diagram.kind === 'flow' && index < diagram.steps.length - 1" class="mechanism-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 12h17m-6-6 6 6-6 6" /></svg>
      </div>
    </div>
    <figcaption>{{ diagram.kind === 'flow' ? '机制示意' : '方法对照' }}</figcaption>
  </figure>
</template>

<style scoped>
.mechanism-diagram { margin: 18px 0 20px; border: 1px solid #e0e8f7; border-radius: 18px; background: linear-gradient(125deg, #f5f8ff, #edf2fb); container-type: inline-size; container-name: mechanism-diagram; }
.mechanism-cards { display: grid; grid-template-columns: repeat(var(--step-count), minmax(0, 1fr)); gap: 28px; padding: 24px; }
.mechanism-card { position: relative; min-width: 0; padding: 17px 16px; border: 1px solid #e4ebf8; border-radius: 13px; background: #ffffffd9; }
.mechanism-title { display: flex; align-items: baseline; gap: 7px; }
.mechanism-title strong { font-size: 13px; font-weight: 600; line-height: 1.7; color: #536a93; }
.step-number { font-size: 10px; letter-spacing: 1px; color: #64748b; flex-shrink: 0; }
.mechanism-card p { margin: 15px 0 0; font-size: 14px; color: #334a70; line-height: 1.85; overflow-wrap: anywhere; white-space: pre-line; }
.mechanism-arrow { position: absolute; right: -26px; top: calc(50% - 10px); width: 20px; height: 20px; color: #7e94b9; }
.mechanism-diagram figcaption { padding: 11px 18px; border-top: 1px solid #e4ebf8; border-radius: 0 0 18px 18px; background: #ffffff70; font-size: 11px; line-height: 1.7; color: #64748b; }
.compare .mechanism-cards { gap: 14px; }
.compare .mechanism-title strong { color: #655785; }
@container mechanism-diagram (max-width: 650px) {
  .mechanism-cards { grid-template-columns: 1fr; gap: 28px; padding: 18px; }
  .mechanism-card { padding: 14px 16px; }
  .mechanism-card p { margin-top: 9px; }
  .mechanism-arrow { top: auto; bottom: -26px; left: calc(50% - 10px); right: auto; transform: rotate(90deg); }
  .compare .mechanism-cards { gap: 12px; }
}
</style>
