/**
 * Fixed-allocation frame clock. No `new` inside tick().
 */
export class Clock {
  elapsed = 0;
  delta = 0;
  private last = 0;
  private started = false;

  tick(nowMs: number): number {
    if (!this.started) {
      this.last = nowMs;
      this.started = true;
    }
    this.delta = Math.min((nowMs - this.last) / 1000, 0.1); // clamp to avoid spiral of death
    this.last = nowMs;
    this.elapsed += this.delta;
    return this.delta;
  }
}
