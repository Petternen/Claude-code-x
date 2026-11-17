import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpForLevel, addXp, newProfile, MAX_LEVEL, XP_BASE, XP_GROWTH } from '../../app/js/state.js';

const total = () => { let t = 0; for (let l = 1; l < MAX_LEVEL; l++) t += xpForLevel(l); return t; };

test('XP-kravet er eksponentielt og strengt økende', () => {
  assert.equal(xpForLevel(1), XP_BASE);
  for (let l = 2; l < MAX_LEVEL; l++) {
    assert.ok(xpForLevel(l) > xpForLevel(l - 1), `nivå ${l}`);
    const ratio = xpForLevel(l) / xpForLevel(l - 1);
    assert.ok(Math.abs(ratio - XP_GROWTH) < 0.02, `forhold ${ratio} ved nivå ${l}`);
  }
});

test('total XP til nivå 60 tilsvarer ca. 6 måneder (150–230 dager à 350 XP)', () => {
  const days = total() / 350;
  assert.ok(days > 150 && days < 230, `${days} dager`);
});

test('nye profiler starter på nivå 1 uten XP og skatter', () => {
  const p = newProfile('Ola', '🐻', 4);
  assert.equal(p.level, 1);
  assert.equal(p.xp, 0);
  assert.deepEqual(p.items, []);
  assert.deepEqual(p.equipped, { hat: null, pet: null, aura: null });
  assert.notEqual(newProfile('A', 'x', 3).id, newProfile('A', 'x', 3).id);
});

test('addXp: under grensen gir ingen nivåøkning', () => {
  const p = newProfile('A', 'x', 3);
  assert.deepEqual(addXp(p, XP_BASE - 1), []);
  assert.equal(p.level, 1);
  assert.equal(p.xp, XP_BASE - 1);
});

test('addXp: nøyaktig på grensen gir nivå 2 og 0 XP', () => {
  const p = newProfile('A', 'x', 3);
  assert.deepEqual(addXp(p, XP_BASE), [2]);
  assert.equal(p.level, 2);
  assert.equal(p.xp, 0);
});

test('addXp: overskudd tas med og flere nivåer kan nås samtidig', () => {
  const p = newProfile('A', 'x', 3);
  const amount = xpForLevel(1) + xpForLevel(2) + xpForLevel(3) + 5;
  assert.deepEqual(addXp(p, amount), [2, 3, 4]);
  assert.equal(p.xp, 5);
  assert.equal(p.totalXp, amount);
});

test('addXp: stopper på nivå 60, men totalXp øker videre', () => {
  const p = newProfile('A', 'x', 3);
  const lv = addXp(p, total() + 10_000);
  assert.equal(lv.length, MAX_LEVEL - 1);
  assert.equal(lv.at(-1), MAX_LEVEL);
  assert.equal(p.level, MAX_LEVEL);
  assert.equal(p.xp, 0);
  assert.deepEqual(addXp(p, 500), []);
  assert.equal(p.level, MAX_LEVEL);
  assert.equal(p.totalXp, total() + 10_500);
});
