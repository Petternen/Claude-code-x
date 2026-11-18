// Hjem-grupper, Lesing, Butikk, Huskespill og Tegning.
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, closeBrowser, closeContexts, newPage, makeProfile, prof, noErrors } from './helpers.mjs';

let srv, base;
before(async () => { srv = await startServer(); base = srv.url; });
afterEach(closeContexts);
after(async () => { await closeBrowser(); srv.server.close(); });

const open = (over = {}, opts = {}) => newPage(base, { profile: makeProfile({ level: 50, ...over }), ...opts });
const listening = page => page.waitForFunction(() => window.__rec && !document.querySelector('.levelup'));
const xpOf = async page => (await prof(page)).xp;

// ───────── Hjem og grupper ─────────
test('hjem: tre grupper + samling, hver gruppe har to aktiviteter, Esc går ett nivå opp', async () => {
  const page = await open();
  assert.deepEqual(await page.$$eval('.tiles.groups .tile b', e => e.map(x => x.textContent)), ['Tall', 'Bokstaver', 'Lek', 'Samling']);
  const expect = { 1: ['Matte', 'Butikk'], 2: ['Skriving', 'Lesing'], 3: ['Huskespill', 'Tegning'] };
  for (const [k, names] of Object.entries(expect)) {
    await page.keyboard.press(k);
    await page.waitForSelector('.group');
    assert.deepEqual(await page.$$eval('.group .tile b', e => e.map(x => x.textContent)), names);
    await page.keyboard.press('2');
    await page.waitForFunction(() => !document.querySelector('.group'));
    await page.keyboard.press('Escape');
    await page.waitForSelector('.group');
    assert.deepEqual(await page.$$eval('.group .tile b', e => e.map(x => x.textContent)), names, 'tilbake til samme gruppe');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.tiles.groups');
  }
  await page.click('[data-act=group][data-v=lek]');
  await page.click('.t-memory');
  await page.waitForSelector('.mem-grid');
  noErrors(page);
});

// ───────── Lesing ─────────
test('lesing: riktig lest ord avslører bildet og gir 10 XP', async () => {
  const page = await open({ age: 5 });
  await page.keyboard.press('l');
  await listening(page);
  const q = await page.evaluate(() => window.__q);
  assert.equal(q.type, 'read');
  assert.equal(await page.$eval('.read-word', e => e.textContent), q.word);
  assert.ok(await page.$('.read-pic .gift'), 'bildet er skjult');
  const before = await xpOf(page);
  await page.evaluate(w => window.__say(w.toLowerCase()), q.word);
  await page.waitForSelector('.read-pic.open .pic-reveal');
  assert.equal(await page.$$eval('.rl.ok', e => e.length), q.word.length, 'bokstavene blir grønne');
  await page.waitForTimeout(150);
  assert.equal((await xpOf(page)) - before, 10);
  assert.ok(await page.$('.progress i.star'));
  noErrors(page);
});

test('lesing: to feil → leser sammen (bokstav for bokstav), riktig etterpå gir 3 XP', async () => {
  const page = await open({ age: 5 });
  await page.keyboard.press('l');
  await listening(page);
  const q = await page.evaluate(() => window.__q);
  const before = await xpOf(page);
  await page.evaluate(() => window.__say('qwqw xzxz'));
  await page.waitForSelector('.read-word.shake');
  await listening(page);
  await page.evaluate(() => window.__say('zqzq zqzq'));
  await page.waitForSelector('.rl.hl'); // bokstav for bokstav
  await listening(page);
  assert.ok(await page.$('.read-pic .gift'), 'bildet fortsatt skjult');
  await page.evaluate(w => window.__say(w), q.word);
  await page.waitForSelector('.read-pic.open');
  await page.waitForTimeout(150);
  assert.equal((await xpOf(page)) - before, 3);
});

test('lesing: hjelp-knappen og voksen-godkjenning (Enter)', async () => {
  const page = await open({ age: 4 });
  await page.keyboard.press('l');
  await listening(page);
  await page.keyboard.press(' ');
  await page.waitForSelector('.rl.hl');
  await listening(page);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.read-pic.open');
});

for (const [age, lo, hi] of [[3, 2, 2], [5, 3, 4], [6, 4, 5]]) {
  test(`lesing alder ${age}: ord med ${lo}–${hi} bokstaver`, async () => {
    const page = await open({ age });
    await page.keyboard.press('l');
    for (let k = 0; k < 4; k++) {
      await listening(page);
      const q = await page.evaluate(() => window.__q);
      assert.ok(q.word.length >= lo && q.word.length <= hi, `${q.word}`);
      await page.keyboard.press('Enter');
      await page.waitForSelector('.read-pic.open');
      await page.waitForFunction(w => window.__q.word !== w || document.querySelector('.summary'), q.word);
    }
  });
}

test('lesing: runde på 8 ord gir oppsummering', async () => {
  const page = await open({ age: 5 });
  await page.keyboard.press('l');
  for (let k = 0; k < 8; k++) {
    await listening(page);
    const w = await page.evaluate(() => window.__q.word);
    await page.evaluate(x => window.__say(x), w);
    await page.waitForSelector('.read-pic.open');
  }
  await page.waitForSelector('.summary');
  assert.equal(await page.$$eval('.big-stars .on', e => e.length), 3);
  assert.ok((await prof(page)).stats.read >= 8);
});

// ───────── Butikk ─────────
async function shopTask(page, type, age) {
  for (let k = 0; k < 60; k++) {
    await page.waitForFunction(() => window.__q && document.querySelector('.shop-body') && !document.querySelector('.levelup'));
    const t = await page.evaluate(() => window.__q);
    if (t.type === type) {
      if (type !== 'pay') await listening(page);
      return t;
    }
    await page.keyboard.press('Escape');
    await page.keyboard.press('b');
    await page.waitForTimeout(50);
  }
  throw new Error(`fant ikke ${type} for ${age}`);
}

test('butikk: betal riktig beløp med mynter (klikk)', async () => {
  const page = await open({ age: 5 });
  await page.keyboard.press('b');
  const t = await shopTask(page, 'pay', 5);
  assert.equal(await page.$eval('.mic-area', e => getComputedStyle(e).visibility), 'hidden', 'ingen mikrofon ved betaling');
  const before = await xpOf(page);
  let left = t.price;
  for (const v of [10, 5, 1]) while (left >= v) { await page.click(`.wallet [data-v="${v}"]`); left -= v; }
  await page.waitForSelector('.counter.paid-ok');
  await page.waitForTimeout(150);
  assert.equal((await xpOf(page)) - before, 10);
  noErrors(page);
});

test('butikk: for mye → rister, ta tilbake mynt → riktig (5 XP)', async () => {
  const page = await open({ age: 5 });
  await page.keyboard.press('b');
  const t = await shopTask(page, 'pay', 5);
  const before = await xpOf(page);
  for (let k = 0; k < t.price - 1; k++) await page.keyboard.press('1');
  await page.keyboard.press('5'); // for mye
  await page.waitForSelector('.counter.shake');
  assert.equal(await page.$$eval('.counter-coins .coin', e => e.length), t.price);
  await page.click(`.counter-coins .coin-btn[data-k="${t.price - 1}"]`); // ta tilbake 5-kronen
  assert.equal(await page.$$eval('.counter-coins .coin', e => e.length), t.price - 1);
  await page.keyboard.press('1');
  await page.waitForSelector('.counter.paid-ok');
  await page.waitForTimeout(150);
  assert.equal((await xpOf(page)) - before, 5);
});

test('butikk: 3-åringer har bare 1-kroner og ser summen', async () => {
  const page = await open({ age: 3 });
  await page.keyboard.press('b');
  await shopTask(page, 'pay', 3);
  assert.deepEqual(await page.$$eval('.wallet .coin', e => e.map(x => x.dataset.v)), ['1']);
  await page.keyboard.press('1');
  assert.match(await page.textContent('.counter-sum'), /1 kr/);
});

test('butikk: tell pengene med tale', async () => {
  const page = await open({ age: 5 });
  await page.keyboard.press('b');
  const t = await shopTask(page, 'count', 5);
  assert.equal(await page.$$eval('.coin-pile .coin', e => e.reduce((s, x) => s + +x.dataset.v, 0)), t.answer);
  await page.evaluate(n => window.__say(`${n} kroner`), t.answer);
  await page.waitForSelector('.answer-slot.right');
});

test('butikk: har jeg råd? svar ja/nei med tale, feil gir «prøv igjen»', async () => {
  const page = await open({ age: 5 });
  await page.keyboard.press('b');
  const t = await shopTask(page, 'afford', 5);
  await page.evaluate(a => window.__say(a ? 'nei' : 'ja'), t.answer);
  await page.waitForSelector('.answer-slot.wrong');
  await listening(page);
  await page.evaluate(a => window.__say(a ? 'ja' : 'nei'), t.answer);
  await page.waitForSelector('.answer-slot.right');
  assert.equal(await page.textContent('.answer-slot'), t.answer ? 'Ja!' : 'Nei');
});

test('butikk: vekslepenger for 6-åringer', async () => {
  const page = await open({ age: 6 });
  await page.keyboard.press('b');
  const t = await shopTask(page, 'change', 6);
  assert.ok(await page.$(`.paid [data-v="${t.paid}"]`));
  await page.evaluate(n => window.__say(String(n)), t.answer);
  await page.waitForSelector('.answer-slot.right');
});

// ───────── Huskespill ─────────
for (const [age, pairs] of [[3, 3], [4.5, 6], [6, 10]]) {
  test(`huskespill alder ${age}: ${pairs} par, alle kan finnes og gir XP`, async () => {
    const page = await open({ age });
    await page.keyboard.press('h');
    await page.waitForSelector('.mem-grid');
    const { deck } = await page.evaluate(() => window.__q);
    assert.equal(deck.length, pairs * 2);
    assert.equal(await page.$$eval('.mcard', e => e.length), pairs * 2);
    const before = await xpOf(page);
    const seen = new Set();
    for (let a = 0; a < deck.length; a++) {
      if (seen.has(a)) continue;
      const b = deck.findIndex((e, k) => k !== a && e === deck[a]);
      seen.add(a); seen.add(b);
      await page.click(`.mcard[data-k="${a}"]`);
      await page.click(`.mcard[data-k="${b}"]`);
    }
    await page.waitForSelector('.mem-done');
    assert.equal(await page.$$eval('.mcard.match', e => e.length), pairs * 2);
    assert.match(await page.textContent('.mem-done'), new RegExp(`${pairs} forsøk`));
    await page.waitForTimeout(200);
    assert.equal((await xpOf(page)) - before, 10 + pairs * 2 + 10);
    noErrors(page);
  });
}

test('huskespill: to ulike kort snus tilbake, tredje kort kan ikke snus mens to er åpne', async () => {
  const page = await open({ age: 5 });
  await page.keyboard.press('h');
  await page.waitForSelector('.mem-grid');
  const { deck } = await page.evaluate(() => window.__q);
  const a = 0, b = deck.findIndex(e => e !== deck[0]);
  const c = deck.findIndex((e, k) => k !== a && k !== b);
  await page.click(`.mcard[data-k="${a}"]`);
  await page.click(`.mcard[data-k="${b}"]`);
  await page.click(`.mcard[data-k="${c}"]`);
  assert.equal(await page.$$eval('.mcard.up', e => e.length), 2, 'låst mens to er åpne');
  await page.waitForFunction(() => document.querySelectorAll('.mcard.up').length === 0, null, { timeout: 3000 });
  assert.equal(await page.textContent('.m-moves'), '1');
});

test('huskespill: piltaster og Enter snur kort', async () => {
  const page = await open({ age: 5 });
  await page.keyboard.press('h');
  await page.waitForSelector('.mem-grid');
  await page.focus('.mcard[data-k="0"]');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.k), '5');
  await page.keyboard.press('Enter');
  assert.ok(await page.$('.mcard[data-k="5"].up'));
});

// ───────── Tegning ─────────
const canvasBox = page => page.$eval('.paint', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const pixel = (page, fx, fy) => page.evaluate(([fx, fy]) => {
  const c = document.querySelector('.paint');
  return Array.from(c.getContext('2d').getImageData(Math.round(fx * c.width), Math.round(fy * c.height), 1, 1).data.slice(0, 3));
}, [fx, fy]);

test('tegning: pensel tegner, angre fjerner, viskelær visker', async () => {
  const page = await open();
  await page.keyboard.press('t');
  await page.waitForSelector('canvas.paint');
  const b = await canvasBox(page);
  assert.equal(Math.round(b.w / b.h * 100) / 100, 1.33, 'arket er 4:3');
  await page.mouse.move(b.x + b.w * .2, b.y + b.h * .5); await page.mouse.down();
  await page.mouse.move(b.x + b.w * .8, b.y + b.h * .5, { steps: 10 }); await page.mouse.up();
  assert.deepEqual(await pixel(page, .5, .5), [255, 77, 109], 'rød strek');
  await page.keyboard.press('u');
  assert.deepEqual(await pixel(page, .5, .5), [255, 255, 255], 'angret');
  await page.keyboard.press('u');
  await page.mouse.move(b.x + b.w * .2, b.y + b.h * .5); await page.mouse.down();
  await page.mouse.move(b.x + b.w * .8, b.y + b.h * .5, { steps: 10 }); await page.mouse.up();
  await page.keyboard.press('e');
  await page.mouse.move(b.x + b.w * .45, b.y + b.h * .5); await page.mouse.down();
  await page.mouse.move(b.x + b.w * .55, b.y + b.h * .5, { steps: 5 }); await page.mouse.up();
  assert.deepEqual(await pixel(page, .5, .5), [255, 255, 255], 'viskelær');
  noErrors(page);
});

test('tegning: fargelegging av mal fyller bare området innenfor strekene', async () => {
  const page = await open();
  await page.keyboard.press('t');
  await page.waitForSelector('canvas.paint');
  await page.keyboard.press('m');
  await page.click('[data-act=tpl][data-v=sol]');
  assert.equal(await page.$eval('[data-act=tool][data-v=fill]', e => e.classList.contains('sel')), true, 'fyll-bøtte valgt automatisk');
  await page.keyboard.press('4'); // gul
  const b = await canvasBox(page);
  await page.mouse.click(b.x + b.w * .5, b.y + b.h * .6); // inni sola
  assert.deepEqual(await pixel(page, .5, .6), [255, 210, 63]);
  assert.deepEqual(await pixel(page, .05, .05), [255, 255, 255], 'utenfor sola er urørt');
});

test('tegning: stempel setter et bilde', async () => {
  const page = await open();
  await page.keyboard.press('t');
  await page.waitForSelector('canvas.paint');
  await page.keyboard.press('t');
  assert.equal(await page.$eval('.stamps', e => e.hidden), false);
  const b = await canvasBox(page);
  await page.mouse.click(b.x + b.w * .5, b.y + b.h * .5);
  assert.notDeepEqual(await pixel(page, .5, .5), [255, 255, 255]);
});

test('tegning: lagre i galleri, XP første gang per dag, vis og slett', async () => {
  const page = await open();
  page.onDialog = d => d.accept();
  await page.keyboard.press('t');
  await page.waitForSelector('canvas.paint');
  const b = await canvasBox(page);
  await page.mouse.move(b.x + 50, b.y + 50); await page.mouse.down(); await page.mouse.move(b.x + 200, b.y + 120, { steps: 5 }); await page.mouse.up();
  const x0 = await xpOf(page);
  await page.click('[data-act=save]');
  await page.waitForTimeout(300);
  assert.equal((await xpOf(page)) - x0, 15);
  await page.keyboard.press('s');
  await page.waitForTimeout(300);
  assert.equal((await xpOf(page)) - x0, 15, 'ingen XP for andre lagring samme dag');
  const g = await page.evaluate(() => JSON.parse(localStorage.getItem('stjerneskolen.gallery.p1')));
  assert.equal(g.length, 2);
  assert.match(g[0].data, /^data:image\/jpeg;base64,/);
  await page.keyboard.press('g');
  assert.equal(await page.$$eval('.gal-item', e => e.length), 2);
  await page.click('.gal-img >> nth=0');
  await page.waitForSelector('.gal-big');
  await page.click('.panel-box [data-act=gallery]');
  await page.click('[data-act=del] >> nth=0');
  assert.equal(await page.$$eval('.gal-item', e => e.length), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('.draw-panel', e => e.hidden), true, 'Esc lukker galleriet');
  // Galleriet er per barn
  const other = await page.evaluate(() => localStorage.getItem('stjerneskolen.gallery.p2'));
  assert.equal(other, null);
});

test('tegning: tom-knapp spør først', async () => {
  const page = await open();
  await page.keyboard.press('t');
  await page.waitForSelector('canvas.paint');
  const b = await canvasBox(page);
  await page.mouse.move(b.x + b.w * .2, b.y + b.h * .5); await page.mouse.down(); await page.mouse.move(b.x + b.w * .8, b.y + b.h * .5, { steps: 5 }); await page.mouse.up();
  page.onDialog = d => d.dismiss();
  await page.click('[data-act=clear]');
  assert.notDeepEqual(await pixel(page, .5, .5), [255, 255, 255], 'avbrutt: tegningen står');
  page.onDialog = d => d.accept();
  await page.click('[data-act=clear]');
  assert.deepEqual(await pixel(page, .5, .5), [255, 255, 255]);
});
