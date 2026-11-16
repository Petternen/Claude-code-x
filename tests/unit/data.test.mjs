import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGES, AVATARS, GLYPHS, LETTERS, DIGITS, EXAMPLES, DIGIT_PICS, WORDS, ARTIFACTS, ART, artifactForLevel, SLOT_NAMES } from '../../app/js/data.js';

test('sju alderstrinn i stigende rekkefølge', () => {
  assert.deepEqual(AGES.map(a => a.age), [3, 3.5, 4, 4.5, 5, 5.5, 6]);
});

test('hvert alderstrinn har tallgrenser for oppgavetypene sine', () => {
  const need = { count: ['countMax'], next: ['seqMax'], before: ['seqMax'], compare: ['cmpMax'], add: ['addMax'], sub: ['subMax'], seq: ['seqMax', 'steps'] };
  for (const a of AGES) {
    assert.ok(Object.keys(a.types).length > 0, `${a.age}: ingen typer`);
    for (const t of Object.keys(a.types)) {
      assert.ok(need[t], `${a.age}: ukjent type ${t}`);
      for (const f of need[t]) assert.ok(a[f] != null, `${a.age}: ${t} mangler ${f}`);
    }
  }
});

test('vanskelighetsgraden øker med alderen', () => {
  for (let i = 1; i < AGES.length; i++) {
    assert.ok(AGES[i].tol <= AGES[i - 1].tol, 'sporingstoleransen skal minke');
    assert.ok(AGES[i].width <= AGES[i - 1].width, 'sporbredden skal minke');
  }
  const max = a => Math.max(a.countMax || 0, a.addMax || 0, a.subMax || 0, a.cmpMax || 0, a.seqMax || 0);
  for (let i = 1; i < AGES.length; i++) assert.ok(max(AGES[i]) >= max(AGES[i - 1]), `tallområde ${AGES[i].age}`);
  assert.deepEqual(Object.keys(AGES[0].types), ['count'], '3-åringer skal bare telle');
});

test('alle bokstaver A–Å og tall 0–9 har sporingsmal', () => {
  assert.equal(LETTERS.length, 29);
  assert.ok(LETTERS.includes('Æ') && LETTERS.includes('Ø') && LETTERS.includes('Å'));
  for (const c of [...LETTERS, ...DIGITS]) {
    assert.ok(Array.isArray(GLYPHS[c]) && GLYPHS[c].length > 0, c);
    for (const d of GLYPHS[c]) assert.match(d, /^M[\d. ]+( [LC][\d. -]+)+$/, `${c}: ugyldig sti ${d}`);
  }
});

test('alle stier (inkl. kontrollpunkter) holder seg innenfor tegneflaten (viewBox −18…118 × −8…148)', () => {
  for (const [c, strokes] of Object.entries(GLYPHS)) {
    const nums = strokes.join(' ').match(/-?\d+(\.\d+)?/g).map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      assert.ok(nums[i] >= 0 && nums[i] <= 100, `${c}: x=${nums[i]}`);
      assert.ok(nums[i + 1] >= 0 && nums[i + 1] <= 145, `${c}: y=${nums[i + 1]}`);
    }
  }
});

test('alle bokstaver har eksempelord som starter på bokstaven', () => {
  for (const c of LETTERS) {
    assert.ok(EXAMPLES[c], c);
    assert.equal(EXAMPLES[c][0][0].toUpperCase(), c);
  }
  assert.equal(DIGIT_PICS.length, 10);
});

test('alle ord kan skrives med tilgjengelige maler', () => {
  for (const [w] of WORDS) for (const c of w) assert.ok(GLYPHS[c], `${w}: ${c}`);
  assert.equal(new Set(WORDS.map(w => w[0])).size, WORDS.length, 'duplikate ord');
});

test('én unik skatt for hvert nivå 2–60', () => {
  assert.equal(ARTIFACTS.length, 59);
  assert.equal(new Set(ARTIFACTS.map(a => a.id)).size, 59);
  assert.equal(new Set(ARTIFACTS.map(a => a.n)).size, 59, 'duplikate navn');
  for (let l = 2; l <= 60; l++) assert.equal(artifactForLevel(l).level, l);
  assert.equal(artifactForLevel(1), null);
  assert.equal(artifactForLevel(61), null);
  for (const a of ARTIFACTS) assert.ok(a.e && a.n && a.rarity && a.rarityName, a.id);
});

test('utstyr hvert 5. nivå, med gyldige plasser', () => {
  const cos = ARTIFACTS.filter(a => a.slot);
  assert.deepEqual(cos.map(a => a.level), [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
  for (const a of cos) {
    assert.ok(SLOT_NAMES[a.slot], a.id);
    if (a.slot === 'aura') assert.ok(a.aura, `${a.id} mangler aura-klasse`);
  }
  for (const slot of Object.keys(SLOT_NAMES)) assert.ok(cos.some(a => a.slot === slot), slot);
});

test('sjeldenhet øker med nivå', () => {
  const order = ['common', 'rare', 'epic', 'legend'];
  for (let i = 1; i < ARTIFACTS.length; i++) {
    assert.ok(order.indexOf(ARTIFACTS[i].rarity) >= order.indexOf(ARTIFACTS[i - 1].rarity));
  }
  assert.equal(ART.a60.rarity, 'legend');
});

test('avatarer er unike', () => {
  assert.equal(new Set(AVATARS).size, AVATARS.length);
});
