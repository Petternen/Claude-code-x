// Partikkeleffekter: stjerner, gnister og konfetti på ett lerret over hele skjermen.
const cv = document.getElementById('fx');
const g = cv.getContext('2d');
let parts = [];
let running = false;
let dpr = 1;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
}
resize();
addEventListener('resize', resize);

export const COLORS = ['#ffd23f', '#ff7ab6', '#7ee8fa', '#a98bff', '#5ef2a8', '#ff9f43', '#ffffff'];
const pick = a => a[Math.floor(Math.random() * a.length)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function drawStar(r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

export function burst(x, y, { n = 26, speed = 8, size = 11, kinds = ['star', 'star', 'dot'], gravity = 0.12, life = 70, colors = COLORS } = {}) {
  if (reduced) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.35 + Math.random() * 0.75);
    parts.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, gravity, drag: 0.96,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      size: size * (0.5 + Math.random() * 0.7), color: pick(colors), kind: pick(kinds),
      life: life * (0.7 + Math.random() * 0.5), max: life,
    });
  }
  loop();
}

export function confetti(n = 140) {
  if (reduced) n = 30;
  for (let i = 0; i < n; i++) {
    parts.push({
      x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.4,
      vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, gravity: 0.05, drag: 0.99,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      size: 8 + Math.random() * 8, color: pick(COLORS), kind: Math.random() < 0.3 ? 'star' : 'rect',
      life: 200, max: 200,
    });
  }
  loop();
}

export function fireworks(count = 5, delay = 260) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => burst(
      innerWidth * (0.15 + Math.random() * 0.7), innerHeight * (0.15 + Math.random() * 0.4),
      { n: 40, speed: 10, size: 9, colors: [pick(COLORS), pick(COLORS), '#fff'] }), i * delay);
  }
}

export function floatText(x, y, text, cls = '') {
  const d = document.createElement('div');
  d.className = 'float-text ' + cls;
  d.textContent = text;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1400);
}

export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

function loop() {
  if (running) return;
  running = true;
  requestAnimationFrame(step);
}

function step() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
  for (const p of parts) {
    p.life--;
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + p.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, p.life / (p.max * 0.4)));
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.fillStyle = p.color;
    if (p.kind === 'star') {
      g.shadowColor = p.color;
      g.shadowBlur = 10;
      drawStar(p.size);
    } else if (p.kind === 'dot') {
      g.beginPath();
      g.arc(0, 0, p.size * 0.4, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    }
    g.restore();
  }
  if (parts.length) requestAnimationFrame(step);
  else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
}
