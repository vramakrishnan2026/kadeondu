// Inactive players: after the timer has played 5 turns in a row for a person, any other player may remove them.
import * as G from '../public/shared/game.js';
const ok = (c, m) => { if (!c) throw new Error(m); };
function setup(n = 3) {
  const s = G.newRoom(); s.settings.turnTime = 10; s.settings.roundTime = 0;
  const ps = []; for (let i = 0; i < n; i++) ps.push(G.addPlayer(s, 'P' + i));
  const bot = G.addPlayer(s, G.botName(s), { bot: true, level: 'easy' });
  ok(!G.handle(s, s.hostId, { t: 'start' }).error, 'start');
  return { s, ps, bot };
}
// let `idler` time out `times` turns while everyone else plays normally; returns false if the round ended first
function run(s, idler, times) {
  let done = 0;
  for (let guard = 0; guard < 4000 && done < times; guard++) {
    if (s.phase !== 'playing') return false;
    const cur = s.players[s.turn];
    if (cur.id === idler.id) { ok(G.timeoutMove(s, s.deadline + 1), 'timeout should fire'); done++; }
    else { const r = G.handle(s, cur.id, G.botMove(s, cur)); ok(!r.error, r.error); }
  }
  return done === times;
}
const view = (s, me) => G.viewFor(s, me.id, new Set());
let checked = 0;
for (let g = 0; g < 300; g++) {
  const { s, ps, bot } = setup(3); const [a, b, c] = ps;
  if (!run(s, a, 4)) continue;
  ok(a.idle === 4 && !view(s, b).players.find(p => p.id === a.id).idleOut, '4 in a row: not yet');
  ok(G.handle(s, b.id, { t: 'kickidle', target: a.id }).error, 'cannot remove before 5');
  // playing a turn yourself clears the count
  const { s: s2, ps: [a2, b2] } = setup(3);
  if (run(s2, a2, 4)) { while (s2.phase === 'playing' && s2.players[s2.turn].id !== a2.id) G.handle(s2, s2.players[s2.turn].id, G.botMove(s2, s2.players[s2.turn]));
    if (s2.phase === 'playing') { ok(!G.handle(s2, a2.id, G.botMove(s2, a2)).error, 'own move'); ok(a2.idle === 0, 'own move clears the count'); } }
  if (!run(s, a, 1)) continue;
  ok(a.idle === 5 && view(s, b).players.find(p => p.id === a.id).idleOut, '5 in a row: can be removed');
  ok(!view(s, b).players.find(p => p.id === bot.id).idleOut, 'computer players are never marked');
  ok(G.handle(s, a.id, { t: 'kickidle', target: a.id }).error, 'cannot remove yourself');
  ok(G.handle(s, b.id, { t: 'kickidle', target: bot.id }).error, 'cannot remove a computer player this way');
  const w = G.addPlayer(s, 'Watcher'); ok(s.spectators.some(x => x.id === w.id), 'joined as watcher');
  ok(G.handle(s, w.id, { t: 'kickidle', target: a.id }).error, 'watchers cannot remove');
  const before = s.players.length, hostWas = s.hostId;
  const r = G.handle(s, c.id, { t: 'kickidle', target: a.id });   // c is not the host: any player may do it
  ok(r.kick === a.id && s.players.length === before - 1 && !s.players.some(p => p.id === a.id), 'removed by a non-host player');
  ok(s.log.some(e => e.k === 'idle' && e.p === 'P0'), 'logged');
  if (hostWas === a.id) ok(s.hostId && s.hostId !== a.id, 'host passes on');
  ok(s.phase === 'playing' && s.players[s.turn], 'round carries on');
  ok(G.handle(s, b.id, { t: 'kickidle', target: a.id }).error, 'already gone');
  // they can come back as a new joiner with a clean count
  const back = G.addPlayer(s, 'P0'); ok(!(back.idle > 0), 'rejoins with a clean count');
  checked++;
}
ok(checked > 100, 'too few games reached the check: ' + checked);
// no turn timer, no auto-moves, so nobody is ever marked
{ const s = G.newRoom(); s.settings.turnTime = 0; const a = G.addPlayer(s, 'A'); G.addPlayer(s, 'B'); G.handle(s, a.id, { t: 'start' }); ok(!G.timeoutMove(s, Date.now() + 1e9), 'no timer, no timeouts'); }
console.log('idle rule: games checked', checked, 'ok');
