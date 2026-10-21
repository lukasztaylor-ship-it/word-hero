const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup({ unsupported = false, storageFails = false, preferences = null } = {}) {
  const elements = new Map(), listeners = {}, saved = new Map();
  if (preferences) saved.set('wordhero-audio', JSON.stringify(preferences));
  const counts = { contexts: 0, tones: 0, intervals: 0, frequencies: [] };
  function element(id) {
    if (!elements.has(id)) elements.set(id, { value: id === 'difficulty' ? 'normal' : '', textContent: '', style: {}, classList: { remove() {}, toggle() {} }, setAttribute(k,v) { this[k]=v; }, addEventListener(k,fn) { this[k]=fn; } });
    return elements.get(id);
  }
  const param = () => ({ setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  class AudioContext {
    constructor() { counts.contexts++; this.state='running'; this.currentTime=0; this.destination={}; }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createOscillator() { return { frequency: { setValueAtTime(f) { counts.frequencies.push(f); } }, connect() {}, disconnect() {}, start() { counts.tones++; }, stop() {} }; }
    resume() { this.state='running'; return Promise.resolve(); }
  }
  const drawing = new Proxy({}, { get: (_,k) => k === 'measureText' ? () => ({width:100}) : k === 'createLinearGradient' ? () => ({addColorStop(){}}) : () => {} });
  element('game').getContext = () => drawing;
  const document = { hidden:false, getElementById:element, querySelectorAll:()=>[], addEventListener(k,fn){ listeners[k]=fn; } };
  const sandbox = { document, window: { AudioContext:unsupported?undefined:AudioContext, addEventListener(k,fn) { listeners['window:'+k]=fn; } }, localStorage: { getItem(k){ if(storageFails)throw Error(); return saved.get(k)||null; }, setItem(k,v){ if(storageFails)throw Error(); saved.set(k,v); } }, performance:{now:()=>1000}, requestAnimationFrame(){}, setInterval(){counts.intervals++;return counts.intervals;}, clearInterval(){counts.intervals--;}, console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(__dirname+'/audio.js','utf8'),sandbox);
  const html=fs.readFileSync(__dirname+'/index.html','utf8');
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],sandbox);
  return { run:code=>vm.runInContext(code,sandbox), counts, element, listeners, saved, document };
}
test('gesture unlock, default music, pause/restart/game-over and volume persistence',()=>{
  const app=setup(); assert.equal(app.counts.contexts,0);
  app.listeners.pointerdown(); assert.equal(app.counts.contexts,1);
  assert.equal(app.element('music-enabled').checked,true);
  app.run('start()'); assert.equal(app.counts.intervals,1);
  app.element('music-enabled').change({target:{checked:false}}); assert.equal(app.counts.intervals,0);
  app.element('music-enabled').change({target:{checked:true}}); assert.equal(app.counts.intervals,1);
  app.run('pause()'); assert.equal(app.counts.intervals,0);
  app.run('pause()'); assert.equal(app.counts.intervals,1);
  app.element('mute').click(); assert.equal(app.counts.intervals,0); assert.equal(app.element('mute')['aria-pressed'],'true');
  app.element('mute').click(); assert.equal(app.counts.intervals,1);
  app.element('effects-volume').input({target:{value:'37'}});
  assert.equal(JSON.parse(app.saved.get('wordhero-audio')).effectsVolume,.37);
  app.document.hidden=true; app.listeners.visibilitychange(); assert.equal(app.counts.intervals,0);
  app.document.hidden=false; app.listeners.visibilitychange(); assert.equal(app.counts.intervals,1);
  app.run('start()'); assert.equal(app.counts.intervals,1);
  app.run('gameOver()'); assert.equal(app.counts.intervals,0);
});
test('old default migrates once and subsequent opt-out persists',()=>{
  const migrated=setup({preferences:{music:false,effectsVolume:.4}});
  assert.equal(migrated.element('music-enabled').checked,true);
  assert.equal(migrated.element('effects-volume').value,40);
  migrated.element('music-enabled').change({target:{checked:false}});
  const reloaded=setup({preferences:JSON.parse(migrated.saved.get('wordhero-audio'))});
  assert.equal(reloaded.element('music-enabled').checked,false);
});
test('all effect sequences, combo milestone, correct score, wrong/miss and final life',()=>{
  const app=setup(); app.listeners.pointerdown();
  for(const name of ['correct','wrong','combo','miss','gameOver']) { const before=app.counts.tones; app.run(`arcadeAudio.play('${name}')`); assert.ok(app.counts.tones>before,name); }
  app.run("globalThis.events=[];arcadeAudio.play=name=>events.push(name);start();hit(round.correct)");
  assert.equal(app.run('score'),205); assert.equal(app.run('combo'),1); assert.equal(app.run('events.at(-1)'),'correct');
  app.run('combo=4;hit(round.correct)'); assert.equal(app.run('events.at(-1)'),'combo');
  app.run('hit((round.correct+1)%4)'); assert.equal(app.run('lives'),4); assert.equal(app.run('combo'),0); assert.equal(app.run('events.at(-1)'),'wrong'); assert.ok(app.run('review && !round'));
  app.run('nextRound();miss()'); assert.equal(app.run('lives'),3); assert.equal(app.run('events.at(-1)'),'miss');
  app.run('nextRound();lives=1;miss()'); assert.equal(app.run('running'),false); assert.equal(app.run('events.at(-1)'),'gameOver');
});
test('unsupported audio and blocked storage preserve gameplay',()=>{
  const app=setup({unsupported:true,storageFails:true}); app.listeners.pointerdown(); app.run('start();hit(round.correct);pause();pause()'); assert.equal(app.run('score'),205);
});
test('native audio controls keep keyboard behavior',()=>{
  const app=setup(); const event={key:'Enter',target:{closest:()=>({})},preventDefault(){throw Error('native key intercepted');}};
  app.listeners['window:keydown'](event); assert.equal(app.run('running'),false);
});
test('number keys still answer after clicking Start',()=>{
  const app=setup(); app.run('start()');
  app.listeners['window:keydown']({key:String(app.run('round.correct')+1),target:{closest:selector=>selector==='button'?{}:null},preventDefault(){}});
  assert.equal(app.run('combo'),1);
});
test('Space starts, pauses, resumes and restarts after game over without key-repeat toggles',()=>{
  const app=setup();
  const press=(repeat=false)=>app.listeners['window:keydown']({key:' ',code:'Space',repeat,target:{closest:()=>null},preventDefault(){}});
  press(); assert.equal(app.run('running'),true); assert.equal(app.run('paused'),false);
  press(true); assert.equal(app.run('paused'),false);
  press(); assert.equal(app.run('paused'),true);
  press(true); assert.equal(app.run('paused'),true);
  press(); assert.equal(app.run('paused'),false);
  app.run('gameOver()'); press(); assert.equal(app.run('running'),true); assert.equal(app.run('lives'),5);
});
test('Space works on focused game buttons and keeps native audio controls',()=>{
  const app=setup();
  const event={key:' ',code:'Space',target:{closest:s=>s==='button'||s==='#start,#pause,[data-lane]'?{}:null},preventDefault(){}};
  app.listeners['window:keydown'](event); assert.equal(app.run('running'),true);
  app.listeners['window:keydown'](event); assert.equal(app.run('paused'),true);
  app.listeners['window:keydown']({...event,target:{closest:s=>s==='button'?{}:null},preventDefault(){throw Error('audio button key intercepted');}});
  assert.equal(app.run('paused'),true);
});
test('all five tracks play and switch without changing game or duplicating timers',()=>{
  const app=setup(); app.listeners.pointerdown(); app.run('start()');
  const signatures=[];
  for (const track of ['adventure','speedrun','starlight','neon','victory']) {
    app.counts.frequencies.length=0;
    app.element('music-track').change({target:{value:track}});
    assert.equal(app.counts.intervals,1);
    assert.equal(app.run('score'),0); assert.equal(app.run('lives'),5);
    signatures.push(app.counts.frequencies.join(','));
    assert.equal(JSON.parse(app.saved.get('wordhero-audio')).track,track);
  }
  assert.equal(new Set(signatures).size,5);
  app.run('pause()'); app.element('music-track').change({target:{value:'neon'}});
  assert.equal(app.counts.intervals,0);
  app.run('pause()'); assert.equal(app.counts.intervals,1);
  const reloaded=setup({preferences:JSON.parse(app.saved.get('wordhero-audio'))});
  assert.equal(reloaded.element('music-track').value,'neon');
  assert.equal(setup({preferences:{track:'invalid'}}).element('music-track').value,'adventure');
});
