import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGES } from '../../app/js/data.js';
import { makeQuestion } from '../../app/js/math.js';

const N = 4000;
const nums = html => (html.match(/<span>(\d+)<\/span>/g) || []).map(s => +s.replace(/\D/g, ''));
const boxes = html => (html.match(/class="numbox">(\d+)</g) || []).map(s => +s.replace(/\D/g, ''));

for (const cfg of AGES) {
  test(`alder ${cfg.label}: alle oppgaver er gyldige og innenfor tallområdet`, () => {
    const seen = new Set();
    let prev = null, repeats = 0;
    for (let i = 0; i < N; i++) {
      const q = makeQuestion(cfg, prev);
      if (prev && q.key === prev.key) repeats++;
      prev = q;
      seen.add(q.type);
      assert.ok(cfg.types[q.type], `type ${q.type} er ikke aktiv for ${cfg.age}`);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 100, `svar ${q.answer}`);
      assert.equal((q.html.match(/answer-slot/g) || []).length, 1, 'nøyaktig én svarplass');
      assert.doesNotMatch(q.say + q.html, /undefined|NaN/, 'ingen undefined/NaN');
      assert.ok(q.say.endsWith('?') || q.say.endsWith('.'), q.say);

      switch (q.type) {
        case 'count': {
          const pics = (q.html.match(/class="pic"/g) || []).length;
          assert.equal(pics, q.answer, 'antall bilder = svar');
          assert.ok(q.answer >= 1 && q.answer <= cfg.countMax);
          break;
        }
        case 'add': {
          const [a, b] = nums(q.html);
          assert.equal(a + b, q.answer);
          assert.ok(a >= 1 && b >= 1 && q.answer <= cfg.addMax);
          assert.match(q.say, new RegExp(`${a} pluss ${b}`));
          const pics = (q.html.match(/class="pic/g) || []).length;
          assert.equal(pics, q.answer <= (cfg.picsMax || 0) ? q.answer : 0, 'bildestøtte etter picsMax');
          break;
        }
        case 'sub': {
          const [a, b] = nums(q.html);
          assert.equal(a - b, q.answer);
          assert.ok(a <= cfg.subMax && b >= 1);
          if (cfg.age < 5) assert.ok(q.answer >= 1, 'yngre barn får ikke 0 som svar');
          if (a <= (cfg.picsMax || 0)) assert.equal((q.html.match(/pic gone/g) || []).length, b, 'b bilder krysset ut');
          break;
        }
        case 'next': {
          const bx = boxes(q.html);
          assert.equal(q.answer, bx.at(-1) + 1);
          assert.ok(q.answer <= cfg.seqMax);
          break;
        }
        case 'before': {
          const bx = boxes(q.html);
          assert.equal(q.answer, bx[0] - 1);
          assert.ok(q.answer >= 1);
          break;
        }
        case 'compare': {
          const vals = [...q.html.matchAll(/data-v="(\d+)"/g)].map(m => +m[1]);
          assert.equal(vals.length, 2);
          assert.notEqual(vals[0], vals[1], 'to ulike tall');
          const big = q.say.includes('størst');
          assert.equal(q.answer, big ? Math.max(...vals) : Math.min(...vals));
          if (cfg.age < 4.5) assert.ok(big, 'yngste spør bare om størst');
          assert.ok(Math.max(...vals) <= cfg.cmpMax);
          break;
        }
        case 'seq': {
          const bx = boxes(q.html);
          assert.equal(bx.length, 3);
          const all = [...bx, q.answer].sort((x, y) => x - y);
          const step = all[1] - all[0];
          assert.ok(cfg.steps.includes(step), `steg ${step}`);
          for (let k = 1; k < 4; k++) assert.equal(all[k] - all[k - 1], step);
          assert.ok(all[3] <= Math.max(cfg.seqMax, 100));
          break;
        }
      }
    }
    assert.deepEqual([...seen].sort(), Object.keys(cfg.types).sort(), 'alle oppgavetyper forekommer');
    assert.ok(repeats / N < 0.01, `for mange gjentakelser: ${repeats}`);
  });
}

test('vektingen følger konfigurasjonen (±5 prosentpoeng)', () => {
  const cfg = AGES.find(a => a.age === 5);
  const cnt = {};
  for (let i = 0; i < 20000; i++) { const t = makeQuestion(cfg).type; cnt[t] = (cnt[t] || 0) + 1; }
  const sum = Object.values(cfg.types).reduce((s, w) => s + w, 0);
  for (const [t, w] of Object.entries(cfg.types)) {
    assert.ok(Math.abs(cnt[t] / 20000 - w / sum) < 0.05, `${t}: ${cnt[t] / 20000} vs ${w / sum}`);
  }
});
