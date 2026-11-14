# Architecture

One Cloudflare **Worker** (`src/worker.js`) serves everything:

```
Phone browser ──HTTPS──▶ Worker static assets (public/*)            free, unlimited
              ──WSS /ws?room=CODE──▶ GameRoom Durable Object (one per room code)
              ──WSS /lobby────────▶ Lobby Durable Object (single instance, "main")
GameRoom ──RPC update(summary)──▶ Lobby   (only when the room's summary changes)
```

- **Static assets:** `wrangler.jsonc` → `"assets": { "directory": "./public" }`. Any path without a matching file reaches the Worker's `fetch`, which handles only `/ws` and `/lobby` (404 otherwise).
- **Durable Objects:** SQLite-backed, as the free plan requires. Migrations are `v1` (GameRoom) and `v2` (Lobby). **Never edit existing migration entries; only append new ones.**
- **WebSocket Hibernation API** (`ctx.acceptWebSocket`). Socket attachments (`serializeAttachment`) hold `{ pid }` for rooms and `{ cid, name, room }` for the lobby. Keep-alive is the literal `"ping"`, answered with `"pong"` by `setWebSocketAutoResponse`, which is free and doesn't wake the object.

## GameRoom (one per room code)

- **State:** `this.room` (the full game object from `game.js`), saved with `ctx.storage.put('room', …)` after every change. `ctx.storage.put('code', …)` is set on first connect (taken from `?room=`).
- **Cleanup:** `storage.setAlarm(now + 24 h)` on every save. `alarm()` wipes the room if no sockets are connected.
- **Broadcast:** after each change, every socket gets a **personalised** view, `G.viewFor(room, pid, onlineSet)`. A player sees only their own hand; everyone else's hand is a card count.
- **Timers** (only while at least one person is connected):
  - `kickBots()` → `setTimeout(nextBotAction.delay)` → `botTick()` plays computer turns.
  - `armTurnTimer()` → fires at `room.deadline` → `G.timeoutMove()`. Messages also check for overdue deadlines, which covers restarts that lost the timer. **Join log:** the front door puts Cloudflare's rough location (`request.cf` city/region/country) in an `x-geo` header; the room keeps it on the socket and, when a new player is added (not a reconnect), calls `Lobby.logJoin()`, which stores one `j:<time>:<rand>` entry in the Lobby's storage (deleted after 90 days). `/api/stats` (header `x-stats-key` must equal the `STATS_KEY` secret, 12+ characters) returns the latest 5,000; `public/stats.html` does the totals in the browser. The same timer also fires at `room.roundEndsAt` (round time limit) → `G.roundTimeUp()`.
  - `afterChange()` calls both.
- **Room chat (stored with the room):** `chat` `{text}` from any player or watcher → cleaned (control characters out, 200 chars, 1 s gap per person) and appended to `this.chat` (last 200, saved under the storage key `chat`), then sent to every socket as `{t:'chat', m:{id, at, from, name, text, w?}}`. On join the socket gets `{t:'chatlog', list}`. Wiped by `wipeChat()` when no person is left in the room, when nobody has been connected for 5 minutes (`chatEmptyAt` + the object's alarm, also checked on the next join), and by the 24 h idle clean-up. Chat is not part of the game state (`viewFor`).
- **Inactive players:** `timeoutMove()` counts `player.idle` (turns in a row the timer played for them; a `play` / `draw` / `pass` of their own resets it). At `IDLE_KICK` (5) `viewFor` sets `idleOut` on them and any player (not a watcher) may send `kickidle` `{target}`, which removes them like a host kick (log entry `idle`).
- **Relays (never stored):** `voice` (max 300,000 chars of data URL, `data:audio/*;base64,`, 2.5 s gap per player) and `react` (sticker id from a fixed list, only when `settings.reactions` is on, 1.2 s gap).
- **report():** sends `G.summary(room, code, onlineCount)` to the Lobby whenever it changes.

## Lobby (single instance)

- `rooms` map, saved to storage: `{ code, host, players, watching, phase, online, private, at }`. `list()` hides rooms with nobody online and **private rooms**, and drops entries older than 6 h. It returns at most 100.
- **Presence** comes from socket attachments: `people()` gives one entry per device id (`cid`) with a typed name. Private rooms are masked as `room: 'PRIVATE', private: true` with no host. It returns at most 200.
- **Invites:** checks the inviter is in a room and the target is online and not in a room, with a 10 s gap per inviter→target pair. Forwards `invited`; a decline forwards `declined`.

## Message protocol

### Browser → GameRoom (`/ws?room=CODE`)
| `t` | Fields | Notes |
|---|---|---|
| `join` | `name, playerId?, token?, create?, joinOnly?` | Reconnect when the id and token match. `create` on an occupied room gets error `taken`; `joinOnly` on an empty room gets error `noroom` |
| `settings` | any of `stacking, handSize, botLevel, turnTime, wd4Fx, private, reactions` | host only, not mid-round |
| `start` | | host. Starts or restarts a round |
| `play` | `cardId, color?` | `color` for wilds: `r`/`y`/`g`/`b` |
| `draw` / `pass` | | `pass` only after drawing |
| `ondu` | | the call |
| `catch` | `target` | |
| `kick` | `target` | host |
| `leave` | | |
| `skipturn` | | host; the skipped player takes any pending penalty |
| `addbot` | | host, between rounds |
| `rename` | `name` | |
| `voice` | `data` (audio data URL) | relayed |
| `react` | `id` | relayed |

### GameRoom → browser
`welcome {playerId, token, name}` · `state {…view}` · `error {msg, code?}` · `kicked` · `replaced` (opened in another tab) · `voice {from, name, data}` · `react {from, name, id}`

The `state` view includes `you, phase (lobby|playing|ended), round, hostId, settings, players[{id,name,count,score,online,bot}], hand, playable[ids], top, color, dir, turnId, pendingDraw, drawnCardId, vulnerable, canCall, saidOndu, spectating, spectators[], deckCount, deadlineIn (ms), roundEndsIn (ms), lastRound, log[last 15]`.

Log entries are `{n, k, p, …}` where `k` is one of `join, watch, leave, kick, start, play, draw, pass, call, catch, win, reshuffle, newdeck, skipped, toofew, timeout`. The browser turns them into text (`logText` in `app.js`), so the call word comes from `config.js`.

### Browser ↔ Lobby (`/lobby`)
- Browser → `hello {cid, name, room}` (sent on connect, name change, joining or leaving a room) · `invite {to}` · `decline {to}`
- Lobby → `rooms {rooms}` · `people {people}` · `invited {fromId, from, room, roomHost, phase}` · `invite-sent {to}` · `declined {from}` · `error {msg}`

## Rules engine (`public/shared/game.js`)

Pure functions with no Cloudflare APIs. It's used by the Worker and loaded in the browser with `import()` for solo games.

Key exports: `newRoom, addPlayer(s, name, {bot, level}), removePlayer, startRound, handle(s, pid, msg)` (wraps `handleInner` and then `refreshDeadline`), `canPlay, viewFor, summary, botMove, nextBotAction, botName, refreshDeadline, timeoutMove, TURN_TIMES, MAX_BOTS`.

Notable fields: `turnNo` (goes up whenever the turn moves; used for deadlines), `deadline`/`deadlineFor`, `roundEndsAt` (round time limit, set in `startRound`), `wd4Turn` (lets bots wait out the +4 animation), `spectators[]` (merged into `players` when a round ends), `nextCardId` (card ids stay unique when extra decks are opened).

## Browser (`public/app.js`)

One IIFE. The main parts:
- **Connections:** `connect(code, intent)` for the room socket, with exponential-backoff reconnect. `openLobby()` keeps the lobby socket open all the time.
- **Screens:** `show('home'|'lobby'|'game')`. The `in-game` class on `<body>` makes the game screen fit the viewport.
- **`render(state)`:** draws the waiting area or the table (opponents' fans on an ellipse sized from the ring's pixel size; no seat for the viewer unless they are watching), status, controls, hand, round-over pop-up, and runs `animateEvents` for new log entries.
- **Solo mode:** `solo = { G, s, me, timer, tt }`. `send()` goes to `soloSend`, which calls `G.handle` locally, with bot and turn timers in the browser.
- **Features:** voice (MediaRecorder, persistent mic stream, `audioSession`, unlock on first tap, Web Audio fallback), stickers (`showReaction`/`floatUp`), Wild +4 effect (`showDrawFour`), turn clock ring (`tickClock`, 250 ms), share panel, install prompt, microphone permission helper.
- **localStorage keys:** `cardgame-session` (room, playerId, token), `cardgame-name`, `cardgame-cid` (device id for presence), `cardgame-voice-muted`, `cardgame-lefty`.

## Offline helper (`public/sw.js`)

Network-first: online players always get the latest version, and the cache is only a fallback. **Bump `CACHE` (e.g. `kade-ondu-v5`) and add new asset paths to `SHELL` when you add files** that should work offline.
