// ─────────────────────────────────────────────────────────────
//  RENAME THE GAME HERE. This is the only file you need to edit.
//  Save, then run:  npx wrangler deploy
// ─────────────────────────────────────────────────────────────
window.GAME_CONFIG = {
  name: 'Kade Ondu',             // shown in the header, browser tab and share message
  callWord: 'Ondu!',             // what you shout on your last card (button text)
  tagline: 'Race to your last card. Anyone with the link can play.',
  credits: 'Created by Vinay Ramakrishnan',   // shown at the bottom of the home screen

  // Shown over the table whenever someone plays a Wild +4.
  // Swap the picture by replacing public/fx/mani.webp (or point to another file).
  // sound: a sound file to play, false = silent, true = the phone speaks "mwa ha ha"
  drawFourEffect: {
    enabled: true,
    image: 'fx/mani.webp',
    text: 'MWA-HA-HA!',
    sound: 'fx/evil-laugh.mp3',   // your own recording works too, e.g. 'fx/mani-laugh.mp3'
    durationMs: 3000,
  },

  // Sticker reactions (room setting, off by default). Pictures live in public/fx/reactions/.
  // label: caption shown under the sticker ('' when the picture already has its own text)
  reactions: [
    { id: 'nice_play',  label: 'Nice play!' },
    { id: 'really',     label: 'Really?' },
    { id: 'whats_next', label: "What's next?" },
    { id: 'oh_no',      label: 'Oh no!' },
    { id: 'angry',      label: '' },
    { id: 'evil',       label: '' },
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
