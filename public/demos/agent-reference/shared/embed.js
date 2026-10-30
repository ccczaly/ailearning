/* LearnAI adaptation of the public itshen/learn-ai demonstrations.
 * All task results and measurements are scripted teaching examples. */
(function () {
  'use strict';
  const native = {
    timeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
    interval: window.setInterval.bind(window), clearInterval: window.clearInterval.bind(window),
    frame: window.requestAnimationFrame.bind(window), cancelFrame: window.cancelAnimationFrame.bind(window),
  };
  const pending = new Map();
  let nextId = 1, generation = 0, disposed = false;
  let paused = Boolean(document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.documentElement.setAttribute('data-demo-paused', String(paused));
  const demoId = location.pathname.split('/').filter(Boolean).at(-2);

  function schedule(job) {
    if (paused || disposed) return;
    job.started = performance.now();
    const invoke = timestamp => {
      if (disposed || !pending.has(job.id) || job.generation !== generation) return;
      if (job.kind !== 'interval') pending.delete(job.id);
      if (typeof job.callback === 'function') job.callback(...(job.kind === 'frame' ? [timestamp] : job.args));
      if (job.kind === 'interval' && pending.has(job.id)) { job.remaining = job.delay; schedule(job); }
    };
    job.handle = job.kind === 'frame' ? native.frame(invoke) : native.timeout(invoke, job.remaining);
  }
  function add(kind, callback, delay, args) {
    // Only authored function callbacks are supported; do not evaluate strings.
    if (typeof callback !== 'function') throw new TypeError('Expected a function callback');
    const id = nextId++;
    const job = { id, kind, callback, delay: Math.max(0, Number(delay) || 0), remaining: Math.max(0, Number(delay) || 0), args, generation };
    pending.set(id, job); schedule(job); return id;
  }
  function clear(id) {
    const job = pending.get(id); if (!job) return;
    if (job.kind === 'frame') native.cancelFrame(job.handle); else native.clearTimeout(job.handle);
    pending.delete(id);
  }
  function cancel() {
    generation++;
    for (const id of [...pending.keys()]) clear(id);
    window.dispatchEvent(new CustomEvent('agent-demo-cancel'));
  }
  function setPaused(value) {
    if (paused === value || disposed) return;
    paused = value;
    document.documentElement.setAttribute('data-demo-paused', String(paused));
    for (const job of pending.values()) {
      if (paused) {
        if (job.kind === 'frame') native.cancelFrame(job.handle);
        else { native.clearTimeout(job.handle); job.remaining = Math.max(0, job.remaining - (performance.now() - job.started)); }
      } else schedule(job);
    }
    const button = document.getElementById('learnai-pause');
    if (button) { button.textContent = paused ? '继续演示' : '暂停演示'; button.setAttribute('aria-pressed', String(paused)); }
  }
  window.setTimeout = (callback, delay, ...args) => add('timeout', callback, delay, args);
  window.setInterval = (callback, delay, ...args) => add('interval', callback, delay, args);
  window.requestAnimationFrame = callback => add('frame', callback, 0, []);
  window.clearTimeout = window.clearInterval = window.cancelAnimationFrame = clear;
  window.learnaiDemo = Object.freeze({ cancel, setPaused, get paused() { return paused; } });

  // Capture before the original handler starts a new sequence. Replaying or
  // switching scenarios must not leave callbacks from the previous sequence.
  document.addEventListener('click', event => {
    const control = event.target.closest?.('[onclick]');
    const handler = control?.getAttribute('onclick') || '';
    if (/^\s*(?:reset\w*|replay\w*|pickMode|pickScene|pickExp|selectMode|setMode)\s*\(/i.test(handler)) cancel();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (target.matches?.('[role="button"]:not(button)')) { event.preventDefault(); target.click(); }
  });

  let heightTimer, sizeObserver, contentObserver;
  function reportHeight() {
    if (disposed) return;
    native.clearTimeout(heightTimer);
    heightTimer = native.timeout(() => {
      if (disposed || window.parent === window) return;
      // The root scrollHeight is at least the iframe's current viewport height.
      // Measure the final flow element so collapsing/replaying can shrink it.
      const bottom = document.querySelector('.learnai-source')?.getBoundingClientRect().bottom;
      const height = Math.ceil((bottom ?? document.body?.scrollHeight ?? 360) + (window.scrollY || 0) + 16);
      window.parent.postMessage({ type: 'agent-reference-height', demoId, height }, location.origin);
    }, 60);
  }
  document.addEventListener('DOMContentLoaded', () => {
    const toolbar = document.createElement('aside');
    toolbar.className = 'learnai-toolbar';
    const note = document.createElement('span'); note.textContent = '预设教学演示 · 数据、耗时和模型解释均为示意';
    const button = document.createElement('button'); button.id = 'learnai-pause'; button.type = 'button';
    button.textContent = paused ? '继续演示' : '暂停演示'; button.setAttribute('aria-pressed', String(paused));
    button.addEventListener('click', () => setPaused(!paused));
    toolbar.append(note, button); document.body.prepend(toolbar);
    const footer = document.createElement('footer'); footer.className = 'learnai-source';
    footer.append(document.createTextNode('来源：洛小山 · 小山学堂；LearnAI 交互适配。'));
    const source = document.createElement('a'); source.href = document.querySelector('meta[name="upstream-source"]')?.content || 'https://github.com/itshen/learn-ai';
    source.textContent = '原版课程'; source.target = '_blank'; source.rel = 'noopener noreferrer';
    const local = document.createElement('a'); local.href = './index.html'; local.download = 'index.html'; local.textContent = '下载演示源码';
    const license = document.createElement('a'); license.href = '../LICENSE'; license.textContent = 'AGPL-3.0';
    footer.append(source, local, license); document.body.append(footer);
    for (const element of document.querySelectorAll('[onclick]:not(button):not(a):not(input):not(select):not(summary)')) {
      element.setAttribute('role', 'button'); element.setAttribute('tabindex', '0');
    }
    const style = document.createElement('style');
    style.textContent = '.learnai-toolbar{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 16px;background:#edf3fb;color:#455a77;font:13px/1.6 system-ui}.learnai-toolbar button{flex-shrink:0;border:1px solid #c2cee1;border-radius:7px;padding:6px 10px;background:#fff;color:#304c77;cursor:pointer}.learnai-source{padding:16px;color:#607087;font:12px/1.8 system-ui;display:flex;gap:12px;flex-wrap:wrap}.learnai-source a{color:#365f9a}body{margin:0!important}.lesson{padding:18px 16px!important;max-width:1100px!important;overflow-x:auto}.reveal{opacity:1!important;transform:none!important}button:focus-visible,[role=button]:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #3675cd;outline-offset:3px}html{scrollbar-gutter:stable}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}';
    document.head.append(style);
    const pauseStyle = document.createElement('style');
    pauseStyle.textContent = 'html[data-demo-paused="true"] *,html[data-demo-paused="true"] *::before,html[data-demo-paused="true"] *::after{animation-play-state:paused!important}';
    document.head.append(pauseStyle);
    sizeObserver = new ResizeObserver(reportHeight);
    sizeObserver.observe(document.body);
    contentObserver = new MutationObserver(reportHeight);
    contentObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    reportHeight();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
  window.addEventListener('pagehide', () => {
    cancel(); disposed = true; native.clearTimeout(heightTimer);
    sizeObserver?.disconnect(); contentObserver?.disconnect();
  });
})();
