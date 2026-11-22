# Poker School

A fourth tab that teaches Texas Hold'em at the level the learner picks. **Play chips only**: there is no money anywhere, and chips cannot be bought or cashed in. Built 22 Nov 2026.

## What the owner asked for
- Texas Hold'em. Learner **picks their own level** (Beginner, Intermediate, Advanced); all levels are open.
- All four kinds of training: **lessons with quizzes**, **drills**, **practice hands vs computer**, **a practice table with friends**.
- All levels built before going live.

Assumed (told to the owner, not yet confirmed): tab name "Poker School"; progress kept on the phone only.

## What is in it
| Part | What it does | Where |
|---|---|---|
| Level picker | Three levels; the choice is remembered on the phone and decides which lessons and drills are listed and how much the coach explains | `public/poker.js` (`renderHome`) |
| Lessons | 6 per level (18), each a few cards to read and a 3 to 4 question quiz. Plain data, easy to edit | `public/poker-learn.js` |
| Drills | 10 questions a round, made fresh by the rules engine. Beginner: name the hand, who wins. Intermediate: count outs, call or fold. Advanced: equity, open/call/fold by seat, bluff maths | `public/poker.js` (`DRILLS`) |
| Vs computer | A table of 1 to 5 computer players, run in the browser. The coach is always on | `startSolo` in `public/poker.js` |
| Table with friends | A room like Ondu and Ludo: 2 to 6 seats, watchers get a seat at the next hand, same reactions, voice notes, chat and invites | `public/shared/poker.js`, `src/worker.js` |
| Coach | On your turn: what a sound player would do and why. Beginner sees the suggestion straight away; the other levels tap "Ask the coach" so they think first. After each hand: a review of your choices next to the coach's | `advise()` in `public/shared/poker.js` |

Progress (level, quiz scores, drill bests) is in `localStorage` under `ko-poker`. Nothing about lessons is sent to the server.

## Table rules
- No-limit Texas Hold'em. Blinds 5/10, 10/20 or 25/50; starting stack 500, 1000 or 2000 (host settings).
- A player who runs out of chips gets a fresh stack at the next hand (it is a practice table). The final table shows chips won or lost, counting those top-ups.
- The game has no natural end: the host presses **End game** between hands. The next hand deals itself after a pause (the host can deal sooner).
- Side pots with all-ins are handled. A bet nobody called is returned.
- Simplification: any raise, even an all-in for less than a full raise, lets the others raise again.
- A player who leaves mid-hand is folded and their seat is cleared before the next hand.
- **Coach hints** at a friends' table is a room setting, **off by default**. Each player only ever gets advice about their own cards.
- Other players' cards are sent to a phone only at a showdown (`viewFor`).

## The coach's method (so it can be tuned)
- Before the flop: the Chen starting-hand score against a threshold for the seat (early 8, middle 7, late 6).
- After the flop: chance of winning against random hands (dealt out a few hundred times), lowered when facing a bet, compared with the pot odds. Outs are counted for the explanation.
- The computer players use the same advice with habits added (Easy: calls too much, rarely raises; Normal: occasional bluff or slow-play).
- It is a teaching guide, not a solver. Lesson text says so where it matters.

## Tests
- `node tests/pokersim.mjs`: hand reading, coach sanity, side pots, 6,000 random hands with chip conservation, watchers, leaving.
- `python3 tests/ui_poker.py`: home tab, a lesson and quiz, every drill, vs computer with coach and review, a friends' table (hidden cards, showdown, watcher, timer), fit at five screen sizes.
- The stand-in has `/__test/deck?room=CODE&cards=As,Kd,…` to fix the next deal.

## Not done / ideas
- Not tried on real phones yet.
- Tournament mode (rising blinds, knock-outs), hand history, more lessons, Teen Patti or Omaha.
