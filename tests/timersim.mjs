import * as G from '../public/shared/game.js';
let games=0, timeouts=0;
for (const n of [2,3,6,12]) for (const stacking of [false,true]) for (let g=0; g<100; g++) {
  const s=G.newRoom(); s.settings.stacking=stacking; s.settings.turnTime=10;
  const humans=[]; for(let i=0;i<n;i++) humans.push(G.addPlayer(s,'P'+i));
  G.addPlayer(s,G.botName(s),{bot:true,level:'normal'});
  G.handle(s,s.hostId,{t:'start'});
  let steps=0;
  while(s.phase==='playing'){
    if(++steps>20000) throw new Error('stuck');
    const cur=s.players[s.turn];
    if(cur.bot){ if(s.deadline!==null) throw 'bot has deadline'; const a=G.nextBotAction(s); G.handle(s,a.pid,a.msg); continue; }
    if(!s.deadline) throw new Error('human without deadline');
    const before=s.turnNo;
    // everybody idles: time runs out
    if(!G.timeoutMove(s, s.deadline+1)) throw new Error('timeout did nothing');
    timeouts++;
    if(s.phase==='playing' && s.turnNo===before) throw new Error('turn did not move on after timeout');
    const total=s.deck.length+s.discard.length+s.players.reduce((x,p)=>x+p.hand.length,0);
    if(total!==s.nextCardId) throw 'cards';
  }
  if(s.deadline!==null) throw 'deadline after end';
  games++;
}
// timer off
const s=G.newRoom(); G.addPlayer(s,'A'); G.addPlayer(s,'B'); G.handle(s,s.hostId,{t:'settings',turnTime:0}); G.handle(s,s.hostId,{t:'start'});
if(s.deadline!==null) throw 'off but deadline';
console.log('timer games',games,'timeouts',timeouts,'off ok');
