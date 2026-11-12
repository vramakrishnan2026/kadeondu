# Kade Ondu

A multiplayer last-card game for friends, played in the browser and installable as a phone app.
**Live:** https://kadeondu.goarena.workers.dev

Created by **Vinay Ramakrishnan**.

Everyone opens the link, types a name, and either joins a game that's already running or starts a room and shares the link.
The game supports any number of players: an extra deck is added for every 10 players. You can also play against the computer.

## Documentation

| File | What's in it |
|---|---|
| [docs/FEATURES.md](docs/FEATURES.md) | Everything the game does, every setting and its default |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it works: Cloudflare Worker, room servers, message protocol, files |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Accounts, how deploys work, domains, free-plan limits, troubleshooting |
| [docs/DESIGN.md](docs/DESIGN.md) | Look and feel, design decisions, and the feedback behind them |
| [docs/OPEN-ITEMS.md](docs/OPEN-ITEMS.md) | Unfinished work, known issues, ideas |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | What was built, in order |
| [tests/README.md](tests/README.md) | How to test locally (simulations and browser tests) |
| [CLAUDE.md](CLAUDE.md) | Briefing for an AI assistant continuing this project |

## Quick facts

- **Code:** GitHub `vramakrishnan2026/kadeondu`, branch `main`.
- **Deploying:** every push to `main` deploys automatically through Cloudflare Workers Builds. There's no manual step.
- **Rename the game:** edit `public/config.js` (`name`, `callWord`) and `public/manifest.webmanifest` (`name`, `short_name`).
- **Cost:** Cloudflare free plan. See the limits in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Project layout

```
public/            the game page (served as static files)
  index.html       all screens
  app.js           the browser side: screens, rendering, animations, voice, stickers, solo games
  style.css        all styling
  config.js        name, call word, colours, Wild +4 effect, sticker captions  ← rename / tweak here
  shared/game.js   the rules engine and computer players (used by the server AND by Play vs computer)
  sw.js            offline helper (network first). Bump CACHE when adding new assets
  manifest.webmanifest, icons/, favicon.png    installable app
  fonts/           Inter Black Italic (subset, open licence) for card numbers
  fx/              mani.webp, evil-laugh.mp3, rangoli.svg, reactions/*.webp
  voicetest.html   TEMPORARY voice debugging page (see docs/OPEN-ITEMS.md)
src/worker.js      Cloudflare Worker + GameRoom and Lobby Durable Objects
wrangler.jsonc     Cloudflare configuration (Worker name "kadeondu", Durable Object migrations)
tests/             local Cloudflare stand-in, rule simulations, browser tests
docs/              documentation
```

## Credits

- Game, artwork, table and rangoli pattern: original to this project. Card designs are deliberately original, not based on any commercial card game.
- Card numbers: **Inter Black Italic** (© The Inter Project Authors, SIL Open Font License 1.1; see `public/fonts/LICENSE-Inter.txt`).
- Wild +4 laugh sound: "evil laugh" by freesound_community, supplied by the project owner. The file name indicates Pixabay, whose licence allows use in games.
- Wild +4 photo and the sticker reactions: photos of the owner's friends, supplied by the owner.
