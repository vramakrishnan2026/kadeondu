# Briefing for an AI assistant working on Kade Ondu

Read `README.md` and the `docs/` folder first. This file covers how to work on the project.

## The owner
- **Vinay Ramakrishnan** (GitHub `vramakrishnan2026`). Credits on the home screen say "Created by Vinay Ramakrishnan".
- Often tests on an Android phone (Brave, installed app) with friends on iPhones (Safari, Brave). Often works from the phone, so give phone-friendly, step-by-step instructions.
- Preferences: if a request or source material is ambiguous, ask before building. Explain the reasoning behind fixes, especially when a fix is for a mistake.
- Gives quick, short feedback ("pathetic", "boring", "bunched up"). Respond with a concrete, visible change and a screenshot or short video.

## Rules
1. **Original artwork only.** Never copy UNO/Mattel card designs, logos or naming, even if asked "with a different font". Decline in one line and offer an original alternative. (See `docs/DESIGN.md`.)
2. **New toggles default to off** unless the owner says otherwise (Wild +4 effect, stickers and private rooms are all off by default).
3. **The game screen must fit the phone with no scrolling.** Check with `tests/ui_fit.py` after layout changes.
4. **Controls:** keep the order `😄 🔈 … Ondu! · Draw · 🎙` (mic at the far right, mirrored for left-handed), with tap targets of 48 px or more.
5. Voice notes and stickers are **relayed, never stored**. Keep it that way.
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
| Game name / call word / colours / sticker captions / Wild +4 effect | `public/config.js` (+ `manifest.webmanifest` for the installed app name) |
| Rules, computer players, turn timer, settings defaults | `public/shared/game.js` |
| Server: rooms, relays, lobby, presence, invites | `src/worker.js` |
| Screens and markup | `public/index.html` |
| Behaviour in the browser | `public/app.js` |
| Look | `public/style.css` (later rules override earlier ones; the file grew by appending, so search for the class) |
