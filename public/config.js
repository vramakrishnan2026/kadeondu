// ─────────────────────────────────────────────────────────────
//  RENAME THE GAME HERE. This is the only file you need to edit.
//  Save, then run:  npx wrangler deploy
// ─────────────────────────────────────────────────────────────
window.GAME_CONFIG = {
  name: 'Kade Ondu',             // shown in the header, browser tab and share message
  callWord: 'Ondu!',             // what you shout on your last card (button text)
  tagline: 'Race to your last card. Anyone with the link can play.',

  // Shown over the table whenever someone plays a Wild +4.
  // Swap the picture by replacing public/fx/mani.webp (or point to another file).
  // sound: true = spoken evil laugh, false = silent, or a file path like 'fx/laugh.mp3'
  drawFourEffect: {
    enabled: true,
    image: 'fx/mani.webp',
    text: 'MWA-HA-HA!',
    sound: true,
    durationMs: 3000,
  },

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
