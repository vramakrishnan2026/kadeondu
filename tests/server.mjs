import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import worker, { GameRoom, Lobby } from './mock/worker.js';
import * as LudoRules from './mock/ludo.js'; // the same copy the mock room server uses, so tests can fix the dice
import * as PokerRules from './mock/poker.js'; // …and fix the next deck at a poker table
const PUB = path.resolve(new URL('../public', import.meta.url).pathname);
const rooms = new Map();
const fixedDice = new Map(); // room code -> rolls still to come (see /__test/die)
const fixedDecks = new Map(); // room code -> cards to deal first in the next hand (see /__test/deck)
PokerRules._test.deck = state => { let first = []; for (const [code, r] of rooms) if (r.room === state && fixedDecks.has(code)) { first = fixedDecks.get(code); fixedDecks.delete(code); }
  const rest = PokerRules.freshDeck().filter(c => !first.includes(c)); for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return rest.concat(first.slice().reverse()); };
LudoRules._test.die = state => { for (const [code, r] of rooms) if (r.room === state) { const q = fixedDice.get(code); if (q?.length) return q.shift(); } return 1 + Math.floor(Math.random() * 6); };
function makeCtx(){ const store=new Map(); const sockets=new Set();
  return { sockets, storage:{ get:async k=>store.has(k)?structuredClone(store.get(k)):undefined, put:async(k,v)=>store.set(k,structuredClone(v)), setAlarm:async()=>{}, deleteAll:async()=>store.clear(),
      delete:async k=>{ for(const x of [].concat(k)) store.delete(x) },
      list:async({prefix='',end,reverse,limit=Infinity}={})=>{ let ks=[...store.keys()].filter(k=>k.startsWith(prefix)&&(end===undefined||k<end)).sort(); if(reverse) ks.reverse(); return new Map(ks.slice(0,limit).map(k=>[k,structuredClone(store.get(k))])) } },
    blockConcurrencyWhile:async fn=>fn(), acceptWebSocket:ws=>sockets.add(ws), getWebSockets:()=>[...sockets].filter(w=>w.open), setWebSocketAutoResponse(){} }; }
let aiMode='on'; const aiSeen=[]; // /__test/ai?mode=on|limit|off ; aiSeen = what was sent to the model
let lobby; const env={ LOBBY:{ idFromName:n=>n, get:()=>lobby }, STATS_KEY:'test-stats-key-123', AI:{ run: async (model, o) => { aiSeen.push(o.messages[1].content); if (aiMode==='limit') throw new Error('daily limit'); return { response: '**Test note:** you are doing well on lessons. Work on calling less. Tip: count the pot odds first.' } } } };
let testGeo={city:'Bengaluru',region:'Karnataka',country:'IN'}; // stand-in for Cloudflare's location; change with /__test/geo
lobby=new Lobby(makeCtx(),env);
function getRoom(code){ if(!rooms.has(code)){ const ctx=makeCtx(); ctx.storage.put('code',code); const r=new GameRoom(ctx,env); rooms.set(code,r); } return rooms.get(code); }
class MockWS { constructor(sock){ this.sock=sock; this.open=true; this.att=null; }
  serializeAttachment(a){this.att=structuredClone(a)} deserializeAttachment(){return this.att}
  send(str){ if(!this.open) throw new Error('closed'); const b=Buffer.from(str); let h; if(b.length<126) h=Buffer.from([0x81,b.length]); else if(b.length<65536){h=Buffer.alloc(4);h[0]=0x81;h[1]=126;h.writeUInt16BE(b.length,2)} else {h=Buffer.alloc(10);h[0]=0x81;h[1]=127;h.writeBigUInt64BE(BigInt(b.length),2)} this.sock.write(Buffer.concat([h,b])); }
  close(){ if(!this.open) return; this.open=false; try{this.sock.write(Buffer.from([0x88,0]));this.sock.end()}catch{} } }
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff':'font/woff','.mp3':'audio/mpeg'};
const srv=http.createServer((req,res)=>{ const u=new URL(req.url,'http://x'); 
  // The real front door answers /api/stats (password check included)
  if(u.pathname==='/api/poker-coach'){ let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ const e2 = aiMode==='off' ? {...env, AI: undefined} : env; const r=await worker.fetch(new Request('http://x/api/poker-coach',{method:req.method, body: req.method==='POST'?body:undefined}),e2); res.writeHead(r.status,{'content-type':'application/json'}); res.end(await r.text()) }); return }
  if(u.pathname==='/__test/ai'){ if(u.searchParams.get('mode')) aiMode=u.searchParams.get('mode'); res.writeHead(200,{'content-type':'application/json'}); return res.end(JSON.stringify({mode:aiMode, seen:aiSeen})) }
  if(u.pathname==='/api/stats'){ return worker.fetch(new Request('http://x/api/stats',{headers:{'x-stats-key':req.headers['x-stats-key']||''}}),env).then(async r=>{ res.writeHead(r.status,{'content-type':r.headers.get('content-type')||'text/plain'}); res.end(await r.text()) }) }
  // Test-only: pretend nobody has been connected to this room for ?min= minutes, then run the room's wake-up
  if(u.pathname==='/__test/chatempty'){ const r=rooms.get((u.searchParams.get('room')||'').toUpperCase()); if(!r){res.writeHead(404);return res.end('no room')}
    r.chatEmptyAt=Date.now()-Number(u.searchParams.get('min')||6)*60000; return r.alarm().then(()=>{ res.writeHead(200); res.end(String(r.chat.length)) }) }
  // Test-only: mark ?name= as having forgotten to call (so others can Catch! them), give ?name= ?score= points, or set their idle count with ?idle=
  if(u.pathname==='/__test/rig'){ const r=rooms.get((u.searchParams.get('room')||'').toUpperCase()); const p=r&&r.room.players.find(x=>x.name===u.searchParams.get('name')); if(!p){res.writeHead(404);return res.end('no such player')}
    if(u.searchParams.has('score')) p.score=Number(u.searchParams.get('score')); else if(u.searchParams.has('idle')) p.idle=Number(u.searchParams.get('idle')); else r.room.vulnerable=p.id; r.broadcast(); res.writeHead(200); return res.end('ok') }
  // Test-only (Ludo): put ?name='s tokens at ?tokens=a,b,c,d (progress values, -1 = yard, 56 = home), or set their idle count with ?idle=
  if(u.pathname==='/__test/ludo'){ const r=rooms.get((u.searchParams.get('room')||'').toUpperCase()); const p=r&&r.room.players.find(x=>x.name===u.searchParams.get('name')); if(!p||r.room.game!=='ludo'){res.writeHead(404);return res.end('no such Ludo player')}
    if(u.searchParams.has('idle')) p.idle=Number(u.searchParams.get('idle')); else p.tokens=u.searchParams.get('tokens').split(',').map(Number); r.broadcast(); res.writeHead(200); return res.end('ok') }
  // Test-only (Ludo): the next rolls in ?room= come up as ?seq=6,3,… (then that room's dice are random again). Other rooms are not affected.
  // Test-only (poker): the next hand in ?room= deals ?cards=As,Kd,… first, in that order (two per player starting left of the button, then flop, turn, river).
  if(u.pathname==='/__test/deck'){ const code=(u.searchParams.get('room')||'').toUpperCase(); fixedDecks.set(code,(u.searchParams.get('cards')||'').split(',').filter(Boolean).map(PokerRules.parseCard)); res.writeHead(200); return res.end('ok') }
  // Test-only (carrom): leave only the listed coins on the board in ?room=: ?coins=id:x:y,id:x:y and optionally ?queen=covered:w
  if(u.pathname==='/__test/carrom'){ const code=(u.searchParams.get('room')||'').toUpperCase(); const r=rooms.get(code); if(!r?.room?.coins){ res.writeHead(404); return res.end('no such room') }
    const want=new Map((u.searchParams.get('coins')||'').split(',').filter(Boolean).map(t=>{ const [id,x,y]=t.split(':').map(Number); return [id,[x,y]] }));
    for(const c of r.room.coins){ const w=want.get(c.id); c.on=!!w; if(w){ c.x=w[0]; c.y=w[1] } }
    const q=u.searchParams.get('queen'); if(q){ const [st,by]=q.split(':'); r.room.queen=st; r.room.queenBy=by||null; r.room.cover=null }
    r.broadcast(); res.writeHead(200); return res.end('ok') }
  if(u.pathname==='/__test/die'){ const code=(u.searchParams.get('room')||'').toUpperCase(); fixedDice.set(code,(u.searchParams.get('seq')||'').split(',').filter(Boolean).map(Number)); res.writeHead(200); return res.end('ok') }
  // Test-only: pretend the next connections come from another place
  if(u.pathname==='/__test/geo'){ testGeo={city:u.searchParams.get('city')||'',region:u.searchParams.get('region')||'',country:u.searchParams.get('country')||''}; res.writeHead(200); return res.end('ok') }
  // Test-only shortcut (stand-in only, not in the real Worker): make a room's round time limit run out in ?ms= milliseconds
  if(u.pathname==='/__test/roundends'){ const r=rooms.get((u.searchParams.get('room')||'').toUpperCase()); if(!r||!r.room.roundEndsAt){res.writeHead(404);return res.end('no limit running')}
    r.room.roundEndsAt=Date.now()+Number(u.searchParams.get('ms')||1000); r.broadcast(); r.afterChange(); res.writeHead(200); return res.end("ok") }
  let f=u.pathname==='/'?'/index.html':u.pathname; const p=path.join(PUB,f);
  if(!p.startsWith(PUB)||!fs.existsSync(p)){res.writeHead(404);return res.end('nf')} res.writeHead(200,{'content-type':mime[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(res); });
srv.on('upgrade',(req,sock)=>{ const u=new URL(req.url,'http://x'); const code=(u.searchParams.get('room')||'').toUpperCase();
  const isLobby=u.pathname==='/lobby';
  if(!isLobby && (u.pathname!=='/ws'||!/^[A-Z0-9]{4,8}$/.test(code))){sock.destroy();return}
  const acc=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acc}\r\n\r\n`);
  const room=isLobby?lobby:getRoom(code); const ws=new MockWS(sock); room.ctx.acceptWebSocket(ws);
  if(isLobby){ ws.serializeAttachment({cid:null,name:'',room:null}); ws.send(JSON.stringify({t:'rooms',rooms:lobby.list()})); ws.send(JSON.stringify({t:'people',people:lobby.people()})); } else ws.serializeAttachment({pid:null, geo:GameRoom.geoFrom(new Request('http://x/',{headers:{'x-geo':encodeURIComponent(JSON.stringify(testGeo))}}))});
  let buf=Buffer.alloc(0); let chain=Promise.resolve();
  const closed=()=>{ if(ws.closedFired) return; ws.closedFired=true; ws.open=false; chain=chain.then(()=>room.webSocketClose(ws,1006)); };
  sock.on('data',d=>{ buf=Buffer.concat([buf,d]);
    for(;;){ if(buf.length<2) break; const op=buf[0]&15; let len=buf[1]&127, off=2; if(len===126){if(buf.length<4)break;len=buf.readUInt16BE(2);off=4} else if(len===127){if(buf.length<10)break;len=Number(buf.readBigUInt64BE(2));off=10}
      const masked=buf[1]&128; const mk=masked?buf.slice(off,off+4):null; if(masked) off+=4; if(buf.length<off+len) break;
      let pl=buf.slice(off,off+len); if(masked) pl=Buffer.from(pl.map((b,i)=>b^mk[i%4])); buf=buf.slice(off+len);
      if(op===8){ ws.close(); closed(); return; } if(op===1){ const t=pl.toString(); if(t==='ping'){ ws.send('pong'); continue; } chain=chain.then(()=>room.webSocketMessage(ws,t)).catch(e=>console.error('ERR',e)); } } });
  sock.on('close',closed); sock.on('error',closed);
});
srv.listen(8788,()=>console.log('mock on 8788'));
