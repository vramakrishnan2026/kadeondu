// Poker engine checks: hand reading, side pots, chip conservation over many random games, timeouts, leaving.
// Run: node tests/pokersim.mjs
import * as P from '../public/shared/poker.js';
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) { fails++; console.log('FAIL', name, extra); } };
const ev = t => P.evaluate(P.parseCards(t));

// 1. hand reading
const order = ['2s 5d 9h Jc Kd 3s 7h', 'As Ad 9h Jc Kd 3s 7h', 'As Ad 9h 9c Kd 3s 7h', '9s 9d 9h Jc Kd 3s 7h', '5s 6d 7h 8c 9d As Ah',
  '2s 5s 9s Js Ks 3d 7h', '9s 9d 9h Jc Jd 3s 7h', '9s 9d 9h 9c Kd 3s 7h', '5s 6s 7s 8s 9s Ad Ah', 'Ts Js Qs Ks As 2d 2h'];
order.forEach((h, i) => ok('category ' + i, P.category(ev(h)) === Math.min(i, 8), P.handName(ev(h))));
for (let i = 1; i < order.length; i++) ok('order ' + i, ev(order[i]) > ev(order[i - 1]));
ok('wheel', P.handName(ev('As 2d 3h 4c 5d Kd Qh')) === 'Straight, Five high');
ok('wheel < six high', ev('As 2d 3h 4c 5d Kd Qh') < ev('2d 3h 4c 5d 6s Kd Qh'));
ok('kicker', ev('As Kd Ah 7c 5d 3s 2h') > ev('As Qd Ah 7c 5d 3s 2h'));
ok('split board', ev('2s 3d Ah Kc Qd Js Th') === ev('4s 5d Ah Kc Qd Js Th'));
ok('two trips = full house', P.handName(ev('9s 9d 9h Jc Jd Js 2h')) === 'Full house, Jacks full of Nines');
ok('three pairs', P.handName(ev('9s 9d 5h 5c Jd Js Ah')) === 'Two pair, Jacks and Nines');
ok('names', P.handName(ev('6s 6d 2h 9c Jd')) === 'Pair of Sixes' && P.handName(ev('Ts Js Qs Ks As')) === 'Royal flush');
ok('best five', P.bestFive(P.parseCards('As Ad 9h Jc Kd 3s 7h')).length === 5);
ok('chen AA', P.chen(P.parseCards('As Ad')) === 20); ok('chen AKs', P.chen(P.parseCards('As Ks')) === 12);
ok('chen 72o weak', P.chen(P.parseCards('7s 2d')) < 4); ok('chen JTs', P.chen(P.parseCards('Js Ts')) === 9);
const o = P.outs(P.parseCards('As Ks'), P.parseCards('2s 7s Jd'));
ok('flush draw outs', o.kinds.Flush === 9, JSON.stringify(o));
ok('open-ended', P.outs(P.parseCards('9s 8d'), P.parseCards('7h 6c Kd')).kinds.Straight === 8);
const eqAA = P.equity(P.parseCards('As Ad'), [], 1, 4000);
ok('AA vs random ~85%', eqAA > 0.82 && eqAA < 0.88, eqAA);
const eq72 = P.equity(P.parseCards('7s 2d'), [], 1, 4000);
ok('72o vs random ~35%', eq72 > 0.31 && eq72 < 0.39, eq72);

// 2. the coach gives sane advice
const sp = (hole, board, extra) => ({ hole: P.parseCards(hole), board: board ? P.parseCards(board) : [], pot: 30, toCall: 10, myBet: 0, chips: 1000, currentBet: 10, minRaiseTo: 20, bb: 10, opp: 3, position: 'middle', ...extra });
ok('AA raises', P.advise(sp('As Ad')).act === 'raise');
ok('72o folds', P.advise(sp('7s 2d')).act === 'fold');
ok('BB checks junk', P.advise(sp('7s 2d', '', { toCall: 0, position: 'big blind' })).act === 'check');
ok('nuts bets', P.advise(sp('As Ks', 'Qs Js Ts', { toCall: 0, currentBet: 0, pot: 100 }), 'advanced').act === 'raise');
ok('air folds to pot bet', P.advise(sp('7s 2d', 'Ah Kc Qd 9s 4c', { toCall: 100, currentBet: 100, pot: 200, opp: 1 }), 'intermediate').act === 'fold');
for (const lv of ['beginner', 'intermediate', 'advanced']) { const a = P.advise(sp('As Ks', '2s 7s Jd', { toCall: 20, currentBet: 20, pot: 80 }), lv); ok('lines ' + lv, a.lines.length >= 2 && a.head, JSON.stringify(a)); }
ok('advanced says more', P.advise(sp('As Ks', '2s 7s Jd', { toCall: 20, currentBet: 20, pot: 80 }), 'advanced').lines.length > P.advise(sp('As Ks', '2s 7s Jd', { toCall: 20, currentBet: 20, pot: 80 }), 'beginner').lines.length);

// helpers for games
const online = s => new Set(s.players.map(p => p.id));
const total = s => s.players.reduce((a, p) => a + p.chips + (p.total || 0), 0);
const should = s => s.players.reduce((a, p) => a + s.settings.startChips * (1 + (p.rebuys || 0)), 0);
function table(n, bots = false) {
  const s = P.newRoom(); const ps = [];
  for (let i = 0; i < n; i++) ps.push(P.addPlayer(s, 'P' + i, bots && i ? { bot: true } : {}));
  return { s, ps };
}

// 3. side pots: A all-in 100 (best hand), B all-in 300 (second), C calls 300 (worst)
{
  const { s, ps } = table(3);
  s.settings.turnTime = 0;
  // deck is dealt from the end: P1 first (after the button P0), then P2, then P0; then flop, turn, river
  const holes = { P1: 'Kh Kd', P2: 'Qh Qd', P0: 'As Ah' };
  P._test.deck = () => [...P.parseCards('8c 7c 6c 5c 4c 3c 2c'), ...P.parseCards('2h 9d 7s 3d Td').reverse(), ...P.parseCards(holes.P0).reverse(), ...P.parseCards(holes.P2).reverse(), ...P.parseCards(holes.P1).reverse()];
  P.handle(s, ps[0].id, { t: 'start' });
  ps[0].chips = 100 - ps[0].total; ps[1].chips = 300 - ps[1].total; ps[2].chips = 1000 - ps[2].total;
  ok('P0 has aces', P.holeName(ps[0].cards) === 'Pocket Aces' && P.holeName(ps[1].cards) === 'Pocket Kings', ps.map(p => p.cards.map(P.cardText)).join('|'));
  // button P0 acts first (3 players: P1 sb, P2 bb, P0 first)
  ok('P0 first', s.players[s.turn] === ps[0]);
  let r = P.handle(s, ps[0].id, { t: 'raise', to: 100 }); ok('P0 all-in', !r.error && ps[0].allin, r.error);
  r = P.handle(s, ps[1].id, { t: 'raise', to: 300 }); ok('P1 all-in', !r.error && ps[1].allin, r.error);
  r = P.handle(s, ps[2].id, { t: 'call' }); ok('P2 calls', !r.error, r.error);
  ok('hand over', s.hand === 'between', s.hand + ' ' + s.street);
  ok('board dealt', s.lastHand.board.map(P.cardText).sort().join(' ') === ['10♦', '3♦', '7♠', '9♦', '2♥'].sort().join(' '), s.lastHand.board.map(P.cardText).join(' '));
  ok('main pot to aces: 300', ps[0].chips === 300, ps[0].chips);
  ok('side pot to kings: 400', ps[1].chips === 400, ps[1].chips);
  ok('P2 keeps the rest: 700', ps[2].chips === 700, ps[2].chips);
  ok('chips conserved', total(s) === 1400);
  const v = P.viewFor(s, ps[2].id, online(s));
  ok('showdown shows cards', v.players.every(p => p.cards?.length === 2));
  P._test.deck = null;
}
// uncalled bet comes back; nobody's cards are shown when everyone folds
{
  const { s, ps } = table(2); s.settings.turnTime = 0;
  P.handle(s, ps[0].id, { t: 'start' });
  const first = s.players[s.turn], other = s.players.find(p => p !== first);
  P.handle(s, first.id, { t: 'raise', to: 200 });
  const v = P.viewFor(s, first.id, online(s));
  ok('hidden cards', v.players.find(p => p.id === other.id).cards === null && v.players.find(p => p.id === first.id).cards.length === 2);
  P.handle(s, other.id, { t: 'fold' });
  ok('fold ends hand', s.hand === 'between');
  ok('winner gets blind only', first.chips === 1000 + (other === s.players[s.bb] ? 10 : 5), first.chips);
  ok('no cards shown', Object.keys(s.lastHand.shown).length === 0);
  ok('errors', P.handle(s, other.id, { t: 'check' }).error && P.handle(s, other.id, { t: 'next' }).error);
  ok('host deals early', !P.handle(s, ps[0].id, { t: 'next' }).error && s.hand === 'betting' && s.round === 2);
  // rules: can't check facing a bet, min raise
  const a = s.players[s.turn];
  ok('no check vs blind', !!P.handle(s, a.id, { t: 'check' }).error);
  ok('min raise', !!P.handle(s, a.id, { t: 'raise', to: 15 }).error && !P.handle(s, a.id, { t: 'raise', to: 20 }).error);
  const b = s.players[s.turn];
  ok('re-raise min 30', !!P.handle(s, b.id, { t: 'raise', to: 25 }).error && !P.handle(s, b.id, { t: 'raise', to: 30 }).error);
  ok('not your turn', !!P.handle(s, b.id, { t: 'call' }).error);
}

// 4. many random games: chips are never created or lost, and hands always finish
let hands = 0, showdowns = 0, rebuys = 0;
for (let g = 0; g < 240; g++) {
  const n = 2 + (g % 5);
  const { s, ps } = table(n, g % 2 === 0);
  s.settings.turnTime = g % 3 ? 20 : 0; s.settings.blind = P.BLINDS[g % 3]; s.settings.startChips = P.CHIPS[g % 3];
  P.handle(s, ps[0].id, { t: 'settings', startChips: s.settings.startChips });
  P.handle(s, ps[0].id, { t: 'start' });
  let steps = 0, leavers = false;
  while (s.round <= 25 && s.phase === 'playing' && steps++ < 4000) {
    if (!leavers && total(s) !== should(s)) { ok('conservation', false, `game ${g} hand ${s.round}: ${total(s)} vs ${should(s)}`); break; }
    if (s.hand === 'between') {
      if (s.lastHand.winners.some(w => w.hand)) showdowns++;
      hands++;
      if (steps % 7 === 0) P.timeoutMove(s, s.deadline + 1); else P.handle(s, s.hostId, { t: 'next' });
      continue;
    }
    const p = s.players[s.turn];
    if (!p) { ok('someone to act', false, `game ${g}`); break; }
    const v = P.viewFor(s, p.id, online(s));
    ok('view turn', v.turnId === p.id);
    if (p.bot) { const a = P.nextBotAction(s); const r = P.handle(s, a.pid, a.msg); ok('bot move legal', !r.error, r.error + ' ' + JSON.stringify(a.msg)); continue; }
    const r = Math.random();
    if (r < 0.03 && s.deadline) { P.timeoutMove(s, s.deadline + 1); continue; }
    if (g % 6 === 5 && r < 0.05 && s.players.filter(q => !q.left).length > 2 && p.id !== s.hostId) { P.removePlayer(s, p.id); leavers = true; continue; }
    let msg;
    if (r < 0.2) msg = { t: 'fold' };
    else if (r < 0.6) msg = { t: v.toCall ? 'call' : 'check' };
    else if (r < 0.9 && v.canRaise) msg = { t: 'raise', to: v.minRaiseTo + Math.floor(Math.random() * 3) * s.settings.blind };
    else if (v.canRaise) msg = { t: 'raise', to: v.maxRaiseTo };
    else msg = { t: v.toCall ? 'call' : 'check' };
    const res = P.handle(s, p.id, msg);
    ok('legal move accepted', !res.error, res.error + ' ' + JSON.stringify(msg) + JSON.stringify({ min: v.minRaiseTo, max: v.maxRaiseTo, cb: s.currentBet }));
    if (res.error) break;
  }
  ok('game made progress', s.round > 20 || s.phase !== 'playing', `game ${g}: hand ${s.round} steps ${steps}`);
  rebuys += s.players.reduce((a, p) => a + (p.rebuys || 0), 0);
  if (s.phase === 'playing') {
    P.handle(s, s.hostId, { t: 'end' });
    ok('ended', s.phase === 'ended' && s.lastRound.places.length === s.players.length);
    if (!leavers) ok('nets sum to zero', Object.values(s.lastRound.net).reduce((a, b) => a + b, 0) === 0, JSON.stringify(s.lastRound.net));
    ok('play again', !P.handle(s, s.hostId, { t: 'start' }).error && s.round === 1 && s.players.every(p => p.chips + p.total === s.settings.startChips));
  }
}
// 5. watchers are seated at the next hand; a full table
{
  const { s, ps } = table(2); P.handle(s, ps[0].id, { t: 'start' });
  const w = P.addPlayer(s, 'Late');
  ok('late joiner watches', s.spectators.length === 1 && P.viewFor(s, w.id, online(s)).spectating);
  ok('watcher cannot act', !!P.handle(s, w.id, { t: 'fold' }).error);
  P.handle(s, s.players[s.turn].id, { t: 'fold' }); P.handle(s, ps[0].id, { t: 'next' });
  ok('seated next hand', s.players.length === 3 && s.players[2].inHand && s.players[2].chips + s.players[2].total === 1000);
  ok('summary', P.summary(s, 'ABCD', 3).game === 'poker' && P.summary(s, 'ABCD', 3).players === 3);
  // last two leave → waiting room
  P.removePlayer(s, s.players[1].id); P.removePlayer(s, s.players.find(p => !p.left && p.id !== ps[0].id).id);
  ok('too few → lobby', s.phase === 'lobby' && s.players.length === 1);
}
console.log(`poker: ${hands} hands, ${showdowns} showdowns, ${rebuys} top-ups`, fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
