import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {};
const { wordMatches, wordJudge, yesNo, yesNoJudge, numberJudge } = await import('../../app/js/listen.js');
const { READ_WORDS, READ_LEN, SHOP_AGES, MEMORY_PAIRS, MEMORY_PICS, TEMPLATES, PAINT_COLORS, STAMPS } = await import('../../app/js/content.js');
const { makeShopTask, randomCoins } = await import('../../app/js/shop.js');
const { memoryXp, gridCols } = await import('../../app/js/memory.js');
const { floodFill, hexTo32 } = await import('../../app/js/draw.js');
const { hashSecret, verifySecret, passwordProblem, newRecoveryCode, normCode, DEFAULTS } = await import('../../app/js/screentime.js');
const { GLYPHS } = await import('../../app/js/data.js');

// ───────── Lesing ─────────
test('lesing: ord godtas i setning, store/små bokstaver og med én feil i lange ord', () => {
  assert.ok(wordMatches('sol', 'SOL'));
  assert.ok(wordMatches('Det står Sol!', 'SOL'));
  assert.ok(wordMatches('banan', 'BANAN'));
  assert.ok(wordMatches('bana', 'BANAN'), 'én bokstav feil i langt ord');
  assert.ok(!wordMatches('sal', 'SOL'), 'korte ord må være eksakte');
  assert.ok(!wordMatches('bil', 'SOL'));
  assert.ok(wordMatches('snø', 'SNØ') && wordMatches('båt', 'BÅT'));
});

test('lesing: judge gir «hørt» bare på endelig resultat', () => {
  const j = wordJudge('HUS');
  assert.deepEqual(j(['hus'], false), { correct: true });
  assert.equal(j(['mus'], false).heard, null);
  assert.equal(j(['mus'], true).heard, 'mus');
  assert.equal(j([''], true).heard, null);
});

test('lesing: ordlister per alder finnes, er sporbare og har bilde', () => {
  for (const [age, [lo, hi]] of Object.entries(READ_LEN)) {
    const n = READ_WORDS.filter(([w]) => w.length >= lo && w.length <= hi).length;
    assert.ok(n >= 6, `alder ${age}: bare ${n} ord`);
  }
  for (const [w, e] of READ_WORDS) {
    assert.ok(e, w);
    for (const c of w) assert.ok(GLYPHS[c], `${w}: ${c}`);
  }
  assert.equal(new Set(READ_WORDS.map(w => w[0])).size, READ_WORDS.length, 'ingen duplikater');
});

// ───────── Butikk ─────────
test('butikk: ja/nei tolkes', () => {
  assert.equal(yesNo('ja'), true);
  assert.equal(yesNo('Jo, det har jeg'), true);
  assert.equal(yesNo('nei'), false);
  assert.equal(yesNo('ja nei'), null);
  assert.equal(yesNo('kanskje'), null);
  assert.deepEqual(yesNoJudge(true)(['ja'], true), { correct: true });
  assert.equal(yesNoJudge(true)(['nei'], true).heard, 'nei');
  assert.equal(numberJudge(7)(['sju'], true).correct, true);
});

test('butikk: tilfeldige mynter bruker bare tillatte mynter og gir riktig sum', () => {
  for (const cfg of Object.values(SHOP_AGES)) {
    for (let k = 0; k < 300; k++) {
      const c = randomCoins(cfg.coins, 2, cfg.max);
      const sum = c.reduce((a, b) => a + b, 0);
      assert.ok(c.every(v => cfg.coins.includes(v)), `ulovlig mynt ${c}`);
      assert.ok(sum >= 2 && sum <= cfg.max, `sum ${sum}`);
      assert.ok(c.length <= 6);
    }
  }
});

for (const age of Object.keys(SHOP_AGES).map(Number)) {
  test(`butikk alder ${age}: alle oppgaver er gyldige`, () => {
    const cfg = SHOP_AGES[age], seen = new Set();
    let prev;
    for (let k = 0; k < 2000; k++) {
      const t = makeShopTask(age, prev); prev = t;
      seen.add(t.type);
      assert.ok(cfg.types[t.type], `${t.type} ikke tillatt`);
      assert.doesNotMatch(t.say, /undefined|NaN/);
      if (t.type === 'pay') assert.ok(t.price >= 1 && t.price <= cfg.max && t.answer === t.price);
      if (t.type === 'count') assert.equal(t.answer, t.coins.reduce((a, b) => a + b, 0));
      if (t.type === 'afford') { assert.notEqual(t.have, t.price); assert.equal(t.answer, t.have >= t.price); }
      if (t.type === 'change') { assert.ok(t.paid > t.price && t.answer === t.paid - t.price); assert.ok(t.paid <= cfg.max); }
    }
    assert.deepEqual([...seen].sort(), Object.keys(cfg.types).sort());
  });
}

test('butikk: vekslepenger bare for 6 år, «har jeg råd» fra 4½', () => {
  for (const [age, cfg] of Object.entries(SHOP_AGES)) {
    assert.equal(!!cfg.types.change, +age === 6, `alder ${age}`);
    assert.equal(!!cfg.types.afford, +age >= 4.5, `alder ${age}`);
  }
});

// ───────── Huskespill ─────────
test('huskespill: antall par øker med alderen og det finnes nok bilder', () => {
  const v = Object.entries(MEMORY_PAIRS).sort((a, b) => a[0] - b[0]).map(e => e[1]);
  for (let k = 1; k < v.length; k++) assert.ok(v[k] >= v[k - 1]);
  assert.ok(Math.max(...v) <= MEMORY_PICS.length);
  assert.equal(new Set(MEMORY_PICS).size, MEMORY_PICS.length);
  assert.equal(gridCols(6), 3); assert.equal(gridCols(16), 4); assert.equal(gridCols(20), 5);
  assert.equal(memoryXp(6, 8), 10 + 12 + 10, 'bonus for få forsøk');
  assert.equal(memoryXp(6, 20), 10 + 12);
});

// ───────── Tegning ─────────
test('tegning: fyll stopper ved streker og fyller hele lukkede felt', () => {
  const w = 20, h = 10, white = hexTo32('#ffffff'), red = hexTo32('#ff4d6d');
  const paint = new Uint32Array(w * h).fill(white);
  const lines = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) lines[(y * w + 10) * 4 + 3] = 255; // loddrett strek ved x=10
  const n = floodFill(paint, lines, w, h, 2, 2, red);
  assert.equal(n, 10 * h, 'venstre halvdel fylt');
  assert.equal(paint[2 * w + 15], white, 'høyre side urørt');
  assert.equal(floodFill(paint, lines, w, h, 10, 2, red), 0, 'klikk på streken fyller ingenting');
  assert.equal(floodFill(paint, lines, w, h, 2, 2, red), 0, 'samme farge gir ingen evig løkke');
});

test('tegning: fyll uten mal fyller sammenhengende farge', () => {
  const w = 8, h = 8, white = hexTo32('#ffffff'), blue = hexTo32('#3aa8ff'), black = hexTo32('#1d1b2f');
  const paint = new Uint32Array(w * h).fill(white);
  for (let x = 0; x < w; x++) paint[4 * w + x] = black; // vannrett svart strek
  assert.equal(floodFill(paint, null, w, h, 0, 0, blue), 4 * w);
  assert.equal(paint[6 * w], white);
});

test('tegning: farger, stempler og maler er gyldige', () => {
  assert.equal(PAINT_COLORS.length, 10);
  for (const c of PAINT_COLORS) assert.match(c, /^#[0-9a-f]{6}$/);
  assert.equal(hexTo32('#ff0000'), 0xff0000ff, 'RGBA i little-endian');
  assert.ok(STAMPS.length >= 8);
  for (const t of TEMPLATES) {
    assert.ok(t.id && t.n && t.e && t.d.length >= 3, t.id);
    for (const d of t.d) assert.match(d, /^M[\d\s.,MLCZamlcz-]+$/, `${t.id}: ${d}`);
  }
});

// ───────── Skjermtid ─────────
test('skjermtid: standard 10 min spill og 30 min pause, på', () => {
  assert.equal(DEFAULTS.playMin, 10);
  assert.equal(DEFAULTS.pauseMin, 30);
  assert.equal(DEFAULTS.enabled, true);
});

test('skjermtid: passordkrav', () => {
  assert.match(passwordProblem('abc123'), /8 tegn/);
  assert.match(passwordProblem('abcdefgh'), /bokstaver og tall/);
  assert.match(passwordProblem('12345678'), /bokstaver og tall/);
  assert.equal(passwordProblem('sommer2026'), '');
  assert.equal(passwordProblem('Æblegrød9'), '');
});

test('skjermtid: passord lagres som salted hash og verifiseres', async () => {
  const h = await hashSecret('sommer2026');
  assert.ok(h.salt && h.hash);
  assert.ok(!JSON.stringify(h).includes('sommer'), 'ikke klartekst');
  assert.notEqual((await hashSecret('sommer2026')).hash, h.hash, 'nytt salt gir ny hash');
  assert.ok(await verifySecret('sommer2026', h));
  assert.ok(!(await verifySecret('sommer2027', h)));
  assert.ok(!(await verifySecret('x', null)));
});

test('skjermtid: gjenopprettingskode er lang, entydig og tåler skrivemåte', () => {
  const c = newRecoveryCode();
  assert.match(c, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
  assert.doesNotMatch(c, /[01OI]/, 'ingen forvekslbare tegn');
  assert.equal(normCode(c.toLowerCase().replace(/-/g, ' ')), c.replace(/-/g, ''));
  assert.notEqual(newRecoveryCode(), newRecoveryCode());
});
