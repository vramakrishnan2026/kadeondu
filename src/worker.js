import { DurableObject } from 'cloudflare:workers';
import * as G from './game.js';

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
      return this.report();
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
// A single instance that keeps the list of open rooms and
// pushes it to everyone sitting on the home screen.
// ───────────────────────────────────────────────────────────
export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rooms = {};
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

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return Response.json({ rooms: this.list() });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ t: 'rooms', rooms: this.list() }));
    return new Response(null, { status: 101, webSocket: client });
  }

  // Called by rooms (RPC)
  async update(sum) {
    if (!sum?.code) return;
    if (sum.online > 0 && sum.players + sum.watching > 0) this.rooms[sum.code] = { ...sum, at: Date.now() };
    else delete this.rooms[sum.code];
    await this.ctx.storage.put('rooms', this.rooms);
    const msg = JSON.stringify({ t: 'rooms', rooms: this.list() });
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(msg); } catch {} }
  }

  async webSocketMessage() {}
  async webSocketClose(ws) { try { ws.close(1000, 'bye'); } catch {} }
}
