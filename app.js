import { MarblePitAudio } from "./audio.js";
import {
  MarblePitGame,
  W,
  H,
  PIT_CX,
  PIT_CY,
  PIT_R,
  MARBLE_R,
  HOLE_R,
  WIN_SINKS,
} from "./game.js";

const BEST_KEY = "pg-marblepit-best";
const audio = new MarblePitAudio();
const game = new MarblePitGame();
globalThis.__marblepit = game;

const canvas = document.getElementById("game");
const ctx = /** @type {HTMLCanvasElement} */ (canvas).getContext("2d");
const scoreEl = document.getElementById("score");
const aiScoreEl = document.getElementById("ai-score");
const bestEl = document.getElementById("best");
const statusEl = document.getElementById("status");
const btnStart = document.getElementById("btn-start");
const btnMute = document.getElementById("btn-mute");

canvas.width = W;
canvas.height = H;

let lastTs = 0;
let running = true;
let pointerId = null;
/** @type {{ x: number, y: number } | null} */
let dragStart = null;
let didDrag = false;

function loadBest() {
  const v = Number(localStorage.getItem(BEST_KEY) || "0");
  return Number.isFinite(v) ? v : 0;
}

function saveBest(n) {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* */
  }
  // KV 為權威；LS 僅快取
  void fetch(`/api/kv/${BEST_KEY}`, { method: "PUT", body: String(n) }).catch(() => {});
}

let bestScore = loadBest();

function setStatus(msg, tone = "") {
  statusEl.textContent = msg;
  statusEl.dataset.tone = tone;
}

function syncHud() {
  scoreEl.textContent = String(game.playerScore);
  aiScoreEl.textContent = String(game.aiScore);
  bestEl.textContent = String(bestScore);

  if (game.status === "ready") {
    btnStart.textContent = "開局";
    btnStart.disabled = false;
  } else if (game.status === "playing") {
    btnStart.textContent = "對戰中";
    btnStart.disabled = true;
  } else {
    btnStart.textContent = "再來一局";
    btnStart.disabled = false;
  }
}

function canvasXY(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * W,
    y: ((clientY - rect.top) / rect.height) * H,
  };
}

function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function pitGradient() {
  const g = ctx.createRadialGradient(
    PIT_CX,
    PIT_CY - 30,
    PIT_R * 0.2,
    PIT_CX,
    PIT_CY,
    PIT_R,
  );
  g.addColorStop(0, "rgba(255,255,255,0.08)");
  g.addColorStop(0.45, "rgba(30,41,59,0.35)");
  g.addColorStop(1, "rgba(15,23,42,0.75)");
  return g;
}

function drawPit() {
  ctx.save();
  const shake = game.shake * 6 * (Math.random() - 0.5);
  ctx.translate(shake, shake * 0.6);

  // Outer rim
  ctx.beginPath();
  ctx.arc(PIT_CX, PIT_CY, PIT_R + 10, 0, Math.PI * 2);
  ctx.fillStyle = "#78350f";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(PIT_CX, PIT_CY, PIT_R + 6, 0, Math.PI * 2);
  ctx.fillStyle = "#92400e";
  ctx.fill();

  // Bowl interior
  ctx.beginPath();
  ctx.arc(PIT_CX, PIT_CY, PIT_R, 0, Math.PI * 2);
  ctx.fillStyle = pitGradient();
  ctx.fill();

  ctx.strokeStyle = "rgba(251,191,36,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Subtle inner ring
  ctx.beginPath();
  ctx.arc(PIT_CX, PIT_CY, PIT_R * 0.55, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

/** @param {import('./game.js').Hole} h */
function drawHole(h) {
  const pulse = 0.85 + Math.sin(h.pulse) * 0.08;
  const r = h.r * pulse;

  ctx.beginPath();
  ctx.arc(h.x, h.y, r + 3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fill();

  const g = ctx.createRadialGradient(h.x, h.y - 2, 1, h.x, h.y, r);
  g.addColorStop(0, "#1e293b");
  g.addColorStop(0.6, "#0f172a");
  g.addColorStop(1, "#020617");
  ctx.beginPath();
  ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = "rgba(148,163,184,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** @param {import('./game.js').Marble} m @param {boolean} [highlight] */
function drawMarble(m, highlight = false) {
  if (m.sunk || !m.active) return;

  const sp = Math.hypot(m.vx, m.vy);
  const spin = sp * 0.002 * performance.now();

  ctx.save();
  ctx.translate(m.x, m.y);

  // Shadow
  ctx.beginPath();
  ctx.ellipse(2, 3, m.r * 0.9, m.r * 0.55, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fill();

  // Glass body
  const body = ctx.createRadialGradient(-m.r * 0.35, -m.r * 0.35, 1, 0, 0, m.r);
  body.addColorStop(0, m.highlight);
  body.addColorStop(0.35, m.color);
  body.addColorStop(0.85, shade(m.color, -30));
  body.addColorStop(1, shade(m.color, -55));

  ctx.beginPath();
  ctx.arc(0, 0, m.r, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  // Specular arc
  ctx.beginPath();
  ctx.arc(-m.r * 0.25, -m.r * 0.3, m.r * 0.55, spin, spin + Math.PI * 0.9);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner swirl (glass depth)
  ctx.beginPath();
  ctx.arc(m.r * 0.15, m.r * 0.2, m.r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();

  if (highlight || m.id === "player") {
    ctx.strokeStyle = "rgba(253,224,71,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, m.r + 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/** @param {string} hex @param {number} amt */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function drawAim() {
  const player = game.getPlayerMarble();
  if (!player || !game.aiming || game.aimPower < 0.05) return;

  const ox = player.x;
  const oy = player.y;
  const dx = -game.aimDx;
  const dy = -game.aimDy;

  ctx.strokeStyle = "rgba(253,224,71,0.75)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + game.aimDx, oy + game.aimDy);
  ctx.stroke();
  ctx.setLineDash([]);

  const power = game.aimPower;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const preview = 40 + power * 70;

  ctx.strokeStyle = `rgba(96,165,250,${0.35 + power * 0.4})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + ux * preview, oy + uy * preview);
  ctx.stroke();

  // Power dots
  for (let i = 1; i <= 5; i++) {
    const on = i / 5 <= power;
    ctx.fillStyle = on ? "#fbbf24" : "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.arc(ox - 28 + i * 10, oy + MARBLE_R + 14, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTurnBadge() {
  if (game.status !== "playing") return;
  const label =
    game.turn === "player" && game.allStopped() && !game.pendingTurn
      ? "你的回合"
      : game.pendingTurn === "ai" || (game.turn === "ai" && !game.allStopped())
        ? "對手回合"
        : "";
  if (!label) return;

  ctx.fillStyle = "rgba(15,23,42,0.72)";
  roundRect(ctx, W / 2 - 52, 12, 104, 28, 8);
  ctx.fill();
  ctx.fillStyle = game.turn === "player" ? "#93c5fd" : "#fca5a5";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, W / 2, 26);
}

function drawBanner(msg) {
  ctx.fillStyle = "rgba(15,23,42,0.78)";
  roundRect(ctx, 24, H / 2 - 30, W - 48, 60, 12);
  ctx.fill();
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(msg, W / 2, H / 2 - 6);
  ctx.font = "500 12px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`先 ${WIN_SINKS} 次入坑者勝`, W / 2, H / 2 + 14);
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // Felt backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a2e1a");
  bg.addColorStop(1, "#0f1a0f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawPit();

  for (const h of game.holes) drawHole(h);

  // Marbles back-to-front by y
  const sorted = [...game.marbles]
    .filter((m) => m.active && !m.sunk)
    .sort((a, b) => a.y - b.y);
  for (const marble of sorted) {
    drawMarble(marble, game.turn === "player" && marble.id === "player");
  }

  drawAim();
  drawTurnBadge();

  // Score pips
  const pipY = H - 22;
  for (let i = 0; i < WIN_SINKS; i++) {
    ctx.fillStyle = i < game.playerScore ? "#60a5fa" : "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.arc(80 + i * 14, pipY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i < game.aiScore ? "#f87171" : "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.arc(W - 80 - i * 14, pipY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = "500 10px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.textAlign = "left";
  ctx.fillText("你", 52, pipY + 14);
  ctx.textAlign = "right";
  ctx.fillText("對手", W - 52, pipY + 14);

  if (game.status === "ready") {
    drawBanner("點開局 · 拖曳彈珠發射");
  } else if (game.status === "over") {
    drawBanner(game.message);
  }
}

/** @param {string[]} events */
function handleEvents(events) {
  for (const e of events) {
    if (e === "flick") audio.flick();
    else if (e === "aiFlick") audio.flick();
    else if (e === "hit") audio.hit();
    else if (e === "wall") audio.wall();
    else if (e === "sink") audio.sink();
    else if (e === "playerScore") {
      audio.score();
      if (game.playerScore > bestScore) {
        bestScore = game.playerScore;
        saveBest(bestScore);
      }
      setStatus(`入坑！你 ${game.playerScore} ：${game.aiScore} 對手`, "win");
    } else if (e === "aiScore") {
      audio.losePoint();
      setStatus(`你的彈珠入坑… ${game.playerScore} ：${game.aiScore}`, "warn");
    } else if (e === "turnPlayer") {
      audio.turn();
    } else if (e === "win") {
      audio.win();
      if (game.playerScore > bestScore) {
        bestScore = game.playerScore;
        saveBest(bestScore);
      }
      setStatus(game.message, "win");
    } else if (e === "lose") {
      audio.over();
      setStatus(game.message, "warn");
    }
  }
}

function frame(ts) {
  if (!running) return;
  const dt = Math.min(0.05, (ts - lastTs) / 1000) || 0.016;
  lastTs = ts;

  const { events } = game.update(dt);
  if (events.length) handleEvents(events);

  if (game.status === "playing" && !game.allStopped(30)) {
    if (Math.random() < 0.08) audio.roll();
  }

  draw();
  syncHud();
  requestAnimationFrame(frame);
}

async function tryStart() {
  await audio.unlock();
  game.start();
  audio.startBeep();
  setStatus("輪到你：拖曳你的彈珠反向拉弓");
  syncHud();
}

btnStart.addEventListener("click", () => {
  void tryStart();
});

btnMute.addEventListener("click", async () => {
  await audio.unlock();
  audio.setEnabled(!audio.enabled);
  btnMute.textContent = audio.enabled ? "音效開" : "音效關";
  btnMute.setAttribute("aria-pressed", audio.enabled ? "true" : "false");
});

canvas.addEventListener("pointerdown", async (e) => {
  await audio.unlock();
  if (game.status !== "playing") {
    void tryStart();
    return;
  }
  if (game.turn !== "player" || !game.allStopped()) return;

  const player = game.getPlayerMarble();
  if (!player) return;

  const { x, y } = canvasXY(e.clientX, e.clientY);
  const dist = Math.hypot(x - player.x, y - player.y);
  if (dist > player.r + 28) return;

  canvas.setPointerCapture(e.pointerId);
  pointerId = e.pointerId;
  dragStart = { x, y };
  didDrag = false;
  game.setAim(x - player.x, y - player.y);
});

canvas.addEventListener("pointermove", (e) => {
  if (pointerId !== e.pointerId || !dragStart) return;
  const player = game.getPlayerMarble();
  if (!player) return;
  const { x, y } = canvasXY(e.clientX, e.clientY);
  const dx = x - player.x;
  const dy = y - player.y;
  if (Math.hypot(dx, dy) > 10) didDrag = true;
  game.setAim(dx, dy);
});

/** @param {PointerEvent} e @param {boolean} release */
function endPointer(e, release) {
  if (pointerId !== e.pointerId) return;
  pointerId = null;
  dragStart = null;

  if (!release) {
    game.clearAim();
    didDrag = false;
    return;
  }

  if (didDrag && game.aimPower >= 0.08) {
    const { events } = game.flickPlayer();
    handleEvents(events);
  } else {
    game.clearAim();
  }
  didDrag = false;
}

canvas.addEventListener("pointerup", (e) => endPointer(e, true));
canvas.addEventListener("pointercancel", (e) => endPointer(e, false));

window.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    if (game.status !== "playing") void tryStart();
  }
});

document.body.addEventListener(
  "pointerdown",
  () => {
    void audio.unlock();
  },
  { once: true },
);

setStatus("點開局 · 拖曳彈珠入坑得分");
// KV 為權威；本地快取過舊時以遠端為準
void fetch(`/api/kv/${BEST_KEY}`)
  .then((r) => (r.ok ? r.text() : null))
  .then((raw) => {
    const n = Math.max(0, Number(raw) || 0);
    if (n > bestScore) {
      bestScore = n;
      syncHud();
    }
  })
  .catch(() => {});
syncHud();
requestAnimationFrame((ts) => {
  lastTs = ts;
  requestAnimationFrame(frame);
});
