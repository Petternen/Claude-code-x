// Skjermtid: pause etter spilletid, låst for hele enheten, voksenpassord og gjenopprettingskode.
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, closeBrowser, closeContexts, newPage, makeProfile, noErrors } from './helpers.mjs';

let srv, base;
before(async () => { srv = await startServer(); base = srv.url; });
afterEach(closeContexts);
after(async () => { await closeBrowser(); srv.server.close(); });

const MIN = 60_000;
const PW = 'Sommer2026';
const open = (st = {}, opts = {}) => newPage(base, { clock: true, profile: makeProfile(), st: { playMin: 10, pauseMin: 30, ...st }, ...opts });
const locked = page => page.$eval('#lock', e => !e.hidden && !!e.querySelector('.lock-box')).catch(() => false);
const stState = page => page.evaluate(() => JSON.parse(localStorage.getItem('stjerneskolen.screentime')));

async function setupPassword(page) {
  await page.click('[data-act=adult]');
  await page.waitForSelector('.adult-box [name=pw2]');
  await page.fill('[name=pw]', PW);
  await page.fill('[name=pw2]', PW);
  await page.click('.adult-box .btn');
  await page.waitForSelector('[data-code]');
  const code = await page.textContent('[data-code]');
  await page.check('[name=ok]');
  await page.click('.adult-box .btn');
  await page.waitForSelector('.adult-box [name=play]');
  await page.click('.adult-box [data-x]');
  return code;
}
async function unlockWith(page, pw) {
  await page.click('[data-lock=adult]');
  await page.waitForSelector('.adult-box [name=pw]');
  await page.fill('[name=pw]', pw);
  await page.click('.adult-box .btn:not(.ghost)');
}

test('standard: 10 min spill → pause med sovende figur, 1-min-varsel først', async () => {
  const page = await newPage(base, { clock: true, profile: makeProfile(), st: {} });
  await page.keyboard.press('m');
  await page.waitForSelector('.q-card');
  await page.clock.runFor(9 * MIN + 1000);
  assert.equal(await locked(page), false);
  assert.ok((await stState(page)).warned, 'varslet ett minutt før');
  await page.clock.runFor(MIN);
  assert.ok(await locked(page), 'låst etter 10 min');
  assert.match(await page.textContent('#lock'), /Tid for pause/);
  assert.ok(await page.$('#lock .sleeper .avatar'), 'figuren sover');
  assert.match(await page.textContent('.lock-count'), /29:5\d|30:00/);
  assert.ok(await page.$('.tiles.groups'), 'aktiviteten er avsluttet bak pausen');
  noErrors(page);
});

test('pausen sperrer tastatur og klikk, og er over etter 30 min', async () => {
  const page = await open({ playMin: 1 });
  await page.clock.runFor(MIN + 1000);
  assert.ok(await locked(page));
  await page.keyboard.press('m');
  assert.equal(await page.$('.q-card'), null, 'tastatur sperret');
  const blocked = await page.evaluate(() => {
    const t = document.querySelector('.tile');
    const r = t.getBoundingClientRect();
    return document.elementFromPoint(r.left + 10, r.top + 10)?.closest('#lock') != null;
  });
  assert.ok(blocked, 'pauseskjermen dekker knappene');
  await page.clock.runFor(30 * MIN);
  assert.equal(await locked(page), false, 'pause over');
  assert.ok(((await stState(page)).used ?? 0) <= 2, 'ny spilletid');
});

test('pausen gjelder hele enheten: bytte spiller og laste på nytt hjelper ikke', async () => {
  const storage = JSON.stringify({ current: 'p1', profiles: [makeProfile(), makeProfile({ id: 'p2', name: 'Bror' })] });
  const page = await newPage(base, { clock: true, storage, st: { playMin: 1, pauseMin: 30 } });
  await page.clock.runFor(MIN + 1000);
  assert.ok(await locked(page));
  await page.reload();
  await page.clock.runFor(2000);
  assert.ok(await locked(page), 'fortsatt låst etter omlasting');
});

test('teller ikke når appen er skjult', async () => {
  const page = await open({ playMin: 1 });
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }));
  await page.clock.runFor(5 * MIN);
  assert.equal(await locked(page), false);
  assert.ok(((await stState(page)).used ?? 0) < 5);
});

test('uten passord kan pausen ikke låses opp', async () => {
  const page = await open({ playMin: 1 });
  await page.clock.runFor(MIN + 1000);
  await page.click('[data-lock=adult]');
  await page.waitForSelector('.adult-box');
  assert.match(await page.textContent('.adult-box'), /ikke laget et voksenpassord/);
  assert.equal(await page.$('.adult-box input'), null, 'barnet kan ikke lage passord herfra');
});

test('lage passord: krav, gjentakelse, gjenopprettingskode må bekreftes, lagres som hash', async () => {
  const page = await open();
  await page.click('[data-act=adult]');
  await page.waitForSelector('.adult-box [name=pw2]');
  for (const [a, b, re] of [['kort1', 'kort1', /8 tegn/], ['bareboksta', 'bareboksta', /bokstaver og tall/], [PW, PW + 'x', /ikke like/]]) {
    await page.fill('[name=pw]', a); await page.fill('[name=pw2]', b);
    await page.click('.adult-box .btn');
    await page.waitForFunction(() => document.querySelector('.adult-box .msg').textContent.length > 0);
    assert.match(await page.textContent('.adult-box .msg'), re);
  }
  await page.fill('[name=pw]', PW); await page.fill('[name=pw2]', PW);
  await page.click('.adult-box .btn');
  await page.waitForSelector('[data-code]');
  assert.match(await page.textContent('[data-code]'), /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
  await page.click('.adult-box .btn');
  assert.match(await page.textContent('.adult-box .msg'), /Kryss av/);
  await page.check('[name=ok]');
  await page.click('.adult-box .btn');
  await page.waitForSelector('.adult-box [name=play]');
  const raw = await page.evaluate(() => localStorage.getItem('stjerneskolen.screentime'));
  assert.ok(!raw.includes(PW), 'passordet er ikke lagret i klartekst');
  assert.ok(JSON.parse(raw).pw.hash && JSON.parse(raw).rec.hash);
  noErrors(page);
});

test('voksen låser opp pausen med passord; feil passord avvises, 5 feil gir ventetid', async () => {
  const page = await open({ playMin: 1 });
  await setupPassword(page);
  await page.clock.runFor(MIN + 1000);
  assert.ok(await locked(page));
  await unlockWith(page, 'feilpassord1');
  await page.waitForFunction(() => /Feil passord/.test(document.querySelector('.adult-box .msg').textContent));
  for (let k = 0; k < 4; k++) { await page.fill('[name=pw]', 'feil' + k + 'abcd'); await page.click('.adult-box .btn:not(.ghost)'); await page.waitForTimeout(100); }
  await page.fill('[name=pw]', PW); await page.click('.adult-box .btn:not(.ghost)');
  await page.waitForFunction(() => /For mange/.test(document.querySelector('.adult-box .msg').textContent));
  await page.clock.runFor(31_000);
  assert.ok(await locked(page), 'fortsatt låst');
  await page.fill('[name=pw]', PW); await page.click('.adult-box .btn:not(.ghost)');
  await page.waitForSelector('[data-unlock]');
  await page.click('[data-unlock]');
  await page.waitForTimeout(50);
  assert.equal(await locked(page), false, 'låst opp');
  assert.equal((await stState(page)).pauseUntil, 0);
});

test('+10 minutter ekstra gir mer spilletid', async () => {
  const page = await open({ playMin: 1 });
  await setupPassword(page);
  await page.clock.runFor(MIN + 1000);
  await unlockWith(page, PW);
  await page.waitForSelector('[data-extra]');
  await page.click('[data-extra]');
  assert.equal(await locked(page), false);
  await page.clock.runFor(9 * MIN);
  assert.equal(await locked(page), false, 'fortsatt spilletid etter 9 min');
  await page.clock.runFor(2 * MIN);
  assert.ok(await locked(page), 'pause igjen etter 10 ekstra minutter');
});

test('voksen endrer tider og kan skru av skjermtid', async () => {
  const page = await open();
  await setupPassword(page);
  await page.click('[data-act=adult]');
  await page.fill('[name=pw]', PW); await page.click('.adult-box .btn:not(.ghost)');
  await page.waitForSelector('[name=play]');
  await page.fill('[name=play]', '20'); await page.fill('[name=pause]', '15');
  await page.click('.adult-box .btn:not(.ghost)');
  await page.waitForFunction(() => /Lagret/.test(document.querySelector('.adult-box .msg').textContent));
  let st = await stState(page);
  assert.equal(st.playMin, 20); assert.equal(st.pauseMin, 15);
  await page.fill('[name=play]', '0'); await page.click('.adult-box .btn:not(.ghost)');
  assert.match(await page.textContent('.adult-box .msg'), /1–240/);
  await page.fill('[name=play]', '20');
  await page.uncheck('[name=on]'); await page.click('.adult-box .btn:not(.ghost)');
  await page.click('.adult-box [data-x]');
  await page.clock.runFor(60 * MIN);
  assert.equal(await locked(page), false, 'skjermtid av');
  st = await stState(page);
  assert.equal(st.enabled, false);
});

test('glemt passord: gjenopprettingskode lar voksen lage nytt passord', async () => {
  const page = await open({ playMin: 1 });
  const code = await setupPassword(page);
  await page.clock.runFor(MIN + 1000);
  await page.click('[data-lock=adult]');
  await page.click('[data-forgot]');
  await page.fill('[name=code]', 'AAAA-BBBB-CCCC-DDDD');
  await page.click('.adult-box .btn');
  await page.waitForFunction(() => /Feil kode/.test(document.querySelector('.adult-box .msg').textContent));
  await page.fill('[name=code]', code.toLowerCase().replace(/-/g, ' '));
  await page.click('.adult-box .btn');
  await page.waitForSelector('.adult-box [name=pw2]');
  await page.fill('[name=pw]', 'Vinter2027'); await page.fill('[name=pw2]', 'Vinter2027');
  await page.click('.adult-box .btn');
  await page.waitForSelector('[data-code]');
  assert.notEqual(await page.textContent('[data-code]'), code, 'ny kode');
  await page.check('[name=ok]'); await page.click('.adult-box .btn');
  await page.waitForSelector('[data-unlock]');
  await page.click('[data-unlock]');
  assert.equal(await locked(page), false);
  // Gammelt passord virker ikke lenger
  await page.click('[data-act=adult]');
  await page.fill('[name=pw]', PW); await page.click('.adult-box .btn:not(.ghost)');
  await page.waitForFunction(() => /Feil passord/.test(document.querySelector('.adult-box .msg').textContent));
});

test('lang pause med appen lukket nullstiller spilletiden', async () => {
  const page = await open({ playMin: 10, used: 500, lastActive: Date.now() - 31 * MIN });
  await page.clock.runFor(1000);
  assert.ok((await stState(page)).used <= 2);
});
