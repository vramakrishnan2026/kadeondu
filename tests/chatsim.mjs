// Room chat on the server: who can post, cleaning, the 200-message limit, and when the chat is wiped.
// Run after prepare-mock.sh has built mock/worker.js (the stand-in does not need to be running).
import { GameRoom } from './mock/worker.js';
const ok = (c, m) => { if (!c) throw new Error(m); };
function makeCtx() { const store = new Map(), sockets = new Set(); let alarmAt = null;
  return { store, sockets, get alarmAt() { return alarmAt; },
    storage: { get: async k => store.get(k), put: async (k, v) => store.set(k, structuredClone(v)), delete: async k => { for (const x of [].concat(k)) store.delete(x); },
      setAlarm: async t => { alarmAt = t; }, deleteAll: async () => store.clear() },
    blockConcurrencyWhile: async fn => fn(), acceptWebSocket: ws => sockets.add(ws), getWebSockets: () => [...sockets].filter(w => w.open), setWebSocketAutoResponse() {} }; }
class WS { constructor() { this.open = true; this.att = { pid: null }; this.got = []; }
  serializeAttachment(a) { this.att = structuredClone(a); } deserializeAttachment() { return this.att; }
  send(s) { this.got.push(JSON.parse(s)); } close() { this.open = false; }
  last(t) { return this.got.filter(m => m.t === t).at(-1); } }
const ctx = makeCtx(); const room = new GameRoom(ctx, {}); await new Promise(r => setTimeout(r, 5));
async function join(name, create) { const ws = new WS(); ctx.sockets.add(ws); await room.webSocketMessage(ws, JSON.stringify({ t: 'join', name, create, joinOnly: !create })); return ws; }
const say = async (ws, text) => { room.chatAt?.clear(); await room.webSocketMessage(ws, JSON.stringify({ t: 'chat', text })); };
const drop = async ws => { ws.open = false; await room.webSocketClose(ws); };

const a = await join('Arun', true), b = await join('Priya');
ok(a.last('chatlog').list.length === 0, 'new room starts with an empty chat');
await say(a, 'hello   there\n\tall'); 
ok(b.last('chat').m.text === 'hello there all' && b.last('chat').m.name === 'Arun' && a.last('chat'), 'everyone (sender too) gets the message, tidied');
await say(a, '   '); ok(room.chat.length === 1, 'blank messages are ignored');
await say(b, 'x'.repeat(500)); ok(room.chat.at(-1).text.length === 200, 'cut to 200 characters');
await room.webSocketMessage(b, JSON.stringify({ t: 'chat', text: 'too fast' })); ok(b.last('error') && room.chat.length === 2, 'one message a second');
const stranger = new WS(); ctx.sockets.add(stranger); await say(stranger, 'let me in'); ok(room.chat.length === 2, 'only people in the room can post');

// a watcher (joined mid-round) reads the history and can post
await room.webSocketMessage(a, JSON.stringify({ t: 'start' })); ok(room.room.phase === 'playing', 'round started');
const k = await join('Kiran'); ok(room.room.spectators.length === 1 && k.last('chatlog').list.length === 2, 'watcher gets the history');
await say(k, 'deal me in'); ok(a.last('chat').m.w === 1 && a.last('chat').m.name === 'Kiran', 'watcher can post, marked as watching');

// last 200 kept, oldest dropped first
for (let i = 0; i < 230; i++) await say(a, 'msg ' + i);
ok(room.chat.length === 200 && room.chat[0].text === 'msg 30' && room.chat.at(-1).text === 'msg 229', 'keeps the last 200, oldest out first');
ok(ctx.store.get('chat').length === 200, 'stored with the room');
const late = await join('Meera'); ok(late.last('chatlog').list.length === 200, 'late joiner gets the 200');

// nobody connected: back within 5 minutes keeps the chat, longer wipes it
for (const ws of [a, b, k, late, stranger]) await drop(ws);
ok(room.chatEmptyAt > 0 && Math.abs(ctx.alarmAt - (room.chatEmptyAt + 300000)) < 5, 'countdown starts when the last person disconnects');
await room.alarm(); ok(room.chat.length === 200, 'not wiped before 5 minutes');
const a2 = new WS(); ctx.sockets.add(a2);
await room.webSocketMessage(a2, JSON.stringify({ t: 'join', name: 'Arun', playerId: a.att.pid, token: a.last('welcome').token }));
ok(a2.last('chatlog').list.length === 200 && room.chatEmptyAt === 0, 'back within 5 minutes: chat is still there');
await drop(a2); room.chatEmptyAt = Date.now() - 6 * 60000; await room.alarm();
ok(room.chat.length === 0 && ctx.store.get('chat') === undefined, 'wiped after 5 minutes with nobody connected');

// everyone taps Leave: wiped at once, even if computer players remain
const a3 = new WS(); ctx.sockets.add(a3);
await room.webSocketMessage(a3, JSON.stringify({ t: 'join', name: 'Arun', playerId: a.att.pid, token: a.last('welcome').token }));
await say(a3, 'anyone here?'); ok(room.chat.length === 1, 'chat works again');
for (const p of [...room.room.players, ...room.room.spectators]) if (!p.bot && p.id !== a.att.pid) p.bot = true; // the others become computer players for this check
await room.webSocketMessage(a3, JSON.stringify({ t: 'leave' }));
ok(room.chat.length === 0, 'wiped when the last person leaves');
console.log('chat: posting rules, 200-message limit and wipe rules ok');
