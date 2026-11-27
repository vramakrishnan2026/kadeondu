# Ludo

The second game in the app (Nov 2026). It lives on the **Ludo** tab of the home screen and uses the same rooms, links, invites, watchers, room chat, voice notes and emoji reactions as Kade Ondu.

## What the owner asked for
- "Build the game out similar to Ondu, with scope for improvements and enhancements", a polished multiplayer screen, and "the same emoticons and voice note features".
- Asked before building, the owner chose:
  - **Rules: the host chooses.** Classic by default, with switches in the waiting room.
  - **Play on for places:** the first player with all four tokens home wins; the others keep playing for 2nd and 3rd.
  - **Also in the first version:** play vs computer, the turn timer, room chat, watchers and invites.

## Playing
- **2 to 4 players**, 4 tokens each. Two players sit opposite each other. A fifth person (or anyone who joins mid-game) **watches**, and takes a seat when one is free and no game is running.
- Your own colour is always **bottom left** on your phone. Name plates sit in the corners next to each yard: colour, name, four dots for tokens home, 🏆 for games won in this room.
- **Roll** is the one big button. If there is only one possible move (or every choice is the same move), the game makes it. Otherwise the tokens that can move bounce, and you tap one. A tap near a token counts, so small tokens are easy to hit.
- Rolls, hops, captures and arrivals are shown one after another. The status line and the buttons wait until the board has caught up.

## Rules (in `public/shared/ludo.js`)
- A token comes out of the yard on a **6**. A **6 rolls again**.
- Tokens move clockwise round the 52-square loop, then up their own colour's column of 5 squares, then home. Home needs the **exact** roll.
- Landing on another colour's token **sends it back** to its yard. Not on the 8 **safe squares**: the four start squares and the four star squares.
- When someone finishes they take the next place and are skipped. The game ends when only one player is left on the board.

### House rules (host, between games)
| Setting | Default | What it does |
|---|---|---|
| A 1 also brings a token out | off | classic: only a 6 |
| Capturing gives another roll | on | |
| Getting a token home gives another roll | on | |
| Three 6s in a row lose the turn | on | the third 6 is not played |
| Two tokens on a square form a block | off | other colours can't land on it or pass it |

Shared with the card game: time per turn (default 15 s), computer level, 😄 reactions (off), 🔒 private room (off).
The defaults are the owner's "Classic" choice, which is why some are on (the usual rule is that new switches start off).

## Timer, inactive players, computer players
- **Turn timer:** every roll and every choice gets the full time. When it runs out the game rolls, and picks a sensible token if there was a choice. Five timed-out turns in a row and the others can remove that player (✕ on their name plate), as in the card game.
- **Computer players** (up to 3): *Easy* moves any token. *Normal* prefers, in order: capture, get home, bring a token out, reach safety, run from danger, then push the leading token.
- **Play vs computer:** the Ludo tab's "Vs computer" tile. Runs entirely on the phone, like the card game's.

## How it is built
- `public/shared/ludo.js` is a second rules engine with the **same function names** as `game.js` (`newRoom, addPlayer, handle, viewFor, summary, nextBotAction, timeoutMove, …`). A room's state carries `game: 'ludo'`; `src/worker.js` picks the engine with `E(room)`. Rooms made before this have no `game` and are card-game rooms.
- The first person into a room decides its game: the `join` message carries `game: 'ludo'` when the room is created from the Ludo tab. Joining by link, code, list or invite needs nothing extra.
- The room list entry and invites carry `game`, so each tab lists its own rooms and an invite says which game it is.
- **Messages (browser → room):** `roll` · `move {token: 0–3}` · plus the shared ones (`settings, start, addbot, kick, kickidle, skipturn, rename, leave, voice, react, chat`).
- **State view:** `game, phase, round, hostId, settings, players[{id, name, seat, tokens[4], place, wins, online, bot, idleOut}], spectating, spectators, turnId, step ('roll'|'move'), dice, sixes, movable[], deadlineIn, lastRound {winnerId, places[]}, log`.
- **Token position** is its progress: `-1` yard, `0–50` on the loop counted from that seat's start square, `51–55` home column, `56` home.
- **Log entries:** `lstart, roll, lmove {c, i, from, to, d, cap?, home?}, nomove, three6, done, lend` (plus the shared `join, watch, leave, kick, idle, skipped, toofew, timeout`). The screen replays `roll` and `lmove` as animations.
- `animMs` on the room is how long the last change takes to show; computer players and the turn clock wait that long.
- **Screen:** `#ludo` in `index.html`; the board is an SVG drawn by `ludoBuild()` in `app.js` (rotated so your yard is bottom left), tokens are buttons laid over it. The small-buttons row (😄 🔈 … 🎙) is the card game's own row, moved under the board by `show()`.
- **Artwork is original:** plain shapes in the app's four colours. Nothing is taken from any commercial board.

## Tests
- `tests/ludosim.mjs`: 576 computer-only games across every mix of house rules and 2–4 players (with people leaving mid-game), plus set pieces for each rule.
- `tests/ui_ludo.py`: a room from the Ludo tab, settings, rolling, choosing, capture, reactions, chat, a watcher, finishing, playing again, screen fit at five sizes, the turn timer, left-handed, and vs computer.
- `tests/ui_ludo_voice.py`: voice notes and reactions on the Ludo screen, and the buttons row going back to the card game.
- The stand-in has two shortcuts for these: `/__test/die?room=&seq=6,3` (fix that room's next rolls) and `/__test/ludo?room=&name=&tokens=a,b,c,d`.

## Ideas for later (not built)
- Team play (2 v 2), a quick mode with fewer tokens, sounds for the dice and captures.
- A fifth and sixth player would need a different board.
- Kade Ondu's game name is still shown in the top bar while playing Ludo.

## Three real players (added 27 Nov 2026)

When the host starts with exactly three real players, a computer player takes the fourth seat (the owner asked for this, as in Carrom). The Start button says "3 players + 1 computer". If a computer player is already one of the three, the host chose a three-player game and nothing is added. Three people without a computer player is currently not possible in a room: a switch can be added if the owner wants one (`settings.noFill` exists in the engine but has no control on screen).
