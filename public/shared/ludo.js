// Ludo rules engine and computer players. Pure logic, no Cloudflare APIs:
// the room server uses it, and the browser uses it for Play vs computer.
// It offers the same functions as game.js (newRoom, addPlayer, handle, viewFor, …),
// so the room server can run either game.
//
// The board: a loop of 52 squares, four coloured home columns of 5 squares, and the centre.
// Each seat (0–3, clockwise) has 4 tokens. A token's position is its PROGRESS:
//   -1        in the yard (not out yet)
//   0 … 50    on the loop, counted from that seat's own start square
//   51 … 55   in that seat's home column
//   56        home
// Square numbers on the loop ("abs") run 0–51 clockwise from seat 0's start square.

export const GAME = 'ludo';
export const MAX_PLAYERS = 4;
export const TOKENS = 4;
export const TRACK = 52;
export const LAST_LOOP = 50;  // last progress value that is still on the shared loop
export const HOME = 56;
export const START = [0, 13, 26, 39];                       // each seat's start square
export const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];         // start squares and star squares: no capturing here
export const TURN_TIMES = [0, 10, 15, 20, 30, 45, 60];
export const IDLE_KICK = 5; // after this many turns in a row played for them by the timer, other players may remove a person
export const MAX_BOTS = 3;
const SEAT_PLAN = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] }; // two players sit opposite each other
const LOG_MAX = 40;
// How long the screens take to show things (the computer players and the turn clock wait for these)
const ROLL_MS = 750, HOP_MS = 120, CAPTURE_MS = 450, SETTLE_MS = 250;

function randInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}
// Tests can replace the die: _test.die = room => 6
export const _test = { die: null };
const rollDie = s => (_test.die ? _test.die(s) : randInt(6) + 1);

export function randomId(len = 16) {
  const chars = 'abcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[randInt(chars.length)];
  return s;
}

export function newRoom() {
  return {
    game: GAME,
    phase: 'lobby', // lobby | playing | ended
    players: [],    // { id, token, name, seat, tokens[4], place, wins } — up to 4
    spectators: [], // joined while a game was running, or when all 4 seats were taken
    hostId: null,
    // Classic rules by default. The host can change them between games.
    settings: {
      releaseOne: false,   // a 1 also brings a token out (classic: only a 6)
      captureBonus: true,  // capturing gives another roll
      homeBonus: true,     // a token reaching home gives another roll
      threeSixes: true,    // three 6s in a row lose the turn
      blocks: false,       // two tokens of one colour on a square block the others
      botLevel: 'normal', turnTime: 15, private: false, reactions: false,
    },
    round: 0,
    turn: 0,         // index into players
    turnNo: 0,       // goes up every time the turn moves to another player
    actNo: 0,        // goes up every time someone has to do something (roll, or choose a token)
    step: 'roll',    // roll | move
    dice: null,      // the last roll
    sixes: 0,        // 6s in a row this turn
    movable: [],     // token numbers the current player may move
    finished: 0,     // players who have all four tokens home
    animMs: 0,       // how long the last change takes to show
    deadline: null,
    deadlineFor: -1,
    roundEndsAt: null, // (unused in Ludo; the room server looks at it)
    lastRound: null,   // { winnerId, places: [ids, best first] }
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
const inPlay = p => p.seat != null && !p.place; // sitting at the board and not finished yet
export const abs = (seat, progress) => (START[seat] + progress) % TRACK;
const onLoop = t => t >= 0 && t <= LAST_LOOP;

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

// Watchers take free seats (in the order they arrived) whenever no game is running
function seatSpectators(s) {
  while (s.spectators?.length && s.players.length < MAX_PLAYERS) {
    const sp = s.spectators.shift();
    sp.seat = null; sp.tokens = []; sp.place = 0;
    s.players.push(sp);
  }
}

export function addPlayer(s, name, opts = {}) {
  const p = { id: randomId(10), token: randomId(24), name: uniqueName(s, cleanName(name)), seat: null, tokens: [], place: 0, wins: 0 };
  if (opts.bot) { p.bot = true; p.level = opts.level === 'easy' ? 'easy' : 'normal'; }
  if (s.phase === 'playing' || s.players.length >= MAX_PLAYERS) {
    s.spectators ||= [];
    s.spectators.push(p); // watches; gets a seat when one is free and no game is running
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
  if (s.phase !== 'playing') { seatSpectators(s); return; }
  if (s.players.length < 2) {
    s.phase = 'lobby';
    s.deadline = null;
    seatSpectators(s);
    log(s, { k: 'toofew' });
    return;
  }
  if (i < s.turn) s.turn--;
  else if (i === s.turn) { // it was their turn: the next player rolls
    s.turn = s.turn % s.players.length;
    s.step = 'roll'; s.sixes = 0; s.movable = []; s.dice = null;
    s.turnNo++; s.actNo++;
    s.animMs = 0;
  }
  if (s.players.filter(inPlay).length < 2) return endGame(s);
  if (!inPlay(current(s))) nextPlayer(s);
}

export function startRound(s) {
  seatSpectators(s);
  const n = s.players.length;
  if (n < 2) return 'Need at least 2 players';
  if (n > MAX_PLAYERS) return `Ludo is for up to ${MAX_PLAYERS} players`;
  const plan = SEAT_PLAN[n];
  s.players.forEach((p, i) => { p.seat = plan[i]; p.tokens = Array(TOKENS).fill(-1); p.place = 0; p.idle = 0; });
  s.round++;
  s.turn = (s.round - 1) % n;
  s.step = 'roll'; s.dice = null; s.sixes = 0; s.movable = []; s.finished = 0;
  s.phase = 'playing';
  s.lastRound = null;
  s.turnNo++; s.actNo++;
  s.animMs = 0;
  log(s, { k: 'lstart', r: s.round, p: current(s).name });
  return null;
}

function nextPlayer(s) {
  const n = s.players.length;
  for (let k = 0; k < n; k++) {
    s.turn = (s.turn + 1) % n;
    if (inPlay(current(s))) break;
  }
  s.step = 'roll'; s.sixes = 0; s.movable = [];
  s.turnNo++; s.actNo++;
}
function rollAgain(s) {
  s.step = 'roll'; s.movable = [];
  s.actNo++;
}

function endGame(s) {
  // whoever is still on the board takes the next places, furthest along first
  const rest = s.players.filter(inPlay).sort((a, b) => progressOf(b) - progressOf(a));
  for (const p of rest) p.place = ++s.finished;
  const places = s.players.filter(p => p.place).sort((a, b) => a.place - b.place);
  const winner = places[0];
  if (winner) winner.wins = (winner.wins || 0) + 1;
  s.phase = 'ended';
  s.deadline = null;
  s.step = 'roll'; s.movable = [];
  s.lastRound = { winnerId: winner?.id ?? null, places: places.map(p => p.id) };
  log(s, { k: 'lend', p: winner?.name || '' });
}
const progressOf = p => p.tokens.reduce((a, t) => a + (t < 0 ? 0 : t + 1), 0);

// Another colour's block (two or more of its tokens) on this loop square?
function blockAt(s, seat, square) {
  for (const q of s.players) {
    if (q.seat == null || q.seat === seat) continue;
    let n = 0;
    for (const t of q.tokens) if (onLoop(t) && abs(q.seat, t) === square) n++;
    if (n >= 2) return true;
  }
  return false;
}

// Where token i would end up with this roll, or null if it can't move
export function target(s, p, i, d) {
  const t = p.tokens[i];
  if (t === HOME) return null;
  if (t === -1) {
    if (!(d === 6 || (d === 1 && s.settings.releaseOne))) return null;
    if (s.settings.blocks && blockAt(s, p.seat, abs(p.seat, 0))) return null;
    return 0;
  }
  const to = t + d;
  if (to > HOME) return null; // needs the exact roll to get home
  if (s.settings.blocks) {
    for (let k = t + 1; k <= Math.min(to, LAST_LOOP); k++) if (blockAt(s, p.seat, abs(p.seat, k))) return null; // can't land on or pass a block
  }
  return to;
}
export function movableTokens(s, p, d) {
  const out = [];
  for (let i = 0; i < TOKENS; i++) if (target(s, p, i, d) !== null) out.push(i);
  return out;
}

function roll(s, p) {
  if (s.step !== 'roll') return 'Move a token first';
  const d = rollDie(s);
  s.dice = d;
  s.sixes = d === 6 ? s.sixes + 1 : 0;
  log(s, { k: 'roll', p: p.name, c: p.seat, d });
  s.animMs = ROLL_MS;
  if (d === 6 && s.settings.threeSixes && s.sixes >= 3) {
    log(s, { k: 'three6', p: p.name });
    s.animMs += 500;
    nextPlayer(s);
    return null;
  }
  const can = movableTokens(s, p, d);
  if (!can.length) {
    log(s, { k: 'nomove', p: p.name, d });
    s.animMs += 500;
    if (d === 6) rollAgain(s); else nextPlayer(s);
    return null;
  }
  s.movable = can;
  // nothing to choose (one token, or every choice is the same move): the game moves it
  if (can.every(i => p.tokens[i] === p.tokens[can[0]])) { s.step = 'move'; return move(s, p, can[0], true); }
  s.step = 'move';
  s.actNo++;
  return null;
}

function move(s, p, i, afterRoll = false) {
  if (s.step !== 'move') return 'Roll the dice first';
  if (!Number.isInteger(i) || !s.movable.includes(i)) return "That token can't move";
  const d = s.dice;
  const from = p.tokens[i];
  const to = target(s, p, i, d);
  p.tokens[i] = to;
  const cap = [];
  if (onLoop(to)) {
    const sq = abs(p.seat, to);
    if (!SAFE.includes(sq)) {
      for (const q of s.players) {
        if (q === p || q.seat == null) continue;
        q.tokens.forEach((t, j) => {
          if (onLoop(t) && abs(q.seat, t) === sq) { q.tokens[j] = -1; cap.push({ c: q.seat, i: j, q: q.name, from: t }); }
        });
      }
    }
  }
  const home = to === HOME;
  log(s, { k: 'lmove', p: p.name, c: p.seat, i, from, to, d, ...(cap.length ? { cap } : {}), ...(home ? { home: 1 } : {}) });
  const hops = from === -1 ? 1 : to - from;
  s.animMs = (afterRoll ? ROLL_MS : 0) + hops * HOP_MS + (cap.length ? CAPTURE_MS : 0) + SETTLE_MS;
  s.movable = [];
  if (p.tokens.every(t => t === HOME)) {
    p.place = ++s.finished;
    log(s, { k: 'done', p: p.name, x: p.place });
    s.animMs += 600;
    if (s.players.filter(inPlay).length < 2) { endGame(s); return null; }
    nextPlayer(s);
    return null;
  }
  const again = d === 6 || (cap.length && s.settings.captureBonus) || (home && s.settings.homeBonus);
  if (again) rollAgain(s); else nextPlayer(s);
  return null;
}

// Start the clock whenever someone has to do something (computer players don't need one)
export function refreshDeadline(s, now = Date.now()) {
  if (s.phase !== 'playing' || !s.settings.turnTime) { s.deadline = null; return; }
  if (s.deadlineFor === s.actNo) return;
  s.deadlineFor = s.actNo;
  // the clock starts once the last move has been shown
  s.deadline = current(s)?.bot ? null : now + s.settings.turnTime * 1000 + (s.animMs || 0);
}

// Time's up: the game rolls for them, and picks a sensible token if there is a choice
let autoPlaying = false;
export function timeoutMove(s, now = Date.now()) {
  if (s.phase !== 'playing' || !s.deadline || now < s.deadline) return false;
  const p = current(s);
  if (!p || p.bot) return false;
  log(s, { k: 'timeout', p: p.name });
  const turnNo = s.turnNo;
  autoPlaying = true; // these moves are the game's, not the player's: they must not reset the idle count
  try {
    if (s.step === 'roll') handle(s, p.id, { t: 'roll' });
    if (s.phase === 'playing' && s.turnNo === turnNo && current(s) === p && s.step === 'move') handle(s, p.id, { t: 'move', token: pickToken(s, p, 'normal') });
  } finally { autoPlaying = false; }
  p.idle = (p.idle || 0) + 1;
  return true;
}
export function roundTimeUp() { return false; } // Ludo has no round time limit

export function handle(s, pid, msg) {
  const res = handleInner(s, pid, msg);
  if (!res.error && !autoPlaying && ['roll', 'move'].includes(msg?.t)) { const p = playerById(s, pid); if (p) p.idle = 0; }
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
    for (const k of ['releaseOne', 'captureBonus', 'homeBonus', 'threeSixes', 'blocks', 'private', 'reactions']) {
      if (typeof msg[k] === 'boolean') s.settings[k] = msg[k];
    }
    if (['easy', 'normal'].includes(msg.botLevel)) s.settings.botLevel = msg.botLevel;
    if (TURN_TIMES.includes(msg.turnTime)) s.settings.turnTime = msg.turnTime;
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
    if (s.phase === 'playing') return { error: 'Add computer players between games' };
    if (s.players.length >= MAX_PLAYERS) return { error: `Ludo is for up to ${MAX_PLAYERS} players` };
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
    s.animMs = 0;
    nextPlayer(s);
    return {};
  }

  if (current(s) !== p) return { error: 'Not your turn' };
  let e;
  if (t === 'roll') e = roll(s, p);
  else if (t === 'move') e = move(s, p, msg.token);
  else e = 'Unknown action';
  return e ? { error: e } : {};
}

// What one person sees. Nothing is hidden in Ludo, so everyone gets the same board;
// only "you" and what you may do differ.
export function viewFor(s, pid, online) {
  const me = playerById(s, pid);
  const playing = s.phase === 'playing';
  const cur = playing ? current(s) : null;
  const myTurn = !!cur && cur.id === pid;
  return {
    t: 'state',
    game: GAME,
    you: pid,
    phase: s.phase,
    round: s.round,
    hostId: s.hostId,
    settings: s.settings,
    players: s.players.map(p => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      tokens: p.tokens,
      place: p.place || 0,
      wins: p.wins || 0,
      online: !!p.bot || online.has(p.id),
      bot: !!p.bot,
      idleOut: !p.bot && (p.idle || 0) >= IDLE_KICK,
    })),
    spectating: !me && !!spectatorById(s, pid),
    spectators: (s.spectators || []).map(p => ({ id: p.id, name: p.name, online: online.has(p.id) })),
    turnId: cur?.id ?? null,
    step: s.step,
    dice: s.dice,
    sixes: s.sixes,
    movable: myTurn && s.step === 'move' ? s.movable : [],
    deadlineIn: s.deadline ? Math.max(0, s.deadline - Date.now()) : null,
    roundEndsIn: null,
    lastRound: s.lastRound,
    log: s.log.slice(-15),
  };
}

// One-line public summary for the room list
export function summary(s, code, onlineCount) {
  const host = playerById(s, s.hostId) || spectatorById(s, s.hostId);
  return {
    code,
    game: GAME,
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
const BOT_NAMES = ['Chintu', 'Pinky', 'Bunty', 'Golu', 'Munna', 'Tinku', 'Sonu', 'Babloo', 'Dolly',
  'Raju', 'Guddu', 'Chiku', 'Laddu', 'Motu', 'Bittu', 'Rinku', 'Pappu', 'Gattu', 'Jaggu', 'Kittu'];

export function botName(s) {
  const used = new Set([...s.players, ...(s.spectators || [])].map(p => p.name.toLowerCase()));
  const free = BOT_NAMES.filter(n => !used.has(n.toLowerCase()));
  return free.length ? free[randInt(free.length)] : 'Computer';
}

// How many of the others' tokens could capture a token standing at this progress value
function threat(s, p, progress) {
  if (!onLoop(progress)) return 0;
  const sq = abs(p.seat, progress);
  if (SAFE.includes(sq)) return 0;
  let n = 0;
  for (const q of s.players) {
    if (q === p || q.seat == null || q.place) continue;
    for (const t of q.tokens) {
      if (!onLoop(t)) continue;
      const gap = (sq - abs(q.seat, t) + TRACK) % TRACK;
      if (gap >= 1 && gap <= 6 && t + gap <= LAST_LOOP) n++; // close behind, and not turning into its home column first
    }
  }
  return n;
}

// Which token to move. Easy: any. Normal: capture, get home, get out, stay safe, then get ahead.
export function pickToken(s, p, level) {
  const can = s.movable;
  if (level === 'easy' || can.length === 1) return can[randInt(can.length)];
  const d = s.dice;
  let best = can[0], bestScore = -Infinity;
  for (const i of can) {
    const from = p.tokens[i];
    const to = target(s, p, i, d);
    let v = 0;
    if (onLoop(to) && !SAFE.includes(abs(p.seat, to))) {
      for (const q of s.players) {
        if (q === p || q.seat == null) continue;
        for (const t of q.tokens) if (onLoop(t) && abs(q.seat, t) === abs(p.seat, to)) v += 70 + t; // sending a far-along token home hurts most
      }
    }
    if (to === HOME) v += 55;
    if (from === -1) v += 34 - 6 * p.tokens.filter(onLoop).length; // more tokens out = more choices later
    if (to > LAST_LOOP && from <= LAST_LOOP) v += 22;               // into the home column: nobody can touch it
    if (onLoop(to) && SAFE.includes(abs(p.seat, to))) v += 16;
    v += threat(s, p, from) * 24;                                    // run from danger…
    v -= threat(s, p, to) * 28;                                      // …but not into it
    v += to / 5 + randInt(3);                                        // otherwise push the leading token
    if (v > bestScore) { bestScore = v; best = i; }
  }
  return best;
}

export function botMove(s, bot) {
  return s.step === 'move' ? { t: 'move', token: pickToken(s, bot, bot.level) } : { t: 'roll' };
}

// What should happen next on the computer players' side, if anything.
// Returns { pid, msg, delay } or null. Call again after every change.
export function nextBotAction(s) {
  if (s.phase !== 'playing') return null;
  const cur = current(s);
  if (!cur?.bot) return null;
  // wait for the last move to be shown, then a short human-like pause
  return { pid: cur.id, msg: botMove(s, cur), delay: (s.animMs || 0) + 450 + randInt(450) };
}
