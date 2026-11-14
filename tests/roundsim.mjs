// Round time limit: the round ends when the limit runs out and the lowest card points wins.
import * as G from '../public/shared/game.js';
const pts = p => p.hand.reduce((a, c) => a + G.cardPoints(c), 0);
let games = 0, timeUps = 0, normalWins = 0;
for (const mins of [3, 5]) for (const n of [2, 3, 6, 12]) for (const stacking of [false, true]) for (let g = 0; g < 50; g++) {
  const s = G.newRoom(); s.settings.stacking = stacking; s.settings.turnTime = 0;
  for (let i = 0; i < n; i++) G.addPlayer(s, 'P' + i);
  G.addPlayer(s, G.botName(s), { bot: true, level: 'normal' });
  let r = G.handle(s, s.hostId, { t: 'settings', roundTime: mins }); if (r.error) throw r.error;
  const t0 = Date.now();
  r = G.handle(s, s.hostId, { t: 'start' }); if (r.error) throw r.error;
  if (Math.abs(s.roundEndsAt - (t0 + mins * 60000)) > 2000) throw new Error('wrong end time');
  if (G.roundTimeUp(s, s.roundEndsAt - 1)) throw new Error('ended early');
  // play a random number of moves (everyone plays like a computer player), then let the limit run out
  const moves = Math.floor(Math.random() * 60);
  for (let i = 0; i < moves && s.phase === 'playing'; i++) {
    const cur = s.players[s.turn];
    const m = G.botMove(s, cur);
    const res = G.handle(s, cur.id, m); if (res.error) throw new Error(res.error);
  }
  games++;
  if (s.phase !== 'playing') { normalWins++; if (s.lastRound.timeUp) throw new Error('normal win marked as time up'); if (s.roundEndsAt !== null) throw new Error('limit left running'); continue; }
  const before = s.players.map(p => ({ id: p.id, pts: pts(p), n: p.hand.length, score: p.score }));
  if (!G.roundTimeUp(s, s.roundEndsAt)) throw new Error('time up did nothing');
  timeUps++;
  if (s.phase !== 'ended' || !s.lastRound.timeUp || s.roundEndsAt !== null || s.deadline !== null) throw new Error('bad state after time up');
  const w = before.find(p => p.id === s.winnerId);
  const min = Math.min(...before.map(p => p.pts));
  if (w.pts !== min) throw new Error('winner does not have the lowest points');
  const tied = before.filter(p => p.pts === min);
  if (w.n !== Math.min(...tied.map(p => p.n))) throw new Error('tie not broken by fewer cards');
  const expect = before.filter(p => p.id !== w.id).reduce((a, p) => a + p.pts, 0);
  if (s.lastRound.points !== expect || s.players.find(p => p.id === w.id).score !== w.score + expect) throw new Error('wrong score');
  if (s.lastRound.left !== min) throw new Error('wrong leftover points');
  if (G.roundTimeUp(s, s.roundEndsAt + 99999)) throw new Error('ended twice');
  // next round gets a fresh limit
  r = G.handle(s, s.hostId, { t: 'start' }); if (r.error) throw r.error;
  if (!s.roundEndsAt || s.phase !== 'playing') throw new Error('no limit on next round');
}
// a move arriving after the limit doesn't count
{
  const s = G.newRoom(); const a = G.addPlayer(s, 'A'); G.addPlayer(s, 'B');
  G.handle(s, a.id, { t: 'settings', roundTime: 3 }); G.handle(s, a.id, { t: 'start' });
  s.roundEndsAt = Date.now() - 1;
  const cur = s.players[s.turn];
  const res = G.handle(s, cur.id, { t: 'draw' });
  if (!res.error || s.phase !== 'ended' || !s.lastRound.timeUp) throw new Error('late move was accepted');
}
// off by default, and only Off / 3 / 5 are accepted
{
  const s = G.newRoom(); const a = G.addPlayer(s, 'A'); G.addPlayer(s, 'B');
  if (s.settings.roundTime !== 0) throw new Error('not off by default');
  G.handle(s, a.id, { t: 'settings', roundTime: 4 }); if (s.settings.roundTime !== 0) throw new Error('accepted 4');
  G.handle(s, a.id, { t: 'start' }); if (s.roundEndsAt !== null) throw new Error('off but has a limit');
  if (G.viewFor(s, a.id, new Set()).roundEndsIn !== null) throw new Error('view shows a limit');
}
console.log('round-limit games', games, 'ended on time', timeUps, 'won before time', normalWins, 'ok');
