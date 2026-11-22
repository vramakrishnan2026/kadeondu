# Open items and known issues

## To finish
1. **Remove the temporary voice test page** once voice notes are confirmed working on the friends' iPhones:
   - delete `public/voicetest.html`
   - in `public/index.html`, delete the `<!-- TEMPORARY: voice test link … -->` comment and the `<a class="voicetest-link">` line after it
   - in `public/style.css`, delete the `.voicetest-link` rule (under "TEMPORARY voice test link")
   - delete `tests/ui_vtest.py`
2. **Verify voice notes on real iPhones** (only tested in desktop Chromium plus touch emulation):
   - Android Brave (owner's phone, installed app): mic, AAC recording, playback and sending all **work** (test report 2026-11-10).
   - iPhone Safari (friend): **hearing works**. Sending was fixed afterwards (mic kept open, touch-hold handling, larger size limit, `audioSession = 'play-and-record'`) but **not yet re-confirmed**.
   - iPhone Brave (friend): worked after **manually enabling the mic** (Brave Shields / iOS Settings → Brave → Microphone). The game now explains this when the mic is blocked.
3. **Custom domain `ondu.goarena.in`:** pending. The domain is in another Cloudflare account; see [DEPLOYMENT.md](DEPLOYMENT.md).
4. **Mani photo looking straight:** needs a front-facing photo from the owner (replace `public/fx/mani.webp`, about 640 px wide, soft-edged PNG/WebP).
5. **Photos still in the repo:** the Wild +4 photo, the laugh sound and the six photo stickers (`public/fx/mani.webp`, `public/fx/evil-laugh.mp3`, `public/fx/reactions/`) are no longer used or downloaded by the game (Nov 2026), but the files are still in the public repo and reachable by direct link. Deleting them is the owner's call.

6. **Stats password:** the owner must add the `STATS_KEY` secret in Cloudflare before `/stats.html` shows anything (steps in [DEPLOYMENT.md](DEPLOYMENT.md)). Joins are logged from the moment the feature is deployed, with or without the password.

7. **One game still to build behind the tabs** (Ludo was built on 22 Nov 2026, see [LUDO.md](LUDO.md)):
   - **Ludo on real phones:** only tested in desktop Chromium at phone sizes. The owner should try it on the Android phone and the friends' iPhones (board size, tapping tokens, voice notes).
   - **Ondu Ruthless:** the owner asked for an equivalent of a tougher commercial edition of this kind of game. Rules, artwork and name must be original (see `DESIGN.md` and rule 1 in `CLAUDE.md`). "Ondu Ruthless" is a working name chosen by the assistant; **the owner has not confirmed it**.
   - Until it is built its tab shows the "Brewing…" notice. To open it, build the game and set `ready: true` for it in `games` in `public/config.js`. Ask the owner about rules and layout before building.

## Known limitations
- A website can't re-open the microphone pop-up after the user has blocked it. The game shows per-browser steps instead.
- Older iPhones may not play some formats. Recording prefers MP4/AAC to avoid this.
- iPhones show an orange mic dot while in a room after voice notes are turned on (the mic is kept open so Safari doesn't prompt on every hold). It closes when the player leaves or locks the phone.
- "Online now" is not real sign-in: any typed name, and duplicates are possible. Room codes are 4 characters (about 920k), so a private room is hidden but not locked.
- Free-plan Durable Object time is the most likely limit under heavy use (see DEPLOYMENT.md). Possible improvement: make rooms rest after a period with no moves.
- Browser tests occasionally flake on timing (re-running passes).

## Ideas raised but not built
- Real sign-in (e.g. Google) and a friends list that remembers people.
- QR code for room links.
- Lock a room (no new joins).
- Bots sending sticker reactions.

## Poker School (22 Nov 2026)
- **Not tried on real phones.** Check the table, the raise slider and the lesson cards on the Android phone and the friends' iPhones.
- **To confirm with the owner:** the tab name "Poker School"; progress kept on the phone only; a busted player getting a fresh stack automatically.
- Ideas: tournament mode, more lessons, Teen Patti or Omaha.

## Carrom (22 Nov 2026)
- **Not tried on real phones.** The feel of aiming and the power range need the owner's judgement.
- Ideas: boards played to 25 points, dues, stronger computer player, sounds.
- **AI coach's note not yet seen live.** After deploy, the owner should tap "✨ AI coach's note" in Poker School and check the wording reads well. Usage shows in the Cloudflare dashboard under Workers AI.
