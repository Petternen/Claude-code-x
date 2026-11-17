import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS } from '../../app/js/data.js';
import { arrowSpots } from '../../app/js/write.js';

// Sampler en ren linjesti («M x y L x y …») likt som appen: punkter med 3 enheters avstand
function sample(d) {
  const v = d.replace(/[ML]/g, ' ').trim().split(/\s+/).map(Number);
  const P = []; for (let i = 0; i < v.length; i += 2) P.push({ x: v[i], y: v[i + 1] });
  const seg = P.slice(1).map((p, i) => Math.hypot(p.x - P[i].x, p.y - P[i].y));
  const len = seg.reduce((a, b) => a + b, 0), n = Math.ceil(len / 3), out = [];
  for (let k = 0; k <= n; k++) {
    let t = (k / n) * len, i = 0;
    while (i < seg.length - 1 && t > seg[i]) { t -= seg[i]; i++; }
    const f = seg[i] ? t / seg[i] : 0;
    out.push({ x: P[i].x + (P[i + 1].x - P[i].x) * f, y: P[i].y + (P[i + 1].y - P[i].y) * f });
  }
  return { pts: out, verts: P };
}
const lineGlyphs = Object.entries(GLYPHS).filter(([, s]) => s.every(d => !d.includes('C')));

test('ingen piler nær hjørner (M, W, N, Z, V, K, L, 4, 7 …)', () => {
  for (const [ch, strokes] of lineGlyphs) for (const d of strokes) {
    const { pts, verts } = sample(d);
    for (const s of arrowSpots(pts)) {
      for (const v of verts.slice(1, -1)) {
        assert.ok(Math.hypot(s.x - v.x, s.y - v.y) >= 9, `${ch}: pil ${Math.round(s.x)},${Math.round(s.y)} for nær hjørne ${v.x},${v.y}`);
      }
    }
  }
});

test('hver pil peker langs sin egen linjebit (±3°)', () => {
  for (const [ch, strokes] of lineGlyphs) for (const d of strokes) {
    const { pts, verts } = sample(d);
    for (const s of arrowSpots(pts)) {
      const ok = verts.slice(1).some((b, i) => {
        const a = verts[i], L = Math.hypot(b.x - a.x, b.y - a.y);
        const cross = Math.abs((b.x - a.x) * (s.y - a.y) - (b.y - a.y) * (s.x - a.x)) / L;
        const segA = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        let diff = Math.abs(segA - s.a) % 360; if (diff > 180) diff = 360 - diff;
        return cross < 0.5 && diff < 3;
      });
      assert.ok(ok, `${ch}: pil ved ${Math.round(s.x)},${Math.round(s.y)} har feil retning ${Math.round(s.a)}°`);
    }
  }
});

test('pilene står med god avstand og ikke helt i starten/slutten', () => {
  const { pts } = sample(GLYPHS.W[0]);
  const s = arrowSpots(pts);
  for (let i = 1; i < s.length; i++) assert.ok(Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y) >= 18);
  assert.ok(Math.hypot(s[0].x - pts[0].x, s[0].y - pts[0].y) >= 11);
});

test('hver rett del av M og W på over 40 enheter får minst én pil', () => {
  for (const ch of ['M', 'W']) {
    const { pts, verts } = sample(GLYPHS[ch][0]);
    const spots = arrowSpots(pts);
    verts.slice(1).forEach((b, i) => {
      const a = verts[i];
      if (Math.hypot(b.x - a.x, b.y - a.y) < 40) return;
      const on = spots.filter(s => Math.abs((b.x - a.x) * (s.y - a.y) - (b.y - a.y) * (s.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y) < 0.5
        && Math.min(a.x, b.x) - 1 <= s.x && s.x <= Math.max(a.x, b.x) + 1 && Math.min(a.y, b.y) - 1 <= s.y && s.y <= Math.max(a.y, b.y) + 1);
      assert.ok(on.length >= 1, `${ch}: del ${i + 1} mangler pil`);
    });
  }
});
