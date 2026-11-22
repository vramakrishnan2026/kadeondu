// Ludo rule checks: thousands of computer-only games with every mix of house rules, plus set-piece cases.
// node ludosim.mjs
import * as L from '../public/shared/ludo.js';
import assert from 'node:assert/strict';

const rnd = n => Math.floor(Math.random() * n);
function check(s, where) {
  const seen = new Map(); // loop square -> seat
  for (const p of s.players) {
    if (p.seat == null) continue;
    assert.equal(p.tokens.length, 4, where);
    for (const t of p.tokens) {
      assert.ok(Number.isInteger(t) && t >= -1 && t <= 56, `${where}: token at ${t}`);
      if (t >= 0 && t <= 50) {
        const sq = L.abs(p.seat, t);
        if (!L.SAFE.includes(sq)) {
          assert.ok(!seen.has(sq) || seen.get(sq) === p.seat, `${where}: two colours share square ${sq}`);
          seen.set(sq, p.seat);
        }
      }
    }
    if (p.place) assert.ok(p.tokens.every(t => t === 56) || s.phase === 'ended', `${where}: placed without all tokens home`);
  }
  if (s.phase === 'playing') {
    const cur = s.players[s.turn];
    assert.ok(cur && cur.seat != null && !cur.place, `${where}: turn is with someone who can't play`);
    assert.ok(['roll', 'move'].includes(s.step), where);
    if (s.step === 'move') assert.ok(s.movable.length >= 2, `${where}: waiting for a choice with ${s.movable.length} option(s)`);
  }
}

function playGame({ n, settings, leaveAt = 0, level = 'normal' }) {
  const s = L.newRoom();
  Object.assign(s.settings, settings, { turnTime: 0 });
  const host = L.addPlayer(s, 'Host');
  for (let i = 1; i < n; i++) L.addPlayer(s, L.botName(s), { bot: true, level: i % 2 ? level : 'easy' });
  host.bot = true; host.level = level; // everyone is played by the computer here
  assert.deepEqual(L.handle(s, host.id, { t: 'start' }), {});
  const seats = s.players.map(p => p.seat);
  assert.deepEqual(seats, { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] }[n]);
  let steps = 0, sixRun = 0, lastTurn = -1, stats = { caps: 0, three6: 0, nomove: 0 };
  while (s.phase === 'playing') {
    assert.ok(++steps < 20000, 'game never ends');
    if (leaveAt && steps === leaveAt && s.players.length > 2) {
      const who = s.players[rnd(s.players.length)];
      if (who.id !== s.hostId) L.handle(s, who.id, { t: 'leave' });
      check(s, 'after leave');
      continue;
    }
    const a = L.nextBotAction(s);
    assert.ok(a, 'nobody to move');
    const before = s.seq, turnNo = s.turnNo, who = s.players[s.turn];
    const res = L.handle(s, a.pid, a.msg);
    assert.deepEqual(res, {}, JSON.stringify(res));
    assert.ok(a.delay >= 450 && a.delay < 12000);
    for (const e of s.log.filter(e => e.n > before)) {
      if (e.k === 'roll') { assert.ok(e.d >= 1 && e.d <= 6); sixRun = (e.d === 6 && lastTurn === turnNo) ? sixRun + 1 : (e.d === 6 ? 1 : 0); lastTurn = turnNo; if (settings.threeSixes) assert.ok(sixRun <= 3); }
      if (e.k === 'three6') { stats.three6++; assert.ok(settings.threeSixes && sixRun === 3); assert.notEqual(s.players[s.turn], who, 'three 6s must pass the turn'); }
      if (e.k === 'nomove') stats.nomove++;
      if (e.k === 'lmove') {
        if (e.from === -1) { assert.equal(e.to, 0); assert.ok(e.d === 6 || (settings.releaseOne && e.d === 1), `came out on a ${e.d}`); }
        else assert.equal(e.to, e.from + e.d);
        assert.ok(e.to <= 56);
        if (e.cap) { stats.caps += e.cap.length; assert.ok(e.to <= 50 && !L.SAFE.includes(L.abs(e.c, e.to)), 'captured on a safe square'); if (settings.blocks) assert.equal(e.cap.length, 1, 'captured a block'); }
      }
    }
    check(s, `step ${steps}`);
  }
  assert.equal(s.phase, 'ended');
  const places = s.players.map(p => p.place).sort();
  assert.deepEqual(places, s.players.map((_, i) => i + 1), 'places 1..n, each once');
  assert.equal(s.lastRound.places.length, s.players.length);
  assert.equal(s.players.find(p => p.id === s.lastRound.winnerId).place, 1);
  assert.equal(s.players.find(p => p.place === 1).wins, 1);
  assert.ok(s.players.filter(p => p.place < s.players.length).every(p => p.tokens.every(t => t === 56)), 'everyone but the last has all tokens home');
  return { steps, ...stats };
}

let games = 0, total = { steps: 0, caps: 0, three6: 0, nomove: 0 };
for (const n of [2, 3, 4]) {
  for (let mask = 0; mask < 32; mask++) {
    const settings = { releaseOne: !!(mask & 1), captureBonus: !!(mask & 2), homeBonus: !!(mask & 4), threeSixes: !!(mask & 8), blocks: !!(mask & 16) };
    for (let k = 0; k < 6; k++) {
      const r = playGame({ n, settings, leaveAt: k === 5 ? 40 + rnd(200) : 0, level: k % 2 ? 'easy' : 'normal' });
      games++; for (const key in total) total[key] += r[key];
    }
  }
}
console.log(`${games} games finished: average ${Math.round(total.steps / games)} actions, ${(total.caps / games).toFixed(1)} captures, ${total.three6} triple sixes, ${total.nomove} rolls with no move`);

// ── Set pieces ──
const setup = (settings = {}, n = 2) => {
  const s = L.newRoom(); Object.assign(s.settings, settings, { turnTime: 0 });
  const ps = []; for (let i = 0; i < n; i++) ps.push(L.addPlayer(s, 'P' + i));
  L.handle(s, ps[0].id, { t: 'start' });
  return { s, ps };
};
const die = (...seq) => { L._test.die = () => seq.shift(); };

{ // classic: only a 6 comes out, and a 6 rolls again
  const { s, ps } = setup();
  die(1); assert.deepEqual(L.handle(s, ps[0].id, { t: 'roll' }), {}); assert.equal(s.players[s.turn], ps[1], 'a 1 with nothing out passes the turn');
  die(6); L.handle(s, ps[1].id, { t: 'roll' });
  assert.deepEqual(ps[1].tokens, [0, -1, -1, -1], 'all four in the yard are the same move: moved automatically'); assert.equal(s.players[s.turn], ps[1], 'a 6 rolls again'); assert.equal(s.step, 'roll');
  die(6); L.handle(s, ps[1].id, { t: 'roll' }); assert.equal(s.step, 'move'); assert.deepEqual(s.movable, [0, 1, 2, 3]);
  assert.equal(L.handle(s, ps[0].id, { t: 'move', token: 0 }).error, 'Not your turn');
  assert.equal(L.handle(s, ps[1].id, { t: 'roll' }).error, 'Move a token first');
  assert.equal(L.handle(s, ps[1].id, { t: 'move', token: 7 }).error, "That token can't move");
  L.handle(s, ps[1].id, { t: 'move', token: 0 }); assert.deepEqual(ps[1].tokens, [6, -1, -1, -1]);
  die(6); L.handle(s, ps[1].id, { t: 'roll' }); assert.equal(s.players[s.turn], ps[0], 'third 6 in a row loses the turn'); assert.deepEqual(ps[1].tokens, [6, -1, -1, -1], 'and nothing moves');
}
{ // release on 1
  const { s, ps } = setup({ releaseOne: true });
  die(1); L.handle(s, ps[0].id, { t: 'roll' }); assert.deepEqual(ps[0].tokens, [0, -1, -1, -1]); assert.equal(s.players[s.turn], ps[1], 'a 1 does not roll again');
}
{ // capture sends the token home and rolls again; safe squares protect
  const { s, ps } = setup();
  ps[0].tokens = [10, -1, -1, -1]; ps[1].tokens = [L.TRACK - 26 + 14, -1, -1, -1]; // seat 2 at loop square 14
  assert.equal(L.abs(2, ps[1].tokens[0]), 14);
  die(4); L.handle(s, ps[0].id, { t: 'roll' });
  assert.deepEqual(ps[0].tokens, [14, -1, -1, -1]); assert.deepEqual(ps[1].tokens, [-1, -1, -1, -1], 'captured'); assert.equal(s.players[s.turn], ps[0], 'capture rolls again'); assert.equal(s.sixes, 0);
  ps[0].tokens = [4, -1, -1, -1]; ps[1].tokens = [L.TRACK - 26 + 8, -1, -1, -1]; // seat 2 on the star at square 8
  die(4); L.handle(s, ps[0].id, { t: 'roll' });
  assert.deepEqual([ps[0].tokens[0], ps[1].tokens[0]], [8, 34], 'both stand on the star'); assert.equal(s.players[s.turn], ps[1]);
}
{ // capture bonus off
  const { s, ps } = setup({ captureBonus: false });
  ps[0].tokens = [10, -1, -1, -1]; ps[1].tokens = [40, -1, -1, -1];
  die(4); L.handle(s, ps[0].id, { t: 'roll' }); assert.equal(ps[1].tokens[0], -1); assert.equal(s.players[s.turn], ps[1]);
}
{ // exact roll to get home; home rolls again; finishing ends a two-player game
  const { s, ps } = setup();
  ps[0].tokens = [53, 56, 56, 56];
  die(5); L.handle(s, ps[0].id, { t: 'roll' }); assert.equal(ps[0].tokens[0], 53, 'a 5 is too many'); assert.equal(s.players[s.turn], ps[1]);
  die(2); L.handle(s, ps[1].id, { t: 'roll' });
  die(3); L.handle(s, ps[0].id, { t: 'roll' });
  assert.equal(s.phase, 'ended'); assert.deepEqual([ps[0].place, ps[1].place, ps[0].wins], [1, 2, 1]); assert.deepEqual(s.lastRound, { winnerId: ps[0].id, places: [ps[0].id, ps[1].id] });
  assert.deepEqual(L.handle(s, ps[0].id, { t: 'start' }), {}); assert.equal(s.round, 2); assert.equal(s.players[s.turn], ps[1], 'the other player starts the next game');
  assert.deepEqual(ps[0].tokens, [-1, -1, -1, -1]);
}
{ // home bonus, and playing on for places with three players
  const { s, ps } = setup({}, 3);
  ps[0].tokens = [55, 56, 56, 20];
  die(1); L.handle(s, ps[0].id, { t: 'roll' }); assert.equal(s.step, 'move'); L.handle(s, ps[0].id, { t: 'move', token: 0 });
  assert.equal(s.players[s.turn], ps[0], 'reaching home rolls again');
  ps[0].tokens = [56, 56, 56, 55];
  die(1); L.handle(s, ps[0].id, { t: 'roll' });
  assert.equal(ps[0].place, 1); assert.equal(s.phase, 'playing', 'the others play on'); assert.equal(s.players[s.turn], ps[1]);
  die(3); L.handle(s, ps[1].id, { t: 'roll' }); die(3); L.handle(s, ps[2].id, { t: 'roll' });
  assert.equal(s.players[s.turn], ps[1], 'the finished player is skipped');
}
{ // blocks: two tokens of a colour can't be landed on or passed
  const { s, ps } = setup({ blocks: true });
  ps[1].tokens = [L.TRACK - 26 + 5, L.TRACK - 26 + 5, -1, -1]; // seat 2 block on square 5
  ps[0].tokens = [2, 3, -1, -1];
  die(3); L.handle(s, ps[0].id, { t: 'roll' });
  assert.deepEqual(ps[0].tokens, [2, 3, -1, -1], 'neither can land on or pass the block'); assert.equal(s.players[s.turn], ps[1]);
  die(1); L.handle(s, ps[1].id, { t: 'roll' }); L.handle(s, ps[1].id, { t: 'move', token: 0 });
  die(2); L.handle(s, ps[0].id, { t: 'roll' }); L.handle(s, ps[0].id, { t: 'move', token: 1 });
  assert.equal(ps[1].tokens[1], -1, 'a single token is captured again');
}
{ // turn timer: the game rolls and moves; five in a row and the others may remove them
  const { s, ps } = setup({}, 3);
  s.settings.turnTime = 15; s.deadlineFor = -1; L.refreshDeadline(s, 1000);
  assert.equal(s.deadline, 16000);
  assert.equal(L.timeoutMove(s, 15000), false);
  die(6, 6, 2);
  assert.equal(L.timeoutMove(s, 16001), true); assert.equal(ps[0].idle, 1); assert.deepEqual(ps[0].tokens, [0, -1, -1, -1]); assert.equal(s.players[s.turn], ps[0], 'their 6 still rolls again, on a fresh clock');
  assert.ok(s.deadline > Date.now());
  assert.equal(L.handle(s, ps[1].id, { t: 'kickidle', target: ps[0].id }).error, 'P0 is playing again');
  ps[0].idle = 5;
  assert.equal(L.viewFor(s, ps[1].id, new Set()).players[0].idleOut, true);
  assert.deepEqual(L.handle(s, ps[1].id, { t: 'kickidle', target: ps[0].id }), { kick: ps[0].id });
  assert.equal(s.players.length, 2); assert.equal(s.phase, 'playing'); assert.equal(s.hostId, ps[1].id);
  die(3); L.handle(s, s.players[s.turn].id, { t: 'roll' }); assert.equal(s.players[s.turn].idle, 0);
}
{ // seats and watchers: a fifth person watches, and takes a seat when one is free
  const s = L.newRoom(); const ps = [];
  for (let i = 0; i < 5; i++) ps.push(L.addPlayer(s, 'P' + i));
  assert.equal(s.players.length, 4); assert.equal(s.spectators.length, 1);
  assert.equal(L.handle(s, ps[0].id, { t: 'addbot' }).error, 'Ludo is for up to 4 players');
  L.handle(s, ps[0].id, { t: 'start' });
  const late = L.addPlayer(s, 'Late'); assert.equal(s.spectators.length, 2);
  assert.equal(L.handle(s, late.id, { t: 'roll' }).error, "You're watching this game");
  const v = L.viewFor(s, late.id, new Set([late.id]));
  assert.deepEqual([v.game, v.spectating, v.spectators.length, v.players.length, v.movable.length], ['ludo', true, 2, 4, 0]);
  L.handle(s, ps[1].id, { t: 'leave' }); assert.equal(s.players.length, 3); assert.equal(s.spectators.length, 2, 'no new seats mid-game');
  L.handle(s, ps[2].id, { t: 'leave' }); L.handle(s, ps[3].id, { t: 'leave' });
  assert.equal(s.phase, 'lobby', 'one player left: back to the waiting room'); assert.deepEqual(s.players.map(p => p.name), ['P0', 'P4', 'Late']);
  assert.deepEqual(L.summary(s, 'ABCD', 2), { code: 'ABCD', game: 'ludo', host: 'P0', players: 3, watching: 0, phase: 'lobby', online: 2, private: false });
  assert.equal(L.handle(s, ps[4].id, { t: 'settings', blocks: true }).error, 'Only the host can change settings');
  L.handle(s, ps[0].id, { t: 'settings', blocks: true, releaseOne: true, turnTime: 30, reactions: true, nonsense: 5 });
  assert.deepEqual([s.settings.blocks, s.settings.releaseOne, s.settings.turnTime, s.settings.reactions, s.settings.nonsense], [true, true, 30, true, undefined]);
}
L._test.die = null;
console.log('set pieces: all passed');
