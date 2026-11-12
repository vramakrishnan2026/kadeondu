# Testing

Real Cloudflare can't run in a plain sandbox, so these tests use a **local stand-in**: `server.mjs` serves `public/` and drives the real `GameRoom`/`Lobby` classes from `src/worker.js` through a small mock (`mock/cf-mock.js`) with an in-memory store and a hand-written WebSocket server.

## Run the stand-in
```bash
cd tests
bash prepare-mock.sh          # copies the engine + worker into mock/ and starts http://localhost:8788
```
Restart it after changing `src/worker.js` or `public/shared/game.js`. Changes to other files in `public/` are picked up on page reload.

## Rule simulations (Node, no browser)
```bash
node sim.mjs        # 420 random games, 2–60 players, stacking on/off, joins/kicks, watchers; checks card counts and turn order
node botsim.mjs     # 1,800 computer-only games; Easy vs Normal win rates; no stuck games
node timersim.mjs   # everyone always lets the clock run out; checks auto-moves always move the turn on
```

## Browser tests (Python Playwright + Chromium, with the stand-in running)
| Script | Covers |
|---|---|
| `ui_test.py` | 4-player game to the end, reload rejoin, late joiner, leave, bad code |
| `ui_landing.py` | first visit, invited newcomer one-tap join, returning player invite card, change name |
| `ui_rooms.py` | open rooms list, watching mid-round, dealt in next round |
| `ui_invite.py` | Online now, invite/accept/decline, invite from home, invite mid-game |
| `ui_bots.py` | solo vs computer to the end, room with computer players |
| `ui_timer.py` | turn timer auto-moves (room and solo) |
| `ui_fx.py`, `ui_fx_off.py` | Wild +4 effect on (centred, sound loaded) and off by default |
| `ui_ring.py`, `ui_fit.py` | round table at 4/10/20 players; no scrolling at several screen sizes |
| `ui_controls.py` | private room hidden from the list; button sizes and positions for both hands |
| `ui_voice.py`, `ui_voice_touch.py`, `ui_micperm.py` | voice notes (mouse and touch hold), mute, mic allowed and blocked |
| `ui_react.py` | stickers off by default, tray, both phones see the float |
| `ui_endclose.py`, `ui_share.py`, `ui_install.py` | round-over close/reopen, share panel and copy, installability and iPhone steps |
| `ui_vtest.py` | the temporary voice test page (delete with that page) |

Some scripts import helpers from `ui_bots.py`, so keep them in the same folder. Screenshots and videos they write are git-ignored. Animated buttons need `click(force=True)`. Timing-based tests can occasionally flake; re-run before investigating.

Voice tests launch Chromium with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`. **None of this proves iPhone behaviour**: test on real phones (see `docs/OPEN-ITEMS.md`).
