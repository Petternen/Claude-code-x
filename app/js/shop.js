// Butikk: betal riktig beløp, tell pengene, har jeg råd?, vekslepenger.
import { SHOP_AGES, SHOP_ITEMS } from './content.js';
import { createListener, numberJudge, yesNoJudge } from './listen.js';
import { canListen } from './speech.js';

const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const KEYS = { '1': 1, '5': 5, '0': 10, '2': 20 };
export const coinHTML = (v, cls = '') => v >= 50
  ? `<span class="bill ${cls}" data-v="${v}">${v}<small>kr</small></span>`
  : `<span class="coin c${v} ${cls}" data-v="${v}">${v}<small>kr</small></span>`;

/** Tilfeldige mynter (fra de tillatte) med sum mellom lo og hi, maks 6 mynter. */
export function randomCoins(coins, lo, hi) {
  for (let t = 0; t < 200; t++) {
    const out = [];
    let sum = 0;
    const target = R(lo, hi);
    while (sum < target && out.length < 6) {
      const ok = coins.filter(c => sum + c <= target);
      const c = pick(ok.length > 1 && Math.random() < 0.7 ? ok.filter(x => x > 1) .concat(ok) : ok);
      out.push(c); sum += c;
    }
    if (sum === target) return out.sort((a, b) => b - a);
  }
  return [1];
}

function weighted(types) {
  const e = Object.entries(types);
  let r = Math.random() * e.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of e) if ((r -= w) < 0) return k;
  return e[0][0];
}

export function makeShopTask(age, prev) {
  const cfg = SHOP_AGES[age] ?? SHOP_AGES[5];
  for (let k = 0; k < 10; k++) {
    const type = weighted(cfg.types), item = pick(SHOP_ITEMS);
    let t;
    if (type === 'pay') {
      const price = R(1, cfg.max);
      t = { type, item, price, answer: price, say: `${cap(item.n)} koster ${price} kroner. Betal med myntene!` };
    } else if (type === 'count') {
      const coins = randomCoins(cfg.coins, 2, cfg.max);
      const sum = coins.reduce((a, b) => a + b, 0);
      t = { type, coins, answer: sum, say: 'Hvor mange kroner er det?' };
    } else if (type === 'afford') {
      const coins = randomCoins(cfg.coins, 2, cfg.max - 1);
      const have = coins.reduce((a, b) => a + b, 0);
      let price; do { price = R(Math.max(1, have - 5), Math.min(cfg.max, have + 5)); } while (price === have);
      t = { type, item, coins, have, price, answer: have >= price, say: `Du har ${have} kroner. Har du råd til ${item.n} som koster ${price} kroner?` };
    } else {
      const notes = [10, 20, 50].filter(n => n <= cfg.max);
      const paid = pick(notes), price = R(1, paid - 1);
      t = { type, item, paid, price, answer: paid - price, say: `${cap(item.n)} koster ${price} kroner. Du betaler med ${paid} kroner. Hvor mye får du tilbake?` };
    }
    t.key = JSON.stringify([t.type, t.answer, t.price, t.coins]);
    if (!prev || t.key !== prev.key) return t;
  }
}
const cap = s => s[0].toUpperCase() + s.slice(1);

export function shopScreen(ctx) {
  const { app, $, $$, wait, speak, sfx, burst, centerOf } = ctx;
  const P = ctx.P;
  const cfg = SHOP_AGES[P.age] ?? SHOP_AGES[5];
  const ROUND = 8;
  let i = 0, first = 0, tries = 0, t = null, busy = false, alive = true, placed = [], over = false;

  app.innerHTML = `${ctx.hud()}<div class="screen shop math">
    <div class="progress">${'<i></i>'.repeat(ROUND)}</div>
    <div class="math-body">
      <div class="q-card"><div class="q-body shop-body"></div></div>
      <aside class="side">
        <div class="buddy" aria-hidden="true"><div class="bubble"></div><div class="buddy-av">${ctx.avatarHTML(P, 'xl')}</div></div>
        <div class="mic-area">
          <button class="icon-btn big" data-act="repeat" title="Hør igjen (mellomrom)" aria-label="Hør oppgaven igjen">🔊</button>
          <button class="mic" data-act="mic" aria-label="Snakk"><span class="mic-ico">🎤</span><span class="mic-ring"></span></button>
        </div>
        <div class="heard" aria-live="polite"></div>
      </aside>
    </div>
  </div>`;
  ctx.updateHud();
  const body = $('.shop-body'), micArea = $('.mic-area');
  const L = createListener({
    mic: $('.mic'), heard: $('.heard'),
    judge: (a, f) => (t.type === 'afford' ? yesNoJudge(t.answer) : numberJudge(t.answer))(a, f),
    onCorrect: () => correct(), onWrong: h => wrong(h), onListen: () => ctx.react('listen'),
  });
  const slot = () => $('.answer-slot', body);
  const sum = () => placed.reduce((a, b) => a + b, 0);

  function render() {
    const price = p => `<span class="price">${p} kr</span>`;
    if (t.type === 'pay') {
      body.innerHTML = `<div class="shelf"><span class="item">${t.item.e}</span>${price(t.price)}</div>
        <div class="counter" aria-label="Disken"><div class="counter-coins"></div>
          <div class="counter-sum">${cfg.showSum ? 'Lagt på disken: <b>0 kr</b>' : ''}</div></div>
        <div class="wallet">${cfg.coins.map(v => `<button class="coin-btn" data-act="add" data-v="${v}" aria-label="${v} kroner">${coinHTML(v)}</button>`).join('')}</div>
        <span class="answer-slot sr-only">?</span>`;
    } else if (t.type === 'count') {
      body.innerHTML = `<div class="coin-pile">${t.coins.map((v, k) => coinHTML(v, 'drop').replace('class="', `style="--d:${k * 80}ms" class="`)).join('')}</div>
        <div class="eqline"><span class="answer-slot">?</span><b class="kr">kr</b></div>`;
    } else if (t.type === 'afford') {
      body.innerHTML = `<div class="afford"><div class="coin-pile small">${t.coins.map(v => coinHTML(v)).join('')}</div>
        <span class="have">= ${t.have} kr</span></div>
        <div class="shelf"><span class="item">${t.item.e}</span>${price(t.price)}</div>
        <div class="eqline yn"><span class="q">Råd?</span><span class="answer-slot">?</span></div>`;
    } else {
      body.innerHTML = `<div class="change"><div class="shelf"><span class="item">${t.item.e}</span>${price(t.price)}</div>
        <span class="arrow">←</span><div class="paid">${coinHTML(t.paid)}</div></div>
        <div class="eqline"><span class="q">Tilbake:</span><span class="answer-slot">?</span><b class="kr">kr</b></div>`;
    }
    micArea.style.visibility = t.type === 'pay' ? 'hidden' : '';
  }

  function updateCounter() {
    $('.counter-coins', body).innerHTML = placed.map((v, k) =>
      `<button class="coin-btn placed" data-act="remove" data-k="${k}" aria-label="Ta tilbake ${v} kroner">${coinHTML(v)}</button>`).join('');
    if (cfg.showSum) $('.counter-sum', body).innerHTML = `Lagt på disken: <b>${sum()} kr</b>`;
  }

  async function next() {
    if (!alive) return;
    if (i >= ROUND) return summary();
    t = makeShopTask(P.age, t);
    tries = 0; busy = false; placed = []; over = false;
    window.__testHook?.(t);
    render();
    body.classList.remove('enter'); void body.offsetWidth; body.classList.add('enter');
    $$('.progress i').forEach((d, k) => d.classList.toggle('now', k === i));
    await ask();
  }

  async function ask() {
    L.speaking();
    await speak(t.say);
    if (alive && !busy && t.type !== 'pay') L.listen();
  }

  function addCoin(v) {
    if (busy || t?.type !== 'pay' || !cfg.coins.includes(v)) return;
    placed.push(v);
    sfx.pop();
    updateCounter();
    const s = sum();
    if (s === t.price) correct();
    else if (s > t.price) {
      over = true;
      sfx.wrong();
      ctx.react('sad', 'For mye!');
      $('.counter', body).classList.remove('shake'); void body.offsetWidth; $('.counter', body).classList.add('shake');
      speak('Det ble for mye! Trykk på en mynt for å ta den tilbake.');
    }
  }
  function removeCoin(k) {
    if (busy || t?.type !== 'pay') return;
    placed.splice(k, 1);
    updateCounter();
    if (sum() === t.price) correct();
  }

  async function correct() {
    if (busy) return;
    busy = true;
    L.stop();
    const s = slot();
    if (t.type !== 'pay') { s.textContent = t.type === 'afford' ? (t.answer ? 'Ja!' : 'Nei') : t.answer; s.classList.add('right'); }
    else $('.counter', body).classList.add('paid-ok');
    sfx.correct();
    const [x, y] = centerOf(t.type === 'pay' ? $('.counter', body) : s);
    burst(x, y, { n: 30 });
    const ok = tries === 0 && !over;
    if (ok) first++;
    $$('.progress i')[i].classList.add(ok ? 'star' : 'ok');
    const msg = t.type === 'pay' ? 'Takk for handelen!' : t.type === 'afford' ? (t.answer ? 'Ja, du har råd!' : 'Nei, det har du ikke råd til.') : 'Riktig!';
    ctx.react('happy', t.type === 'pay' ? 'Betalt!' : 'Riktig!');
    i++;
    P.stats.shop = (P.stats.shop || 0) + 1;
    const said = speak(msg);
    await ctx.grantXp(ok ? 10 : 5, t.type === 'pay' ? $('.counter', body) : s);
    await said;
    await wait(500);
    next();
  }

  async function wrong(h) {
    busy = true;
    L.stop();
    tries++;
    const s = slot();
    s.textContent = h;
    s.classList.remove('wrong'); void s.offsetWidth; s.classList.add('wrong');
    sfx.wrong();
    ctx.react('sad', tries >= 3 ? 'Neste gang!' : 'Prøv igjen!');
    if (tries >= 3) {
      await wait(600);
      s.textContent = t.type === 'afford' ? (t.answer ? 'Ja' : 'Nei') : t.answer;
      s.classList.remove('wrong'); s.classList.add('reveal');
      $$('.progress i')[i].classList.add('miss');
      i++;
      await Promise.all([speak(`Svaret er ${s.textContent}.`), wait(1500)]);
      await ctx.grantXp(2, s);
      return next();
    }
    await Promise.all([speak('Nesten! Prøv igjen.'), wait(1000)]);
    if (!alive) return;
    s.textContent = '?'; s.classList.remove('wrong');
    busy = false;
    L.listen();
  }

  async function summary() {
    L.destroy();
    const stars = first >= 7 ? 3 : first >= 5 ? 2 : 1;
    body.innerHTML = ctx.summaryHTML(stars, `${first} av ${ROUND} riktige på første forsøk`);
    micArea.style.visibility = 'hidden';
    $('.heard').innerHTML = '';
    ctx.react('dance', 'Butikkstjerne!');
    sfx.levelUp();
    ctx.confetti(100);
    speak(stars === 3 ? 'Tre stjerner! Du er flink med penger!' : 'Bra handlet!');
    await ctx.grantXp(stars * 10, $('.big-stars'));
  }

  next();

  return {
    cleanup() { alive = false; L.destroy(); },
    onAct(a, b) {
      if (a === 'back') ctx.back('shop');
      if (a === 'again') ctx.go('shop');
      if (a === 'add') addCoin(+b.dataset.v);
      if (a === 'remove') removeCoin(+b.dataset.k);
      if (a === 'repeat' && t && !busy) ask();
      if (a === 'mic' && t && !busy) L.listen();
    },
    onKey(e) {
      if (e.key === 'Escape') return ctx.back('shop');
      if (i >= ROUND && e.key === 'Enter') return ctx.go('shop');
      if (!t || busy) return;
      if (t.type === 'pay') {
        if (KEYS[e.key]) addCoin(KEYS[e.key]);
        else if (e.key === 'Backspace' && placed.length) removeCoin(placed.length - 1);
      } else if (t.type === 'afford') {
        const k = e.key.toLowerCase();
        if (k === 'j' || k === 'n') (k === 'j') === t.answer ? correct() : wrong(k === 'j' ? 'ja' : 'nei');
      } else {
        const s = slot();
        if (/^\d$/.test(e.key) && (s.dataset.typed || '').length < 3) { s.dataset.typed = (s.dataset.typed || '') + e.key; s.textContent = s.dataset.typed; }
        else if (e.key === 'Enter' && s.dataset.typed) { const n = +s.dataset.typed; delete s.dataset.typed; n === t.answer ? correct() : wrong(n); }
      }
      if (e.key === ' ') { e.preventDefault(); ask(); }
    },
  };
}
