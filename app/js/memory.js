// Huskespill: finn like par. Antall par følger alderen.
import { MEMORY_PAIRS, MEMORY_PICS } from './content.js';

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const memoryXp = (pairs, moves) => 10 + pairs * 2 + (moves <= Math.ceil(pairs * 1.5) ? 10 : 0);
export function gridCols(n) { return n <= 6 ? 3 : n <= 16 ? 4 : 5; }

export function memoryScreen(ctx) {
  const { app, $, $$, wait, speak, sfx, burst, centerOf } = ctx;
  const P = ctx.P;
  const pairs = MEMORY_PAIRS[P.age] ?? 6;
  const deck = shuffle(shuffle(MEMORY_PICS).slice(0, pairs).flatMap(e => [e, e]));
  const cols = gridCols(deck.length);
  let open = [], found = 0, moves = 0, lock = false, alive = true, done = false;
  window.__testHook?.({ type: 'memory', deck, pairs });

  app.innerHTML = `${ctx.hud()}<div class="screen memory math">
    <div class="math-body">
      <div class="q-card mem-card">
        <div class="mem-grid" style="--cols:${cols}" role="grid" aria-label="Huskespill">
          ${deck.map((e, k) => `<button class="mcard" data-act="flip" data-k="${k}" aria-label="Kort ${k + 1}">
            <span class="mface back">?</span><span class="mface front">${e}</span></button>`).join('')}
        </div>
      </div>
      <aside class="side">
        <div class="buddy" aria-hidden="true"><div class="bubble"></div><div class="buddy-av">${ctx.avatarHTML(P, 'xl')}</div></div>
        <div class="mem-stats"><div><b class="m-found">0</b> / ${pairs}<small>par funnet</small></div><div><b class="m-moves">0</b><small>forsøk</small></div></div>
      </aside>
    </div>
  </div>`;
  ctx.updateHud();
  const cards = $$('.mcard');
  speak('Finn to like kort!');

  async function flip(k) {
    const c = cards[k];
    if (lock || done || !c || c.classList.contains('up')) return;
    c.classList.add('up');
    c.setAttribute('aria-label', `Kort ${k + 1}: ${deck[k]}`);
    sfx.pop();
    open.push(k);
    if (open.length < 2) return;
    moves++;
    $('.m-moves').textContent = moves;
    const [a, b] = open;
    open = [];
    if (deck[a] === deck[b]) {
      found++;
      $('.m-found').textContent = found;
      [a, b].forEach(j => cards[j].classList.add('match'));
      sfx.sparkle();
      const [x, y] = centerOf(cards[b]);
      burst(x, y, { n: 18, speed: 6 });
      ctx.react('happy', 'Et par!');
      if (found === pairs) finish();
    } else {
      lock = true;
      ctx.react('listen');
      await wait(900);
      if (!alive) return;
      [a, b].forEach(j => { cards[j].classList.remove('up'); cards[j].setAttribute('aria-label', `Kort ${j + 1}`); });
      lock = false;
    }
  }

  async function finish() {
    done = true;
    P.stats.memory = (P.stats.memory || 0) + 1;
    await wait(500);
    if (!alive) return;
    sfx.levelUp();
    ctx.confetti(110);
    ctx.react('dance', 'Alle parene!');
    $('.mem-card').insertAdjacentHTML('beforeend', `<div class="mem-done">
      <h2>Du fant alle parene! 🎉</h2><p>${moves} forsøk</p>
      <div class="row"><button class="btn ghost" data-act="back">Tilbake <kbd>Esc</kbd></button>
      <button class="btn" data-act="again">Spill igjen <kbd>Enter</kbd></button></div></div>`);
    speak(`Hurra! Du fant alle parene på ${moves} forsøk!`);
    await ctx.grantXp(memoryXp(pairs, moves), $('.mem-done h2'));
  }

  function move(dk) {
    const k = cards.indexOf(document.activeElement);
    const n = k < 0 ? 0 : Math.max(0, Math.min(cards.length - 1, k + dk));
    cards[n].focus();
  }

  return {
    cleanup() { alive = false; },
    onAct(a, b) {
      if (a === 'flip') flip(+b.dataset.k);
      if (a === 'back') ctx.back('memory');
      if (a === 'again') ctx.go('memory');
    },
    onKey(e) {
      if (e.key === 'Escape') return ctx.back('memory');
      if (done && e.key === 'Enter') { e.preventDefault(); return ctx.go('memory'); }
      const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (d) { e.preventDefault(); move(d); }
    },
  };
}
