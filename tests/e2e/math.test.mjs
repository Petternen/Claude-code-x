import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, closeBrowser, closeContexts, newPage, makeProfile, prof, waitListening, closeLevelUps, noErrors, word } from './helpers.mjs';

let srv, base;
before(async () => { srv = await startServer(); base = srv.url; });
afterEach(closeContexts);
after(async () => { await closeBrowser(); srv.server.close(); });

const openMath = async ({ profile, ...opts } = {}) => {
  const page = await newPage(base, { ...opts, profile: makeProfile(profile) });
  await page.keyboard.press('1');
  return page;
};
const slot = page => page.$eval('.answer-slot', e => ({ text: e.textContent, cls: e.className }));
const micState = page => page.$eval('.mic', e => e.dataset.state);

test('riktig svar med tale gir grønn svarplass, stjerne i fremdriften og 10 XP', async () => {
  const page = await openMath();
  const q = await waitListening(page);
  assert.ok(q.say.length > 5);
  assert.match(await page.textContent('.heard'), /lytter/);
  await page.evaluate(t => window.__say(t), word(q.answer));
  await page.waitForFunction(() => document.querySelector('.answer-slot.right'));
  assert.equal((await slot(page)).text, String(q.answer));
  assert.equal(await micState(page), 'happy');
  assert.equal(await page.$$eval('.progress i.star', e => e.length), 1);
  await page.waitForSelector('.float-text');
  assert.match(await page.textContent('.float-text'), /\+10 XP/);
  const p = await prof(page);
  assert.equal(p.xp, 10);
  assert.equal(p.stats.math, 1);
  noErrors(page);
  await page.ctx.close();
});

test('svar som siffer, i setning og som foreløpig resultat godtas', async () => {
  const page = await openMath();
  let q = await waitListening(page);
  await page.evaluate(n => window.__say(`det er ${n}`), q.answer);
  await page.waitForSelector('.answer-slot.right');
  q = await waitListening(page);
  await page.evaluate(n => window.__say(String(n)), q.answer);
  await page.waitForSelector('.answer-slot.right');
  q = await waitListening(page);
  await page.evaluate(t => window.__say(t, false), word(q.answer)); // interim
  await page.waitForSelector('.answer-slot.right');
  noErrors(page);
  await page.ctx.close();
});

test('foreløpig feil tall gir ikke «feil» før endelig svar', async () => {
  const page = await openMath();
  const q = await waitListening(page);
  await page.evaluate(n => window.__say(String(n + 1), false), q.answer);
  await page.waitForTimeout(200);
  assert.equal((await slot(page)).text, '?');
  assert.doesNotMatch((await slot(page)).cls, /wrong/);
  assert.ok(await page.evaluate(() => !!window.__rec), 'lytter fortsatt');
  await page.ctx.close();
});

test('feil svar: viser tallet, rister, og lytter på nytt', async () => {
  const page = await openMath();
  const q = await waitListening(page);
  const starts = await page.evaluate(() => window.__recStarts);
  await page.evaluate(n => window.__say(String(n + 1)), q.answer);
  await page.waitForSelector('.answer-slot.wrong');
  assert.equal((await slot(page)).text, String(q.answer + 1));
  await waitListening(page);
  assert.ok(await page.evaluate(() => window.__recStarts) > starts);
  assert.equal((await prof(page)).xp, 0);
  // Riktig på andre forsøk gir 5 XP og grønn (ikke stjerne) prikk
  await page.evaluate(n => window.__say(String(n)), q.answer);
  await page.waitForSelector('.answer-slot.right');
  await page.waitForFunction(() => document.querySelector('.progress i.ok'));
  assert.equal(await page.$$eval('.progress i.star', e => e.length), 0);
  await page.waitForTimeout(100);
  assert.equal((await prof(page)).xp, 5);
  await page.ctx.close();
});

test('tre feil viser fasit, gir 2 XP og går videre', async () => {
  const page = await openMath();
  const q = await waitListening(page);
  for (let k = 0; k < 3; k++) {
    if (k) await waitListening(page);
    await page.evaluate(n => window.__say(String(n + 1)), q.answer);
  }
  await page.waitForSelector('.answer-slot.reveal');
  assert.equal((await slot(page)).text, String(q.answer));
  await page.waitForFunction(() => document.querySelector('.progress i.miss'));
  const q2 = await waitListening(page);
  assert.notEqual(q2, null);
  assert.equal((await prof(page)).xp, 2);
  await page.ctx.close();
});

test('stillhet: prøver å lytte på nytt to ganger, deretter vises «trykk på mikrofonen»', async () => {
  const page = await openMath();
  await waitListening(page);
  for (let k = 0; k < 3; k++) {
    await page.waitForFunction(() => !!window.__rec);
    await page.evaluate(() => window.__silence());
    await page.waitForTimeout(350);
  }
  assert.equal(await micState(page), 'idle');
  assert.match(await page.textContent('.heard'), /Trykk på mikrofonen/);
  assert.equal(await page.evaluate(() => window.__rec), null);
  await page.click('.mic', { force: true }); // knappen vrikker for å få oppmerksomhet
  await waitListening(page);
  assert.equal(await micState(page), 'listening');
  await page.ctx.close();
});

test('tale uten tall regnes ikke som feil', async () => {
  const page = await openMath();
  await waitListening(page);
  await page.evaluate(() => window.__say('hei hallo'));
  await waitListening(page);
  assert.doesNotMatch((await slot(page)).cls, /wrong/);
  assert.match(await page.textContent('.heard'), /hei hallo/);
  await page.ctx.close();
});

test('blokkert mikrofon gir tydelig beskjed', async () => {
  const page = await openMath();
  await waitListening(page);
  await page.evaluate(() => window.__error('not-allowed'));
  await page.waitForFunction(() => document.querySelector('.mic').dataset.state === 'blocked');
  assert.match(await page.textContent('.heard'), /blokkert/);
  await page.ctx.close();
});

test('nettleser uten talegjenkjenning: varsel vises og voksen kan taste svaret', async () => {
  const page = await openMath({ recognition: 'none' });
  await page.waitForSelector('.notice');
  assert.match(await page.textContent('.notice'), /Chrome|Safari/);
  await page.waitForFunction(() => window.__q && document.querySelector('.mic').dataset.state === 'unsupported');
  const q = await page.evaluate(() => window.__q);
  for (const d of String(q.answer)) await page.keyboard.press(d);
  assert.equal((await slot(page)).text, String(q.answer));
  await page.keyboard.press('Enter');
  await page.waitForSelector('.answer-slot.right');
  noErrors(page);
  await page.ctx.close();
});

test('skjult tastatur: Backspace retter, feil tall via tastatur gir «feil»', async () => {
  const page = await openMath();
  const q = await waitListening(page);
  await page.keyboard.press('9'); await page.keyboard.press('9');
  assert.equal((await slot(page)).text, '99');
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  assert.equal((await slot(page)).text, '?');
  const wrong = q.answer === 0 ? 1 : 0;
  await page.keyboard.press(String(wrong));
  await page.keyboard.press('Enter');
  await page.waitForSelector('.answer-slot.wrong');
  await page.ctx.close();
});

test('rekke-bonus: 3., 4. og 5. riktige på rad gir 12, 14 og 16 XP', async () => {
  const page = await openMath({ profile: { level: 50 } }); // høyt nivå → ingen nivå-feiring forstyrrer
  for (let k = 0; k < 5; k++) {
    const q = await waitListening(page);
    await page.evaluate(n => window.__say(String(n)), q.answer);
    await page.waitForSelector('.answer-slot.right');
  }
  await page.waitForTimeout(150);
  assert.equal((await prof(page)).xp, 10 + 10 + 12 + 14 + 16);
  assert.match(await page.textContent('.streak'), /5 på rad/);
  await page.ctx.close();
});

test('runde på 10: oppsummering med 3 stjerner, bonus-XP, og Enter starter ny runde', async () => {
  const page = await openMath({ profile: { level: 50 } });
  for (let k = 0; k < 10; k++) {
    const q = await waitListening(page);
    await page.evaluate(n => window.__say(String(n)), q.answer);
    await page.waitForSelector('.answer-slot.right');
  }
  await page.waitForSelector('.summary');
  assert.equal(await page.$$eval('.big-stars .on', e => e.length), 3);
  assert.match(await page.textContent('.summary'), /10 av 10/);
  await page.waitForTimeout(200);
  const xp = (await prof(page)).xp;
  // 10+10+12+14+16+18+20+20+20+20 = 160, + 30 bonus
  assert.equal(xp, 190);
  await page.keyboard.press('Enter');
  await waitListening(page);
  assert.equal(await page.$$eval('.progress i.star', e => e.length), 0);
  noErrors(page);
  await page.ctx.close();
});

test('mellomrom leser spørsmålet på nytt og Esc går hjem', async () => {
  const page = await openMath();
  await waitListening(page);
  const starts = await page.evaluate(() => window.__recStarts);
  await page.keyboard.press(' ');
  await page.waitForFunction(s => window.__recStarts > s, starts);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.tiles');
  assert.equal(await page.evaluate(() => window.__rec), null, 'sluttet å lytte');
  await page.ctx.close();
});

test('mikrofon-tips vises første gang og lagres', async () => {
  const page = await openMath({ profile: { seenMicTip: false } });
  await page.waitForSelector('.tip');
  await waitListening(page);
  assert.equal((await prof(page)).seenMicTip, true);
  await page.ctx.close();
});

test('nivå opp: feiring, skatt i samlingen og knappen er låst første sekund', async () => {
  const page = await openMath({ profile: { xp: 59 } });
  const q = await waitListening(page);
  await page.evaluate(n => window.__say(String(n)), q.answer);
  await page.waitForSelector('.levelup');
  assert.match(await page.textContent('.lu-level'), /2/);
  assert.match(await page.textContent('.levelup .art-name'), /Ener-stjerne/);
  assert.equal(await page.$eval('[data-close]', b => b.disabled), true);
  await page.keyboard.press('Enter');
  assert.ok(await page.$('.levelup'), 'Enter for tidlig lukker ikke');
  assert.equal(await page.evaluate(() => window.__rec), null, 'lytter ikke under feiring');
  await closeLevelUps(page);
  const p = await prof(page);
  assert.equal(p.level, 2);
  assert.deepEqual(p.items, ['a2']);
  assert.equal(await page.textContent('.lvl-num'), '2');
  await waitListening(page);
  await page.ctx.close();
});

test('nivå 5 gir utstyr som tas i bruk automatisk', async () => {
  const page = await openMath({ profile: { level: 4, xp: 80, items: ['a2', 'a3', 'a4'] } });
  const q = await waitListening(page);
  await page.evaluate(n => window.__say(String(n)), q.answer);
  await page.waitForSelector('.levelup');
  assert.match(await page.textContent('.levelup'), /Kyllingvenn/);
  await closeLevelUps(page);
  const p = await prof(page);
  assert.equal(p.equipped.pet, 'a5');
  assert.ok(await page.$('.hud .av-pet'), 'venn vises på figuren i toppfeltet');
  await page.ctx.close();
});

test('maks nivå 60 viser «MAKS NIVÅ» og gir ingen flere nivåer', async () => {
  const page = await openMath({ profile: { level: 60 } });
  assert.match(await page.textContent('.xptext'), /MAKS/);
  const q = await waitListening(page);
  await page.evaluate(n => window.__say(String(n)), q.answer);
  await page.waitForSelector('.answer-slot.right');
  await page.waitForTimeout(800);
  assert.equal(await page.$('.levelup'), null);
  assert.equal((await prof(page)).level, 60);
  await page.ctx.close();
});

for (const [age, allowed] of [[3, ['count']], [3.5, ['count', 'next']], [6, ['before', 'compare', 'add', 'sub', 'seq']]]) {
  test(`alder ${age}: bare riktige oppgavetyper i spillet`, async () => {
    const page = await openMath({ profile: { age, level: 50 } });
    for (let k = 0; k < 6; k++) {
      const q = await waitListening(page);
      assert.ok(allowed.includes(q.type), `${q.type} ikke tillatt for ${age} år`);
      await page.evaluate(n => window.__say(String(n)), q.answer);
      await page.waitForSelector('.answer-slot.right');
    }
    await page.ctx.close();
  });
}
