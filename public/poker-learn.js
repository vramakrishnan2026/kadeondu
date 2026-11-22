// Poker School: the lessons and their quizzes, by level. Plain data, read by poker.js.
// Text: **bold** is the only markup. Cards are written like 'As Kd' (rank + suit: s ♠, h ♥, d ♦, c ♣; T = 10).
// To add a lesson, add an entry to a level's list. A quiz question: { q, cards?, options, answer (index), why }.
window.POKER_LEARN = {
  levels: [
    { id: 'beginner', label: 'Beginner', icon: '🌱', sub: 'Never played', about: 'Rules, hand ranks and how a hand is played.' },
    { id: 'intermediate', label: 'Intermediate', icon: '📈', sub: 'Know the rules', about: 'Position, outs, pot odds and bet sizes.' },
    { id: 'advanced', label: 'Advanced', icon: '🎯', sub: 'Want an edge', about: 'Equity, ranges, bluffs and stack depth.' },
  ],
  lessons: {
    beginner: [
      { id: 'b1', title: 'What poker is', pages: [
        { h: 'The goal', t: 'Poker is played for **chips**. You win the chips in the middle (the **pot**) in one of two ways: you have the **best hand** when the cards are shown, or **everyone else gives up** (folds) before that.' },
        { h: 'Your cards and the shared cards', t: 'In Texas Hold\'em each player gets **two cards of their own**, face down. Then up to **five shared cards** are turned face up in the middle for everyone to use.', cards: 'As Kd | Qh Js 4c 9d 2s' },
        { h: 'Best five wins', t: 'Your hand is the **best five cards** you can make from your two cards and the five shared cards. You do not have to use both of your own cards.' },
        { h: 'Play chips only', t: 'Everything here uses **play chips**. They have no value and can never be bought or cashed in. This is a place to learn the game and practise thinking.' },
      ], quiz: [
        { q: 'How many cards of your own do you get in Texas Hold\'em?', options: ['One', 'Two', 'Five', 'Seven'], answer: 1, why: 'Two cards of your own, plus up to five shared cards in the middle.' },
        { q: 'Which is a way to win the pot?', options: ['Having the most cards', 'Everyone else folds', 'Betting first', 'Holding the dealer button'], answer: 1, why: 'You win when everyone else folds, or by showing the best hand at the end.' },
        { q: 'How many cards make up a poker hand at the end?', options: ['Two', 'Five', 'Six', 'Seven'], answer: 1, why: 'Always the best five, chosen from your two cards and the five shared ones.' },
      ] },
      { id: 'b2', title: 'Hand rankings', pages: [
        { h: 'The strongest hands', t: '**Royal flush**: 10 to Ace of one suit. **Straight flush**: five in a row of one suit. **Four of a kind**: four cards of the same rank.', cards: 'Ts Js Qs Ks As' },
        { h: 'Strong hands', t: '**Full house**: three of one rank plus a pair. **Flush**: any five cards of one suit. **Straight**: five in a row, any suits.', cards: '9h 9d 9s Kc Kd' },
        { h: 'Everyday hands', t: '**Three of a kind**, then **two pair**, then **one pair**. Most pots are won with one of these.', cards: 'Jh Jd 7s 7c Ad' },
        { h: 'High card and kickers', t: 'With nothing at all, the **highest card** plays. When two players have the same hand, the next highest side card, the **kicker**, decides. A pair of Aces with a King beats a pair of Aces with a Queen.' },
        { h: 'A trick to remember', t: 'The **rarer** the hand, the **stronger** it is. A flush beats a straight because five of one suit turns up less often than five in a row.' },
      ], quiz: [
        { q: 'Which hand is stronger?', options: ['A straight', 'A flush', 'They are equal'], answer: 1, why: 'A flush (five of one suit) beats a straight (five in a row).' },
        { q: 'What is this hand?', cards: '8h 8d 8s Qc Qd', options: ['Three of a kind', 'Two pair', 'Full house', 'Four of a kind'], answer: 2, why: 'Three Eights plus a pair of Queens is a full house.' },
        { q: 'Two players both have a pair of Kings. What decides it?', options: ['Who bet first', 'The suits', 'The highest side card (kicker)', 'It is always a split'], answer: 2, why: 'The kicker decides. Suits never break a tie in poker.' },
        { q: 'Which beats three of a kind?', options: ['Two pair', 'One pair', 'A straight', 'High card'], answer: 2, why: 'A straight ranks just above three of a kind.' },
      ] },
      { id: 'b3', title: 'How a hand is played', pages: [
        { h: 'The button and the blinds', t: 'A marker called the **button** (D) moves one seat each hand. The two players after it must put in small forced bets, the **small blind** and the **big blind**, so there is always something to win.' },
        { h: 'Before the flop', t: 'Everyone gets two cards. Betting starts with the player after the big blind and goes round the table. This round is called **pre-flop**.' },
        { h: 'Flop, turn, river', t: 'Then three shared cards are turned up (the **flop**), then one more (the **turn**), then a last one (the **river**). There is a round of betting after each.', cards: 'Qh Js 4c | 9d | 2s' },
        { h: 'Showdown', t: 'If two or more players are still in after the last bet, they show their cards. The best five-card hand takes the pot. That is the **showdown**.' },
      ], quiz: [
        { q: 'How many shared cards come on the flop?', options: ['One', 'Two', 'Three', 'Five'], answer: 2, why: 'The flop is three cards, the turn one, the river one: five in all.' },
        { q: 'What are the blinds?', options: ['Cards dealt face down', 'Forced bets before the cards are dealt', 'Players who cannot see', 'The last round of betting'], answer: 1, why: 'Two players post forced bets each hand so there is a pot to play for.' },
        { q: 'In what order do the shared cards arrive?', options: ['River, turn, flop', 'Flop, river, turn', 'Flop, turn, river', 'Turn, flop, river'], answer: 2, why: 'Flop (3 cards), then turn (1), then river (1).' },
      ] },
      { id: 'b4', title: 'Your choices', pages: [
        { h: 'When nobody has bet', t: 'You can **check** (pass, staying in for free) or **bet** (put chips in, so the others must match it to continue).' },
        { h: 'When someone has bet', t: 'You can **call** (match the bet), **raise** (make it bigger) or **fold** (throw your cards away and give up this pot). You cannot check when there is a bet to you.' },
        { h: 'All-in', t: 'Betting every chip you have is going **all-in**. You can never be forced out for having too few chips: you can always call with what you have, and you play for the part of the pot you matched.' },
        { h: 'Folding is normal', t: 'Good players fold **most** of their hands. Folding costs nothing more than what you already put in. Calling with a weak hand costs chips again and again.' },
      ], quiz: [
        { q: 'Someone bets 50 and you want to stay in without making it bigger. You…', options: ['Check', 'Call', 'Raise', 'Fold'], answer: 1, why: 'Calling means matching the bet. You cannot check when there is a bet to you.' },
        { q: 'When can you check?', options: ['Any time', 'Only when nobody has bet in this round', 'Only on the river', 'Only with a good hand'], answer: 1, why: 'Checking is passing for free, so it is only possible when there is no bet to match.' },
        { q: 'You have 30 chips left and someone bets 100. What can you do?', options: ['You must fold', 'Call all-in with your 30, or fold', 'Borrow 70 chips', 'Check'], answer: 1, why: 'You may call with what you have. You then play for the part of the pot you matched.' },
      ] },
      { id: 'b5', title: 'The best five and the showdown', pages: [
        { h: 'Seven cards, pick five', t: 'At the end you have seven cards to choose from. Here the best five are the pair of Aces with K, Q, J as side cards.', cards: 'As Kd | Ah Qs Jc 7d 2s' },
        { h: 'Playing the board', t: 'Sometimes the five shared cards are the best hand all by themselves. Then everyone left has the same hand and the pot is **split**.', cards: '7s 2d | Ts Jd Qh Kc Ac' },
        { h: 'Watch the shared cards', t: 'Shared cards help **everyone**. Three cards of one suit in the middle mean somebody may have a flush. A pair in the middle means a full house is possible.' },
        { h: 'Only the best five count', t: 'A sixth card never breaks a tie. If both players\' best five are the same, they share the pot equally.' },
      ], quiz: [
        { q: 'What is your best hand?', cards: 'Kh Qh | 2h 7h 9c Jh 3s', options: ['King high', 'A straight', 'A flush', 'One pair'], answer: 2, why: 'Five hearts (K, Q, J, 7, 2) make a flush.' },
        { q: 'The shared cards are A K Q J 10 of mixed suits. You hold 7 and 2. What happens?', options: ['You lose', 'Everyone still in has the same straight and splits the pot', 'You win', 'The hand is dealt again'], answer: 1, why: 'The board is the best hand for everybody (unless someone has a flush), so the pot is shared.' },
        { q: 'There is a pair of Nines in the middle. What should you keep in mind?', options: ['Nothing changes', 'Someone could have three Nines or a full house', 'Nobody can have a flush', 'The pot is split'], answer: 1, why: 'A paired board makes three of a kind and full houses possible.' },
      ] },
      { id: 'b6', title: 'Good starting hands', pages: [
        { h: 'Not all hands are worth playing', t: 'Your first decision is the most important: **play or fold?** Most starting hands are losers in the long run. Strong players throw away about three hands out of four before the flop.' },
        { h: 'The best starts', t: '**Big pairs** (Aces, Kings, Queens, Jacks) and **two big cards** (Ace-King, Ace-Queen). With these, raise.', cards: 'As Ah | Kd Kc | Ah Ks' },
        { h: 'Good, with care', t: '**Middle pairs** (Tens down to Sevens), and **big cards of the same suit** like King-Queen or Queen-Jack. Good hands, but be ready to let go if the flop does not help.', cards: '9s 9d | Kh Qh' },
        { h: 'Hands to throw away', t: 'Two small cards that do not match, like Nine-Three or Seven-Two, are trouble. Even when they make a pair, someone often has a better one. **Fold and wait.**', cards: '7s 2d' },
      ], quiz: [
        { q: 'Which is the best starting hand?', options: ['7♠ 2♦', 'A♠ A♥', 'J♠ 10♠', '5♣ 5♦'], answer: 1, why: 'A pair of Aces is the best starting hand in Hold\'em.' },
        { q: 'How many of their starting hands do good players fold?', options: ['Almost none', 'About a quarter', 'About half', 'About three out of four'], answer: 3, why: 'Being choosy before the flop is the biggest single habit of winning players.' },
        { q: 'You are dealt 9♣ 3♦ and someone raises. What is the sound play?', options: ['Call to see the flop', 'Raise back', 'Fold', 'Go all-in'], answer: 2, why: 'A weak hand against a raise is a clear fold. It costs you nothing more.' },
      ] },
    ],
    intermediate: [
      { id: 'i1', title: 'Position', pages: [
        { h: 'Acting last is an advantage', t: 'After the flop, betting starts to the left of the button and the **button acts last**. Whoever acts later has seen what the others did before deciding. That information is worth chips.' },
        { h: 'Early, middle, late', t: 'The first seats to act are **early position**: play only strong hands there. The seats near the button are **late position**: you can play more hands and take more pots.' },
        { h: 'The blinds', t: 'The blinds get a discount to see the flop, but they act **first** on every later round. It is the hardest place to play from: do not defend them with rubbish just because chips are already in.' },
        { h: 'Use it', t: 'When everyone checks to you in late position, a bet often wins the pot there and then. From early position the same bet has to get through every player behind you.' },
      ], quiz: [
        { q: 'Who acts last after the flop?', options: ['The big blind', 'The small blind', 'The button', 'Whoever raised'], answer: 2, why: 'The button acts last on the flop, turn and river: the best seat at the table.' },
        { q: 'From which position should you play the fewest hands?', options: ['Early', 'Late', 'The button', 'It makes no difference'], answer: 0, why: 'In early position many players are still to act behind you, so only strong hands are worth it.' },
        { q: 'Why is acting later better?', options: ['You get better cards', 'You see what the others do first', 'You pay smaller blinds', 'You are dealt first'], answer: 1, why: 'Position is about information: you decide knowing more than they did.' },
      ] },
      { id: 'i2', title: 'Starting hands by position', pages: [
        { h: 'Tighter early, wider late', t: 'From **early** position open only the top hands: big pairs, Ace-King, Ace-Queen. From the **button** you can add smaller pairs, suited Aces and suited connecting cards like 8♠ 7♠.' },
        { h: 'Raise, do not limp', t: 'If you are first into the pot and your hand is worth playing, **raise** to about three times the big blind. Just calling the blind ("limping") lets everyone in cheaply and tells them your hand is so-so.' },
        { h: 'Facing a raise', t: 'A raise ahead of you means strength. Tighten up: call with good pairs and big suited cards, raise again with the very best, and fold hands like King-Ten or Ace-Seven that are often second best.' },
        { h: 'Suited and connected', t: 'Suited cards make flushes, connected cards make straights. They are worth a little more, but not as much as people hope: a suited hand makes a flush only about one time in sixteen.' },
      ], quiz: [
        { q: 'You are first to act (early position) with K♦ 10♣. Best play?', options: ['Raise', 'Call the blind', 'Fold', 'All-in'], answer: 2, why: 'King-Ten offsuit is too weak to open from early position with the whole table behind you.' },
        { q: 'Everyone folds to you on the button with 8♠ 7♠. Best play?', options: ['Fold', 'Call the blind', 'Raise to about 3 big blinds', 'All-in'], answer: 2, why: 'Late position with only the blinds left: a suited connector is a fine hand to raise.' },
        { q: 'Why raise instead of just calling the blind?', options: ['It looks strong', 'You can win the blinds at once and you play against fewer hands', 'It is a rule', 'It costs less'], answer: 1, why: 'A raise can win right away, and when called you are up against fewer opponents with the lead.' },
      ] },
      { id: 'i3', title: 'Counting outs', pages: [
        { h: 'What an out is', t: 'An **out** is a card still to come that would give you the winning hand. Count them and you know roughly how often you will get there.' },
        { h: 'The common draws', t: '**Flush draw** (four of one suit): 9 outs. **Open-ended straight draw** (four in a row, open at both ends): 8 outs. **Gutshot** (one card missing inside): 4 outs.', cards: 'Ah 7h | Kh 9h 2c' },
        { h: 'The rule of 4 and 2', t: 'On the **flop**, with two cards to come, multiply your outs by **4** for the rough chance of hitting by the river. On the **turn**, with one card to come, multiply by **2**.' },
        { h: 'Example', t: 'A flush draw on the flop: 9 outs × 4 = about **36%** by the river. On the turn: 9 × 2 = about **18%** for the last card.' },
        { h: 'Do not count dirty outs', t: 'An out that also gives someone else a better hand is not really an out. A card that makes your straight but puts three of a suit on the board may complete a flush against you.' },
      ], quiz: [
        { q: 'How many outs does a flush draw have?', options: ['4', '8', '9', '13'], answer: 2, why: '13 cards in the suit, minus the 4 you can see, leaves 9.' },
        { q: 'You hold 9♠ 8♦ and the flop is 7♥ 6♣ K♦. How many outs to a straight?', cards: '9s 8d | 7h 6c Kd', options: ['4', '6', '8', '9'], answer: 2, why: 'Any Ten or any Five completes it: 4 + 4 = 8 (open-ended).' },
        { q: 'You have 8 outs on the turn. Roughly how often do you hit on the river?', options: ['About 8%', 'About 16%', 'About 32%', 'About 50%'], answer: 1, why: 'One card to come: outs × 2 = about 16%.' },
      ] },
      { id: 'i4', title: 'Pot odds', pages: [
        { h: 'The price of a call', t: '**Pot odds** compare what a call costs with what you can win. If the pot is 150 and it costs you 50, you are paying 50 to win 150.' },
        { h: 'Turn it into a percentage', t: 'Chance you need = **cost ÷ (pot + cost)**. Paying 50 into a pot of 150 means 50 ÷ 200 = **25%**. If you win more often than that, calling makes chips in the long run.' },
        { h: 'Put the two together', t: 'Flush draw on the turn: about 18% to hit. If the call needs 25%, **fold**. If the bet is small and the call needs only 12%, **call**.' },
        { h: 'Handy numbers', t: 'A bet of **half the pot** needs 25%. A bet of **the whole pot** needs 33%. A bet of **a quarter pot** needs about 17%.' },
      ], quiz: [
        { q: 'The pot is 300 (including the bet) and it costs you 100 to call. What chance do you need?', options: ['20%', '25%', '33%', '50%'], answer: 1, why: '100 ÷ (300 + 100) = 25%.' },
        { q: 'You are about 18% to hit and the call needs 30%. What is right?', options: ['Call', 'Fold', 'Raise', 'It does not matter'], answer: 1, why: 'You hit less often than the price requires, so calling loses chips over time.' },
        { q: 'An opponent bets the full pot. What chance do you need to call?', options: ['25%', '33%', '50%', '66%'], answer: 1, why: 'Pot 100, bet 100: you pay 100 to win 200, so 100 ÷ 300 = 33%.' },
      ] },
      { id: 'i5', title: 'Bet sizing', pages: [
        { h: 'Size your bets against the pot', t: 'Think of every bet as a share of the pot, not as a number of chips. A bet of 50 is big into a pot of 60 and tiny into a pot of 500.' },
        { h: 'Betting for value', t: 'With a good hand, bet **half to three quarters of the pot**. Big enough that draws pay too much to chase, small enough that weaker hands still call.' },
        { h: 'Too small, too big', t: 'A tiny bet gives everyone the right price to draw out on you. A huge bet folds out everything except the hands that beat you.' },
        { h: 'Before the flop', t: 'Open to about **3 big blinds**, and add one big blind for each player who has already called. Keep your size the same for all your hands so it gives nothing away.' },
      ], quiz: [
        { q: 'You have top pair on a board with a flush draw. Pot is 200. A sensible bet?', options: ['20', '130', '600', 'Check'], answer: 1, why: 'About two thirds of the pot charges the draw a bad price and still gets called by worse pairs.' },
        { q: 'What is wrong with betting 10 into a pot of 200?', options: ['Nothing', 'It gives draws a very cheap price to catch up', 'It is against the rules', 'It scares everyone away'], answer: 1, why: 'They need only about 5% to call: any draw is right to continue.' },
        { q: 'Two players have called the big blind of 20 before you. A standard raise is to about…', options: ['40', '60', '100', '300'], answer: 2, why: '3 big blinds plus one for each caller: 5 × 20 = 100.' },
      ] },
      { id: 'i6', title: 'Reading the board', pages: [
        { h: 'Dry and wet boards', t: 'A **dry** board has no draws: K♠ 7♦ 2♣. A **wet** board is full of them: J♥ 10♥ 9♠. On wet boards good hands need protecting with a bet, and big bets from others are more likely to be real.', cards: 'Ks 7d 2c | Jh Th 9s' },
        { h: 'What is the best possible hand?', t: 'Always ask what the **nuts** are: the best hand anyone could hold. Three hearts out: a flush is possible. A pair on board: a full house is possible. Four in a row: any single card can make a straight.' },
        { h: 'How strong is your hand here?', t: 'Top pair is strong on K♠ 7♦ 2♣. The same top pair is fragile on J♥ 10♥ 9♠, where many turn cards beat you. Strength always depends on the board.' },
        { h: 'When the scary card comes', t: 'If the flush card or straight card arrives and a player who was calling suddenly bets big, believe them more often than not. Slow down with one pair.' },
      ], quiz: [
        { q: 'Which flop is "wetter" (has more draws)?', cards: 'Ks 7d 2c | Jh Th 9s', options: ['K♠ 7♦ 2♣', 'J♥ 10♥ 9♠', 'They are the same'], answer: 1, why: 'J-10-9 with two hearts offers straight draws and a flush draw. K-7-2 offers none.' },
        { q: 'The board is A♠ 9♠ 4♠ 9♦ 2♣. What is the best possible hand?', cards: 'As 9s 4s 9d 2c', options: ['A flush', 'A full house', 'Four Nines', 'A straight'], answer: 2, why: 'The board is paired, so four of a kind (9-9 in hand) is possible and beats full houses and flushes.' },
        { q: 'You hold top pair. The third heart comes and a quiet player bets big. Usually you should…', options: ['Raise', 'Slow down: call carefully or fold', 'Go all-in', 'Ignore it'], answer: 1, why: 'A sudden big bet when the draw completes is usually the draw getting there.' },
      ] },
    ],
    advanced: [
      { id: 'a1', title: 'Equity and expected value', pages: [
        { h: 'Equity', t: 'Your **equity** is your share of the pot on average: how often you would win if the hand were dealt out from here many times. Aces against a random hand have about 85% before the flop.' },
        { h: 'Expected value', t: '**EV** is what a play earns on average. For a call: EV = (chance to win × what you win) − (chance to lose × what you pay). Positive EV plays make chips over time, whatever happens this once.' },
        { h: 'Example', t: 'Pot 300, call 100, you win 35% of the time. EV = 0.35 × 300 − 0.65 × 100 = 105 − 65 = **+40** chips per call. Calling is right even though you lose most of the time.' },
        { h: 'Decisions, not results', t: 'Judge a play by its EV, not by how it turned out. A good call that loses was still a good call. This is the habit that separates strong players from the rest.' },
        { h: 'Equity against a bettor', t: 'Equity against a **random** hand flatters you. A player who bets or raises has a stronger-than-random set of hands, so your real equity against them is lower. The coach allows for this.' },
      ], quiz: [
        { q: 'Pot 200, call 100, you win 40% of the time. EV of calling?', options: ['−20', '0', '+20', '+80'], answer: 2, why: '0.40 × 200 − 0.60 × 100 = 80 − 60 = +20.' },
        { q: 'You made a +EV call and lost the hand. Was the call a mistake?', options: ['Yes, you lost chips', 'No: the decision was right, the result was chance', 'Only if the pot was big', 'It depends on the opponent\'s mood'], answer: 1, why: 'A decision is judged by its expected value, not by one outcome.' },
        { q: 'Why is your equity against a player who raised lower than against a random hand?', options: ['Raising changes the cards', 'They raise with a stronger set of hands than random', 'The pot is bigger', 'It is not lower'], answer: 1, why: 'Their action removes weak hands from what they can hold.' },
      ] },
      { id: 'a2', title: 'Think in ranges', pages: [
        { h: 'Not one hand, a range', t: 'You can rarely name an opponent\'s exact hand. Think instead of their **range**: every hand they would play this way. Then ask how your hand does against all of it.' },
        { h: 'Narrow it street by street', t: 'A raise from early position: big pairs and big cards. They bet a dry flop: most of that range still. They check the turn: the strongest hands become less likely. Each action trims the range.' },
        { h: 'Counting combinations', t: 'There are **6** ways to hold any pair, **16** ways to hold two different ranks (4 suited, 12 offsuit). So a range of "AA, KK, AK" is 6 + 6 + 16 = 28 hands, and more than half of it is Ace-King.' },
        { h: 'Your range too', t: 'Good opponents put you on a range as well. If you only ever raise with Aces and Kings, everyone folds. Mixing in other hands is what gets your big hands paid.' },
      ], quiz: [
        { q: 'How many different ways are there to be dealt Ace-King (any suits)?', options: ['4', '6', '12', '16'], answer: 3, why: '4 Aces × 4 Kings = 16 combinations.' },
        { q: 'An opponent\'s range is exactly "QQ or AK". How likely is it AK?', options: ['About 27%', '50%', 'About 73%', '100%'], answer: 2, why: 'AK has 16 combinations, QQ has 6: 16 ÷ 22 ≈ 73%.' },
        { q: 'A tight player raises pre-flop and bets all three streets on K♠ 8♦ 3♣ 2♥ 7♠. Which hand is least likely?', options: ['A-K', 'K-K', '9-8', 'A-A'], answer: 2, why: 'A tight raiser rarely starts with 9-8, and would rarely bet it three times for value.' },
      ] },
      { id: 'a3', title: 'Continuation bets', pages: [
        { h: 'What it is', t: 'You raised before the flop, so you are the one who showed strength. Betting again on the flop, whether it helped you or not, is a **continuation bet** (c-bet).' },
        { h: 'Why it works', t: 'Two unpaired cards miss the flop about **two times in three**. Your opponent has usually missed too, and you are the one with the story of a strong hand.' },
        { h: 'Good spots', t: 'Against **one** opponent, on **dry** boards with a high card (A♣ 7♦ 2♠, K♥ 8♠ 3♦). A small bet, a third to half of the pot, does the job.' },
        { h: 'Bad spots', t: 'Against **several** opponents, or on wet middle boards like 9♥ 8♥ 7♠ that hit calling hands hard. There, check more often and bet your real hands.' },
        { h: 'Have a plan for the turn', t: 'If you are called, do not keep firing automatically. Carry on with good hands and with draws; give up with nothing when the turn changes little.' },
      ], quiz: [
        { q: 'About how often do two unpaired cards miss the flop (make no pair)?', options: ['One time in three', 'Half the time', 'Two times in three', 'Nine times in ten'], answer: 2, why: 'You pair one of your cards on the flop only about a third of the time.' },
        { q: 'You raised with A♠ Q♠ and one player called. Which flop is best for a continuation bet?', cards: 'Kd 7c 2s | 9h 8h 7s', options: ['K♦ 7♣ 2♠', '9♥ 8♥ 7♠', 'Neither'], answer: 0, why: 'A dry, high-card board favours the raiser\'s range. 9-8-7 two-suited hits the caller.' },
        { q: 'Three players called your raise and the flop missed you. Best default?', options: ['Bet big', 'Check more often', 'Go all-in', 'Bet tiny every time'], answer: 1, why: 'With several opponents someone has usually connected, so bluffs work far less.' },
      ] },
      { id: 'a4', title: 'Bluffs and semi-bluffs', pages: [
        { h: 'Fold equity', t: 'A bet can win in two ways: you have the best hand, or they fold. The chance they fold is your **fold equity**. A bluff relies on it entirely.' },
        { h: 'The break-even point', t: 'A bluff must work **bet ÷ (pot + bet)** of the time to break even. Half-pot: 33%. Full pot: 50%. Small bluffs need to work less often.' },
        { h: 'Semi-bluffs', t: 'Betting a **draw** is a semi-bluff: you can win at once if they fold, and you can still make the best hand if they call. These are the best bluffs, because you have two ways to win.', cards: 'Ah 5h | Kh 9h 2c' },
        { h: 'Tell a story that fits', t: 'A bluff works when your betting matches a hand you could really have. Raising pre-flop, betting an Ace-high flop and betting again is believable. Suddenly betting big out of nowhere is not.' },
        { h: 'Who not to bluff', t: 'Do not bluff players who call with anything, and do not bluff several players at once. Against them, wait for a hand and bet it for value.' },
      ], quiz: [
        { q: 'You bluff 100 into a pot of 200. How often must it work to break even?', options: ['25%', '33%', '50%', '66%'], answer: 1, why: '100 ÷ (200 + 100) = 33%.' },
        { q: 'Why is a semi-bluff better than a pure bluff?', options: ['It costs less', 'You can also win by making your hand when called', 'It always works', 'It hides your cards'], answer: 1, why: 'Two ways to win: they fold now, or you hit your draw later.' },
        { q: 'Against a player who calls every bet, the best plan is…', options: ['Bluff more', 'Bluff less and bet your good hands bigger', 'Never bet', 'Go all-in every hand'], answer: 1, why: 'With no fold equity, bluffs lose. Value bets win more.' },
      ] },
      { id: 'a5', title: 'Implied odds and stack depth', pages: [
        { h: 'Implied odds', t: 'Pot odds count the chips in the middle now. **Implied odds** add what you expect to win on later streets when you hit. A draw that is slightly too expensive today can still be right if a big payday follows.' },
        { h: 'Small pairs', t: 'A small pair flops three of a kind about **one time in eight**. Calling a raise just to try is only worth it if you can win roughly **15 times** the call when you hit, so both stacks need to be deep.' },
        { h: 'Reverse implied odds', t: 'Some hands make a second-best hand and lose **more** later: a weak Ace when an Ace flops, or a small flush against a bigger one. Count that cost too.' },
        { h: 'Stack-to-pot ratio', t: '**SPR** = the smaller stack ÷ the pot on the flop. Low SPR (under 4): top pair is strong enough to play for everything. High SPR (over 10): one pair is rarely good when all the chips go in.' },
      ], quiz: [
        { q: 'You call 50 with a small pair, hoping to flop three of a kind. Roughly how much should you be able to win when you hit?', options: ['About 100', 'About 250', 'About 750 or more', 'It does not matter'], answer: 2, why: 'You hit about 1 in 8, and do not always get paid, so aim for around 15 times the call.' },
        { q: 'Pot on the flop is 200 and you have 600 left. What is the SPR?', options: ['1/3', '3', '6', '800'], answer: 1, why: 'Stack ÷ pot = 600 ÷ 200 = 3. That is low: top pair can play for stacks.' },
        { q: 'Which hand suffers most from reverse implied odds?', options: ['A♠ A♥', 'A♦ 6♣', '7♠ 7♦', '8♥ 7♥'], answer: 1, why: 'A weak Ace often makes top pair with a losing kicker and pays off better Aces.' },
      ] },
      { id: 'a6', title: 'Discipline and review', pages: [
        { h: 'Variance', t: 'Even perfect play loses in the short run. Aces lose to a random hand about one time in seven. Over a few hands luck decides; over thousands, decisions do.' },
        { h: 'Tilt', t: '**Tilt** is playing worse because you are annoyed: chasing losses, calling out of spite, bluffing to "get even". Notice it and take a break. The next hand does not know what happened in the last one.' },
        { h: 'Review your hands', t: 'After each hand the table offers a **review**: your choice next to the coach\'s, street by street. Look hardest at the hands you **won** by playing badly. Those teach the wrong lesson.' },
        { h: 'One thing at a time', t: 'Pick one idea per session, such as "fold more from early position" or "work out pot odds on every call", and practise only that. Skill builds one habit at a time.' },
      ], quiz: [
        { q: 'You played a hand well and lost three times running. What should you change?', options: ['Play looser', 'Nothing, if the decisions were sound', 'Bluff more', 'Stop raising'], answer: 1, why: 'Short runs are luck. Change your play only when review shows a mistake.' },
        { q: 'What is tilt?', options: ['A type of bet', 'Playing worse because of frustration', 'A seating position', 'A split pot'], answer: 1, why: 'Tilt is emotion steering your decisions. The cure is to notice it and pause.' },
        { q: 'Which hands are most useful to review?', options: ['Only big losses', 'Only big wins', 'Hands where your choice differed from sound play, win or lose', 'None'], answer: 2, why: 'A bad play that happened to win is the most dangerous habit to keep.' },
      ] },
    ],
  },
  // Drills offered at each level (built by poker.js from the rules engine)
  drills: {
    beginner: [
      { id: 'name', icon: '🃏', title: 'Name the hand', sub: 'What do these five cards make?' },
      { id: 'winner', icon: '⚖️', title: 'Who wins?', sub: 'Two hands, one board' },
    ],
    intermediate: [
      { id: 'outs', icon: '🔢', title: 'Count your outs', sub: 'How many cards help you?' },
      { id: 'odds', icon: '💰', title: 'Call or fold?', sub: 'Outs against pot odds' },
    ],
    advanced: [
      { id: 'equity', icon: '📊', title: 'Estimate your equity', sub: 'How often do you win?' },
      { id: 'preflop', icon: '🪑', title: 'Open, call or fold?', sub: 'Starting hands by seat' },
      { id: 'bluff', icon: '🎭', title: 'Bluff maths', sub: 'How often must it work?' },
    ],
  },
};
