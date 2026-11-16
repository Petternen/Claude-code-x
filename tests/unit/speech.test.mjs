import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {}; // speech.js leser window ved import
const { parseNumbers, judge } = await import('../../app/js/speech.js');

test('tolker sifre og alle grunntall 0–20', () => {
  const words = ['null', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv',
    'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten', 'tjue'];
  words.forEach((w, n) => assert.deepEqual(parseNumbers(w), [n], w));
  for (let n = 0; n <= 100; n++) assert.deepEqual(parseNumbers(String(n)), [n]);
});

test('varianter og dialektformer', () => {
  assert.deepEqual(parseNumbers('én'), [1]);
  assert.deepEqual(parseNumbers('ett'), [1]);
  assert.deepEqual(parseNumbers('ei'), [1]);
  assert.deepEqual(parseNumbers('syv'), [7]);
  assert.deepEqual(parseNumbers('tyve'), [20]);
  assert.deepEqual(parseNumbers('tredve'), [30]);
  assert.deepEqual(parseNumbers('Seks!'), [6]);
  assert.deepEqual(parseNumbers('ÅTTE.'), [8]);
});

test('sammensatte tall i alle skrivemåter', () => {
  assert.deepEqual(parseNumbers('tjuefem'), [25]);
  assert.deepEqual(parseNumbers('tjue fem'), [25]);
  assert.deepEqual(parseNumbers('tjue-fem'), [25]);
  assert.deepEqual(parseNumbers('fem og tjue'), [25]);
  assert.deepEqual(parseNumbers('førtito'), [42]);
  assert.deepEqual(parseNumbers('femti'), [50]);
  assert.deepEqual(parseNumbers('nittini'), [99]);
  assert.deepEqual(parseNumbers('hundre'), [100]);
});

test('tall inne i setninger og tom tale', () => {
  assert.deepEqual(parseNumbers('det er 7'), [7]);
  assert.deepEqual(parseNumbers('jeg tror det er fire'), [4]);
  assert.deepEqual(parseNumbers('en to tre fire'), [1, 2, 3, 4]);
  assert.deepEqual(parseNumbers(''), []);
  assert.deepEqual(parseNumbers('hmm vet ikke'), []);
  assert.deepEqual(parseNumbers(undefined), []);
});

test('«tjue» etterfulgt av «null» blir ikke 20+0-feil', () => {
  assert.deepEqual(parseNumbers('tjue null'), [20, 0]);
});

test('judge: endelig svar bruker siste tall (telling høyt)', () => {
  assert.equal(judge(['en to tre fire fem'], true, 5).correct, true);
  assert.equal(judge(['fem fire'], true, 5).correct, false);
  assert.equal(judge(['fem fire'], true, 5).heard, 4);
});

test('judge: et av alternativene holder', () => {
  assert.equal(judge(['sex', 'seks', 'fem'], true, 5).correct, true);
});

test('judge: foreløpig resultat godtas bare når entydig', () => {
  assert.equal(judge(['fem'], false, 5).correct, true);
  assert.equal(judge(['tre fire fem'], false, 5).correct, false);
  assert.equal(judge(['tre'], false, 5).correct, false); // feil delresultat gir ikke «feil» ennå
});

test('judge: ingen tall gir heard = null', () => {
  const r = judge(['hei', 'hallo'], true, 3);
  assert.equal(r.correct, false);
  assert.equal(r.heard, null);
});
