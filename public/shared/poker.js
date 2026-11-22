// Poker School: Texas Hold'em rules, hand reading and the coach.
// Used by the room server (src/worker.js) and by the browser (Play vs computer, drills, coach hints).
// Play chips only: there is no money anywhere in this game.
//
// Same shape as game.js and ludo.js: newRoom, addPlayer, removePlayer, handle, viewFor, summary,
// refreshDeadline, timeoutMove, roundTimeUp, nextBotAction.
//
// Cards are numbers 0..51: rank = card >> 2 (0 = Two … 12 = Ace), suit = card & 3 (0 ♠, 1 ♥, 2 ♦, 3 ♣).

export const GAME = 'poker';
export const MAX_PLAYERS = 6;
export const MAX_BOTS = 5;
export const TURN_TIMES = [0, 10, 15, 20, 30, 45, 60];
export const CHIPS = [500, 1000, 2000];   // starting stacks the host can pick
export const BLINDS = [10, 20, 50];       // big blind sizes (the small blind is half)
export const IDLE_KICK = 5;
const LOG_MAX = 50;
// How long the screens take to show things (computer players and the clocks wait for these)
const DEAL_MS = 900, ACT_MS = 350, BOARD_MS = 700, SHOW_MS = 1200;
const BETWEEN_MS = 4500, BETWEEN_SHOW_MS = 8000; // pause before the next hand (longer after a showdown)

function randInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}
// Tests can fix the deck: _test.deck = room => [cards, dealt from the END of the array]
export const _test = { deck: null };

export function randomId(len = 16) {
  const chars = 'abcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[randInt(chars.length)];
  return s;
}

// ───────────────────────────────────────────────────────────
// Cards and hand reading
// ───────────────────────────────────────────────────────────
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['♠', '♥', '♦', '♣'];
const RANK_NAMES = ['Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'];
const plural = r => (r === 4 ? 'Sixes' : RANK_NAMES[r] + 's');
export const CATEGORIES = ['High card', 'One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
export const rankOf = c => c >> 2;
export const suitOf = c => c & 3;
export const card = (rank, suit) => (rank << 2) | suit;
export const cardText = c => RANKS[c >> 2] + SUITS[c & 3];
// 'As', 'Td', '7h' … handy for tests and lessons
export function parseCard(t) {
  const r = '23456789TJQKA'.indexOf(t[0].toUpperCase()), s = 'shdc'.indexOf(t[1].toLowerCase());
  return card(r, s);
}
export const parseCards = t => t.trim().split(/\s+/).filter(Boolean).map(parseCard);

const P5 = 13 ** 5;
const pack = (cat, ks) => { let v = cat; for (let i = 0; i < 5; i++) v = v * 13 + (ks[i] ?? 0); return v; };
function straightHigh(m) {
  for (let h = 12; h >= 4; h--) if (((m >> (h - 4)) & 31) === 31) return h;
  return (m & 0x100f) === 0x100f ? 3 : -1; // A-2-3-4-5: the Five is the top card
}
// The best five-card hand in 5 to 7 cards, as one number: a bigger number is a better hand.
export function evaluate(cards) {
  const rc = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], sc = [0, 0, 0, 0], bs = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) { const r = c >> 2, s = c & 3; rc[r]++; sc[s]++; bs[s] |= 1 << r; mask |= 1 << r; }
  let fs = -1;
  for (let s = 0; s < 4; s++) if (sc[s] >= 5) fs = s;
  if (fs >= 0) { const sh = straightHigh(bs[fs]); if (sh >= 0) return pack(8, [sh]); }
  const quads = [], trips = [], pairs = [], singles = [];
  for (let r = 12; r >= 0; r--) {
    const n = rc[r];
    if (n === 4) quads.push(r); else if (n === 3) trips.push(r); else if (n === 2) pairs.push(r); else if (n === 1) singles.push(r);
  }
  if (quads.length) {
    let k = -1;
    for (let r = 12; r >= 0; r--) if (rc[r] && r !== quads[0]) { k = r; break; }
    return pack(7, [quads[0], Math.max(k, 0)]);
  }
  if (trips.length && (trips.length > 1 || pairs.length)) return pack(6, [trips[0], Math.max(trips[1] ?? -1, pairs[0] ?? -1)]);
  if (fs >= 0) { const ks = []; for (let r = 12; r >= 0 && ks.length < 5; r--) if (bs[fs] & (1 << r)) ks.push(r); return pack(5, ks); }
  const sh = straightHigh(mask);
  if (sh >= 0) return pack(4, [sh]);
  if (trips.length) return pack(3, [trips[0], ...singles.slice(0, 2)]);
  if (pairs.length >= 2) return pack(2, [pairs[0], pairs[1], Math.max(pairs[2] ?? -1, singles[0] ?? -1, 0)]);
  if (pairs.length === 1) return pack(1, [pairs[0], ...singles.slice(0, 3)]);
  return pack(0, singles.slice(0, 5));
}
export const category = v => Math.floor(v / P5);
function kickers(v) { const ks = []; let x = v % P5; for (let i = 0; i < 5; i++) { ks.unshift(x % 13); x = Math.floor(x / 13); } return ks; }
// "Pair of Kings", "Flush, Ace high" …
export function handName(v) {
  const cat = category(v), k = kickers(v);
  switch (cat) {
    case 8: return k[0] === 12 ? 'Royal flush' : `Straight flush, ${RANK_NAMES[k[0]]} high`;
    case 7: return `Four ${plural(k[0])}`;
    case 6: return `Full house, ${plural(k[0])} full of ${plural(k[1])}`;
    case 5: return `Flush, ${RANK_NAMES[k[0]]} high`;
    case 4: return `Straight, ${RANK_NAMES[k[0]]} high`;
    case 3: return `Three ${plural(k[0])}`;
    case 2: return `Two pair, ${plural(k[0])} and ${plural(k[1])}`;
    case 1: return `Pair of ${plural(k[0])}`;
    default: return `${RANK_NAMES[k[0]]} high`;
  }
}
// Which five of the cards make the best hand (for highlighting on screen)
export function bestFive(cards) {
  if (cards.length <= 5) return cards.slice();
  let best = null, bv = -1;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
    const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
    const v = evaluate(five);
    if (v > bv) { bv = v; best = five; }
  }
  return best;
}

export function freshDeck() { const d = []; for (let c = 0; c < 52; c++) d.push(c); return d; }
function shuffled() {
  const d = freshDeck();
  for (let i = d.length - 1; i > 0; i--) { const j = randInt(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

// Chance of winning (ties count as a share) against `opp` unknown hands, by dealing the rest out many times.
export function equity(hole, board = [], opp = 1, iters = 300) {
  const known = new Set([...hole, ...board]);
  const rest = [];
  for (let c = 0; c < 52; c++) if (!known.has(c)) rest.push(c);
  const need = 5 - board.length, take = need + 2 * opp;
  let score = 0;
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < take; i++) { const j = i + Math.floor(Math.random() * (rest.length - i)); const t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
    const full = board.concat(rest.slice(0, need));
    const mine = evaluate(hole.concat(full));
    let best = true, tie = 1;
    for (let o = 0; o < opp; o++) {
      const v = evaluate([rest[need + 2 * o], rest[need + 2 * o + 1]].concat(full));
      if (v > mine) { best = false; break; }
      if (v === mine) tie++;
    }
    if (best) score += 1 / tie;
  }
  return score / iters;
}

// Outs: the unseen cards that turn this hand into a clearly better one (two pair or better, and better than now),
// leaving out cards that only improve the shared board for everyone.
// Returns { count, kinds: { Flush: 9, Straight: 4, … } }. Meant for the flop and the turn.
export function outs(hole, board) {
  const res = { count: 0, kinds: {} };
  if (board.length < 3 || board.length > 4) return res;
  const known = new Set([...hole, ...board]);
  const now = category(evaluate(hole.concat(board)));
  for (let c = 0; c < 52; c++) {
    if (known.has(c)) continue;
    const after = category(evaluate(hole.concat(board, c)));
    if (after <= now || after < 2) continue;
    if (category(evaluate(board.concat(c))) >= after) continue; // the board alone makes it: no gain over the others
    res.count++;
    res.kinds[CATEGORIES[after]] = (res.kinds[CATEGORIES[after]] || 0) + 1;
  }
  return res;
}

// Starting-hand strength (the Chen formula): about 12+ for the very best hands, under 5 for hands to throw away.
export function chen(hole) {
  const [hi, lo] = [rankOf(hole[0]), rankOf(hole[1])].sort((a, b) => b - a);
  const pts = r => (r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2);
  let v = pts(hi);
  if (hi === lo) return Math.max(5, v * 2);
  if (suitOf(hole[0]) === suitOf(hole[1])) v += 2;
  const gap = hi - lo - 1;
  v -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 10) v += 1;
  return Math.ceil(v);
}
// "Pocket Kings", "Ace-King suited", "Seven-Two offsuit"
export function holeName(hole) {
  const [hi, lo] = [rankOf(hole[0]), rankOf(hole[1])].sort((a, b) => b - a);
  if (hi === lo) return `Pocket ${plural(hi)}`;
  return `${RANK_NAMES[hi]}-${RANK_NAMES[lo]} ${suitOf(hole[0]) === suitOf(hole[1]) ? 'suited' : 'offsuit'}`;
}
export function holeGroup(score) {
  return score >= 10 ? 'premium' : score >= 8 ? 'strong' : score >= 6 ? 'playable' : score >= 5 ? 'marginal' : 'weak';
}

// Where a seat is in the betting order. `n` players in the hand, `off` seats after the button (0 = the button itself).
export function positionName(n, off) {
  if (n === 2) return off === 0 ? 'button' : 'big blind';
  if (off === 0) return 'button';
  if (off === 1) return 'small blind';
  if (off === 2) return 'big blind';
  if (n <= 4) return 'early';
  if (off === n - 1) return 'late';
  return off === 3 ? 'early' : 'middle';
}
const posGroup = name => (name === 'button' || name === 'late' ? 'late' : name === 'early' ? 'early' : name === 'middle' ? 'middle' : 'blinds');

const pct = x => Math.round(x * 100) + '%';
const roundTo = (x, step) => Math.max(step, Math.round(x / step) * step);

// ───────────────────────────────────────────────────────────
// The coach: what a sound player would do here, and why.
// level: 'beginner' | 'intermediate' | 'advanced' decides how much of the reasoning is shown.
// spot: { hole, board, pot, toCall, myBet, chips, currentBet, minRaiseTo, bb, opp, position, iters }
// Returns { act: 'fold'|'check'|'call'|'raise', to, head, lines[], eq, need }
// ───────────────────────────────────────────────────────────
export function advise(spot, level = 'beginner') {
  const { hole, board = [], pot, toCall, myBet = 0, chips, currentBet = 0, bb } = spot;
  const opp = Math.max(1, spot.opp || 1);
  const maxTo = myBet + chips;
  const inter = level !== 'beginner', adv = level === 'advanced';
  const lines = [];
  const clampTo = to => Math.min(maxTo, Math.max(spot.minRaiseTo || 0, roundTo(to, Math.max(1, bb / 2))));
  const out = (act, to, head) => ({ act, to: act === 'raise' ? clampTo(to) : undefined, head, lines, eq: res.eq, need: res.need });
  const res = { eq: null, need: null };
  const need = toCall > 0 ? toCall / (pot + toCall) : 0; // share of the final pot you pay: the chance you need
  res.need = toCall > 0 ? need : null;

  if (board.length === 0) {
    const score = chen(hole), group = holeGroup(score), pos = posGroup(spot.position || 'middle');
    const name = holeName(hole);
    const tag = { premium: 'a premium hand', strong: 'a strong hand', playable: 'a playable hand', marginal: 'a borderline hand', weak: 'a weak hand' }[group];
    lines.push(`${name} is ${tag}.`);
    const headsUp = opp === 1;
    let open = { early: 8, middle: 7, late: 6, blinds: 7 }[pos] - (headsUp ? 2 : 0);
    if (inter && spot.position) lines.push(pos === 'late' ? `You act late (${spot.position}), so you can play more hands: you see what the others do first.`
      : pos === 'early' ? 'You act early, with players still to come behind you: only strong hands are worth playing from here.'
      : pos === 'blinds' ? `You are in the ${spot.position}: you already have chips in, but you will act first after the flop.`
      : 'From the middle of the order, play solid hands and fold the borderline ones.');
    if (adv) lines.push(`Starting-hand score ${score} (Chen). From this seat, opening needs about ${open}+.`);
    const raised = currentBet > bb;
    if (toCall === 0) { // nobody raised and you may check (big blind)
      if (score >= 9) { lines.push('Raise to build the pot while you are ahead.'); return out('raise', currentBet + 3 * bb, `Raise to ${clampTo(currentBet + 3 * bb)}`); }
      lines.push('Nobody raised: checking is free, so see the flop.');
      return out('check', 0, 'Check');
    }
    if (!raised) {
      if (score >= open) { lines.push(inter ? 'Raise rather than just call: you take the lead and thin the field.' : 'Good enough to raise: put the others to a decision.'); return out('raise', 3 * bb, `Raise to ${clampTo(3 * bb)}`); }
      if (toCall <= bb / 2 && score >= 4) { lines.push('It costs only half a bet to see the flop from the small blind.'); return out('call', 0, `Call ${toCall}`); }
      lines.push(inter ? 'Folding costs nothing more. Most of the money in poker is saved by folding hands like this before the flop.' : 'Fold and wait for a better hand: that is what good players do most of the time.');
      return out('fold', 0, 'Fold');
    }
    // someone has raised
    if (toCall >= chips * 0.5) {
      if (score >= 10) { lines.push('A big raise, but this hand is strong enough to play for all your chips.'); return out(toCall >= chips ? 'call' : 'raise', maxTo, toCall >= chips ? `Call ${Math.min(toCall, chips)}` : 'Raise all-in'); }
      lines.push('This would cost a large part of your stack. Only the very best hands are worth it.');
      return out('fold', 0, 'Fold');
    }
    if (score >= 11) { lines.push('Raise again: you very likely have the best hand, so make it expensive to chase you.'); return out('raise', currentBet * 3, `Raise to ${clampTo(currentBet * 3)}`); }
    if (score >= 9 || (score >= 7 && toCall <= 4 * bb && pos !== 'early')) {
      if (inter) lines.push(`Calling costs ${toCall} to win ${pot}: you need to win about ${pct(need)} of the time.`);
      lines.push('Strong enough to call a raise and see the flop.');
      return out('call', 0, `Call ${toCall}`);
    }
    lines.push(inter ? 'A raise means a strong hand. Against it, this hand is behind too often to pay for.' : 'Someone raised, which usually means a strong hand. Yours is not strong enough: fold.');
    return out('fold', 0, 'Fold');
  }

  // after the flop
  const street = board.length === 3 ? 'flop' : board.length === 4 ? 'turn' : 'river';
  const v = evaluate(hole.concat(board)), cat = category(v);
  const boardCat = category(evaluate(board));
  let made = handName(v);
  if (cat === 1) { // which pair?
    const pr = kickers(v)[0], top = Math.max(...board.map(rankOf));
    const pocket = rankOf(hole[0]) === rankOf(hole[1]);
    if (boardCat >= 1) made += ' (the pair is on the board, everyone has it)';
    else if (pocket) made += pr > top ? ' (an overpair: higher than every board card)' : ' (a pocket pair below the top board card)';
    else made += pr === top ? ' (top pair)' : ' (not the top pair)';
  } else if (cat >= 2 && boardCat >= cat) made += ' (it is all on the board, so everyone has it)';
  lines.push(`You have: ${made}.`);
  const o = street === 'river' ? { count: 0, kinds: {} } : outs(hole, board);
  const eq = equity(hole, board, opp, spot.iters || (adv ? 500 : 300));
  res.eq = eq;
  const drawing = o.count >= 4;
  if (inter && street !== 'river' && o.count) {
    const kinds = Object.entries(o.kinds).map(([k, n]) => `${n} for ${k.toLowerCase()}`).join(', ');
    const hit = Math.min(0.95, o.count * (street === 'flop' ? 4 : 2) / 100);
    lines.push(`Outs: ${o.count} cards improve you (${kinds}). Rule of ${street === 'flop' ? '4' : '2'}: about ${pct(hit)} ${street === 'flop' ? 'by the river' : 'on the river'}.`);
  }
  if (adv) lines.push(`Equity against ${opp} random hand${opp > 1 ? 's' : ''}: about ${pct(eq)}.`);

  if (toCall === 0) {
    if (eq >= 0.66 || (eq >= 0.55 && opp === 1)) {
      const to = currentBet + pot * (eq >= 0.8 ? 0.75 : 0.6);
      lines.push(inter ? 'You are probably ahead: bet for value, so weaker hands and draws pay to continue.' : 'You likely have the best hand. Bet so the others have to pay to stay in.');
      if (adv) lines.push(`Size: about ${eq >= 0.8 ? 'three quarters' : 'two thirds'} of the pot charges draws the wrong price without scaring off worse hands.`);
      return out('raise', to, `Bet ${clampTo(to)}`);
    }
    if (inter && drawing && o.count >= 8 && street !== 'river' && opp <= 2) {
      lines.push('A strong draw: a bet can win the pot now, and you can still hit your card if called (a semi-bluff).');
      return out('raise', currentBet + pot * 0.5, `Bet ${clampTo(currentBet + pot * 0.5)}`);
    }
    lines.push(eq >= 0.45 ? 'A middling hand: checking keeps the pot small and costs nothing.' : drawing ? 'Checking is free: take a free card and see if your draw comes in.' : 'Nothing much yet. Checking is free, so there is no reason to put chips in.');
    return out('check', 0, 'Check');
  }
  // facing a bet: against a hand that chose to bet, random-hand equity flatters you
  const big = toCall > pot * 0.7;
  const eqF = eq - (big ? 0.14 : 0.07);
  if (inter) lines.push(`It costs ${toCall} to win ${pot}: you need to win more than ${pct(need)} of the time (pot odds).`);
  if (adv) {
    lines.push(`Someone betting has a better-than-random hand, so treat your equity as nearer ${pct(Math.max(0, eqF))}.`);
    const ev = Math.round(Math.max(0, eqF) * (pot + toCall) - toCall);
    lines.push(`Calling is worth about ${ev >= 0 ? '+' : ''}${ev} chips on average.`);
  }
  if (eqF >= 0.72 && chips > toCall) {
    lines.push(inter ? 'You are well ahead of most hands that bet here: raise for value.' : 'Your hand is very strong: raise and win a bigger pot.');
    return out('raise', currentBet * 3, `Raise to ${clampTo(currentBet * 3)}`);
  }
  if (eqF >= need + 0.03) {
    lines.push(inter ? (drawing && cat <= 1 ? 'The pot is paying you enough to chase this draw.' : 'You win often enough for this price: call.') : (drawing && cat <= 1 ? 'You have a good chance to improve and the price is fair: call.' : 'Your hand is good enough to call.'));
    return out('call', 0, `Call ${Math.min(toCall, chips)}`);
  }
  lines.push(inter ? (drawing ? 'The price is too high for this draw: you will not hit often enough to pay for it.' : 'You do not win often enough for this price. Folding is the cheapest mistake in poker.') : 'This hand is too weak to pay for. Fold and save your chips.');
  return out('fold', 0, 'Fold');
}

// ───────────────────────────────────────────────────────────
// Room
// ───────────────────────────────────────────────────────────
export function newRoom() {
  return {
    game: GAME,
    phase: 'lobby', // lobby | playing | ended
    players: [],    // { id, token, name, chips, bet, total, folded, allin, acted, cards[2], inHand, rebuys, wins }
    spectators: [], // joined while a hand was running, or when all seats were taken: seated at the next hand
    hostId: null,
    settings: {
      startChips: 1000, blind: 10,
      coach: false,        // coach hints at this table (each player sees hints for their own cards only)
      botLevel: 'normal', turnTime: 20, private: false, reactions: false,
    },
    round: 0,        // hand number in this game
    hand: null,      // null | betting | between
    street: null,    // preflop | flop | turn | river
    board: [],
    deck: [],
    button: -1,      // index into players
    sb: -1, bb: -1,
    turn: -1,
    currentBet: 0,   // the bet to match on this street
    lastRaise: 0,    // size of the last full raise (the next raise must be at least this much more)
    turnNo: 0, actNo: 0,
    animMs: 0,
    deadline: null, deadlineFor: -1,
    roundEndsAt: null, // (unused in poker; the room server looks at it)
    lastHand: null,    // { n, board, winners: [{ id, amt, hand }], shown: { id: cards } }
    lastRound: null,   // when the host ends the game: { winnerId, places: [ids], net: { id: chips won or lost } }
    log: [],
    seq: 0,
  };
}

function log(s, entry) {
  s.seq++;
  s.log.push({ n: s.seq, ...entry });
  if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX);
}

const playerById = (s, id) => s.players.find(p => p.id === id && !p.left);
const spectatorById = (s, id) => (s.spectators || []).find(p => p.id === id);
const firstHuman = s => [...s.players.filter(p => !p.left), ...(s.spectators || [])].find(p => !p.bot)?.id ?? null;
const current = s => s.players[s.turn];
const alive = s => s.players.filter(p => p.inHand && !p.folded);
const canAct = p => p.inHand && !p.folded && !p.allin;
const potOf = s => s.players.reduce((a, p) => a + (p.total || 0), 0);
const seatedCount = s => s.players.filter(p => !p.left).length;

function cleanName(name) {
  const n = String(name || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20);
  return n || 'Player';
}
function uniqueName(s, name) {
  let n = name, i = 2;
  const all = [...s.players.filter(p => !p.left), ...(s.spectators || [])];
  while (all.some(p => p.name.toLowerCase() === n.toLowerCase())) n = `${name} ${i++}`;
  return n;
}
const blank = p => Object.assign(p, { bet: 0, total: 0, folded: false, allin: false, acted: false, cards: [], inHand: false });

// Watchers take free seats (in the order they arrived) whenever no hand is running
function seatSpectators(s) {
  while (s.spectators?.length && seatedCount(s) < MAX_PLAYERS) {
    const sp = s.spectators.shift();
    blank(sp);
    sp.chips = s.settings.startChips; sp.rebuys = 0; sp.wins = 0;
    s.players.push(sp);
    if (s.phase === 'playing') log(s, { k: 'seated', p: sp.name });
  }
}

export function addPlayer(s, name, opts = {}) {
  const p = blank({ id: randomId(10), token: randomId(24), name: uniqueName(s, cleanName(name)), chips: s.settings.startChips, rebuys: 0, wins: 0 });
  if (opts.bot) { p.bot = true; p.level = opts.level === 'easy' ? 'easy' : 'normal'; }
  if (s.phase === 'playing' || seatedCount(s) >= MAX_PLAYERS) {
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
  const i = s.players.findIndex(p => p.id === id && !p.left);
  if (i < 0) return;
  const p = s.players[i];
  log(s, { k: kind, p: p.name });
  if (s.phase !== 'playing') {
    s.players.splice(i, 1);
    if (s.hostId === id) s.hostId = firstHuman(s);
    seatSpectators(s);
    return;
  }
  // mid-game: their cards are folded and the seat is cleared before the next hand (so nobody's place in the order jumps)
  p.left = true;
  p.token = ''; // their saved session can no longer rejoin as this seat
  if (s.hostId === id) s.hostId = firstHuman(s);
  const wasTurn = s.hand === 'betting' && s.turn === i;
  if (s.hand === 'betting' && p.inHand && !p.folded) { p.folded = true; p.acted = true; }
  if (seatedCount(s) < 2) {
    // one person left: they take what is in the middle and the table goes back to the waiting room
    const last = s.players.find(q => !q.left);
    if (last && s.hand === 'betting') last.chips += potOf(s);
    s.players = s.players.filter(q => !q.left);
    s.players.forEach(blank);
    s.phase = 'lobby'; s.hand = null; s.turn = -1; s.board = []; s.deadline = null;
    seatSpectators(s);
    log(s, { k: 'toofew' });
    return;
  }
  if (s.hand === 'betting') {
    if (alive(s).length <= 1 || wasTurn) { s.animMs = 0; advance(s); }
  }
}

function put(p, amt) {
  amt = Math.max(0, Math.min(amt, p.chips));
  p.chips -= amt; p.bet += amt; p.total += amt;
  if (p.chips === 0) p.allin = true;
  return amt;
}

export function startRound(s) {
  s.players = s.players.filter(p => !p.left);
  seatSpectators(s);
  if (s.players.length < 2) return 'Need at least 2 players';
  s.phase = 'playing';
  s.round = 0;
  s.button = -1;
  s.lastRound = null; s.lastHand = null;
  for (const p of s.players) { blank(p); p.chips = s.settings.startChips; p.rebuys = 0; p.wins = 0; p.idle = 0; }
  log(s, { k: 'pstart', chips: s.settings.startChips, bb: s.settings.blind });
  startHand(s);
  return null;
}

function startHand(s) {
  s.players = s.players.filter(p => !p.left);
  seatSpectators(s);
  if (s.players.length < 2) {
    s.phase = 'lobby'; s.hand = null; s.turn = -1; s.board = []; s.deadline = null;
    s.players.forEach(blank);
    log(s, { k: 'toofew' });
    return;
  }
  const n = s.players.length, bbAmt = s.settings.blind, sbAmt = Math.floor(bbAmt / 2);
  for (const p of s.players) {
    blank(p);
    if (p.chips <= 0) { p.chips = s.settings.startChips; p.rebuys = (p.rebuys || 0) + 1; log(s, { k: 'rebuy', p: p.name }); }
    p.inHand = true;
  }
  s.round++;
  s.button = (s.button + 1) % n;
  s.board = [];
  s.street = 'preflop';
  s.hand = 'betting';
  s.lastHand = null;
  s.deck = _test.deck ? _test.deck(s).slice() : shuffled();
  s.sb = n === 2 ? s.button : (s.button + 1) % n;
  s.bb = n === 2 ? (s.button + 1) % n : (s.button + 2) % n;
  put(s.players[s.sb], sbAmt);
  put(s.players[s.bb], bbAmt);
  for (let k = 1; k <= n; k++) { const p = s.players[(s.button + k) % n]; p.cards = [s.deck.pop(), s.deck.pop()]; }
  s.currentBet = bbAmt;
  s.lastRaise = bbAmt;
  log(s, { k: 'deal', hand: s.round, btn: s.players[s.button].name, sb: s.players[s.sb].name, bb: s.players[s.bb].name, sbAmt, bbAmt });
  s.animMs = DEAL_MS;
  s.turn = s.bb; // the search for who acts starts after the big blind
  s.turnNo++; s.actNo++;
  advance(s, true);
}

// After every action: is the betting on this street finished, who is next, or is the hand over?
function advance(s, fresh = false) {
  const live = alive(s);
  if (live.length === 1) return award(s, null);
  const actors = live.filter(p => !p.allin);
  const settled = actors.every(p => p.acted && p.bet === s.currentBet);
  const alone = actors.length === 1 && actors[0].bet >= s.currentBet; // nobody left to bet against
  if (actors.length === 0 || settled || alone) return nextStreet(s);
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (s.turn + k) % n, p = s.players[i];
    if (canAct(p) && (!p.acted || p.bet < s.currentBet)) { s.turn = i; break; }
  }
  if (!fresh) { s.turnNo++; s.actNo++; }
}

// A bet nobody matched goes back to the player who made it
function returnUncalled(s) {
  const sorted = s.players.filter(p => p.inHand).sort((a, b) => b.bet - a.bet);
  if (sorted.length < 2) return;
  const diff = sorted[0].bet - sorted[1].bet;
  if (diff <= 0) return;
  const p = sorted[0];
  p.bet -= diff; p.total -= diff; p.chips += diff; p.allin = false;
  if (p.chips === 0) p.allin = true;
}

function nextStreet(s) {
  for (;;) {
    returnUncalled(s);
    for (const p of s.players) { p.bet = 0; p.acted = false; }
    s.currentBet = 0;
    s.lastRaise = s.settings.blind;
    if (s.street === 'river') return showdown(s);
    const take = s.street === 'preflop' ? 3 : 1;
    s.street = s.street === 'preflop' ? 'flop' : s.street === 'flop' ? 'turn' : 'river';
    const cards = [];
    for (let i = 0; i < take; i++) cards.push(s.deck.pop());
    s.board.push(...cards);
    log(s, { k: 'board', street: s.street, cards });
    s.animMs = (s.animMs || 0) + BOARD_MS;
    const actors = alive(s).filter(p => !p.allin);
    if (actors.length >= 2) break; // otherwise everyone is all-in: deal the rest out
  }
  const n = s.players.length;
  for (let k = 1; k <= n; k++) { const i = (s.button + k) % n; if (canAct(s.players[i])) { s.turn = i; break; } }
  s.turnNo++; s.actNo++;
}

function showdown(s) {
  const live = alive(s);
  const score = new Map(live.map(p => [p.id, evaluate(p.cards.concat(s.board))]));
  log(s, { k: 'show', hands: live.map(p => ({ id: p.id, p: p.name, cards: p.cards, hand: handName(score.get(p.id)) })) });
  award(s, score);
}

// Share out the pot. With all-ins there can be side pots: each is won by the best hand among those who paid into it.
function award(s, score) {
  const live = alive(s);
  const won = new Map();
  const n = s.players.length;
  const order = id => (s.players.findIndex(p => p.id === id) - s.button - 1 + 2 * n) % n; // first seat after the button gets odd chips
  if (!score) {
    returnUncalled(s);
    won.set(live[0].id, potOf(s));
  } else {
    const levels = [...new Set(live.map(p => p.total))].sort((a, b) => a - b);
    let prev = 0, rest = potOf(s);
    levels.forEach((lv, li) => {
      let amt = 0;
      for (const p of s.players) amt += Math.min(p.total, lv) - Math.min(p.total, prev);
      if (li === levels.length - 1) amt = rest; // (anything left over belongs to the last pot)
      rest -= amt;
      prev = lv;
      const elig = live.filter(p => p.total >= lv);
      const best = Math.max(...elig.map(p => score.get(p.id)));
      const winners = elig.filter(p => score.get(p.id) === best).sort((a, b) => order(a.id) - order(b.id));
      const share = Math.floor(amt / winners.length);
      let odd = amt - share * winners.length;
      for (const w of winners) { won.set(w.id, (won.get(w.id) || 0) + share + (odd > 0 ? 1 : 0)); odd--; }
    });
  }
  const winners = [];
  for (const [id, amt] of won) {
    if (amt <= 0) continue;
    const p = s.players.find(q => q.id === id);
    p.chips += amt;
    p.wins = (p.wins || 0) + 1;
    const hand = score ? handName(score.get(id)) : null;
    winners.push({ id, amt, hand });
    log(s, { k: 'pwin', p: p.name, id, amt, hand });
  }
  const shown = {};
  if (score) for (const p of live) shown[p.id] = p.cards;
  s.lastHand = { n: s.round, board: s.board.slice(), winners, shown };
  for (const p of s.players) { p.bet = 0; p.total = 0; }
  s.hand = 'between';
  s.turn = -1;
  s.currentBet = 0;
  s.animMs = (s.animMs || 0) + (score ? SHOW_MS : 0);
  s.turnNo++; s.actNo++;
  s.deadline = Date.now() + s.animMs + (score ? BETWEEN_SHOW_MS : BETWEEN_MS); // the next hand deals itself
  s.deadlineFor = s.actNo;
}

function endGame(s) {
  const seated = s.players.filter(p => !p.left);
  if (s.hand === 'betting') { // hand cut short: everyone gets their chips back
    for (const p of s.players) { p.chips += p.total || 0; }
  }
  const netOf = Object.fromEntries(seated.map(p => [p.id, p.chips - s.settings.startChips * (1 + (p.rebuys || 0))]));
  const places = seated.slice().sort((a, b) => netOf[b.id] - netOf[a.id]).map(p => p.id);
  s.players = seated;
  s.players.forEach(blank);
  s.lastRound = { winnerId: places[0] ?? null, places, net: netOf, hands: s.round };
  s.phase = 'ended'; s.hand = null; s.turn = -1; s.board = []; s.deadline = null; s.lastHand = null;
  seatSpectators(s);
  log(s, { k: 'pend' });
}

// The clock: a player's turn (if the room has a turn timer), or the pause before the next hand
export function refreshDeadline(s, now = Date.now()) {
  if (s.phase !== 'playing') { s.deadline = null; return; }
  if (s.hand === 'between') return; // set when the hand ended
  if (!s.settings.turnTime) { s.deadline = null; return; }
  if (s.deadlineFor === s.actNo) return;
  s.deadlineFor = s.actNo;
  s.deadline = current(s)?.bot ? null : now + s.settings.turnTime * 1000 + (s.animMs || 0);
}

let autoPlaying = false;
export function timeoutMove(s, now = Date.now()) {
  if (s.phase !== 'playing' || !s.deadline || now < s.deadline) return false;
  if (s.hand === 'between') {
    s.deadline = null;
    startHand(s);
    refreshDeadline(s);
    return true;
  }
  const p = current(s);
  if (!p || p.bot) return false;
  log(s, { k: 'timeout', p: p.name });
  autoPlaying = true; // the game's move, not the player's: it must not reset the idle count
  try { handle(s, p.id, { t: s.currentBet > p.bet ? 'fold' : 'check' }); } finally { autoPlaying = false; }
  p.idle = (p.idle || 0) + 1;
  return true;
}
export function roundTimeUp() { return false; }

const ACTIONS = ['fold', 'check', 'call', 'raise'];
export function handle(s, pid, msg) {
  const res = handleInner(s, pid, msg);
  if (!res.error && !autoPlaying && ACTIONS.includes(msg?.t)) { const p = s.players.find(q => q.id === pid); if (p) p.idle = 0; }
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
    for (const k of ['coach', 'private', 'reactions']) if (typeof msg[k] === 'boolean') s.settings[k] = msg[k];
    if (CHIPS.includes(msg.startChips)) s.settings.startChips = msg.startChips;
    if (BLINDS.includes(msg.blind)) s.settings.blind = msg.blind;
    if (['easy', 'normal'].includes(msg.botLevel)) s.settings.botLevel = msg.botLevel;
    if (TURN_TIMES.includes(msg.turnTime)) s.settings.turnTime = msg.turnTime;
    if (s.phase !== 'playing') for (const q of s.players) q.chips = s.settings.startChips;
    return {};
  }
  if (t === 'start') {
    if (!isHost) return { error: 'Only the host can start' };
    if (s.phase === 'playing') return { error: 'Game already running' };
    const e = startRound(s);
    return e ? { error: e } : {};
  }
  if (t === 'addbot') {
    if (!isHost) return { error: 'Only the host can add computer players' };
    if (seatedCount(s) + (s.spectators || []).length >= MAX_PLAYERS) return { error: `The table seats up to ${MAX_PLAYERS}` };
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
  if (t === 'end') {
    if (!isHost) return { error: 'Only the host can end the game' };
    endGame(s);
    return {};
  }
  if (t === 'next') { // deal the next hand without waiting for the pause to run out
    if (!isHost) return { error: 'Only the host can deal early' };
    if (s.hand !== 'between') return { error: 'The hand is still being played' };
    s.deadline = null;
    s.animMs = 0;
    startHand(s);
    return {};
  }
  if (watching) return { error: "You're watching: you get a seat at the next hand" };
  if (s.hand !== 'betting') return { error: 'Wait for the next hand' };

  if (t === 'skipturn') {
    if (!isHost) return { error: 'Only the host can skip a turn' };
    const c = current(s);
    log(s, { k: 'skipped', p: c.name });
    return act(s, c, { t: s.currentBet > c.bet ? 'fold' : 'check' });
  }
  if (current(s) !== p) return { error: 'Not your turn' };
  if (!ACTIONS.includes(t)) return { error: 'Unknown action' };
  return act(s, p, msg);
}

function act(s, p, msg) {
  const toCall = s.currentBet - p.bet;
  let t = msg.t;
  if (t === 'call' && toCall <= 0) t = 'check';
  if (t === 'check') {
    if (toCall > 0) return { error: `You can't check: call ${Math.min(toCall, p.chips)} or fold` };
    log(s, { k: 'pact', p: p.name, id: p.id, a: 'check' });
  } else if (t === 'fold') {
    p.folded = true;
    log(s, { k: 'pact', p: p.name, id: p.id, a: 'fold' });
  } else if (t === 'call') {
    const amt = put(p, toCall);
    log(s, { k: 'pact', p: p.name, id: p.id, a: 'call', amt, allin: p.allin });
  } else {
    const maxTo = p.bet + p.chips;
    let to = Math.floor(Number(msg.to));
    if (!Number.isFinite(to)) return { error: 'Choose an amount' };
    if (to > maxTo) to = maxTo;
    const minTo = s.currentBet === 0 ? Math.min(s.settings.blind, maxTo) : s.currentBet + s.lastRaise;
    if (to <= s.currentBet) { // not enough chips to raise: that is a call
      if (toCall <= 0) return { error: `Bet at least ${minTo}` };
      const amt = put(p, toCall);
      log(s, { k: 'pact', p: p.name, id: p.id, a: 'call', amt, allin: p.allin });
    } else {
      if (to < minTo && to < maxTo) return { error: `${s.currentBet ? 'Raise to' : 'Bet'} at least ${minTo}` };
      const first = s.currentBet === 0;
      const size = to - s.currentBet;
      put(p, to - p.bet);
      if (size >= s.lastRaise) s.lastRaise = size;
      s.currentBet = to;
      for (const q of s.players) if (q !== p) q.acted = false; // everyone gets to answer the raise
      log(s, { k: 'pact', p: p.name, id: p.id, a: first ? 'bet' : 'raise', to, allin: p.allin });
    }
  }
  p.acted = true;
  s.animMs = ACT_MS;
  advance(s);
  return {};
}

// What one person sees: their own two cards, and other players' cards only at a showdown.
export function viewFor(s, pid, online) {
  const me = playerById(s, pid);
  const playing = s.phase === 'playing';
  const betting = playing && s.hand === 'betting';
  const cur = betting ? current(s) : null;
  const shown = s.hand === 'between' ? s.lastHand?.shown || {} : {};
  const n = s.players.length;
  const pos = i => (betting || s.hand === 'between') && n ? positionName(n, (i - s.button + n) % n) : '';
  const toCall = me && betting ? Math.max(0, s.currentBet - me.bet) : 0;
  return {
    t: 'state',
    game: GAME,
    you: pid,
    phase: s.phase,
    round: s.round,
    hostId: s.hostId,
    settings: s.settings,
    players: s.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      bet: p.bet || 0,
      folded: !!p.folded,
      allin: !!p.allin,
      inHand: !!p.inHand,
      left: !!p.left,
      cards: p.id === pid ? p.cards : shown[p.id] || null,
      wins: p.wins || 0,
      rebuys: p.rebuys || 0,
      net: p.chips + (p.total || 0) - s.settings.startChips * (1 + (p.rebuys || 0)),
      pos: pos(i),
      online: !!p.bot || online.has(p.id),
      bot: !!p.bot,
      idleOut: !p.bot && (p.idle || 0) >= IDLE_KICK,
    })),
    spectating: !me && !!spectatorById(s, pid),
    spectators: (s.spectators || []).map(p => ({ id: p.id, name: p.name, online: !!p.bot || online.has(p.id) })),
    hand: s.hand,
    street: s.street,
    board: playing ? s.board : [],
    pot: potOf(s),
    buttonId: playing ? s.players[s.button]?.id ?? null : null,
    sbId: playing ? s.players[s.sb]?.id ?? null : null,
    bbId: playing ? s.players[s.bb]?.id ?? null : null,
    turnId: cur?.id ?? null,
    currentBet: s.currentBet,
    toCall: Math.min(toCall, me?.chips ?? 0),
    minRaiseTo: me && betting ? Math.min(me.bet + me.chips, s.currentBet === 0 ? s.settings.blind : s.currentBet + s.lastRaise) : 0,
    maxRaiseTo: me && betting ? me.bet + me.chips : 0,
    canRaise: !!me && betting && me.bet + me.chips > s.currentBet && s.players.some(p => p !== me && canAct(p)),
    deadlineIn: s.deadline ? Math.max(0, s.deadline - Date.now()) : null,
    roundEndsIn: null,
    lastHand: s.lastHand,
    lastRound: s.lastRound,
    log: s.log.slice(-25),
  };
}

export function summary(s, code, onlineCount) {
  const host = playerById(s, s.hostId) || spectatorById(s, s.hostId);
  return {
    code,
    game: GAME,
    host: host ? host.name : '',
    players: seatedCount(s),
    watching: (s.spectators || []).length,
    phase: s.phase,
    online: onlineCount,
    private: !!s.settings.private,
  };
}

// ───────────────────────────────────────────────────────────
// Computer players: the coach's advice, played with a few human habits
// ───────────────────────────────────────────────────────────
const BOT_NAMES = ['Chintu', 'Pinky', 'Bunty', 'Golu', 'Munna', 'Tinku', 'Sonu', 'Babloo', 'Dolly',
  'Raju', 'Guddu', 'Chiku', 'Laddu', 'Motu', 'Bittu', 'Rinku', 'Pappu', 'Gattu', 'Jaggu', 'Kittu'];

export function botName(s) {
  const used = new Set([...s.players, ...(s.spectators || [])].map(p => p.name.toLowerCase()));
  const free = BOT_NAMES.filter(n => !used.has(n.toLowerCase()));
  return free.length ? free[randInt(free.length)] : 'Computer';
}

// The numbers a player (or the coach) needs about their own spot
export function spotFor(s, p) {
  const n = s.players.length, i = s.players.indexOf(p);
  return {
    hole: p.cards, board: s.board, pot: potOf(s), toCall: Math.min(Math.max(0, s.currentBet - p.bet), p.chips),
    myBet: p.bet, chips: p.chips, currentBet: s.currentBet,
    minRaiseTo: Math.min(p.bet + p.chips, s.currentBet === 0 ? s.settings.blind : s.currentBet + s.lastRaise),
    bb: s.settings.blind, opp: alive(s).length - 1, position: positionName(n, (i - s.button + n) % n),
  };
}

export function botMove(s, bot) {
  const spot = spotFor(s, bot);
  spot.iters = 120;
  const a = advise(spot, 'advanced');
  const others = s.players.some(p => p !== bot && canAct(p));
  let act = a.act, to = a.to;
  const r = Math.random();
  if (bot.level === 'easy') {
    // loose and passive: calls too much, rarely raises, never bluffs
    if (act === 'fold' && spot.toCall <= spot.pot * 0.5 && r < 0.45) act = 'call';
    if (act === 'raise' && r < 0.5) act = spot.toCall > 0 ? 'call' : 'check';
  } else {
    if (act === 'check' && others && r < 0.12 && spot.board.length) { act = 'raise'; to = spot.currentBet + spot.pot * 0.5; } // a bluff now and then
    if (act === 'fold' && spot.toCall <= spot.pot * 0.25 && r < 0.2) act = 'call';                                            // a curious call
    if (act === 'raise' && r < 0.15 && spot.toCall === 0) act = 'check';                                                       // a slow-play
    if (act === 'raise') to = to * (0.85 + Math.random() * 0.4);
  }
  if (act === 'raise') {
    const maxTo = bot.bet + bot.chips;
    to = Math.min(maxTo, Math.max(spot.minRaiseTo, roundTo(to, Math.max(1, spot.bb / 2))));
    if (!others || to <= s.currentBet) act = spot.toCall > 0 ? 'call' : 'check';
  }
  if (act === 'check' && spot.toCall > 0) act = 'fold';
  if (act === 'fold' && spot.toCall === 0) act = 'check';
  return act === 'raise' ? { t: 'raise', to } : { t: act };
}

// What should happen next on the computer players' side, if anything: { pid, msg, delay } or null.
export function nextBotAction(s) {
  if (s.phase !== 'playing' || s.hand !== 'betting') return null;
  const cur = current(s);
  if (!cur?.bot) return null;
  return { pid: cur.id, msg: botMove(s, cur), delay: (s.animMs || 0) + 700 + randInt(900) };
}
