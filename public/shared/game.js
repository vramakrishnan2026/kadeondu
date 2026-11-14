// Game rules engine and computer players. Pure logic, no Cloudflare APIs:
// the room server uses it, and the browser uses it for Play vs computer.
// Card: { id, c: 'r'|'y'|'g'|'b'|'w', v: '0'..'9' | 'skip' | 'rev' | 'd2' | 'wild' | 'wd4' }

export const COLORS = ['r', 'y', 'g', 'b'];
export const PLAYERS_PER_DECK = 10; // one extra 108-card deck is added per 10 players
const LOG_MAX = 40;

function randInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function randomId(len = 16) {
  const chars = 'abcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[randInt(chars.length)];
  return s;
}

function buildDeck(s) {
  const cards = [];
  const add = (c, v) => cards.push({ id: s.nextCardId++, c, v });
  for (const c of COLORS) {
    add(c, '0');
    for (let n = 1; n <= 9; n++) { add(c, String(n)); add(c, String(n)); }
    for (const v of ['skip', 'rev', 'd2']) { add(c, v); add(c, v); }
  }
  for (let k = 0; k < 4; k++) add('w', 'wild');
  for (let k = 0; k < 4; k++) add('w', 'wd4');
  return shuffle(cards);
}

export function cardPoints(card) {
  if (card.c === 'w') return 50;
  if (/^\d$/.test(card.v)) return Number(card.v);
  return 20;
}

export function newRoom() {
  return {
    phase: 'lobby', // lobby | playing | ended
    players: [],    // { id, token, name, hand, score, saidOndu } — dealt into the current round
    spectators: [], // same shape; joined mid-round, watching until the round ends
    hostId: null,
    settings: { stacking: false, handSize: 7, botLevel: 'normal', turnTime: 15, roundTime: 3, wd4Fx: false, private: false, reactions: false },
    turnNo: 0,       // goes up every time the turn moves on
    deadline: null,  // ms timestamp when the current person's time runs out
    deadlineFor: -1,
    roundEndsAt: null, // ms timestamp when the round's time limit runs out (null = no limit)
    round: 0,
    deck: [],
    discard: [],
    color: null,
    turn: 0,
    dir: 1,
    pendingDraw: 0,
    pendingType: null,
    drawnCardId: null,
    vulnerable: null, // player id who reached one card without calling
    winnerId: null,
    lastRound: null,  // { winnerId, points, timeUp? }
    nextCardId: 0,
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
const firstHuman = s => [...s.players, ...(s.spectators || [])].find(p => !p.bot)?.id ?? null;
const spectatorById = (s, id) => (s.spectators || []).find(p => p.id === id);

// Watchers become players when a round ends (they're dealt in next round)
function mergeSpectators(s) {
  if (!s.spectators?.length) return;
  for (const sp of s.spectators) { sp.hand = []; sp.saidOndu = false; s.players.push(sp); }
  s.spectators = [];
}
const mod = (a, n) => ((a % n) + n) % n;
const top = s => s.discard[s.discard.length - 1];
const current = s => s.players[s.turn];

function cleanName(name) {
  let n = String(name || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20);
  return n || 'Player';
}

function uniqueName(s, name) {
  let n = name, i = 2;
  const all = [...s.players, ...(s.spectators || [])];
  while (all.some(p => p.name.toLowerCase() === n.toLowerCase())) n = `${name} ${i++}`;
  return n;
}

function drawCards(s, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (s.deck.length === 0) {
      if (s.discard.length > 1) {
        const t = s.discard.pop();
        s.deck = shuffle(s.discard);
        s.discard = [t];
        log(s, { k: 'reshuffle' });
      } else {
        s.deck = buildDeck(s); // everyone is hoarding cards: open a fresh deck
        log(s, { k: 'newdeck' });
      }
    }
    out.push(s.deck.pop());
  }
  return out;
}

function give(s, p, n) {
  p.hand.push(...drawCards(s, n));
  if (p.hand.length > 1) p.saidOndu = false;
}

function advance(s, k) {
  s.turn = mod(s.turn + s.dir * k, s.players.length);
  s.turnNo = (s.turnNo || 0) + 1;
}

export const TURN_TIMES = [0, 10, 15, 20, 30, 45, 60];
export const IDLE_KICK = 5; // after this many turns in a row played for them by the timer, other players may remove a person
export const ROUND_TIMES = [0, 3, 5, 7, 10]; // minutes; 0 = no limit (default is 3)

// Start the clock whenever a new person's turn begins (computer players don't need one)
export function refreshDeadline(s, now = Date.now()) {
  if (s.phase !== 'playing' || !s.settings.turnTime) { s.deadline = null; return; }
  if (s.deadlineFor === s.turnNo) return;
  s.deadlineFor = s.turnNo;
  s.deadline = current(s)?.bot ? null : now + s.settings.turnTime * 1000;
}

// Time's up: the simplest possible move. Play the first card that fits,
// otherwise draw, then play that card if it fits or pass. No calling.
function autoMove(s, p) {
  if (s.pendingDraw > 0) return { t: 'draw' };
  if (s.drawnCardId !== null) {
    const c = p.hand.find(x => x.id === s.drawnCardId);
    return c && canPlay(s, c) ? { t: 'play', cardId: c.id, color: firstColor(p.hand, c) } : { t: 'pass' };
  }
  const c = p.hand.find(x => canPlay(s, x));
  return c ? { t: 'play', cardId: c.id, color: firstColor(p.hand, c) } : { t: 'draw' };
}
function firstColor(hand, played) {
  if (played.c !== 'w') return undefined;
  return hand.find(x => x !== played && x.c !== 'w')?.c || COLORS[randInt(4)];
}

let autoPlaying = false;
export function timeoutMove(s, now = Date.now()) {
  if (s.phase !== 'playing' || !s.deadline || now < s.deadline) return false;
  const p = current(s);
  if (!p || p.bot) return false;
  log(s, { k: 'timeout', p: p.name });
  const turnNo = s.turnNo;
  autoPlaying = true; // these moves are the game's, not the player's: they must not reset the idle count
  try {
    for (let i = 0; i < 3 && s.phase === 'playing' && s.turnNo === turnNo; i++) {
      const r = handle(s, p.id, autoMove(s, p));
      if (r.error) break;
    }
  } finally { autoPlaying = false; }
  p.idle = (p.idle || 0) + 1; // turns in a row the game has played for them (see IDLE_KICK)
  return true;
}

const handPoints = p => p.hand.reduce((a, c) => a + cardPoints(c), 0);

// Round time limit: when it runs out, the lowest card points in hand wins.
// Ties: fewer cards, then whoever is next to play (starting with the current player).
export function roundTimeUp(s, now = Date.now()) {
  if (s.phase !== 'playing' || !s.roundEndsAt || now < s.roundEndsAt) return false;
  const n = s.players.length;
  const order = p => mod((s.players.indexOf(p) - s.turn) * s.dir, n);
  const winner = [...s.players].sort((a, b) =>
    handPoints(a) - handPoints(b) || a.hand.length - b.hand.length || order(a) - order(b))[0];
  log(s, { k: 'timeup' });
  endRound(s, winner, true);
  return true;
}

export function canPlay(s, card) {
  if (s.drawnCardId !== null && card.id !== s.drawnCardId) return false;
  if (s.pendingDraw > 0) {
    if (card.v === 'wd4') return true;
    return card.v === 'd2' && s.pendingType === 'd2';
  }
  if (card.c === 'w') return true;
  return card.c === s.color || card.v === top(s).v;
}

export function addPlayer(s, name, opts = {}) {
  const p = {
    id: randomId(10),
    token: randomId(24),
    name: uniqueName(s, cleanName(name)),
    hand: [],
    score: 0,
    saidOndu: false,
  };
  if (opts.bot) { p.bot = true; p.level = opts.level === 'easy' ? 'easy' : 'normal'; }
  if (s.phase === 'playing') {
    s.spectators ||= [];
    s.spectators.push(p); // watches until this round ends
    log(s, { k: 'watch', p: p.name });
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
    return;
  }
  const i = s.players.findIndex(p => p.id === id);
  if (i < 0) return;
  const [p] = s.players.splice(i, 1);
  s.deck.unshift(...p.hand); // their cards go to the bottom of the draw pile
  log(s, { k: kind, p: p.name });
  if (s.vulnerable === id) s.vulnerable = null;
  if (s.hostId === id) s.hostId = firstHuman(s);
  if (s.phase === 'playing') {
    if (s.players.length < 2) {
      s.phase = 'lobby';
      s.roundEndsAt = null;
      mergeSpectators(s);
      if (!playerById(s, s.hostId)) s.hostId = firstHuman(s);
      log(s, { k: 'toofew' });
      return;
    }
    if (i < s.turn) s.turn--;
    else if (i === s.turn) {
      s.drawnCardId = null;
      s.turnNo = (s.turnNo || 0) + 1;
      if (s.dir === -1) s.turn--;
    }
    s.turn = mod(s.turn, s.players.length);
  }
}

export function startRound(s, now = Date.now()) {
  mergeSpectators(s);
  const n = s.players.length;
  if (n < 2) return 'Need at least 2 players';
  s.nextCardId = 0;
  const decks = Math.max(1, Math.ceil(n / PLAYERS_PER_DECK));
  s.deck = [];
  for (let d = 0; d < decks; d++) s.deck.push(...buildDeck(s));
  shuffle(s.deck);
  s.discard = [];
  for (const p of s.players) { p.hand = []; p.saidOndu = false; }
  for (let k = 0; k < s.settings.handSize; k++) for (const p of s.players) p.hand.push(s.deck.pop());
  // Flip until a number card shows (action cards go back into the deck)
  for (;;) {
    const c = s.deck.pop();
    if (/^\d$/.test(c.v)) { s.discard.push(c); break; }
    s.deck.splice(randInt(s.deck.length + 1), 0, c);
  }
  s.color = top(s).c;
  s.round++;
  s.dir = 1;
  s.turn = (s.round - 1) % n;
  s.pendingDraw = 0;
  s.pendingType = null;
  s.drawnCardId = null;
  s.vulnerable = null;
  s.winnerId = null;
  s.phase = 'playing';
  s.turnNo = (s.turnNo || 0) + 1;
  s.roundEndsAt = s.settings.roundTime ? now + s.settings.roundTime * 60000 : null;
  log(s, { k: 'start', r: s.round, decks });
  return null;
}

function endRound(s, winner, timeUp = false) {
  let points = 0;
  for (const p of s.players) if (p !== winner) for (const c of p.hand) points += cardPoints(c);
  winner.score += points;
  s.phase = 'ended';
  s.winnerId = winner.id;
  s.vulnerable = null;
  s.roundEndsAt = null;
  s.lastRound = { winnerId: winner.id, points };
  if (timeUp) { s.lastRound.timeUp = true; s.lastRound.left = handPoints(winner); }
  log(s, { k: 'win', p: winner.name, x: points });
  mergeSpectators(s);
}

function play(s, p, cardId, chosen) {
  const idx = p.hand.findIndex(c => c.id === cardId);
  if (idx < 0) return 'You do not have that card';
  const card = p.hand[idx];
  if (!canPlay(s, card)) return 'That card cannot be played now';
  if (card.c === 'w' && !COLORS.includes(chosen)) return 'Pick a colour';
  p.hand.splice(idx, 1);
  s.discard.push(card);
  s.color = card.c === 'w' ? chosen : card.c;
  s.drawnCardId = null;
  log(s, { k: 'play', p: p.name, card: { c: card.c, v: card.v }, col: s.color });

  if (p.hand.length === 1) {
    if (!p.saidOndu) s.vulnerable = p.id;
    p.saidOndu = false;
  }

  const n = s.players.length;
  const penalty = card.v === 'd2' ? 2 : card.v === 'wd4' ? 4 : 0;
  if (penalty) {
    if (s.settings.stacking) {
      s.pendingDraw += penalty;
      s.pendingType = card.v;
      advance(s, 1);
    } else {
      const victim = s.players[mod(s.turn + s.dir, n)];
      give(s, victim, penalty);
      log(s, { k: 'draw', p: victim.name, x: penalty, forced: true });
      advance(s, 2);
    }
  } else if (card.v === 'skip') {
    advance(s, 2);
  } else if (card.v === 'rev') {
    if (n === 2) advance(s, 2);
    else { s.dir *= -1; advance(s, 1); }
  } else {
    advance(s, 1);
  }

  if (card.v === 'wd4') s.wd4Turn = s.turnNo; // the table shows a 3 s effect: computer players wait for it
  if (p.hand.length === 0) endRound(s, p);
  return null;
}

function draw(s, p) {
  if (s.pendingDraw > 0) {
    give(s, p, s.pendingDraw);
    log(s, { k: 'draw', p: p.name, x: s.pendingDraw, forced: true });
    s.pendingDraw = 0;
    s.pendingType = null;
    advance(s, 1);
    return null;
  }
  if (s.drawnCardId !== null) return 'You already drew. Play that card or pass';
  const [card] = drawCards(s, 1);
  p.hand.push(card);
  p.saidOndu = false;
  log(s, { k: 'draw', p: p.name, x: 1 });
  if (canPlay(s, card)) s.drawnCardId = card.id;
  else advance(s, 1);
  return null;
}

// Returns { error } or { kick: playerId } or {}
export function handle(s, pid, msg) {
  roundTimeUp(s); // a move that arrives after the round's time limit doesn't count
  const res = handleInner(s, pid, msg);
  // playing a turn yourself clears the idle count
  if (!res.error && !autoPlaying && ['play', 'draw', 'pass'].includes(msg?.t)) { const p = playerById(s, pid); if (p) p.idle = 0; }
  refreshDeadline(s);
  return res;
}

function handleInner(s, pid, msg) {
  const p = playerById(s, pid) || spectatorById(s, pid);
  if (!p) return { error: 'You are not in this room' };
  const watching = !playerById(s, pid);
  const isHost = s.hostId === pid;
  const t = msg.t;

  if (t === 'settings') {
    if (!isHost) return { error: 'Only the host can change settings' };
    if (s.phase === 'playing') return { error: 'Change settings between rounds' };
    if (typeof msg.stacking === 'boolean') s.settings.stacking = msg.stacking;
    if (['easy', 'normal'].includes(msg.botLevel)) s.settings.botLevel = msg.botLevel;
    if (TURN_TIMES.includes(msg.turnTime)) s.settings.turnTime = msg.turnTime;
    if (ROUND_TIMES.includes(msg.roundTime)) s.settings.roundTime = msg.roundTime;
    if (typeof msg.wd4Fx === 'boolean') s.settings.wd4Fx = msg.wd4Fx;
    if (typeof msg.private === 'boolean') s.settings.private = msg.private;
    if (typeof msg.reactions === 'boolean') s.settings.reactions = msg.reactions;
    if ([5, 7, 10].includes(msg.handSize)) s.settings.handSize = msg.handSize;
    return {};
  }
  if (t === 'start') {
    if (!isHost) return { error: 'Only the host can start' };
    if (s.phase === 'playing') return { error: 'Round already running' };
    const e = startRound(s);
    return e ? { error: e } : {};
  }
  if (t === 'addbot') {
    if (!isHost) return { error: 'Only the host can add computer players' };
    if (s.phase === 'playing') return { error: 'Add computer players between rounds' };
    if (s.players.filter(x => x.bot).length >= MAX_BOTS) return { error: `Up to ${MAX_BOTS} computer players` };
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
    // Any player at the table (not a watcher) may remove a person the timer has played for 5 turns running
    if (watching) return { error: 'Only players in the round can do that' };
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

  if (s.phase !== 'playing') return { error: 'No round in progress' };
  if (watching) return { error: "You're watching this round. You'll be dealt in next round" };

  if (t === 'catch') {
    if (s.vulnerable && s.vulnerable === msg.target && msg.target !== pid) {
      const v = playerById(s, msg.target);
      give(s, v, 2);
      s.vulnerable = null;
      log(s, { k: 'catch', p: p.name, q: v.name });
      return {};
    }
    return { error: 'Too late!' };
  }
  if (t === 'ondu') {
    if (p.hand.length === 1 && s.vulnerable === pid) {
      s.vulnerable = null;
      log(s, { k: 'call', p: p.name });
      return {};
    }
    if (p.hand.length === 2 && current(s) === p) {
      if (!p.saidOndu) { p.saidOndu = true; log(s, { k: 'call', p: p.name }); }
      return {};
    }
    return { error: 'You can only call with your last card' };
  }
  if (t === 'skipturn') {
    if (!isHost) return { error: 'Only the host can skip a turn' };
    const c = current(s);
    if (s.pendingDraw > 0) { give(s, c, s.pendingDraw); s.pendingDraw = 0; s.pendingType = null; }
    s.drawnCardId = null;
    log(s, { k: 'skipped', p: c.name });
    advance(s, 1);
    return {};
  }

  if (current(s) !== p) return { error: 'Not your turn' };
  // Any turn action by someone else closes the window to catch the vulnerable player
  if (s.vulnerable && s.vulnerable !== pid) s.vulnerable = null;

  let e = null;
  if (t === 'play') e = play(s, p, msg.cardId, msg.color);
  else if (t === 'draw') e = draw(s, p);
  else if (t === 'pass') {
    if (s.drawnCardId === null) e = 'Draw a card first';
    else { s.drawnCardId = null; log(s, { k: 'pass', p: p.name }); advance(s, 1); }
  } else e = 'Unknown action';
  return e ? { error: e } : {};
}

// What one player is allowed to see
export function viewFor(s, pid, online) {
  const me = playerById(s, pid);
  const playing = s.phase === 'playing';
  const spectating = !me && !!spectatorById(s, pid);
  const turnId = playing ? current(s)?.id : null;
  const myTurn = playing && turnId === pid;
  return {
    t: 'state',
    you: pid,
    phase: s.phase,
    round: s.round,
    hostId: s.hostId,
    settings: s.settings,
    players: s.players.map(p => ({
      id: p.id,
      name: p.name,
      count: p.hand.length,
      score: p.score,
      online: !!p.bot || online.has(p.id),
      bot: !!p.bot,
      idleOut: !p.bot && (p.idle || 0) >= IDLE_KICK, // other players may remove them
    })),
    hand: me ? me.hand : [],
    playable: myTurn ? me.hand.filter(c => canPlay(s, c)).map(c => c.id) : [],
    top: s.discard.length ? top(s) : null,
    color: s.color,
    dir: s.dir,
    turnId,
    pendingDraw: s.pendingDraw,
    drawnCardId: myTurn ? s.drawnCardId : null,
    vulnerable: s.vulnerable,
    canCall: !!me && playing && ((me.hand.length === 1 && s.vulnerable === pid) ||
      (me.hand.length === 2 && myTurn && !me.saidOndu)),
    saidOndu: !!me?.saidOndu,
    spectating,
    spectators: (s.spectators || []).map(p => ({ id: p.id, name: p.name, online: online.has(p.id) })),
    deckCount: s.deck.length,
    deadlineIn: s.deadline ? Math.max(0, s.deadline - Date.now()) : null,
    roundEndsIn: playing && s.roundEndsAt ? Math.max(0, s.roundEndsAt - Date.now()) : null,
    lastRound: s.lastRound,
    log: s.log.slice(-15),
  };
}

// One-line public summary for the room list
export function summary(s, code, onlineCount) {
  const host = playerById(s, s.hostId);
  return {
    code,
    host: host ? host.name : '',
    players: s.players.length,
    watching: (s.spectators || []).length,
    phase: s.phase,
    online: onlineCount,
    private: !!s.settings.private,
  };
}

// ───────────────────────────────────────────────────────────
// Computer players
// ───────────────────────────────────────────────────────────
export const MAX_BOTS = 20;
const BOT_NAMES = ['Chintu', 'Pinky', 'Bunty', 'Golu', 'Munna', 'Tinku', 'Sonu', 'Babloo', 'Dolly',
  'Raju', 'Guddu', 'Chiku', 'Laddu', 'Motu', 'Bittu', 'Rinku', 'Pappu', 'Gattu', 'Jaggu', 'Kittu'];

export function botName(s) {
  const used = new Set([...s.players, ...(s.spectators || [])].map(p => p.name.toLowerCase()));
  const free = BOT_NAMES.filter(n => !used.has(n.toLowerCase()));
  return free.length ? free[randInt(free.length)] : 'Computer';
}

const chance = p => randInt(1000) < p * 1000;

function favouriteColor(hand) {
  const n = { r: 0, y: 0, g: 0, b: 0 };
  for (const c of hand) if (c.c !== 'w') n[c.c]++;
  const best = Math.max(...Object.values(n));
  const top = COLORS.filter(c => n[c] === best);
  return top[randInt(top.length)];
}

// Pick the next action for a computer player whose turn it is
export function botMove(s, bot) {
  const hand = bot.hand;
  const playable = hand.filter(c => canPlay(s, c));
  if (!playable.length) return s.drawnCardId !== null ? { t: 'pass' } : { t: 'draw' };

  // Second-last card: Normal always calls, Easy sometimes forgets
  if (hand.length === 2 && !bot.saidOndu && chance(bot.level === 'easy' ? 0.55 : 1)) return { t: 'ondu' };

  let card;
  if (bot.level === 'easy') {
    card = playable[randInt(playable.length)];
  } else {
    const n = s.players.length;
    const next = s.players[mod(s.turn + s.dir, n)];
    const threat = next && next.hand.length <= 2;   // next player is close to winning
    const mine = favouriteColor(hand.filter(c => c.c !== 'w')) || s.color;
    const score = c => {
      let v = 0;
      if (c.c === 'w') v -= 30;                       // save wilds for when they're needed
      if (c.v === 'wd4') v -= 10;
      if (c.c === mine) v += 8;                       // keep playing my strongest colour
      if (/^\d$/.test(c.v)) v += Number(c.v);         // dump high points first
      else if (c.c !== 'w') v += threat ? 40 : 12;    // actions hurt more when someone is close
      if (threat && c.c === 'w' && c.v === 'wd4') v += 60;
      if (s.pendingDraw > 0) v += 100;                // stacking beats picking up
      return v;
    };
    playable.sort((a, b) => score(b) - score(a));
    card = playable[0];
  }
  const rest = hand.filter(c => c !== card);
  const color = card.c === 'w'
    ? (bot.level === 'easy' ? COLORS[randInt(4)] : favouriteColor(rest) || COLORS[randInt(4)])
    : undefined;
  return { t: 'play', cardId: card.id, color };
}

// What should happen next on the computer players' side, if anything.
// Returns { pid, msg, delay } or null. Call again after every change.
export function nextBotAction(s) {
  if (s.phase !== 'playing') return null;
  const cur = current(s);
  if (!cur?.bot) return null;
  const someoneExposed = s.vulnerable && s.vulnerable !== cur.id;
  // Give people a moment to call or catch before the computer moves on
  const afterWd4 = s.settings.wd4Fx && s.wd4Turn === s.turnNo ? 3300 : 0; // let the Wild +4 effect finish first
  const delay = (someoneExposed ? 1800 : 750) + randInt(600) + afterWd4;
  if (someoneExposed && !playerById(s, s.vulnerable)?.bot && chance(cur.level === 'easy' ? 0.3 : 0.75)) {
    return { pid: cur.id, msg: { t: 'catch', target: s.vulnerable }, delay };
  }
  return { pid: cur.id, msg: botMove(s, cur), delay };
}
