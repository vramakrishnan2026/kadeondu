# Briefing for an AI assistant working on Kade Ondu

Read `README.md` and the `docs/` folder first. This file covers how to work on the project.

## The owner
- **Vinay Ramakrishnan** (GitHub `vramakrishnan2026`). Credits on the home screen say "Created by Vinay Ramakrishnan".
- Often tests on an Android phone (Brave, installed app) with friends on iPhones (Safari, Brave). Often works from the phone, so give phone-friendly, step-by-step instructions.
- Preferences: if a request or source material is ambiguous, ask before building. Explain the reasoning behind fixes, especially when a fix is for a mistake.
- Gives quick, short feedback ("pathetic", "boring", "bunched up"). Respond with a concrete, visible change and a screenshot or short video.

## Rules
1. **Original artwork only.** Never copy UNO/Mattel card designs, logos or naming, even if asked "with a different font". Decline in one line and offer an original alternative. (See `docs/DESIGN.md`.)
2. **New toggles default to off** unless the owner says otherwise (emoji reactions and private rooms are off by default; the custom Wild +4 effect is switched off entirely in `config.js`; the round time limit defaults to 3 min because the owner asked for that).
3. **The game screen must fit the phone with no scrolling.** Check with `tests/ui_fit.py` after layout changes (and `tests/ui_ludo.py` for the Ludo board, `tests/ui_poker.py` for the poker table, `tests/ui_carrom.py` for the carrom board).
4. **Controls (card game):** two rows. Top: `Catch! · Ondu! · Draw` (three equal buttons, each always in the same place; Draw is the main one). Bottom: `😄 🔈 … card count … 🎙` (mic at the far end). Left-handed mirrors both rows. Tap targets of 48 px or more. Ludo uses the same bottom row (it is the same element, moved under the board) with the die and one **Roll** button above it.
4a. **Poker School is play chips only.** Never add real money, buying chips, prizes or links to gambling sites. Coach hints at a friends' table default to off. The AI gets numbers and lesson titles for the coach's note, and for session questions the hands of that table session plus one typed question (cut to 200 characters). Never names: other players are "Opponent A". It must stay inside Cloudflare's free AI allowance (see `docs/POKER.md`).
5. Voice notes and emoji reactions are **relayed, never stored**. Keep it that way. Room chat is the one exception: the last 200 messages are kept with the room and wiped when it empties (see `docs/FEATURES.md`).
6. Don't edit existing Durable Object migrations in `wrangler.jsonc`; only append. Don't rename the Worker (`kadeondu`); the GitHub auto-deploy is tied to it.
7. When adding assets that should work offline, add them to `SHELL` in `public/sw.js` and bump `CACHE`.

## Workflow
- Edit, run the stand-in plus the relevant tests (`tests/README.md`), look at a screenshot for anything visual, then commit and push to `main`. Cloudflare deploys in about 30 seconds.
- Commit author: `vramakrishnan2026 <noreply@users.noreply.github.com>`.
- After pushing, tell the owner to close and reopen the game (or the installed app) to get the new version.
- Things only the owner can do: the Cloudflare dashboard (Gmail account), GoDaddy, GitHub app permissions, and testing on real iPhones.

## Where to change things
| Change | File |
|---|---|
| Game name / call word / colours / reaction emoji / Wild +4 effect on-off / game tabs on the home screen (`games`) | `public/config.js` (+ `manifest.webmanifest` for the installed app name) |
| Rules, computer players, turn timer, settings defaults | `public/shared/game.js` (card game), `public/shared/ludo.js` (Ludo; see `docs/LUDO.md`), `public/shared/poker.js` (poker; see `docs/POKER.md`) |
| Carrom rules and physics / board on screen (see `docs/CARROM.md`) | `public/shared/carrom.js` / `public/carrom.js` |
| Poker School lessons and quizzes / screens | `public/poker-learn.js` / `public/poker.js` |
| Server: rooms, relays, lobby, presence, invites | `src/worker.js` |
| Screens and markup | `public/index.html` |
| Behaviour in the browser | `public/app.js` |
| Look | `public/style.css` (later rules override earlier ones; the file grew by appending, so search for the class) |
