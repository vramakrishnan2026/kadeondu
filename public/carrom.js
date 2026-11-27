// Carrom: the board on screen. Rules and physics are in shared/carrom.js (the room server uses the same file).
// app.js calls window.KOCarrom.init(bridge) once at start-up, then render / lobby / tick / reset like the other games.
//
// How a shot is shown: the server sends the shot (where the striker was, how hard, the board before it) together
// with the board after it. The phone replays the shot with the same physics, then shows the server's board.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let KO = null, el = null, G = null;
  async function engine() { if (!G) G = await import('./shared/carrom.js'); return G; }

  const calm = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; // replay shots three times faster
  let T = null; // what the screen remembers between updates
  const fresh0 = () => ({ queue: [], running: false, sim: null, simT: 0, fade: [], view: null, pos: 0.5, aim: null, waiting: false, deadlineAt: null, turnLength: 0, lastSeq: 0, endClosed: -1, raf: 0, side: 0, hinted: false });
  function reset() {
    if (T?.raf) cancelAnimationFrame(T.raf);
    T = null;
    for (const id of ['crEnd']) $(id)?.classList.add('hidden');
  }

  // ── Sound: the knock of coins, the striker, the cushions and the drop into a pocket ──
  // Made in the browser with the Web Audio API (no sound files). Each knock is a few very short bursts of
  // shaped noise (a crack, then a dull wooden body), louder for harder hits, with only a hint of room echo. Switched on and off by the button beside
  // the striker slider; the choice is remembered on the phone. Off until someone turns it on.
  const SOUND_KEY = 'ko-carrom-sound';
  const snd = { on: false, ctx: null, out: null, wet: null, last: 0, count: 0 };
  function sndStart() { // needs a tap first: browsers only start sound after the user touches the page
    if (!snd.on) return null;
    try {
      if (!snd.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        const c = snd.ctx = new AC();
        const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.12;
        const master = c.createGain(); master.gain.value = 0.9;
        master.connect(comp); comp.connect(c.destination);
        // a small room: a quarter of a second of fading noise as the echo
        const len = Math.floor(c.sampleRate * 0.16), buf = c.createBuffer(2, len, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
        const room = c.createConvolver(); room.buffer = buf;
        const wet = c.createGain(); wet.gain.value = 0.07; // only a hint of room: more makes wood sound hollow
        wet.connect(room); room.connect(master);
        snd.out = master; snd.wet = wet;
        const nlen = Math.floor(c.sampleRate * 0.2); snd.noise = c.createBuffer(1, nlen, c.sampleRate);
        const nd = snd.noise.getChannelData(0); for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
      }
      if (snd.ctx.state === 'suspended') snd.ctx.resume().catch(() => {});
      return snd.ctx;
    } catch { return null; }
  }
  function tone(c, t, freq, to, dur, gain, type = 'sine') {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(snd.out); g.connect(snd.wet);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function hiss(c, t, dur, gain, filter, freq, q = 0.8) {
    const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = snd.noise; f.type = filter; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(Math.max(0.0002, gain), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(snd.out); g.connect(snd.wet);
    n.start(t, Math.random() * 0.1, dur + 0.02);
  }
  // kind: 'hit' (coin on coin), 'strike' (striker on coin), 'wall' (cushion), 'drop' (into a pocket). v = how hard.
  function play(kind, v = 120) {
    const c = snd.on && snd.ctx && snd.ctx.state === 'running' ? snd.ctx : null;
    if (!c) return;
    const now = c.currentTime;
    if (kind !== 'drop' && (v < 5 || now - snd.last < 0.014)) return; // too soft to hear, or a pile-up of knocks in one instant
    snd.last = now; snd.count++;
    const loud = Math.min(1, Math.pow(v / 170, 0.75));
    const wob = 1 + (Math.random() - 0.5) * 0.07; // no two knocks quite alike
    // Solid wood on wood has almost no pitch: a very short crack, then a dull body that dies at once. So these are
    // made from shaped noise, not ringing tones. (The first version used tones and sounded like hollow bamboo.)
    if (kind === 'hit') {            // coin on coin: a dry, bright clack
      hiss(c, now, 0.006, 1.0 * loud, 'bandpass', 4300 * wob, 0.6);
      hiss(c, now, 0.020, 0.80 * loud, 'bandpass', 1650 * wob, 1.8);
      hiss(c, now, 0.030, 0.30 * loud, 'lowpass', 520);
    } else if (kind === 'strike') {  // the heavier striker: the same clack with more weight under it
      hiss(c, now, 0.007, 1.0 * loud, 'bandpass', 3300 * wob, 0.6);
      hiss(c, now, 0.028, 0.90 * loud, 'bandpass', 1050 * wob, 1.6);
      hiss(c, now, 0.045, 0.50 * loud, 'lowpass', 380);
      tone(c, now, 150, 85, 0.045, 0.22 * loud);
    } else if (kind === 'wall') {    // a cushion: a soft, low knock
      hiss(c, now, 0.010, 0.45 * loud, 'bandpass', 2200 * wob, 0.7);
      hiss(c, now, 0.040, 0.70 * loud, 'bandpass', 460 * wob, 1.2);
      tone(c, now, 130, 75, 0.06, 0.25 * loud);
    } else {                         // into the pocket: a drop into the net and a short rattle
      hiss(c, now, 0.012, 0.6, 'bandpass', 2600, 0.7);
      hiss(c, now + 0.03, 0.06, 0.5, 'bandpass', 620, 1.1);
      hiss(c, now + 0.085, 0.05, 0.3, 'bandpass', 900, 1.3);
      tone(c, now + 0.03, 170, 80, 0.09, 0.3);
    }
  }
  function soundBtn() {
    const b = $('crSound');
    b.textContent = snd.on ? '🔊' : '🔇';
    b.setAttribute('aria-pressed', snd.on ? 'true' : 'false');
    b.setAttribute('aria-label', snd.on ? 'Board sounds are on. Tap to turn them off' : 'Board sounds are off. Tap to turn them on');
    b.classList.toggle('on', snd.on);
  }

  // ── turning the board so that you sit at the bottom ──
  const turnPt = (x, y, k) => { for (let i = 0; i < k; i++) [x, y] = [100 - y, x]; return [x, y]; };
  const backVec = (x, y, k) => { for (let i = 0; i < k; i++) [x, y] = [y, -x]; return [x, y]; };
  const turnVec = (x, y, k) => { for (let i = 0; i < k; i++) [x, y] = [-y, x]; return [x, y]; }; // a direction on the board, as it looks on this screen

  // ── drawing ──
  // Each disc: [highlight, face, face in shade, rim lit, rim in shade, groove]. The light comes from the top left.
  const LOOK = {
    w: ['#fffdf4', '#f1e7cd', '#d3c49c', '#fbf4e0', '#a3946c', 'rgba(110,90,50,.55)'],
    b: ['#6a6872', '#2e2d34', '#131217', '#55535c', '#060608', 'rgba(0,0,0,.7)'],
    q: ['#ff8a98', '#de3550', '#a31a33', '#f2607a', '#6e0f22', 'rgba(90,10,25,.6)'],
    s: ['#9fd0ff', '#2f7fe0', '#1757ad', '#e9f3ff', '#0f3f85', 'rgba(8,40,95,.6)'],
    x: ['#ffb0b3', '#e5484d', '#a8272b', '#ffe9ea', '#7a1518', 'rgba(90,10,15,.6)'], // the striker where it may not sit
  };
  function draw() {
    const cv = $('crCanvas'), box = $('crBoard');
    const css = box.clientWidth;
    if (!css || !T) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(css * dpr)) { cv.width = cv.height = Math.round(css * dpr); }
    const g = cv.getContext('2d');
    const u = cv.width / 100; // pixels per board unit
    g.setTransform(u, 0, 0, u, 0, 0);
    g.clearRect(0, 0, 100, 100);
    // surface
    g.fillStyle = '#ecd2a0'; g.fillRect(0, 0, 100, 100);
    const grain = g.createLinearGradient(0, 0, 100, 100);
    grain.addColorStop(0, 'rgba(255,255,255,.16)'); grain.addColorStop(1, 'rgba(120,70,20,.14)');
    g.fillStyle = grain; g.fillRect(0, 0, 100, 100);
    // pockets
    for (const [x, y] of G.POCKETS) {
      const R = G.POCKET_R, hole = g.createRadialGradient(x + R * 0.25, y + R * 0.3, R * 0.1, x, y, R);
      hole.addColorStop(0, '#050403'); hole.addColorStop(0.7, '#120d08'); hole.addColorStop(1, '#2c1d10');
      g.beginPath(); g.arc(x, y, R, 0, 7); g.fillStyle = hole; g.fill();
      g.lineWidth = 0.45; g.strokeStyle = 'rgba(70,38,14,.9)'; g.stroke();                                       // the cut edge of the wood
      g.beginPath(); g.arc(x, y, R - 0.45, 0.15, 1.45); g.lineWidth = 0.3; g.strokeStyle = 'rgba(255,225,170,.28)'; g.stroke(); // far wall catches the light
    }
    // lines (the same on all four sides, so no turning needed)
    g.strokeStyle = '#7a4a22'; g.lineWidth = 0.35; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const P = (x, y) => turnPt(x, y, k);
      const a1 = P(G.BASE_FROM, 100 - G.BASE + 1.6), b1 = P(G.BASE_TO, 100 - G.BASE + 1.6), a2 = P(G.BASE_FROM, 100 - G.BASE - 1.6), b2 = P(G.BASE_TO, 100 - G.BASE - 1.6);
      g.beginPath(); g.moveTo(...a1); g.lineTo(...b1); g.moveTo(...a2); g.lineTo(...b2); g.stroke();
      for (const x of [G.BASE_FROM, G.BASE_TO]) { const c = P(x, 100 - G.BASE); g.beginPath(); g.arc(c[0], c[1], 1.6, 0, 7); g.fillStyle = '#c0392b'; g.fill(); g.stroke(); }
      const d1 = P(12, 88), d2 = P(27, 73); g.beginPath(); g.moveTo(...d1); g.lineTo(...d2); g.stroke(); // corner arrow
    }
    g.beginPath(); g.arc(50, 50, 9.5, 0, 7); g.stroke();
    g.beginPath(); g.arc(50, 50, 2.3, 0, 7); g.fillStyle = 'rgba(192,57,43,.55)'; g.fill();

    const disc = (x, y, r, kind, alpha = 1) => {
      const [vx, vy] = turnPt(x, y, T.side);
      g.globalAlpha = alpha;
      const L = LOOK[kind === 's' && T.strikerBad ? 'x' : kind], ring = (rr, w, col, dx = 0, dy = 0, a0 = 0, a1 = 7) => { g.beginPath(); g.arc(vx + dx, vy + dy, rr, a0, a1); g.lineWidth = w; g.strokeStyle = col; g.stroke(); };
      // shadow on the board: a wide soft one and a tight dark one, both away from the light
      g.beginPath(); g.arc(vx + r * 0.2, vy + r * 0.3, r * 1.04, 0, 7); g.fillStyle = 'rgba(40,20,5,.16)'; g.fill();
      g.beginPath(); g.arc(vx + r * 0.1, vy + r * 0.16, r * 1.01, 0, 7); g.fillStyle = 'rgba(20,10,0,.32)'; g.fill();
      // the rounded rim: lit at the top left, dark at the bottom right
      const rim = g.createLinearGradient(vx - r * 0.7, vy - r * 0.7, vx + r * 0.7, vy + r * 0.7);
      rim.addColorStop(0, L[3]); rim.addColorStop(1, L[4]);
      g.beginPath(); g.arc(vx, vy, r, 0, 7); g.fillStyle = rim; g.fill();
      // the flat top, a little inside the rim
      const top = g.createRadialGradient(vx - r * 0.35, vy - r * 0.4, r * 0.05, vx, vy, r * 0.95);
      top.addColorStop(0, L[0]); top.addColorStop(0.45, L[1]); top.addColorStop(1, L[2]);
      g.beginPath(); g.arc(vx, vy, r * 0.86, 0, 7); g.fillStyle = top; g.fill();
      // turned grooves: a dark cut with a thin lit edge just beyond it
      const w = Math.max(0.12, r * 0.055);
      for (const k of kind === 's' ? [0.66, 0.5, 0.2] : [0.62, 0.3]) { ring(r * k, w, L[5]); ring(r * k, w * 0.7, 'rgba(255,255,255,.22)', w * 0.55, w * 0.55); }
      ring(r * 0.76, w * 0.9, 'rgba(255,255,255,.42)', 0, 0, Math.PI * 1.08, Math.PI * 1.45);                       // a glint on the shoulder
      if (kind === 's') ring(r - 0.12, 0.24, 'rgba(255,255,255,.75)');                                          // the striker keeps its white edge, so it is easy to find
      g.globalAlpha = 1;
    };
    const s = KO.getS();
    const kindOf = id => (id === 's' ? 's' : T.kinds[id]);
    if (T.sim) {
      for (const b of T.sim.bodies) if (!b.out) disc(b.x, b.y, b.r, kindOf(b.id));
      if (T.pre) { // aim line from the striker, as the shooter set it
        const st = T.sim.bodies.find(b => b.id === 's');
        const [vx, vy] = turnPt(st.x, st.y, T.side), [dx, dy] = turnVec(T.pre.dx, T.pre.dy, T.side);
        g.strokeStyle = 'rgba(255,214,107,.95)'; g.lineWidth = 0.7; g.setLineDash([1.6, 1.6]);
        g.beginPath(); g.moveTo(vx, vy); g.lineTo(vx + dx * (14 + 52 * T.pre.power), vy + dy * (14 + 52 * T.pre.power)); g.stroke(); g.setLineDash([]);
      }
      for (const f of T.fade) if (f.a > 0) disc(f.x, f.y, f.r * (0.4 + 0.6 * f.a), kindOf(f.id), f.a);
    } else if (T.view) {
      for (const c of T.view) if (c.on) disc(c.x, c.y, G.COIN_R, c.c);
      // the striker waits on the baseline of whoever shoots next
      const cur = s?.phase === 'playing' ? s.players.find(p => p.id === s.turnId) : null;
      if (cur && !T.waiting) {
        const mine = cur.id === s.you;
        // someone else's turn: their striker and aim, as they move them (the last update goes stale after a few seconds)
        const live = !mine && T.opp && T.opp.from === cur.id && Date.now() - T.opp.at < 6000 ? T.opp : null;
        const [sx, sy] = G.strikerSpot(cur.side, mine ? T.pos : live ? live.pos : 0.5);
        T.strikerBad = mine && T.view.some(c => c.on && (c.x - sx) ** 2 + (c.y - sy) ** 2 < (G.COIN_R + G.STRIKER_R) ** 2);
        disc(sx, sy, G.STRIKER_R, 's', mine ? 1 : live ? 0.9 : 0.55);
        let shown = mine ? T.aim : null;
        if (live && live.pw > 0.02) { const [dx, dy] = turnVec(live.dx, live.dy, T.side); shown = { dx, dy, power: live.pw, ok: true, theirs: true }; }
        if (shown) { // aim line and power
          const [vx, vy] = turnPt(sx, sy, T.side);
          const { dx, dy, power, ok } = shown;
          g.strokeStyle = shown.theirs ? 'rgba(255,214,107,.95)' : ok ? 'rgba(255,255,255,.95)' : 'rgba(229,72,77,.9)'; g.lineWidth = 0.7; g.setLineDash([1.6, 1.6]);
          g.beginPath(); g.moveTo(vx, vy); g.lineTo(vx + dx * (14 + 52 * power), vy + dy * (14 + 52 * power)); g.stroke(); g.setLineDash([]);
          g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(vx, vy); g.lineTo(vx - dx * 22 * power, vy - dy * 22 * power); g.stroke(); // the pull
          g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(4, 96.2, 92, 1.8);
          g.fillStyle = power > 0.8 ? '#e5484d' : power > 0.45 ? '#ffb020' : '#3ccf6e'; g.fillRect(4, 96.2, 92 * power, 1.8);
        }
      }
    }
  }

  // ── replaying shots ──
  function frame(now) {
    if (!T) return;
    T.raf = 0;
    if (T.sim && T.pre) { // the look at the aim before the shot goes
      if (now < T.pre.until) { draw(); T.raf = requestAnimationFrame(frame); return; }
      T.pre = null;
    }
    if (T.sim) {
      const want = Math.min(T.simSteps, Math.floor((now - T.simT) / 1000 * G.HZ * (calm ? 3 : 1)));
      let n = T.sim.step;
      while (T.sim.step < want && G.simStep(T.sim)) {
        if (T.sim.events.length) { for (const ev of T.sim.events) play(ev.k === 'wall' ? 'wall' : ev.s ? 'strike' : 'hit', ev.v); T.sim.events.length = 0; }
        for (const p of T.sim.pocketed) if (!p.seen) { p.seen = true; const b = T.sim.bodies.find(x => x.id === p.id); T.fade.push({ id: p.id, x: G.POCKETS[p.pocket][0], y: G.POCKETS[p.pocket][1], r: b.r, a: 1 }); play('drop'); try { navigator.vibrate?.(25); } catch {} }
      }
      for (const f of T.fade) f.a -= 0.07;
      draw();
      if (T.sim.done || T.sim.step >= T.simSteps) {
        if (!T.simEnd) T.simEnd = now;
        if (now - T.simEnd > 260) { T.sim = null; T.fade = []; T.simEnd = 0; T.view = T.after; next(); return; }
      }
      T.raf = requestAnimationFrame(frame);
    }
  }
  function next() { // show the next queued thing: a shot, or the news that followed it
    const s = KO.getS();
    while (T.queue.length) {
      const e = T.queue.shift();
      if (e.k === 'shot') {
        const coins = e.before.map(([id, x, y]) => ({ id, x, y, on: true }));
        T.sim = G.newSim(coins, e.sx, e.sy, e.vx, e.vy);
        T.sim.events = []; // collect the knocks, for sound
        sndStart();
        // not my shot: hold for a moment on where the striker was and where it is aimed, then let it go
        const hold = e.id !== s?.you && !calm ? 450 : 0;
        const sp = Math.hypot(e.vx, e.vy) || 1;
        T.pre = hold ? { until: performance.now() + hold, dx: e.vx / sp, dy: e.vy / sp, power: Math.min(1, Math.max(0, (sp - G.V_MIN) / (G.V_MAX - G.V_MIN))) } : null;
        T.opp = null;
        T.simSteps = e.steps; T.simT = performance.now() + hold; T.fade = []; T.simEnd = 0;
        T.after = e.after;
        T.raf = requestAnimationFrame(frame);
        return;
      }
      if (e.k === 'cres') news(e, s);
    }
    T.running = false;
    T.view = s?.coins || T.view;
    controls();
    draw();
    if (s?.phase === 'ended') ended(s, s.hostId === s.you); // (the result waits for the replay)
  }
  function news(e, s) {
    const me = e.id === s?.you, who = me ? 'You' : e.p;
    if (e.foul) KO.toast(me ? `Foul! Your striker went in${e.back ? `: ${e.back} coin${e.back > 1 ? 's' : ''} back on the board` : ''}` : `${e.p}: foul, striker in the pocket`);
    else if (e.queen === 'covered') KO.toast(`👑 ${who} covered the queen`, me);
    else if (e.queen === 'pending') KO.toast(me ? '👑 Queen pocketed: now pocket a coin to keep her' : `👑 ${e.p} pocketed the queen and must cover her`);
    else if (e.queen === 'returned') KO.toast('The queen goes back to the centre');
    else if (e.early) KO.toast(me ? 'Cover the queen before your last coin: it is back on the board' : `${e.p}'s last coin is back: the queen is not covered yet`);
    else if (me && e.pts > 0 && s?.settings.rules === 'points') KO.toast(`+${e.pts} points`);
  }

  // ── waiting room ──
  function lobby(s, isHost) {
    $('crRulesInput').value = s.settings.rules;
    $('privateInput').checked = !!s.settings.private;
    $('reactionsInput').checked = !!s.settings.reactions;
    $('botLevelInput').value = s.settings.botLevel || 'normal';
    $('turnTimeInput').value = String(s.settings.turnTime || 0);
    $('addBotBtn').disabled = s.players.length >= 4;
    const n = s.players.length, okN = n >= 2; // (with 3, a computer player joins when the host starts)
    $('guestSettings').textContent = isHost ? '' : `${s.settings.rules === 'points' ? 'Points rules: any coin, black 10, white 20, queen 50' : 'Classic rules: black against white, cover the queen'}` +
      (s.players.some(p => p.bot) ? ` · computer: ${s.settings.botLevel || 'normal'}` : '') + ` · ${s.settings.turnTime ? s.settings.turnTime + ' s per turn' : 'no turn timer'}` +
      (s.settings.reactions ? ' · 😄 reactions on' : '') + (s.settings.private ? ' · 🔒 private room' : '');
    $('startBtn').classList.toggle('hidden', !isHost);
    $('startBtn').disabled = !okN;
    $('startBtn').textContent = n < 2 ? 'Waiting for players… (2 or 4)' : n === 3 ? (s.settings.rules === 'points' ? 'Start game (3 players + 1 computer)' : 'Start game (3 players + 1 computer, 2 teams)') : n === 4 ? (s.settings.rules === 'points' ? 'Start game (4 players)' : 'Start game (2 teams of 2)') : 'Start game (2 players)';
    $('waitHost').classList.toggle('hidden', isHost);
  }

  // ── the table ──
  function plate(s, p) {
    const d = el('div', 'cr-plate' + (p.id === s.turnId && s.phase === 'playing' ? ' turn' : '') + (p.online ? '' : ' away'));
    d.dataset.id = p.id;
    const points = s.settings.rules === 'points';
    if (!points) d.append(el('i', 'cr-dot ' + p.colour));
    const nm = el('span', 'cr-name', (p.bot ? '🤖 ' : '') + p.name + (p.id === s.you ? ' (you)' : ''));
    const crown = points ? s.queenBy === p.id : s.queen === 'covered' && s.queenBy === p.colour;
    const stat = el('b', 'cr-stat', points ? `${p.score}` : `${s.left[p.colour]} left`);
    d.append(nm);
    if (crown) d.append(el('span', 'cr-crown', '👑'));
    else if (s.coverId === p.id) d.append(el('span', 'cr-crown pending', '👑?'));
    d.append(stat, el('i', 'cr-clock'));
    if (p.idleOut && s.phase === 'playing' && !s.spectating && p.id !== s.you) { const x = el('button', 'cr-x', '✕'); x.setAttribute('aria-label', `Remove ${p.name} (inactive)`); x.onclick = () => KO.askKick(p); d.append(x); }
    return d;
  }
  function render(s, fresh, firstState) {
    if (!G) { engine().then(() => { if (KO.getS() === s) render(s, fresh, firstState); }).catch(() => KO.toast("Couldn't load the game. Check your connection")); KO.show('carrom'); return; }
    if (!T) T = fresh0();
    KO.show('carrom');
    T.waiting = false;
    const me = s.players.find(p => p.id === s.you);
    const seated = !!me && !s.spectating;
    const isHost = s.hostId === s.you;
    T.side = seated ? me.side : 0;
    T.kinds = Object.fromEntries(s.coins.map(c => [c.id, c.c]));
    if (firstState || !T.view) T.view = s.coins;
    const myTurn = s.phase === 'playing' && s.turnId === s.you && seated;
    if (myTurn && T.prevTurn !== s.you && !firstState) { try { navigator.vibrate?.(120); } catch {} }
    if (T.prevTurn !== s.turnId) T.opp = null; // a new turn: forget the last player's aim
    T.prevTurn = s.turnId;
    const at = s._at ?? (s._at = Date.now());
    T.deadlineAt = s.phase === 'playing' && s.deadlineIn != null ? at + s.deadlineIn : null;
    T.turnLength = (s.settings.turnTime || 0) * 1000;

    // queue what happened (a shot carries the board it ended with, so replays line up even if more news follows)
    if (!firstState) for (const e of fresh) {
      if (e.k === 'shot') T.queue.push({ ...e, after: s.coins });
      else if (e.k === 'cres') T.queue.push(e);
      else if (e.k === 'cstart') { T.queue = []; T.sim = null; T.view = s.coins; T.pos = 0.5; T.endClosed = -1; }
    }
    // plates: you at the bottom, the others across the top in the order they sit (left, opposite, right)
    const tops = seated ? [3, 2, 1].map(k => s.players.find(p => (p.side - me.side + 4) % 4 === k)).filter(Boolean) : s.players.slice(1);
    $('crTop').replaceChildren(...tops.map(p => plate(s, p)));
    $('crBottom').replaceChildren(...(seated ? [plate(s, me)] : s.players.slice(0, 1).map(p => plate(s, p))));
    const w = $('crWatchers');
    w.classList.toggle('hidden', !s.spectators.length);
    w.textContent = s.spectators.length ? `👀 Watching: ${s.spectators.map(p => p.name + (p.id === s.you ? ' (you)' : '')).join(', ')}` : '';
    const points = s.settings.rules === 'points';
    KO.sideRow(s, s.phase === 'playing' ? (points ? `You: ${me?.score ?? 0} pts` : seated ? `You are ${me.colour === 'w' ? 'white' : 'black'}` : '') : '', me);

    if (T.queue.length && !T.running) { T.running = true; next(); }
    else if (!T.running) { T.view = s.coins; draw(); }
    controls();
    tick();
    if (s.phase === 'ended') ended(s, isHost); else $('crEnd').classList.add('hidden');
    KO.placeChatTab();
  }

  function controls() {
    const s = KO.getS();
    if (!s || s.game !== 'carrom' || !T || s.phase === 'lobby') return;
    const me = s.players.find(p => p.id === s.you);
    const seated = !!me && !s.spectating;
    const playing = s.phase === 'playing';
    const myTurn = playing && seated && s.turnId === s.you;
    const go = myTurn && !T.running && !T.waiting;
    const who = s.players.find(p => p.id === s.turnId)?.name ?? '?';
    $('carrom').classList.toggle('busy', T.running || T.waiting);
    $('crSlideWrap').classList.toggle('hidden', !playing || !seated);
    $('crSlide').disabled = !go;
    $('crAgain').classList.toggle('hidden', !(s.phase === 'ended' && s.hostId === s.you && T.endClosed === s.round));
    const st = $('crStatus');
    st.querySelector('.secs')?.remove();
    if (T.running) return; // (the status changes when the replay ends, so it never gives the result away early)
    st.classList.toggle('mine', myTurn);
    st.textContent = s.phase === 'ended' ? 'Game over'
      : !playing ? ''
      : myTurn ? (s.coverId === s.you ? 'Cover the queen: pocket one of your coins' : T.strikerBad ? 'Slide the striker clear of the coin' : T.hinted ? 'Your turn' : 'Your turn: slide the striker, then pull back on the board and let go')
      : seated ? `${who}'s turn` : `Watching · ${who}'s turn`;
  }
  function tick() {
    const s = KO.getS();
    if (!s || s.game !== 'carrom' || !T) return;
    const st = $('crStatus');
    st.querySelector('.secs')?.remove();
    document.querySelectorAll('#carrom .timing').forEach(x => x.classList.remove('timing', 'hurry'));
    if (!T.deadlineAt || s.phase !== 'playing' || T.running) return;
    const left = Math.max(0, T.deadlineAt - Date.now());
    const secs = Math.min(Math.ceil(left / 1000), Math.round(T.turnLength / 1000) || 999);
    const hurry = secs <= 5;
    const p = [...document.querySelectorAll('.cr-plate')].find(x => x.dataset.id === s.turnId);
    if (p) { p.classList.add('timing'); p.classList.toggle('hurry', hurry); p.style.setProperty('--left', T.turnLength ? Math.min(1, left / T.turnLength).toFixed(3) : 1); }
    st.append(el('span', 'secs' + (hurry ? ' hurry' : ''), `${secs}s`));
    if (hurry && !T.buzzed && s.turnId === s.you) { T.buzzed = true; try { navigator.vibrate?.([60, 60, 60]); } catch {} }
    if (!hurry) T.buzzed = false;
  }

  function ended(s, isHost) {
    const ov = $('crEnd');
    const show = !!s.lastRound && T.endClosed !== s.round && !T.running;
    ov.classList.toggle('hidden', !show);
    if (!s.lastRound) return;
    const r = s.lastRound, mine = r.winnerIds.includes(s.you);
    const names = r.winnerIds.map(id => s.players.find(p => p.id === id)?.name ?? '?');
    $('crEndTitle').textContent = mine ? (r.winnerIds.length > 1 && r.rules === 'classic' ? 'Your team wins! 🎉' : 'You win! 🎉') : `${names.join(' and ')} win${names.length > 1 ? '' : 's'}`;
    $('crEndSub').textContent = r.rules === 'classic' ? `${r.colour === 'w' ? 'White' : 'Black'} cleared the board · ${r.points} point${r.points === 1 ? '' : 's'} (coins left${s.queenBy === r.colour ? ' + 3 for the queen' : ''})` : 'Final scores';
    const ol = $('crEndList');
    ol.replaceChildren();
    const rows = r.rules === 'classic' ? s.players.slice().sort((a, b) => r.winnerIds.includes(b.id) - r.winnerIds.includes(a.id)) : s.players.slice().sort((a, b) => b.score - a.score);
    rows.forEach(p => {
      const li = el('li', '', `${r.winnerIds.includes(p.id) ? '🏆' : '·'} ${p.name}` + (p.id === s.you ? ' (you)' : ''));
      li.append(el('span', '', r.rules === 'classic' ? `${p.colour === 'w' ? 'white' : 'black'} · ${s.left[p.colour]} left` : `${p.score}`));
      ol.append(li);
    });
    $('crEndAgain').classList.toggle('hidden', !isHost);
    $('crEndAgain').disabled = s.players.length < 2;
    $('crEndWait').classList.toggle('hidden', isHost);
  }

  // ── aiming: pull back anywhere on the board, like a catapult, and let go ──
  // Tell the other phones where my striker is and where I am aiming (a few times a second; nothing is stored)
  let aimSent = 0, aimLater = null;
  function shareAim(force = false) {
    if (KO.isSolo() || !T || !canShoot()) return;
    const now = Date.now();
    if (!force && now - aimSent < 90) { clearTimeout(aimLater); aimLater = setTimeout(() => shareAim(true), 100); return; }
    clearTimeout(aimLater);
    aimSent = now;
    const a = T.aim;
    const [dx, dy] = a ? backVec(a.dx, a.dy, T.side) : [0, 0];
    KO.send({ t: 'aim', pos: T.pos, dx, dy, pw: a && a.ok ? a.power : 0 });
  }
  function onAim(m) { // from the player whose turn it is
    const s = KO.getS();
    if (!T || !s || s.game !== 'carrom' || m.from !== s.turnId || m.from === s.you) return;
    T.opp = { from: m.from, pos: m.pos, dx: m.dx, dy: m.dy, pw: m.pw, at: Date.now() };
    if (!T.running) draw();
  }

  function boardPt(ev) { const r = $('crCanvas').getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * 100, (ev.clientY - r.top) / r.height * 100]; }
  let drag = null;
  function canShoot() { const s = KO.getS(); return !!(s && T && s.game === 'carrom' && s.phase === 'playing' && s.turnId === s.you && !s.spectating && !T.running && !T.waiting); }
  function onDown(ev) {
    if (!canShoot()) return;
    ev.preventDefault();
    drag = { from: boardPt(ev), id: ev.pointerId };
    try { $('crCanvas').setPointerCapture(ev.pointerId); } catch {}
    T.aim = null;
  }
  function onMove(ev) {
    if (!drag || ev.pointerId !== drag.id || !T) return;
    const [x, y] = boardPt(ev);
    const px = drag.from[0] - x, py = drag.from[1] - y; // pull: the shot goes the opposite way to the drag
    const len = Math.hypot(px, py);
    if (len < 1.5) { T.aim = null; draw(); shareAim(); return; }
    const dx = px / len, dy = py / len;
    T.aim = { dx, dy, power: Math.min(1, len / 38), ok: dy < -0.1 && !T.strikerBad };
    draw();
    shareAim();
  }
  function onUp(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    drag = null;
    const a = T?.aim;
    if (!T) return;
    T.aim = null;
    if (!a || a.power < 0.1 || !canShoot()) { shareAim(true); return draw(); } // (aim dropped: the others see the line go)
    if (!a.ok) { KO.toast(T.strikerBad ? 'The striker is touching a coin: slide it along first' : 'Shoot forward: pull back towards yourself'); return draw(); }
    const sp = G.V_MIN + (G.V_MAX - G.V_MIN) * a.power;
    const [vx, vy] = backVec(a.dx * sp, a.dy * sp, T.side);
    T.waiting = true; T.hinted = true;
    controls(); draw();
    KO.send({ t: 'shot', pos: T.pos, vx, vy });
  }

  async function startSolo() {
    let E;
    try { E = await engine(); } catch { return KO.toast("Couldn't load the game. Check your connection and try again"); }
    const s = E.newRoom();
    s.settings.rules = $('csoloRules').value;
    s.settings.botLevel = $('csoloLevel').value;
    s.settings.turnTime = Number($('csoloTime').value);
    const me = E.addPlayer(s, KO.name() || 'You');
    for (let i = 0; i < Number($('csoloCount').value); i++) E.addPlayer(s, E.botName(s), { bot: true, level: s.settings.botLevel });
    E.handle(s, me.id, { t: 'start' });
    reset();
    KO.startSolo(E, s, me.id);
  }

  function init(bridge) {
    KO = bridge; el = KO.el;
    const cv = $('crCanvas');
    snd.on = KO.store.get(SOUND_KEY) === true;
    soundBtn();
    $('crSound').onclick = () => {
      snd.on = !snd.on;
      KO.store.set(SOUND_KEY, snd.on);
      soundBtn();
      if (snd.on) { sndStart(); setTimeout(() => play('strike', 150), 60); } // a knock, so you hear what you switched on
    };
    cv.addEventListener('pointerdown', sndStart);
    $('crSlide').addEventListener('pointerdown', sndStart);
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', () => { drag = null; if (T) { T.aim = null; draw(); } });
    $('crSlide').addEventListener('input', e => { if (!T) return; T.pos = Number(e.target.value) / 1000; draw(); controls(); shareAim(); });
    $('crAgain').onclick = () => KO.send({ t: 'start' });
    $('crEndAgain').onclick = () => KO.send({ t: 'start' });
    $('crEndClose').onclick = () => { const s = KO.getS(); if (T && s) { T.endClosed = s.round; $('crEnd').classList.add('hidden'); controls(); } };
    $('crRulesInput').onchange = e => KO.send({ t: 'settings', rules: e.target.value });
    $('csoloCancel').onclick = () => $('carromSoloModal').classList.add('hidden');
    $('csoloStart').onclick = () => { $('carromSoloModal').classList.add('hidden'); startSolo(); };
    window.addEventListener('resize', () => { if (T && !$('carrom').classList.contains('hidden')) draw(); });
  }

  window.KOCarrom = {
    init, render, lobby, tick, reset, controls, onAim,
    onTab(id) { if (id === 'carrom') engine().catch(() => {}); },
    soloOpen: () => $('carromSoloModal').classList.remove('hidden'),
    _sound: () => ({ on: snd.on, played: snd.count, state: snd.ctx?.state || 'none' }), // test hook
    _opp: () => (T?.opp ? { ...T.opp } : null), // test hook: the other player's aim as last received
    // test hook: take a shot without dragging (view direction: dx, dy with dy < 0 = forward; power 0..1)
    _shoot(pos, dx, dy, power) {
      if (!canShoot()) return false;
      T.pos = pos; const len = Math.hypot(dx, dy) || 1, sp = G.V_MIN + (G.V_MAX - G.V_MIN) * power;
      const [vx, vy] = backVec(dx / len * sp, dy / len * sp, T.side);
      T.waiting = true; controls(); KO.send({ t: 'shot', pos, vx, vy }); return true;
    },
    logText(e) {
      switch (e.k) {
        case 'cstart': return `New board: ${e.p} breaks`;
        case 'shot': return `${e.p} shoots`;
        case 'cres': return e.foul ? `${e.p}: foul` : e.queen === 'covered' ? `${e.p} covered the queen` : e.own ? `${e.p} pocketed ${e.own}` : `${e.p} missed`;
        case 'cend': return `${(e.names || []).join(' and ')} won the board`;
        default: return '';
      }
    },
  };
})();
