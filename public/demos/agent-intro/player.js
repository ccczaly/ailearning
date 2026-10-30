/* Player foundations: Copyright (c) 2026 洛小山 · Miyang Tech
 * (Zhuhai Hengqin) Co., Ltd. AGPL-3.0-only. LearnAI scoped coding-case player. */
export function mountPlayer(root, scenario, { reportHeight = false } = {}) {
  const document = root.ownerDocument;
  const window = document.defaultView;
  const $ = id => root.querySelector('#' + id);
  const steps = scenario.steps;
  const phases = scenario.phases;
  const names = Object.fromEntries(scenario.mechanisms.map(item => [item.id, item.label]));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = [];
  let position = 0;
  let reached = 0;
  let renderedPosition = -1;
  let timer = null;
  let heightFrame = null;
  let lastHeight = 0;
  let disposed = false;

  function on(target, name, callback) {
    target.addEventListener(name, callback);
    listeners.push(() => target.removeEventListener(name, callback));
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function requestHeight() {
    if (!reportHeight || disposed || heightFrame !== null) return;
    heightFrame = window.requestAnimationFrame(() => {
      heightFrame = null;
      const height = Math.ceil(root.getBoundingClientRect().height);
      if (window.parent !== window && height !== lastHeight) {
        lastHeight = height;
        window.parent.postMessage({ type: 'agent-intro-height', height }, window.location.origin);
      }
    });
  }

  function updateControls() {
    const finished = position === steps.length - 1;
    $('previous').disabled = position === 0;
    $('next').disabled = finished;
    $('next').textContent = position === 0 ? '开始演示 →' : finished ? '已完成 ✓' : '下一步 →';
    $('play').textContent = timer !== null ? 'Ⅱ 暂停播放' : finished ? '↻ 再次播放' : '▷ 自动播放';
    $('play').setAttribute('aria-label', timer !== null ? '暂停演示' : '自动播放演示');
    $('play').setAttribute('aria-pressed', String(timer !== null));
    $('playHint').textContent = timer !== null
      ? '每步停留 6 秒，可随时暂停'
      : finished ? '任务完成，可以回看各个阶段' : '点击下一步，按自己的节奏阅读';
  }

  function stop() {
    window.clearInterval(timer);
    timer = null;
    updateControls();
  }

  function createUserMessage() {
    const message = element('article', 'chat-message is-user');
    message.append(element('span', 'chat-author', '你'), element('p', 'chat-text', scenario.task));
    message.dataset.step = '0';
    return message;
  }

  function createAssistantMessage(step, index) {
    const message = element('article', 'chat-message is-assistant');
    message.dataset.step = String(index);
    message.append(element('span', 'chat-author', '✦ Agent'), element('p', 'chat-text', step.assistant || step.summary));
    if (step.action) {
      const receipt = element('div', 'tool-receipt');
      receipt.dataset.status = step.status === 'failed' ? 'failed' : step.status === 'passed' || step.status === 'done' ? 'passed' : 'completed';
      receipt.append(
        element('span', 'receipt-icon', step.status === 'failed' ? '!' : '✓'),
        element('span', 'receipt-label', step.action),
      );
      message.append(receipt);
    }
    return message;
  }

  function renderTranscript() {
    const transcript = $('transcript');
    if (renderedPosition < 0 || position < renderedPosition) {
      // A backwards jump restores only the conversation that existed at that point.
      transcript.replaceChildren(createUserMessage());
      for (let index = 1; index <= position; index++) transcript.append(createAssistantMessage(steps[index], index));
    } else {
      for (let index = renderedPosition + 1; index <= position; index++) {
        if (index > 0) transcript.append(createAssistantMessage(steps[index], index));
      }
    }
    transcript.querySelectorAll('.chat-message').forEach(node => {
      node.classList.toggle('is-current', Number(node.dataset.step) === position);
    });
    if (position !== renderedPosition) transcript.scrollTop = transcript.scrollHeight;
  }

  function renderCode() {
    // Keep the last file on screen while a later tool returns its test result.
    const fileStep = steps.slice(1, position + 1).findLast(step => step.filePath && step.code);
    $('codePanel').hidden = !fileStep;
    $('workspaceNote').hidden = Boolean(fileStep);
    $('workspaceNote').textContent = position === 0
      ? '开始演示后，在这里查看文件、代码变更和测试结果。'
      : 'Agent 正在安排步骤，接下来读取项目文件。';
    if (!fileStep) return;
    const diff = fileStep.diff;
    $('fileLabel').textContent = fileStep.filePath;
    $('editorMode').textContent = diff ? '代码变更' : '文件内容';
    $('code').dataset.mode = diff ? 'diff' : 'code';
    const lines = (diff || fileStep.code).replace(/\n$/, '').split('\n');
    $('code').replaceChildren(...lines.map((line, index) => {
      const row = element('span', 'code-line', line || ' ');
      row.dataset.line = String(index + 1);
      if (diff && line.startsWith('+') && !line.startsWith('+++')) row.classList.add('is-added');
      if (diff && line.startsWith('-') && !line.startsWith('---')) row.classList.add('is-removed');
      if (diff && (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++'))) row.classList.add('is-hunk');
      return row;
    }));
  }

  function renderTerminal() {
    const output = $('output');
    const entries = steps.slice(1, position + 1).filter(step => step.command || step.id === 'delivery');
    output.replaceChildren(...entries.map(step => {
      const entry = element('span', 'terminal-entry');
      entry.dataset.status = step.status || 'running';
      if (step.command) entry.append(element('span', 'terminal-command', `$ ${step.command}`));
      let result = step.output || (step.filePath ? `${step.filePath} · ${step.diff ? '代码变更已显示' : '文件内容已显示'}` : step.action);
      if (step.command && result.startsWith(`$ ${step.command}\n`)) result = result.slice(step.command.length + 3);
      entry.append(element('span', 'terminal-result', result));
      return entry;
    }));
    if (!entries.length) output.append(element('span', 'terminal-empty', '等待执行文件操作或测试命令…'));
    $('outputPanel').dataset.status = steps[position].status || 'running';
    $('outputLabel').textContent = '执行记录';
    output.scrollTop = output.scrollHeight;
  }

  function render() {
    if (disposed) return;
    const step = steps[position];
    const kinds = step.mechanisms || [];
    $('progress').textContent = `${position + 1} / ${steps.length}`;
    $('stepKind').replaceChildren(...(kinds.length ? kinds : ['goal']).map(id => element('span', 'mechanism-tag', names[id] || '任务目标')));
    $('stepTitle').textContent = position === 0 ? '等待开始' : step.action || step.title;
    $('workspaceStatus').textContent = position === 0 ? '等待开始' : step.status === 'failed' ? '发现问题' : step.status === 'passed' ? '验证通过' : step.status === 'done' ? '已交付' : '已执行';
    $('workspaceStatus').dataset.status = position === 0 ? 'idle' : step.status || 'running';
    root.querySelectorAll('[data-mechanism]').forEach(node => node.classList.toggle('active', kinds.includes(node.dataset.mechanism)));
    $('node-model')?.classList.toggle('active', kinds.includes('plan') || kinds.includes('reflect'));
    $('node-result')?.classList.toggle('active', (Boolean(step.output) && kinds.includes('tool')) || ['read-memory', 'read-code'].includes(step.id));
    $('completion').hidden = position !== steps.length - 1;
    root.querySelectorAll('#timeline button').forEach((button, index) => {
      const firstStep = steps.findIndex(item => item.phase === index);
      button.disabled = firstStep > reached;
      button.classList.toggle('current', index === step.phase);
      button.classList.toggle('completed', index < step.phase);
      if (index === step.phase) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    renderTranscript();
    renderCode();
    renderTerminal();
    renderedPosition = position;
    if (position === steps.length - 1 && timer !== null) stop();
    updateControls();
    requestHeight();
  }

  function advance() {
    if (position >= steps.length - 1) { stop(); return; }
    position++;
    reached = Math.max(reached, position);
    render();
  }

  function play() {
    stop();
    if (position === steps.length - 1) {
      position = 0;
      reached = 0;
      render();
    }
    timer = window.setInterval(advance, 6000);
    if (position === 0) advance();
    updateControls();
  }

  on($('play'), 'click', () => { if (timer !== null) stop(); else play(); });
  on($('previous'), 'click', () => { stop(); if (position > 0) { position--; render(); } });
  on($('next'), 'click', () => { stop(); advance(); });
  on($('replay'), 'click', () => { stop(); position = 0; reached = 0; render(); });
  $('timeline').replaceChildren();
  phases.forEach((phase, index) => {
    const button = element('button', 'phase-button');
    button.type = 'button';
    button.append(element('span', 'phase-number', String(index + 1).padStart(2, '0')), element('span', 'phase-label', phase.label));
    on(button, 'click', () => {
      const target = steps.findIndex(step => step.phase === index);
      if (target < 0 || target > reached) return;
      stop(); position = target; render();
    });
    $('timeline').append(button);
  });

  const sizeObserver = reportHeight && 'ResizeObserver' in window ? new window.ResizeObserver(requestHeight) : null;
  sizeObserver?.observe(root);
  if (reportHeight) on(window, 'resize', requestHeight);
  on(document, 'visibilitychange', () => { if (document.hidden) stop(); });
  if (reportHeight) on(window, 'message', event => {
    if (event.source === window.parent && event.origin === window.location.origin && event.data?.type === 'agent-intro-measure') requestHeight();
  });
  on(reducedMotion, 'change', () => { if (reducedMotion.matches) stop(); });
  document.fonts?.ready.then(requestHeight);
  render();

  return () => {
    if (disposed) return;
    disposed = true;
    window.clearInterval(timer);
    timer = null;
    sizeObserver?.disconnect();
    if (heightFrame !== null) window.cancelAnimationFrame(heightFrame);
    listeners.forEach(remove => remove());
  };
}
