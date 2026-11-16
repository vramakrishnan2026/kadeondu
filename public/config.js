// ─────────────────────────────────────────────────────────────
//  RENAME THE GAME HERE. This is the only file you need to edit.
//  Save, then run:  npx wrangler deploy
// ─────────────────────────────────────────────────────────────
window.GAME_CONFIG = {
  name: 'Kade Ondu',             // shown in the header, browser tab and share message
  callWord: 'Ondu!',             // what you shout on your last card (button text)
  tagline: 'Race to your last card. Anyone with the link can play.',
  credits: 'Created by Vinay Ramakrishnan',   // shown at the bottom of the home screen

  // The custom Wild +4 effect (photo + laugh). SWITCHED OFF at the owner's request (Nov 2026):
  // with enabled: false the effect never plays and the "Wild +4 laugh animation" setting is hidden.
  // Set enabled: true to bring both back.
  // Swap the picture by replacing public/fx/mani.webp (or point to another file).
  // sound: a sound file to play, false = silent, true = the phone speaks "mwa ha ha"
  drawFourEffect: {
    enabled: false,
    image: 'fx/mani.webp',
    text: 'MWA-HA-HA!',
    sound: 'fx/evil-laugh.mp3',   // your own recording works too, e.g. 'fx/mani-laugh.mp3'
    durationMs: 3000,
  },

  // Reactions (room setting, off by default): ordinary emoji that float up the side of the screen.
  // The ids must match the REACTIONS list in src/worker.js. (Photo stickers were used here until Nov 2026.)
  reactions: [
    { id: 'up',    emoji: '👍', label: 'Thumbs up' },
    { id: 'lol',   emoji: '😂', label: 'Laughing' },
    { id: 'wow',   emoji: '😮', label: 'Surprised' },
    { id: 'sad',   emoji: '😢', label: 'Sad' },
    { id: 'angry', emoji: '😡', label: 'Angry' },
    { id: 'evil',  emoji: '😈', label: 'Evil grin' },
    { id: 'clap',  emoji: '👏', label: 'Clapping' },
    { id: 'fire',  emoji: '🔥', label: 'Fire' },
  ],

  // Colours of the four suits and the app accent
  theme: {
    red: '#e5484d',
    yellow: '#f2b705',
    green: '#2f9e5b',
    blue: '#1f7ae0',
    accent: '#ff6a2b',
    background: '#17171c',
  },
};
