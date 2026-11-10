import { DurableObject } from 'cloudflare:workers';
import * as G from './game.js';

const IDLE_CLEANUP_MS = 24 * 60 * 60 * 1000; // forget a room 24 h after its last activity
const MAX_SOCKETS = 300;

// Front door: the game page is served from /public automatically.
// Only /ws reaches this code; it forwards the player to their room.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const room = (url.searchParams.get('room') || '').toUpperCase();
      if (!/^[A-Z0-9]{4,8}$/.test(room)) return new Response('Bad room code', { status: 400 });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(room));
      return stub.fetch(request);
    }
    return new Response('Not found', { status: 404 });
  },
};

// One instance of this class per room code. It holds the deck and every hand,
// checks every move, and sends each phone only what that player may see.
export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) || G.newRoom();
    });
    // Keep-alive pings are answered without waking the room (no cost)
    try { ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong')); } catch {}
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 });
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

  async save() {
    await this.ctx.storage.put('room', this.room);
    await this.ctx.storage.setAlarm(Date.now() + IDLE_CLEANUP_MS);
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 2000) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    const s = this.room;
    const att = ws.deserializeAttachment() || {};

    if (msg.t === 'join') {
      let p = s.players.find(x => x.id === msg.playerId && x.token === msg.token);
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
      return this.broadcast();
    }

    if (!att.pid) return this.send(ws, { t: 'error', msg: 'Join first' });

    const res = G.handle(s, att.pid, msg);
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
  }

  async webSocketClose(ws) {
    try { ws.close(1000, 'bye'); } catch {}
    this.broadcast(ws);
  }

  async webSocketError(ws) {
    this.broadcast(ws);
  }

  async alarm() {
    if (this.ctx.getWebSockets().length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_CLEANUP_MS);
      return;
    }
    await this.ctx.storage.deleteAll();
    this.room = G.newRoom();
  }
}
