// The private seat key (see "seatKey" in src/worker.js) must never be in what any player is sent.
// Run: node tests/seatsim.mjs
import * as G from '../public/shared/game.js';
import * as RU from '../public/shared/ruthless.js';
import * as L from '../public/shared/ludo.js';
import * as P from '../public/shared/poker.js';
import * as C from '../public/shared/carrom.js';
let bad = 0;
for (const [name, E] of Object.entries({ ondu: G, ruthless: RU, ludo: L, poker: P, carrom: C })) {
  const s = E.newRoom(); const a = E.addPlayer(s, 'A'), b = E.addPlayer(s, 'B');
  a.seatKey = 'secretkeysecretkeysecretk'; b.seatKey = 'otherkeyotherkeyotherkeyo';
  const online = new Set([a.id, b.id]);
  const check = () => { for (const p of [a, b]) { const out = JSON.stringify(E.viewFor(s, p.id, online)) + JSON.stringify(E.summary(s, 'ABCD', 2)); if (out.includes('secretkey') || out.includes('otherkey') || out.includes(a.token) || out.includes(b.token)) { bad++; console.log('LEAK in', name, s.phase); } } };
  check(); E.handle(s, a.id, { t: 'start' }); check();
}
console.log('seat keys and tokens stay on the server:', bad ? 'FAILED' : 'ok'); process.exit(bad ? 1 : 0);
