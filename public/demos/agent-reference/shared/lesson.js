/* ═══════════════════════════════════════════════════════════
   lesson.js —— 课程子页统一交互助手
   核心原则：内容随滚动自然展现，无需点击"下一步"。
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var disposed = false;
  var observers = new Set();
  window.addEventListener('pagehide', function () {
    disposed = true;
    observers.forEach(function (observer) { observer.disconnect(); });
    observers.clear();
  });

  /* 滚动渐入：页面上所有 .reveal 元素进入视野时自动加 .show。
     无需任何配置，引入本文件即生效。 */
  function initReveal() {
    if (disposed) return;
    var els = document.querySelectorAll('.reveal:not(.show)');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach ? els.forEach(function (el) { el.classList.add('show'); })
                  : Array.prototype.forEach.call(els, function (el) { el.classList.add('show'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      if (disposed) return;
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('show');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    observers.add(io);
    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  /* 进入视野触发一次回调（用于自动播放演示动画）。
     用法：lessonOnView(document.getElementById('demo'), function(){ playDemo(); }); */
  window.lessonOnView = function (el, cb, threshold) {
    if (disposed || !el || typeof cb !== 'function') return;
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var fired = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!disposed && !fired && en.isIntersecting) { fired = true; io.disconnect(); observers.delete(io); cb(); }
      });
    }, { threshold: typeof threshold === 'number' ? threshold : 0.35 });
    observers.add(io);
    io.observe(el);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }
})();
