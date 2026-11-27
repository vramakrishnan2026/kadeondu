# Ondu Ruthless

The tougher version of the card game, on its own tab. Built 27 Nov 2026 (the tab had been "Brewing" since 22 Nov).

The owner asked for an equivalent of a well-known "no mercy" card game. **The rules of play are used; the name, card names and artwork are our own** (see rule 1 in `CLAUDE.md`). Cards use the same original card face as Kade Ondu with new symbols.

## Rules
Everything works as in Kade Ondu (match colour or symbol, call Ondu on your last card, catch someone who forgets) except:

- **If you can play, you must.** The Draw button is off while a card in your hand fits.
- **No match: draw until a card fits,** then you must play that card. There is no "keep it".
- **Draw cards always stack.** Answer a draw card with one of the same size or bigger (2, 4, 6, 10), any colour, and the total moves to the next player. No answer: pick up the lot.
- **25 cards and you are out** of the round (`KO_AT` in `shared/game.js`). You watch until it ends and keep your score. The last player in wins.
- **Only computer players left:** if every real player has been knocked out, the round ends at once (nobody wants to watch computers finish). The lowest card points in hand wins, as when the round timer runs out. Added 27 Nov 2026 at the owner's request. If another real player is still in, the round carries on.
- **Seven:** swap hands with a player you choose (with two players, the other one). **Zero:** everyone passes their hand to the next player in the direction of play. Neither happens if it was your last card: you win.
- **Scoring:** the winner gets the points left in the other hands, plus 50 for every player knocked out.

### The deck (164 cards)
Per colour: 0 to 9 twice, Skip ×3, Reverse ×3, Draw 2 ×2, Draw 4 ×2, Skip All ×2, Dump ×3. Wilds: Wild Reverse +4 ×8, Wild +6 ×4, Wild +10 ×4, Roulette ×8. One more deck is added per 10 players.

| Card | What it does |
|---|---|
| Draw 4 (coloured) | The next player picks up 4, or answers |
| Wild +6, Wild +10 | Pick the colour; the next player picks up 6 or 10, or answers |
| Wild Reverse +4 | Play turns round; the player now next picks up 4, or answers |
| Skip All | Everyone else misses a turn; you go again |
| Dump | Every card of that colour leaves your hand with it |
| Roulette | You name a colour; the next player draws until that colour turns up and misses the turn |

Choices made while building (the owner has not reviewed them): the player of a Roulette names the colour; a +2 cannot answer a bigger card; round time limit defaults to 5 minutes; the stacking switch is hidden because it is always on.

## How it is built
- The rules are a mode of the card game engine: `public/shared/game.js`, under "Ondu Ruthless" (`R(s)`, `buildRuthlessDeck`, `playRuthless`, `mercy`, and branches in `canPlay`, `draw`, `botMove`).
- `public/shared/ruthless.js` only makes a room with `game: 'ruthless'`, so the server (`engineFor`) and Play vs computer treat it as its own game.
- The table is the Kade Ondu screen. `public/app.js` adds the new card labels, the swap picker (`#swapPicker`), the card guide (`#ruthlessRules`), status wording, and toasts for knock-outs, swaps, dumps and roulette.
- A knocked-out player is moved to the watchers list for the rest of the round and comes back when it ends.

## Tests
- `node tests/ruthlesssim.mjs`: each rule as a set piece, the standard game unchanged, 160 rounds between computer players with the cards counted.
- `python3 tests/ui_ruthless.py`: tab and guide, a room (must-play, stacking, draw until fit, seven swap, knock-out), vs computer, fit, and the standard game untouched.
- Stand-in shortcut: `/__test/hand?room=CODE&name=…&cards=r:7,w:wd10&top=r:5&turn=1&count=20`.

## Not done
- Not tried on real phones.
- The Wild +4 laugh animation is not used here.
