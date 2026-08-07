/**
 * 玻璃彈珠坑 — circular pit physics, turn-based flick combat.
 */

export const W = 360;
export const H = 480;
export const PIT_CX = W / 2;
export const PIT_CY = H * 0.56;
export const PIT_R = 148;
export const MARBLE_R = 11;
export const HOLE_R = 16;
export const SINK_SPEED = 95;
export const WIN_SINKS = 3;
export const AI_COUNT = 5;
export const FIXED_DT = 1 / 240;
export const MAX_SPEED = 1400;

export const RESTITUTION = 0.82;
export const WALL_RESTITUTION = 0.55;
export const FRICTION = 0.992;
export const ROLL_FRICTION = 0.988;
export const MIN_SPEED = 4;

/** @typedef {'player' | 'ai' | 'neutral'} MarbleTeam */

/**
 * @typedef {object} Hole
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} pulse
 */

/**
 * @typedef {object} Marble
 * @property {string} id
 * @property {MarbleTeam} team
 * @property {string} label
 * @property {string} color
 * @property {string} highlight
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} r
 * @property {boolean} active
 * @property {boolean} sunk
 */

const AI_PALETTE = [
  { color: "#f87171", highlight: "#fecaca", label: "紅" },
  { color: "#fb923c", highlight: "#fed7aa", label: "橙" },
  { color: "#a3e635", highlight: "#ecfccb", label: "綠" },
  { color: "#c084fc", highlight: "#e9d5ff", label: "紫" },
  { color: "#f472b6", highlight: "#fbcfe8", label: "粉" },
  { color: "#38bdf8", highlight: "#bae6fd", label: "青" },
];

/**
 * @param {number} n
 * @param {number} maxR
 */
function spreadAngle(n, maxR) {
  return ((n * 2.399963) % (Math.PI * 2));
}

export class MarblePitGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.playerScore = 0;
    this.aiScore = 0;
    this.turn = /** @type {'player' | 'ai'} */ ("player");
    /** Who acts after the table settles. */
    this.pendingTurn = /** @type {'player' | 'ai' | null} */ (null);
    /** @type {'ready' | 'playing' | 'over'} */
    this.status = "ready";
    this.message = "點開局，拖曳你的彈珠瞄準放開";
    this.aiming = false;
    this.aimDx = 0;
    this.aimDy = 0;
    this.aimPower = 0;
    this.aiDelay = 0;
    this.aiMarbleId = null;
    this.shake = 0;
    this.physAcc = 0;
    this.lastSinkTeam = null;
    this.holes = this.buildHoles();
    this.marbles = this.buildMarbles();
  }

  buildHoles() {
    /** @type {Hole[]} */
    const holes = [];
    const positions = [
      { ax: 0, ar: 0.62 },
      { ax: Math.PI * 0.55, ar: 0.68 },
      { ax: Math.PI * 1.05, ar: 0.68 },
      { ax: Math.PI * 1.55, ar: 0.62 },
      { ax: Math.PI * 0.25, ar: 0.38 },
    ];
    for (const p of positions) {
      const d = p.ar * (PIT_R - HOLE_R - 8);
      holes.push({
        x: PIT_CX + Math.cos(p.ax) * d,
        y: PIT_CY + Math.sin(p.ax) * d,
        r: HOLE_R,
        pulse: Math.random() * Math.PI * 2,
      });
    }
    return holes;
  }

  buildMarbles() {
    /** @type {Marble[]} */
    const marbles = [];
    const player = {
      id: "player",
      team: /** @type {MarbleTeam} */ ("player"),
      label: "你",
      color: "#60a5fa",
      highlight: "#dbeafe",
      x: PIT_CX,
      y: PIT_CY + PIT_R * 0.42,
      vx: 0,
      vy: 0,
      r: MARBLE_R,
      active: true,
      sunk: false,
    };
    marbles.push(player);

    for (let i = 0; i < AI_COUNT; i++) {
      const pal = AI_PALETTE[i % AI_PALETTE.length];
      const ang = spreadAngle(i, PIT_R);
      const dist = PIT_R * (0.18 + (i % 3) * 0.14);
      marbles.push({
        id: `ai-${i}`,
        team: "ai",
        label: pal.label,
        color: pal.color,
        highlight: pal.highlight,
        x: PIT_CX + Math.cos(ang) * dist,
        y: PIT_CY + Math.sin(ang) * dist * 0.85 - 20,
        vx: 0,
        vy: 0,
        r: MARBLE_R,
        active: true,
        sunk: false,
      });
    }
    return marbles;
  }

  start() {
    this.reset();
    this.status = "playing";
    this.message = "輪到你：拖曳彈珠反向拉弓，放開發射";
    this.turn = "player";
  }

  /** @returns {Marble | undefined} */
  getPlayerMarble() {
    return this.marbles.find((m) => m.id === "player" && m.active && !m.sunk);
  }

  /** @returns {Marble[]} */
  getActiveAi() {
    return this.marbles.filter((m) => m.team === "ai" && m.active && !m.sunk);
  }

  allStopped(threshold = MIN_SPEED) {
    for (const m of this.marbles) {
      if (!m.active || m.sunk) continue;
      if (Math.hypot(m.vx, m.vy) > threshold) return false;
    }
    return true;
  }

  /** @param {number} dx @param {number} dy */
  setAim(dx, dy) {
    if (this.status !== "playing" || this.turn !== "player" || this.pendingTurn)
      return;
    const player = this.getPlayerMarble();
    if (!player || !this.allStopped()) return;
    this.aiming = true;
    const maxPull = 90;
    const len = Math.hypot(dx, dy) || 1;
    const scale = Math.min(maxPull, len) / len;
    this.aimDx = dx * scale;
    this.aimDy = dy * scale;
    this.aimPower = Math.min(1, len / maxPull);
  }

  clearAim() {
    this.aiming = false;
    this.aimDx = 0;
    this.aimDy = 0;
    this.aimPower = 0;
  }

  /** @returns {{ events: string[] }} */
  flickPlayer() {
    const events = [];
    const player = this.getPlayerMarble();
    if (!player || !this.allStopped() || this.turn !== "player") {
      return { events };
    }
    if (this.aimPower < 0.08) {
      this.clearAim();
      return { events };
    }
    const pullLen = Math.hypot(this.aimDx, this.aimDy) || 1;
    const ux = -this.aimDx / pullLen;
    const uy = -this.aimDy / pullLen;
    const speed = 180 + this.aimPower * 620;
    player.vx = ux * speed;
    player.vy = uy * speed;
    this.clearAim();
    this.turn = "ai";
    this.pendingTurn = "ai";
    this.aiDelay = 0.55;
    this.message = "彈珠滾動中…";
    events.push("flick");
    return { events };
  }

  /** @returns {{ events: string[] }} */
  aiTakeTurn() {
    const events = [];
    const ais = this.getActiveAi();
    if (!ais.length) return { events };

    /** Pick AI marble farthest from any hole (most "stuck") or random */
    let pick = ais[Math.floor(Math.random() * ais.length)];
    let best = -1;
    for (const m of ais) {
      let minHole = Infinity;
      for (const h of this.holes) {
        minHole = Math.min(minHole, Math.hypot(m.x - h.x, m.y - h.y));
      }
      if (minHole > best) {
        best = minHole;
        pick = m;
      }
    }

    const player = this.getPlayerMarble();
    /** Target: player marble 40%, nearest hole 35%, random 25% */
    const roll = Math.random();
    let tx;
    let ty;
    if (player && roll < 0.4) {
      tx = player.x;
      ty = player.y;
    } else if (roll < 0.75) {
      let nearest = this.holes[0];
      let nd = Infinity;
      for (const h of this.holes) {
        const d = Math.hypot(pick.x - h.x, pick.y - h.y);
        if (d < nd) {
          nd = d;
          nearest = h;
        }
      }
      tx = nearest.x;
      ty = nearest.y;
    } else {
      const ang = Math.random() * Math.PI * 2;
      tx = PIT_CX + Math.cos(ang) * PIT_R * 0.5;
      ty = PIT_CY + Math.sin(ang) * PIT_R * 0.5;
    }

    const dx = tx - pick.x;
    const dy = ty - pick.y;
    const len = Math.hypot(dx, dy) || 1;
    const power = 0.45 + Math.random() * 0.45;
    const speed = 160 + power * 520;
    pick.vx = (dx / len) * speed + (Math.random() - 0.5) * 40;
    pick.vy = (dy / len) * speed + (Math.random() - 0.5) * 40;
    this.aiMarbleId = pick.id;
    this.turn = "ai";
    this.pendingTurn = "player";
    this.message = `${pick.label}珠反擊中…`;
    events.push("aiFlick");
    return { events };
  }

  /**
   * @param {Marble} a
   * @param {Marble} b
   * @returns {boolean} collision happened
   */
  resolveMarbleCollision(a, b) {
    if (!a.active || !b.active || a.sunk || b.sunk) return false;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = a.r + b.r;
    if (dist >= minDist || dist < 0.001) return false;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    const totalMass = 2;
    a.x -= (nx * overlap) / 2;
    a.y -= (ny * overlap) / 2;
    b.x += (nx * overlap) / 2;
    b.y += (ny * overlap) / 2;

    const dvx = a.vx - b.vx;
    const dvy = a.vy - b.vy;
    const rel = dvx * nx + dvy * ny;
    if (rel > 0) return true;

    const impulse = (-(1 + RESTITUTION) * rel) / totalMass;
    a.vx += impulse * nx;
    a.vy += impulse * ny;
    b.vx -= impulse * nx;
    b.vy -= impulse * ny;

    const tx = -ny;
    const ty = nx;
    const slip = (a.vx - b.vx) * tx + (a.vy - b.vy) * ty;
    const frictionImp = -slip * 0.12;
    a.vx += frictionImp * tx;
    a.vy += frictionImp * ty;
    b.vx -= frictionImp * tx;
    b.vy -= frictionImp * ty;

    return true;
  }

  /** @param {Marble} m */
  resolveWall(m) {
    const dx = m.x - PIT_CX;
    const dy = m.y - PIT_CY;
    const dist = Math.hypot(dx, dy);
    const maxDist = PIT_R - m.r;
    if (dist <= maxDist || dist < 0.001) return false;

    const nx = dx / dist;
    const ny = dy / dist;
    m.x = PIT_CX + nx * maxDist;
    m.y = PIT_CY + ny * maxDist;

    const vn = m.vx * nx + m.vy * ny;
    if (vn > 0) {
      m.vx -= (1 + WALL_RESTITUTION) * vn * nx;
      m.vy -= (1 + WALL_RESTITUTION) * vn * ny;
      const tx = -ny;
      const ty = nx;
      const vt = m.vx * tx + m.vy * ty;
      m.vx -= vt * 0.15 * tx;
      m.vy -= vt * 0.15 * ty;
      return true;
    }
    return false;
  }

  /** @param {Marble} m @returns {boolean} */
  checkSink(m) {
    if (!m.active || m.sunk) return false;
    const speed = Math.hypot(m.vx, m.vy);
    if (speed > SINK_SPEED) return false;

    for (const h of this.holes) {
      const d = Math.hypot(m.x - h.x, m.y - h.y);
      if (d < h.r - m.r * 0.35) {
        m.sunk = true;
        m.active = false;
        m.vx = 0;
        m.vy = 0;
        h.pulse = 0;
        return true;
      }
    }
    return false;
  }

  clampSpeed(m) {
    const sp = Math.hypot(m.vx, m.vy);
    if (sp > MAX_SPEED) {
      m.vx = (m.vx / sp) * MAX_SPEED;
      m.vy = (m.vy / sp) * MAX_SPEED;
    }
  }

  /** @param {number} dt */
  stepPhysics(dt) {
    /** @type {string[]} */
    const events = [];

    for (const m of this.marbles) {
      if (!m.active || m.sunk) continue;
      m.vx *= FRICTION;
      m.vy *= FRICTION;
      const sp = Math.hypot(m.vx, m.vy);
      if (sp > 30) {
        m.vx *= ROLL_FRICTION;
        m.vy *= ROLL_FRICTION;
      }
      if (sp < MIN_SPEED) {
        m.vx = 0;
        m.vy = 0;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      this.clampSpeed(m);
    }

    const active = this.marbles.filter((m) => m.active && !m.sunk);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        if (this.resolveMarbleCollision(active[i], active[j])) {
          events.push("hit");
        }
      }
    }

    for (const m of active) {
      if (this.resolveWall(m)) events.push("wall");
    }

    for (const m of active) {
      if (this.checkSink(m)) {
        events.push("sink");
        this.lastSinkTeam = m.team;
        if (m.team === "ai") {
          this.playerScore += 1;
          events.push("playerScore");
        } else if (m.team === "player") {
          this.aiScore += 1;
          events.push("aiScore");
        }
        this.shake = 0.35;
      }
    }

    for (const h of this.holes) {
      h.pulse += dt * 3;
    }

    return events;
  }

  checkWin() {
    if (this.playerScore >= WIN_SINKS) {
      this.status = "over";
      this.message = `你贏了！入坑 ${this.playerScore} 顆對手珠`;
      return "win";
    }
    if (this.aiScore >= WIN_SINKS) {
      this.status = "over";
      this.message = `對手贏了… 你的彈珠已入坑 ${this.aiScore} 次`;
      return "lose";
    }
    const aiLeft = this.getActiveAi().length;
    if (aiLeft === 0 && this.playerScore > this.aiScore) {
      this.status = "over";
      this.message = `清台！入坑 ${this.playerScore} 顆`;
      return "win";
    }
    const player = this.getPlayerMarble();
    if (!player && this.aiScore < WIN_SINKS && this.playerScore < WIN_SINKS) {
      this.status = "over";
      this.message = "你的彈珠已全數入坑…";
      return "lose";
    }
    return null;
  }

  /** @param {number} dt */
  update(dt) {
    /** @type {string[]} */
    const events = [];
    if (this.status !== "playing") return { events };

    this.physAcc += dt;
    while (this.physAcc >= FIXED_DT) {
      events.push(...this.stepPhysics(FIXED_DT));
      this.physAcc -= FIXED_DT;
    }

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.5);

    const outcome = this.checkWin();
    if (outcome) {
      events.push(outcome);
      return { events };
    }

    if (this.allStopped()) {
      if (this.pendingTurn === "player") {
        this.turn = "player";
        this.pendingTurn = null;
        if (this.getPlayerMarble()) {
          this.message = "輪到你：拖曳瞄準放開";
          events.push("turnPlayer");
        }
      }
    }

    if (
      this.pendingTurn === "ai" &&
      this.allStopped() &&
      this.getActiveAi().length
    ) {
      if (this.aiDelay > 0) {
        this.aiDelay -= dt;
      } else {
        events.push(...this.aiTakeTurn().events);
      }
    }

    return { events };
  }
}
