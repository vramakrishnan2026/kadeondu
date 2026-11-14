# Deployment and accounts

## Where things live

| What | Where |
|---|---|
| Code | GitHub `vramakrishnan2026/kadeondu`, branch `main` |
| Hosting | Cloudflare account created with the **dedicated Kade Ondu Gmail** (the owner has the login). Workers free plan |
| Worker name | `kadeondu` (must match `"name"` in `wrangler.jsonc` and the Cloudflare project name) |
| workers.dev subdomain | `goarena` (changed from `kadeondu` on 2026-11-10) |
| Live URL | https://kadeondu.goarena.workers.dev |

## How a deploy happens

Cloudflare **Workers Builds** is connected to the GitHub repo (Worker → Settings → Build):
- Production branch: `main`
- Build command: *(empty)*
- Deploy command: `npx wrangler deploy`
- Preview builds: off (not needed)

**Every push to `main` builds and deploys in about 30 seconds.** Check under Worker → **Deployments** (the newest row should be your commit message, marked Ready).

Deploying by hand (fallback): `npm install`, then `npx wrangler login` (signed in as the Kade Ondu Gmail account), then `npx wrangler deploy`.

### Things that went wrong before, and the fixes
- **Pushes didn't deploy** (the dashboard showed "Manually deployed", plus "This project is disconnected from your Git account"). Fix: Worker → Settings → Build → Disconnect, then Connect again (GitHub, `vramakrishnan2026/kadeondu`, `main`), then push a commit. If the repo isn't listed: GitHub → Settings → Applications → **Cloudflare Workers and Pages** → Configure → add `kadeondu`.
- **After changing the subdomain:** the Domains tab still showed the old `kadeondu.kadeondu.workers.dev` and the browser showed `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`. Fix: redeploy (push a commit), toggle the workers.dev route off and on if needed, and wait 10–30 min for the certificate.
- **Claude pushing to GitHub:** needs the Claude GitHub App installed on `vramakrishnan2026` with access to `kadeondu`, and GitHub connected in claude.ai Settings → Connectors.

## Custom domain (not done; see OPEN-ITEMS)

`goarena.in` is registered at **GoDaddy** and already uses **Cloudflare nameservers (etta / gerardo .ns.cloudflare.com) in a different Cloudflare account** that runs another project. **Don't change the nameservers at GoDaddy**, or the other project breaks. Options:
1. Import this repo as a Worker in **that** account, then add `"routes": [{ "pattern": "ondu.goarena.in", "custom_domain": true }]` to `wrangler.jsonc`. At the same time, delete or disconnect the Worker in the Kade Ondu account so its builds don't fail.
2. Keep the dedicated account and use a different domain added to it.

## Free plan limits (checked 2026-11-10; resets 00:00 UTC = 05:30 IST)

| Limit | Free plan | What it means here |
|---|---|---|
| Worker requests | 100,000 / day | Page and asset loads are free. Each WebSocket connection is 1 request. Incoming WS messages count 20:1. Outgoing messages and auto-response pings are free |
| Durable Object time | 13,000 GB-s / day | **The real limit.** A room is billed while it's active (turn timer and bots keep it awake). Roughly 25–30 room-hours of active play per day (estimate) |
| SQLite rows written | 100,000 / day | About one save per move, so tens of thousands of moves (~200+ games) |
| Storage | 5 GB | Rooms are tiny |
| CPU | 10 ms per request | Handlers are light |

If a limit is hit, operations of that type fail until the reset. The Workers paid plan (US$5/month) removes this. Watch Worker → **Metrics** and **Durable Objects** usage. Built-in caps: 300 connections per room, 20 computer players per room, 100 rooms listed, 200 people listed.

## Stats password (`STATS_KEY`)

The join stats page (`/stats.html`) only works once a secret called `STATS_KEY` exists. Only the owner can add it:

1. Cloudflare dashboard → **Workers & Pages** → **kadeondu** → **Settings** → **Variables and Secrets** → **Add**.
2. Type: **Secret**. Name: `STATS_KEY`. Value: a password of **12 or more characters** (shorter ones are ignored).
3. **Deploy**. Then open `https://kadeondu.goarena.workers.dev/stats.html` and type the password.

Use the type **Secret**, not plain text: secrets stay in place when GitHub deploys a new version. Never put the password in the repo (it is public). To change it, edit the secret; every device then has to type the new one.
