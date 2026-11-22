// Poker School: the home tab (level, lessons, drills), the lesson and drill screens, and the poker table.
// The rules, hand reading and the coach live in shared/poker.js (room server and browser both use it).
// The lessons are data in poker-learn.js. app.js calls window.KOPoker.init(bridge) once at start-up.
(() => {
  'use strict';
  const LEARN = window.POKER_LEARN;
  const $ = id => document.getElementById(id);
  let KO = null, el = null, P = null;
  const KEY = 'ko-poker';
  const LEVELS = LEARN.levels.map(l => l.id);
  let prog = { level: 'beginner', done: {}, drills: {} };
  const save = () => KO.store.set(KEY, prog);
  const level = () => (LEVELS.includes(prog.level) ? prog.level : 'beginner');

  async function engine() {
    if (!P) P = await import('./shared/poker.js');
    return P;
  }

  // ── Cards on screen ───────────────────────────────────────
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], SUITS = ['♠', '♥', '♦', '♣'];
  const parseCard = t => ('23456789TJQKA'.indexOf(t[0].toUpperCase()) << 2) | 'shdc'.indexOf(t[1].toLowerCase());
  const parseGroups = str => str.split('|').map(g => ({ cards: g.trim().split(/\s+/).filter(Boolean).map(parseCard) }));
  function cardEl(c, cls = '') {
    if (c == null) return el('div', 'pc back ' + cls);
    const d = el('div', `pc ${(c & 3) === 1 || (c & 3) === 2 ? 'red' : 'black'} ${cls}`);
    d.append(el('b', '', RANKS[c >> 2]), el('i', '', SUITS[c & 3]));
    d.setAttribute('aria-label', `${RANKS[c >> 2]}${SUITS[c & 3]}`);
    return d;
  }
  function groupsEl(groups, cls = '') {
    const row = el('div', 'pc-row ' + cls);
    for (const g of groups) {
      const box = el('div', 'pc-group');
      if (g.label) box.append(el('span', 'pc-label', g.label));
      const cards = el('div', 'pc-cards');
      for (const c of g.cards) cards.append(cardEl(c));
      box.append(cards);
      row.append(box);
    }
    return row;
  }
  function rich(text) { // **bold** only
    const p = el('p');
    text.split(/(\*\*[^*]+\*\*)/).forEach(part => {
      if (part.startsWith('**')) p.append(el('b', '', part.slice(2, -2))); else p.append(document.createTextNode(part));
    });
    return p;
  }

  // ── Home tab ──────────────────────────────────────────────
  function lessonsOf(lv = level()) { return LEARN.lessons[lv] || []; }
  function renderHome() {
    const lv = level();
    const chips = $('pkLevels');
    chips.replaceChildren();
    for (const l of LEARN.levels) {
      const b = el('button', 'pk-level' + (l.id === lv ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', l.id === lv ? 'true' : 'false');
      b.dataset.level = l.id;
      const done = lessonsOf(l.id).filter(x => prog.done[x.id] != null).length;
      b.append(el('span', 'pl-ico', l.icon), el('span', 'pl-name', l.label), el('span', 'pl-sub', done ? `${done} of ${lessonsOf(l.id).length} done` : l.sub));
      b.onclick = () => { prog.level = l.id; save(); renderHome(); };
      chips.append(b);
    }
    $('pkLevelAbout').textContent = LEARN.levels.find(l => l.id === lv).about;
    const ul = $('pkLessons');
    ul.replaceChildren();
    lessonsOf().forEach((ls, i) => {
      const li = el('li');
      const score = prog.done[ls.id];
      const info = el('div', 'rinfo');
      info.append(el('div', 'rname', `${i + 1}. ${ls.title}`), el('div', 'rmeta', score != null ? `Quiz: ${score} of ${ls.quiz.length}` : `${ls.pages.length} cards · ${ls.quiz.length} questions`));
      const b = el('button', score != null ? 'ghost small' : 'primary small', score != null ? 'Again' : 'Start');
      b.onclick = () => openLesson(ls);
      li.append(info);
      if (score != null) li.append(el('span', 'badge pk-done', score === ls.quiz.length ? '✓ Full marks' : '✓ Done'));
      li.append(b);
      ul.append(li);
    });
    const tiles = $('pkDrills');
    tiles.replaceChildren();
    for (const d of LEARN.drills[lv] || []) {
      const b = el('button', 'tile');
      const best = prog.drills[d.id]?.best;
      b.append(el('span', 't-ico', d.icon), el('span', 't-title', d.title), el('span', 't-sub', best != null ? `Best: ${best} of ${DRILL_LEN}` : d.sub));
      b.onclick = () => openDrill(d);
      tiles.append(b);
    }
  }
  function onTab(id) {
    if (!KO) return;
    const on = id === 'poker';
    const set = (sel, text) => { const x = document.querySelector(sel); if (x) x.textContent = text; };
    // the two "start your own" tiles read differently on this tab
    set('#createBtn .t-title', on ? 'Table with friends' : 'New room');
    set('#createBtn .t-sub', on ? 'Practise together' : 'Play with friends');
    set('#soloBtn .t-sub', on ? 'With coach hints' : 'Practise on your own');
    if (on) { renderHome(); engine().catch(() => {}); }
  }

  // ── Lessons, quizzes and drills (the "school" screen) ─────
  let SC = null; // what the school screen is showing
  const DRILL_LEN = 10;
  function openSchool(title) {
    $('scTitle').textContent = title;
    KO.show('school');
    window.scrollTo(0, 0);
  }
  function closeSchool() { SC = null; KO.show('home'); renderHome(); }
  function bar(done, total) { $('scBar').firstElementChild.style.width = `${Math.round((done / total) * 100)}%`; }
  function foot(...buttons) { $('scFoot').replaceChildren(...buttons.filter(Boolean)); }
  function btn(cls, text, fn) { const b = el('button', cls, text); b.onclick = fn; return b; }

  function openLesson(ls) {
    SC = { kind: 'lesson', ls, i: 0, q: 0, right: 0 };
    openSchool(ls.title);
    lessonPage();
  }
  function lessonPage() {
    const { ls, i } = SC, pg = ls.pages[i];
    const total = ls.pages.length + ls.quiz.length;
    bar(i, total);
    $('scStep').textContent = `Card ${i + 1} of ${ls.pages.length}`;
    const body = $('scBody');
    body.replaceChildren(el('h2', 'sc-h', pg.h));
    if (pg.cards) body.append(groupsEl(parseGroups(pg.cards)));
    body.append(rich(pg.t));
    const last = i === ls.pages.length - 1;
    foot(i > 0 ? btn('ghost', 'Back', () => { SC.i--; lessonPage(); }) : null,
      btn('primary big', last ? `Quiz: ${ls.quiz.length} questions` : 'Next', () => { if (last) { SC.q = 0; SC.right = 0; lessonQuiz(); } else { SC.i++; lessonPage(); } }));
    window.scrollTo(0, 0);
  }
  function lessonQuiz() {
    const { ls, q } = SC;
    bar(ls.pages.length + q, ls.pages.length + ls.quiz.length);
    $('scStep').textContent = `Question ${q + 1} of ${ls.quiz.length}`;
    const item = ls.quiz[q];
    ask({ q: item.q, groups: item.cards ? parseGroups(item.cards) : null, options: item.options, answer: item.answer, why: item.why }, right => {
      if (right) SC.right++;
      const last = q === ls.quiz.length - 1;
      foot(btn('primary big', last ? 'See my score' : 'Next question', () => { if (last) lessonDone(); else { SC.q++; lessonQuiz(); } }));
    });
  }
  function lessonDone() {
    const { ls, right } = SC;
    prog.done[ls.id] = Math.max(prog.done[ls.id] ?? 0, right);
    save();
    bar(1, 1);
    $('scStep').textContent = 'Done';
    const all = right === ls.quiz.length;
    const body = $('scBody');
    body.replaceChildren(el('div', 'sc-score', all ? '🎉' : right ? '👍' : '📖'), el('h2', 'sc-h center', `${right} of ${ls.quiz.length} right`),
      rich(all ? 'Full marks. On to the next one.' : 'Read the cards again any time: the quiz can be retaken as often as you like.'));
    const list = lessonsOf(), next = list[list.indexOf(ls) + 1];
    foot(btn('ghost', 'Poker School', closeSchool), all && next ? btn('primary big', `Next: ${next.title}`, () => openLesson(next)) : btn('primary big', all ? 'Finish' : 'Try the quiz again', () => { if (all) closeSchool(); else { SC.q = 0; SC.right = 0; lessonQuiz(); } }));
  }

  // One multiple-choice question. Calls back with true/false once answered.
  function ask(item, done) {
    const body = $('scBody');
    body.replaceChildren(el('h2', 'sc-h', item.q));
    if (item.groups) body.append(groupsEl(item.groups));
    if (item.note) body.append(el('p', 'sc-note', item.note));
    const opts = el('div', 'sc-opts');
    foot();
    item.options.forEach((text, k) => {
      const b = el('button', 'sc-opt', text);
      b.onclick = () => {
        if (opts.dataset.done) return;
        opts.dataset.done = '1';
        const right = k === item.answer;
        b.classList.add(right ? 'right' : 'wrong');
        opts.children[item.answer].classList.add('right');
        for (const o of opts.children) o.disabled = true;
        const why = el('div', 'sc-why ' + (right ? 'good' : 'bad'));
        why.append(el('b', '', right ? 'Right. ' : 'Not quite. '), document.createTextNode(item.why));
        body.append(why);
        done(right);
        why.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      };
      opts.append(b);
    });
    body.append(opts);
    window.scrollTo(0, 0);
  }

  // ── Drills: endless practice questions made by the rules engine ──
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  function deal(n, used = []) {
    const out = [], seen = new Set(used);
    while (out.length < n) { const c = rnd(52); if (!seen.has(c)) { seen.add(c); out.push(c); } }
    return out;
  }
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pctTxt = x => Math.round(x * 100) + '%';
  function fiveOf(cat) { // five cards that make exactly this category
    const C = (r, s) => (r << 2) | s;
    for (let tries = 0; tries < 4000; tries++) {
      let h;
      if (cat === 8) { const s = rnd(4), hi = 4 + rnd(9); h = [0, 1, 2, 3, 4].map(k => C(hi - k, s)); }
      else if (cat === 7) { const r = rnd(13); h = [0, 1, 2, 3].map(s => C(r, s)).concat(deal(1, [0, 1, 2, 3].map(s => C(r, s)))); }
      else if (cat === 6) { const a = rnd(13); let b = rnd(13); if (b === a) b = (b + 1) % 13; const sa = shuffle([0, 1, 2, 3]), sb = shuffle([0, 1, 2, 3]); h = [C(a, sa[0]), C(a, sa[1]), C(a, sa[2]), C(b, sb[0]), C(b, sb[1])]; }
      else if (cat === 5) { const s = rnd(4); h = shuffle([...Array(13).keys()]).slice(0, 5).map(r => C(r, s)); }
      else if (cat === 4) { const hi = 4 + rnd(9); h = [0, 1, 2, 3, 4].map(k => C(hi - k, rnd(4))); }
      else h = deal(5);
      if (new Set(h).size === 5 && P.category(P.evaluate(h)) === cat) return shuffle(h);
    }
    return deal(5);
  }
  const DRILLS = {
    name() {
      const cat = pick([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8]);
      const h = fiveOf(cat);
      const real = P.category(P.evaluate(h));
      const pool = [...new Set([real, real - 1, real + 1, real + 2, real - 2, rnd(9)].filter(c => c >= 0 && c <= 8))].slice(0, 4);
      while (pool.length < 4) { const c = rnd(9); if (!pool.includes(c)) pool.push(c); }
      pool.sort((a, b) => a - b);
      return { q: 'What do these five cards make?', groups: [{ cards: h }], options: pool.map(c => P.CATEGORIES[c]), answer: pool.indexOf(real), why: P.handName(P.evaluate(h)) + '.' };
    },
    winner() {
      for (;;) {
        const board = deal(5), a = deal(2, board), b = deal(2, board.concat(a));
        const va = P.evaluate(a.concat(board)), vb = P.evaluate(b.concat(board));
        if (Math.max(P.category(va), P.category(vb)) < 1) continue;
        if (va !== vb && Math.abs(P.category(va) - P.category(vb)) > 2 && Math.random() < 0.6) continue; // prefer close ones
        return { q: 'Who wins at the showdown?', groups: [{ label: 'Board', cards: board }, { label: 'Hand A', cards: a }, { label: 'Hand B', cards: b }],
          options: ['Hand A', 'Hand B', 'Split pot'], answer: va > vb ? 0 : vb > va ? 1 : 2,
          why: va === vb ? `Both make the same five cards: ${P.handName(va)}.` : `A: ${P.handName(va)}. B: ${P.handName(vb)}.` };
      }
    },
    outs() {
      for (;;) {
        const hole = deal(2), flop = deal(3, hole);
        const o = P.outs(hole, flop);
        if (o.count < 4 || o.count > 15 || P.category(P.evaluate(hole.concat(flop))) > 1) continue;
        if (!(o.kinds.Flush || o.kinds.Straight)) continue; // a real draw, not just two overcards
        const opts = [o.count];
        for (const c of shuffle([4, 6, 8, 9, 10, 12, 13, 15, 17, o.count + 1, o.count - 1, o.count + 3])) if (c > 0 && !opts.includes(c) && opts.length < 4) opts.push(c);
        opts.sort((a, b) => a - b);
        const kinds = Object.entries(o.kinds).map(([k, n]) => `${n} make ${/^[AEIOU]/.test(k) ? 'an' : 'a'} ${k.toLowerCase()}`).join(', ');
        return { q: 'How many outs do you have? (cards that make two pair or better)', groups: [{ label: 'Your cards', cards: hole }, { label: 'Flop', cards: flop }],
          options: opts.map(String), answer: opts.indexOf(o.count), why: `${o.count} outs: ${kinds}. Rule of 4: about ${Math.min(95, o.count * 4)}% by the river.` };
      }
    },
    odds() {
      for (;;) {
        const hole = deal(2), board = deal(4, hole);
        const o = P.outs(hole, board);
        if (o.count < 4 || o.count > 15 || P.category(P.evaluate(hole.concat(board))) > 1 || !(o.kinds.Flush || o.kinds.Straight)) continue;
        const pot = pick([100, 150, 200, 300, 400]), bet = Math.round(pot * pick([0.2, 0.25, 0.33, 0.5, 0.75, 1]) / 10) * 10;
        const need = bet / (pot + bet + bet), hit = o.count / 46;
        if (Math.abs(hit - need) < 0.04) continue;
        const call = hit > need;
        return { q: `The pot is ${pot}. Your opponent bets ${bet}. One card to come. Call or fold?`, note: 'Assume you win only if you hit your draw, and nothing more is bet afterwards.',
          groups: [{ label: 'Your cards', cards: hole }, { label: 'Board', cards: board }], options: ['Call', 'Fold'], answer: call ? 0 : 1,
          why: `${o.count} outs × 2 ≈ ${o.count * 2}% to hit. Calling ${bet} to win ${pot + bet} needs ${pctTxt(need)}. ${call ? 'You hit often enough: call.' : 'You do not hit often enough: fold.'}` };
      }
    },
    equity() {
      const hole = deal(2), flop = Math.random() < 0.5 ? deal(3, hole) : [];
      const eq = P.equity(hole, flop, 1, 2500);
      const right = Math.min(95, Math.max(5, Math.round(eq * 20) * 5));
      const opts = [right];
      for (const d of shuffle([-45, -30, -20, 20, 30, 45])) { const v = right + d; if (v >= 5 && v <= 95 && !opts.includes(v) && opts.length < 4) opts.push(v); }
      opts.sort((a, b) => a - b);
      const groups = [{ label: 'Your cards', cards: hole }];
      if (flop.length) groups.push({ label: 'Flop', cards: flop });
      return { q: `About how often does this hand win against one random hand${flop.length ? ' from here' : ' before the flop'}?`, groups,
        options: opts.map(v => `About ${v}%`), answer: opts.indexOf(right), why: `About ${pctTxt(eq)}. ${flop.length ? 'You have ' + P.handName(P.evaluate(hole.concat(flop))) : P.holeName(hole)}.` };
    },
    preflop() {
      for (;;) {
        const hole = deal(2), pos = pick(['early', 'middle', 'late']), raised = Math.random() < 0.4;
        const score = P.chen(hole), open = { early: 8, middle: 7, late: 6 }[pos];
        if (!raised && (score === open || score === open - 1)) continue;       // leave the coin-flip hands out
        if (raised && [7, 8, 10].includes(score)) continue;
        const spot = { hole, board: [], pot: raised ? 45 : 15, toCall: raised ? 30 : 10, myBet: 0, chips: 1000, currentBet: raised ? 30 : 10, minRaiseTo: raised ? 50 : 20, bb: 10, opp: 3, position: pos === 'late' ? 'button' : pos };
        const a = P.advise(spot, 'intermediate');
        const seat = pos === 'late' ? 'on the button (last to act)' : pos === 'early' ? 'in early position (first to act)' : 'in middle position';
        return { q: raised ? `You are ${seat}. A player before you raised to 3 big blinds. What do you do?` : `You are ${seat}. Everyone before you folded. What do you do?`,
          groups: [{ label: 'Your cards', cards: hole }], options: ['Raise', 'Call', 'Fold'], answer: a.act === 'raise' ? 0 : a.act === 'call' ? 1 : 2, why: a.lines.join(' ') };
      }
    },
    bluff() {
      const pot = pick([100, 150, 200, 300, 400]);
      const [frac, right] = pick([[1 / 3, 25], [1 / 2, 33], [2 / 3, 40], [1, 50], [2, 67]]);
      const bet = Math.round(pot * frac);
      const opts = [20, 25, 33, 40, 50, 67].filter(v => v !== right);
      const options = shuffle(opts).slice(0, 3).concat(right).sort((a, b) => a - b);
      return { q: `The pot is ${pot}. You bluff ${bet}. How often must your opponent fold for the bluff to break even?`, options: options.map(v => `${v}%`), answer: options.indexOf(right),
        why: `Bet ÷ (pot + bet) = ${bet} ÷ ${pot + bet} = ${right}%. If they fold more often than that, the bluff makes chips.` };
    },
  };
  async function openDrill(d) {
    try { await engine(); } catch { return KO.toast("Couldn't load the drill. Check your connection and try again"); }
    SC = { kind: 'drill', d, n: 0, right: 0 };
    openSchool(d.title);
    drillNext();
  }
  function drillNext() {
    const { d } = SC;
    if (SC.n >= DRILL_LEN) return drillDone();
    bar(SC.n, DRILL_LEN);
    $('scStep').textContent = `${SC.n + 1} of ${DRILL_LEN} · ${SC.right} right`;
    ask(DRILLS[d.id](), right => {
      if (right) SC.right++;
      SC.n++;
      foot(btn('primary big', SC.n >= DRILL_LEN ? 'See my score' : 'Next', drillNext));
    });
  }
  function drillDone() {
    const { d, right } = SC;
    const rec = prog.drills[d.id] || (prog.drills[d.id] = { best: 0, played: 0 });
    const record = right > rec.best && rec.played > 0;
    rec.best = Math.max(rec.best, right); rec.played++;
    save();
    bar(1, 1);
    $('scStep').textContent = 'Done';
    $('scBody').replaceChildren(el('div', 'sc-score', right >= 9 ? '🏆' : right >= 6 ? '👍' : '💪'), el('h2', 'sc-h center', `${right} of ${DRILL_LEN} right`),
      rich(record ? '**A new best.** Keep going.' : right >= 9 ? 'Excellent. Try the next level when this feels easy.' : 'Every round uses new cards, so another go is real practice.'));
    foot(btn('ghost', 'Poker School', closeSchool), btn('primary big', 'Go again', () => { SC.n = 0; SC.right = 0; drillNext(); }));
  }

  // ── The table ─────────────────────────────────────────────
  // Where the other players sit around the table (left %, top %), going clockwise from your left.
  const SPOTS = {
    1: [[50, 14]],
    2: [[24, 20], [76, 20]],
    3: [[13, 36], [50, 12], [87, 36]],
    4: [[12, 44], [30, 13], [70, 13], [88, 44]],
    5: [[11, 46], [20, 15], [50, 10], [80, 15], [89, 46]],
    6: [[11, 48], [14, 17], [38, 10], [62, 10], [86, 17], [89, 48]],
  };
  let T = null; // what the table remembers between updates
  const freshTable = () => ({ round: -1, boardLen: 0, deadlineAt: null, turnLength: 0, coachKey: '', advice: null, coachOpen: false, review: [], reviewRound: -1, raiseOpen: false, raiseTo: 0, waiting: false, endClosed: -1, toldWin: -1 });
  function reset() {
    T = null;
    for (const id of ['pkSeats', 'pkBoard', 'pkMe', 'pkMsg']) $(id)?.replaceChildren();
    for (const id of ['pkAdvice', 'pkRaise', 'pkEndOverlay', 'pkReview']) $(id)?.classList.add('hidden');
  }
  const coachOn = s => KO.isSolo() || !!s.settings.coach;
  const liveCount = s => s.players.filter(p => p.inHand && !p.folded).length;
  function lastActs(s) { // what each player last did on this street
    const m = new Map();
    for (let i = s.log.length - 1; i >= 0; i--) {
      const e = s.log[i];
      if (e.k === 'deal' || e.k === 'board') break;
      if (e.k === 'pact' && !m.has(e.id)) m.set(e.id, e.a === 'fold' ? 'Fold' : e.a === 'check' ? 'Check' : e.a === 'call' ? `Call ${e.amt}` : e.a === 'bet' ? `Bet ${e.to}` : `Raise ${e.to}`);
    }
    return m;
  }
  function spotOf(s, me) {
    return { hole: me.cards, board: s.board, pot: s.pot, toCall: s.toCall, myBet: me.bet, chips: me.chips, currentBet: s.currentBet,
      minRaiseTo: s.minRaiseTo, bb: s.settings.blind, opp: Math.max(1, liveCount(s) - 1), position: me.pos };
  }
  function adviceFor(s, me) {
    const key = [s.round, s.street, s.currentBet, s.toCall, s.pot, level()].join('|');
    if (T.coachKey !== key) { T.coachKey = key; T.advice = null; T.coachOpen = false; }
    if (!T.advice) { try { T.advice = P.advise(spotOf(s, me), level()); } catch { T.advice = null; } }
    return T.advice;
  }

  function lobby(s, isHost) { // the waiting room's poker settings (app.js draws the rest)
    $('pkChipsInput').value = String(s.settings.startChips);
    $('pkBlindInput').value = String(s.settings.blind);
    $('pkCoachInput').checked = !!s.settings.coach;
    $('privateInput').checked = !!s.settings.private;
    $('reactionsInput').checked = !!s.settings.reactions;
    $('botLevelInput').value = s.settings.botLevel || 'normal';
    $('turnTimeInput').value = String(s.settings.turnTime || 0);
    $('addBotBtn').disabled = s.players.length >= 6;
    $('guestSettings').textContent = isHost ? '' : `${s.settings.startChips} play chips each · blinds ${s.settings.blind / 2}/${s.settings.blind}` +
      ` · coach hints ${s.settings.coach ? 'on' : 'off'}` + (s.players.some(p => p.bot) ? ` · computer: ${s.settings.botLevel || 'normal'}` : '') +
      ` · ${s.settings.turnTime ? s.settings.turnTime + ' s per turn' : 'no turn timer'}` + (s.settings.reactions ? ' · 😄 reactions on' : '') + (s.settings.private ? ' · 🔒 private room' : '');
    $('startBtn').classList.toggle('hidden', !isHost);
    $('startBtn').disabled = s.players.length < 2;
    $('startBtn').textContent = s.players.length < 2 ? 'Waiting for players… (2 to 6)' : `Deal the cards (${s.players.length} players)`;
    $('waitHost').classList.toggle('hidden', isHost);
  }

  function render(s, fresh, firstState) {
    if (!P) { engine().then(() => { if (KO.getS() === s) render(s, fresh, firstState); }).catch(() => KO.toast("Couldn't load the game. Check your connection")); KO.show('poker'); return; }
    if (!T) T = freshTable();
    KO.show('poker');
    T.waiting = false;
    const me = s.players.find(p => p.id === s.you);
    const seated = !!me && !s.spectating;
    const isHost = s.hostId === s.you;
    const betting = s.phase === 'playing' && s.hand === 'betting';
    const between = s.phase === 'playing' && s.hand === 'between';
    const myTurn = betting && s.turnId === s.you && seated;
    if (myTurn && T.prevTurn !== s.you && !firstState) { try { navigator.vibrate?.(120); } catch {} }
    T.prevTurn = s.turnId;
    if (s.round !== T.round) { T.round = s.round; T.boardLen = 0; T.raiseOpen = false; if (T.reviewRound !== s.round) { T.reviewRound = s.round; T.review = []; } $('pkReview').classList.add('hidden'); }
    if (!myTurn) T.raiseOpen = false;

    // news
    if (!firstState) for (const e of fresh) {
      if (e.k === 'pwin' && e.id === s.you && T.toldWin !== e.n) { T.toldWin = e.n; try { navigator.vibrate?.([80, 60, 80]); } catch {} } // (the table itself says who won)
      else if (e.k === 'rebuy' && me && e.p === me.name) KO.toast('Out of chips: your stack has been topped up');
      else if (e.k === 'seated' && me && e.p === me.name) KO.toast('You have a seat: dealt in');
    }

    // clocks count from the moment this state arrived
    const at = s._at ?? (s._at = Date.now());
    T.deadlineAt = s.phase === 'playing' && s.deadlineIn != null ? at + s.deadlineIn : null;
    T.turnLength = (s.settings.turnTime || 0) * 1000;

    // who won, and with which five cards
    const lh = between ? s.lastHand : null;
    const winIds = new Set((lh?.winners || []).map(w => w.id));
    let hl = new Set();
    if (lh) { const w = lh.winners.find(x => lh.shown[x.id]); if (w) hl = new Set(P.bestFive(lh.shown[w.id].concat(lh.board))); }

    // the other players, clockwise from my left
    const acts = lastActs(s);
    const n = s.players.length, mi = seated ? s.players.indexOf(me) : -1;
    const others = seated ? Array.from({ length: n - 1 }, (_, k) => s.players[(mi + 1 + k) % n]) : s.players.slice();
    const spots = SPOTS[Math.min(6, Math.max(1, others.length))] || [];
    const seats = $('pkSeats');
    seats.replaceChildren();
    others.forEach((p, k) => {
      const [x, y] = spots[k] || [50, 8];
      const d = el('div', 'pk-seat' + (p.id === s.turnId ? ' turn' : '') + (p.folded || !p.inHand ? ' folded' : '') + (winIds.has(p.id) ? ' win' : '') + (p.left || !p.online ? ' away' : ''));
      d.style.left = x + '%'; d.style.top = y + '%';
      d.dataset.id = p.id;
      if (x < 34) d.classList.add('left'); else if (x > 66) d.classList.add('right');
      const cards = el('div', 'pk-hole');
      if (p.inHand && !p.folded) for (const c of p.cards || [null, null]) cards.append(cardEl(c, 'mini' + (c != null && hl.has(c) ? ' hl' : '')));
      const plate = el('div', 'pk-plate');
      const nm = el('div', 'pk-name');
      if (p.id === s.buttonId) nm.append(el('span', 'pk-d', 'D'));
      nm.append(el('span', 'pk-nm', (p.bot ? '🤖 ' : '') + p.name));
      plate.append(nm, el('div', 'pk-chips', p.left ? 'left' : String(p.chips)), el('i', 'pk-clock'));
      d.append(cards, plate);
      const act = p.allin ? 'All-in' : acts.get(p.id);
      if (betting && act && p.inHand) d.append(el('div', 'pk-act' + (p.folded ? ' dim' : ''), act));
      if (p.bet > 0) d.append(el('div', 'pk-bet', String(p.bet)));
      if (p.idleOut && seated && betting) { const x2 = el('button', 'pk-x', '✕'); x2.setAttribute('aria-label', `Remove ${p.name} (inactive)`); x2.onclick = () => KO.askKick(p); d.append(x2); }
      seats.append(d);
    });

    // the middle: pot, shared cards, who won
    $('pkPot').textContent = s.phase === 'playing' && (s.pot || betting) ? `Pot ${s.pot}` : '';
    const board = $('pkBoard');
    const shownBoard = between ? lh?.board || s.board : s.board;
    board.replaceChildren();
    for (let i = 0; i < 5; i++) {
      const c = shownBoard[i];
      if (c == null) board.append(el('div', 'pc slot'));
      else board.append(cardEl(c, (i >= T.boardLen && !firstState ? 'new ' : '') + (hl.has(c) ? 'hl' : '')));
    }
    T.boardLen = shownBoard.length;
    const msg = $('pkMsg');
    msg.replaceChildren();
    if (lh) for (const w of lh.winners) {
      const name = w.id === s.you ? 'You win' : `${s.players.find(p => p.id === w.id)?.name ?? '?'} wins`;
      msg.append(el('div', 'pk-won', `${name} ${w.amt}` + (w.hand ? ` · ${w.hand}` : '')));
    } else if (s.phase === 'ended') msg.append(el('div', 'pk-won', 'Game over'));
    else if (betting) msg.append(el('div', 'pk-street', `Hand ${s.round} · ${{ preflop: 'Before the flop', flop: 'Flop', turn: 'Turn', river: 'River' }[s.street] || ''}`));

    // my seat
    const mine = $('pkMe');
    mine.replaceChildren();
    mine.className = 'pk-me' + (myTurn ? ' turn' : '') + (seated && winIds.has(me.id) ? ' win' : '') + (seated && (me.folded || !me.inHand) && s.phase === 'playing' ? ' folded' : '');
    if (seated) {
      const cards = el('div', 'pk-mycards');
      const mc = me.inHand && me.cards?.length ? me.cards : null;
      if (mc) for (const c of mc) cards.append(cardEl(c, 'big' + (hl.has(c) ? ' hl' : '')));
      else { cards.append(el('div', 'pc big slot'), el('div', 'pc big slot')); }
      const info = el('div', 'pk-myinfo');
      const top = el('div', 'pk-myline');
      if (me.id === s.buttonId) top.append(el('span', 'pk-d', 'D'));
      top.append(el('b', '', `${me.chips} chips`));
      if (me.pos && betting) top.append(el('span', 'pk-pos', me.pos));
      info.append(top);
      let what = '';
      if (mc && s.phase === 'playing') what = me.folded ? 'You folded' : s.board.length ? P.handName(P.evaluate(mc.concat(shownBoard))) : P.holeName(mc);
      else if (s.phase === 'playing') what = 'Dealt in next hand';
      info.append(el('div', 'pk-what', what));
      if (me.bet > 0) info.append(el('div', 'pk-bet mine', `Your bet: ${me.bet}`));
      if (me.allin && betting) info.append(el('div', 'pk-act', 'All-in'));
      mine.append(cards, info, el('i', 'pk-clock'));
    } else mine.append(el('div', 'pk-what', s.spectating ? '👀 You are watching. You get a seat at the next hand.' : ''));

    const w = $('pkWatchers');
    w.classList.toggle('hidden', !s.spectators.length);
    w.textContent = s.spectators.length ? `👀 Watching: ${s.spectators.map(p => p.name + (p.id === s.you ? ' (you)' : '')).join(', ')}` : '';

    // the shared small-buttons row (reactions, mute, skip, mic)
    const net = seated ? me.net : 0;
    KO.sideRow(s, seated && s.phase === 'playing' ? `Hand ${s.round} · ${net > 0 ? '+' : ''}${net}` : '', me);

    // coach strip
    const strip = $('pkCoach');
    const canCoach = coachOn(s) && seated;
    let showStrip = false;
    if (canCoach && myTurn && me.cards?.length) {
      const a = adviceFor(s, me);
      if (a) {
        showStrip = true;
        const reveal = level() === 'beginner' || T.coachOpen;
        strip.textContent = reveal ? `💡 Coach: ${a.head} · why?` : '💡 Ask the coach';
        strip.dataset.mode = 'advice';
      }
    } else if (canCoach && between && T.review.length) {
      showStrip = true;
      const same = T.review.filter(r => r.match).length;
      strip.textContent = `📋 Review this hand · ${same} of ${T.review.length} matched the coach`;
      strip.dataset.mode = 'review';
    }
    strip.classList.toggle('hidden', !showStrip);
    if (!showStrip || strip.dataset.mode !== 'advice') $('pkAdvice').classList.add('hidden');

    controls();
    tick();
    if (s.phase === 'ended') ended(s, isHost); else $('pkEndOverlay').classList.add('hidden');
    KO.placeChatTab();
  }

  // Buttons and the status line
  function controls() {
    const s = KO.getS();
    if (!s || s.game !== 'poker' || !T || s.phase === 'lobby') return;
    const me = s.players.find(p => p.id === s.you);
    const seated = !!me && !s.spectating;
    const isHost = s.hostId === s.you;
    const betting = s.phase === 'playing' && s.hand === 'betting';
    const between = s.phase === 'playing' && s.hand === 'between';
    const inIt = seated && betting && me.inHand && !me.folded && !me.allin;
    const myTurn = inIt && s.turnId === s.you;
    const go = myTurn && !T.waiting;
    const who = s.players.find(p => p.id === s.turnId)?.name ?? '?';

    const fold = $('pkFold'), call = $('pkCall'), bet = $('pkBet');
    for (const b of [fold, call, bet]) b.classList.toggle('hidden', !betting || !seated);
    fold.disabled = !go || s.toCall === 0;
    call.disabled = !go;
    call.textContent = s.toCall > 0 ? (s.toCall >= (me?.chips ?? 0) ? `All-in ${s.toCall}` : `Call ${s.toCall}`) : 'Check';
    call.classList.toggle('go', go && !T.raiseOpen);
    const canRaise = go && s.canRaise;
    bet.disabled = !canRaise;
    const word = s.currentBet > 0 ? 'Raise' : 'Bet';
    bet.textContent = T.raiseOpen ? (T.raiseTo >= s.maxRaiseTo ? `All-in ${T.raiseTo}` : `${word} ${s.currentBet > 0 ? 'to ' : ''}${T.raiseTo}`) : word;
    bet.classList.toggle('confirm', T.raiseOpen);
    $('pkRaise').classList.toggle('hidden', !(T.raiseOpen && canRaise));
    if (T.raiseOpen && canRaise) {
      const r = $('pkRange');
      r.min = s.minRaiseTo; r.max = s.maxRaiseTo; r.step = Math.max(1, s.settings.blind / 2);
      r.value = T.raiseTo;
      $('pkRaiseAmt').textContent = T.raiseTo >= s.maxRaiseTo ? `All-in (${T.raiseTo})` : `${word} ${s.currentBet > 0 ? 'to ' : ''}${T.raiseTo}`;
    }
    $('pkNext').classList.toggle('hidden', !(between && isHost));
    $('pkEndGame').classList.toggle('hidden', !(between && isHost));
    $('pkAgain').classList.toggle('hidden', !(s.phase === 'ended' && isHost && T.endClosed === s.round));
    $('poker').classList.toggle('busy', T.waiting);

    const st = $('pkStatus');
    st.querySelector('.secs')?.remove();
    st.classList.toggle('mine', myTurn);
    st.textContent = s.phase === 'ended' ? 'Game over'
      : between ? 'Next hand coming up'
      : !seated ? `Watching · ${who}'s turn`
      : myTurn ? (s.toCall > 0 ? `Your turn: ${s.toCall} to call` : 'Your turn: check or bet')
      : me.folded ? `You folded · ${who}'s turn`
      : me.allin ? 'You are all-in'
      : !me.inHand ? `${who}'s turn · you are dealt in next hand`
      : `${who}'s turn`;
  }

  function tick() {
    const s = KO.getS();
    if (!s || s.game !== 'poker' || !T) return;
    const st = $('pkStatus');
    st.querySelector('.secs')?.remove();
    document.querySelectorAll('#poker .timing').forEach(x => x.classList.remove('timing', 'hurry'));
    if (!T.deadlineAt || s.phase !== 'playing') return;
    const left = Math.max(0, T.deadlineAt - Date.now());
    const secs = Math.ceil(left / 1000);
    if (s.hand === 'between') { st.append(el('span', 'secs', `${secs}s`)); return; }
    const hurry = secs <= 5;
    const seat = s.turnId === s.you ? $('pkMe') : [...document.querySelectorAll('.pk-seat')].find(x => x.dataset.id === s.turnId);
    if (seat) { seat.classList.add('timing'); seat.classList.toggle('hurry', hurry); seat.style.setProperty('--left', T.turnLength ? Math.min(1, left / T.turnLength).toFixed(3) : 1); }
    st.append(el('span', 'secs' + (hurry ? ' hurry' : ''), `${Math.min(secs, Math.round(T.turnLength / 1000) || secs)}s`));
    if (hurry && !T.buzzed && s.turnId === s.you) { T.buzzed = true; try { navigator.vibrate?.([60, 60, 60]); } catch {} }
    if (!hurry) T.buzzed = false;
  }

  // My move: note what the coach would have done, for the review after the hand
  function act(msg) {
    const s = KO.getS();
    if (!s || !T || T.waiting || s.turnId !== s.you) return;
    const me = s.players.find(p => p.id === s.you);
    if (coachOn(s) && me?.cards?.length) {
      const a = adviceFor(s, me);
      if (a) {
        const word = msg.t === 'raise' ? (s.currentBet > 0 ? `Raise to ${msg.to}` : `Bet ${msg.to}`) : msg.t === 'call' ? `Call ${s.toCall}` : msg.t === 'check' ? 'Check' : 'Fold';
        const mine = msg.t === 'call' && s.toCall === 0 ? 'check' : msg.t;
        T.review.push({ street: { preflop: 'Before the flop', flop: 'Flop', turn: 'Turn', river: 'River' }[s.street], did: word, coach: a.head, match: mine === a.act, lines: a.lines });
      }
    }
    T.waiting = true; T.raiseOpen = false;
    $('pkAdvice').classList.add('hidden');
    controls();
    KO.send(msg);
  }

  function ended(s, isHost) {
    const ov = $('pkEndOverlay');
    const closed = T.endClosed === s.round;
    ov.classList.toggle('hidden', closed || !s.lastRound);
    if (!s.lastRound) return;
    const name = id => s.players.find(p => p.id === id)?.name ?? '?';
    $('pkEndTitle').textContent = s.lastRound.winnerId === s.you ? 'You finished on top! 🎉' : `${name(s.lastRound.winnerId)} finished on top`;
    $('pkEndSub').textContent = `${s.lastRound.hands} hand${s.lastRound.hands === 1 ? '' : 's'} played · play chips won or lost`;
    const ol = $('pkEndList');
    ol.replaceChildren();
    s.lastRound.places.filter(id => s.players.some(p => p.id === id)).forEach((id, k) => {
      const v = s.lastRound.net[id] || 0;
      const li = el('li', '', `${['🥇', '🥈', '🥉'][k] || '🃏'} ${name(id)}` + (id === s.you ? ' (you)' : ''));
      li.append(el('span', v > 0 ? 'up' : v < 0 ? 'down' : '', (v > 0 ? '+' : '') + v));
      ol.append(li);
    });
    $('pkEndAgain').classList.toggle('hidden', !isHost);
    $('pkEndAgain').disabled = s.players.length < 2;
    $('pkEndWait').classList.toggle('hidden', isHost);
  }

  function showAdvice() {
    const s = KO.getS();
    const me = s?.players.find(p => p.id === s.you);
    if (!s || !T || !me) return;
    const box = $('pkAdvice');
    if ($('pkCoach').dataset.mode === 'review') return showReview();
    const a = adviceFor(s, me);
    if (!a) return;
    if (level() !== 'beginner' && !T.coachOpen) { T.coachOpen = true; $('pkCoach').textContent = `💡 Coach: ${a.head} · why?`; }
    else if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
    box.replaceChildren(el('div', 'pk-adv-head', `Coach (${LEARN.levels.find(l => l.id === level()).label}): ${a.head}`));
    const ul = el('ul');
    for (const line of a.lines) ul.append(el('li', '', line));
    const x = el('button', 'ghost small', 'Got it');
    x.onclick = () => box.classList.add('hidden');
    box.append(ul, x);
    box.classList.remove('hidden');
  }
  function showReview() {
    const list = $('pkReviewList');
    list.replaceChildren();
    for (const r of T.review) {
      const li = el('li', r.match ? 'same' : 'diff');
      li.append(el('div', 'rv-top', `${r.street}: you chose ${r.did}`), el('div', 'rv-coach', (r.match ? '✓ Coach agrees: ' : '✗ Coach: ') + r.coach));
      if (!r.match) li.append(el('div', 'rv-why', r.lines.join(' ')));
      list.append(li);
    }
    $('pkReview').classList.remove('hidden');
  }

  // Play vs computer: the whole table runs here on the phone, with the coach always on
  async function startSolo() {
    let G;
    try { G = await engine(); } catch { return KO.toast("Couldn't load the game. Check your connection and try again"); }
    const s = G.newRoom();
    s.settings.startChips = Number($('psoloChips').value);
    s.settings.blind = Number($('psoloBlind').value);
    s.settings.botLevel = $('psoloLevel').value;
    s.settings.turnTime = Number($('psoloTime').value);
    s.settings.coach = true;
    const me = G.addPlayer(s, KO.name() || 'You');
    for (let i = 0; i < Number($('psoloCount').value); i++) G.addPlayer(s, G.botName(s), { bot: true, level: s.settings.botLevel });
    G.handle(s, me.id, { t: 'start' });
    reset();
    KO.startSolo(G, s, me.id);
  }

  function init(bridge) {
    KO = bridge; el = KO.el;
    const saved = KO.store.get(KEY);
    if (saved && typeof saved === 'object') prog = { level: saved.level || 'beginner', done: saved.done || {}, drills: saved.drills || {} };
    $('scBack').onclick = closeSchool;
    $('pkFold').onclick = () => act({ t: 'fold' });
    $('pkCall').onclick = () => { const s = KO.getS(); act({ t: s?.toCall > 0 ? 'call' : 'check' }); };
    $('pkBet').onclick = () => {
      const s = KO.getS();
      if (!s || !T) return;
      if (!T.raiseOpen) { // first tap opens the amount row, second tap confirms
        T.raiseOpen = true;
        const half = s.currentBet + Math.round((s.pot + s.toCall) * 0.5);
        T.raiseTo = Math.min(s.maxRaiseTo, Math.max(s.minRaiseTo, Math.round(half / 5) * 5));
        return controls();
      }
      act({ t: 'raise', to: T.raiseTo });
    };
    $('pkRange').oninput = e => { const s = KO.getS(); T.raiseTo = Math.min(s.maxRaiseTo, Math.max(s.minRaiseTo, Number(e.target.value))); controls(); };
    $('pkRaise').addEventListener('click', e => {
      const b = e.target.closest('[data-size]'), s = KO.getS();
      if (!b || !s || !T) return;
      const k = b.dataset.size;
      if (k === 'x') { T.raiseOpen = false; return controls(); }
      const potAfterCall = s.pot + s.toCall;
      const to = k === 'min' ? s.minRaiseTo : k === 'max' ? s.maxRaiseTo : s.currentBet + Math.round(potAfterCall * Number(k));
      T.raiseTo = Math.min(s.maxRaiseTo, Math.max(s.minRaiseTo, Math.round(to / 5) * 5));
      controls();
    });
    $('pkNext').onclick = () => KO.send({ t: 'next' });
    $('pkEndGame').onclick = () => { if (confirm('End this game and show the final chip counts?')) KO.send({ t: 'end' }); };
    $('pkAgain').onclick = () => KO.send({ t: 'start' });
    $('pkEndAgain').onclick = () => KO.send({ t: 'start' });
    $('pkEndClose').onclick = () => { const s = KO.getS(); if (T && s) { T.endClosed = s.round; $('pkEndOverlay').classList.add('hidden'); controls(); } };
    $('pkCoach').onclick = showAdvice;
    $('pkReviewClose').onclick = () => $('pkReview').classList.add('hidden');
    $('pkChipsInput').onchange = e => KO.send({ t: 'settings', startChips: Number(e.target.value) });
    $('pkBlindInput').onchange = e => KO.send({ t: 'settings', blind: Number(e.target.value) });
    $('pkCoachInput').onchange = e => KO.send({ t: 'settings', coach: e.target.checked });
    $('psoloCancel').onclick = () => $('pokerSoloModal').classList.add('hidden');
    $('psoloStart').onclick = () => { $('pokerSoloModal').classList.add('hidden'); startSolo(); };
  }

  window.KOPoker = {
    init, onTab, render, tick, reset, lobby, controls,
    soloOpen: () => $('pokerSoloModal').classList.remove('hidden'),
    logText(e) { // one line for the log under the table
      switch (e.k) {
        case 'pstart': return 'New game: cards are in the air';
        case 'deal': return `Hand ${e.hand}: ${e.sb} posts ${e.sbAmt}, ${e.bb} posts ${e.bbAmt}`;
        case 'pact': return e.a === 'fold' ? `${e.p} folds` : e.a === 'check' ? `${e.p} checks` : e.a === 'call' ? `${e.p} calls ${e.amt}` : e.a === 'bet' ? `${e.p} bets ${e.to}` : `${e.p} raises to ${e.to}`;
        case 'board': return e.street === 'flop' ? 'The flop' : e.street === 'turn' ? 'The turn' : 'The river';
        case 'pwin': return `${e.p} wins ${e.amt}` + (e.hand ? ` with ${e.hand}` : '');
        case 'rebuy': return `${e.p} is out of chips and gets a fresh stack`;
        case 'seated': return `${e.p} takes a seat`;
        case 'pend': return 'Game over';
        default: return '';
      }
    },
  };
})();
