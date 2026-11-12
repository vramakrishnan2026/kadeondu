import * as G from '../public/shared/game.js';
let wins={easy:0,normal:0}, games=0, maxSteps=0;
for (const n of [2,3,4,6,10,15]) for (const stacking of [false,true]) for (let g=0; g<150; g++) {
  const s=G.newRoom(); s.settings.stacking=stacking;
  const human=G.addPlayer(s,'Me');
  for(let i=0;i<n;i++) G.addPlayer(s,G.botName(s),{bot:true,level:i%2?'easy':'normal'});
  // remove the human: pure bot game (host stays as id; handle start as host)
  if(G.handle(s,human.id,{t:'start'}).error) throw 'start';
  G.removePlayer(s,human.id); if(s.phase!=='playing') continue;
  let steps=0;
  while(s.phase==='playing'){
    if(++steps>50000) throw new Error('stuck '+n);
    const a=G.nextBotAction(s); if(!a) throw new Error('no action');
    const r=G.handle(s,a.pid,a.msg); if(r.error && a.msg.t!=='catch') throw new Error(r.error+' '+JSON.stringify(a.msg));
    const total=s.deck.length+s.discard.length+s.players.reduce((x,p)=>x+p.hand.length,0);
    if(total!==s.nextCardId) throw 'cards';
  }
  games++; maxSteps=Math.max(maxSteps,steps);
  const w=s.players.find(p=>p.id===s.winnerId); wins[w.level]++;
}
console.log('bot games',games,'max steps',maxSteps,'wins',wins);
