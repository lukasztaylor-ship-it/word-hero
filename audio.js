/* Word Hero v0.5: original procedural arcade audio; no samples or borrowed melodies. */
const arcadeAudio = (() => {
  // Five original compositions: distinct melodies, harmonies and tempos.
  const tracks = {
    adventure: { beat: .16, lead: 'square', melody: [76,0,71,74,79,76,0,69,74,78,71,0,67,74,69,0, 76,79,83,0,81,76,74,71,78,74,69,0,71,74,76,0], bass: [40,43,38,40,45,43,38,40] },
    speedrun: { beat: .115, lead: 'square', melody: [74,77,81,77,72,76,79,76,70,74,77,81,79,76,72,0, 74,81,86,81,84,79,76,72,82,77,74,70,76,79,81,0], bass: [38,36,34,36,38,36,34,33] },
    starlight: { beat: .215, lead: 'triangle', melody: [83,0,78,0,81,78,74,0,76,0,81,0,78,74,71,0, 78,0,85,83,81,0,78,0,74,76,78,0,73,0,71,0], bass: [47,43,45,42,47,43,40,42] },
    neon: { beat: .145, lead: 'square', melody: [69,0,76,72,0,79,76,0,67,74,0,71,78,0,74,71, 69,72,0,81,79,0,76,72,74,0,78,81,0,78,74,0], bass: [33,41,43,40,33,41,38,40] },
    victory: { beat: .18, lead: 'square', melody: [72,76,79,0,81,79,76,0,74,77,81,0,83,81,77,0, 76,79,84,83,81,0,79,76,77,74,71,0,74,79,72,0], bass: [36,45,38,43,40,45,41,43] }
  };
  const defaults = { muted: false, music: true, track: 'adventure', effectsVolume: 0.65, musicVolume: 0.25 };
  let settings = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem('wordhero-audio'));
    if (Object.hasOwn(tracks, saved?.track)) settings.track = saved.track;
    if (typeof saved?.muted === 'boolean') settings.muted = saved.muted;
    // Adopt the new default once, then remember deliberate toggle changes.
    if (saved?.musicDefaultOn === true && typeof saved.music === 'boolean') settings.music = saved.music;
    for (const key of ['effectsVolume', 'musicVolume']) if (Number.isFinite(saved?.[key])) settings[key] = Math.max(0, Math.min(1, saved[key]));
  } catch {}
  let context, master, effects, music, timer = null, active = false, step = 0, nextBeat = 0;
  const voices = new Set();
  const patterns = {
    correct: [[784, 0, .07], [1175, .075, .12]],
    wrong: [[185, 0, .11], [139, .11, .16]],
    combo: [[659, 0, .07], [988, .075, .07], [1319, .15, .08], [1568, .23, .16]],
    miss: [[440, 0, .09], [294, .10, .09], [147, .20, .18]],
    gameOver: [[392, 0, .14], [330, .17, .14], [247, .34, .18], [131, .56, .38]]
  };
  function levels() {
    if (!context) return;
    master.gain.setTargetAtTime(settings.muted || document.hidden ? 0 : 0.45, context.currentTime, .01);
    effects.gain.setTargetAtTime(settings.effectsVolume, context.currentTime, .01);
    music.gain.setTargetAtTime(settings.musicVolume, context.currentTime, .01);
  }
  function tone(frequency, when, duration, bus, type = 'square', amplitude = .18) {
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(amplitude, when + .004);
    envelope.gain.exponentialRampToValueAtTime(.0001, when + duration);
    oscillator.connect(envelope); envelope.connect(bus);
    const voice = { oscillator, envelope, bus };
    voices.add(voice);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); voices.delete(voice); };
    oscillator.start(when); oscillator.stop(when + duration + .01);
  }
  function stopVoices(bus) {
    for (const voice of voices) if (!bus || voice.bus === bus) {
      voice.envelope.gain.cancelScheduledValues(context.currentTime);
      voice.envelope.gain.setTargetAtTime(.0001, context.currentTime, .005);
      try { voice.oscillator.stop(context.currentTime + .025); } catch {}
    }
  }
  function stopMusic() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    if (context) stopVoices(music);
  }
  const hz = midi => 440 * 2 ** ((midi - 69) / 12);
  function schedule() {
    if (context.state !== 'running') return;
    if (nextBeat < context.currentTime) nextBeat = context.currentTime + .02;
    const track = tracks[settings.track];
    while (nextBeat < context.currentTime + .12) {
      const note = track.melody[step];
      if (note) tone(hz(note), nextBeat, track.beat * .75, music, track.lead, .10);
      if (step % 4 === 0) tone(hz(track.bass[(step / 4) % track.bass.length]), nextBeat, track.beat * 3, music, 'triangle', .28);
      step = (step + 1) % track.melody.length; nextBeat += track.beat;
    }
  }
  function sync() {
    levels();
    const shouldPlay = context?.state === 'running' && active && settings.music && !settings.muted && !document.hidden;
    if (!shouldPlay) { stopMusic(); return; }
    if (timer === null) { nextBeat = context.currentTime + .03; schedule(); timer = setInterval(schedule, 40); }
  }
  function unlock() {
    try {
      if (!context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) { document.getElementById('audio-status').textContent = 'Audio unavailable in this browser.'; return; }
        context = new AudioContext();
        master = context.createGain(); effects = context.createGain(); music = context.createGain();
        effects.connect(master); music.connect(master); master.connect(context.destination);
        context.onstatechange = sync;
        levels();
      }
      if (context.state !== 'running') context.resume().then(sync).catch(() => {});
      sync();
    } catch { document.getElementById('audio-status').textContent = 'Audio unavailable; the game is still ready.'; }
  }
  function play(name) {
    if (!context || context.state !== 'running' || settings.muted || document.hidden || !settings.effectsVolume) return;
    try {
      if (name === 'gameOver') stopVoices(effects);
      const now = context.currentTime + .005;
      for (const [frequency, offset, duration] of patterns[name] || []) tone(frequency, now + offset, duration, effects);
    } catch {} // Audio must never interrupt scoring or the game loop.
  }
  function renderSettings() {
    const mute = document.getElementById('mute');
    mute.textContent = settings.muted ? 'Unmute' : 'Mute';
    mute.setAttribute('aria-pressed', String(settings.muted));
    document.getElementById('music-enabled').checked = settings.music;
    document.getElementById('music-track').value = settings.track;
    for (const [id, key] of [['effects-volume', 'effectsVolume'], ['music-volume', 'musicVolume']]) {
      document.getElementById(id).value = Math.round(settings[key] * 100);
      document.getElementById(id + '-value').textContent = Math.round(settings[key] * 100) + '%';
    }
  }
  function update(key, value) {
    settings[key] = value;
    try { localStorage.setItem('wordhero-audio', JSON.stringify({ ...settings, musicDefaultOn: true })); } catch {}
    renderSettings(); unlock(); sync();
  }
  document.getElementById('mute').addEventListener('click', () => update('muted', !settings.muted));
  document.getElementById('music-enabled').addEventListener('change', e => update('music', e.target.checked));
  document.getElementById('music-track').addEventListener('change', e => {
    if (!Object.hasOwn(tracks, e.target.value)) return;
    stopMusic(); step = 0;
    update('track', e.target.value);
  });
  for (const [id, key] of [['effects-volume', 'effectsVolume'], ['music-volume', 'musicVolume']]) {
    document.getElementById(id).addEventListener('input', e => update(key, Number(e.target.value) / 100));
  }
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden && context) stopVoices(); sync(); });
  renderSettings();
  return {
    play,
    setActive(value) { active = value; sync(); },
    reset() { if (context) stopVoices(); stopMusic(); step = 0; }
  };
})();
