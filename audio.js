/**
 * 玻璃彈珠坑 — original glass/marble SFX via Web Audio (no samples).
 */

export class MarblePitAudio {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.enabled = true;
    this.master = 0.22;
    this._hitGate = 0;
    this._rollGate = 0;
  }

  async unlock() {
    this.ensure();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
  }

  setEnabled(on) {
    this.enabled = on;
  }

  /**
   * @param {number} freq
   * @param {number} dur
   * @param {OscillatorType} [type]
   * @param {number} [gain]
   * @param {number} [when]
   */
  tone(freq, dur, type = "sine", gain = 0.1, when = 0) {
    if (!this.enabled) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * this.master, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.025, dur));
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);
  }

  /** Glass flick / launch */
  flick() {
    this.tone(420, 0.05, "triangle", 0.09);
    this.tone(680, 0.07, "sine", 0.06, 0.03);
  }

  /** Marble-on-marble clack */
  hit(intensity = 1) {
    this.ensure();
    const now = this.ctx?.currentTime ?? 0;
    if (now < this._hitGate) return;
    this._hitGate = now + 0.035;
    const f = 380 + Math.random() * 220 * intensity;
    this.tone(f, 0.04, "square", 0.05 * intensity);
    this.tone(f * 1.6, 0.03, "triangle", 0.035 * intensity, 0.01);
  }

  /** Pit rim bounce */
  wall() {
    this.tone(220, 0.05, "triangle", 0.045);
    this.tone(160, 0.06, "sine", 0.03, 0.02);
  }

  /** Rolling friction tick (subtle) */
  roll() {
    this.ensure();
    const now = this.ctx?.currentTime ?? 0;
    if (now < this._rollGate) return;
    this._rollGate = now + 0.12;
    this.tone(900 + Math.random() * 400, 0.015, "sine", 0.018);
  }

  /** Marble sinks into hole */
  sink() {
    this.tone(520, 0.06, "triangle", 0.08);
    this.tone(280, 0.14, "sine", 0.07, 0.05);
    this.tone(140, 0.2, "triangle", 0.05, 0.1);
  }

  /** Player scores */
  score() {
    this.tone(523, 0.08, "triangle", 0.09);
    this.tone(659, 0.1, "triangle", 0.08, 0.07);
    this.tone(784, 0.12, "sine", 0.07, 0.14);
  }

  /** Opponent scores */
  losePoint() {
    this.tone(330, 0.1, "triangle", 0.07);
    this.tone(220, 0.14, "sine", 0.06, 0.08);
  }

  /** Round start */
  startBeep() {
    this.tone(440, 0.06, "triangle", 0.07);
    this.tone(554, 0.08, "triangle", 0.07, 0.06);
  }

  /** Victory */
  win() {
    this.tone(523, 0.09, "triangle", 0.09);
    this.tone(659, 0.09, "triangle", 0.09, 0.08);
    this.tone(784, 0.09, "triangle", 0.09, 0.16);
    this.tone(988, 0.18, "sine", 0.08, 0.24);
  }

  /** Defeat */
  over() {
    this.tone(294, 0.12, "triangle", 0.07);
    this.tone(220, 0.18, "sine", 0.06, 0.1);
  }

  /** Turn handoff */
  turn() {
    this.tone(360, 0.05, "sine", 0.04);
  }
}
