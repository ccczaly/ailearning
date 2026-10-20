<script setup lang="ts">
defineProps<{ kind: 'reply' | 'limits' }>();
</script>

<template>
  <figure class="eliza-diagram">
    <template v-if="kind === 'reply'">
      <div class="reply-flow" role="img" aria-label="简化规则教学示例：用户输入我担心考试，程序匹配担心并提取考试，再把考试填入追问模板，输出你为什么担心考试。">
        <div class="flow-step input-step">
          <span class="flow-label"><span>01</span> 用户输入</span>
          <p>我<span class="keyword">担心</span><span class="fragment">考试</span></p>
          <small>一段待处理的文字</small>
        </div>
        <svg class="flow-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 12h17m-6-6 6 6-6 6" /></svg>
        <div class="flow-step rule-step">
          <span class="flow-label"><span>02</span> 匹配与改写</span>
          <div class="rule-fragments"><span>关键词<b class="keyword">担心</b></span><span>提取片段<b class="fragment">考试</b></span></div>
          <small>把片段填入预写的模板</small>
        </div>
        <svg class="flow-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 12h17m-6-6 6 6-6 6" /></svg>
        <div class="flow-step output-step">
          <span class="flow-label"><span>03</span> 程序回复</span>
          <p>你为什么担心<span class="fragment">考试</span>？</p>
          <small>用输入中的片段继续追问</small>
        </div>
      </div>
      <figcaption>简化的中文教学示例，展示关键词与改写思路。</figcaption>
    </template>
    <template v-else>
      <div class="limits-examples">
        <div class="limit-example">
          <div class="limit-label"><span class="limit-symbol" aria-hidden="true">↗</span><strong>换种说法</strong></div>
          <div class="limit-utterance">一想到考试就心慌。</div>
          <div class="limit-result"><span>可能漏匹配</span><small>没有出现“担心”这个词</small></div>
        </div>
        <div class="limit-example">
          <div class="limit-label"><span class="limit-symbol" aria-hidden="true">≠</span><strong>加入否定</strong></div>
          <div class="limit-utterance">我<span class="negation">不</span>担心考试。</div>
          <div class="limit-result"><span>可能误判</span><small>匹配到“担心”，却忽略“不”</small></div>
        </div>
      </div>
      <figcaption>以只匹配“担心”的简单规则为例：词语命中，还需要判断句子的意思。</figcaption>
    </template>
  </figure>
</template>

<style scoped>
.eliza-diagram { margin: 18px 0 20px; overflow: hidden; border: 1px solid #e0e8f7; border-radius: 18px; background: linear-gradient(125deg, #f5f8ff, #edf2fb); container-type: inline-size; container-name: eliza-diagram; }
.reply-flow { display: grid; grid-template-columns: 1fr 20px 1fr 20px 1fr; align-items: center; gap: 10px; padding: 24px; }
.flow-step { align-self: stretch; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; padding: 16px 14px; border: 1px solid #e4ebf8; border-radius: 13px; background: #ffffffd9; min-width: 0; }
.flow-label { display: flex; align-items: center; gap: 7px; color: #536a93; font-size: 12px; font-weight: 600; }
.flow-label > span { font-size: 10px; font-weight: 500; color: #64748b; letter-spacing: 1px; }
.flow-step p { margin: 0; font-size: 15px; line-height: 1.9; color: #2b426e; }
.flow-step small { color: #64748b; font-size: 11px; line-height: 1.7; }
.flow-arrow { width: 20px; height: 20px; color: #91a3c3; }
.keyword { padding: 2px 4px; border-radius: 5px; background: #edf1ff; color: #506ba5; }
.fragment { padding: 2px 4px; border-radius: 5px; background: #eeeafa; color: #705695; }
.rule-fragments { display: flex; flex-direction: column; gap: 9px; font-size: 11px; color: #64748b; }
.rule-fragments > span { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.rule-fragments b { font-size: 12px; font-weight: 500; }
.eliza-diagram figcaption { padding: 12px 18px; border-top: 1px solid #e4ebf8; background: #ffffff70; color: #64748b; font-size: 11px; line-height: 1.7; }
.limits-examples { padding: 22px 24px; display: flex; flex-direction: column; gap: 12px; }
.limit-example { display: grid; grid-template-columns: 110px minmax(0, 1fr) minmax(0, 1.1fr); align-items: center; gap: 18px; padding: 17px 18px; background: #ffffffd9; border: 1px solid #e4ebf8; border-radius: 13px; }
.limit-label { display: flex; align-items: center; gap: 9px; }
.limit-label strong { font-size: 12px; font-weight: 500; color: #546b91; }
.limit-symbol { display: grid; place-items: center; width: 27px; height: 27px; border-radius: 8px; background: #edf2ff; color: #7b91bb; font-size: 18px; }
.limit-utterance { color: #354b72; font-size: 14px; line-height: 1.8; }
.negation { color: #ac7950; background: #fff1e4; padding: 2px 4px; border-radius: 5px; }
.limit-result { display: flex; flex-direction: column; gap: 6px; padding-left: 16px; border-left: 1px solid #e7ecf5; }
.limit-result > span { font-size: 12px; font-weight: 500; color: #806448; }
.limit-result small { font-size: 11px; line-height: 1.7; color: #64748b; }
@container eliza-diagram (max-width: 580px) {
  .reply-flow { grid-template-columns: 1fr; gap: 8px; padding: 18px; }
  .flow-step { padding: 14px 16px; gap: 10px; }
  .flow-arrow { justify-self: center; transform: rotate(90deg); }
  .rule-fragments { flex-direction: row; flex-wrap: wrap; gap: 8px 24px; }
  .rule-fragments > span { justify-content: flex-start; }
  .limit-example { grid-template-columns: 1fr; gap: 10px; padding: 16px; }
  .limit-result { padding: 10px 0 0; border-left: 0; border-top: 1px solid #e7ecf5; }
  .limits-examples { padding: 18px; }
}
</style>
