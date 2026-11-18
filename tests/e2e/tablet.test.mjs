// Nettbrett-oppsett: delt skjerm i liggende modus, figur som reagerer.
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, closeBrowser, closeContexts, newPage, makeProfile, waitListening, noErrors } from './helpers.mjs';

let srv, base;
before(async () => { srv = await startServer(); base = srv.url; });
afterEach(closeContexts);
after(async () => { await closeBrowser(); srv.server.close(); });

const IPADS = {
  'iPad mini': { width: 1133, height: 744 },
  'iPad Air': { width: 1180, height: 820 },
  'iPad Pro 13"': { width: 1366, height: 1024 },
};
const box = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; });
const visible = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });

for (const [name, viewport] of Object.entries(IPADS)) {
  test(`${name} liggende: matte med oppgave venstre og figur + mikrofon høyre`, async () => {
    const page = await newPage(base, { viewport, profile: makeProfile({ level: 50 }) });
    await page.keyboard.press('1');
    await waitListening(page);
    const q = await box(page, '.q-card'), side = await box(page, '.side');
    assert.ok(q.r <= side.l, 'oppgaven står til venstre for sidekolonnen');
    assert.ok(Math.abs(q.t - side.t) < 4, 'samme topp');
    assert.ok(q.w > side.w * 1.8, 'oppgaven får mest plass');
    for (const sel of ['.buddy .avatar', '.mic', '[data-act=repeat]', '.answer-slot']) assert.ok(await visible(page, sel), sel);
    const mic = await box(page, '.mic');
    assert.ok(mic.l >= side.l && mic.r <= side.r, 'mikrofonen ligger i sidekolonnen');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'ingen sidelengs scroll');
    noErrors(page);
  });

  test(`${name} liggende: skriving med stor tegneflate og hele alfabetet synlig`, async () => {
    const page = await newPage(base, { viewport, profile: makeProfile({ level: 50 }) });
    await page.keyboard.press('2');
    await page.waitForSelector('svg.trace .tube path');
    const card = await box(page, '.trace-card'), side = await box(page, '.write-side');
    assert.ok(card.r <= side.l, 'tegneflaten til venstre');
    assert.ok(card.h >= viewport.height * 0.7, `tegneflaten er høy nok: ${card.h}`);
    const hidden = await page.$$eval('.chip', cs => cs.filter(c => { const r = c.getBoundingClientRect(); return r.top < 0 || r.bottom > innerHeight || r.width === 0; }).map(c => c.textContent));
    assert.deepEqual(hidden, [], 'alle 29 bokstaver synlige uten å scrolle');
    const z = await box(page, '.chip[data-i="25"]');
    assert.ok(z.l >= side.l && z.r <= side.r, 'alfabetet ligger i sidepanelet');
    for (const sel of ['.pic-big', '[data-act=say]', '[data-act=reset]', '[data-act=prev]', '[data-act=next]']) assert.ok(await visible(page, sel), sel);
    // Ord-fanen: to kolonner med ord
    await page.click('[data-act=mode][data-v=words]');
    const [w1, w2] = await page.$$eval('.chip', cs => cs.slice(0, 2).map(c => c.getBoundingClientRect().top));
    assert.ok(Math.abs(w1 - w2) < 2, 'ordene står i rutenett');
    noErrors(page);
  });
}

test('figuren reagerer: lytter, jubler ved riktig, lei seg ved feil, danser ved 3 på rad', async () => {
  const page = await newPage(base, { viewport: IPADS['iPad Air'], profile: makeProfile({ level: 50 }) });
  await page.keyboard.press('1');
  let q = await waitListening(page);
  assert.ok(await page.$('.buddy.listen'), 'lytter');
  await page.evaluate(n => window.__say(String(n + 1)), q.answer);
  await page.waitForSelector('.buddy.sad');
  assert.match(await page.textContent('.bubble.show'), /Prøv igjen/);
  q = await waitListening(page);
  await page.evaluate(n => window.__say(String(n)), q.answer);
  await page.waitForSelector('.buddy.happy');
  assert.ok((await page.textContent('.bubble.show')).length > 2, 'ros i snakkeboblen');
  for (let k = 0; k < 3; k++) {
    q = await waitListening(page);
    await page.evaluate(n => window.__say(String(n)), q.answer);
    await page.waitForSelector('.answer-slot.right');
  }
  await page.waitForSelector('.buddy.dance');
  assert.match(await page.textContent('.bubble.show'), /3 på rad/);
  noErrors(page);
});

test('figuren får nytt utstyr og danser etter nivå opp', async () => {
  const page = await newPage(base, { viewport: IPADS['iPad Air'], profile: makeProfile({ level: 4, xp: 80, items: ['a2', 'a3', 'a4'] }) });
  await page.keyboard.press('1');
  const q = await waitListening(page);
  assert.equal(await page.$('.buddy .av-pet'), null);
  await page.evaluate(n => window.__say(String(n)), q.answer);
  await page.waitForSelector('[data-close]:not([disabled])');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.buddy.dance');
  assert.ok(await page.$('.buddy .av-pet'), 'ny venn vises på den store figuren');
  assert.match(await page.textContent('.bubble.show'), /Nivå 5/);
});

test('mobil og iPad stående beholder det enkle oppsettet (figuren skjult)', async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }]) {
    const page = await newPage(base, { viewport, profile: makeProfile({ level: 50 }) });
    await page.keyboard.press('1');
    await waitListening(page);
    assert.equal(await page.$eval('.buddy', e => getComputedStyle(e).display), 'none');
    const q = await box(page, '.q-card'), mic = await box(page, '.mic');
    assert.ok(mic.t >= q.b, 'mikrofonen under oppgaven');
    await page.keyboard.press('Escape');
    await page.keyboard.press('2');
    await page.waitForSelector('svg.trace .tube path');
    const strip = await page.$eval('.strip', e => getComputedStyle(e).display);
    assert.equal(strip, 'flex', 'bokstavstripe som før');
    const head = await box(page, '.trace-head'), card = await box(page, '.trace-card');
    assert.ok(head.b <= card.t + 2, 'bilde/tekst over tegneflaten');
    noErrors(page);
  }
});

test('snu nettbrettet: oppsettet bytter uten omstart', async () => {
  const page = await newPage(base, { viewport: IPADS['iPad Air'], profile: makeProfile({ level: 50 }) });
  await page.keyboard.press('2');
  await page.waitForSelector('svg.trace .tube path');
  assert.equal(await page.$eval('.strip', e => getComputedStyle(e).display), 'grid');
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(150);
  assert.equal(await page.$eval('.strip', e => getComputedStyle(e).display), 'flex');
  await page.setViewportSize(IPADS['iPad Air']);
  await page.waitForTimeout(150);
  assert.equal(await page.$eval('.strip', e => getComputedStyle(e).display), 'grid');
  noErrors(page);
});
