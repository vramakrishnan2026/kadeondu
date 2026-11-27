# Changelog

## 2026-11-10
- First version, "Ondu!": Cloudflare Worker + GameRoom Durable Object, multiplayer rooms by code, no player limit (a deck per 10 players), reconnects, scoring, host controls. Tested with a local Cloudflare stand-in and simulated games.
- Repo created and Cloudflare connected (Worker name `kadeondu`). Renamed to **Kade Ondu**; the call button stays **Ondu!**.
- Live **Open rooms** list (Lobby Durable Object, migration v2). Mid-round joiners **watch** and are dealt in next round.
- **Online now** and **invites** (pop-up with Join / Not now).
- Connection dot (green/amber/red). Fixed Cloudflare Git builds (reconnected the repo).
- **Computer players**: Play vs computer (solo, in the browser) and Add computer player (rooms), Easy/Normal. Engine moved to `public/shared/game.js`.
- **Round table** (seats in a circle), card flight animations, plainer cards with a new font.
- **Turn timer** (default 15 s) with a simple auto-move when time runs out.
- **Wild +4 effect** with Mani's photo. Then: +4 lands first and bots wait; centred on screen; spoken laugh replaced by an evil-laugh sound file (owner-supplied).
- New look: textured original cards (kolam star, thick italic numbers), richer background, wooden-rim table.
- workers.dev subdomain changed to `goarena`.
- Share panel (share to apps / WhatsApp / copy link), line icons, credits "Created by Vinay Ramakrishnan".
- Fixes: colour picker colours; everyone can close the round-over pop-up (plus Scores, and Next round in the bar).
- **Voice notes** (hold to talk, relayed, never stored), then iPhone fixes (sound unlock, MP4/AAC, kept-open mic, touch-hold, audio session), the temporary **voice test page**, the **Turn on voice notes** button and blocked-mic help.
- **Installable app** (manifest, icons, offline helper, Install button, iPhone steps).
- New **landing flow** (name first, Join a game first, one-tap join from links).
- Wild +4 animation became a room setting, **off by default**.
- Game screen **fits the phone** (no scrolling, seats inside the table area).
- **Thumb-friendly controls** (based on research), **left-handed mode**, **private rooms**. Then Draw made smaller twice and the mic moved to the far right.

## 2026-11-11
- **Sticker reactions** (owner's six stickers, cleaned and compressed): room setting, off by default. They float up the side of the screen with a trail, later spaced into lanes with more bubbles lasting about 3 s.

## 2026-11-12
- Tests moved into the repo (`tests/`), and full documentation written (`docs/`, `CLAUDE.md`).

## 2026-11-14
- **Round time limit**: new setting **End round after** (Off / 3 min / 5 min, off by default) for rooms and Play vs computer. When time runs out, the lowest card points in hand wins and scores as a normal win. Countdown under the discard pile.
- Round clock made a bold dark pill (it was faint grey text that got lost on the coloured table).
- **Join stats** for the owner: name, approximate city and time of each room join, kept 90 days, shown on the password-protected `/stats.html`. Home screen notice added. Needs the `STATS_KEY` secret.
- Round time limit now **defaults to 3 min** and offers 7 and 10 min as well.

## 2026-11-22 (later)
- **Ludo** is a real game on its tab: 2 to 4 players in a room (others watch), classic rules with five house-rule switches for the host, playing on for 2nd and 3rd place, computer players, play vs computer, turn timer, inactive-player removal, room chat, voice notes and emoji reactions. See [LUDO.md](LUDO.md).
- Each tab's home lists its own game's rooms; invites say which game. Rooms now carry which game they play.

## 2026-11-22
- **Game tabs on the home screen:** Kade Ondu, **Ludo** and **Ondu Ruthless** (a tougher version of this game). The two new games are not built yet: tapping either tab shows a **"Brewing…"** notice with a steaming coffee cup and a button back to Kade Ondu. Tabs and their names are set in `games` in `public/config.js`.

## 2026-11-16
- **Wild +4 photo effect switched off** and its setting hidden (owner's request). **Reactions are now ordinary emoji** (👍 😂 😮 😢 😡 😈 👏 🔥) instead of the photo stickers. The photo and laugh files are no longer downloaded or kept for offline use.

## 2026-11-15
- Fix: the round clock and the turn clock jumped back up whenever the screen was redrawn without new data (rotating the phone, closing a pop-up). They now count from when the data arrived.
- **Invites ring** (tone + buzz every 3 s, up to 30 s) until answered; the inviter is told when there is no answer.

## 2026-11-14 (later)
- **Inactive players:** after the timer has played 5 turns in a row for someone, any other player can remove them with the ✕ on their cards (asks to confirm).
- **Table redesign:** opponents shown as fans of face-down cards with the name underneath (no circles, no seat for yourself), scores under names once anyone has points, new card back (Kannada ೧ on an orange disc).
- **Buttons:** top row Catch! · Ondu! · Draw in three equal sizes; **Catch!** now has a fixed place and lights up red instead of popping up on a seat. Small buttons, your card count and the mic are on a second row.
- **Room chat:** pull-out drawer at the edge with a dot for new messages; players and watchers; last 200 messages kept with the room and wiped when it empties. Not in Play vs computer.
- **Table colour** follows the colour being played (red, yellow, green or blue) with a short fade, instead of always green.
- **Poker School** tab: Texas Hold'em at three levels the learner picks. 18 lessons with quizzes, 7 drills, practice vs computer with a coach and hand review, and practice tables with friends (2 to 6 seats, same reactions, voice notes, chat, watchers). Play chips only. New engine `public/shared/poker.js`; see [POKER.md](POKER.md). Game tab labels may now take two lines so four tabs fit a narrow phone. Service worker cache v8.
- **Phone Back button** no longer closes the app from inside it. Back closes an open pop-up or the chat, returns from a lesson or drill to Poker School, and in a room or game asks before leaving (and stays if the answer is no). From the plain home screen it closes the app as before. Why: the app is one page, so the phone had no earlier step to go back to. `app.js` now keeps one history entry while anything is open (see "The phone's Back button" there). Test: `tests/ui_back.py`. Cache v9.
- **Carrom** tab: 2 or 4 players or vs computer, classic or points rules (host chooses, classic by default), pull-back aiming, shots replayed on every phone from the server's result. New engine with physics `public/shared/carrom.js`, screen `public/carrom.js`; see [CARROM.md](CARROM.md). Cache v10.
- **Poker School: your plan and AI coach.** A "Next for you" suggestion, revision quiz from wrong answers, table habits counted against the coach's advice, coach warnings on the learner's usual slip, a level-up nudge, and an optional note written by Cloudflare Workers AI (free allowance, `ai` binding added to `wrangler.jsonc`, new route `/api/poker-coach`). See [POKER.md](POKER.md). Cache v11.
- **Poker: the coach stops a mistake.** A mistaken move is held with a "Hold on" pop-up (what you chose, what the coach would do, why) and can be taken back or played anyway. Setting in the vs computer set-up, on for clear mistakes by default. See [POKER.md](POKER.md). Cache v12.
- **Poker: time to think and questions to the AI coach.** Vs computer the next hand waits for the learner; friends' tables pause longer (15 s / 8 s) and the last hand stays reviewable. The hand review has an "Ask the AI coach" box that answers about this table session only (`/api/poker-ask`). Cache v13.
- **Ondu Ruthless** is live on its tab (was "Brewing"): must-play, draw until a card fits, stacking draw cards up to +10, seven swaps and zero passes hands, Skip All, Dump, Roulette, and out at 25 cards. A mode of `shared/game.js`; see [RUTHLESS.md](RUTHLESS.md). Cache v14.
- **Fix: coming back to a room gave a second seat ("Vinay 2", "Vinay 3").** Cause: pressing Leave (or the phone's Back button, which asks to leave) while the connection was down sent nothing to the room and wiped the phone's saved seat, so the old seat stayed behind and the next join was a new player. The Back button change of 22 Nov made this path much more common. Two changes: (1) Leave now reconnects, tells the room, then goes home; (2) each browser has a private seat key (`cardgame-seat`, sent with every join, stored on the player as `seatKey`, never sent to anyone), and the room gives the same browser its own seat back. Tests: `tests/ui_rejoin.py`, `tests/seatsim.mjs`. Cache v15.
- **Carrom: see the other player aim.** Their striker position, aim line and power show live on the other phones (relayed, never stored), and every shot that is not yours opens with a half-second look at its aim. Cache v16.
- **Carrom and Ludo: three real players can start.** A computer player takes the fourth seat when the host starts (Carrom: any three; Ludo: three real players). Cache v17.
- **No watching computers finish.** Ondu Ruthless: when every real player is knocked out, the round ends at once (lowest points in hand wins). Ludo: when every real player has finished, the game ends and the computer players are placed as they stand. Cache v18.
- **Carrom board sounds** with a switch beside the striker slider: coin, striker, cushion and pocket sounds made with Web Audio, off by default. Cache v19.
- **Carrom sounds remade** after the owner said they sounded like bamboo pipes: noise-based wooden clacks instead of ringing tones, less echo. Cache v20.
- **Carrom looks:** coins, striker and pockets drawn with depth (lit rim, shaded top, turned grooves, soft shadow; light from the top left). The frame's corners carry a brass inlay line and the Kade Ondu four-colour star. Cache v21.
