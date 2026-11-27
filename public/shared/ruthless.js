// Ondu Ruthless: the tougher card game on its own tab.
// The rules live in game.js (look for "Ondu Ruthless" there); this file only makes a room that plays by them,
// so the room server and Play vs computer can treat it as its own game.
import { newRoom as baseRoom } from './game.js';
export * from './game.js';
export const GAME = 'ruthless';
export function newRoom() {
  const s = baseRoom();
  s.game = GAME;
  s.settings.stacking = true;   // draw cards always stack here
  s.settings.wd4Fx = false;
  s.settings.roundTime = 5;     // minutes (the standard game's default is 3; these rounds run longer)
  return s;
}
