// Layout på ulike skjermer, PWA-oppsett og offline-støtte.
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startServer, closeBrowser, closeContexts, newPage, makeProfile, waitListening, noErrors, devices } from './helpers.mjs';

let srv, base;
before(async () => { srv = await startServer(); base = srv.url; });
afterEach(closeContexts);
after(async () => { await closeBrowser(); srv.server.close(); });

const VIEWPORTS = {
  'iPhone SE': { width: 375, height: 667 },
  'iPhone 13': { width: 390, height: 844 },
  'iPad stående': { width: 820, height: 1180 },
  'iPad liggende': { width: 1180, height: 820 },
  'PC': { width: 1366, height: 768 },
};

async function inView(page, sel) {
  return page.$eval(sel, e => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;
  });
}
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`layout ${name}: ingen horisontal scroll, viktige elementer synlige`, async () => {
    const items = Array.from({ length: 30 }, (_, i) => 'a' + (i + 2));
    const page = await newPage(base, { viewport, profile: makeProfile({ level: 31, items, equipped: { hat: 'a20', pet: 'a25', aura: 'a30' } }) });
    // Hjem
    await page.waitForSelector('.tiles');
    assert.ok(await noHScroll(page), 'hjem');
    assert.ok(await inView(page, '.lvl-badge'), 'nivåmerke');
    assert.ok(await inView(page, '.t-math'), 'matte-flis');
    // Matte
    await page.keyboard.press('m');
    await waitListening(page);
    assert.ok(await noHScroll(page), 'matte');
    for (const sel of ['.mic', '.answer-slot', '.q-card', '[data-act=repeat]']) assert.ok(await inView(page, sel), `matte: ${sel}`);
    await page.keyboard.press('Escape');
    // Skriving
    await page.keyboard.press('s');
    await page.waitForSelector('svg.trace .tube path');
    assert.ok(await noHScroll(page), 'skriving');
    assert.ok(await inView(page, 'svg.trace'), 'tegneflate');
    const box = await page.$eval('svg.trace', e => e.getBoundingClientRect().height);
    assert.ok(box >= 250, `tegneflaten er for liten: ${box}px`);
    assert.ok(await inView(page, '.chip.now'), 'valgt brikke');
    await page.click('[data-act=back]');
    // Samling
    await page.keyboard.press('c');
    await page.waitForSelector('.art-grid');
    assert.ok(await noHScroll(page), 'samling');
    const canScroll = await page.$eval('.coll', e => e.scrollHeight > e.clientHeight);
    if (canScroll) {
      await page.$eval('.coll', e => (e.scrollTop = e.scrollHeight));
      assert.ok(await inView(page, '.art-grid:last-of-type .art-card:last-child'), 'siste kort kan nås');
    }
    await page.click('[data-act=back]');
    // Ny spiller
    await page.click('[data-act=back]');
    await page.click('[data-act=new]');
    await page.waitForSelector('#nm');
    assert.ok(await noHScroll(page), 'ny spiller');
    noErrors(page);
    await page.ctx.close();
  });
}

test('mobil med ekte enhetsprofil (berøring) – sporing med touch', async () => {
  const page = await newPage(base, { device: devices['iPhone 13'], profile: makeProfile({ level: 55 }) });
  await page.keyboard.press('s');
  await page.waitForSelector('svg.trace .tube path');
  assert.equal(await page.$eval('svg.trace', e => getComputedStyle(e).touchAction), 'none', 'siden scroller ikke mens man tegner');
  noErrors(page);
  await page.ctx.close();
});

test('nivå-opp-skjermen får plass på liten mobil', async () => {
  const page = await newPage(base, { viewport: VIEWPORTS['iPhone SE'], profile: makeProfile({ xp: 59 }) });
  await page.keyboard.press('m');
  const q = await waitListening(page);
  await page.evaluate(n => window.__say(String(n)), q.answer);
  await page.waitForSelector('[data-close]:not([disabled])');
  assert.ok(await inView(page, '[data-close]'), 'Hurra-knappen synlig');
  assert.ok(await inView(page, '.lu-level'), 'nivåtall synlig');
  await page.ctx.close();
});

test('manifest er gyldig og peker på eksisterende ikoner', async () => {
  const page = await newPage(base);
  const m = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
  assert.equal(m.lang, 'nb');
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512'));
  for (const i of m.icons) {
    const st = await page.evaluate(async src => (await fetch(src)).status, i.src);
    assert.equal(st, 200, i.src);
  }
  const dims = await page.evaluate(async () => {
    const img = new Image(); img.src = 'icons/icon-512.png'; await img.decode(); return [img.naturalWidth, img.naturalHeight];
  });
  assert.deepEqual(dims, [512, 512]);
  await page.ctx.close();
});

test('alle filer i service workerens bufferliste finnes, og alle JS-filer er med', async () => {
  const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');
  const list = [...sw.match(/ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.ok(list.length > 10);
  const page = await newPage(base);
  for (const a of list) assert.equal(await page.evaluate(async u => (await fetch(u)).status, a), 200, a);
  const { readdir } = await import('node:fs/promises');
  const js = await readdir(new URL('../../app/js/', import.meta.url));
  for (const f of js) assert.ok(list.includes('js/' + f), `js/${f} mangler i sw.js`);
  await page.ctx.close();
});

test('offline: appen starter og fungerer uten nett etter første besøk', async () => {
  const page = await newPage(base, { profile: makeProfile() });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.tiles');
  await page.keyboard.press('m');
  await waitListening(page);
  await page.ctx.setOffline(false);
  noErrors(page);
  await page.ctx.close();
});

test('HTML: språk, viewport og tittel', async () => {
  const page = await newPage(base);
  assert.equal(await page.getAttribute('html', 'lang'), 'nb');
  assert.equal(await page.title(), 'Stjerneskolen');
  assert.match(await page.getAttribute('meta[name=viewport]', 'content'), /width=device-width/);
  await page.ctx.close();
});

test('alle ikonknapper har tilgjengelig navn', async () => {
  const page = await newPage(base, { profile: makeProfile() });
  for (const k of ['m', 'b', 's', 'l', 'h', 't', 'c']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(300);
    const unnamed = await page.$$eval('button.icon-btn, button.mic', bs =>
      bs.filter(b => !(b.getAttribute('aria-label') || b.title || b.textContent.trim().length > 2)).map(b => b.outerHTML));
    assert.deepEqual(unnamed, [], `skjerm ${k}`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.tiles');
  }
  await page.ctx.close();
});

test('oppdatering: ny versjon på serveren vises ved neste åpning (ikke gammel lagret kopi)', async () => {
  const page = await newPage(base, { profile: makeProfile() });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  // «Publiser» en ny versjon av index.html
  await page.ctx.route(/index\.html$|\/$/, async r => {
    const res = await r.fetch();
    r.fulfill({ response: res, body: (await res.text()).replace('<title>Stjerneskolen</title>', '<title>Stjerneskolen NY</title>') });
  });
  await page.reload();
  assert.equal(await page.title(), 'Stjerneskolen NY', 'ny versjon allerede ved første omlasting');
  await page.ctx.unroute(/index\.html$|\/$/);
  noErrors(page);
  await page.ctx.close();
});

test('oppdatering: midt i en aktivitet lastes ikke siden på nytt før barnet er tilbake på menyen', async () => {
  const page = await newPage(base, { profile: makeProfile() });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.keyboard.press('t');
  await page.waitForSelector('canvas.paint');
  await page.evaluate(() => { window.__marker = 1; navigator.serviceWorker.dispatchEvent(new Event('controllerchange')); });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__marker), 1, 'ingen omlasting midt i tegningen');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__marker === undefined, null, { timeout: 5000 });
  await page.ctx.close();
});
