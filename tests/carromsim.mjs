// Carrom engine checks: physics sanity and repeatability, rules set pieces, and whole games between computer players.
// Run: node tests/carromsim.mjs
import * as C from '../public/shared/carrom.js';
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) { fails++; console.log('FAIL', name, extra); } };
function table(n, rules = 'classic', bots = true) {
  const s = C.newRoom(); const ps = [];
  for (let i = 0; i < n; i++) ps.push(C.addPlayer(s, 'P' + i, bots && i ? { bot: true } : {}));
  C.handle(s, ps[0].id, { t: 'settings', rules, turnTime: 0 });
  return { s, ps };
}
const online = s => new Set(s.players.map(p => p.id));
// 1. physics: the same shot gives the same result, twice; nothing leaves the board or overlaps at rest
{
  const { s, ps } = table(2); C.handle(s, ps[0].id, { t: 'start' });
  ok('19 coins racked', s.coins.length === 19 && s.coins.filter(c => c.c === 'w').length === 9 && s.coins.filter(c => c.c === 'b').length === 9);
  let minGap = 99; for (const a of s.coins) for (const b of s.coins) if (a.id < b.id) minGap = Math.min(minGap, Math.hypot(a.x - b.x, a.y - b.y));
  ok('rack does not overlap', minGap >= C.COIN_R * 2, minGap);
  const [sx, sy] = C.strikerSpot(0, 0.5);
  const a = C.runSim(C.newSim(s.coins, sx, sy, 3, -200)), b = C.runSim(C.newSim(s.coins, sx, sy, 3, -200));
  ok('repeatable', JSON.stringify(a.bodies) === JSON.stringify(b.bodies) && a.step === b.step);
  ok('break scatters and stops', a.hits > 5 && a.step < C.HZ * 14 && a.step > 60, `${a.hits} hits ${a.step} steps`);
  ok('all inside', a.bodies.every(x => x.out || (x.x >= x.r - 1e-9 && x.x <= 100 - x.r + 1e-9 && x.y >= x.r - 1e-9 && x.y <= 100 - x.r + 1e-9)));
  // a coin on the line to a pocket goes in
  const one = [{ id: 5, c: 'w', x: 80, y: 30, on: true }];
  const [px, py] = C.POCKETS[1]; const ux = px - 80, uy = py - 30, d = Math.hypot(ux, uy);
  const gx = 80 - ux / d * (C.COIN_R + C.STRIKER_R), gy = 30 - uy / d * (C.COIN_R + C.STRIKER_R);
  const [s2x, s2y] = C.strikerSpot(0, 0.5); const fx = gx - s2x, fy = gy - s2y, fd = Math.hypot(fx, fy);
  const pot = C.runSim(C.newSim(one, s2x, s2y, fx / fd * 150, fy / fd * 150));
  ok('straight pot', pot.pocketed.some(x => x.id === 5), JSON.stringify(pot.pocketed));
  // messages: bad shots are refused
  ok('backwards refused', !!C.handle(s, ps[0].id, { t: 'shot', pos: 0.5, vx: 0, vy: 100 }).error);
  ok('too soft refused', !!C.handle(s, ps[0].id, { t: 'shot', pos: 0.5, vx: 0, vy: -5 }).error);
  ok('not your turn', !!C.handle(s, ps[1].id, { t: 'shot', pos: 0.5, vx: 0, vy: 100 }).error);
  ok('3 players cannot start', (() => { const t = table(3); return !!C.handle(t.s, t.ps[0].id, { t: 'start' }).error; })());
}
// 2. rules set pieces (coins placed by hand, then a straight pot into the top-right pocket by player 0, white)
function setup(rules, coins, extra = {}) {
  const { s, ps } = table(2, rules, false); C.handle(s, ps[0].id, { t: 'start' });
  s.coins.forEach(c => { c.on = false; });
  for (const [id, x, y] of coins) { const c = s.coins.find(k => k.id === id); c.x = x; c.y = y; c.on = true; }
  Object.assign(s, extra);
  return { s, ps };
}
function potShot(s, p, coinId, pocket = 1) {
  const c = s.coins.find(k => k.id === coinId), [px, py] = C.POCKETS[pocket];
  const ux = px - c.x, uy = py - c.y, d = Math.hypot(ux, uy);
  const gx = c.x - ux / d * (C.COIN_R + C.STRIKER_R), gy = c.y - uy / d * (C.COIN_R + C.STRIKER_R);
  let best = null;
  for (let i = 0; i <= 40; i++) { const [sx, sy] = C.strikerSpot(p.side, i / 40); const fx = gx - sx, fy = gy - sy, fd = Math.hypot(fx, fy); const cut = (fx * ux + fy * uy) / fd / d; const v = Math.sqrt(2 * 52 * fd + 62 * 62); if (!best || cut > best.cut) best = { cut, pos: i / 40, vx: fx / fd * v, vy: fy / fd * v }; }
  return C.handle(s, p.id, { t: 'shot', pos: best.pos, vx: best.vx, vy: best.vy });
}
const W = [1, 3, 5, 7, 8, 9, 10, 11, 12], B = [2, 4, 6, 13, 14, 15, 16, 17, 18]; // ids by colour in the rack
{
  // own coin: shoot again
  let { s, ps } = setup('classic', [[W[0], 82, 28], [W[1], 30, 40], [B[0], 40, 30], [0, 50, 50]]);
  ok('ids', s.coins.find(c => c.id === W[0]).c === 'w' && s.coins.find(c => c.id === B[0]).c === 'b');
  let r = potShot(s, ps[0], W[0]); ok('pot own', !r.error && !s.coins.find(c => c.id === W[0]).on, r.error);
  ok('shoots again', s.players[s.turn] === ps[0] && s.log.at(-1).again === true);
  // opponent's coin: stays down, turn passes
  ({ s, ps } = setup('classic', [[B[0], 82, 28], [W[1], 30, 40], [B[1], 40, 30], [0, 50, 50]]));
  potShot(s, ps[0], B[0]); ok('opp coin stays down, turn passes', !s.coins.find(c => c.id === B[0]).on && s.players[s.turn] === ps[1], JSON.stringify(s.log.at(-1)));
  // queen alone: pending, shoot again; then miss: queen returns
  ({ s, ps } = setup('classic', [[0, 82, 28], [W[1], 30, 40], [B[1], 40, 30]]));
  potShot(s, ps[0], 0); ok('queen pending', s.queen === 'pending' && s.cover === ps[0].id && s.players[s.turn] === ps[0], s.queen);
  C.handle(s, ps[0].id, { t: 'shot', pos: 0.5, vx: 0, vy: -40 }); ok('not covered: queen back', s.queen === 'board' && s.coins.find(c => c.c === 'q').on && s.players[s.turn] === ps[1], s.queen);
  // queen then cover
  ({ s, ps } = setup('classic', [[0, 82, 28], [W[1], 20, 30], [W[2], 30, 60], [B[1], 40, 30]]));
  potShot(s, ps[0], 0); potShot(s, ps[0], W[1], 0); ok('covered', s.queen === 'covered' && s.queenBy === 'w', s.queen + JSON.stringify(s.log.at(-1)));
  // last coin before the queen is covered comes back
  ({ s, ps } = setup('classic', [[W[0], 82, 28], [B[1], 40, 30], [0, 50, 50]]));
  potShot(s, ps[0], W[0]); ok('early last coin returns', s.phase === 'playing' && s.coins.filter(c => c.on && c.c === 'w').length === 1 && s.players[s.turn] === ps[1], JSON.stringify(s.log.at(-1)));
  // win: last coin with the queen covered by white → opponent coins left + 3
  ({ s, ps } = setup('classic', [[W[0], 82, 28], [B[1], 40, 30], [B[2], 30, 30]], { queen: 'covered', queenBy: 'w' }));
  potShot(s, ps[0], W[0]); ok('white wins 2 + 3', s.phase === 'ended' && s.lastRound.colour === 'w' && s.lastRound.points === 5 && s.lastRound.winnerId === ps[0].id, JSON.stringify(s.lastRound));
  ok('play again', !C.handle(s, ps[0].id, { t: 'start' }).error && s.coins.filter(c => c.on).length === 19 && s.queen === 'board');
  // foul: striker into a pocket → a pocketed coin comes back, turn passes
  ({ s, ps } = setup('classic', [[W[1], 30, 40], [B[1], 40, 30], [0, 50, 50]]));
  const [fx, fy] = C.strikerSpot(0, 1), [qx, qy] = C.POCKETS[1], fd = Math.hypot(qx - fx, qy - fy);
  C.handle(s, ps[0].id, { t: 'shot', pos: 1, vx: (qx - fx) / fd * 150, vy: (qy - fy) / fd * 150 });
  ok('foul', s.log.at(-1).foul === true && s.log.at(-1).back === 1 && s.players[s.turn] === ps[1] && s.coins.filter(c => c.on && c.c === 'w').length === 2, JSON.stringify(s.log.at(-1)));
  // points rules
  ({ s, ps } = setup('points', [[B[0], 82, 28], [W[1], 30, 40], [0, 50, 50]]));
  potShot(s, ps[0], B[0]); ok('points: black 10 and again', ps[0].score === 10 && s.players[s.turn] === ps[0]);
  ({ s, ps } = setup('points', [[W[0], 82, 28], [B[1], 30, 40], [0, 50, 50]]));
  potShot(s, ps[0], W[0]); ok('points: white 20', ps[0].score === 20);
  // timeout passes the turn
  ({ s, ps } = setup('classic', [[W[1], 30, 40], [B[1], 40, 30], [0, 50, 50]])); s.settings.turnTime = 15; s.deadlineFor = -1; C.refreshDeadline(s);
  ok('timeout passes', C.timeoutMove(s, s.deadline + 1) && s.players[s.turn] === ps[1] && ps[0].idle === 1);
  // someone leaves: back to the waiting room
  C.removePlayer(s, ps[1].id); ok('leaver ends the board', s.phase === 'lobby');
}
// 3. whole games between computer players
const stuck = []; let games = 0, shots = 0, maxShots = 0, fouls = 0, unfinished = 0;
for (const rules of ['classic', 'points']) for (const n of [2, 4]) for (const lv of ['easy', 'normal']) for (let g = 0; g < 12; g++) {
  const s = C.newRoom(); const host = C.addPlayer(s, 'Host');
  for (let i = 1; i < n; i++) C.addPlayer(s, 'B' + i, { bot: true, level: lv });
  C.handle(s, host.id, { t: 'settings', rules, turnTime: 0 }); C.handle(s, host.id, { t: 'start' });
  host.bot = true; host.level = lv;
  let k = 0;
  while (s.phase === 'playing' && k++ < 900) {
    const a = C.nextBotAction(s); const r = C.handle(s, a.pid, a.msg);
    if (r.error) { ok('bot shot legal', false, r.error + JSON.stringify(a.msg)); break; }
    const on = s.coins.filter(c => c.on);
    if (!on.every(c => c.x >= C.COIN_R - 1e-6 && c.x <= 100 - C.COIN_R + 1e-6 && c.y >= C.COIN_R - 1e-6 && c.y <= 100 - C.COIN_R + 1e-6)) { ok('coins inside', false); break; }
    if (s.log.at(-1).foul || s.log.at(-2)?.foul) fouls++;
    const v = C.viewFor(s, host.id, online(s)); if (v.coins.length !== 19) ok('view coins', false);
  }
  games++; shots += s.shots; maxShots = Math.max(maxShots, s.shots);
  if (s.phase !== 'ended') { unfinished++; stuck.push(`${rules}/${n}/${lv}: w${s.coins.filter(c=>c.on&&c.c==='w').length} b${s.coins.filter(c=>c.on&&c.c==='b').length} q:${s.queen}`); continue; }
  if (rules === 'classic') ok('classic result', s.lastRound.points >= 0 && s.lastRound.winnerIds.length === n / 2 && s.queen === 'covered', JSON.stringify(s.lastRound));
  else ok('points result', s.players.reduce((a, p) => a + p.score, 0) <= 9 * 10 + 9 * 20 + 50 && s.lastRound.points > 0, JSON.stringify(s.lastRound));
}
ok('games finish', unfinished <= games * 0.05, `${unfinished} of ${games} unfinished`);
if (stuck.length) console.log(stuck.join(' | ')); console.log(`carrom: ${games} games, ${Math.round(shots / games)} shots a game (longest ${maxShots}), ${unfinished} unfinished`, fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
