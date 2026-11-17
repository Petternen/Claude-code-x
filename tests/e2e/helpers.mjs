// Felles oppsett for nettlesertester: statisk server, nettleser og falsk tale.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
export { devices };

const ROOT = fileURLToPath(new URL('../../app/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

export function startServer() {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
    } catch { res.writeHead(404).end('not found'); }
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, url: `http://localhost:${server.address().port}/` })));
}

let browser;
export async function getBrowser() { return (browser ||= await chromium.launch()); }
export async function closeBrowser() { await browser?.close(); browser = null; }
const openContexts = new Set();
/** Kjøres etter hver test: lukker kontekster også når testen feilet. */
export async function closeContexts() { for (const c of openContexts) await c.close().catch(() => {}); openContexts.clear(); }

/**
 * Ny side med:
 *  - opplesning slått av (speak() løses umiddelbart)
 *  - falsk talegjenkjenning styrt via window.__say / __silence / __error
 *  - window.__q = gjeldende matteoppgave
 * opts.recognition: 'fake' (standard) | 'none'
 */
export async function newPage(base, { profile, storage, recognition = 'fake', viewport = { width: 1024, height: 768 }, device, blockFonts = true } = {}) {
  const b = await getBrowser();
  const ctx = await b.newContext(device ? { ...device } : { viewport, hasTouch: true });
  openContexts.add(ctx);
  if (blockFonts) await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(({ recognition, seed }) => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
    window.__qs = [];
    window.__testHook = q => { window.__q = q; window.__qs.push(q); };
    window.__rec = null;
    window.__recStarts = 0;
    if (recognition === 'fake') {
      window.SpeechRecognition = class {
        start() { window.__rec = this; window.__recStarts++; setTimeout(() => this.onstart?.(), 5); }
        abort() { if (window.__rec === this) window.__rec = null; }
      };
    } else {
      delete window.SpeechRecognition; delete window.webkitSpeechRecognition;
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined });
    }
    const end = r => { if (window.__rec === r) window.__rec = null; r.onend?.(); };
    window.__say = (text, final = true) => {
      const r = window.__rec; if (!r) return false;
      const alts = (Array.isArray(text) ? text : [text]).map(t => ({ transcript: t }));
      alts.isFinal = final;
      r.onresult?.({ results: [alts] });
      if (final) end(r);
      return true;
    };
    window.__silence = () => { const r = window.__rec; if (!r) return false; r.onerror?.({ error: 'no-speech' }); end(r); return true; };
    window.__error = code => { const r = window.__rec; if (!r) return false; r.onerror?.({ error: code }); end(r); return true; };
    if (seed != null && !sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('stjerneskolen.v1', seed);
    }
  }, { recognition, seed: storage ?? (profile ? JSON.stringify({ current: profile.id, profiles: [profile] }) : null) });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_FAILED/.test(m.text())) page.errors.push(m.text()); });
  page.on('dialog', d => (page.onDialog ? page.onDialog(d) : d.dismiss()));
  await page.goto(base);
  page.ctx = ctx;
  return page;
}

export function makeProfile(over = {}) {
  return {
    id: 'p1', name: 'Emma', avatar: '🦊', age: 5, level: 1, xp: 0, totalXp: 0,
    items: [], equipped: { hat: null, pet: null, aura: null },
    stats: { math: 0, letters: 0, words: 0 }, traced: {}, seenMicTip: true, ...over,
  };
}

export const db = page => page.evaluate(() => JSON.parse(localStorage.getItem('stjerneskolen.v1')));
export const prof = async page => { const d = await db(page); return d.profiles.find(p => p.id === d.current); };

/** Venter til spillet lytter etter et nytt svar. */
export async function waitListening(page) {
  await page.waitForFunction(() => window.__rec && document.querySelector('.answer-slot')?.textContent === '?' && !document.querySelector('.levelup'));
  return page.evaluate(() => window.__q);
}

export async function closeLevelUps(page, max = 10) {
  let n = 0;
  while (n < max && await page.$('.levelup')) {
    await page.waitForSelector('[data-close]:not([disabled])');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    n++;
  }
  return n;
}

/** Skjermkoordinater for strøkene i gjeldende bokstav. */
export function strokePoints(page, samples = 40) {
  return page.evaluate(samples => {
    const svg = document.querySelector('svg.trace');
    const m = svg.getScreenCTM();
    return [...svg.querySelectorAll('.tube path')].map(path => {
      const L = path.getTotalLength(), out = [];
      for (let i = 0; i <= samples; i++) {
        const q = path.getPointAtLength(L * i / samples);
        const pt = svg.createSVGPoint(); pt.x = q.x; pt.y = q.y;
        const s = pt.matrixTransform(m); out.push([s.x, s.y]);
      }
      return out;
    });
  }, samples);
}

/** Omregning fra SVG-enheter til skjermpiksler. */
export const unitPx = page => page.evaluate(() => document.querySelector('svg.trace').getScreenCTM().a);

export async function drawPath(page, pts) {
  await page.mouse.move(...pts[0]);
  await page.mouse.down();
  for (const p of pts) await page.mouse.move(...p, { steps: 2 });
  await page.mouse.up();
}

export async function traceAll(page, { offset = [0, 0] } = {}) {
  for (const s of await strokePoints(page)) {
    await drawPath(page, s.map(([x, y]) => [x + offset[0], y + offset[1]]));
    await page.waitForTimeout(60);
  }
}

export const currentStrokeLabel = page =>
  page.evaluate(() => document.querySelector('svg.trace .hint .start text')?.textContent ?? 'done');

export function noErrors(page) {
  assert.deepEqual(page.errors, [], 'JavaScript-feil i nettleseren');
}

export const NO_WORDS = ['null', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv',
  'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten', 'tjue'];
export const word = n => NO_WORDS[n] ?? String(n);
