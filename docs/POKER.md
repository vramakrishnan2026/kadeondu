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
- The game has no natural end: the host presses **End game** between hands. At a friends' table the next hand deals itself after a pause (the host can deal sooner); vs computer it waits for the learner.
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

## Your plan and the AI coach (added 22 Nov 2026)
The owner asked for AI features that analyse a learner and adjust the course, using Cloudflare's free AI.

**Worked out on the phone** (`analyse()` in `public/poker.js`; works offline and vs computer):
- **Next for you:** one suggestion at the top of the tab. Order: first lesson → revision quiz (3+ wrong answers waiting) → next lesson → weakest drill (under 60%) → remaining wrong answers → untried drill → reread the lesson for a table habit → play hands → move up a level → keep sharp.
- **Revision quiz:** the quiz questions answered wrong at this level. Each stays on the list until answered right.
- **Habits at the table:** every decision at a coached table is compared with the coach's advice and counted by kind: paying when the coach would fold, not raising strong hands, folding hands worth continuing, betting when a check was better. A habit shows once there are 8+ such spots and the slip happens in 30% or more of them.
- **The coach adapts:** when the current spot is the learner's usual slip, the "why" panel opens with a warning, and the hand review marks it.
- **Level up:** offered when every lesson is done with two thirds or more right and every drill has a best of 7+. The learner still chooses.

**The AI coach's note** (optional button):
- `POST /api/poker-coach` in `src/worker.js` calls Cloudflare Workers AI through the `ai` binding in `wrangler.jsonc` (model `AI_MODEL`, currently `@cf/meta/llama-3.1-8b-instruct-fp8-fast`).
- Only numbers and lesson or drill titles are sent, never a name. The server rebuilds the text from known fields, so free text from a phone never reaches the model.
- Free allowance: 10,000 neurons a day for the whole Cloudflare account; a note costs roughly 5 to 10. Guards: one note per set of results, 4 a day per phone, `AI_DAILY_CAP` (600) a day overall, counted in the Lobby object.
- When the cap or allowance is reached, or the phone is offline, the app says so and the on-phone plan carries on.
- The note is labelled as written by AI and possibly wrong.
- **Not yet seen live:** the test stand-in uses a pretend AI, so the real model's wording has not been checked. If the model name is retired, change `AI_MODEL`.

## The coach stops a mistake (added 22 Nov 2026)
The owner asked for the game to be watched and a mistaken move undone so the learner can correct it.

- When a learner picks a move the coach counts as a mistake, the move is **held, not played**: a "Hold on" pop-up says what they chose, what the coach would do and why. **Take it back** returns to the same decision; **Play my move anyway** plays it.
- It works as an undo for the learner, but nothing has been sent yet, so no other player sees the move or the change of mind, and no cards are revealed.
- Asked once per decision. If they repeat the move after taking it back, it goes through.
- Setting on the phone (`prog.guard`, chosen in the vs computer set-up): **On clear mistakes** (default), **Whenever I differ from the coach**, **Never**.
- "Clear mistakes" (`mistake()` in `public/poker.js`): paying when the coach would fold; folding a hand the coach would raise or one comfortably worth the price; just calling or checking a very strong hand. Bet-size differences and bets where a check was better are left for the hand review.
- At a friends' table it only applies when the host has coach hints on.
- **This is the built-in coach, not the Cloudflare AI.** Checking every move with the AI would use the free allowance up within a few hands and add a wait to each move.
- The plan shows "Mistakes taken back: N".

## Time to think, and questions to the AI coach (added 22 Nov 2026)
The owner said the next hand started before a learner could analyse the last one, and asked for the AI to answer questions about that session only.

- **Vs computer the next hand waits.** `settings.autoDeal` is off there: nothing is dealt until the learner taps "Deal next hand".
- **At a friends' table** hands still deal themselves (nobody should be able to stall the table), but the pause is longer: 15 s after a showdown, 8 s otherwise. An open review no longer closes when the next hand starts, and "Review the last hand" stays available while waiting for a turn.
- **Ask the AI coach** (inside the hand review): the learner types a question or taps a suggestion. `POST /api/poker-ask` sends the last 4 hands of this table session and the question to Workers AI.
  - What is sent: blinds, the learner's cards and seat, every action, the board, the coach's advice and reasons, showdowns and results. Other players appear as "Opponent A", "Opponent B". No names.
  - The model is told to answer only about those hands and to refuse anything else with a fixed sentence. The session is forgotten when the learner leaves the table.
  - The question is cut to 200 characters and stripped of brackets; history lines must match a plain-text pattern or are dropped (`askLine` in `src/worker.js`).
  - Limits: 12 questions a day per phone; notes and answers share `AI_DAILY_CAP` (700 a day). A plain message appears when the allowance is used up.
- **Not yet seen live:** the real model's answers, including whether it keeps to the session when asked about other things.

## Tests
- `node tests/pokersim.mjs`: hand reading, coach sanity, side pots, 6,000 random hands with chip conservation, watchers, leaving.
- `python3 tests/ui_poker_plan.py`: the plan, revision quiz, AI note (pretend AI: on, limit reached, off), habit counting, coach nudge, level up.
- `python3 tests/ui_poker_guard.py`: the stop-and-take-back pop-up at a friends' table (fixed deal) and vs computer, each setting.
- `python3 tests/ui_poker_ask.py`: hands wait vs computer; questions to the AI coach (what is sent, cleaning, limits); review stays open at a friends' table.
- `python3 tests/ui_poker.py`: home tab, a lesson and quiz, every drill, vs computer with coach and review, a friends' table (hidden cards, showdown, watcher, timer), fit at five screen sizes.
- The stand-in has `/__test/deck?room=CODE&cards=As,Kd,…` to fix the next deal.

## Not done / ideas
- Not tried on real phones yet.
- Tournament mode (rising blinds, knock-outs), hand history, more lessons, Teen Patti or Omaha.
