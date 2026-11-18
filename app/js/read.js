// Lesing: ordet vises uten bilde, barnet leser høyt, bildet avsløres ved riktig svar.
import { READ_WORDS, READ_LEN } from './content.js';
import { createListener, wordJudge } from './listen.js';
import { canListen } from './speech.js';

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function wordsForAge(age) {
  const [lo, hi] = READ_LEN[age] ?? [3, 4];
  return READ_WORDS.filter(([w]) => w.length >= lo && w.length <= hi);
}

export function readScreen(ctx) {
  const { app, $, $$, esc, wait, pick, speak, sfx, burst, centerOf } = ctx;
  const P = ctx.P;
  const ROUND = 8;
  const pool = wordsForAge(P.age);
  let order = shuffle(pool);
  while (order.length < ROUND) order = order.concat(shuffle(pool));
  order = order.slice(0, ROUND);
  let i = 0, first = 0, tries = 0, cur = null, busy = false, alive = true, streak = 0, helped = false;

  app.innerHTML = `${ctx.hud()}<div class="screen read math">
    <div class="progress">${'<i></i>'.repeat(ROUND)}</div>
    <div class="math-body">
      <div class="q-card"><div class="q-body read-body">
        <div class="read-pic" aria-hidden="true"><span class="gift">🎁</span></div>
        <div class="read-word" aria-live="polite"></div>
      </div></div>
      <aside class="side">
        <div class="buddy" aria-hidden="true"><div class="bubble"></div><div class="buddy-av">${ctx.avatarHTML(P, 'xl')}</div></div>
        <div class="mic-area">
          <button class="icon-btn big" data-act="help" title="Hjelp: les ordet sammen (mellomrom)" aria-label="Hjelp meg å lese">🔊</button>
          <button class="mic" data-act="mic" aria-label="Snakk"><span class="mic-ico">🎤</span><span class="mic-ring"></span></button>
          <div class="streak" aria-live="polite"></div>
        </div>
        <div class="heard" aria-live="polite"></div>
      </aside>
    </div>
    ${canListen ? '' : '<div class="notice">Denne nettleseren kan ikke høre tale. Bruk Safari (iPad) eller Chrome. En voksen kan trykke Enter når ordet er lest riktig.</div>'}
  </div>`;
  ctx.updateHud();
  const body = $('.read-body'), wordEl = $('.read-word'), picEl = $('.read-pic');
  const L = createListener({
    mic: $('.mic'), heard: $('.heard'),
    judge: (alts, final) => wordJudge(cur[0])(alts, final),
    onCorrect: () => correct(), onWrong: h => wrong(h),
    onListen: () => ctx.react('listen'),
  });

  function letters(state = '') {
    wordEl.innerHTML = Array.from(cur[0]).map((c, k) => `<span class="rl ${state}" style="--d:${k * 60}ms">${esc(c)}</span>`).join('');
  }

  async function next() {
    if (!alive) return;
    if (i >= ROUND) return summary();
    cur = order[i]; tries = 0; busy = false; helped = false;
    window.__testHook?.({ type: 'read', answer: cur[0], word: cur[0] });
    letters();
    picEl.innerHTML = '<span class="gift">🎁</span>';
    picEl.classList.remove('open');
    body.classList.remove('enter'); void body.offsetWidth; body.classList.add('enter');
    $$('.progress i').forEach((d, k) => d.classList.toggle('now', k === i));
    L.speaking();
    await speak(i === 0 ? 'Kan du lese dette ordet? Si det høyt!' : 'Les ordet!');
    if (alive && !busy) L.listen();
  }

  async function correct(viaAdult = false) {
    if (busy) return;
    busy = true;
    L.stop();
    letters('ok');
    picEl.innerHTML = `<span class="pic-reveal">${cur[1]}</span>`;
    picEl.classList.add('open');
    sfx.correct();
    const [x, y] = centerOf(picEl);
    burst(x, y, { n: 34 });
    const firstTry = tries === 0 && !helped;
    if (firstTry) { first++; streak++; } else streak = 0;
    $$('.progress i')[i].classList.add(firstTry ? 'star' : 'ok');
    $('.streak').innerHTML = streak >= 3 ? `🔥 ${streak} på rad!` : '';
    const praise = pick(ctx.PRAISE);
    ctx.react(streak >= 3 && streak % 3 === 0 ? 'dance' : 'happy', praise);
    i++;
    P.stats.read = (P.stats.read || 0) + 1;
    const said = speak(`${cur[0].toLowerCase()}! ${praise}`);
    await ctx.grantXp(firstTry ? 10 : helped ? 3 : 5, picEl);
    await said;
    await wait(viaAdult ? 300 : 600);
    next();
  }

  async function soundOut() {
    helped = true;
    L.speaking();
    const spans = $$('.rl', wordEl);
    for (let k = 0; k < spans.length && alive; k++) {
      spans.forEach((s, j) => s.classList.toggle('hl', j === k));
      await Promise.all([speak(cur[0][k]), wait(450)]);
    }
    spans.forEach(s => s.classList.add('hl'));
    await Promise.all([speak(cur[0].toLowerCase()), wait(600)]);
    spans.forEach(s => s.classList.remove('hl'));
  }

  async function wrong(heardText) {
    if (busy) return;
    busy = true;
    L.stop();
    tries++;
    streak = 0;
    $('.streak').innerHTML = '';
    sfx.wrong();
    wordEl.classList.remove('shake'); void wordEl.offsetWidth; wordEl.classList.add('shake');
    if (tries === 1) {
      ctx.react('sad', 'Prøv igjen!');
      await Promise.all([speak('Nesten! Se på bokstavene og prøv igjen.'), wait(1000)]);
    } else if (tries === 2) {
      ctx.react('sad', 'Vi leser sammen');
      await speak('Vi leser det sammen.');
      await soundOut();
      await speak('Nå du! Si ordet.');
    } else {
      $$('.progress i')[i].classList.add('miss');
      picEl.innerHTML = `<span class="pic-reveal">${cur[1]}</span>`;
      picEl.classList.add('open');
      ctx.react('sad', 'Neste gang!');
      i++;
      await Promise.all([speak(`Det står ${cur[0].toLowerCase()}. Det klarer du neste gang!`), wait(1500)]);
      await ctx.grantXp(1, picEl);
      return next();
    }
    if (!alive) return;
    busy = false;
    L.listen();
  }

  async function help() {
    if (busy || !cur) return;
    busy = true;
    L.stop();
    if (tries < 2) tries = 2;
    await soundOut();
    if (!alive) return;
    await speak('Nå du! Si ordet.');
    busy = false;
    L.listen();
  }

  async function summary() {
    L.destroy();
    const stars = first >= 7 ? 3 : first >= 5 ? 2 : 1;
    body.innerHTML = ctx.summaryHTML(stars, `${first} av ${ROUND} ord lest på første forsøk`);
    $('.mic-area').style.visibility = 'hidden';
    $('.heard').innerHTML = '';
    ctx.react('dance', stars === 3 ? 'Superleser!' : 'Bra lest!');
    sfx.levelUp();
    ctx.confetti(100);
    speak(stars === 3 ? 'Tre stjerner! Du er en superleser!' : 'Bra lest! Vil du lese mer?');
    await ctx.grantXp(stars * 10, $('.big-stars'));
  }

  next();

  return {
    cleanup() { alive = false; L.destroy(); },
    onAct(a) {
      if (a === 'back') ctx.back('read');
      if (a === 'again') ctx.go('read');
      if (a === 'mic' && !busy && cur) L.listen();
      if (a === 'help') help();
    },
    onKey(e) {
      if (e.key === 'Escape') return ctx.back('read');
      if (i >= ROUND && e.key === 'Enter') return ctx.go('read');
      if (!cur || busy) return;
      if (e.key === 'Enter') correct(true); // voksen godkjenner
      else if (e.key === ' ') { e.preventDefault(); help(); }
    },
  };
}
