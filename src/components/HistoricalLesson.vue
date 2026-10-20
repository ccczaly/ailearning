<script setup lang="ts">
import { computed } from 'vue';
import { renderLessonSections } from '../markdown';
import ReadingIcon from './ReadingIcon.vue';
import ElizaDiagram from './ElizaDiagram.vue';
import MechanismDiagram from './MechanismDiagram.vue';

const props = defineProps<{ source: string }>();
const sections = computed(() => renderLessonSections(props.source));
</script>

<template>
  <div class="history-body">
    <template v-for="(section, index) in sections" :key="index">
      <div v-if="!section.title" class="history-intro history-prose" v-html="section.contentHtml"></div>
      <details v-else-if="section.title === '延伸阅读'" class="history-reading">
        <summary>
          <ReadingIcon name="book" />
          <span><strong>延伸阅读</strong><small>背景、细节与原始资料</small></span>
          <svg class="reading-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m8 10 4 4 4-4" /></svg>
        </summary>
        <div class="history-prose reading-details" v-html="section.contentHtml"></div>
      </details>
      <section v-else class="history-section" :class="{ 'history-insight': section.title === '留下的启发' }">
        <div class="section-heading">
          <span v-if="section.title === '留下的启发'" class="section-insight-icon"><ReadingIcon name="bulb" /></span>
          <span v-else class="section-number">{{ String(index).padStart(2, '0') }}</span>
          <h3>{{ section.title }}</h3>
        </div>
        <figure v-if="section.title === '模仿游戏怎样进行'" class="imitation-game">
          <div class="game-diagram" role="img" aria-label="提问者隔着屏障，向真人和机器发送文字问题、接收文字回答，再判断谁是机器。提问者看不到回答者的外貌，也听不到声音。">
            <div class="game-judge">
              <span class="game-avatar judge-avatar"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="7" y="8" width="34" height="25" rx="5" /><path d="M19 40h10M24 33v7m-9-24 4 4-4 4m9 0h8" /></svg></span>
              <strong>提问者</strong>
              <span class="game-description">谁是机器？</span>
            </div>
            <div class="game-channel">
              <span class="channel-label">文字提问</span>
              <svg class="channel-arrow" viewBox="0 0 140 12" fill="none" aria-hidden="true"><path d="M1 6h136m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.5" /></svg>
              <span class="channel-barrier"><span></span>屏障<span></span></span>
              <svg class="channel-arrow return-arrow" viewBox="0 0 140 12" fill="none" aria-hidden="true"><path d="M1 6h136m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.5" /></svg>
              <span class="channel-label">文字回答</span>
            </div>
            <div class="game-respondents">
              <div class="game-respondent">
                <span class="game-avatar human-avatar"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="24" cy="16" r="8" /><path d="M9 40v-4c0-7 6-12 15-12s15 5 15 12v4M19 12c2 3 6 4 12 3" /></svg></span>
                <span><strong>真人</strong><small>回答者 A / B</small></span>
              </div>
              <div class="game-respondent">
                <span class="game-avatar machine-avatar"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="13" width="30" height="26" rx="7" /><path d="M24 13V7M5 22v8m38-8v8m-26 2h14" /><circle cx="24" cy="5" r="2" /><circle cx="18" cy="23" r="2" /><circle cx="30" cy="23" r="2" /></svg></span>
                <span><strong>机器</strong><small>回答者 A / B</small></span>
              </div>
            </div>
          </div>
          <figcaption><span class="game-caption-dot"></span>只看文字交流，排除外貌与声音的线索。<span class="game-version">图示采用常见的人机辨别版本</span></figcaption>
        </figure>
        <ElizaDiagram v-if="section.title === 'ELIZA 怎样生成回复'" kind="reply" />
        <ElizaDiagram v-else-if="section.title === '规则为什么会遇到边界'" kind="limits" />
        <MechanismDiagram v-for="(diagram, diagramIndex) in section.diagrams" :key="diagramIndex" :diagram="diagram" />
        <div class="history-prose" v-html="section.contentHtml"></div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.history-body { display: flex; flex-direction: column; gap: 30px; padding-top: 24px; container-type: inline-size; container-name: historical-body; }
.history-prose { font-size: 16px; line-height: 1.85; color: #43516b; overflow-wrap: anywhere; }
.history-prose :deep(p) { margin: 0 0 14px; }
.history-prose :deep(p:last-child) { margin-bottom: 0; }
.history-prose :deep(strong) { color: #233d70; font-weight: 650; }
.history-prose :deep(a) { color: #416ac0; text-decoration: underline; text-underline-offset: 4px; }
.history-prose :deep(ul), .history-prose :deep(ol) { margin: 12px 0; padding-left: 24px; }
.history-prose :deep(li) { margin: 6px 0; }
.history-prose :deep(blockquote) { margin: 16px 0; padding: 12px 18px; border-left: 3px solid #8fa7ed; background: #f5f7fc; }
.history-prose :deep(h3) { margin: 18px 0 10px; font-size: 17px; }
.history-prose :deep(img) { max-width: 100%; height: auto; }
.history-prose :deep(pre) { overflow: auto; padding: 16px; background: #f3f6fc; border-radius: 10px; }
.history-prose :deep(code) { font-family: Consolas, monospace; font-size: .88em; background: #f1f4fa; padding: 2px 5px; border-radius: 4px; }
.history-prose :deep(pre) { max-width: 100%; line-height: 1.7; border: 1px solid #e1e7f2; }
.history-prose :deep(pre code) { padding: 0; background: none; }
.history-prose :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 18px 0; font-size: 13px; }
.history-prose :deep(th), .history-prose :deep(td) { border: 1px solid #dfe6f3; padding: 9px 13px; min-width: 90px; text-align: left; }
.history-prose :deep(th) { background: #f1f5fd; color: #3c527b; }
.history-intro { max-width: 760px; font-size: 18px; line-height: 1.85; color: #54627b; }
.section-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 13px; }
.section-heading h3 { margin: 0; font-size: 21px; font-weight: 650; letter-spacing: -.3px; color: #192f58; }
.section-number { font-size: 12px; font-weight: 700; letter-spacing: 1px; color: #6b83b6; background: #eef3fd; border: 1px solid #e0e9fb; border-radius: 9px; width: 32px; height: 32px; display: grid; place-items: center; flex-shrink: 0; }
.history-insight { padding: 20px 24px; border-radius: 16px; background: #eef5ff; border: 1px solid #dde9fd; }
.history-insight .section-heading { gap: 10px; margin-bottom: 9px; }
.history-insight .section-heading h3 { font-size: 17px; color: #35578f; }
.section-insight-icon { width: 22px; height: 22px; color: #5477bf; }
.section-insight-icon svg { width: 100%; height: 100%; }
.history-reading { border: 1px solid #e4e9f2; border-radius: 14px; background: #fcfdff; }
.history-reading summary { display: flex; align-items: center; gap: 13px; padding: 17px 20px; cursor: pointer; list-style: none; border-radius: 14px; }
.history-reading summary::-webkit-details-marker { display: none; }
.history-reading summary:hover { background: #f5f8fd; }
.history-reading summary:focus-visible { outline: 2px solid #7185ef; outline-offset: 3px; }
.history-reading summary > svg:first-child { width: 23px; height: 23px; color: #7187ad; }
.history-reading summary > span { display: flex; align-items: baseline; gap: 12px; flex: 1; }
.history-reading strong { color: #3d5175; font-size: 15px; font-weight: 600; }
.history-reading small { color: #63748e; font-size: 12px; }
.reading-chevron { width: 20px; height: 20px; color: #7385a5; transition: transform .15s; }
.history-reading[open] .reading-chevron { transform: rotate(180deg); }
.reading-details { padding: 2px 22px 22px; font-size: 14px; color: #66748c; }
.imitation-game { margin: 18px 0 20px; border: 1px solid #e0e8f7; border-radius: 18px; background: linear-gradient(125deg, #f5f8ff, #edf2fb); overflow: hidden; }
.game-diagram { display: grid; grid-template-columns: 1fr 160px 1.25fr; align-items: center; gap: 24px; padding: 26px 34px; }
.game-judge { display: flex; flex-direction: column; align-items: center; gap: 9px; }
.game-avatar { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 17px; flex-shrink: 0; }
.game-avatar svg { width: 38px; height: 38px; }
.judge-avatar { width: 72px; height: 72px; color: #5476c5; background: white; box-shadow: 0 4px 18px #496aa218; border: 1px solid #e2e9f6; }
.judge-avatar svg { width: 43px; height: 43px; }
.game-judge > strong { font-size: 16px; font-weight: 600; color: #243b67; }
.game-description { font-size: 12px; color: #6a7da2; }
.game-channel { display: flex; flex-direction: column; align-items: center; gap: 7px; color: #859ac1; }
.channel-label { font-size: 11px; color: #7386a8; letter-spacing: 1px; }
.channel-arrow { width: 100%; height: 12px; }
.return-arrow { transform: rotate(180deg); }
.channel-barrier { display: flex; align-items: center; gap: 10px; font-size: 11px; color: #94a3bc; margin: 6px 0; }
.channel-barrier span { width: 24px; border-top: 1px dashed #b1bfd4; }
.game-respondents { display: flex; flex-direction: column; gap: 12px; }
.game-respondent { display: flex; align-items: center; gap: 13px; background: #ffffffd9; border: 1px solid #e5eafa; border-radius: 13px; padding: 11px 15px; }
.human-avatar { width: 43px; height: 43px; border-radius: 12px; background: #edf2ff; color: #6d85c3; }
.machine-avatar { width: 43px; height: 43px; border-radius: 12px; background: #f0edff; color: #8c7bbf; }
.game-respondent svg { width: 32px; height: 32px; }
.game-respondent > span:last-child { display: flex; flex-direction: column; gap: 5px; }
.game-respondent strong { font-size: 14px; font-weight: 600; color: #334a72; }
.game-respondent small { font-size: 10px; color: #8390a7; letter-spacing: .3px; }
.imitation-game figcaption { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; font-size: 11px; line-height: 1.7; color: #7889a6; background: #ffffff70; border-top: 1px solid #e4ebf8; padding: 12px 18px; }
.game-caption-dot { width: 5px; height: 5px; border-radius: 50%; background: #8aa4d7; }
.game-version { margin-left: auto; color: #8e9bb1; }
@media (max-width: 1100px) {
  .game-diagram { grid-template-columns: 1fr 90px 1.1fr; gap: 14px; padding: 24px 20px; }
  .game-respondent { padding: 10px; gap: 9px; }
  .game-version { margin-left: 12px; }
}
@media (max-width: 800px) {
  .history-body { gap: 24px; padding-top: 18px; }
  .history-intro { font-size: 16px; }
  .section-heading h3 { font-size: 18px; }
  .game-diagram { grid-template-columns: 1fr 54px 1.2fr; gap: 9px; padding: 20px 12px; }
  .game-respondent { flex-direction: column; text-align: center; }
  .game-respondent small { font-size: 9px; }
  .game-respondents { gap: 8px; }
  .judge-avatar { width: 54px; height: 54px; border-radius: 14px; }
  .judge-avatar svg { width: 34px; height: 34px; }
  .channel-barrier { gap: 4px; }
  .channel-barrier span { width: 7px; }
  .history-reading summary > span { flex-direction: column; gap: 4px; }
  .history-insight { padding: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .reading-chevron { transition: none; }
}
@container historical-body (max-width: 520px) {
  .game-diagram { grid-template-columns: 1fr 54px 1.2fr; gap: 9px; padding: 20px 12px; }
  .game-respondent { flex-direction: column; text-align: center; }
  .game-respondent small { font-size: 9px; }
  .game-respondents { gap: 8px; }
  .judge-avatar { width: 54px; height: 54px; border-radius: 14px; }
  .judge-avatar svg { width: 34px; height: 34px; }
  .channel-barrier { gap: 4px; }
  .channel-barrier span { width: 7px; }
  .history-reading summary > span { flex-direction: column; gap: 4px; }
}
</style>
