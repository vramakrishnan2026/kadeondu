import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { GameRoom, Lobby } from './mock/worker.js';
const PUB = path.resolve(new URL('../public', import.meta.url).pathname);
const rooms = new Map();
function makeCtx(){ const store=new Map(); const sockets=new Set();
  return { sockets, storage:{ get:async k=>store.has(k)?structuredClone(store.get(k)):undefined, put:async(k,v)=>store.set(k,structuredClone(v)), setAlarm:async()=>{}, deleteAll:async()=>store.clear() },
    blockConcurrencyWhile:async fn=>fn(), acceptWebSocket:ws=>sockets.add(ws), getWebSockets:()=>[...sockets].filter(w=>w.open), setWebSocketAutoResponse(){} }; }
let lobby; const env={ LOBBY:{ idFromName:n=>n, get:()=>lobby } };
lobby=new Lobby(makeCtx(),env);
function getRoom(code){ if(!rooms.has(code)){ const ctx=makeCtx(); ctx.storage.put('code',code); const r=new GameRoom(ctx,env); rooms.set(code,r); } return rooms.get(code); }
class MockWS { constructor(sock){ this.sock=sock; this.open=true; this.att=null; }
  serializeAttachment(a){this.att=structuredClone(a)} deserializeAttachment(){return this.att}
  send(str){ if(!this.open) throw new Error('closed'); const b=Buffer.from(str); let h; if(b.length<126) h=Buffer.from([0x81,b.length]); else if(b.length<65536){h=Buffer.alloc(4);h[0]=0x81;h[1]=126;h.writeUInt16BE(b.length,2)} else {h=Buffer.alloc(10);h[0]=0x81;h[1]=127;h.writeBigUInt64BE(BigInt(b.length),2)} this.sock.write(Buffer.concat([h,b])); }
  close(){ if(!this.open) return; this.open=false; try{this.sock.write(Buffer.from([0x88,0]));this.sock.end()}catch{} } }
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff':'font/woff','.mp3':'audio/mpeg'};
const srv=http.createServer((req,res)=>{ const u=new URL(req.url,'http://x'); let f=u.pathname==='/'?'/index.html':u.pathname; const p=path.join(PUB,f);
  if(!p.startsWith(PUB)||!fs.existsSync(p)){res.writeHead(404);return res.end('nf')} res.writeHead(200,{'content-type':mime[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(res); });
srv.on('upgrade',(req,sock)=>{ const u=new URL(req.url,'http://x'); const code=(u.searchParams.get('room')||'').toUpperCase();
  const isLobby=u.pathname==='/lobby';
  if(!isLobby && (u.pathname!=='/ws'||!/^[A-Z0-9]{4,8}$/.test(code))){sock.destroy();return}
  const acc=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acc}\r\n\r\n`);
  const room=isLobby?lobby:getRoom(code); const ws=new MockWS(sock); room.ctx.acceptWebSocket(ws);
  if(isLobby){ ws.serializeAttachment({cid:null,name:'',room:null}); ws.send(JSON.stringify({t:'rooms',rooms:lobby.list()})); ws.send(JSON.stringify({t:'people',people:lobby.people()})); } else ws.serializeAttachment({pid:null});
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
