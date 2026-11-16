// Lydeffekter syntetisert med Web Audio – ingen lydfiler, virker offline.
let ctx = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, { type = 'sine', vol = 0.18, slide = 0 } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  unlock() { ac(); },
  pop() { tone(520, 0, 0.09, { type: 'triangle', slide: 1.7, vol: 0.1 }); },
  correct() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.28, { type: 'triangle', vol: 0.16 })); },
  wrong() { tone(330, 0, 0.18, { slide: 0.75, vol: 0.14 }); tone(262, 0.15, 0.25, { slide: 0.8, vol: 0.12 }); },
  sparkle() { [1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.05, 0.16, { vol: 0.07 })); },
  stroke() { tone(880, 0, 0.12, { type: 'triangle', slide: 1.5, vol: 0.1 }); },
  oops() { tone(300, 0, 0.15, { type: 'sine', slide: 0.85, vol: 0.08 }); },
  levelUp() {
    const seq = [523, 659, 784, 1047, 784, 1047, 1319];
    seq.forEach((f, i) => tone(f, i * 0.11, 0.3, { type: 'square', vol: 0.05 }));
    seq.forEach((f, i) => tone(f / 2, i * 0.11, 0.32, { type: 'triangle', vol: 0.12 }));
    [1568, 1976, 2349].forEach((f, i) => tone(f, 0.85 + i * 0.04, 0.9, { type: 'triangle', vol: 0.07 }));
  },
};
