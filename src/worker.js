import { DurableObject } from 'cloudflare:workers';
import * as G from '../public/shared/game.js';

const IDLE_CLEANUP_MS = 24 * 60 * 60 * 1000; // forget a room 24 h after its last activity
const LIST_STALE_MS = 6 * 60 * 60 * 1000;    // drop a room from the list if it hasn't reported for 6 h
const MAX_SOCKETS = 300;

// Front door: the game page is served from /public automatically.
// /ws?room=CODE  → that room's server
// /lobby         → the live list of open rooms
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const room = (url.searchParams.get('room') || '').toUpperCase();
      if (!/^[A-Z0-9]{4,8}$/.test(room)) return new Response('Bad room code', { status: 400 });
      return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
    }
    if (url.pathname === '/lobby') {
      return env.LOBBY.get(env.LOBBY.idFromName('main')).fetch(request);
    }
    return new Response('Not found', { status: 404 });
  },
};

function autoPong(ctx) {
  // Keep-alive pings are answered without waking the object (no cost)
  try { ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong')); } catch {}
}

// ───────────────────────────────────────────────────────────
// One instance per room code. Holds the deck and every hand,
// checks every move, and sends each phone only what it may see.
// ───────────────────────────────────────────────────────────
export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    this.code = null;
    this.lastSummary = '';
    this.botTimer = null;
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) || G.newRoom();
      this.code = (await ctx.storage.get('code')) || null;
    });
    autoPong(ctx);
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 });
    }
    if (!this.code) {
      this.code = (new URL(request.url).searchParams.get('room') || '').toUpperCase();
      await this.ctx.storage.put('code', this.code);
    }
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) {
      return new Response('Room is full', { status: 503 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ pid: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  online(except) {
    const set = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment();
      if (a?.pid) set.add(a.pid);
    }
    return set;
  }

  send(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch {}
  }

  broadcast(except) {
    const online = this.online(except);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment();
      if (a?.pid) this.send(ws, G.viewFor(this.room, a.pid, online));
    }
  }

  // Tell the room list about us, only when something it shows has changed
  async report(except) {
    if (!this.code || !this.env.LOBBY) return;
    const sum = G.summary(this.room, this.code, this.online(except).size);
    const key = JSON.stringify(sum);
    if (key === this.lastSummary) return;
    this.lastSummary = key;
    try { await this.env.LOBBY.get(this.env.LOBBY.idFromName('main')).update(sum); } catch {}
  }

  // Computer players: play their turn after a short, human-like pause.
  // Only runs while at least one person is connected.
  kickBots() {
    if (this.botTimer || this.online().size === 0) return;
    const a = G.nextBotAction(this.room);
    if (!a) return;
    this.botTimer = setTimeout(() => this.botTick(), a.delay);
  }

  async botTick() {
    this.botTimer = null;
    const a = G.nextBotAction(this.room);
    if (!a) return;
    const res = G.handle(this.room, a.pid, a.msg);
    if (!res.error) {
      await this.save();
      this.broadcast();
      await this.report();
    }
    this.kickBots();
  }

  async save() {
    await this.ctx.storage.put('room', this.room);
    await this.ctx.storage.setAlarm(Date.now() + IDLE_CLEANUP_MS);
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 2000) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    const att = ws.deserializeAttachment() || {};

    if (msg.t === 'join') {
      const s = this.room;
      let p = [...s.players, ...(s.spectators || [])].find(x => x.id === msg.playerId && x.token === msg.token);
      if (!p) {
        if (msg.create && s.players.length > 0) {
          if (this.online(ws).size > 0) return this.send(ws, { t: 'error', code: 'taken', msg: 'Room code in use' });
          this.room = G.newRoom(); // abandoned room with the same code: start fresh
        }
        if (msg.joinOnly && this.room.players.length === 0) {
          return this.send(ws, { t: 'error', code: 'noroom', msg: 'No room with that code' });
        }
        p = G.addPlayer(this.room, msg.name);
      } else {
        // Same player opened a new tab or reconnected: retire the old socket
        for (const other of this.ctx.getWebSockets()) {
          if (other !== ws && other.deserializeAttachment()?.pid === p.id) {
            this.send(other, { t: 'replaced' });
            try { other.close(4001, 'replaced'); } catch {}
          }
        }
      }
      ws.serializeAttachment({ pid: p.id });
      this.send(ws, { t: 'welcome', playerId: p.id, token: p.token, name: p.name });
      await this.save();
      this.broadcast();
      await this.report();
      return this.kickBots();
    }

    if (!att.pid) return this.send(ws, { t: 'error', msg: 'Join first' });

    const res = G.handle(this.room, att.pid, msg);
    if (res.error) return this.send(ws, { t: 'error', msg: res.error });
    if (res.kick) {
      for (const other of this.ctx.getWebSockets()) {
        if (other.deserializeAttachment()?.pid === res.kick) {
          other.serializeAttachment({ pid: null });
          this.send(other, { t: 'kicked' });
          try { other.close(4000, 'removed'); } catch {}
        }
      }
    }
    await this.save();
    this.broadcast();
    await this.report();
    this.kickBots();
  }

  async webSocketClose(ws) {
    try { ws.close(1000, 'bye'); } catch {}
    this.broadcast(ws);
    await this.report(ws);
  }

  async webSocketError(ws) {
    this.broadcast(ws);
    await this.report(ws);
  }

  async alarm() {
    if (this.ctx.getWebSockets().length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_CLEANUP_MS);
      return;
    }
    await this.ctx.storage.deleteAll();
    this.room = G.newRoom();
    this.code = null;
  }
}

// ───────────────────────────────────────────────────────────
// A single instance that keeps the list of open rooms and who is
// online, pushes both to every open page, and passes invites along.
// ───────────────────────────────────────────────────────────
const INVITE_GAP_MS = 10000; // one invite per person per 10 s

function cleanName(n) {
  return String(n || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20);
}

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rooms = {};
    this.lastInvite = new Map();
    ctx.blockConcurrencyWhile(async () => {
      this.rooms = (await ctx.storage.get('rooms')) || {};
    });
    autoPong(ctx);
  }

  list() {
    const now = Date.now();
    for (const [code, r] of Object.entries(this.rooms)) {
      if (now - r.at > LIST_STALE_MS) delete this.rooms[code];
    }
    return Object.values(this.rooms)
      .filter(r => r.online > 0)
      .sort((a, b) => (a.phase === 'playing') - (b.phase === 'playing') || b.at - a.at)
      .slice(0, 100)
      .map(({ at, ...r }) => r);
  }

  // Everyone with a page open who has typed a name (one entry per device)
  people(except) {
    const byId = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment();
      if (!a?.cid || !a.name) continue;
      const prev = byId.get(a.cid);
      if (!prev || (!prev.room && a.room)) byId.set(a.cid, { id: a.cid, name: a.name, room: a.room || null });
    }
    return [...byId.values()]
      .map(p => ({ ...p, roomHost: p.room ? this.rooms[p.room]?.host || '' : '' }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 200);
  }

  sendAll(obj, except) {
    const msg = JSON.stringify(obj);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(msg); } catch {}
    }
  }

  sendTo(cid, obj) {
    let n = 0;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.deserializeAttachment()?.cid === cid) { try { ws.send(JSON.stringify(obj)); n++; } catch {} }
    }
    return n;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return Response.json({ rooms: this.list() });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ cid: null, name: '', room: null });
    server.send(JSON.stringify({ t: 'rooms', rooms: this.list() }));
    server.send(JSON.stringify({ t: 'people', people: this.people() }));
    return new Response(null, { status: 101, webSocket: client });
  }

  // Called by rooms (RPC)
  async update(sum) {
    if (!sum?.code) return;
    if (sum.online > 0 && sum.players + sum.watching > 0) this.rooms[sum.code] = { ...sum, at: Date.now() };
    else delete this.rooms[sum.code];
    await this.ctx.storage.put('rooms', this.rooms);
    this.sendAll({ t: 'rooms', rooms: this.list() });
    this.sendAll({ t: 'people', people: this.people() }); // "In Arun's room" labels may change
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 1000) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const me = ws.deserializeAttachment() || {};

    if (m.t === 'hello') {
      const cid = /^[a-z0-9]{8,32}$/.test(m.cid || '') ? m.cid : null;
      const room = /^[A-Z0-9]{4,8}$/.test(m.room || '') ? m.room : null;
      const next = { cid, name: cleanName(m.name), room };
      if (JSON.stringify(next) === JSON.stringify(me)) return;
      ws.serializeAttachment(next);
      return this.sendAll({ t: 'people', people: this.people() });
    }

    if (m.t === 'invite') {
      if (!me.cid || !me.name || !me.room) return ws.send(JSON.stringify({ t: 'error', msg: 'Join a room before inviting' }));
      const target = this.people().find(p => p.id === m.to);
      if (!target) return ws.send(JSON.stringify({ t: 'error', msg: 'They are no longer online' }));
      if (target.room) return ws.send(JSON.stringify({ t: 'error', msg: `${target.name} is already in a room` }));
      const key = me.cid + '>' + m.to;
      if (Date.now() - (this.lastInvite.get(key) || 0) < INVITE_GAP_MS) return;
      this.lastInvite.set(key, Date.now());
      if (this.lastInvite.size > 2000) this.lastInvite.clear();
      this.sendTo(m.to, {
        t: 'invited', fromId: me.cid, from: me.name, room: me.room,
        roomHost: this.rooms[me.room]?.host || me.name, phase: this.rooms[me.room]?.phase || 'lobby',
      });
      return ws.send(JSON.stringify({ t: 'invite-sent', to: target.name }));
    }

    if (m.t === 'decline') {
      if (!me.cid || typeof m.to !== 'string') return;
      this.sendTo(m.to, { t: 'declined', from: me.name || 'Someone' });
    }
  }

  async webSocketClose(ws) {
    try { ws.close(1000, 'bye'); } catch {}
    this.sendAll({ t: 'people', people: this.people(ws) }, ws);
  }

  async webSocketError(ws) {
    this.sendAll({ t: 'people', people: this.people(ws) }, ws);
  }
}
