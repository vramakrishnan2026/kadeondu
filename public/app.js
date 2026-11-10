(() => {
  'use strict';
  const CFG = window.GAME_CONFIG || { name: 'Card game', callWord: 'Last card!', tagline: '', theme: {} };
  const $ = id => document.getElementById(id);
  const COLOR_NAMES = { r: 'red', y: 'yellow', g: 'green', b: 'blue' };
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const SESSION_KEY = 'cardgame-session';
  const CID_KEY = 'cardgame-cid';
  const NAME_KEY = 'cardgame-name';

  // ── Apply the rename-able config ──────────────────────────
  document.title = CFG.name;
  document.querySelectorAll('[data-name]').forEach(el => (el.textContent = CFG.name));
  document.querySelectorAll('[data-tagline]').forEach(el => (el.textContent = CFG.tagline || ''));
  document.querySelectorAll('[data-call]').forEach(el => (el.textContent = CFG.callWord));
  document.querySelectorAll('[data-credits]').forEach(el => (el.textContent = CFG.credits || ''));
  const th = CFG.theme || {};
  const rootStyle = document.documentElement.style;
  for (const [k, v] of Object.entries({ red: th.red, yellow: th.yellow, green: th.green, blue: th.blue, accent: th.accent, bg: th.background })) {
    if (v) rootStyle.setProperty('--' + k, v);
  }
  if (th.background) document.querySelector('meta[name=theme-color]').content = th.background;

  // ── Small helpers ─────────────────────────────────────────
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  let toastTimer;
  function toast(text, big = false) {
    const t = $('toast');
    t.textContent = text;
    t.classList.toggle('big-toast', big);
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), big ? 1800 : 2600);
  }
  function show(screen) {
    for (const id of ['home', 'lobby', 'game']) $(id).classList.toggle('hidden', id !== screen);
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const roomLink = code => `${location.origin}${location.pathname}?room=${code}`;

  function cardLabel(v) {
    return { skip: '⊘', rev: '⇄', d2: '+2', wild: '★', wd4: '+4' }[v] ?? v;
  }
  function cardName(c) {
    const v = { skip: 'Skip', rev: 'Reverse', d2: 'Draw 2', wild: 'Wild', wd4: 'Wild +4' }[c.v] ?? c.v;
    return c.c === 'w' ? v : `${COLOR_NAMES[c.c]} ${v}`;
  }
  function makeCard(c) {
    const d = el('div', `card c-${c.c}`);
    const lab = cardLabel(c.v);
    d.append(el('span', 'burst'), el('span', 'corner tl', lab), el('span', 'mid', lab), el('span', 'corner br', lab));
    if (c.v === '6' || c.v === '9') d.classList.add('ul'); // tell 6 from 9 upside down
    d.setAttribute('aria-label', cardName(c));
    return d;
  }
  const ORDER = { r: 0, y: 1, g: 2, b: 3, w: 4 };
  const VORDER = v => (/^\d$/.test(v) ? Number(v) : { skip: 10, rev: 11, d2: 12, wild: 13, wd4: 14 }[v]);
  const sortHand = h => [...h].sort((a, b) => ORDER[a.c] - ORDER[b.c] || VORDER(a.v) - VORDER(b.v));

  function logText(e) {
    switch (e.k) {
      case 'join': return `${e.p} joined`;
      case 'watch': return `${e.p} is watching (joins next round)`;
      case 'leave': return `${e.p} left`;
      case 'kick': return `${e.p} was removed`;
      case 'start': return `Round ${e.r} started` + (e.decks > 1 ? ` (${e.decks} decks)` : '');
      case 'play': return `${e.p} played ${cardName(e.card)}` + (e.card.c === 'w' ? ` → ${COLOR_NAMES[e.col]}` : '');
      case 'draw': return e.forced ? `${e.p} picked up ${e.x}` : `${e.p} drew a card`;
      case 'pass': return `${e.p} kept their card`;
      case 'call': return `${e.p}: ${CFG.callWord}`;
      case 'catch': return `${e.p} caught ${e.q}! +2 cards`;
      case 'win': return `${e.p} wins the round (+${e.x})`;
      case 'reshuffle': return 'Discard pile shuffled back in';
      case 'newdeck': return 'A fresh deck was opened';
      case 'skipped': return `${e.p}'s turn was skipped`;
      case 'toofew': return 'Not enough players, back to the lobby';
      case 'timeout': return `Time's up for ${e.p}. Auto-move`;
      default: return '';
    }
  }

  // ── Connection ────────────────────────────────────────────
  let ws = null, room = null, session = store.get(SESSION_KEY);
  let wantOpen = false, retry = 0, pingTimer = null, createTries = 0, joinIntent = {};
  let S = null, lastSeq = 0, pendingWild = null, prevTurn = null, leaving = false;

  // Top-right dot: green = connected, amber = connecting, red = can't reach the server.
  // In a room it shows the room connection; elsewhere the home-screen connection.
  let netFails = 0;
  function setNet() {
    const sock = wantOpen ? ws : listWs;
    const st = sock?.readyState;
    const cls = st === 1 ? 'on' : st === 0 ? 'wait' : 'off';
    const d = $('netDot');
    d.className = 'net-dot ' + cls;
    d.title = cls === 'on' ? 'Connected' : cls === 'wait' ? 'Connecting…' : 'Not connected, retrying';
  }

  function connect(code, intent) {
    room = code;
    joinIntent = intent;
    wantOpen = true;
    if (ws) { try { ws.onclose = null; ws.close(); } catch {} }
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?room=${code}`;
    ws = new WebSocket(url);
    setNet();
    ws.onopen = () => {
      retry = 0;
      setNet();
      const s = session && session.room === room ? session : null;
      ws.send(JSON.stringify({
        t: 'join',
        name: $('nameInput').value.trim() || store.get(NAME_KEY) || 'Player',
        playerId: s?.playerId, token: s?.token,
        create: !s && joinIntent.create, joinOnly: !joinIntent.create,
      }));
      clearInterval(pingTimer);
      pingTimer = setInterval(() => { if (ws?.readyState === 1) ws.send('ping'); }, 25000);
    };
    ws.onmessage = ev => {
      if (ev.data === 'pong') return;
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      onMessage(m);
    };
    ws.onclose = () => {
      clearInterval(pingTimer);
      setNet();
      if (!wantOpen) return;
      const wait = Math.min(8000, 500 * 2 ** retry++);
      if (retry === 3) toast("Can't reach the game room. Retrying…");
      setTimeout(() => wantOpen && connect(room, { create: false }), wait);
    };
  }
  function send(obj) {
    if (solo) return soloSend(obj);
    if (ws?.readyState === 1) ws.send(JSON.stringify(obj));
    else toast('Reconnecting…');
  }
  function goHome(msg) {
    if (solo) { clearTimeout(solo.timer); clearTimeout(solo.tt); solo = null; }
    try { stopRec(); releaseMic(); } catch {}
    wantOpen = false;
    try { ws?.close(); } catch {}
    ws = null; S = null; room = null; lastSeq = 0;
    session = null; store.del(SESSION_KEY);
    history.replaceState(null, '', location.pathname);
    $('roomChip').classList.add('hidden');
    $('leaveBtn').classList.add('hidden');
    $('inviteTopBtn').classList.add('hidden');
    $('peopleModal').classList.add('hidden');
    $('endOverlay').classList.add('hidden');
    $('colorPicker').classList.add('hidden');
    setNet();
    myName = $('nameInput').value.trim();
    show('home');
    hello();
    if (msg) toast(msg);
  }

  function onMessage(m) {
    if (m.t === 'welcome') {
      session = { room, playerId: m.playerId, token: m.token };
      store.set(SESSION_KEY, session);
      history.replaceState(null, '', `?room=${room}`);
      $('roomChip').textContent = room;
      $('roomChip').classList.remove('hidden');
      $('leaveBtn').classList.remove('hidden');
      $('inviteTopBtn').classList.remove('hidden');
      myName = m.name;
      hello();
      for (const to of pendingInvites.splice(0)) sendInvite(to);
    } else if (m.t === 'state') {
      render(m);
    } else if (m.t === 'error') {
      if (m.code === 'taken' && createTries++ < 6) return connect(newCode(), { create: true });
      if (m.code === 'noroom') return goHome('No room with that code');
      toast(m.msg);
    } else if (m.t === 'kicked') {
      goHome(leaving ? 'You left the room' : 'You were removed');
      leaving = false;
    } else if (m.t === 'voice') {
      playVoice(m);
    } else if (m.t === 'replaced') {
      wantOpen = false;
      toast('This game is open in another tab');
    }
  }

  // ── Rendering ─────────────────────────────────────────────
  function render(s) {
    const firstState = !S;
    S = s;
    const me = s.players.find(p => p.id === s.you);
    const isHost = s.hostId === s.you;
    const name = id => s.players.find(p => p.id === id)?.name ?? '?';

    // log + toasts for new events
    const fresh = s.log.filter(e => e.n > lastSeq);
    if (!firstState) {
      for (const e of fresh) {
        if (e.k === 'play' && e.card?.v === 'wd4') setTimeout(showDrawFour, 550); // let the +4 land first
        if (e.k === 'call') toast(logText(e), true);
        else if (e.k === 'timeout' && e.p === s.players.find(p => p.id === s.you)?.name) toast("Time's up! A move was made for you");
        else if (e.k === 'catch' || e.k === 'win') toast(logText(e), e.k === 'win');
      }
    }
    if (s.log.length) lastSeq = s.log[s.log.length - 1].n;
    const lastText = [...s.log].reverse().map(logText).find(Boolean) || '';
    $('logLine').textContent = lastText;

    if (s.phase === 'lobby') {
      show('lobby');
      $('endOverlay').classList.add('hidden');
      $('lobbyCode').textContent = room;
      $('playerCount').textContent = `(${s.players.length})`;
      const ul = $('lobbyPlayers');
      ul.replaceChildren();
      for (const p of s.players) {
        const li = el('li');
        li.append(el('span', 'dot' + (p.online ? '' : ' away')), el('span', 'name', (p.bot ? '🤖 ' : '') + p.name));
        if (p.bot) li.append(el('span', 'tag you', 'COMPUTER'));
        if (p.id === s.hostId) li.append(el('span', 'tag', 'HOST'));
        if (p.id === s.you) li.append(el('span', 'tag you', 'YOU'));
        if (isHost && p.id !== s.you) {
          const k = el('button', 'kick', 'Remove');
          k.onclick = () => confirm(`Remove ${p.name}?`) && send({ t: 'kick', target: p.id });
          li.append(k);
        }
        ul.append(li);
      }
      $('hostSettings').classList.toggle('hidden', !isHost);
      $('stackingInput').checked = s.settings.stacking;
      $('botLevelInput').value = s.settings.botLevel || 'normal';
      $('turnTimeInput').value = String(s.settings.turnTime || 0);
      $('handSizeInput').value = String(s.settings.handSize);
      $('guestSettings').textContent = isHost ? '' :
        `${s.settings.handSize} cards each · stacking ${s.settings.stacking ? 'on' : 'off'}` +
        (s.players.some(p => p.bot) ? ` · computer: ${s.settings.botLevel || 'normal'}` : '') +
        ` · ${s.settings.turnTime ? s.settings.turnTime + ' s per turn' : 'no turn timer'}`;
      $('startBtn').classList.toggle('hidden', !isHost);
      $('startBtn').disabled = s.players.length < 2;
      $('startBtn').textContent = s.players.length < 2 ? 'Waiting for players…' : `Start game (${s.players.length} players)`;
      $('waitHost').classList.toggle('hidden', isHost);
      return;
    }

    show('game');
    const myTurn = s.phase === 'playing' && s.turnId === s.you;
    if (myTurn && prevTurn !== s.you && !firstState) { try { navigator.vibrate?.(120); } catch {} }
    prevTurn = s.turnId;

    // seats around the table: you at the bottom, others clockwise in turn order
    const seats = $('seats');
    seats.replaceChildren();
    const n = s.players.length;
    const meIdx = Math.max(0, s.players.findIndex(p => p.id === s.you));
    const ring = $('ring').getBoundingClientRect();
    const rx = 50 - Math.min(14, 5600 / Math.max(ring.width, 1));   // keep seats inside the edges
    const ry = 50 - Math.min(16, 4400 / Math.max(ring.height, 1));
    $('ring').classList.toggle('crowded', n > 8);
    $('ring').classList.toggle('packed', n > 14);
    s.players.forEach((p, i) => {
      const k = (i - meIdx + n) % n;
      const ang = Math.PI / 2 + (k * 2 * Math.PI) / n;   // 90° = bottom, increasing = clockwise
      const d = el('div', 'seat' + (p.id === s.turnId ? ' turn' : '') + (p.id === s.you ? ' me' : '') + (p.online ? '' : ' away'));
      d.style.left = `${50 + rx * Math.cos(ang)}%`;
      d.style.top = `${50 + ry * Math.sin(ang)}%`;
      d.dataset.name = p.name;
      const av = el('div', 'avatar', p.bot ? '🤖' : (p.name.trim()[0] || '?').toUpperCase());
      av.append(el('span', 'count', String(p.count)));
      d.append(av, el('div', 'sname', p.id === s.you ? 'You' : p.name), el('div', 'sscore', `${p.score} pts`));
      if (s.vulnerable === p.id && p.id !== s.you && !s.spectating) {
        const c = el('button', 'catch', 'Catch!');
        c.onclick = () => send({ t: 'catch', target: p.id });
        d.append(c);
      }
      seats.append(d);
    });

    // watchers
    const w = $('watchers');
    w.classList.toggle('hidden', !s.spectators.length);
    w.textContent = s.spectators.length ? `👀 Watching: ${s.spectators.map(p => p.name + (p.id === s.you ? ' (you)' : '')).join(', ')}` : '';
    $('watchNote').classList.toggle('hidden', !s.spectating);
    $('hand').classList.toggle('hidden', s.spectating);
    $('callBtn').classList.toggle('hidden', s.spectating);
    $('micBtn').classList.toggle('hidden', !!solo);
    $('muteBtn').classList.toggle('hidden', !!solo);

    // table
    const disc = $('discard');
    disc.replaceChildren();
    if (s.top) disc.append(makeCard(s.top));
    $('colorDot').style.background = s.color ? `var(--${COLOR_NAMES[s.color]})` : 'transparent';
    $('colorDot').style.color = s.color ? `var(--${COLOR_NAMES[s.color]})` : 'transparent';
    $('dirArrow').classList.toggle('ccw', s.dir === -1);
    $('deckCount').textContent = `${s.deckCount} left`;
    const canDraw = myTurn && s.drawnCardId === null;
    $('drawPile').classList.toggle('can', canDraw);
    $('drawPile').disabled = !canDraw;

    // status
    const st = $('status');
    st.classList.toggle('mine', myTurn);
    if (s.phase === 'ended') st.textContent = 'Round over';
    else if (s.spectating) st.textContent = `Watching · ${name(s.turnId)}'s turn`;
    else if (myTurn) {
      st.textContent = s.pendingDraw > 0 ? `Stack a card or pick up ${s.pendingDraw}`
        : s.drawnCardId !== null ? 'Play the card you drew, or keep it'
        : s.playable.length ? 'Your turn' : 'Your turn: no match, draw a card';
    } else {
      st.textContent = `${name(s.turnId)}'s turn` + (s.pendingDraw > 0 ? ` (+${s.pendingDraw} waiting)` : '');
    }

    st.dataset.base = st.textContent;
    deadlineAt = s.phase === 'playing' && s.deadlineIn != null ? Date.now() + s.deadlineIn : null;
    turnLength = (s.settings.turnTime || 0) * 1000;
    buzzed = false;
    tickClock();

    // actions
    $('drawBtn').classList.toggle('hidden', !canDraw);
    $('drawBtn').textContent = s.pendingDraw > 0 ? `Pick up ${s.pendingDraw}` : 'Draw';
    $('passBtn').classList.toggle('hidden', !(myTurn && s.drawnCardId !== null));
    $('callBtn').disabled = !s.canCall;
    const turnPlayer = s.players.find(p => p.id === s.turnId);
    $('skipTurnBtn').classList.toggle('hidden', !(isHost && s.phase === 'playing' && turnPlayer && !turnPlayer.online && turnPlayer.id !== s.you));

    // hand
    const hand = $('hand');
    hand.replaceChildren();
    const playable = new Set(s.playable);
    for (const c of sortHand(s.hand)) {
      const d = makeCard(c);
      if (myTurn) d.classList.add(playable.has(c.id) ? 'playable' : 'dim');
      if (playable.has(c.id)) {
        d.setAttribute('role', 'button');
        d.onclick = () => playCard(c, d);
      }
      hand.append(d);
    }
    const cw = hand.firstChild ? hand.firstChild.getBoundingClientRect().width : 80;
    hand.classList.toggle('roomy', s.hand.length * (cw + 6) < hand.clientWidth - 20);

    if (!firstState) animateEvents(fresh, s);

    // round over
    const roundOver = s.phase === 'ended' && !!s.lastRound;
    if (!roundOver) endClosedRound = null;
    const endClosed = roundOver && endClosedRound === s.round;
    $('scoresBtn').classList.toggle('hidden', !endClosed);
    $('nextRoundBarBtn').classList.toggle('hidden', !(endClosed && isHost));
    $('nextRoundBarBtn').disabled = s.players.length < 2;
    if (roundOver) {
      $('endOverlay').classList.toggle('hidden', endClosed);
      const w = s.lastRound.winnerId;
      $('endTitle').textContent = w === s.you ? 'You win! 🎉' : `${name(w)} wins!`;
      $('endPoints').textContent = `+${s.lastRound.points} points from everyone's leftover cards`;
      const ol = $('scoreList');
      ol.replaceChildren();
      for (const p of [...s.players].sort((a, b) => b.score - a.score)) {
        const li = el('li', '', p.name + (p.id === s.you ? ' (you)' : ''));
        li.append(el('span', '', String(p.score)));
        ol.append(li);
      }
      $('nextRoundBtn').classList.toggle('hidden', !isHost);
      $('addBotEndBtn').classList.toggle('hidden', !isHost);
      $('nextRoundBtn').disabled = s.players.length < 2;
      $('endWait').classList.toggle('hidden', isHost);
    } else {
      $('endOverlay').classList.add('hidden');
    }
    if (s.phase !== 'playing') $('colorPicker').classList.add('hidden');
  }

  // ── Wild +4 effect: Mani grows over the deck with an evil laugh ──
  const FX = CFG.drawFourEffect || {};
  if (FX.enabled && FX.image) { const pre = new Image(); pre.src = FX.image; }
  let fxNode = null;
  function evilLaugh() {
    if (!FX.sound) return;
    try {
      if (typeof FX.sound === 'string') { const a = new Audio(FX.sound); a.volume = 0.9; a.play().catch(() => {}); return; }
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance('Mwa ha ha ha haaa!');
      u.pitch = 0.1; u.rate = 0.85; u.volume = 1;
      speechSynthesis.speak(u);
    } catch {}
  }
  function showDrawFour() {
    if (!FX.enabled || !FX.image) return;
    const dur = FX.durationMs || 3000;
    fxNode?.remove();
    const pile = $('discard').getBoundingClientRect();
    const cx = pile.width ? pile.left + pile.width / 2 : innerWidth / 2;
    const cy = pile.height ? pile.top + pile.height / 2 : innerHeight / 2;
    const wrap = el('div', 'fx-laugh');
    const flash = el('div', 'fx-flash');
    const who = el('div', 'fx-who');
    who.style.left = `${cx}px`;
    who.style.top = `${cy}px`;
    const bob = el('div', 'fx-bob');
    const img = el('img');
    img.src = FX.image;
    img.alt = '';
    bob.append(img);
    if (FX.text) bob.append(el('div', 'fx-text', FX.text));
    who.append(bob);
    wrap.append(flash, who);
    document.body.append(wrap);
    fxNode = wrap;
    // grow from the deck, hold big while laughing, fade away
    who.animate([
      { transform: 'translate(-50%,-50%) scale(.12) rotate(-8deg)', opacity: 0, filter: 'brightness(2)' },
      { transform: 'translate(-50%,-50%) scale(.75) rotate(3deg)', opacity: 1, filter: 'brightness(1.3)', offset: .14 },
      { transform: 'translate(-50%,-50%) scale(1.15) rotate(-1deg)', opacity: 1, filter: 'brightness(1)', offset: .8 },
      { transform: 'translate(-50%,-50%) scale(1.45) rotate(0deg)', opacity: 0, filter: 'brightness(1.6)' },
    ], { duration: dur, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    // laughing: quick head-bob and shake
    if (!reduceMotion) bob.animate([
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: 'translateY(-10px) rotate(-3deg)' },
      { transform: 'translateY(4px) rotate(2.5deg)' },
      { transform: 'translateY(-6px) rotate(-1.5deg)' },
      { transform: 'translateY(0) rotate(0deg)' },
    ], { duration: 260, iterations: Math.ceil(dur / 260) - 1, delay: dur * 0.1 });
    flash.animate([{ opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: .6, offset: .7 }, { opacity: 0 }],
      { duration: dur, fill: 'forwards' });
    try { navigator.vibrate?.([120, 80, 120, 80, 200]); } catch {}
    evilLaugh();
    setTimeout(() => { if (fxNode === wrap) { wrap.remove(); fxNode = null; } }, dur + 50);
  }

  // ── Turn clock ─────────────────────────────────────────
  let deadlineAt = null, turnLength = 0, buzzed = false;
  function tickClock() {
    const st = $('status');
    st.querySelector('.secs')?.remove();
    document.querySelectorAll('#seats .clock').forEach(x => x.remove());
    if (!deadlineAt || !S || S.phase !== 'playing') return;
    const left = Math.max(0, deadlineAt - Date.now());
    const secs = Math.ceil(left / 1000);
    const hurry = secs <= 5;
    const turnName = S.players.find(p => p.id === S.turnId)?.name;
    const seat = [...document.querySelectorAll('#seats .seat')].find(x => x.dataset.name === turnName);
    if (seat) {
      const ring = el('span', 'clock' + (hurry ? ' hurry' : ''));
      ring.style.setProperty('--left', turnLength ? (left / turnLength).toFixed(3) : 1);
      seat.querySelector('.avatar').append(ring);
    }
    st.append(el('span', 'secs' + (hurry ? ' hurry' : ''), `${secs}s`));
    if (hurry && !buzzed && S.turnId === S.you) { buzzed = true; try { navigator.vibrate?.([60, 60, 60]); } catch {} }
  }
  setInterval(tickClock, 250);

  // ── Card flight animations (built-in Web Animations, no library) ──
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function centerOf(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function seatRect(name) {
    const seat = [...document.querySelectorAll('#seats .seat')].find(x => x.dataset.name === name);
    return seat ? seat.querySelector('.avatar').getBoundingClientRect() : null;
  }
  function fly(node, fromRect, toRect, { delay = 0, duration = 480, fromScale = 0.55, toScale = 1, spin = 0 } = {}) {
    if (!fromRect || !toRect) return Promise.resolve();
    const a = centerOf(fromRect), b = centerOf(toRect);
    node.classList.add('flying');
    node.style.left = `${b.x}px`;
    node.style.top = `${b.y}px`;
    document.body.append(node);
    const lift = Math.min(90, Math.hypot(b.x - a.x, b.y - a.y) * 0.25);
    const anim = node.animate([
      { transform: `translate(-50%,-50%) translate(${a.x - b.x}px, ${a.y - b.y}px) scale(${fromScale}) rotate(${spin}deg)`, opacity: 0.9 },
      { transform: `translate(-50%,-50%) translate(${(a.x - b.x) / 2}px, ${(a.y - b.y) / 2 - lift}px) scale(${(fromScale + toScale) / 2 + 0.1}) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(-50%,-50%) scale(${toScale}) rotate(0deg)`, opacity: 1 },
    ], { duration, delay, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'backwards' });
    return anim.finished.then(() => node.remove(), () => node.remove());
  }
  function animateEvents(events, s) {
    if (reduceMotion || !events.length) return;
    const myName = s.players.find(p => p.id === s.you)?.name;
    let drawDelay = 0;
    for (const e of events.slice(-6)) {
      if (e.k === 'play') {
        const target = $('discard').querySelector('.card');
        if (!target) continue;
        const toRect = target.getBoundingClientRect();
        const mine = e.p === myName && lastPlayFrom && Date.now() - lastPlayFrom.at < 4000;
        const fromRect = mine ? lastPlayFrom.rect : seatRect(e.p);
        if (mine) lastPlayFrom = null;
        target.style.visibility = 'hidden';
        const card = makeCard({ c: e.card.c, v: e.card.v });
        card.style.width = `${toRect.width}px`;
        fly(card, fromRect, toRect, { fromScale: mine ? 1 : 0.45, spin: (Math.random() * 50 - 25) }).then(() => {
          target.style.visibility = '';
          target.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 160 });
        });
      } else if (e.k === 'draw') {
        const to = e.p === myName ? $('hand').getBoundingClientRect() : seatRect(e.p);
        const from = $('drawPile').getBoundingClientRect();
        if (!to) continue;
        const toRect = e.p === myName
          ? { left: to.left + to.width / 2 - 30, top: to.top + 10, width: 60, height: 80 }
          : to;
        for (let i = 0; i < Math.min(e.x || 1, 6); i++) {
          const back = el('div', 'card back');
          back.append(el('span', '', CFG.name));
          back.style.width = `${from.width}px`;
          fly(back, from, toRect, { delay: drawDelay + i * 110, duration: 420, fromScale: 1, toScale: 0.4, spin: 10 });
        }
        drawDelay += 120;
      }
    }
  }

  let lastPlayFrom = null; // where my card was when I tapped it
  // ── Voice notes: hold the mic, release to send (max 5 s). Never stored. ──
  const VOICE_MAX_MS = 5000;
  let voiceMuted = !!store.get('cardgame-voice-muted');
  let rec = null, recStream = null, recChunks = [], recStartAt = 0, recTimer = null, recWanted = false;
  function setMuteIcon() {
    $('muteBtn').classList.toggle('muted', voiceMuted);
    $('muteBtn').setAttribute('aria-label', voiceMuted ? 'Unmute voice notes' : 'Mute voice notes');
  }
  setMuteIcon();
  $('muteBtn').onclick = () => {
    voiceMuted = !voiceMuted;
    store.set('cardgame-voice-muted', voiceMuted);
    setMuteIcon();
    toast(voiceMuted ? 'Voice notes muted' : 'Voice notes on');
  };
  function pickMime() {
    // MP4/AAC first: iPhones play it, and so does everything else
    for (const t of ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm']) {
      if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
    }
    return '';
  }
  // Keep the microphone open once allowed, so Safari doesn't ask (and cancel) on every hold.
  async function getMic() {
    if (recStream && recStream.getAudioTracks().some(t => t.readyState === 'live')) return recStream;
    recStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    return recStream;
  }
  function releaseMic() {
    recStream?.getTracks().forEach(t => t.stop());
    recStream = null;
  }
  async function startRec() {
    if (solo || rec) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('Voice notes are not supported on this browser');
    recWanted = true;
    const hadMic = !!recStream;
    let stream;
    try { stream = await getMic(); }
    catch { recWanted = false; return toast('Allow the microphone to send voice notes'); }
    if (!recWanted) { if (!hadMic) toast('Mic ready. Now hold the button to talk'); return; } // let go while the permission pop-up was open
    const mime = pickMime();
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
    } catch {
      try { rec = new MediaRecorder(stream); } catch { recWanted = false; return toast("This phone can't record voice notes"); }
    }
    recChunks = [];
    rec.ondataavailable = e => e.data.size && recChunks.push(e.data);
    rec.onstop = finishRec;
    rec.onerror = () => toast('Recording failed, try again');
    rec.start();
    recStartAt = Date.now();
    $('micBtn').classList.add('rec');
    $('micBtn').style.setProperty('--rec', `${VOICE_MAX_MS}ms`);
    recTimer = setTimeout(stopRec, VOICE_MAX_MS);
  }
  function stopRec() {
    recWanted = false;
    clearTimeout(recTimer);
    if (rec && rec.state !== 'inactive') rec.stop();
  }
  function finishRec() {
    const r = rec, took = Date.now() - recStartAt;
    rec = null;
    $('micBtn').classList.remove('rec');
    if (took < 400) return toast('Hold the mic to talk');
    const type = (r?.mimeType || recChunks[0]?.type || 'audio/mp4').split(';')[0] || 'audio/mp4';
    const blob = new Blob(recChunks, { type });
    if (!blob.size) return toast('Nothing was recorded, try again');
    if (blob.size > 200000) return toast('Voice note too long');
    const fr = new FileReader();
    fr.onload = () => { send({ t: 'voice', data: fr.result }); toast('Voice note sent'); };
    fr.readAsDataURL(blob);
  }
  const mic = $('micBtn');
  if ('ontouchstart' in window) {
    // touch phones: handle the touch ourselves so iOS doesn't turn the hold into text selection
    mic.addEventListener('touchstart', e => { e.preventDefault(); unlockAudio(); startRec(); }, { passive: false });
    mic.addEventListener('touchend', e => { e.preventDefault(); stopRec(); }, { passive: false });
    mic.addEventListener('touchcancel', stopRec);
  } else {
    mic.addEventListener('pointerdown', e => { e.preventDefault(); mic.setPointerCapture?.(e.pointerId); startRec(); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) mic.addEventListener(ev, stopRec);
  }
  mic.addEventListener('contextmenu', e => e.preventDefault());
  // close the mic when the page is hidden (phone locked / app switched)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { stopRec(); releaseMic(); } });

  // iPhones only play sound that a tap started. On the first tap anywhere we "unlock"
  // one audio player and reuse it for every voice note after that.
  let voiceEl = null, audioCtx = null, voiceQueue = [], voicePlaying = false, unlockHinted = false;
  function silentWav() {
    const n = 800, sr = 8000, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function unlockAudio() {
    if (voiceEl) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    voiceEl = new Audio();
    voiceEl.setAttribute('playsinline', '');
    voiceEl.src = silentWav();
    voiceEl.play().then(() => voiceEl.pause()).catch(() => {});
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { audioCtx = new AC(); audioCtx.resume?.(); }
    } catch {}
    for (const ev of ['pointerdown', 'touchend', 'keydown']) document.removeEventListener(ev, unlockAudio, true);
    if (voiceQueue.length) nextVoice();
  }
  for (const ev of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(ev, unlockAudio, true);

  function playVoice(m) {
    if (voiceMuted || solo) return;
    voiceQueue.push(m);
    if (voiceQueue.length > 3) voiceQueue.shift(); // don't pile up a backlog
    if (!voiceEl) {
      if (!unlockHinted) { unlockHinted = true; toast('Tap anywhere to hear voice notes'); }
      return;
    }
    if (!voicePlaying) nextVoice();
  }
  function nextVoice() {
    const m = voiceQueue.shift();
    if (!m) { voicePlaying = false; return; }
    voicePlaying = true;
    const seat = [...document.querySelectorAll('#seats .seat')].find(x => x.dataset.name === m.name);
    const bubble = el('div', 'voice-bubble', '🔊');
    seat?.append(bubble);
    let finished = false;
    const done = () => { if (finished) return; finished = true; bubble.remove(); setTimeout(nextVoice, 150); };
    const safety = setTimeout(done, VOICE_MAX_MS + 2500);
    const end = () => { clearTimeout(safety); done(); };
    const viaWebAudio = async () => {
      // second route: decode the clip ourselves (handles formats the player refuses)
      if (!audioCtx) throw new Error('no audio');
      const bytes = await (await fetch(m.data)).arrayBuffer();
      const buf = await new Promise((ok, bad) => audioCtx.decodeAudioData(bytes, ok, bad));
      const src = audioCtx.createBufferSource();
      src.buffer = buf; src.connect(audioCtx.destination); src.onended = end; src.start();
    };
    voiceEl.onended = end;
    voiceEl.onerror = () => viaWebAudio().catch(() => { toast(`Couldn't play ${m.name}'s voice note on this phone`); end(); });
    voiceEl.src = m.data;
    voiceEl.play().catch(() => viaWebAudio().catch(() => { toast(`Couldn't play ${m.name}'s voice note on this phone`); end(); }));
  }

  let endClosedRound = null; // round whose result pop-up this player closed
  function playCard(c, node) {
    if (node) lastPlayFrom = { rect: node.getBoundingClientRect(), at: Date.now() };
    if (c.c === 'w') {
      pendingWild = c.id;
      $('colorPicker').classList.remove('hidden');
    } else {
      send({ t: 'play', cardId: c.id });
    }
  }

  // ── Always-on link to the lobby: open rooms, who's online, invites ──
  let cid = store.get(CID_KEY);
  if (!/^[a-z0-9]{16}$/.test(cid || '')) {
    cid = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => 'abcdefghijkmnopqrstuvwxyz23456789'[b % 33]).join('');
    store.set(CID_KEY, cid);
  }
  let listWs = null, listRetry = 0, listPing = null, myName = '';
  let people = [], pendingInvites = [], invitedAt = {}, currentInvite = null;
  const inRoom = () => !!(wantOpen && room && session && session.room === room);

  function hello() {
    if (listWs?.readyState !== 1) return;
    listWs.send(JSON.stringify({ t: 'hello', cid, name: myName, room: inRoom() ? room : null }));
  }
  function openLobby() {
    if (listWs && listWs.readyState <= 1) return;
    listWs = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/lobby`);
    listWs.onopen = () => {
      listRetry = 0;
      setNet();
      netFails = 0;
      hello();
      clearInterval(listPing);
      listPing = setInterval(() => listWs?.readyState === 1 && listWs.send('ping'), 25000);
    };
    listWs.onmessage = ev => {
      if (ev.data === 'pong') return;
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'rooms') renderRooms(m.rooms);
      else if (m.t === 'people') { people = m.people; renderPeople(); }
      else if (m.t === 'invited') showInvite(m);
      else if (m.t === 'invite-sent') toast(`Invite sent to ${m.to}`);
      else if (m.t === 'declined') toast(`${m.from} can't play right now`);
      else if (m.t === 'error') toast(m.msg);
    };
    listWs.onclose = () => {
      clearInterval(listPing);
      setNet();
      if (++netFails === 3 && !wantOpen) toast("Can't reach the game server. Retrying…");
      setTimeout(openLobby, Math.min(10000, 1000 * 2 ** listRetry++));
    };
  }

  function renderRooms(rooms) {
    const ul = $('roomList');
    ul.replaceChildren();
    $('noRooms').classList.toggle('hidden', rooms.length > 0);
    for (const r of rooms) {
      const li = el('li');
      const info = el('div', 'rinfo');
      info.append(
        el('div', 'rname', r.host ? `${r.host}'s room` : `Room ${r.code}`),
        el('div', 'rmeta', `${r.code} · ${r.players} playing` + (r.watching ? ` · ${r.watching} watching` : '')),
      );
      const live = r.phase === 'playing';
      const badge = el('span', 'badge' + (live ? ' live' : ''), live ? 'In game' : r.phase === 'ended' ? 'Between rounds' : 'Waiting');
      const btn = el('button', live ? 'ghost small' : 'primary small', live ? 'Watch' : 'Join');
      btn.onclick = () => {
        if (needName()) return;
        connect(r.code, { create: false });
      };
      li.append(info, badge, btn);
      ul.append(li);
    }
  }

  function personRow(p, fromHome) {
    const li = el('li');
    const info = el('div', 'rinfo');
    const free = !p.room;
    const here = !free && inRoom() && p.room === room;
    info.append(
      el('div', 'rname', p.name),
      el('div', 'status-txt' + (free ? ' free' : ''), free ? '● Online' : here ? 'In this room' : `In ${p.roomHost ? p.roomHost + "'s" : 'a'} room`),
    );
    li.append(info);
    if (free) {
      const recently = Date.now() - (invitedAt[p.id] || 0) < 10000;
      const btn = el('button', 'primary small', recently ? 'Invited ✓' : 'Invite');
      btn.disabled = recently;
      btn.onclick = () => {
        if (fromHome && !inRoom()) {
          // Not in a room yet: make one, then invite once we're in
          if (needName()) return;
          pendingInvites = [p.id];
          createTries = 0;
          session = null;
          connect(newCode(), { create: true });
        } else {
          sendInvite(p.id);
        }
        invitedAt[p.id] = Date.now();
        renderPeople();
        setTimeout(renderPeople, 10100);
      };
      li.append(btn);
    }
    return li;
  }

  function renderPeople() {
    const others = people.filter(p => p.id !== cid);
    $('peopleCount').textContent = others.length ? `(${others.length})` : '';
    const home = $('peopleHome');
    home.replaceChildren(...others.map(p => personRow(p, true)));
    $('noPeople').classList.toggle('hidden', others.length > 0);
    const list = $('peopleList');
    list.replaceChildren(...others.map(p => personRow(p, false)));
    $('noPeopleModal').classList.toggle('hidden', others.length > 0);
  }

  function sendInvite(to) {
    if (listWs?.readyState === 1) listWs.send(JSON.stringify({ t: 'invite', to }));
    else toast('Reconnecting…');
  }

  function showInvite(m) {
    if (inRoom() || solo) return; // already playing somewhere
    currentInvite = m;
    $('inviteTitle').textContent = `${m.from} invited you to play ${CFG.name}`;
    $('inviteSub').textContent = m.phase === 'playing'
      ? `${m.roomHost}'s room (${m.room}) is mid-round. You'll watch, then get dealt in next round.`
      : `${m.roomHost}'s room · ${m.room}`;
    $('inviteModal').classList.remove('hidden');
    try { navigator.vibrate?.([80, 60, 80]); } catch {}
  }
  $('acceptInvite').onclick = () => {
    $('inviteModal').classList.add('hidden');
    if (!currentInvite) return;
    if (!$('nameInput').value.trim()) $('nameInput').value = myName || 'Player';
    store.set(NAME_KEY, $('nameInput').value.trim());
    connect(currentInvite.room, { create: false });
    currentInvite = null;
  };
  $('declineInvite').onclick = () => {
    $('inviteModal').classList.add('hidden');
    if (currentInvite && listWs?.readyState === 1) listWs.send(JSON.stringify({ t: 'decline', to: currentInvite.fromId }));
    currentInvite = null;
  };
  const openPeople = () => { renderPeople(); $('peopleModal').classList.remove('hidden'); };
  $('inviteTopBtn').onclick = openPeople;
  $('inviteLobbyBtn').onclick = openPeople;
  $('closePeople').onclick = () => $('peopleModal').classList.add('hidden');

  // ── Wire up controls ─────────────────────────────────────
  $('nameInput').value = store.get(NAME_KEY) || '';
  $('nameInput').addEventListener('change', () => store.set(NAME_KEY, $('nameInput').value.trim()));
  let nameTimer;
  $('nameInput').addEventListener('input', () => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => { if (!inRoom()) { myName = $('nameInput').value.trim(); hello(); } }, 400);
  });
  function needName() {
    const n = $('nameInput').value.trim();
    if (!n) { $('nameInput').focus(); toast('Enter your name first'); return true; }
    store.set(NAME_KEY, n);
    return false;
  }
  $('createBtn').onclick = () => {
    if (needName()) return;
    createTries = 0;
    session = null;
    connect(newCode(), { create: true });
  };
  function joinFromInput() {
    if (needName()) return;
    const code = $('codeInput').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) return toast('Room codes are 4 letters/numbers');
    connect(code, { create: false });
  }
  $('joinBtn').onclick = joinFromInput;
  $('codeInput').addEventListener('keydown', e => e.key === 'Enter' && joinFromInput());
  $('nameInput').addEventListener('keydown', e => e.key === 'Enter' && ($('codeInput').value ? joinFromInput() : $('createBtn').click()));

  // ── Share / copy the link ──────────────────────────────
  function shareInfo() {
    if (room && (inRoom() || wantOpen)) {
      return { url: roomLink(room), title: `Join my ${CFG.name} game`, text: `Join my ${CFG.name} game! Room ${room}` };
    }
    return { url: `${location.origin}/`, title: CFG.name, text: `Come play ${CFG.name} with me!` };
  }
  async function copyLink() {
    const { url } = shareInfo();
    try { await navigator.clipboard.writeText(url); toast('Link copied'); return; } catch {}
    try { // older browsers
      const t = document.createElement('textarea');
      t.value = url; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
      toast('Link copied');
    } catch { prompt('Copy this link', url); }
  }
  async function nativeShare() {
    const info = shareInfo();
    if (!navigator.share) return false;
    try { await navigator.share(info); } catch (e) { if (e.name !== 'AbortError') return false; }
    return true;
  }
  function openShare() {
    const info = shareInfo();
    $('shareTitle').textContent = info.title;
    $('shareUrl').textContent = info.url;
    $('shareNative').classList.toggle('hidden', !navigator.share);
    $('shareWa').href = `https://wa.me/?text=${encodeURIComponent(`${info.text} ${info.url}`)}`;
    $('shareModal').classList.remove('hidden');
  }
  $('shareTopBtn').onclick = openShare;
  $('shareNative').onclick = async () => { if (await nativeShare()) $('shareModal').classList.add('hidden'); };
  $('shareCopy').onclick = async () => { await copyLink(); $('shareModal').classList.add('hidden'); };
  $('shareWa').onclick = () => $('shareModal').classList.add('hidden');
  $('closeShare').onclick = () => $('shareModal').classList.add('hidden');
  $('shareBtn').onclick = async () => { if (!(await nativeShare())) openShare(); };
  $('copyBtn').onclick = copyLink;
  $('stackingInput').onchange = e => send({ t: 'settings', stacking: e.target.checked });
  $('handSizeInput').onchange = e => send({ t: 'settings', handSize: Number(e.target.value) });
  $('startBtn').onclick = () => send({ t: 'start' });
  $('botLevelInput').onchange = e => send({ t: 'settings', botLevel: e.target.value });
  $('turnTimeInput').onchange = e => send({ t: 'settings', turnTime: Number(e.target.value) });
  $('addBotBtn').onclick = () => send({ t: 'addbot' });
  $('addBotEndBtn').onclick = () => send({ t: 'addbot' });
  $('nextRoundBtn').onclick = () => send({ t: 'start' });
  $('nextRoundBarBtn').onclick = () => send({ t: 'start' });
  $('closeEnd').onclick = () => { endClosedRound = S?.round ?? null; $('endOverlay').classList.add('hidden'); if (S) render(S); };
  $('scoresBtn').onclick = () => { endClosedRound = null; if (S) render(S); };
  $('drawPile').onclick = () => send({ t: 'draw' });
  $('drawBtn').onclick = () => send({ t: 'draw' });
  $('passBtn').onclick = () => send({ t: 'pass' });
  $('callBtn').onclick = () => send({ t: 'ondu' });
  $('skipTurnBtn').onclick = () => send({ t: 'skipturn' });
  $('leaveBtn').onclick = () => {
    if (solo) { if (confirm('Quit this game?')) goHome(); return; }
    if (!confirm('Leave this room? Your cards go back in the deck.')) return;
    leaving = true;
    if (ws?.readyState === 1) send({ t: 'leave' }); else goHome();
  };
  document.querySelectorAll('#colorPicker [data-color]').forEach(b => {
    b.onclick = () => {
      $('colorPicker').classList.add('hidden');
      if (pendingWild !== null) send({ t: 'play', cardId: pendingWild, color: b.dataset.color });
      pendingWild = null;
    };
  });
  $('cancelPick').onclick = () => { pendingWild = null; $('colorPicker').classList.add('hidden'); };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wantOpen && ws?.readyState !== 1) connect(room, { create: false });
  });

  myName = $('nameInput').value.trim();
  openLobby();

  // ── Play vs computer: the whole game runs here on the phone ──
  let solo = null; // { G, s, me, timer }
  function soloRender() {
    render(solo.G.viewFor(solo.s, solo.me, new Set([solo.me])));
    // my turn clock
    clearTimeout(solo.tt);
    const d = solo.s.deadline;
    if (d) solo.tt = setTimeout(() => {
      if (solo && solo.G.timeoutMove(solo.s)) { soloRender(); soloKick(); }
    }, Math.max(0, d - Date.now()) + 30);
  }
  function soloKick() {
    if (!solo || solo.timer) return;
    const a = solo.G.nextBotAction(solo.s);
    if (!a) return;
    solo.timer = setTimeout(() => {
      if (!solo) return;
      solo.timer = null;
      const b = solo.G.nextBotAction(solo.s);
      if (b) { solo.G.handle(solo.s, b.pid, b.msg); soloRender(); }
      soloKick();
    }, a.delay);
  }
  function soloSend(obj) {
    if (obj.t === 'leave') return goHome();
    const res = solo.G.handle(solo.s, solo.me, obj);
    if (res.error) toast(res.error);
    soloRender();
    soloKick();
  }
  async function startSolo() {
    let G;
    try { G = await import('./shared/game.js'); }
    catch { return toast("Couldn't load the game. Check your connection and try again"); }
    const s = G.newRoom();
    s.settings.stacking = $('soloStacking').checked;
    s.settings.handSize = Number($('soloHand').value);
    s.settings.botLevel = $('soloLevel').value;
    s.settings.turnTime = Number($('soloTime').value);
    const me = G.addPlayer(s, $('nameInput').value.trim() || 'You');
    for (let i = 0; i < Number($('soloCount').value); i++) G.addPlayer(s, G.botName(s), { bot: true, level: s.settings.botLevel });
    G.handle(s, me.id, { t: 'start' });
    solo = { G, s, me: me.id, timer: null };
    S = null; lastSeq = 0; prevTurn = null;
    $('roomChip').textContent = 'VS COMPUTER';
    $('roomChip').classList.remove('hidden');
    $('leaveBtn').classList.remove('hidden');
    $('inviteTopBtn').classList.add('hidden');
    soloRender();
    soloKick();
  }
  $('soloBtn').onclick = () => {
    if (needName()) return;
    $('soloModal').classList.remove('hidden');
  };
  $('soloCancel').onclick = () => $('soloModal').classList.add('hidden');
  $('soloStart').onclick = () => { $('soloModal').classList.add('hidden'); startSolo(); };

  // ── Install as an app ────────────────────────────────────
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installEvt = e;
    if (!standalone) $('installBtn').classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => { $('installBtn').classList.add('hidden'); toast('Installed! Open it from your home screen'); });
  if (isiOS && !standalone) $('installBtn').classList.remove('hidden');
  $('installBtn').onclick = async () => {
    if (installEvt) {
      installEvt.prompt();
      const r = await installEvt.userChoice.catch(() => null);
      if (r?.outcome === 'accepted') $('installBtn').classList.add('hidden');
      installEvt = null;
    } else if (isiOS) {
      $('iosInstall').classList.remove('hidden');
    } else {
      toast("Use your browser menu (⋮) and choose 'Install app' or 'Add to Home screen'");
    }
  };
  $('closeIos').onclick = () => $('iosInstall').classList.add('hidden');

  // ── Start: rejoin a saved game or prefill a shared link ──
  const urlRoom = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  if (urlRoom) $('codeInput').value = urlRoom;
  if (session && (!urlRoom || urlRoom === session.room)) {
    connect(session.room, { create: false });
  } else {
    if (session) { session = null; store.del(SESSION_KEY); }
    show('home');
    if (urlRoom && !$('nameInput').value) $('nameInput').focus();
  }
})();
