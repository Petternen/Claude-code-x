// Profiler, hjem, samling, lagring og robusthet.
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, closeBrowser, closeContexts, newPage, makeProfile, db, prof, noErrors } from './helpers.mjs';

let srv, base;
before(async () => { srv = await startServer(); base = srv.url; });
afterEach(closeContexts);
after(async () => { await closeBrowser(); srv.server.close(); });

test('første oppstart: velkomst, ny spiller kun med tastatur', async () => {
  const page = await newPage(base);
  assert.match(await page.textContent('.sub'), /Velkommen/);
  await page.keyboard.press('n');
  await page.waitForSelector('#nm');
  assert.equal(await page.$('[data-act=cancel]'), null, 'ingen avbryt når det ikke finnes spillere');
  await page.keyboard.type('Nora');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.tiles');
  const p = await prof(page);
  assert.equal(p.name, 'Nora');
  assert.equal(p.age, 4, 'standardalder');
  assert.match(await page.textContent('.hello h1'), /Hei, Nora!/);
  noErrors(page);
  await page.ctx.close();
});

test('tomt navn avvises', async () => {
  const page = await newPage(base);
  await page.keyboard.press('n');
  await page.waitForSelector('#nm');
  await page.keyboard.type('   ');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  assert.ok(await page.$('#nm'), 'fortsatt på skjemaet');
  assert.equal((await db(page))?.profiles.length ?? 0, 0);
  await page.ctx.close();
});

test('valg av figur og alder lagres; Enter på knapp starter', async () => {
  const page = await newPage(base);
  await page.keyboard.press('n');
  await page.fill('#nm', 'Ali');
  await page.click('[data-act=age][data-v="5.5"]');
  assert.ok(await page.$('#nm'), 'alder-klikk sender ikke inn skjemaet');
  await page.click('.av-opt >> nth=3');
  const chosen = await page.$eval('.av-opt.sel', e => e.dataset.v);
  await page.keyboard.press('Enter'); // fokus på figurknappen
  await page.waitForSelector('.tiles');
  const p = await prof(page);
  assert.equal(p.age, 5.5);
  assert.equal(p.avatar, chosen);
  await page.ctx.close();
});

test('navn med HTML vises som tekst (ingen injeksjon)', async () => {
  const page = await newPage(base);
  await page.keyboard.press('n');
  await page.fill('#nm', '<img src=x onerror=alert(1)>');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.tiles');
  assert.equal(await page.$('.hello img'), null);
  assert.match(await page.textContent('.hello h1'), /<img/);
  noErrors(page);
  await page.ctx.close();
});

test('flere spillere: liste etter omstart, velg med talltast, Esc bytter spiller', async () => {
  const page = await newPage(base);
  for (const n of ['Ada', 'Bo']) {
    if (await page.$('.tiles')) await page.keyboard.press('Escape');
    await page.keyboard.press('n');
    await page.fill('#nm', n);
    await page.keyboard.press('Enter');
    await page.waitForSelector('.tiles');
  }
  await page.keyboard.press('Escape');
  await page.waitForSelector('.profile-card');
  assert.equal(await page.$$eval('.profile-card:not(.add)', e => e.length), 2);
  await page.reload();
  await page.waitForSelector('.tiles'); // husker sist valgte (Bo)
  assert.match(await page.textContent('.hud-name'), /Bo/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('1');
  await page.waitForSelector('.tiles');
  assert.match(await page.textContent('.hud-name'), /Ada/);
  assert.equal((await db(page)).current, (await db(page)).profiles[0].id);
  await page.ctx.close();
});

test('hjem: talltaster åpner moduler, + og − endrer alder innenfor grensene', async () => {
  const page = await newPage(base, { profile: makeProfile({ age: 5.5 }) });
  await page.keyboard.press('+');
  assert.equal((await prof(page)).age, 6);
  await page.keyboard.press('+');
  assert.equal((await prof(page)).age, 6, 'ikke over 6');
  for (let k = 0; k < 8; k++) await page.keyboard.press('-');
  assert.equal((await prof(page)).age, 3, 'ikke under 3');
  assert.equal(await page.$eval('.age-pill.sel', e => e.dataset.v), '3');
  await page.click('[data-act=age][data-v="4.5"]');
  assert.equal((await prof(page)).age, 4.5);
  for (const [k, sel] of [['s', 'svg.trace'], ['c', '.art-grid'], ['m', '.q-card'], ['b', '.shop-body'], ['l', '.read-word'], ['h', '.mem-grid'], ['t', 'canvas.paint']]) {
    await page.keyboard.press(k);
    await page.waitForSelector(sel);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.tiles');
  }
  noErrors(page);
  await page.ctx.close();
});

test('slett spiller: avbryt beholder, bekreft sletter', async () => {
  const page = await newPage(base, { profile: makeProfile() });
  page.onDialog = d => d.dismiss();
  await page.click('[data-act=delete]');
  assert.equal((await db(page)).profiles.length, 1);
  page.onDialog = d => d.accept();
  await page.click('[data-act=delete]');
  await page.waitForSelector('.profile-card.add');
  assert.equal((await db(page)).profiles.length, 0);
  await page.ctx.close();
});

test('samling: låste kort, bruk/ta av utstyr, avatar oppdateres', async () => {
  const items = Array.from({ length: 9 }, (_, i) => 'a' + (i + 2)); // nivå 2–10
  const page = await newPage(base, { profile: makeProfile({ level: 10, items }) });
  await page.keyboard.press('c');
  await page.waitForSelector('.art-grid');
  assert.match(await page.textContent('.coll-head'), /9 av 59/);
  assert.equal(await page.$$eval('.art-card.locked', e => e.length), 50);
  await page.click('[data-id=a10]'); // Tellecaps (hatt)
  assert.equal((await prof(page)).equipped.hat, 'a10');
  assert.ok(await page.$('.coll-head .av-hat'));
  assert.ok(await page.$('[data-id=a10].equipped'));
  await page.click('[data-id=a10]');
  assert.equal((await prof(page)).equipped.hat, null);
  await page.click('[data-id=a15]', { force: true }); // låst (aria-disabled)
  assert.equal((await prof(page)).equipped.aura, null);
  await page.click('[data-id=a3]'); // samlekort – ingen utstyr
  assert.deepEqual((await prof(page)).equipped, { hat: null, pet: null, aura: null });
  noErrors(page);
  await page.ctx.close();
});

test('alle auraer og hatter rendres uten feil', async () => {
  const items = Array.from({ length: 59 }, (_, i) => 'a' + (i + 2));
  const page = await newPage(base, { profile: makeProfile({ level: 60, items, equipped: { hat: 'a50', pet: 'a55', aura: 'a60' } }) });
  await page.keyboard.press('c');
  await page.waitForSelector('.art-grid');
  assert.equal(await page.$$eval('.art-card.locked', e => e.length), 0);
  for (const id of ['a15', 'a30', 'a45', 'a60']) {
    await page.click(`[data-id=${id}]`);
    if ((await prof(page)).equipped.aura !== id) await page.click(`[data-id=${id}]`);
    const auraCls = await page.$eval('.coll-head .avatar', e => e.className);
    assert.match(auraCls, /aura-(ice|rainbow|gold|galaxy)/, id);
  }
  noErrors(page);
  await page.ctx.close();
});

test('ødelagt lagring krasjer ikke appen', async () => {
  const page = await newPage(base, { storage: '{ødelagt json' });
  await page.waitForSelector('.profile-card.add');
  noErrors(page);
  await page.ctx.close();
});

test('profil fra eldre versjon uten nye felt fungerer', async () => {
  const old = makeProfile();
  delete old.traced; delete old.seenMicTip;
  const page = await newPage(base, { profile: old });
  await page.keyboard.press('s');
  await page.waitForSelector('svg.trace .tube path');
  await page.keyboard.press('Escape');
  await page.keyboard.press('m');
  await page.waitForSelector('.q-card');
  noErrors(page);
  await page.ctx.close();
});
