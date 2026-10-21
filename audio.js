/* Word Hero v0.5: original procedural arcade audio; no samples or borrowed melodies. */
const arcadeAudio = (() => {
  const defaults = { muted: false, music: false, effectsVolume: 0.65, musicVolume: 0.25 };
  let settings = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem('wordhero-audio'));
    for (const key of ['muted', 'music']) if (typeof saved?.[key] === 'boolean') settings[key] = saved[key];
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
  // An original 16-step phrase, with triangle bass underneath the pulse lead.
  const melody = [76, 0, 71, 74, 79, 76, 0, 69, 74, 78, 71, 0, 67, 74, 69, 0];
  const bass = [40, 40, 43, 38];
  const hz = midi => 440 * 2 ** ((midi - 69) / 12);
  function schedule() {
    if (context.state !== 'running') return;
    if (nextBeat < context.currentTime) nextBeat = context.currentTime + .02;
    while (nextBeat < context.currentTime + .12) {
      const note = melody[step % melody.length];
      if (note) tone(hz(note), nextBeat, .12, music, 'square', .10);
      if (step % 4 === 0) tone(hz(bass[(step / 4) % bass.length]), nextBeat, .48, music, 'triangle', .28);
      step = (step + 1) % 16; nextBeat += .16;
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
    for (const [id, key] of [['effects-volume', 'effectsVolume'], ['music-volume', 'musicVolume']]) {
      document.getElementById(id).value = Math.round(settings[key] * 100);
      document.getElementById(id + '-value').textContent = Math.round(settings[key] * 100) + '%';
    }
  }
  function update(key, value) {
    settings[key] = value;
    try { localStorage.setItem('wordhero-audio', JSON.stringify(settings)); } catch {}
    renderSettings(); unlock(); sync();
  }
  document.getElementById('mute').addEventListener('click', () => update('muted', !settings.muted));
  document.getElementById('music-enabled').addEventListener('change', e => update('music', e.target.checked));
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
