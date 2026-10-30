<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

defineProps<{ title: string; prompt: string }>();
const surface = ref<HTMLElement>();
const loading = ref(true);
const loadError = ref(false);
const scenarioPath = '/demos/agent-intro/scenario.js';
const playerPath = '/demos/agent-intro/player.js';

type MountPlayer = (root: HTMLElement, scenario: unknown) => (() => void);
let cleanup: (() => void) | undefined;
let disposed = false;
let generation = 0;

async function loadPlayer() {
  const attempt = ++generation;
  cleanup?.();
  cleanup = undefined;
  loading.value = true;
  loadError.value = false;
  try {
    // Load the browser-ready modules by their same-origin public URLs.
    const suffix = attempt === 1 ? '' : '?retry=' + attempt;
    const [scenarioModule, playerModule] = await Promise.all([
      import(/* @vite-ignore */ new URL(scenarioPath + suffix, window.location.origin).href),
      import(/* @vite-ignore */ new URL(playerPath + suffix, window.location.origin).href),
    ]);
    if (disposed || attempt !== generation || !surface.value) return;
    const mountPlayer = playerModule.mountPlayer as MountPlayer;
    if (typeof mountPlayer !== 'function') throw new Error('Player unavailable');
    cleanup = mountPlayer(surface.value, scenarioModule.SCENARIO);
  } catch (error) {
    console.error('Agent intro player initialization failed', error);
    if (!disposed && attempt === generation) loadError.value = true;
  } finally {
    if (!disposed && attempt === generation) loading.value = false;
  }
}

onMounted(loadPlayer);
onUnmounted(() => {
  disposed = true;
  generation++;
  cleanup?.();
  cleanup = undefined;
});
</script>

<template>
  <section class="intro-lab" :aria-label="title" :aria-description="prompt">
    <link rel="stylesheet" href="/demos/agent-intro/demo.css">
    <p v-if="loading" class="loading-note" role="status">正在准备演示…</p>
    <div v-if="loadError" class="load-error" role="alert">
      <span>演示暂时没有加载成功。</span><button type="button" @click="loadPlayer">重试</button>
    </div>
    <div ref="surface" class="lesson-demo" :inert="loading || loadError" :aria-busy="loading">
    <section class="architecture" aria-labelledby="architecture-title">
      <div class="architecture-heading">
        <div><span class="eyebrow">先理解架构</span><h3 id="architecture-title">Agent 怎样把任务做完？</h3></div>
        <span class="diagram-badge">模型 + 工具 + 反馈循环</span>
      </div>
      <p class="architecture-intro">模型负责选择行动，工具把行动落到程序中，执行结果再回到模型。</p>
      <div class="support-row">
        <div class="mechanism" id="node-plan" data-mechanism="plan"><span class="node-icon" aria-hidden="true">☷</span><div><strong>计划</strong><small>拆解任务，明确完成条件</small></div></div>
        <div class="mechanism" id="node-memory" data-mechanism="memory"><span class="node-icon" aria-hidden="true">▤</span><div><strong>项目记忆</strong><small>读取项目中保存的规则与约定</small></div></div>
      </div>
      <div class="support-connector" aria-hidden="true"><span></span>为模型提供依据<span></span></div>
      <div class="flow-row" aria-label="模型选择行动，工具执行，结果返回模型，再决定下一步">
        <div class="flow-node" id="node-model"><span class="flow-symbol" aria-hidden="true">✦</span><div><strong>模型</strong><small>结合目标，选择下一步</small></div></div>
        <span class="flow-arrow" aria-hidden="true">→</span>
        <div class="flow-node" id="node-tool" data-mechanism="tool"><span class="flow-symbol" aria-hidden="true">⌘</span><div><strong>工具执行</strong><small>读文件、改代码、跑测试</small></div></div>
        <span class="flow-arrow" aria-hidden="true">→</span>
        <div class="flow-node" id="node-result"><span class="flow-symbol" aria-hidden="true">↳</span><div><strong>执行结果</strong><small>返回文件、报错或测试回执</small></div></div>
      </div>
      <div class="feedback" id="node-reflect" data-mechanism="reflect"><span aria-hidden="true">↶</span><strong>观察与反思</strong><span>结果回到模型，调整行动，直到完成。</span></div>
      <p class="diagram-caption">本例用到计划、工具、项目记忆和反思，具体机制按任务选择。演示推进时，对应环节会高亮。</p>
    </section>

    <section class="player" aria-labelledby="player-title">
      <header class="player-heading">
        <div><span class="eyebrow">再看一次完整任务</span><h3 id="player-title">看它修好一个购物车</h3><p>跟随 Agent 的回应，观察每一步的执行结果。</p></div>
        <span class="demo-label"><span></span>交互演示</span>
      </header>
      <nav class="timeline" id="timeline" aria-label="任务的四个阶段"></nav>
      <div class="demo-columns" id="stepStage">
        <section class="conversation" aria-labelledby="conversation-title">
          <div class="pane-heading"><span class="agent-mark" aria-hidden="true">✦</span><h4 id="conversation-title">Agent</h4><span class="pane-caption">对话与行动记录</span></div>
          <div class="transcript" id="transcript" role="log" aria-label="Agent 对话与行动记录" aria-live="polite" aria-relevant="additions" tabindex="0"></div>
          <div class="conversation-footer"><span class="activity-dot" aria-hidden="true"></span><span id="stepKind">等待开始</span></div>
        </section>
        <section class="workspace" aria-labelledby="workspace-title">
          <div class="pane-heading workspace-heading"><span class="workspace-mark" aria-hidden="true">⌘</span><h4 id="workspace-title">程序执行</h4><span class="workspace-status" id="workspaceStatus" role="status">等待开始</span></div>
          <div class="workspace-action"><span class="activity-dot" aria-hidden="true"></span><span id="stepTitle">等待 Agent 开始任务</span></div>
          <div class="workspace-note" id="workspaceNote"><span aria-hidden="true">⌁</span><strong>执行过程会在这里展开</strong><p>读取文件、修改代码、运行测试，都会留下对应的结果。</p></div>
          <section class="code-panel" id="codePanel" aria-label="文件与代码变更" hidden>
            <div class="panel-label"><span class="file-icon" aria-hidden="true">≡</span><span id="fileLabel">cart.py</span><span class="editor-mode" id="editorMode">文件内容</span></div>
            <pre class="editor-code" tabindex="0"><code id="code"></code></pre>
          </section>
          <section class="output-panel" id="outputPanel" aria-label="终端执行记录">
            <div class="panel-label"><span aria-hidden="true">›_</span><span id="outputLabel">终端</span></div>
            <pre class="terminal-output" id="output" tabindex="0">等待执行命令…</pre>
          </section>
        </section>
      </div>
      <footer class="controls">
        <div class="step-navigation"><button type="button" id="previous" disabled>← 上一步</button><button type="button" class="primary" id="next">开始演示 →</button></div>
        <span class="progress" id="progress" role="status">1 / 11</span>
        <div class="playback-controls"><button type="button" class="quiet-button" id="play" aria-label="自动播放演示">▷ 自动播放</button><button type="button" class="quiet-button" id="replay" aria-label="重新开始演示">↺ 重置</button></div>
        <span class="sr-only" id="playHint">点击下一步，按自己的节奏观察。</span>
      </footer>
      <div class="completion" id="completion" role="status" hidden><span aria-hidden="true">✓</span><div><strong>修复完成，三项测试通过</strong><p>测试结果改变了下一步行动，直到满足交付条件。</p></div></div>
    </section>

    <details class="references">
      <summary>演示说明与参考来源</summary>
      <p>预设教学演示：对话、文件修改与终端输出同步呈现；浏览器不执行 Python 或调用真实模型。代码样例另有自动验证。</p>
      <p>结构图由 LearnAI 教学改绘，参考以下资料：</p>
      <ul><li><a href="https://lilianweng.github.io/posts/2023-06-23-agent/" target="_blank" rel="noopener noreferrer">Lilian Weng · LLM Powered Autonomous Agents（2023）</a> · <a href="https://lilianweng.github.io/posts/2023-06-23-agent/agent-overview.png" target="_blank" rel="noopener noreferrer">查看原始架构图 ↗</a></li><li><a href="https://www.anthropic.com/research/building-effective-agents" target="_blank" rel="noopener noreferrer">Anthropic · Building effective agents（2024）</a></li></ul>
      <p>案例与架构图：LearnAI · 播放器基础改编自 <a href="https://xueai.miyang.cn/slides/7-1.html" target="_blank" rel="noopener noreferrer">洛小山 · 小山学堂</a> · <a href="/demos/agent-intro/ATTRIBUTION.md" target="_blank" rel="noopener noreferrer">来源与源码</a> · <a href="/demos/agent-intro/LICENSE" target="_blank" rel="noopener noreferrer">AGPL-3.0</a></p>
    </details>
    </div>
    <a class="standalone-link" href="/demos/agent-intro/index.html" target="_blank" rel="noopener noreferrer">在独立窗口中操作 ↗</a>
  </section>
</template>

<style scoped>
.intro-lab { margin-top: 18px; min-width: 0; }
.loading-note { font-size: 13px; color: #61728d; margin: 10px 0; }
.load-error { display: flex; align-items: center; gap: 12px; padding: 14px 16px; margin-bottom: 14px; color: #8b4641; background: #fff5f3; border: 1px solid #efd6d0; border-radius: 10px; font-size: 14px; }
.load-error button { font: inherit; color: inherit; border: 1px solid #debdb5; background: white; border-radius: 7px; padding: 5px 12px; cursor: pointer; }
.load-error button:focus-visible { outline: 3px solid #6a8cfa; outline-offset: 3px; }
.standalone-link { display: inline-block; margin-top: 12px; font-size: 12px; color: #5a6e91; text-underline-offset: 3px; }
</style>
