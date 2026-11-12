import * as G from '../public/shared/game.js';
function rnd(a){return a[Math.floor(Math.random()*a.length)]}
let rounds=0, maxTurns=0, totalCards;
for (const n of [2,3,7,10,11,25,60]) for (const stacking of [false,true]) for (let g=0; g<30; g++) {
  const s=G.newRoom(); s.settings.stacking=stacking;
  const ids=[]; for(let i=0;i<n;i++) ids.push(G.addPlayer(s,'P'+i).id);
  const host=s.hostId;
  let r=G.handle(s,host,{t:'start'}); if(r.error) throw r.error;
  const expectCards = s.nextCardId;
  let turns=0;
  while(s.phase==='playing'){
    turns++; if(turns>20000) throw new Error('stuck n='+n);
    // conservation
    const total=s.deck.length+s.discard.length+s.players.reduce((a,p)=>a+p.hand.length,0);
    if(total!==s.nextCardId) throw new Error(`card count ${total} vs ${s.nextCardId}`);
    const cur=s.players[s.turn];
    const v=G.viewFor(s,cur.id,new Set());
    // random catch attempts
    if(s.vulnerable && Math.random()<0.3){ const other=s.players.find(p=>p.id!==s.vulnerable); G.handle(s,other.id,{t:'catch',target:s.vulnerable}); }
    if(v.canCall && Math.random()<0.7) G.handle(s,cur.id,{t:'ondu'});
    // random join / kick mid-game
    if(Math.random()<0.004){ const lp=G.addPlayer(s,'late'); if(lp.hand.length) throw 'spectator got cards'; if(!s.spectators.includes(lp)) throw 'not spectator';
      if(!G.handle(s,lp.id,{t:'draw'}).error) throw 'spectator acted'; const sv=G.viewFor(s,lp.id,new Set()); if(!sv.spectating||sv.hand.length) throw 'spectator view'; }
    if(Math.random()<0.002 && s.players.length>2){ const k=rnd(s.players.filter(p=>p.id!==s.hostId)); G.handle(s,s.hostId,{t:'kick',target:k.id}); continue; }
    if(v.playable.length){ const id=rnd(v.playable); const c=cur.hand.find(c=>c.id===id); r=G.handle(s,cur.id,{t:'play',cardId:id,color:c.c==='w'?rnd(G.COLORS):undefined}); }
    else if(v.drawnCardId!==null) r=G.handle(s,cur.id,{t:'pass'});
    else r=G.handle(s,cur.id,{t:'draw'});
    if(r.error) throw new Error('err '+r.error+' n='+n);
    // wrong-turn check
    const other=s.players.find((p,i)=>i!==s.turn);
    if(s.phase==='playing' && other && !G.handle(s,other.id,{t:'draw'}).error) throw new Error('played out of turn');
  }
  if(s.phase==='ended'){ if(s.spectators.length) throw 'spectators not merged'; rounds++; maxTurns=Math.max(maxTurns,turns); if(!s.winnerId) throw 'no winner'; if(s.players.find(p=>p.id===s.winnerId).hand.length) throw 'winner has cards'; }
  // next round works
  if(s.players.length>=2 && G.handle(s,s.hostId,{t:'start'}).error) throw 'restart failed';
}
console.log('OK rounds',rounds,'max turns',maxTurns);
