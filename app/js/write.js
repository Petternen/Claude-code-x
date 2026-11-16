import { GLYPHS } from './data.js';

const NS = 'http://www.w3.org/2000/svg';
const STROKE_COLORS = ['#7b5cff', '#ff6fae', '#22c4a0', '#ff9f43', '#3aa8ff'];
const STEP = 3; // avstand mellom sjekkpunkter langs streken (SVG-enheter)

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Sporing av én bokstav/ett tall. Barnet må starte ved den grønne prikken og
 * følge streken i riktig retning; hvert sjekkpunkt må passeres i rekkefølge.
 */
export class Tracer {
  constructor(svg, { tol, width, onStrokeDone, onComplete, onMiss }) {
    this.svg = svg;
    this.tol = tol;
    this.width = width;
    this.cb = { onStrokeDone, onComplete, onMiss };
    svg.setAttribute('viewBox', '-18 -8 136 156');
    svg.addEventListener('pointerdown', e => this.down(e));
    svg.addEventListener('pointermove', e => this.move(e));
    svg.addEventListener('pointerup', e => this.up(e));
    svg.addEventListener('pointercancel', e => this.up(e));
  }

  load(ch) {
    this.cancelDemo();
    const svg = this.svg;
    svg.innerHTML = '';
    this.ch = ch;
    this.done = false;
    const w = this.width;
    // Hjelpelinjer (som skrivebok)
    const lines = el('g', { class: 'rule' }, svg);
    for (const y of [10, 70, 130]) el('line', { x1: -14, x2: 114, y1: y, y2: y, class: y === 130 ? 'base' : '' }, lines);

    const gOutline = el('g', { class: 'outline' }, svg);
    const gTube = el('g', { class: 'tube' }, svg);
    this.gDone = el('g', { class: 'done' }, svg);
    this.gHint = el('g', { class: 'hint' }, svg);
    this.gInk = el('g', { class: 'ink' }, svg);
    this.gDemo = el('g', { class: 'demo' }, svg);

    this.strokes = GLYPHS[ch].map(d => {
      el('path', { d, 'stroke-width': w + 6 }, gOutline);
      const tube = el('path', { d, 'stroke-width': w }, gTube);
      const len = tube.getTotalLength();
      const n = Math.max(2, Math.ceil(len / STEP));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const p = tube.getPointAtLength((i / n) * len);
        pts.push({ x: p.x, y: p.y });
      }
      return { d, len, pts, tube };
    });
    this.cur = 0;
    this.showHint();
    this.demo();
  }

  showHint() {
    const g = this.gHint;
    g.innerHTML = '';
    if (this.cur >= this.strokes.length) return;
    const s = this.strokes[this.cur];
    s.tube.classList.add('active');
    el('path', { d: s.d, class: 'center' }, g);
    // Retningspiler langs streken
    const every = Math.max(6, Math.round(24 / STEP));
    for (let i = every; i < s.pts.length - 4; i += every) {
      const p = s.pts[i], q = s.pts[Math.min(i + 2, s.pts.length - 1)];
      const a = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
      el('path', { d: 'M-4 -5 L3 0 L-4 5', class: 'arrow', transform: `translate(${p.x} ${p.y}) rotate(${a})` }, g);
    }
    const st = s.pts[0], en = s.pts[s.pts.length - 1];
    if (dist(st, en) > 8) el('circle', { cx: en.x, cy: en.y, r: 4, class: 'end' }, g);
    const sg = el('g', { class: 'start', transform: `translate(${st.x} ${st.y})` }, g);
    el('circle', { r: Math.max(9, this.width * 0.42) }, sg);
    const t = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, sg);
    t.textContent = this.cur + 1;
  }

  demo() {
    this.cancelDemo();
    if (this.cur >= this.strokes.length) return;
    const s = this.strokes[this.cur];
    const g = this.gDemo;
    const dot = el('circle', { r: 7, class: 'demo-dot' }, g);
    const trail = el('path', { class: 'demo-trail' }, g);
    const dur = Math.max(700, s.len * 9);
    let t0 = null, pause = 0;
    const tick = ts => {
      if (t0 == null) t0 = ts;
      const k = Math.min(1, (ts - t0) / dur);
      const idx = Math.round(k * (s.pts.length - 1));
      const p = s.pts[idx];
      dot.setAttribute('cx', p.x);
      dot.setAttribute('cy', p.y);
      trail.setAttribute('d', 'M' + s.pts.slice(0, idx + 1).map(q => `${q.x} ${q.y}`).join(' L'));
      if (k < 1) this.raf = requestAnimationFrame(tick);
      else if (pause++ < 1) { this.raf = setTimeout(() => { t0 = null; this.raf = requestAnimationFrame(tick); }, 500); }
      else this.raf = setTimeout(() => (g.innerHTML = ''), 400);
    };
    this.raf = requestAnimationFrame(tick);
  }

  cancelDemo() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.raf);
    if (this.gDemo) this.gDemo.innerHTML = '';
  }

  toSvg(e) {
    const p = this.svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(this.svg.getScreenCTM().inverse());
    return { x: q.x, y: q.y };
  }

  toScreen(pt) {
    const p = this.svg.createSVGPoint();
    p.x = pt.x;
    p.y = pt.y;
    const q = p.matrixTransform(this.svg.getScreenCTM());
    return [q.x, q.y];
  }

  down(e) {
    if (this.done || this.drawing || this.cur >= this.strokes.length) return;
    e.preventDefault();
    this.cancelDemo();
    const p = this.toSvg(e);
    const s = this.strokes[this.cur];
    if (dist(p, s.pts[0]) > this.tol * 1.7) {
      // Startet feil sted – vis hvor man skal begynne
      this.gHint.querySelector('.start')?.classList.remove('pulse');
      void this.gHint.getBoundingClientRect();
      this.gHint.querySelector('.start')?.classList.add('pulse');
      this.cb.onMiss?.('start');
      return;
    }
    try { this.svg.setPointerCapture(e.pointerId); } catch { /* ignorer */ }
    this.drawing = true;
    this.pid = e.pointerId;
    this.idx = 0;
    this.inkPts = [p];
    this.ink = el('polyline', { points: `${p.x},${p.y}`, 'stroke-width': this.width * 0.62, stroke: STROKE_COLORS[this.cur % STROKE_COLORS.length] }, this.gInk);
  }

  move(e) {
    if (!this.drawing || e.pointerId !== this.pid) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) this.advance(this.toSvg(ev));
    this.ink.setAttribute('points', this.inkPts.map(q => `${q.x},${q.y}`).join(' '));
    const s = this.strokes[this.cur];
    if (this.idx >= s.pts.length - 1) this.finishStroke();
  }

  advance(p) {
    this.inkPts.push(p);
    const pts = this.strokes[this.cur].pts;
    // Se et lite stykke fremover – hindrer «snarveier» på lukkede former (O, 8)
    const look = Math.min(pts.length - 1, this.idx + 7);
    for (let j = look; j > this.idx; j--) {
      if (dist(p, pts[j]) <= this.tol) { this.idx = j; break; }
    }
  }

  up(e) {
    if (!this.drawing || e.pointerId !== this.pid) return;
    const s = this.strokes[this.cur];
    if (this.idx >= s.pts.length - 3) return this.finishStroke();
    // Ikke ferdig – tøm og vis igjen
    this.drawing = false;
    const ink = this.ink;
    ink.classList.add('fade');
    setTimeout(() => ink.remove(), 350);
    this.cb.onMiss?.('lift', this.idx / (s.pts.length - 1));
    this.raf = setTimeout(() => this.demo(), 450);
  }

  finishStroke() {
    if (!this.drawing) return;
    this.drawing = false;
    const s = this.strokes[this.cur];
    this.ink.remove();
    s.tube.classList.remove('active');
    const color = STROKE_COLORS[this.cur % STROKE_COLORS.length];
    const done = el('path', { d: s.d, stroke: color, 'stroke-width': this.width * 0.7, class: 'grow' }, this.gDone);
    done.style.setProperty('--len', s.len);
    this.cur++;
    const end = this.toScreen(s.pts[s.pts.length - 1]);
    if (this.cur >= this.strokes.length) {
      this.done = true;
      this.gHint.innerHTML = '';
      this.svg.classList.add('complete');
      setTimeout(() => this.svg.classList.remove('complete'), 900);
      this.cb.onComplete?.(end);
    } else {
      this.cb.onStrokeDone?.(end);
      this.showHint();
      this.raf = setTimeout(() => this.demo(), 350);
    }
  }

  reset() { this.svg.classList.remove('complete'); this.load(this.ch); }
  destroy() { this.cancelDemo(); }
}

/** Gjør om et navn til tegn vi har sporingsmaler for (é → E osv.). */
export function toTraceable(name) {
  return Array.from(String(name).toUpperCase()).map(c => {
    if (GLYPHS[c]) return c;
    const b = c.normalize('NFD')[0];
    return GLYPHS[b] ? b : '';
  }).join('');
}
