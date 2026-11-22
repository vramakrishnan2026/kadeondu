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
node idlesim.mjs    # inactive players: 5 timer-played turns in a row, who may remove them, own move resets the count
node chatsim.mjs    # room chat on the server: who can post, cleaning, last-200 limit, wipe rules (run prepare-mock.sh once first)
node statssim.mjs   # join stats: password check, join log, 90-day clean-up, location hand-off (run prepare-mock.sh once first)
node carromsim.mjs  # Carrom: physics, every rule as a set piece, 96 computer-only games
node pokersim.mjs   # Poker: hand reading, coach, side pots, 6,000 random hands with chip conservation
node ludosim.mjs    # Ludo: 576 computer-only games over every mix of house rules, plus set pieces for each rule
node roundsim.mjs   # round time limit (3 / 5 min): lowest card points wins, ties, scoring, late moves, off by default
```

## Browser tests (Python Playwright + Chromium, with the stand-in running)
| Script | Covers |
|---|---|
| `ui_test.py` | 4-player game to the end, reload rejoin, late joiner, leave, bad code |
| `ui_landing.py` | first visit, invited newcomer one-tap join, returning player invite card, change name |
| `ui_tabs.py` | game tabs on the home screen: Ludo has its own home; Ondu Ruthless shows "Brewing…" with the steaming cup; back to the game by button or tab; tabs fit a 320 px phone; invite links open on the game |
| `ui_ludo.py` | Ludo in a room: settings, rolling, choosing a token, capture, reactions, chat, a watcher, finishing, playing again, fit at five screen sizes, turn timer, left-handed, vs computer (uses the stand-in's `/__test/die` and `/__test/ludo`) |
| `ui_carrom.py` | Carrom: tab, vs computer with pull-back aiming, a room with shot replay, queen, win, doubles, fit at five screen sizes |
| `ui_poker_plan.py` | Poker School's plan: next step, revision quiz, AI note with a pretend AI, habits, coach nudge, level up |
| `ui_poker_guard.py` | Poker: the coach stops a mistaken move; take it back or play it anyway; each setting |
| `ui_poker_ask.py` | Poker: hands wait vs computer; questions to the AI coach about the session; review stays open |
| `ui_poker.py` | Poker School: home tab and levels, a lesson and quiz, every drill, vs computer with coach and review, a friends' table, fit at five screen sizes |
| `ui_back.py` | the phone's Back button: pop-ups, chat, lessons, asking before leaving a room, leaving the app only from home |
| `ui_ludo_voice.py` | voice notes and reactions on the Ludo screen; the buttons row returns to the card game afterwards |
| `ui_rooms.py` | open rooms list, watching mid-round, dealt in next round |
| `ui_invite.py` | Online now, invite/accept/decline, invite from home, invite mid-game |
| `ui_bots.py` | solo vs computer to the end, room with computer players |
| `ui_timer.py` | turn timer auto-moves (room and solo) |
| `ui_table.py` | fans instead of circles, no own seat, scores under names, own card count, fixed Catch! button, button rows, left-handed |
| `ui_invite.py` | invites ring every 3 s for up to 30 s, stop on Join / Not now, inviter told when there is no answer |
| `ui_idle.py` | inactive player: ✕ after 5 missed turns (players only), confirm, removal, rejoin by link |
| `ui_chat.py` | room chat: edge tab and dot, drawer, watchers, history for late joiners, refresh, wipe after 5 min empty, none in Play vs computer |
| `ui_stats.py` | join stats: joins logged with name + city, reconnects not counted, stats page needs the password, home notice |
| `ui_roundtime.py` | round time limit: setting, countdown, time-up result (room, via the stand-in's `/__test/roundends` shortcut) and solo |
| `ui_fx_off.py` | Wild +4 effect switched off: no setting shown, nothing plays, photo / laugh / sticker files never downloaded. (`ui_fx.py`, which tested the effect when on, was removed; it is in the git history if the effect comes back) |
| `ui_tablecolor.py` | table felt matches the colour being played (solo game, all four colours when they come up) |
| `ui_ring.py`, `ui_fit.py` | round table at 4/10/20 players; no scrolling at several screen sizes |
| `ui_controls.py` | private room hidden from the list; button sizes and positions for both hands |
| `ui_voice.py`, `ui_voice_touch.py`, `ui_micperm.py` | voice notes (mouse and touch hold), mute, mic allowed and blocked |
| `ui_react.py` | emoji reactions off by default, tray of 8 emoji, both phones see the float |
| `ui_endclose.py`, `ui_share.py`, `ui_install.py` | round-over close/reopen, share panel and copy, installability and iPhone steps |
| `ui_vtest.py` | the temporary voice test page (delete with that page) |

Some scripts import helpers from `ui_bots.py`, so keep them in the same folder. Screenshots and videos they write are git-ignored. Animated buttons need `click(force=True)`. Timing-based tests can occasionally flake; re-run before investigating.

Voice tests launch Chromium with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`. **None of this proves iPhone behaviour**: test on real phones (see `docs/OPEN-ITEMS.md`).
