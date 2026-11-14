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
- **Inactive players:** after the timer has played 5 turns in a row for someone, any other player can remove them with the ✕ on their cards (asks to confirm).
- **Table redesign:** opponents shown as fans of face-down cards with the name underneath (no circles, no seat for yourself), scores under names once anyone has points, new card back (Kannada ೧ on an orange disc).
- **Buttons:** top row Catch! · Ondu! · Draw in three equal sizes; **Catch!** now has a fixed place and lights up red instead of popping up on a seat. Small buttons, your card count and the mic are on a second row.
- **Room chat:** pull-out drawer at the edge with a dot for new messages; players and watchers; last 200 messages kept with the room and wiped when it empties. Not in Play vs computer.
- **Table colour** follows the colour being played (red, yellow, green or blue) with a short fade, instead of always green.
