/** A cancelable teaching clock. Pausing preserves the remaining event delay. */
export class TeachingClock {
  constructor(advance, { delay = 850, timer = globalThis.setTimeout.bind(globalThis), clear = globalThis.clearTimeout.bind(globalThis), now = () => performance.now() } = {}) {
    Object.assign(this, { advance, delay, timer, clear, now });
    this.running = false; this.remaining = delay; this.generation = 0; this.handle = undefined;
  }
  play() { if (this.running) return; this.running = true; this.schedule(); }
  schedule() {
    const generation = this.generation;
    this.started = this.now();
    this.handle = this.timer(() => {
      if (!this.running || generation !== this.generation) return;
      this.handle = undefined; this.remaining = this.delay;
      if (this.advance() !== false) this.schedule(); else this.pause();
    }, this.remaining);
  }
  pause() {
    if (!this.running) return;
    this.running = false; this.generation++;
    if (this.handle !== undefined) { this.clear(this.handle); this.handle = undefined; this.remaining = Math.max(0, this.remaining - (this.now() - this.started)); }
  }
  reset() { this.pause(); this.generation++; this.remaining = this.delay; }
  step() { this.reset(); return this.advance(); }
  dispose() { this.reset(); }
}
