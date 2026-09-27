// ============================================================
// Cargo Foundry — generative industrial soundtrack
// Depends on: config.js (BPM-ish constants not needed), game.js (Game, ROWS, COLS)
//
// Pure Web Audio: no audio files, no dependencies. A 4-bar loop at
// 116 BPM — four-on-the-floor kick, hats, a metallic "clank" on the
// backbeat, driving saw bass — plus an echoing minor-pentatonic arp
// that fades in as your factory grows. The music builds with the factory.
//
// Autoplay policy: the AudioContext is created on the first user
// gesture (see initUI). The 🔊 button toggles mute; the preference
// persists in localStorage.
// ============================================================

const CFMusic = (() => {
  const BPM = 116;
  const STEPS = 64;                 // 4 bars of 16th notes
  const STEP_DUR = 60 / BPM / 4;

  // Chord roots per bar: Am, Am, F, G (Hz)
  const ROOTS = [55, 55, 43.65, 49];
  // A-minor pentatonic-ish ladder for the arp (A3..A4)
  const PENTA = [220, 261.63, 293.66, 329.63, 392, 440];
  const ARP_PATTERN = [0, 2, 4, 5, 4, 2, 1, 3, 0, 2, 4, 5, 3, 2, 1, 0];

  let ctx = null;
  let master = null;    // mute lives here
  let musicBus = null;  // dry mix
  let arpBus = null;    // arp -> dry + echo
  let noiseBuf = null;
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let level = 0;        // 0 = starter groove, 1 = +arp, 2 = +extra clank & open filter
  let started = false;
  let muted = false;

  try { muted = localStorage.getItem('cargo-foundry-music') === 'off'; } catch (e) { /* private mode */ }

  // ---- setup ----------------------------------------------------
  function ensureCtx() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    // Dotted-eighth echo, just for the arp
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = STEP_DUR * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    const wet = ctx.createGain(); wet.gain.value = 0.4;
    const send = ctx.createGain();
    send.connect(delay); delay.connect(fb); fb.connect(delay);
    delay.connect(wet); wet.connect(master);

    musicBus = ctx.createGain(); musicBus.connect(master);
    arpBus = ctx.createGain(); arpBus.connect(musicBus); arpBus.connect(send);

    // 0.5s of white noise, reused by hats/clanks
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // ---- voices ---------------------------------------------------
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.11);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.16);
  }

  function hat(t, accent) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = 1.2;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(accent ? 0.22 : 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    src.connect(f); f.connect(g); g.connect(musicBus);
    src.start(t); src.stop(t + 0.07);
  }

  // Metallic factory "clank": detuned squares through a bandpass
  function clank(t, vol, freq) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    const bp = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = 'square'; o1.frequency.value = freq;
    o2.type = 'square'; o2.frequency.value = freq * 1.51;
    bp.type = 'bandpass'; bp.frequency.value = freq * 2; bp.Q.value = 2.5;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o1.connect(bp); o2.connect(bp); bp.connect(g); g.connect(musicBus);
    o1.start(t); o2.start(t); o1.stop(t + 0.14); o2.stop(t + 0.14);
  }

  function bass(t, freq, cutoff) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + STEP_DUR * 1.8);
    o.connect(f); f.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + STEP_DUR * 2);
  }

  function arpNote(t, freq) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + STEP_DUR * 1.5);
    o.connect(g); g.connect(arpBus);
    o.start(t); o.stop(t + STEP_DUR * 1.6);
  }

  // ---- sequencer ------------------------------------------------
  function machineCount() {
    if (typeof Game === 'undefined' || !Game.grid || !Game.grid.length) return 0;
    let n = 0;
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (Game.grid[y][x].b) n++;
    return n;
  }

  function playStep(s, t) {
    const bar = Math.floor(s / 16);
    const s16 = s % 16;
    if (s16 === 0) {
      // Re-evaluate intensity once per bar: the music grows with the factory
      const n = machineCount();
      level = n >= 14 ? 2 : n >= 6 ? 1 : 0;
    }

    if (s16 % 4 === 0) kick(t);                       // four on the floor
    if (s16 % 2 === 0) hat(t, s16 % 4 === 2);         // 8th hats, offbeat accent
    if (s16 === 4 || s16 === 12) clank(t, 0.38, 620); // backbeat clank

    // Driving 8th-note bass on the bar's chord root; octave pop at the turnaround
    if (s16 % 2 === 0) {
      const root = ROOTS[bar] * (s16 === 14 ? 2 : 1);
      bass(t, root, 220 + level * 260);
    }

    if (level >= 1) arpNote(t, PENTA[ARP_PATTERN[s16]]);       // the factory sings
    if (level >= 2 && (s16 === 2 || s16 === 7 || s16 === 10 || s16 === 14))
      clank(t, 0.16, 1240);                                    // extra high clanks
  }

  function scheduler() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.15) {
      playStep(step, nextTime);
      nextTime += STEP_DUR;
      step = (step + 1) % STEPS;
    }
  }

  // ---- public API -----------------------------------------------
  function start() {
    if (started) return;
    ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    step = 0;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(scheduler, 25);
    started = true;
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('cargo-foundry-music', m ? 'off' : 'on'); } catch (e) { /* ignore */ }
    if (ctx && master) master.gain.linearRampToValueAtTime(m ? 0 : 0.5, ctx.currentTime + 0.15);
  }

  return {
    start,
    toggle() { start(); setMuted(!muted); },
    isMuted: () => muted,
    isPlaying: () => started && !muted,
    _step: () => step, // QA hook: confirm the scheduler is advancing
  };
})();
