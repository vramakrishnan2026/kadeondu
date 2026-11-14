# Design notes and decisions

This file records **why** things look and work the way they do, including the owner's feedback, so future changes follow the same thinking.

## Hard rule: original artwork only
The owner asked for the cards to use "the same Mattel card design" and shared photos of UNO / UNO No Mercy cards as references. **We declined to copy them.** The card designs, logo and look belong to Mattel, and changing the font doesn't make a copy original. The cards here are our own design and must stay that way. Don't reintroduce a tilted white oval behind the number, the UNO logo, or any No Mercy styling. The same goes for the game's name: we use **Kade Ondu** ("last one" in Kannada) rather than "UNO". The call word stays **Ondu!** ("one").

## Cards
- Original "stamp" style: a bright colour gradient, halftone dots and faint diagonal stripes, a white rim, and an **eight-point kolam star** (two rounded squares, one turned 45°) behind a **thick italic number** with a dark outline and a 3D offset shadow. Corner numbers use the same style. 6 and 9 are underlined.
- Font: **Inter Black Italic**, subset and bundled (`public/fonts/`, OFL licence), so it looks the same on every phone. Baloo 2 from Google Fonts is a fallback.
- Wild cards: dark card with a four-colour star. Back: dark stripes with an orange "Kade Ondu" label.
- History: the first plain cards were called "boring". The owner wants "nice graphics, textures, thicker numbers in italics". The current design came from that.
- The colour picker buttons use the card colour variables. Learned the hard way: when the card CSS changed to set only variables, the picker went grey. **After restyling shared classes, check every place that uses them, visually.**

## Background and table
Deep purple background with orange, violet and teal glows and a faint dot grid. Felt table that takes the **colour being played** (deep red, mustard, green or blue; green before a round starts; set by `data-color` on `#ring` and the `--felt1..3` variables in `style.css`), with a wooden rim and a slowly turning rangoli (`fx/rangoli.svg`, generated in code). Glass-effect top bar. The owner called the earlier background "very boring".

## Layout
- **Players in a circle** around the piles: you at the bottom, the others clockwise in turn order.
- **The game screen must fit the phone with no scrolling**, and **no seat may go under the top bar**. The owner flagged overlap and scrolling as hurting the experience. Seats are placed half a seat in from the ring's edges, calculated in pixels.
- Tested sizes: 360×600, 360×690, 390×780, 412×860, 1280×720, with 2–20 players.

## Controls (research-based)
- Steven Hoober's observation study: 49% hold the phone one-handed, and of those, 67% use the right thumb. The bottom-right **corner** itself is less accurate, so main actions go just inside the right side, not in the corner.
- Minimum tap targets: Apple 44 pt, Material 48 dp. Here every target is at least 48 px.
- The owner's iterations: Draw started on the left ("most humans are right handed", and "DRAW button is very poorly designed"), then became a big card-shaped button ("very big"), then was reduced 30%. In Nov 2026 the owner found Ondu! and Draw "disproportional": Draw is used all round, so it must be big and functional, with Ondu! the same size, and **Catch!** must have a fixed, known place instead of popping up on a seat. Final layout: top row `Catch! · Ondu! · Draw` (three equal buttons), bottom row `😄 🔈 … your card count … 🎙`. **The mic must be at the far end.** Left-handed mirrors both rows.
- Draw stays in one fixed spot (greyed out when it isn't your turn), and **Keep & pass** replaces it in the same spot, so the thumb doesn't hunt for it.

## Home screen flow
Newcomers thought they **had** to create a room. The redesign: name first, then **Join a game** comes first (open rooms), then "Or start your own" (New room / Vs computer), then Online now. Shared links lead straight to a one-tap Join.

## Effects and media
- **Wild +4:** Mani's photo (`fx/mani.webp`, cut from a photo the owner supplied, soft edges) grows **centred on the screen** (the owner asked for this; it used to sit on the pile). The +4 card lands first (550 ms delay) so it's visible, and computer players wait until the effect ends. It's **off by default** (the owner asked).
  - The owner wanted Mani "looking straight", but the photo can't be re-posed by code. A front-facing photo can replace `fx/mani.webp`.
  - Sound: the spoken "Mwa ha ha" was "very irritating", and a laugh synthesised in code was called "pathetic". The owner then supplied `evil-laugh.mp3`, which is used now (loudness-normalised, mono).
- **Stickers:** six owner-supplied stickers (cleaned of stray fragments, 256 px WebP). They float **up the side** of the screen like live-stream reactions. The owner then asked for them to be "spaced out, not bunched up" and to last 2–3 s, so there are now 14 trail copies in 7 fixed lanes at even timing.
- **Icons:** emoji in the top bar looked "pathetic". The top bar now uses clean line icons (share = three connected dots, invite = person with a plus). Emoji remain in the content (😄, 🎙 labels).
- **App icon:** original orange card with an italic "1" on a dark background (generated in code).

## Accessibility
Tap targets of 48 px or more; a left-handed mode; animations respect "reduce motion"; colour is never the only signal (cards show symbols, the colour picker has text, and the current colour shows as a dot); aria-labels on icon buttons; 6 and 9 underlined.

## Table redesign (Nov 2026)
- **Fans, not badges.** The owner wanted to see opponents' cards "like how a real life opponent will hold the cards", and then asked why a circle with an initial was needed when the name is right there. So: no circles, a larger fan, name underneath. The owner also asked why their own seat was shown at all; it only repeated "Your turn" and the cards already on screen, so it was removed and the felt moved down into the space (seat maths in `app.js`, `cy = 55`).
- **Card back B** was chosen by the owner from five renders: the Kannada numeral ೧ on an orange disc. It is drawn as an SVG path (`--back-one` in `style.css`), original artwork, so every phone shows the same shape whatever fonts it has.
- **Chat position.** The owner asked for a chat that "rolls to the right and hides when playing", can be pulled out, and shows a dot for new messages. The bottom edge was rejected because that is where the cards and the phone's home gesture are. The tab sits in the table's bottom corner, which is always empty because seats lie on an oval.
- **Scoring** was discussed (everyone scoring their own leftover points) and deliberately left as it is.
