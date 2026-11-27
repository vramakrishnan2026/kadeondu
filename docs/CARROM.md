# Carrom

A tab for Carrom: flick the striker, pocket the coins. Built 22 Nov 2026.

## What the owner asked for
- 2 or 4 players, plus play vs computer.
- Host chooses the rules (classic by default).
- Full game built, then deployed.

## How it plays
- **Seats:** bottom, right, top, left. Two players sit opposite each other. With four, the player opposite you is your partner (classic rules). Everyone sees the board turned so that they sit at the bottom.
- **Shooting:** slide the striker along your baseline with the slider, then pull back anywhere on the board (like a catapult) and let go. The dotted line shows the direction, the bar shows the power. Shots must go forward.
- **With 3 players the host can still start:** a computer player takes the fourth seat (added 27 Nov 2026, at the owner's request). The Start button says so.
- **A game is played by exactly 2 or 4.** If someone leaves mid-board, the board ends and everyone returns to the waiting room.
- A turn that times out is simply missed.

### Classic rules (default)
- White breaks. Each side pockets its own colour (9 coins each).
- Pocket your own coin: shoot again. Pocket the other side's coin: it stays down for them and your turn ends.
- **Queen:** pocket her, then pocket one of your own coins in the same or the next shot to cover her. If not covered she returns to the centre.
- **Foul** (striker in a pocket): your coins from that shot come back plus one more as a penalty; the queen comes back if she was just pocketed or waiting for cover. Turn ends.
- Nobody can finish before the queen is covered: a last coin pocketed too early comes back.
- First side to clear its coins wins the board. Points shown: the other side's coins left, plus 3 if the winners covered the queen.

### Points rules
- Any coin counts: black 10, white 20, queen 50 (when covered by any coin). Everyone scores for themselves, also with four players.
- Pocket anything: shoot again. Foul: coins from that shot come back and you lose 10 points.
- The board ends when all coins are down; highest score wins.

Not included: dues carried over when you have no coin to return, playing several boards to 25 points, thumb/scissor shot rules.

## How it is built
| Part | Where |
|---|---|
| Rules, physics, computer players | `public/shared/carrom.js` |
| Board drawing (canvas), aiming, shot replay, plates | `public/carrom.js` |
| Markup, set-up pop-up, result pop-up | `public/index.html` (`#carrom`, `#carromSoloModal`, `#crEnd`) |
| Look | end of `public/style.css` (`.cr-*`) |

- **Physics:** circles on a 100 × 100 board, 120 steps a second, friction, cushions, collisions with a heavier striker. Only + − × ÷ √ are used, so the phone's replay follows the server's path. Tunable numbers are at the top of `shared/carrom.js` (`FRICTION`, `WALL_BOUNCE`, `HIT_BOUNCE`, `POCKET_R`, `V_MAX`).
- **A shot:** the phone sends `{ t: 'shot', pos, vx, vy }`. The server simulates it to the end, applies the rules, and logs the shot with the board before it. Every phone replays that shot, then shows the server's board. The server's result always wins.
- **Computer players** line up striker, coin and pocket, pick the straightest clear line, and use just enough pace so the striker does not follow the coin in. Easy wobbles a lot, Normal a little. They do not simulate shots ahead (kept light for the server).

## Watching the other player aim (added 27 Nov 2026)
The owner asked to see how the opponent places the striker and the angle they aim.

- While someone takes their turn, their phone sends the striker position, aim direction and power a few times a second (`shareAim` in `public/carrom.js`, message `aim`). The server passes it to the other phones in the room (`relayAim` in `src/worker.js`) and stores nothing, like reactions.
- The other phones draw the striker where it is, with a yellow dotted aim line and the power bar. The update goes stale after 6 seconds and is cleared on a new turn.
- Only the player whose turn it is can send it, and at most about a dozen updates a second are passed on.
- Before any shot that is not yours is replayed, the board holds for about half a second on the striker and its aim line. This is what shows a computer player's aim, since it has no phone to send updates from.
- Not shown vs computer on your own phone beyond that half-second look (the computer decides in one go).

## Board sounds (added 28 Nov 2026)
The owner asked for premium-sounding coin sounds with a switch on the board screen.

- Four sounds, made in the browser with the Web Audio API (no sound files, so nothing to license or download): coin on coin, striker on coin, a cushion knock, and the drop into a pocket. Harder hits are louder, each knock is pitched very slightly differently, and a short room echo is mixed in. See "Sound" at the top of `public/carrom.js`; the pitches, lengths and levels are in `play()`.
- The physics notes each knock in `sim.events` when the caller asks for it (the phone does, the server does not), so sounds follow the replay exactly.
- The 🔇 / 🔊 button beside the striker slider turns them on and off. The choice is kept on the phone (`ko-carrom-sound`).
- **Off by default** (rule 2 in `CLAUDE.md`). Turning it on plays one knock so you hear it.
- Browsers only start sound after a tap, so with sound on from an earlier visit the first shot may be silent until the board or slider has been touched.
- **Owner's feedback, 28 Nov:** the first version "sounded like bamboo pipes". Cause: each knock was built from pure tones that rang on, and a clear lingering pitch is what a hollow tube sounds like. Solid wood has almost no pitch, so the knocks are now shaped noise only (a 6 ms crack and a 20 to 45 ms dull body), with a lower thud for the striker and much less echo. Keep tones out of the coin sounds.
- **Still not judged by ear by the builder:** they were written and tested for timing, not by ear. The owner should judge them on a phone.

## Tests
- `node tests/carromsim.mjs`: physics (repeatable, stays on the board), every rule as a set piece, 96 whole games between computer players.
- `python3 tests/ui_carrom_sound.py`: the sound switch (default off, on, remembered, off) and that knocks are scheduled during a shot. It cannot judge how they sound.
- `python3 tests/ui_carrom.py`: tab, vs computer with real pull-back aiming, a room (replay on both phones, queen, cover, win), doubles with points rules, fit at five screen sizes.
- Stand-in shortcut: `/__test/carrom?room=CODE&coins=id:x:y,…&queen=covered:w`.

## To check on real phones
The feel of the pull-back aiming and the power range, on the Android phone and the friends' iPhones. This has only been run in desktop Chromium.
