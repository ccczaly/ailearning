/* Player foundations: Copyright (c) 2026 洛小山 · Miyang Tech
 * (Zhuhai Hengqin) Co., Ltd. AGPL-3.0-only. LearnAI coding-case adaptation. */
import { SCENARIO } from './scenario.js';
import { mountPlayer } from './player.js';

if (window.parent !== window) document.documentElement.classList.add('embedded');
const cleanup = mountPlayer(document.querySelector('.lesson-demo'), SCENARIO, { reportHeight: true });
window.addEventListener('pagehide', cleanup, { once: true });
