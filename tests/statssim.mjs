// Join stats: the front door's password check and location hand-off, and the lobby's join log.
// Run after prepare-mock.sh has built mock/worker.js (the stand-in does not need to be running).
import worker, { GameRoom, Lobby } from './mock/worker.js';
const ok = (c, m) => { if (!c) throw new Error(m); };
function makeCtx() { const store = new Map();
  return { store, storage: { get: async k => store.get(k), put: async (k, v) => store.set(k, structuredClone(v)), delete: async k => { for (const x of [].concat(k)) store.delete(x); },
    list: async ({ prefix = '', end, reverse, limit = Infinity } = {}) => { let ks = [...store.keys()].filter(k => k.startsWith(prefix) && (end === undefined || k < end)).sort(); if (reverse) ks.reverse(); return new Map(ks.slice(0, limit).map(k => [k, store.get(k)])); } },
    blockConcurrencyWhile: async fn => fn(), getWebSockets: () => [], setWebSocketAutoResponse() {} }; }
const ctx = makeCtx(); const lobby = new Lobby(ctx, {});
let seen = null;
const env = { STATS_KEY: 'a-long-secret-key', LOBBY: { idFromName: n => n, get: () => lobby }, ROOMS: { idFromName: n => n, get: () => ({ fetch: async r => { seen = r; return new Response('room'); } }) } };
const stats = (key, e = env) => worker.fetch(new Request('http://x/api/stats', key === null ? {} : { headers: { 'x-stats-key': key } }), e);

// password check
ok((await stats(null)).status === 404, 'no key should be 404');
ok((await stats('wrong')).status === 404, 'wrong key should be 404');
ok((await stats('a-long-secret-keY')).status === 404, 'near-miss key should be 404');
ok((await stats('short', { ...env, STATS_KEY: 'short' })).status === 404, 'short keys switch the page off');
ok((await stats('', { ...env, STATS_KEY: undefined })).status === 404, 'no key set: page is off');
let r = await stats('a-long-secret-key'); ok(r.status === 200, 'right key'); let body = await r.json(); ok(body.rows.length === 0 && body.keepDays === 90, 'empty log');

// log + read back, newest first, fields cleaned
await lobby.logJoin({ name: 'Arun', city: 'Bengaluru', region: 'Karnataka', country: 'IN', kind: 'create' });
await new Promise(r => setTimeout(r, 5));
await lobby.logJoin({ name: '<b>Priya</b>', city: 'Mysuru', region: 'Karnataka', country: 'IN', kind: 'whatever' });
body = await (await stats('a-long-secret-key')).json();
ok(body.rows.length === 2 && body.rows[0].city === 'Mysuru' && body.rows[1].kind === 'create' && body.rows[0].kind === 'join', 'rows');
ok(!body.rows[0].name.includes('<'), 'name cleaned');
ok(Object.keys(body.rows[0]).sort().join() === 'at,city,country,kind,name,region', 'only the expected fields (no IP)');

// entries past 90 days are hidden at once and deleted on the next tidy-up
const old = Date.now() - 91 * 86400000;
ctx.store.set(`j:${String(old).padStart(14, '0')}:zzzzzz`, { at: old, name: 'Old', city: 'X', region: '', country: 'IN', kind: 'join' });
ok((await lobby.stats()).length === 2, 'old entry hidden');
lobby.lastPrune = 0; await lobby.logJoin({ name: 'New', city: 'Pune', region: 'Maharashtra', country: 'IN', kind: 'join' });
ok(![...ctx.store.keys()].some(k => k.endsWith('zzzzzz')) && (await lobby.stats()).length === 3, 'old entry deleted');

// location hand-off: Cloudflare's location goes to the room; anything the browser sends under that name is replaced
const req = new Request('http://x/ws?room=ABCD', { headers: { 'x-geo': encodeURIComponent(JSON.stringify({ city: 'Fake' })) } });
Object.defineProperty(req, 'cf', { value: { city: 'São Paulo', region: 'São Paulo', country: 'BR' } });
await worker.fetch(req, env);
let g = GameRoom.geoFrom(seen); ok(g.city === 'São Paulo' && g.country === 'BR', 'geo passed: ' + JSON.stringify(g));
await worker.fetch(new Request('http://x/ws?room=ABCD', { headers: { 'x-geo': encodeURIComponent(JSON.stringify({ city: 'Fake' })) } }), env);
g = GameRoom.geoFrom(seen); ok(g.city === '' && g.country === '', 'spoofed location ignored');
ok(GameRoom.geoFrom(new Request('http://x/', { headers: { 'x-geo': '%%%' } })).city === '', 'bad header is harmless');
console.log('stats: password check, join log, 90-day clean-up and location hand-off ok');
