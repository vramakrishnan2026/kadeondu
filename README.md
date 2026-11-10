# Kade Ondu — multiplayer last-card game on Cloudflare

Everyone opens one link on their phone, one person creates a room, the rest join with the 4-letter code.
No player limit: an extra deck is added automatically for every 10 players.

## What's in this folder

| File | What it does |
|---|---|
| `public/config.js` | **Game name, call word and colours. Edit this to rename the game.** |
| `public/index.html`, `app.js`, `style.css` | The game page players see |
| `src/game.js` | The rules (deck, turns, +2/+4, skip, reverse, wild, calling, scoring) |
| `src/worker.js` | The Cloudflare part: one small "room server" per room code |
| `wrangler.jsonc` | Cloudflare settings. `"name"` decides your web address |

---

## One-time setup

### 1. Create the dedicated Gmail
1. Open an incognito/private window (so your work account doesn't get in the way).
2. Go to <https://accounts.google.com/signup> and choose **For my personal use**.
3. Pick a name like `ondu.game.yourname@gmail.com`, set a strong password, add your phone for recovery.

### 2. Create the Cloudflare account
1. In the same private window go to <https://dash.cloudflare.com/sign-up>.
2. Sign up with the new Gmail address and verify the email Cloudflare sends.
3. Choose the **Free** plan if asked. You shouldn't need to add a card for the free Workers plan.
4. In the left menu open **Workers & Pages** once (it may sit under "Compute"). Cloudflare will ask you to pick your
   **workers.dev subdomain**, e.g. `ondu-games`. Your game will live at `https://kadeondu.<your-subdomain>.workers.dev`.

### 3. Install Node.js on your laptop
1. Download the **LTS** version from <https://nodejs.org> and install it with the defaults.
2. Open a terminal (Mac: Terminal · Windows: PowerShell) and check: `node -v` should print v20 or newer.

### 4. Get the project ready
1. Unzip `ondu.zip` somewhere easy, e.g. your Documents folder.
2. In the terminal, go into the folder:
   - Mac: `cd ~/Documents/ondu`
   - Windows: `cd $HOME\Documents\ondu`
3. Install the Cloudflare tool (once): `npm install`

### 5. Log in and deploy
1. `npx wrangler login`
   A browser tab opens. **Make sure it's logged into the new Gmail's Cloudflare account**, then click **Allow**.
   (If it opens your work browser profile, copy the link into the private window instead.)
2. `npx wrangler whoami` — check it shows the new Gmail address.
3. `npx wrangler deploy`
4. It prints your address, e.g. `https://kadeondu.<your-subdomain>.workers.dev`. Open it on your phone. Done!

---

## Playing
- One person taps **Create a room** and then **Share link** (WhatsApp works well).
- Others open the link, type their name, tap **Join**. People can join mid-game too; they get dealt in.
- The host can turn on **stacking** (+2 on +2, +4 on anything) and change cards per hand before a round.
- On your second-last card, tap the call button before or right after playing it. If you forget,
  anyone can tap **Catch!** on your name and you pick up 2.
- If a phone locks or drops off Wi-Fi, just reopen the page: you're put back in your seat with your cards.
- If someone walks away on their turn, the host gets a **Skip their turn** button.
- Rooms clean themselves up 24 hours after the last player leaves.

## Renaming the game later
1. Open `public/config.js` and change `name` and `callWord` (and colours if you like).
2. Run `npx wrangler deploy`. Players see the new name on their next refresh. Rooms keep working.

**Optional, changes the web address:** edit `"name"` in `wrangler.jsonc` (e.g. `"kade-ondu"`) and deploy.
You get a new address and the old one stops working, so share the new link.

## Testing before you deploy
- `npx wrangler dev` then open <http://localhost:8787> in two browser windows.
- To try it on phones on the same Wi-Fi without deploying: `npx wrangler dev --ip 0.0.0.0`,
  find your laptop's IP (Mac: `ipconfig getifaddr en0` · Windows: `ipconfig`), and open
  `http://<that-ip>:8787` on the phones. Same-Wi-Fi play like this needs no internet once running.

## Cost
Free plan. Each move is one small message; Cloudflare counts 20 incoming messages as one request
and the free plan allows 100,000 requests a day, which is far more than a few games will use.
If you ever hit a limit, actions simply fail until the daily reset (00:00 UTC). You are never charged on the free plan.

## Rules used
Standard 108-card deck per 10 players: numbers 0–9, Skip, Reverse, Draw 2, Wild, Wild +4.
Match colour or symbol. If you can't (or don't want to) play, draw one; if it fits you may play it or keep it.
Reverse with 2 players acts as Skip. Wild +4 can be played anytime (no challenge rule).
Round winner scores everyone's leftover cards: numbers face value, action cards 20, wilds 50.
