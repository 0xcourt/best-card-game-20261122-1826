// Synthesised sound for Ember Court: no audio files, just a lazy WebAudio
// context (created on the first gesture) and tiny oscillator blips. Every
// failure is swallowed — a silent game is better than a broken one.
let ctx = null;
let muted = false;

export function ensureAudio() {
  try {
    if (!ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      ctx = new AudioContext();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function setMuted(value) {
  muted = Boolean(value);
}

export function isMuted() {
  return muted;
}

// One short tone: frequency, seconds, wave shape, volume, delay in seconds.
function tone(freq, dur, type, gain, delay) {
  if (muted || !ctx) return;
  try {
    const start = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain || 0.08, start + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  } catch {
    // Sound is garnish; never let it break the game.
  }
}

export const sfx = {
  play() { tone(520, 0.09, 'triangle', 0.07, 0); tone(780, 0.12, 'triangle', 0.06, 0.06); },
  draw() { tone(660, 0.06, 'sine', 0.05, 0); },
  hit() { tone(180, 0.12, 'sawtooth', 0.07, 0); tone(120, 0.14, 'square', 0.05, 0.02); },
  heal() { tone(440, 0.14, 'sine', 0.06, 0); tone(660, 0.18, 'sine', 0.05, 0.08); },
  turn() { tone(392, 0.08, 'triangle', 0.05, 0); },
  win() {
    [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.08, i * 0.12));
  },
  lose() {
    [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.26, 'sine', 0.07, i * 0.14));
  },
};
