// Ondu Ruthless: every special rule as a set piece, then whole games between computer players with the cards counted.
// Run: node tests/ruthlesssim.mjs
import * as RU from '../public/shared/ruthless.js';
import * as G from '../public/shared/game.js';
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) { fails++; console.log('FAIL', name, extra); } };
let cid = 9000;
const C = (c, v) => ({ id: cid++, c, v });
function table(n, hands, topCard = C('r', '5')) {
  const s = RU.newRoom(); const ps = [];
  for (let i = 0; i < n; i++) ps.push(RU.addPlayer(s, 'P' + i));
  s.settings.turnTime = 0; s.settings.roundTime = 0;
  RU.handle(s, ps[0].id, { t: 'start' });
  s.turn = 0; s.dir = 1; s.discard = [topCard]; s.color = topCard.c;
  ps.forEach((p, i) => { p.hand = hands[i].map(([c, v]) => C(c, v)); });
  return { s, ps };
}
const play = (s, p, i, extra = {}) => RU.handle(s, p.id, { t: 'play', cardId: p.hand[i].id, ...extra });
const turnOf = s => s.players[s.turn];
// a Ruthless room, and the standard game untouched
{
  const s = RU.newRoom(); ok('room is ruthless', s.game === 'ruthless' && s.settings.stacking === true);
  const a = RU.addPlayer(s, 'A'); RU.addPlayer(s, 'B'); RU.handle(s, a.id, { t: 'start' });
  const all = [...s.deck, ...s.discard, ...s.players.flatMap(p => p.hand)];
  ok('164 cards', all.length === 164, all.length);
  ok('new cards in the deck', ['d4', 'skipall', 'dump', 'wrd4', 'wd6', 'wd10', 'roul'].every(v => all.some(c => c.v === v)) && !all.some(c => c.v === 'wild' || c.v === 'wd4'));
  ok('view says ruthless', RU.viewFor(s, a.id, new Set()).game === 'ruthless' && RU.viewFor(s, a.id, new Set()).koAt === 25 && RU.summary(s, 'ABCD', 2).game === 'ruthless');
  ok('stacking cannot be switched off', (RU.handle(s, a.id, { t: 'settings', stacking: false }), s.settings.stacking === true));
  const o = G.newRoom(); const x = G.addPlayer(o, 'A'); G.addPlayer(o, 'B'); G.handle(o, x.id, { t: 'start' });
  ok('standard game unchanged: 108 cards, no game tag', [...o.deck, ...o.discard, ...o.players.flatMap(p => p.hand)].length === 108 && o.game === undefined && G.viewFor(o, x.id, new Set()).koAt === null);
}
// stacking: same size or bigger
{
  const { s, ps } = table(3, [[['r', 'd2'], ['b', '1']], [['g', 'd4'], ['b', 'd2'], ['b', '2']], [['w', 'wd6'], ['y', 'd4'], ['y', '3'], ['y', '4']]]);
  ok('+2', !play(s, ps[0], 0).error && s.pendingDraw === 2 && turnOf(s) === ps[1]);
  ok('view: only draw cards playable on a stack', RU.viewFor(s, ps[1].id, new Set()).playable.length === 2);
  ok('+4 on +2', !play(s, ps[1], 0).error && s.pendingDraw === 6);
  ok('+4 again not smaller: allowed (same size)', RU.canPlay(s, ps[2].hand[1]) && RU.canPlay(s, ps[2].hand[0]));
  ok('+6 on +4', !play(s, ps[2], 0, { color: 'b' }).error && s.pendingDraw === 12 && turnOf(s) === ps[0]);
  ok('nothing to answer with: picks up 12', !RU.handle(s, ps[0].id, { t: 'draw' }).error && ps[0].hand.length === 13 && s.pendingDraw === 0 && turnOf(s) === ps[1]);
  ok('a +2 cannot answer a +6', (() => { const t = table(2, [[['w', 'wd6'], ['r', '1']], [['r', 'd2'], ['r', '2']]]); play(t.s, t.ps[0], 0, { color: 'r' }); return !!play(t.s, t.ps[1], 0).error; })());
}
// must play if you can; draw until you can, then must play it
{
  const { s, ps } = table(2, [[['r', '1'], ['b', '2']], [['b', '9'], ['b', '8']]]);
  ok('cannot draw with a playable card', !!RU.handle(s, ps[0].id, { t: 'draw' }).error && RU.viewFor(s, ps[0].id, new Set()).mustPlay);
  play(s, ps[0], 0);
  s.deck.push(C('r', '7'), C('g', '3'), C('y', '4'), C('b', '6')); // top of the pile is the end: b6, y4, g3, then r7 fits (colour is red, top r1)
  ok('draws until one fits', !RU.handle(s, ps[1].id, { t: 'draw' }).error && ps[1].hand.length === 6 && s.drawnCardId === ps[1].hand.at(-1).id && turnOf(s) === ps[1], ps[1].hand.length);
  ok('cannot pass', !!RU.handle(s, ps[1].id, { t: 'pass' }).error);
  ok('only the drawn card', RU.viewFor(s, ps[1].id, new Set()).playable.length === 1);
}
// seven swaps (needs a target with 3+), zero passes hands along
{
  let { s, ps } = table(3, [[['r', '7'], ['b', '1'], ['b', '2'], ['b', '3']], [['g', '1']], [['y', '1'], ['y', '2']]]);
  ok('7 needs a target', !!play(s, ps[0], 0).error && !!play(s, ps[0], 0, { target: ps[0].id }).error);
  ok('7 swaps', !play(s, ps[0], 0, { target: ps[1].id }).error && ps[0].hand.length === 1 && ps[1].hand.length === 3 && s.phase === 'playing');
  ({ s, ps } = table(3, [[['r', '0'], ['b', '1']], [['g', '1'], ['g', '2'], ['g', '3']], [['y', '1'], ['y', '2']]]));
  const h1 = ps[1].hand, h2 = ps[2].hand;
  ok('0 passes hands on', !play(s, ps[0], 0).error && ps[1].hand.length === 1 && ps[2].hand === h1 && ps[0].hand === h2);
  ({ s, ps } = table(3, [[['r', '7']], [['g', '1'], ['g', '2']], [['y', '1']]]));
  ok('last card 7 wins, no swap', !play(s, ps[0], 0).error && s.phase === 'ended' && s.winnerId === ps[0].id);
}
// skip all, dump, roulette, wild reverse +4
{
  let { s, ps } = table(3, [[['r', 'skipall'], ['r', '1'], ['b', '1']], [['g', '1']], [['y', '1']]]);
  const tn = s.turnNo; ok('skip all: same player again', !play(s, ps[0], 0).error && turnOf(s) === ps[0] && s.turnNo === tn + 1);
  ({ s, ps } = table(2, [[['r', 'dump'], ['r', '1'], ['r', '9'], ['b', '1'], ['g', '2']], [['g', '1'], ['g', '5']]]));
  ok('dump', !play(s, ps[0], 0).error && ps[0].hand.length === 2 && s.discard.at(-1).v === 'dump' && s.discard.length === 4, ps[0].hand.length);
  ({ s, ps } = table(2, [[['r', 'dump'], ['r', '1']], [['g', '1'], ['g', '5']]]));
  ok('dump can win', !play(s, ps[0], 0).error && s.phase === 'ended' && s.winnerId === ps[0].id);
  ({ s, ps } = table(3, [[['w', 'roul'], ['r', '1']], [['g', '1']], [['y', '1']]]));
  s.deck.push(C('b', '4'), C('y', '2'), C('r', '3'), C('g', '9'));
  ok('roulette: draws to the colour, loses the turn', !play(s, ps[0], 0, { color: 'b' }).error && ps[1].hand.length === 5 && ps[1].hand.at(-1).c === 'b' && turnOf(s) === ps[2] && s.color === 'b', ps[1].hand.length);
  ({ s, ps } = table(3, [[['w', 'wrd4'], ['r', '1']], [['g', '1']], [['y', '1']]]));
  ok('wild reverse +4 hits the player behind', !play(s, ps[0], 0, { color: 'g' }).error && s.dir === -1 && turnOf(s) === ps[2] && s.pendingDraw === 4);
}
// 25 cards: out, and the last one standing wins
{
  let { s, ps } = table(3, [[['w', 'wd10'], ['r', '1']], [Array(16).fill(['g', '1'])].flat().length ? Array.from({ length: 16 }, () => ['g', '1']) : [], [['y', '1'], ['y', '2']]]);
  ps[0].score = 0;
  play(s, ps[0], 0, { color: 'b' });
  ok('picks up 10 → 26 cards → out', !RU.handle(s, ps[1].id, { t: 'draw' }).error && !s.players.includes(ps[1]) && s.spectators.includes(ps[1]) && ps[1].hand.length === 0 && s.players.length === 2);
  ok('turn moves to the next player still in', turnOf(s) === ps[2] && s.phase === 'playing');
  ok('view for the knocked-out player', RU.viewFor(s, ps[1].id, new Set()).knockedOut === true && RU.viewFor(s, ps[1].id, new Set()).spectating);
  ok('they cannot act', !!RU.handle(s, ps[1].id, { t: 'draw' }).error);
  // knock out the second: the last one wins, with the bonus
  ps[2].hand = Array.from({ length: 20 }, () => C('y', '9')); ps[0].hand = [C('w', 'wd10'), C('r', '1')]; s.turn = s.players.indexOf(ps[0]); s.discard.push(C('b', '5')); s.color = 'b'; s.pendingDraw = 0;
  play(s, ps[0], 0, { color: 'b' }); RU.handle(s, ps[2].id, { t: 'draw' });
  ok('last one standing wins', s.phase === 'ended' && s.winnerId === ps[0].id && s.lastRound.points === 100, JSON.stringify(s.lastRound));
  ok('everyone is back for the next round', s.players.length === 3 && s.spectators.length === 0);
  ok('next round starts', !RU.handle(s, s.hostId, { t: 'start' }).error && s.players.every(p => p.hand.length === 7));
}
// the only real player is knocked out with computer players still in: the round ends at once, fewest points wins
{
  const s = RU.newRoom(); const me = RU.addPlayer(s, 'Me'); const b1 = RU.addPlayer(s, 'B1', { bot: true }), b2 = RU.addPlayer(s, 'B2', { bot: true }), b3 = RU.addPlayer(s, 'B3', { bot: true });
  s.settings.turnTime = 0; s.settings.roundTime = 0; RU.handle(s, me.id, { t: 'start' });
  s.turn = s.players.indexOf(me); s.dir = 1; s.pendingDraw = 10; s.pendingType = 'wd10'; s.drawnCardId = null;
  me.hand = Array.from({ length: 20 }, () => C('y', '9')); b1.hand = [C('r', '9'), C('r', '8')]; b2.hand = [C('g', '1')]; b3.hand = [C('b', '5'), C('b', '6'), C('b', '7')];
  RU.handle(s, me.id, { t: 'draw' });
  ok('human out with 3 computers left: round over', s.phase === 'ended' && s.winnerId === b2.id && s.lastRound.botsOnly === true, s.phase + ' ' + JSON.stringify(s.lastRound));
  ok('everyone back, next round can start', s.players.length === 4 && !RU.handle(s, me.id, { t: 'start' }).error && s.phase === 'playing');
  // two real players: one is out, the other is still in → the round carries on
  const t = RU.newRoom(); const h1 = RU.addPlayer(t, 'H1'), h2 = RU.addPlayer(t, 'H2'); RU.addPlayer(t, 'B', { bot: true });
  t.settings.turnTime = 0; t.settings.roundTime = 0; RU.handle(t, h1.id, { t: 'start' });
  t.turn = t.players.indexOf(h1); t.pendingDraw = 10; t.pendingType = 'wd10'; t.drawnCardId = null; h1.hand = Array.from({ length: 20 }, () => C('y', '9'));
  RU.handle(t, h1.id, { t: 'draw' });
  ok('a real player still in: round continues', t.phase === 'playing' && t.players.length === 2 && t.players.includes(h2));
}
// whole games between computer players: the number of cards never changes, rounds end
let rounds = 0, kos = 0, longest = 0, stuck = 0;
for (let g = 0; g < 160; g++) {
  const n = 2 + (g % 7), lv = g % 2 ? 'easy' : 'normal';
  const s = RU.newRoom(); const host = RU.addPlayer(s, 'Host');
  for (let i = 1; i < n; i++) RU.addPlayer(s, 'B' + i, { bot: true, level: lv });
  s.settings.turnTime = g % 3 ? 0 : 15; s.settings.roundTime = 0;
  RU.handle(s, host.id, { t: 'start' }); host.bot = true; host.level = lv;
  const total = () => s.deck.length + s.discard.length + s.players.reduce((a, p) => a + p.hand.length, 0);
  const want = total();
  let k = 0;
  while (s.phase === 'playing' && k++ < 6000) {
    const a = RU.nextBotAction(s);
    if (!a) { ok('someone to act', false, `game ${g}`); break; }
    if (g % 5 === 0 && k % 37 === 0 && s.deadline) { const cur = s.players[s.turn]; cur.bot = false; RU.timeoutMove(s, s.deadline + 1); cur.bot = true; }
    else { const r = RU.handle(s, a.pid, a.msg); if (r.error) { ok('bot move legal', false, r.error + ' ' + JSON.stringify(a.msg)); break; } }
    if (total() < want) { ok('cards conserved', false, `game ${g}: ${total()} < ${want}`); break; } // (a fresh deck may be opened, so more is fine)
    if (s.players.some(p => p.hand.length >= 25) && s.phase === 'playing') { ok('nobody stays in with 25+', false, `game ${g}`); break; }
  }
  if (s.phase !== 'ended') stuck++;
  rounds++; kos += s.koCount || 0; longest = Math.max(longest, k);
}
ok('rounds finish', stuck === 0, `${stuck} unfinished`);
console.log(`ruthless: ${rounds} rounds, ${kos} knock-outs, longest ${longest} moves`, fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
