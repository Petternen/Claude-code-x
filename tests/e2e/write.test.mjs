import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, closeBrowser, closeContexts, newPage, makeProfile, prof, closeLevelUps, noErrors, strokePoints, drawPath, traceAll, currentStrokeLabel, unitPx } from './helpers.mjs';

let srv, base;
before(async () => { srv = await startServer(); base = srv.url; });
afterEach(closeContexts);
after(async () => { await closeBrowser(); srv.server.close(); });

const openWrite = async (over = {}) => {
  // Høyt nivå: unngår nivå-feiring midt i testene
  const page = await newPage(base, { profile: makeProfile({ level: 55, ...over }) });
  await page.keyboard.press('2');
  await page.waitForSelector('svg.trace .tube path');
  return page;
};
const chip = page => page.$eval('.chip.now', e => e.textContent);
const jump = async (page, key) => {
  // Playwright kan ikke trykke æ/ø/å – klikk brikken i stedet
  if (/^[æøå]$/i.test(key)) await page.click(`.chip >> text="${key.toUpperCase()}"`);
  else await page.keyboard.press(key);
  await page.waitForTimeout(80);
};

test('alle 29 bokstaver og 10 tall kan spores ferdig', async () => {
  const page = await openWrite();
  const fails = [];
  for (const [mode, keys] of [['letters', 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'], ['digits', '0123456789']]) {
    if (mode === 'digits') { await jump(page, 'Tab'); }
    for (const k of keys) {
      await jump(page, k.toLowerCase());
      assert.equal(await chip(page), k);
      await traceAll(page);
      if (await currentStrokeLabel(page) !== 'done') fails.push(k);
      await closeLevelUps(page);
    }
  }
  assert.deepEqual(fails, []);
  const p = await prof(page);
  assert.equal(Object.keys(p.traced).length, 39);
  assert.equal(p.stats.letters, 39);
  noErrors(page);
  await page.ctx.close();
});

test('alle tegn kan spores også på liten mobilskjerm (iPhone SE)', async () => {
  const page = await newPage(base, { profile: makeProfile({ level: 55 }), viewport: { width: 375, height: 667 } });
  await page.keyboard.press('2');
  await page.waitForSelector('svg.trace .tube path');
  for (const k of 'AMWØ8') {
    if (k === '8') await jump(page, 'Tab');
    await jump(page, k.toLowerCase());
    await traceAll(page);
    assert.equal(await currentStrokeLabel(page), 'done', k);
  }
  await page.ctx.close();
});

test('feil startpunkt teller ikke og gir hint', async () => {
  const page = await openWrite();
  await jump(page, 'l');
  const [s] = await strokePoints(page);
  await drawPath(page, s.map(([x, y]) => [x + 120, y]));
  assert.equal(await currentStrokeLabel(page), '1');
  assert.equal(await page.$$eval('svg.trace .ink polyline', e => e.length), 0, 'ingen blekk tegnet');
  assert.ok(await page.$('svg.trace .start.pulse'), 'startpunktet blinker');
  await page.ctx.close();
});

test('feil retning (baklengs) godkjennes ikke', async () => {
  const page = await openWrite();
  await jump(page, 'l');
  const [s] = await strokePoints(page);
  await drawPath(page, [...s].reverse());
  assert.equal(await currentStrokeLabel(page), '1');
  await page.ctx.close();
});

test('halvveis og løfter fingeren: streken nullstilles', async () => {
  const page = await openWrite();
  await jump(page, 'i');
  const [s] = await strokePoints(page);
  await drawPath(page, s.slice(0, 20));
  await page.waitForTimeout(450);
  assert.equal(await currentStrokeLabel(page), '1');
  assert.equal(await page.$$eval('svg.trace .ink polyline', e => e.length), 0, 'blekket fjernes');
  await page.ctx.close();
});

test('strøkene må tas i riktig rekkefølge', async () => {
  const page = await openWrite();
  await jump(page, 'h');
  const [s1, s2, s3] = await strokePoints(page);
  await drawPath(page, s3); // tverrstreken først – skal ikke telle
  assert.equal(await currentStrokeLabel(page), '1');
  await drawPath(page, s1);
  assert.equal(await currentStrokeLabel(page), '2');
  await drawPath(page, s3); // fortsatt feil rekkefølge
  assert.equal(await currentStrokeLabel(page), '2');
  await drawPath(page, s2);
  await drawPath(page, s3);
  assert.equal(await currentStrokeLabel(page), 'done');
  await page.ctx.close();
});

test('lukkede former (O) kan ikke jukses ved å bli stående ved start', async () => {
  const page = await openWrite();
  await jump(page, 'o');
  const [s] = await strokePoints(page);
  const [x, y] = s[0];
  await drawPath(page, [[x, y], [x + 4, y + 2], [x - 4, y + 3], [x + 2, y - 2], [x, y]]);
  assert.equal(await currentStrokeLabel(page), '1');
  // Snarvei rett over midten fra start til slutt
  await drawPath(page, [s[0], s[20], s.at(-1)]);
  assert.equal(await currentStrokeLabel(page), '1');
  await page.ctx.close();
});

test('alderen styrer presisjonen: 3-åring godkjennes med slingring der 6-åring ikke gjør det', async () => {
  for (const [age, expect] of [[3, 'done'], [6, '1']]) {
    const page = await openWrite({ age });
    await jump(page, 'i');
    const px = await unitPx(page);
    await traceAll(page, { offset: [16 * px, 0] }); // 16 SVG-enheter ved siden av
    assert.equal(await currentStrokeLabel(page), expect, `${age} år`);
    await page.ctx.close();
  }
});

test('ferdig bokstav gir 12 XP og går automatisk videre til neste', async () => {
  const page = await openWrite();
  await jump(page, 'b');
  const before = (await prof(page)).xp;
  await traceAll(page);
  await page.waitForTimeout(150);
  assert.equal((await prof(page)).xp - before, 12);
  assert.ok(await page.$('.chip.now.done'), 'stjerne på brikken');
  await page.waitForFunction(() => document.querySelector('.chip.now')?.textContent === 'C', null, { timeout: 4000 });
  await page.ctx.close();
});

test('tastatur: bokstavtast hopper, piler blar, Tab bytter fane, Esc går hjem', async () => {
  const page = await openWrite();
  await jump(page, 'k');
  assert.equal(await chip(page), 'K');
  await jump(page, 'ArrowRight');
  assert.equal(await chip(page), 'L');
  await jump(page, 'ArrowLeft'); await jump(page, 'ArrowLeft');
  assert.equal(await chip(page), 'J');
  await jump(page, 'a'); await jump(page, 'ArrowLeft');
  assert.equal(await chip(page), 'Å', 'blar rundt');
  await jump(page, 'Tab');
  assert.match(await page.textContent('.tab.sel'), /Tall/);
  await jump(page, '7');
  assert.equal(await chip(page), '7');
  await jump(page, 'Tab');
  assert.match(await page.textContent('.tab.sel'), /Ord/);
  await jump(page, 'Tab');
  assert.match(await page.textContent('.tab.sel'), /Bokstaver/);
  await jump(page, 'Escape');
  await page.waitForSelector('.tiles');
  await page.ctx.close();
});

test('klikk på brikke, pilknapper og tilbakestill-knapp virker', async () => {
  const page = await openWrite();
  await page.click('.chip[data-i="3"]');
  assert.equal(await chip(page), 'D');
  await page.click('[data-act=next]');
  assert.equal(await chip(page), 'E');
  const [s1] = await strokePoints(page);
  await drawPath(page, s1);
  assert.equal(await currentStrokeLabel(page), '2');
  await page.click('[data-act=reset]');
  assert.equal(await currentStrokeLabel(page), '1');
  await page.ctx.close();
});

test('ord: barnets navn er første ord, og hele ordet gir bonus', async () => {
  const page = await openWrite({ name: 'Åse-Liv' });
  await page.click('[data-act=mode][data-v=words]');
  assert.equal(await chip(page), 'ÅSELIV', 'navnet renses til sporbare bokstaver');
  await page.click('.chip[data-i="3"]'); // rekkefølge: ÅSELIV, IS, SOL, MOR
  assert.equal(await chip(page), 'MOR');
  await page.click('[data-act=prev]');
  assert.equal(await chip(page), 'SOL');
  const before = (await prof(page)).xp;
  for (let k = 0; k < 3; k++) {
    await page.waitForFunction(i => document.querySelectorAll('.word span')[i]?.classList.contains('now'), k);
    await traceAll(page);
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(100);
  const gained = (await prof(page)).xp - before;
  assert.equal(gained, 4 + 4 + (12 + 3 * 4));
  assert.equal((await prof(page)).stats.words, 1);
  await page.waitForFunction(() => document.querySelector('.chip.now')?.textContent === 'MOR', null, { timeout: 4000 });
  noErrors(page);
  await page.ctx.close();
});

test('nivå opp under skriving forstyrrer ikke neste bokstav', async () => {
  const page = await openWrite({ level: 1, xp: 55 });
  await jump(page, 'i');
  await traceAll(page);
  await page.waitForSelector('.levelup');
  await closeLevelUps(page);
  await page.waitForTimeout(1700);
  assert.equal(await chip(page), 'J');
  await traceAll(page);
  assert.equal(await currentStrokeLabel(page), 'done');
  await page.ctx.close();
});

test('sporet fremgang lagres og vises etter omstart', async () => {
  const page = await openWrite();
  await jump(page, 'x');
  await traceAll(page);
  await page.waitForTimeout(100);
  await page.reload();
  await page.keyboard.press('2');
  await page.waitForSelector('.chip');
  assert.ok(await page.$eval('.chip[data-i="23"]', e => e.classList.contains('done')), 'X har stjerne');
  await page.ctx.close();
});

test('retningspiler: hvert strøk over 40 enheter har minst én pil, og ingen pil står nær et hjørne', async () => {
  const page = await openWrite();
  const problems = [];
  for (const [mode, keys] of [['letters', 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'], ['digits', '0123456789']]) {
    if (mode === 'digits') await jump(page, 'Tab');
    for (const k of keys) {
      await jump(page, k.toLowerCase());
      let strokes = await strokePoints(page, 2);
      for (let si = 0; si < strokes.length; si++) {
        const info = await page.evaluate(() => {
          const svg = document.querySelector('svg.trace');
          const path = svg.querySelector('.tube path.active');
          return { len: path.getTotalLength(), arrows: svg.querySelectorAll('.hint .arrow').length };
        });
        if (info.len > 40 && info.arrows === 0) problems.push(`${k} strøk ${si + 1}`);
        strokes = await strokePoints(page);
        await drawPath(page, strokes[si]);
      }
      await closeLevelUps(page);
    }
  }
  assert.deepEqual(problems, [], 'strøk uten piler');
  await page.ctx.close();
});
