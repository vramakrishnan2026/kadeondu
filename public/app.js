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
    d.append(el('span', 'corner tl', lab), el('span', 'mid', lab), el('span', 'corner br', lab));
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
    if (ws?.readyState === 1) ws.send(JSON.stringify(obj));
    else toast('Reconnecting…');
  }
  function goHome(msg) {
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
        if (e.k === 'call') toast(logText(e), true);
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
        li.append(el('span', 'dot' + (p.online ? '' : ' away')), el('span', 'name', p.name));
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
      $('handSizeInput').value = String(s.settings.handSize);
      $('guestSettings').textContent = isHost ? '' :
        `${s.settings.handSize} cards each · stacking ${s.settings.stacking ? 'on' : 'off'}`;
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

    // players strip (everyone, in turn order)
    const opp = $('opponents');
    opp.replaceChildren();
    let turnEl = null;
    for (const p of s.players) {
      const d = el('div', 'opp' + (p.id === s.turnId ? ' turn' : '') + (p.id === s.you ? ' me' : '') + (p.online ? '' : ' away'));
      const nm = el('div', 'oname');
      nm.append(el('span', 'dot' + (p.online ? '' : ' away')), el('span', '', p.id === s.you ? `${p.name} (you)` : p.name));
      const ct = el('div', 'ocount');
      ct.append(el('span', 'mini-back'), el('span', '', `${p.count} · ${p.score} pts`));
      d.append(nm, ct);
      if (s.vulnerable === p.id && p.id !== s.you) {
        const c = el('button', 'catch', 'Catch!');
        c.onclick = () => send({ t: 'catch', target: p.id });
        d.append(c);
      }
      opp.append(d);
      if (p.id === s.turnId) turnEl = d;
    }
    turnEl?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

    // watchers
    const w = $('watchers');
    w.classList.toggle('hidden', !s.spectators.length);
    w.textContent = s.spectators.length ? `👀 Watching: ${s.spectators.map(p => p.name + (p.id === s.you ? ' (you)' : '')).join(', ')}` : '';
    $('watchNote').classList.toggle('hidden', !s.spectating);
    $('hand').classList.toggle('hidden', s.spectating);
    $('callBtn').classList.toggle('hidden', s.spectating);

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
        d.onclick = () => playCard(c);
      }
      hand.append(d);
    }
    const cw = hand.firstChild ? hand.firstChild.getBoundingClientRect().width : 80;
    hand.classList.toggle('roomy', s.hand.length * (cw + 6) < hand.clientWidth - 20);

    // round over
    if (s.phase === 'ended' && s.lastRound) {
      $('endOverlay').classList.remove('hidden');
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
      $('nextRoundBtn').disabled = s.players.length < 2;
      $('endWait').classList.toggle('hidden', isHost);
    } else {
      $('endOverlay').classList.add('hidden');
    }
    if (s.phase !== 'playing') $('colorPicker').classList.add('hidden');
  }

  function playCard(c) {
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
    if (inRoom()) return; // already playing somewhere
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

  $('shareBtn').onclick = async () => {
    const url = roomLink(room);
    if (navigator.share) {
      try { await navigator.share({ title: CFG.name, text: `Join my ${CFG.name} game, room ${room}`, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    $('copyBtn').click();
  };
  $('copyBtn').onclick = async () => {
    const url = roomLink(room);
    try { await navigator.clipboard.writeText(url); toast('Link copied'); }
    catch { prompt('Copy this link', url); }
  };
  $('stackingInput').onchange = e => send({ t: 'settings', stacking: e.target.checked });
  $('handSizeInput').onchange = e => send({ t: 'settings', handSize: Number(e.target.value) });
  $('startBtn').onclick = () => send({ t: 'start' });
  $('nextRoundBtn').onclick = () => send({ t: 'start' });
  $('drawPile').onclick = () => send({ t: 'draw' });
  $('drawBtn').onclick = () => send({ t: 'draw' });
  $('passBtn').onclick = () => send({ t: 'pass' });
  $('callBtn').onclick = () => send({ t: 'ondu' });
  $('skipTurnBtn').onclick = () => send({ t: 'skipturn' });
  $('leaveBtn').onclick = () => {
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
