// All sound is synthesized: slaps, bonks, thuds, a procedural phonk loop, and speech-synth shouting.
let ctx = null, master, sfx, music, noiseBuf, shaper;
export const settings = { sound: true, music: true, voices: true };
export let beat = 0; // 1 on each kick, decays in the game loop
export function decayBeat(dt) { beat = Math.max(0, beat - dt * 4); }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  sfx = ctx.createGain(); sfx.connect(master);
  music = ctx.createGain(); music.gain.value = settings.music ? 0.32 : 0; music.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 3.2); }
  shaper.curve = curve; shaper.connect(music);
  applySettings();
  startMusic();
}
export function applySettings() {
  if (!ctx) return;
  sfx.gain.value = settings.sound ? 1 : 0;
  music.gain.setTargetAtTime(settings.music ? 0.32 : 0, ctx.currentTime, 0.1);
  if (!settings.voices && window.speechSynthesis) speechSynthesis.cancel();
}

function noise(t, dur, type, freq, q, peak, out = sfx, rate = 1) {
  peak = Math.max(peak, 0.0002);
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = rate;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  return f;
}
function tone(t, type, f0, f1, dur, peak, out = sfx) {
  peak = Math.max(peak, 0.0002);
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  return o;
}

export function play(name, k = 1) {
  if (!ctx || !settings.sound) return;
  const t = ctx.currentTime, j = 0.85 + Math.random() * 0.3;
  switch (name) {
    case 'slap': // skin crack + meaty thump
      noise(t, 0.09, 'highpass', 1100 * j, 0.7, 0.9 * k, sfx, j);
      noise(t, 0.05, 'bandpass', 3200 * j, 1.2, 0.6 * k);
      tone(t, 'sine', 240 * j, 70, 0.08, 0.55 * k);
      break;
    case 'fish': {
      noise(t, 0.08, 'highpass', 900, 0.7, 0.7 * k);
      const f = noise(t, 0.28, 'bandpass', 1400, 3, 0.7 * k);
      f.frequency.setValueAtTime(1600 * j, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.25);
      tone(t, 'sine', 180, 60, 0.12, 0.5 * k);
      break;
    }
    case 'bonk':
      for (const [f, d, a] of [[392, 0.6, 0.4], [1046, 0.4, 0.25], [1987, 0.25, 0.15], [2893, 0.18, 0.08]]) tone(t, 'sine', f * j, f * j * 0.98, d, a * k);
      noise(t, 0.04, 'highpass', 2000, 0.7, 0.5 * k);
      tone(t, 'triangle', 160, 60, 0.15, 0.5 * k);
      break;
    case 'crack':
      noise(t, 0.045, 'highpass', 2200 * j, 0.7, 1.0 * k);
      tone(t, 'square', 1800 * j, 600, 0.03, 0.12 * k);
      break;
    case 'mega':
      noise(t, 0.12, 'highpass', 900, 0.7, 1.0 * k);
      noise(t, 0.3, 'lowpass', 400, 0.7, 0.8 * k);
      tone(t, 'sine', 140, 35, 0.35, 0.9 * k);
      break;
    case 'pistol':
      noise(t, 0.12, 'highpass', 500 * j, 0.7, 0.8 * k);
      noise(t, 0.2, 'lowpass', 1600, 0.7, 0.6 * k);
      tone(t, 'sine', 170 * j, 45, 0.13, 0.85 * k);
      break;
    case 'shotgun':
      noise(t, 0.38, 'lowpass', 2400, 0.7, 1.0 * k);
      noise(t, 0.07, 'highpass', 2600, 0.7, 0.7 * k);
      tone(t, 'sine', 120, 32, 0.28, 1.0 * k);
      noise(t + 0.32, 0.025, 'bandpass', 2800, 3, 0.35);
      noise(t + 0.42, 0.03, 'bandpass', 2200, 3, 0.35);
      break;
    case 'gatling':
      noise(t, 0.06, 'highpass', 900 * j, 0.7, 0.55 * k);
      tone(t, 'square', 260 * j, 90, 0.045, 0.12 * k);
      tone(t, 'sine', 140, 50, 0.06, 0.4 * k);
      break;
    case 'ricochet':
      tone(t, 'sine', 2600 * j, 800, 0.16, 0.05 * k);
      break;
    case 'empty':
      noise(t, 0.03, 'bandpass', 3200, 4, 0.4); noise(t + 0.09, 0.03, 'bandpass', 2600, 4, 0.3);
      break;
    case 'boom':
      noise(t, 1.0, 'lowpass', 900, 0.7, 1.0);
      noise(t, 0.18, 'highpass', 1500, 0.7, 0.6);
      tone(t, 'sine', 95, 24, 0.9, 1.0);
      tone(t, 'triangle', 60, 30, 0.5, 0.5);
      break;
    case 'web': {
      const f = noise(t, 0.16, 'bandpass', 3600, 2.5, 0.4 * k);
      f.frequency.setValueAtTime(3600, t); f.frequency.exponentialRampToValueAtTime(800, t + 0.14);
      break;
    }
    case 'fuse':
      noise(t, 0.7, 'highpass', 5000, 0.7, 0.18);
      break;
    case 'kameCharge': {
      const o = tone(t, 'sawtooth', 120, 520, 1.1, 0.12);
      tone(t, 'sine', 240, 1040, 1.1, 0.15);
      const f = noise(t, 1.1, 'bandpass', 600, 1.5, 0.25);
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + 1.1);
      break;
    }
    case 'slash': {
      const f = noise(t, 0.14, 'bandpass', 2500, 1.2, 0.7 * k);
      f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(1200, t + 0.12);
      noise(t, 0.06, 'highpass', 1500, 0.7, 0.5 * k);
      tone(t, 'sine', 2350 * j, 2300 * j, 0.35, 0.07 * k); tone(t, 'sine', 3720 * j, 3700 * j, 0.25, 0.04 * k);
      tone(t, 'sine', 160, 60, 0.07, 0.4 * k);
      break;
    }
    case 'whoosh': {
      const f = noise(t, 0.14, 'bandpass', 500, 1.4, 0.12 * k);
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2200, t + 0.12);
      break;
    }
    case 'thud':
      noise(t, 0.12, 'lowpass', 300 * j, 0.8, 0.5 * k);
      tone(t, 'sine', 110 * j, 45, 0.12, 0.45 * k);
      break;
    case 'hurt':
      tone(t, 'square', 220, 80, 0.22, 0.18);
      noise(t, 0.1, 'lowpass', 800, 0.7, 0.4);
      break;
    case 'pickup':
      [660, 880, 1320].forEach((f, i) => tone(t + i * 0.06, 'triangle', f, f, 0.12, 0.25));
      break;
    case 'heal':
      tone(t, 'sine', 400, 1200, 0.35, 0.25); tone(t + 0.05, 'triangle', 600, 1600, 0.3, 0.12);
      break;
    case 'spawn': {
      const o = tone(t, 'sine', 180, 720, 0.5, 0.05 * k);
      o.detune.value = Math.random() * 100;
      break;
    }
    case 'dash': {
      const f = noise(t, 0.2, 'bandpass', 800, 0.9, 0.22);
      f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.2);
      break;
    }
    case 'break':
      noise(t, 0.2, 'bandpass', 1800, 2, 0.4); tone(t, 'square', 700, 200, 0.2, 0.1);
      break;
    case 'combo':
      tone(t, 'square', 523 * (1 + k * 0.08), 523 * (1 + k * 0.08) * 2, 0.12, 0.12);
      break;
    case 'death':
      [392, 370, 349, 262].forEach((f, i) => tone(t + i * 0.28, 'sawtooth', f, f * 0.97, i === 3 ? 0.9 : 0.26, 0.14));
      break;
    case 'wave':
      tone(t, 'sawtooth', 110, 220, 0.6, 0.15); tone(t, 'square', 165, 330, 0.6, 0.08);
      break;
  }
}

// ---------- procedural phonk ----------
let nextStep = 0, step = 0, timer = null;
export let intensity = 0; // 0..3
export function setIntensity(v) { intensity = v; }
const BPM = 132, S16 = 60 / BPM / 4;
const ROOTS = [38, 38, 34, 33]; // D D Bb A
const BELL = [74, -1, 77, -1, 74, 69, -1, 72, 74, -1, 77, 79, -1, 77, 74, -1];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function startMusic() {
  if (timer) return;
  nextStep = ctx.currentTime + 0.1;
  timer = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    while (nextStep < ctx.currentTime + 0.12) { schedule(step, nextStep); nextStep += S16; step = (step + 1) % 64; }
  }, 25);
}
function schedule(s, t) {
  const bar = (s / 16) | 0, i = s % 16, I = intensity;
  const kick = [0, 6, 10].includes(i) || (I >= 3 && i === 14);
  if (kick) {
    tone(t, 'sine', 150, 42, 0.32, 0.9, music);
    const d = (t - ctx.currentTime) * 1000; setTimeout(() => { beat = 1; }, Math.max(0, d));
  }
  if (i === 4 || i === 12) noise(t, 0.16, 'bandpass', 1500, 0.8, 0.5, music);
  if (I >= 1 && i % 2 === 0) noise(t, 0.035, 'highpass', 7000, 0.7, 0.18, music);
  if (I >= 3 && i % 2 === 1) noise(t, 0.025, 'highpass', 9000, 0.7, 0.1, music);
  // 808 bass, distorted
  if (i === 0 || i === 10) {
    const f = mtof(ROOTS[bar]);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(shaper); o.start(t); o.stop(t + 1);
  }
  // phonk cowbell
  if (I >= 2 && BELL[i] > 0) {
    const n = BELL[i] + (bar === 2 ? -4 : bar === 3 ? -5 : 0);
    const f = mtof(n);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    bp.connect(g).connect(music);
    for (const m of [1, 1.48]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * m; o.connect(bp); o.start(t); o.stop(t + 0.25); }
  }
}

// ---------- shouting ----------
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); } catch { voices = []; } }
if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
let lastSpeak = 0;
export function speak(text, pitch = 1, rate = 1.2, interrupt = false) {
  if (!settings.voices || !window.speechSynthesis) return false;
  const now = performance.now();
  try {
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      if (!interrupt || now - lastSpeak < 700) return false;
      speechSynthesis.cancel();
    }
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = Math.max(0, Math.min(2, pitch + (Math.random() - 0.5) * 0.3));
    u.rate = Math.max(0.6, Math.min(2, rate + (Math.random() - 0.5) * 0.2));
    u.volume = 0.9;
    if (voices.length) u.voice = voices[Math.floor(Math.random() * voices.length)];
    speechSynthesis.speak(u);
    lastSpeak = now;
    return true;
  } catch { return false; }
}
export function hush() { try { window.speechSynthesis && speechSynthesis.cancel(); } catch {} }

// Sustained Kamehameha roar: built once, then faded in and out.
let beam = null;
export function setBeam(level) {
  if (!ctx) return;
  if (!beam) {
    if (!level) return;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(sfx);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(g);
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
    n.connect(bp).connect(lp); n.start();
    for (const [type, f, a] of [['sawtooth', 55, 0.35], ['square', 110.5, 0.12], ['sine', 82, 0.4]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = a; o.connect(og).connect(lp); o.start();
    }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 9; const lg = ctx.createGain(); lg.gain.value = 500;
    lfo.connect(lg).connect(lp.frequency); lfo.start();
    beam = g;
  }
  beam.gain.setTargetAtTime(level * 0.5, ctx.currentTime, 0.06);
}
