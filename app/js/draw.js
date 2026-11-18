// Tegning: frihånd, fyll-bøtte, viskelær, stempler, fargeleggingsmaler og galleri.
import { PAINT_COLORS, STAMPS, TEMPLATES } from './content.js';

const W = 1200, H = 900;           // tegneflatens oppløsning (4:3)
const SIZES = [8, 22, 48];          // penselstørrelser
const STAMP_SIZES = [60, 110, 170];
const GKEY = id => `stjerneskolen.gallery.${id}`;
const MAX_GALLERY = 24;
const today = () => new Date().toISOString().slice(0, 10);

export function loadGallery(id) {
  try { return JSON.parse(localStorage.getItem(GKEY(id))) || []; } catch { return []; }
}
function saveGallery(id, list) {
  // Ved full lagring: fjern eldste tegninger til det får plass
  for (;;) {
    try { localStorage.setItem(GKEY(id), JSON.stringify(list)); return true; }
    catch { if (list.length <= 1) return false; list.shift(); }
  }
}

/** Scanline-fyll. paint: Uint32Array (RGBA), lines: Uint8ClampedArray med strek-alfa. */
export function floodFill(paint, lines, w, h, x0, y0, color, tol = 40) {
  const i0 = y0 * w + x0;
  if (lines && lines[i0 * 4 + 3] > 100) return 0;
  const seed = paint[i0];
  const sr = seed & 255, sg = (seed >> 8) & 255, sb = (seed >> 16) & 255;
  // Fargen ligner allerede startfargen: ingenting å fylle (hindrer evig løkke)
  if (Math.abs((color & 255) - sr) + Math.abs(((color >> 8) & 255) - sg) + Math.abs(((color >> 16) & 255) - sb) <= tol) return 0;
  const same = i => {
    if (lines && lines[i * 4 + 3] > 100) return false;
    const p = paint[i];
    return Math.abs((p & 255) - sr) + Math.abs(((p >> 8) & 255) - sg) + Math.abs(((p >> 16) & 255) - sb) <= tol;
  };
  const stack = [[x0, y0]];
  let n = 0;
  while (stack.length) {
    let [x, y] = stack.pop();
    let i = y * w + x;
    while (x >= 0 && same(i)) { x--; i--; }
    x++; i++;
    let up = false, down = false;
    while (x < w && same(i)) {
      paint[i] = color; n++;
      if (y > 0) { const u = same(i - w); if (u && !up) { stack.push([x, y - 1]); up = true; } else if (!u) up = false; }
      if (y < h - 1) { const d = same(i + w); if (d && !down) { stack.push([x, y + 1]); down = true; } else if (!d) down = false; }
      x++; i++;
    }
  }
  return n;
}
export const hexTo32 = hex => { const v = parseInt(hex.slice(1), 16); return ((255 << 24) | ((v & 255) << 16) | (((v >> 8) & 255) << 8) | (v >> 16)) >>> 0; };

export function drawScreen(ctx) {
  const { app, $, $$, esc, speak, sfx, burst } = ctx;
  const P = ctx.P;
  let color = PAINT_COLORS[1], size = 1, tool = 'brush', stamp = STAMPS[0], template = null;
  let drawing = false, last = null, undo = [], panel = null;

  app.innerHTML = `${ctx.hud()}<div class="screen draw">
    <div class="draw-main">
      <div class="draw-stage">
        <canvas class="paint" width="${W}" height="${H}" aria-label="Tegneark"></canvas>
        <canvas class="lines" width="${W}" height="${H}" aria-hidden="true"></canvas>
      </div>
      <aside class="draw-tools">
        <div class="tool-row tools" role="toolbar" aria-label="Verktøy">
          <button class="tool sel" data-act="tool" data-v="brush" title="Pensel (B)" aria-label="Pensel">🖌️</button>
          <button class="tool" data-act="tool" data-v="fill" title="Fyll (F)" aria-label="Fyll-bøtte">🪣</button>
          <button class="tool" data-act="tool" data-v="eraser" title="Viskelær (E)" aria-label="Viskelær">🧽</button>
          <button class="tool" data-act="tool" data-v="stamp" title="Stempel (T)" aria-label="Stempel">⭐</button>
        </div>
        <div class="tool-row colors" aria-label="Farger">
          ${PAINT_COLORS.map((c, k) => `<button class="swatch ${c === color ? 'sel' : ''}" data-act="color" data-v="${c}" style="--c:${c}" title="Farge (${(k + 1) % 10})" aria-label="Farge ${k + 1}"></button>`).join('')}
        </div>
        <div class="tool-row stamps" hidden>
          ${STAMPS.map(s => `<button class="stamp-btn ${s === stamp ? 'sel' : ''}" data-act="stamp" data-v="${s}" aria-label="Stempel ${s}">${s}</button>`).join('')}
        </div>
        <div class="tool-row sizes" aria-label="Størrelse">
          ${SIZES.map((s, k) => `<button class="size ${k === size ? 'sel' : ''}" data-act="size" data-v="${k}" title="Størrelse ([ ])" aria-label="Størrelse ${k + 1}"><i style="--s:${8 + k * 10}px"></i></button>`).join('')}
        </div>
        <div class="tool-row actions">
          <button class="icon-btn" data-act="undo" title="Angre (U)" aria-label="Angre">↶</button>
          <button class="icon-btn" data-act="clear" title="Tøm arket" aria-label="Tøm arket">🗑️</button>
          <button class="icon-btn" data-act="templates" title="Fargeleggingsmaler (M)" aria-label="Fargeleggingsmaler">📄</button>
          <button class="icon-btn" data-act="gallery" title="Galleri (G)" aria-label="Galleri">🖼️</button>
        </div>
        <button class="btn save" data-act="save">Lagre 💾</button>
      </aside>
    </div>
    <div class="draw-panel" hidden></div>
  </div>`;
  ctx.updateHud();
  const paint = $('.paint'), lines = $('.lines');
  const g = paint.getContext('2d', { willReadFrequently: true });
  const lg = lines.getContext('2d', { willReadFrequently: true });
  clearPaint();

  function clearPaint() { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); }
  function pushUndo() { undo.push(g.getImageData(0, 0, W, H)); if (undo.length > 15) undo.shift(); }
  function pos(e) { const r = paint.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }

  function setTemplate(tpl) {
    template = tpl;
    lg.clearRect(0, 0, W, H);
    if (!tpl) return;
    lg.save();
    lg.scale(W / 400, H / 300);
    lg.strokeStyle = '#1d1b2f'; lg.lineWidth = 2.6; lg.lineJoin = lg.lineCap = 'round';
    tpl.d.forEach(d => lg.stroke(new Path2D(d)));
    lg.restore();
  }

  function select(group, v) {
    $$(`.${group} [data-v]`).forEach(b => b.classList.toggle('sel', b.dataset.v === String(v)));
  }
  function setTool(t) {
    tool = t; select('tools', t);
    $('.stamps').hidden = t !== 'stamp';
    $('.colors').hidden = t === 'stamp' || t === 'eraser';
    paint.dataset.tool = t;
  }

  function dot(p) {
    g.beginPath();
    g.arc(p.x, p.y, SIZES[size] / 2, 0, Math.PI * 2);
    g.fillStyle = tool === 'eraser' ? '#fff' : color;
    g.fill();
  }
  function line(a, b) {
    g.strokeStyle = tool === 'eraser' ? '#fff' : color;
    g.lineWidth = tool === 'eraser' ? SIZES[size] * 1.6 : SIZES[size];
    g.lineCap = g.lineJoin = 'round';
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  }

  paint.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = pos(e);
    if (tool === 'fill') {
      const x = Math.floor(p.x), y = Math.floor(p.y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      pushUndo();
      const img = g.getImageData(0, 0, W, H);
      const n = floodFill(new Uint32Array(img.data.buffer), template ? lg.getImageData(0, 0, W, H).data : null, W, H, x, y, hexTo32(color));
      if (n) { g.putImageData(img, 0, 0); sfx.sparkle(); } else undo.pop();
      return;
    }
    if (tool === 'stamp') {
      pushUndo();
      g.font = `${STAMP_SIZES[size]}px serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(stamp, p.x, p.y);
      sfx.pop();
      const r = paint.getBoundingClientRect();
      burst(e.clientX, e.clientY, { n: 8, speed: 4, size: 7 });
      void r;
      return;
    }
    pushUndo();
    try { paint.setPointerCapture(e.pointerId); } catch { /* ignorer */ }
    drawing = true; last = p; dot(p);
  });
  paint.addEventListener('pointermove', e => {
    if (!drawing) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) { const p = pos(ev); line(last, p); last = p; }
  });
  const end = () => { drawing = false; };
  paint.addEventListener('pointerup', end);
  paint.addEventListener('pointercancel', end);

  function composite(maxW = 800) {
    const c = document.createElement('canvas');
    c.width = maxW; c.height = Math.round(maxW * H / W);
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(paint, 0, 0, c.width, c.height);
    x.drawImage(lines, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.78);
  }

  async function save() {
    const list = loadGallery(P.id);
    list.push({ id: Date.now().toString(36), date: new Date().toISOString(), tpl: template?.id || null, data: composite() });
    while (list.length > MAX_GALLERY) list.shift();
    if (!saveGallery(P.id, list)) { speak('Galleriet er fullt. Slett noen tegninger først.'); return; }
    sfx.correct();
    ctx.confetti(60);
    ctx.floatText(innerWidth / 2, innerHeight / 3, 'Lagret! 🖼️');
    P.stats.drawings = (P.stats.drawings || 0) + 1;
    if (P.drawDay !== today()) {
      P.drawDay = today();
      speak('Så fin tegning! Den er lagret i galleriet.');
      await ctx.grantXp(15, $('.save'));
    } else {
      ctx.persist();
      speak('Lagret i galleriet!');
    }
  }

  function showPanel(html) {
    panel = $('.draw-panel');
    panel.innerHTML = `<div class="panel-box">${html}<button class="icon-btn close" data-act="close" aria-label="Lukk">✕</button></div>`;
    panel.hidden = false;
    $('button', panel)?.focus();
  }
  function closePanel() { if (panel) { panel.hidden = true; panel.innerHTML = ''; panel = null; } }

  function templates() {
    showPanel(`<h2>Velg en tegning å fargelegge</h2><div class="tpl-grid">
      <button class="tpl" data-act="tpl" data-v=""><span>⬜</span>Blankt ark</button>
      ${TEMPLATES.map(t => `<button class="tpl" data-act="tpl" data-v="${t.id}"><span>${t.e}</span>${esc(t.n)}</button>`).join('')}</div>`);
  }

  function gallery() {
    const list = loadGallery(P.id).slice().reverse();
    showPanel(`<h2>${esc(P.name)} sitt galleri</h2>${list.length
      ? `<div class="gal-grid">${list.map(it => `<figure class="gal-item"><button class="gal-img" data-act="view" data-id="${it.id}" aria-label="Vis tegning"><img src="${it.data}" alt="Tegning"></button>
          <figcaption>${new Date(it.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
          <button class="link-btn" data-act="del" data-id="${it.id}" aria-label="Slett tegning">🗑️</button></figcaption></figure>`).join('')}</div>`
      : '<p class="empty">Ingen tegninger ennå. Tegn noe og trykk «Lagre»!</p>'}`);
  }

  setTool('brush');

  return {
    onAct(a, b) {
      const v = b?.dataset.v;
      if (a === 'back') return ctx.back('draw');
      if (a === 'tool') setTool(v);
      if (a === 'color') { color = v; select('colors', v); if (tool === 'eraser' || tool === 'stamp') setTool('brush'); }
      if (a === 'size') { size = +v; select('sizes', v); }
      if (a === 'stamp') { stamp = v; select('stamps', v); }
      if (a === 'undo' && undo.length) g.putImageData(undo.pop(), 0, 0);
      if (a === 'clear' && confirm('Tømme hele arket?')) { pushUndo(); clearPaint(); }
      if (a === 'save') save();
      if (a === 'templates') templates();
      if (a === 'gallery') gallery();
      if (a === 'close') closePanel();
      if (a === 'tpl') {
        const tpl = TEMPLATES.find(t => t.id === v) || null;
        pushUndo(); clearPaint(); setTemplate(tpl); closePanel();
        if (tpl) { setTool('fill'); speak(`Fargelegg ${tpl.n.toLowerCase()}en! Velg en farge og trykk der du vil fylle.`); }
      }
      if (a === 'view') {
        const it = loadGallery(P.id).find(x => x.id === b.dataset.id);
        if (it) showPanel(`<img class="gal-big" src="${it.data}" alt="Tegning"><button class="btn ghost" data-act="gallery">← Galleri</button>`);
      }
      if (a === 'del' && confirm('Slette denne tegningen?')) {
        saveGallery(P.id, loadGallery(P.id).filter(x => x.id !== b.dataset.id));
        gallery();
      }
    },
    onKey(e) {
      if (e.key === 'Escape') { if (panel) return closePanel(); return ctx.back('draw'); }
      if (panel) return;
      const k = e.key.toLowerCase();
      if (/^\d$/.test(k)) { const c = PAINT_COLORS[(+k + 9) % 10]; color = c; select('colors', c); if (tool === 'eraser' || tool === 'stamp') setTool('brush'); }
      else if (k === '[' || k === ']') { size = Math.max(0, Math.min(2, size + (k === ']' ? 1 : -1))); select('sizes', size); }
      else if (k === 'b') setTool('brush');
      else if (k === 'f') setTool('fill');
      else if (k === 'e') setTool('eraser');
      else if (k === 't') setTool('stamp');
      else if (k === 'u' || ((e.ctrlKey || e.metaKey) && k === 'z')) { if (undo.length) g.putImageData(undo.pop(), 0, 0); }
      else if (k === 'm') templates();
      else if (k === 'g') gallery();
      else if (k === 's') { e.preventDefault(); save(); }
    },
  };
}
