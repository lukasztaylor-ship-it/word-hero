# Word Hero v0.5 — Retro Arcade Edition

Play at https://lukasztaylor-ship-it.github.io/word-hero/

Translate Polish vocabulary into English with keys 1–4 or the lane buttons. Space starts, pauses or resumes the game; Enter also starts. Existing scoring, difficulty, best score, lives and correction review are preserved.

Original procedural Web Audio effects cover correct answers, wrong answers, every fifth consecutive correct answer, misses and game over. Square-wave lead and triangle bass create an optional original chiptune; no samples or copyrighted melodies are used.

Audio unlocks after a tap or keypress. Music defaults on (the toggle remains available) and runs only during active play; pause, game over, mute, and hidden tabs stop it. Mute and separate effects/music volumes persist locally when storage is available. The game remains playable without Web Audio or local storage.

Static GitHub Pages site served from main; no build or dependencies required.

Run regression tests with Node.js: `node --test test.cjs`.

Choose from five original tracks: Arcade Adventure, Speed Run, Starlight Study, Neon Nights and Victory Circuit. Switching tracks restarts the music phrase without restarting the game; the selection is saved locally.
