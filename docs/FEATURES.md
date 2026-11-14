# Features

## Getting into a game (home screen)

1. **First visit:** only "What should we call you?" plus a 3-line "how it works" guide. Tap **Let's play**.
2. **Main menu:** "Hi *name* 👋" (with **change name**), then, in order:
   - **Join a game:** live list of open rooms (host, code, players, watchers, status: Waiting / In game / Between rounds) with Join or Watch buttons. **Got a room code?** is a fold-out under it.
   - **Or start your own:** tiles for 🎉 **New room** and 🤖 **Vs computer**.
   - **Online now:** everyone with the site open who has typed a name, shown as "● Online", "In Arun's room" or "In a private room". Each has an **Invite** button (inviting from the home screen creates a room first).
   - **✋ Left-handed controls** (saved per phone), **📲 Install app**, credits line, and a TEMPORARY **🎙 Voice test** link.
3. **Opening a shared link** (`?room=CODE`):
   - First-timers see "You're invited!" and type their name. **Join the game** puts them straight in.
   - Returning players see an invite card at the top with **Join this game**.
4. If a phone reconnects (lock screen, Wi-Fi drop, refresh), the player goes back to the same seat with the same cards (saved session in localStorage).

## Rooms

- 4-character codes (no confusing letters such as O/0 or I/1). One extra 108-card deck per 10 players, and a fresh deck opens if the draw pile ever runs out.
- **Joining mid-round:** the newcomer **watches** (sees the table, card counts and whose turn it is, but no hands) and is dealt in when the round ends.
- **Host:** the first person in the room. If the host leaves, the next person (never a computer player) becomes host.
- Host powers: start rounds, change settings (between rounds), remove players, add computer players, **Skip their turn** for an offline player.
- Rooms are deleted 24 h after their last activity. They leave the Open rooms list as soon as nobody is connected.

### Room settings (host, in the waiting area)

| Setting | Default | Notes |
|---|---|---|
| Allow stacking +2 / +4 | off | +2 on +2, +4 on +2 or +4. The next player stacks or picks up the total |
| Cards per hand | 7 | 5, 7 or 10 |
| Time per turn | **15 s** | Off, 10, 15, 20, 30, 45 or 60 |
| End round after | **3 min** | Off, 3, 5, 7 or 10 min |
| Computer players | Normal | Easy or Normal level for players added with 🤖 Add computer player |
| Wild +4 laugh animation | **off** | Mani appears with the evil laugh |
| 😄 Sticker reactions | **off** | Shows the 😄 button and sticker tray |
| 🔒 Private room | off | Hidden from Open rooms; join only with the link or code |

Guests see a one-line summary of the settings.

## Rules (as implemented in `public/shared/game.js`)

- Deck per 108 cards: numbers 0 (one per colour) and 1–9 (two each), Skip, Reverse and Draw 2 (two each per colour), 4 Wild, 4 Wild +4.
- The starting card is flipped until a number card shows.
- Match the colour or the symbol. Wilds can always be played, and a **Wild +4 can be played at any time** (no challenge rule).
- If you can't (or don't want to) play: draw 1. If the drawn card fits, play it or tap **Keep & pass**. If it doesn't fit, your turn ends automatically.
- Reverse with 2 players acts as Skip. Draw 2 and Wild +4 make the next player draw and lose their turn (unless stacking is on).
- **Calling "Ondu!":** tap the call button while you hold 2 cards on your turn, or right after dropping to 1. If you forget, anyone can tap the **Catch!** button until the next player moves, and you pick up 2. Catch! has one fixed place at the left of the top button row: grey all the time, red when someone can be caught (their name also turns red).
- Round winner scores everyone else's leftover cards: numbers at face value, action cards 20, wilds 50. Scores carry over between rounds.

## Turn timer

A bar under the current player's name empties as time runs out, with the seconds shown next to "Your turn". It turns red in the last 5 seconds, and your phone buzzes. When time is up, the game makes the **simplest move** for that person: it plays the first card that fits (even a wild, with the colour taken from their hand), otherwise draws and plays the drawn card if it fits, or passes. It **never calls Ondu!** for them. The timer only applies to people, and it keeps a game moving if someone disconnects (as long as one person stays connected).

## Inactive players

If the turn timer has to play or draw for a person **5 turns in a row**, a red **✕** appears on their cards for every other player in the round (not for watchers, and never on computer players). Tapping it asks "Remove Priya for being inactive?" and, on **Remove**, takes them out: their cards go to the bottom of the draw pile and the round carries on. Any player can do this, not only the host. The count goes back to 0 the moment the person plays a turn themselves, and they are warned when they reach 5. A removed player can rejoin with the link like any new joiner (watching until the next round). With **Time per turn** set to Off there are no auto-moves, so this never applies.

## Round time limit

**End round after** (Off, 3, 5, 7 or 10 min; **3 min by default**, at the owner's request) puts a clock on every round. The time left shows under the discard pile (⏳ 2:41) and turns red in the last 30 seconds. The clock restarts each round.

When it runs out and nobody has finished their cards, the player whose remaining cards add up to the **lowest card points** wins the round (numbers at face value, action cards 20, wilds 50). Ties go to whoever holds fewer cards, then to whoever would play next. Scoring is the same as a normal win: the winner gets the points of everyone else's leftover cards. A move that arrives after the limit doesn't count. It works in rooms and in Play vs computer.

## Join stats (owner only)

Every time someone **starts or joins a room**, the server notes the time, the name they typed, their approximate **city / region / country** (from Cloudflare, based on the internet connection; the IP address itself is not kept) and whether they started the room or joined it. Reconnects and Play vs computer games are not counted. Entries are deleted after **90 days**.

The owner sees them at **`/stats.html`** after typing the stats password: totals, joins by city, joins by day and the recent joins list, for today / 7 / 30 / 90 days. The password is the `STATS_KEY` secret in Cloudflare (see [DEPLOYMENT.md](DEPLOYMENT.md)); until it is set, the page shows nothing to anyone. The home screen tells players: "When you join a room, the game notes your name and approximate city (from your internet connection) for the creator's stats."

City is approximate: mobile data often shows the carrier's hub city, and a VPN shows the VPN's location.

## Computer players

- **🤖 Play vs computer** (solo): 1–9 computer players, Easy/Normal, cards per hand, time per turn, stacking, Wild +4 laugh and stickers. It runs entirely in the browser (no room, nothing on the server).
- **🤖 Add computer player** in rooms: up to 20, before a round or between rounds. They show as 🤖 and **COMPUTER**, and can be removed like anyone else.
- **Easy:** plays a random card that fits, picks a random colour, calls Ondu! only about 55% of the time, and rarely catches people.
- **Normal:** saves wilds, plays its strongest colour, dumps high cards, aims action cards and +4 at whoever is about to win, always calls, and catches people about 75% of the time.
- They pause before moving (0.75–1.35 s, 1.8 s+ when someone could be caught, plus 3.3 s after a Wild +4 when that animation is on).
- In 1,800 simulated games, Normal beat Easy about 64% of the time.

## Table and animations

- Players sit in a circle around the piles, with you at the bottom and the others clockwise in turn order. Seats shrink past 8 and 14 players, and 20 players still fit on a phone.
- The game screen fits the phone exactly: no scrolling, and seats never go under the top bar. It re-lays out when the phone rotates.
- Played cards fly from the player's seat (or your hand) to the pile, and drawn cards fly from the deck to the seat. Animations are skipped if the phone has "reduce motion" on.
- **Wild +4 effect** (setting): the +4 lands first, then Mani rises, centred on the screen, grows, bobs while laughing ("MWA-HA-HA!"), the screen glows red and the phone buzzes. It lasts 3 s with `fx/evil-laugh.mp3`. Configured under `drawFourEffect` in `config.js`.

## Controls (bottom bar, built for thumbs)

Two rows. **Top row: Catch! · Ondu! · Draw**, three equal buttons 54 px tall (50 px on small phones) that never move. Draw is the one used all round, so it is the solid orange one at the right thumb; Catch! and Ondu! stay grey until they can be used. Draw greys out when it isn't your turn, turns red with "Pick up 4" when a penalty is waiting, and becomes **Keep & pass** in the same spot after you draw. Tapping the deck on the table also draws. **Bottom row:** 😄 stickers · 🔈 mute · (Skip their turn / 🏆 Scores) on the left, **your own card count** (and points, once anyone has some) in the middle, and the 🎙 mic at the far right. **✋ Left-handed controls** mirrors both rows. All tap targets are at least 48 px.

## The table

- **Opponents hold their cards like real ones:** each player is a fan of face-down cards, one per card in their hand (up to 7, then "+N"; up to 5 in rooms of 15 or more), with the name underneath. There are no circles with initials. The fan shrinks in bigger rooms, and switches to a smaller size by itself if it would cover the piles.
- **You have no seat:** your place is the bottom of the table, where your cards are. "Your turn" and the count by the mic say the rest. Someone who is only watching sees every player around the table.
- **Whose turn:** the name turns orange and the fan glows. **Stepped away:** the fan fades. **Computer players** have 🤖 before the name.
- **Scores under names** appear once anyone has points (so not in round 1). The full list is on 🏆 Scores and the round-end screen. Scoring is unchanged: the round winner collects everyone else's leftover points.
- **Card back:** the Kannada numeral ೧ ("ondu" = one) on an orange disc, on a charcoal card. Used on the draw pile, the fans, flying cards and the small deck on the Draw button.

## Room chat (rooms only)

- **Always on**, for everyone in the room: players and people watching. Text only, up to 200 characters, one message a second each. Not in Play vs computer.
- **Hidden while you play:** a small 💬 tab sits at the right edge (left edge in left-handed mode), in the table's empty bottom corner. A **green dot** on it means a new message. Tap or pull the tab to slide the chat in; tap ✕, tap outside, or swipe it back to hide it.
- **History:** the room keeps the **last 200 messages** (oldest dropped first), so late joiners and watchers can scroll back, and a refresh keeps the chat. Watchers' messages are marked "· watching".
- **When it is wiped:** as soon as every person has tapped Leave (computer players don't count), when nobody has been connected for 5 minutes, and with the room itself. This is the one thing in a room that is stored; voice notes and stickers are still only passed along.

## Voice notes (rooms only)

- **Hold the 🎙 mic** to talk (up to 5 s), and let go to send. Everyone else in the room hears it, with a 🔊 bubble on the sender's fan (your own shows by the mic). Each player can send one every 2.5 s. **Never stored**: the server only relays it.
- **🔈 mute** stops incoming voice notes on that phone (remembered).
- **🎙 Turn on voice notes** button: brings up the microphone permission pop-up with one tap. If the mic is blocked, it turns red ("Mic blocked: how to fix") and opens step-by-step instructions for that browser (iPhone + Brave / Safari / Chrome, Android).
- iPhone details: sound is unlocked on the first tap; the mic stays open once allowed (orange dot) so Safari doesn't ask on every hold; recording prefers MP4/AAC, which every phone can play.

## Sticker reactions (setting)

The 😄 button opens a tray of six stickers of the owner's friend: Nice play!, Really?, What's next?, Oh no!, Angry!, Evil!. The sent sticker floats up the right side of everyone's screen (the left side in left-handed mode) with its caption and the sender's name, followed by 14 smaller copies in 7 lanes. It lasts about 3 s and each player can send one every 1.2 s. Never stored. The pictures are in `public/fx/reactions/` and the captions in `config.js`.

## Sharing and invites

- The **share icon** in the top bar opens a panel: **Share to apps** (the phone's own share menu, listing every messaging app), **WhatsApp** (pre-filled), and **Copy link**. Inside a room it shares the room link ("Join my Kade Ondu game! Room ABCD"); elsewhere it shares the main link.
- **Invites:** the **👤+** icon in a room (or the waiting-area button) lists people who are online. The invited person gets a pop-up with **Join** or **Not now**, and the inviter is told if they decline. You can't invite someone who's already in a room. At most one invite per person every 10 s.

## Round over

Results pop up for everyone (winner, points, scoreboard). Everyone can **Close** it, and **🏆 Scores** reopens it. The host has **Next round** both in the pop-up and in the bottom bar.

## Installable app

Manifest, icons (an original orange card with an italic "1") and an offline helper. Android/Chrome shows **📲 Install app**. On iPhone, tapping it shows the Safari steps (Share → Add to Home Screen).

## Connection indicator

The dot in the top bar is green when connected, amber while connecting, and red when offline. Reconnection is automatic.
