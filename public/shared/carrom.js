// Carrom: rules and the small physics engine behind every shot.
// Used by the room server (src/worker.js) and by the browser (Play vs computer, and to replay each shot on screen).
//
// Same shape as game.js, ludo.js and poker.js: newRoom, addPlayer, removePlayer, handle, viewFor, summary,
// refreshDeadline, timeoutMove, roundTimeUp, nextBotAction.
//
// The board is a 100 × 100 square (0,0 top-left). Pockets sit in the four corners.
// Players sit on sides: 0 bottom, 1 right, 2 top, 3 left. Two players use sides 0 and 2.
// A shot is { t: 'shot', pos: 0..1 along your baseline, vx, vy } with the speed in board units per second.
// The shot is simulated here with plain arithmetic only (+ − × ÷ √), so the phone replaying it gets the same
// path as the server. The server's result is what counts; the phone snaps to it when the replay ends.

export const GAME = 'carrom';
export const MAX_PLAYERS = 4;
export const MAX_BOTS = 3;
export const TURN_TIMES = [0, 15, 20, 30, 45, 60];
export const IDLE_KICK = 5;
const LOG_MAX = 30;

// sizes, in board units (a real board's playing surface is 74 cm, so 1 unit ≈ 7.4 mm)
export const COIN_R = 2.15, STRIKER_R = 2.8, POCKET_R = 3.7, POCKET_AT = 3.4;
export const BASE = 18, BASE_FROM = 23, BASE_TO = 77; // baseline: this far from your edge, between these marks
export const V_MIN = 30, V_MAX = 240;                  // slowest and fastest shot
const FRICTION = 52;        // how fast things slow down (units per second, each second)
const WALL_BOUNCE = 0.72, HIT_BOUNCE = 0.93;
const COIN_M = 1, STRIKER_M = 2.7;
export const HZ = 120;      // physics steps per second
const DT = 1 / HZ;
const MAX_STEPS = HZ * 14;
export const POINTS = { b: 10, w: 20, q: 50 };
export const POCKETS = [[POCKET_AT, POCKET_AT], [100 - POCKET_AT, POCKET_AT], [100 - POCKET_AT, 100 - POCKET_AT], [POCKET_AT, 100 - POCKET_AT]];
const INWARD = [[0, -1], [-1, 0], [0, 1], [1, 0]]; // which way "forward" is from each side

function randInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}
export function randomId(len = 16) {
  const chars = 'abcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[randInt(chars.length)];
  return s;
}

// ───────────────────────────────────────────────────────────
// Physics
// ───────────────────────────────────────────────────────────
// Where the striker sits for a side, `pos` 0..1 along that side's baseline (left to right as that player sees it)
export function strikerSpot(side, pos) {
  const a = BASE_FROM + (BASE_TO - BASE_FROM) * Math.min(1, Math.max(0, pos));
  if (side === 0) return [a, 100 - BASE];
  if (side === 1) return [100 - BASE, 100 - a];
  if (side === 2) return [100 - a, BASE];
  return [BASE, a];
}
// A simulation in progress. bodies: [{ id, x, y, vx, vy, r, m }]; the striker has id 's'.
export function newSim(coins, sx, sy, vx, vy) {
  const bodies = coins.filter(c => c.on).map(c => ({ id: c.id, x: c.x, y: c.y, vx: 0, vy: 0, r: COIN_R, m: COIN_M }));
  bodies.push({ id: 's', x: sx, y: sy, vx, vy, r: STRIKER_R, m: STRIKER_M });
  return { bodies, step: 0, pocketed: [], hits: 0, done: false };
}
// One step of 1/120 s. Returns false once everything has stopped.
export function simStep(sim) {
  if (sim.done) return false;
  const B = sim.bodies;
  let moving = false;
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    if (b.out) continue;
    if (b.vx !== 0 || b.vy !== 0) {
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      const drop = FRICTION * DT;
      if (sp <= drop) { b.vx = 0; b.vy = 0; }
      else { const k = (sp - drop) / sp; b.vx *= k; b.vy *= k; b.x += b.vx * DT; b.y += b.vy * DT; moving = true; }
    }
    // into a pocket?
    for (let p = 0; p < 4; p++) {
      const dx = b.x - POCKETS[p][0], dy = b.y - POCKETS[p][1];
      if (dx * dx + dy * dy < POCKET_R * POCKET_R) { b.out = true; b.vx = 0; b.vy = 0; sim.pocketed.push({ id: b.id, pocket: p, step: sim.step }); break; }
    }
    if (b.out) continue;
    // cushions
    // (sim.events, when the caller has set it to a list, collects knocks for the sound effects; it never changes the physics)
    if (b.x < b.r) { b.x = b.r; if (b.vx < 0) { if (sim.events) sim.events.push({ k: 'wall', v: -b.vx, s: b.id === 's' }); b.vx = -b.vx * WALL_BOUNCE; } }
    else if (b.x > 100 - b.r) { b.x = 100 - b.r; if (b.vx > 0) { if (sim.events) sim.events.push({ k: 'wall', v: b.vx, s: b.id === 's' }); b.vx = -b.vx * WALL_BOUNCE; } }
    if (b.y < b.r) { b.y = b.r; if (b.vy < 0) { if (sim.events) sim.events.push({ k: 'wall', v: -b.vy, s: b.id === 's' }); b.vy = -b.vy * WALL_BOUNCE; } }
    else if (b.y > 100 - b.r) { b.y = 100 - b.r; if (b.vy > 0) { if (sim.events) sim.events.push({ k: 'wall', v: b.vy, s: b.id === 's' }); b.vy = -b.vy * WALL_BOUNCE; } }
  }
  // pieces hitting each other
  for (let i = 0; i < B.length; i++) {
    const a = B[i];
    if (a.out) continue;
    for (let j = i + 1; j < B.length; j++) {
      const b = B[j];
      if (b.out) continue;
      const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      const over = min - d, ia = 1 / a.m, ib = 1 / b.m;
      a.x -= nx * over * ia / (ia + ib); a.y -= ny * over * ia / (ia + ib);
      b.x += nx * over * ib / (ia + ib); b.y += ny * over * ib / (ia + ib);
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const jimp = -(1 + HIT_BOUNCE) * rel / (ia + ib);
        a.vx -= jimp * ia * nx; a.vy -= jimp * ia * ny;
        b.vx += jimp * ib * nx; b.vy += jimp * ib * ny;
        sim.hits++;
        if (sim.events) sim.events.push({ k: 'hit', v: -rel, s: a.id === 's' || b.id === 's' });
        moving = true;
      }
    }
  }
  sim.step++;
  if (!moving || sim.step >= MAX_STEPS) { sim.done = true; for (const b of B) { b.vx = 0; b.vy = 0; } }
  return !sim.done;
}
export function runSim(sim) { while (simStep(sim)); return sim; }

// ───────────────────────────────────────────────────────────
// Room
// ───────────────────────────────────────────────────────────
export function newRoom() {
  return {
    game: GAME,
    phase: 'lobby', // lobby | playing | ended
    players: [],    // { id, token, name, side, colour ('w'|'b' in classic), score (points mode), got: { w, b, q } }
    spectators: [],
    hostId: null,
    settings: {
      rules: 'classic',   // classic (black and white, cover the queen) | points (any coin: black 10, white 20, queen 50)
      botLevel: 'normal', turnTime: 30, private: false, reactions: false,
    },
    round: 0,
    coins: [],       // { id, c: 'w'|'b'|'q', x, y, on }
    turn: 0,
    cover: null,     // id of the player who pocketed the queen and must cover it with their next shot
    queen: 'board',  // board | pending | covered
    queenBy: null,   // classic: 'w' or 'b'; points: the player's id
    shots: 0,
    turnNo: 0, actNo: 0,
    animMs: 0,
    deadline: null, deadlineFor: -1,
    roundEndsAt: null,
    lastRound: null, // { winnerId, winnerIds, colour, points, scores: { id: n }, rules }
    log: [],
    seq: 0,
  };
}

function log(s, entry) {
  s.seq++;
  s.log.push({ n: s.seq, ...entry });
  if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX);
}
const playerById = (s, id) => s.players.find(p => p.id === id);
const spectatorById = (s, id) => (s.spectators || []).find(p => p.id === id);
const firstHuman = s => [...s.players, ...(s.spectators || [])].find(p => !p.bot)?.id ?? null;
const current = s => s.players[s.turn];
const left = (s, c) => s.coins.filter(k => k.on && k.c === c).length;
const classic = s => s.settings.rules !== 'points';

function cleanName(name) {
  const n = String(name || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20);
  return n || 'Player';
}
function uniqueName(s, name) {
  let n = name, i = 2;
  const all = [...s.players, ...(s.spectators || [])];
  while (all.some(p => p.name.toLowerCase() === n.toLowerCase())) n = `${name} ${i++}`;
  return n;
}
function seatSpectators(s) {
  while (s.spectators?.length && s.players.length < MAX_PLAYERS) s.players.push(s.spectators.shift());
}

export function addPlayer(s, name, opts = {}) {
  const p = { id: randomId(10), token: randomId(24), name: uniqueName(s, cleanName(name)), side: 0, colour: 'w', score: 0, got: { w: 0, b: 0, q: 0 } };
  if (opts.bot) { p.bot = true; p.level = opts.level === 'easy' ? 'easy' : 'normal'; }
  if (s.phase === 'playing' || s.players.length >= MAX_PLAYERS) {
    s.spectators ||= [];
    s.spectators.push(p);
    log(s, { k: 'watch', p: p.name, full: s.phase !== 'playing' });
  } else {
    s.players.push(p);
    log(s, { k: 'join', p: p.name });
  }
  if (!s.hostId && !p.bot) s.hostId = p.id;
  return p;
}

export function removePlayer(s, id, kind = 'leave') {
  const si = (s.spectators || []).findIndex(p => p.id === id);
  if (si >= 0) {
    const [sp] = s.spectators.splice(si, 1);
    log(s, { k: kind, p: sp.name });
    if (s.hostId === id) s.hostId = firstHuman(s);
    return;
  }
  const i = s.players.findIndex(p => p.id === id);
  if (i < 0) return;
  const [p] = s.players.splice(i, 1);
  log(s, { k: kind, p: p.name });
  if (s.hostId === id) s.hostId = firstHuman(s);
  if (s.phase === 'playing') {
    // carrom needs every seat: the board stops and everyone goes back to the waiting room
    s.phase = 'lobby'; s.deadline = null; s.coins = []; s.cover = null;
    log(s, { k: 'toofew' });
  }
  if (s.phase !== 'playing') seatSpectators(s);
}

// The opening layout: queen in the middle, six round it, twelve round those
function rack() {
  const coins = [{ id: 0, c: 'q', x: 50, y: 50, on: true }];
  const C = [1, 0.5, -0.5, -1, -0.5, 0.5], S = [0, 0.8660254037844386, 0.8660254037844386, 0, -0.8660254037844386, -0.8660254037844386]; // cos, sin of 0°, 60°, …
  const C30 = [0.8660254037844386, 0, -0.8660254037844386, -0.8660254037844386, 0, 0.8660254037844386], S30 = [0.5, 1, 0.5, -0.5, -1, -0.5];   // 30°, 90°, …
  const d = COIN_R * 2 + 0.06;
  let id = 1;
  for (let k = 0; k < 6; k++) coins.push({ id: id++, c: k % 2 ? 'b' : 'w', x: 50 + d * C[k], y: 50 + d * S[k], on: true });
  for (let k = 0; k < 6; k++) coins.push({ id: id++, c: 'w', x: 50 + 2 * d * C[k], y: 50 + 2 * d * S[k], on: true });
  for (let k = 0; k < 6; k++) coins.push({ id: id++, c: 'b', x: 50 + 1.7320508075688772 * d * C30[k], y: 50 + 1.7320508075688772 * d * S30[k], on: true });
  return coins;
}

export function startRound(s) {
  seatSpectators(s);
  const n = s.players.length;
  if (n !== 2 && n !== 4) return 'Carrom needs 2 or 4 players';
  s.phase = 'playing';
  s.round++;
  s.coins = rack();
  s.players.forEach((p, i) => {
    p.side = n === 2 ? [0, 2][i] : i;
    p.colour = i % 2 === 0 ? 'w' : 'b';
    p.score = 0; p.got = { w: 0, b: 0, q: 0 }; p.idle = 0;
  });
  s.turn = 0; // white breaks
  s.cover = null; s.queen = 'board'; s.queenBy = null; s.shots = 0;
  s.lastRound = null;
  s.turnNo++; s.actNo++;
  s.animMs = 0;
  log(s, { k: 'cstart', rules: s.settings.rules, p: s.players[0].name });
  return null;
}

// Put a coin back near the centre, in the nearest free place
const RING = [[1, 0], [0.5, 0.866], [-0.5, 0.866], [-1, 0], [-0.5, -0.866], [0.5, -0.866], [0.866, 0.5], [0, 1], [-0.866, 0.5], [-0.866, -0.5], [0, -1], [0.866, -0.5]];
function toCentre(s, coin) {
  const free = (x, y) => s.coins.every(k => !k.on || k === coin || (k.x - x) * (k.x - x) + (k.y - y) * (k.y - y) >= (COIN_R * 2 + 0.05) * (COIN_R * 2 + 0.05));
  let spot = [50, 50];
  if (!free(50, 50)) {
    search: for (let ring = 1; ring < 12; ring++) for (const [cx, cy] of RING) {
      const x = 50 + cx * ring * 2.3, y = 50 + cy * ring * 2.3;
      if (free(x, y)) { spot = [x, y]; break search; }
    }
  }
  coin.x = spot[0]; coin.y = spot[1]; coin.on = true;
}

function passTurn(s) {
  s.turn = (s.turn + 1) % s.players.length;
  s.turnNo++;
}

function finish(s, info) {
  s.phase = 'ended';
  s.deadline = null;
  s.cover = null;
  s.lastRound = info;
  log(s, { k: 'cend', ...info, names: info.winnerIds.map(id => playerById(s, id)?.name || '?') });
}

// Work out what a finished shot means under the room's rules
function settle(s, p, sim) {
  const foul = sim.pocketed.some(x => x.id === 's');
  const sunk = sim.pocketed.filter(x => x.id !== 's').map(x => s.coins.find(k => k.id === x.id));
  // board after the shot
  for (const b of sim.bodies) {
    if (b.id === 's') continue;
    const k = s.coins.find(c => c.id === b.id);
    k.x = b.x; k.y = b.y; k.on = !b.out;
  }
  const q = sunk.find(k => k.c === 'q') || null;
  const wasCover = s.cover === p.id; // I pocketed the queen with my last shot and owe a cover
  const res = { k: 'cres', p: p.name, id: p.id, own: 0, opp: 0, pts: 0, foul, queen: null, again: false, back: 0 };
  const queenCoin = s.coins.find(k => k.c === 'q');
  const queenBack = () => { toCentre(s, queenCoin); s.queen = 'board'; s.queenBy = null; s.cover = null; res.queen = 'returned'; };

  if (classic(s)) {
    const own = sunk.filter(k => k.c === p.colour), opp = sunk.filter(k => k.c !== p.colour && k.c !== 'q');
    const other = p.colour === 'w' ? 'b' : 'w';
    res.opp = opp.length;
    if (foul) {
      // striker in a pocket: your coins from this shot come back, plus one more as a penalty; the queen comes back too
      for (const k of own) { toCentre(s, k); res.back++; }
      const mineIn = s.coins.find(k => !k.on && k.c === p.colour);
      if (mineIn) { toCentre(s, mineIn); res.back++; }
      if (q || wasCover) queenBack();
    } else {
      res.own = own.length;
      if (q) {
        if (own.length) { s.queen = 'covered'; s.queenBy = p.colour; s.cover = null; res.queen = 'covered'; }
        else { s.queen = 'pending'; s.cover = p.id; res.queen = 'pending'; }
      } else if (wasCover) {
        if (own.length) { s.queen = 'covered'; s.queenBy = p.colour; s.cover = null; res.queen = 'covered'; }
        else queenBack();
      }
      res.again = own.length > 0 || res.queen === 'pending';
    }
    // nobody may finish before the queen is covered: a last coin pocketed too early comes back
    if (s.queen !== 'covered') {
      for (const c of [p.colour, other]) {
        if (left(s, c) === 0) {
          const last = [...sunk].reverse().find(k => k.c === c) || s.coins.find(k => !k.on && k.c === c);
          if (last) { toCentre(s, last); res.early = true; if (c === p.colour) { res.own = Math.max(0, res.own - 1); res.again = false; } else res.opp = Math.max(0, res.opp - 1); }
        }
      }
    }
    for (const q2 of s.players) q2.got = { w: 9 - left(s, 'w'), b: 9 - left(s, 'b'), q: s.queen === 'covered' && s.queenBy === q2.colour ? 1 : 0 };
    log(s, res);
    const done = left(s, p.colour) === 0 ? p.colour : left(s, other) === 0 ? other : null;
    if (done && s.queen === 'covered') {
      const loser = done === 'w' ? 'b' : 'w';
      const points = left(s, loser) + (s.queenBy === done ? 3 : 0);
      const winners = s.players.filter(x => x.colour === done).map(x => x.id);
      return finish(s, { winnerId: winners[0], winnerIds: winners, colour: done, points, rules: 'classic', scores: {} });
    }
  } else {
    const plain = sunk.filter(k => k.c !== 'q');
    if (foul) {
      for (const k of plain) { toCentre(s, k); res.back++; }
      if (q || wasCover) queenBack();
      const fine = Math.min(10, p.score);
      p.score -= fine; res.pts = -fine;
    } else {
      for (const k of plain) { p.score += POINTS[k.c]; res.pts += POINTS[k.c]; p.got[k.c]++; }
      res.own = plain.length;
      const cover = () => { s.queen = 'covered'; s.queenBy = p.id; s.cover = null; p.score += POINTS.q; res.pts += POINTS.q; p.got.q = 1; res.queen = 'covered'; };
      if (q) { if (plain.length) cover(); else { s.queen = 'pending'; s.cover = p.id; res.queen = 'pending'; } }
      else if (wasCover) { if (plain.length) cover(); else queenBack(); }
      res.again = plain.length > 0 || res.queen === 'pending';
      // the last coin cannot go before the queen is covered
      if (s.queen !== 'covered' && left(s, 'w') + left(s, 'b') === 0 && plain.length) {
        const last = plain[plain.length - 1];
        toCentre(s, last); p.score -= POINTS[last.c]; res.pts -= POINTS[last.c]; p.got[last.c]--; res.early = true; res.again = false;
        if (s.queen === 'pending') queenBack();
      }
    }
    log(s, res);
    if (left(s, 'w') + left(s, 'b') === 0 && s.queen === 'covered') {
      const top = Math.max(...s.players.map(x => x.score));
      const winners = s.players.filter(x => x.score === top).map(x => x.id);
      return finish(s, { winnerId: winners[0], winnerIds: winners, colour: null, points: top, rules: 'points', scores: Object.fromEntries(s.players.map(x => [x.id, x.score])) });
    }
  }
  if (!res.again) passTurn(s);
  else s.turnNo++;
}

function shoot(s, p, msg) {
  const pos = Number(msg.pos), vx = Number(msg.vx), vy = Number(msg.vy);
  if (![pos, vx, vy].every(Number.isFinite)) return { error: 'Aim first' };
  const sp = Math.sqrt(vx * vx + vy * vy);
  if (sp < V_MIN * 0.5) return { error: 'Pull back further to shoot' };
  const k = sp > V_MAX ? V_MAX / sp : sp < V_MIN ? V_MIN / sp : 1;
  const ux = vx * k, uy = vy * k;
  const [nx, ny] = INWARD[p.side];
  if ((ux * nx + uy * ny) < 0.08 * Math.sqrt(ux * ux + uy * uy)) return { error: 'Shoot forward, across the board' };
  const [sx, sy] = strikerSpot(p.side, pos);
  const min = COIN_R + STRIKER_R;
  if (s.coins.some(c => c.on && (c.x - sx) * (c.x - sx) + (c.y - sy) * (c.y - sy) < min * min)) return { error: 'The striker is touching a coin: slide it along' };
  const before = s.coins.filter(c => c.on).map(c => [c.id, c.x, c.y]);
  const sim = runSim(newSim(s.coins, sx, sy, ux, uy));
  s.shots++;
  log(s, { k: 'shot', p: p.name, id: p.id, side: p.side, sx, sy, vx: ux, vy: uy, before, steps: sim.step, sunk: sim.pocketed.map(x => [x.id, x.pocket, x.step]) });
  s.animMs = Math.round(sim.step / HZ * 1000) + 1000; // the replay, plus the short look at the aim that the other phones show first
  s.actNo++;
  settle(s, p, sim);
  return {};
}

export function refreshDeadline(s, now = Date.now()) {
  if (s.phase !== 'playing' || !s.settings.turnTime) { s.deadline = null; return; }
  if (s.deadlineFor === s.actNo) return;
  s.deadlineFor = s.actNo;
  s.deadline = current(s)?.bot ? null : now + s.settings.turnTime * 1000 + (s.animMs || 0);
}
export function timeoutMove(s, now = Date.now()) {
  if (s.phase !== 'playing' || !s.deadline || now < s.deadline) return false;
  const p = current(s);
  if (!p || p.bot) return false;
  log(s, { k: 'timeout', p: p.name });
  miss(s, p);
  p.idle = (p.idle || 0) + 1;
  refreshDeadline(s);
  return true;
}
function miss(s, p) { // a turn with no shot: an owed queen goes back, and the next player shoots
  if (s.cover === p.id) { const q = s.coins.find(k => k.c === 'q'); toCentre(s, q); s.queen = 'board'; s.queenBy = null; s.cover = null; }
  s.animMs = 0;
  s.actNo++;
  passTurn(s);
}
export function roundTimeUp() { return false; }

export function handle(s, pid, msg) {
  const res = handleInner(s, pid, msg);
  if (!res.error && msg?.t === 'shot') { const p = playerById(s, pid); if (p) p.idle = 0; }
  refreshDeadline(s);
  return res;
}

function handleInner(s, pid, msg) {
  const p = playerById(s, pid) || spectatorById(s, pid);
  if (!p) return { error: 'You are not in this room' };
  const watching = !playerById(s, pid);
  const isHost = s.hostId === pid;
  const t = msg?.t;

  if (t === 'settings') {
    if (!isHost) return { error: 'Only the host can change settings' };
    if (s.phase === 'playing') return { error: 'Change settings between games' };
    if (['classic', 'points'].includes(msg.rules)) s.settings.rules = msg.rules;
    for (const k of ['private', 'reactions']) if (typeof msg[k] === 'boolean') s.settings[k] = msg[k];
    if (['easy', 'normal'].includes(msg.botLevel)) s.settings.botLevel = msg.botLevel;
    if (TURN_TIMES.includes(msg.turnTime)) s.settings.turnTime = msg.turnTime;
    return {};
  }
  if (t === 'start') {
    if (!isHost) return { error: 'Only the host can start' };
    if (s.phase === 'playing') return { error: 'Game already running' };
    // three at the table: a computer player takes the fourth seat so the game can start (the owner asked for this)
    if (s.players.length === 3 && !(s.spectators || []).length) addPlayer(s, botName(s), { bot: true, level: s.settings.botLevel });
    const e = startRound(s);
    return e ? { error: e } : {};
  }
  if (t === 'addbot') {
    if (!isHost) return { error: 'Only the host can add computer players' };
    if (s.phase === 'playing') return { error: 'Add computer players between games' };
    if (s.players.length >= MAX_PLAYERS) return { error: 'All 4 seats are taken' };
    addPlayer(s, botName(s), { bot: true, level: s.settings.botLevel });
    return {};
  }
  if (t === 'rename') {
    const name = cleanName(msg.name);
    if (name === p.name) return {};
    p.name = '';
    p.name = uniqueName(s, name);
    return {};
  }
  if (t === 'kick') {
    if (!isHost) return { error: 'Only the host can remove players' };
    if (msg.target === pid) return { error: 'Use Leave instead' };
    if (!playerById(s, msg.target) && !spectatorById(s, msg.target)) return { error: 'No such player' };
    removePlayer(s, msg.target, 'kick');
    return { kick: msg.target };
  }
  if (t === 'kickidle') {
    if (watching) return { error: 'Only players in the game can do that' };
    const v = playerById(s, msg.target);
    if (!v || v.id === pid) return { error: 'No such player' };
    if (v.bot || (v.idle || 0) < IDLE_KICK) return { error: `${v.name} is playing again` };
    removePlayer(s, v.id, 'idle');
    return { kick: v.id };
  }
  if (t === 'leave') {
    removePlayer(s, pid, 'leave');
    return { kick: pid };
  }

  if (s.phase !== 'playing') return { error: 'No game in progress' };
  if (watching) return { error: "You're watching this game" };
  if (t === 'skipturn') {
    if (!isHost) return { error: 'Only the host can skip a turn' };
    const c = current(s);
    log(s, { k: 'skipped', p: c.name });
    miss(s, c);
    return {};
  }
  if (current(s) !== p) return { error: 'Not your turn' };
  if (t === 'shot') return shoot(s, p, msg);
  return { error: 'Unknown action' };
}

export function viewFor(s, pid, online) {
  const me = playerById(s, pid);
  const playing = s.phase === 'playing';
  const cur = playing ? current(s) : null;
  return {
    t: 'state',
    game: GAME,
    you: pid,
    phase: s.phase,
    round: s.round,
    hostId: s.hostId,
    settings: s.settings,
    players: s.players.map(p => ({
      id: p.id, name: p.name, side: p.side, colour: p.colour, score: p.score || 0, got: p.got || { w: 0, b: 0, q: 0 },
      online: !!p.bot || online.has(p.id), bot: !!p.bot, idleOut: !p.bot && (p.idle || 0) >= IDLE_KICK,
    })),
    spectating: !me && !!spectatorById(s, pid),
    spectators: (s.spectators || []).map(p => ({ id: p.id, name: p.name, online: !!p.bot || online.has(p.id) })),
    coins: s.coins.map(c => ({ id: c.id, c: c.c, x: c.x, y: c.y, on: c.on })),
    left: { w: left(s, 'w'), b: left(s, 'b') },
    queen: s.queen, queenBy: s.queenBy, coverId: s.cover,
    turnId: cur?.id ?? null,
    turnNo: s.turnNo,
    shots: s.shots,
    deadlineIn: s.deadline ? Math.max(0, s.deadline - Date.now()) : null,
    roundEndsIn: null,
    lastRound: s.lastRound,
    log: s.log.slice(-8),
  };
}

export function summary(s, code, onlineCount) {
  const host = playerById(s, s.hostId) || spectatorById(s, s.hostId);
  return { code, game: GAME, host: host ? host.name : '', players: s.players.length, watching: (s.spectators || []).length, phase: s.phase, online: onlineCount, private: !!s.settings.private };
}

// ───────────────────────────────────────────────────────────
// Computer players: line the striker, a coin and a pocket up, with a wobble that depends on the level
// ───────────────────────────────────────────────────────────
const BOT_NAMES = ['Chintu', 'Pinky', 'Bunty', 'Golu', 'Munna', 'Tinku', 'Sonu', 'Babloo', 'Dolly',
  'Raju', 'Guddu', 'Chiku', 'Laddu', 'Motu', 'Bittu', 'Rinku', 'Pappu', 'Gattu', 'Jaggu', 'Kittu'];
export function botName(s) {
  const used = new Set([...s.players, ...(s.spectators || [])].map(p => p.name.toLowerCase()));
  const free = BOT_NAMES.filter(n => !used.has(n.toLowerCase()));
  return free.length ? free[randInt(free.length)] : 'Computer';
}
// is the straight path from a to b free of other coins? (`gap` = how close a coin's centre may come)
function clear(s, ax, ay, bx, by, gap, skip) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  for (const c of s.coins) {
    if (!c.on || c === skip) continue;
    let t = len2 ? ((c.x - ax) * dx + (c.y - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t - c.x, py = ay + dy * t - c.y;
    if (px * px + py * py < gap * gap) return false;
  }
  return true;
}
export function botMove(s, bot) {
  const want = c => (classic(s) ? c.c === bot.colour || (c.c === 'q' && s.queen === 'board' && left(s, bot.colour) < 9) : true);
  const targets = s.coins.filter(c => c.on && want(c));
  const [nx, ny] = INWARD[bot.side];
  const min = COIN_R + STRIKER_R;
  const spots = [];
  for (let i = 0; i <= 16; i++) {
    const pos = i / 16, [sx, sy] = strikerSpot(bot.side, pos);
    if (s.coins.every(c => !c.on || (c.x - sx) * (c.x - sx) + (c.y - sy) * (c.y - sy) >= (min + 0.1) * (min + 0.1))) spots.push([pos, sx, sy]);
  }
  if (!spots.length) spots.push([0.5, ...strikerSpot(bot.side, 0.5)]);
  let best = null;
  for (const c of targets) for (const [px, py] of POCKETS) {
    const cx = px - c.x, cy = py - c.y, cd = Math.sqrt(cx * cx + cy * cy) || 1;
    const ux = cx / cd, uy = cy / cd;
    const gx = c.x - ux * min, gy = c.y - uy * min; // where the striker must be when it touches the coin
    if (!clear(s, c.x, c.y, px, py, COIN_R * 2, c)) continue;
    for (const [pos, sx, sy] of spots) {
      const dx = gx - sx, dy = gy - sy, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const fx = dx / d, fy = dy / d;
      if (fx * nx + fy * ny < 0.15) continue;
      const cut = fx * ux + fy * uy;          // 1 = dead straight, 0 = impossible
      if (cut < 0.3) continue;
      if (!clear(s, sx, sy, gx, gy, min, c)) continue;
      const score = cut * 1.6 - d / 160 - cd / 110 + (c.c === 'q' ? 0.25 : 0);
      if (!best || score > best.score) best = { score, pos, fx, fy, d, cd, cut };
    }
  }
  let pos, fx, fy, speed;
  if (best) {
    // just enough pace: the coin should reach the pocket with a little to spare, so the striker does not follow it in
    ({ pos, fx, fy } = best);
    const coinV = Math.sqrt(2 * FRICTION * best.cd) * 1.3 + 12;
    const hitV = coinV / (1.4 * Math.max(0.35, best.cut));
    speed = Math.sqrt(hitV * hitV + 2 * FRICTION * best.d);
  }
  else {
    // nothing lines up: hit the nearest wanted coin any way possible. If it sits behind the baseline,
    // play it off the far cushion (aim at its mirror image in that cushion).
    const [p0, sx, sy] = spots[randInt(spots.length)];
    const near = targets.slice().sort((a, b) => ((a.x - sx) ** 2 + (a.y - sy) ** 2) - ((b.x - sx) ** 2 + (b.y - sy) ** 2));
    let t = near.find(c => (c.x - sx) * nx + (c.y - sy) * ny > 4 && clear(s, sx, sy, c.x, c.y, min, c)) || near.find(c => (c.x - sx) * nx + (c.y - sy) * ny > 4);
    speed = 150;
    if (!t && near.length) {
      const c = near[randInt(Math.min(3, near.length))];
      t = bot.side === 0 ? { x: c.x, y: -c.y } : bot.side === 2 ? { x: c.x, y: 200 - c.y } : bot.side === 1 ? { x: -c.x, y: c.y } : { x: 200 - c.x, y: c.y };
      speed = 215;
    }
    t ||= { x: 50, y: 50 };
    const dx = t.x - sx, dy = t.y - sy, d = Math.sqrt(dx * dx + dy * dy) || 1;
    pos = p0; fx = dx / d; fy = dy / d;
    if (fx * nx + fy * ny < 0.15) { fx = nx; fy = ny; }
  }
  // the wobble: Easy is clearly off, Normal a little
  const wob = (Math.random() - 0.5) * (bot.level === 'easy' ? 0.11 : 0.026);
  const cs = Math.cos(wob), sn = Math.sin(wob);
  const rx = fx * cs - fy * sn, ry = fx * sn + fy * cs;
  speed = Math.min(V_MAX, Math.max(V_MIN + 10, speed * (0.97 + Math.random() * 0.1)));
  return { t: 'shot', pos, vx: rx * speed, vy: ry * speed };
}
export function nextBotAction(s) {
  if (s.phase !== 'playing') return null;
  const cur = current(s);
  if (!cur?.bot) return null;
  return { pid: cur.id, msg: botMove(s, cur), delay: (s.animMs || 0) + 900 + randInt(700) };
}
