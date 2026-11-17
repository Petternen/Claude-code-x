import { NOUNS } from './data.js';

const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const SLOT = '<span class="answer-slot">?</span>';
const box = n => `<span class="numbox">${n}</span>`;
const slotBox = '<span class="numbox answer-slot">?</span>';

function weighted(types) {
  const e = Object.entries(types);
  let r = Math.random() * e.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of e) if ((r -= w) < 0) return k;
  return e[0][0];
}

const pics = (n, e, goneFrom = Infinity) =>
  Array.from({ length: n }, (_, i) =>
    `<span class="pic${i >= goneFrom ? ' gone' : ''}" style="--d:${i * 55}ms">${e}</span>`).join('');

const dots = n => n <= 10 ? `<span class="dots">${'<i></i>'.repeat(n)}</span>` : '';

const GEN = {
  count(c) {
    const n = R(1, c.countMax), noun = pick(NOUNS);
    return {
      answer: n, key: 'c' + n,
      say: `Hvor mange ${noun.pl} ser du?`,
      html: `<div class="pics count">${pics(n, noun.e)}</div><div class="eqline">${SLOT}</div>`,
    };
  },
  add(c) {
    const a = R(1, c.addMax - 1), b = R(1, c.addMax - a), noun = pick(NOUNS);
    const showPics = a + b <= (c.picsMax || 0);
    return {
      answer: a + b, key: `a${a}+${b}`,
      say: `Hva er ${a} pluss ${b}?`,
      html: (showPics ? `<div class="eq-pics"><div class="grp">${pics(a, noun.e)}</div><b class="op">+</b><div class="grp">${pics(b, noun.e)}</div></div>` : '') +
        `<div class="eqline"><span>${a}</span><b>+</b><span>${b}</span><b>=</b>${SLOT}</div>`,
    };
  },
  sub(c) {
    const a = R(2, c.subMax), b = R(1, c.age >= 5 ? a : a - 1), noun = pick(NOUNS);
    const showPics = a <= (c.picsMax || 0);
    return {
      answer: a - b, key: `s${a}-${b}`,
      say: `Hva er ${a} minus ${b}?`,
      html: (showPics ? `<div class="eq-pics"><div class="grp">${pics(a, noun.e, a - b)}</div></div>` : '') +
        `<div class="eqline"><span>${a}</span><b>−</b><span>${b}</span><b>=</b>${SLOT}</div>`,
    };
  },
  next(c) {
    const n = R(1, c.seqMax - 1);
    return {
      answer: n + 1, key: 'n' + n,
      say: `Hvilket tall kommer etter ${n}?`,
      html: `<div class="train"><span class="loco">🚂</span>${n > 1 ? box(n - 1) : ''}${box(n)}${slotBox}</div>`,
    };
  },
  before(c) {
    const n = R(2, c.seqMax);
    return {
      answer: n - 1, key: 'b' + n,
      say: `Hvilket tall kommer før ${n}?`,
      html: `<div class="train"><span class="loco">🚂</span>${slotBox}${box(n)}${box(n + 1)}</div>`,
    };
  },
  compare(c) {
    const a = R(1, c.cmpMax);
    let b;
    do { b = R(1, c.cmpMax); } while (b === a);
    const big = c.age < 4.5 || Math.random() < 0.5;
    const ans = big ? Math.max(a, b) : Math.min(a, b);
    return {
      answer: ans, key: `k${Math.min(a, b)}${Math.max(a, b)}${big}`,
      say: `Hvilket tall er ${big ? 'størst' : 'minst'}, ${a} eller ${b}?`,
      html: `<div class="cmp-q">${big ? '🐘 Størst?' : '🐭 Minst?'}</div>
        <div class="cmp"><div class="cmp-card" data-v="${a}"><b>${a}</b>${dots(a)}</div>
        <span class="vs">eller</span>
        <div class="cmp-card" data-v="${b}"><b>${b}</b>${dots(b)}</div></div>
        <div class="eqline">${SLOT}</div>`,
    };
  },
  seq(c) {
    const step = pick(c.steps || [1]);
    const maxStart = Math.max(step, c.seqMax - 3 * step);
    const start = step === 1 ? R(1, maxStart) : step * R(0, Math.floor(maxStart / step));
    const items = [0, 1, 2, 3].map(i => start + i * step);
    const miss = R(1, 3);
    return {
      answer: items[miss], key: `q${start}/${step}/${miss}`,
      say: `Hvilket tall mangler? ${items.map((v, i) => i === miss ? 'hva' : v).join(', ')}.`,
      html: `<div class="train">${items.map((v, i) => i === miss ? slotBox : box(v)).join('')}</div>`,
    };
  },
};

export function makeQuestion(cfg, prev) {
  let q;
  for (let i = 0; i < 8; i++) {
    const type = weighted(cfg.types);
    q = GEN[type](cfg);
    q.type = type;
    if (!prev || q.key !== prev.key) break;
  }
  return q;
}
