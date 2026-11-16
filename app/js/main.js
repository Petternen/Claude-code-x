import { load, save, newProfile, addXp, xpForLevel, MAX_LEVEL } from './state.js';
import { AGES, AVATARS, ARTIFACTS, ART, artifactForLevel, PRAISE, LETTERS, DIGITS, EXAMPLES, DIGIT_PICS, WORDS, SLOT_NAMES } from './data.js';
import { speak, stopSpeaking, canListen, startListening, judge } from './speech.js';
import { burst, confetti, fireworks, floatText, centerOf } from './fx.js';
import { sfx } from './sfx.js';
import { makeQuestion } from './math.js';
import { Tracer, toTraceable } from './write.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.floor(Math.random() * a.length)];

const app = $('#app');
const db = load();
let P = db.profiles.find(p => p.id === db.current) || null;
let screen = {};
let overlayKey = null;
const persist = () => save(db);
const ageCfg = () => AGES.find(a => a.age === P.age) || AGES[0];
const ageLabel = age => (AGES.find(a => a.age === age) || AGES[0]).label;
const TOTAL_ART = ARTIFACTS.length;

// ───────────────────────── Ruting og input ─────────────────────────
function go(name, ...args) {
  try { screen.cleanup?.(); } catch (e) { console.error(e); }
  stopSpeaking();
  window.scrollTo(0, 0);
  screen = SCREENS[name](...args) || {};
}

document.addEventListener('keydown', e => {
  if (overlayKey) { overlayKey(e); return; }
  if (e.target.matches?.('input') && !['Enter', 'Escape'].includes(e.key)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  screen.onKey?.(e);
});
document.addEventListener('pointerdown', () => sfx.unlock(), { passive: true });
app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  sfx.pop();
  screen.onAct?.(b.dataset.act, b, e);
});

// ───────────────────────── Felles UI ─────────────────────────
function avatarHTML(p, size = 'md') {
  const eq = p.equipped || {};
  const hat = eq.hat && ART[eq.hat], pet = eq.pet && ART[eq.pet], aura = eq.aura && ART[eq.aura];
  return `<div class="avatar ${size} ${aura ? 'aura-' + aura.aura : ''}">
    <span class="av-base">${p.avatar}</span>
    ${hat ? `<span class="av-hat">${hat.e}</span>` : ''}
    ${pet ? `<span class="av-pet">${pet.e}</span>` : ''}</div>`;
}

function hud() {
  return `<header class="hud">
    <button class="icon-btn" data-act="back" aria-label="Tilbake" title="Tilbake (Esc)">←</button>
    <div class="hud-av">${avatarHTML(P, 'sm')}</div>
    <div class="hud-info">
      <div class="hud-name">${esc(P.name)}</div>
      <div class="xpbar"><div class="xpfill"></div><span class="xptext"></span></div>
    </div>
    <div class="lvl-badge"><small>NIVÅ</small><b class="lvl-num">${P.level}</b></div>
  </header>`;
}

function updateHud(fillFirst = false) {
  const fill = $('.xpfill'), txt = $('.xptext'), num = $('.lvl-num');
  if (!fill) return;
  const max = P.level >= MAX_LEVEL;
  const need = xpForLevel(P.level);
  const set = () => {
    fill.style.width = (max ? 100 : (P.xp / need) * 100) + '%';
    txt.textContent = max ? 'MAKS NIVÅ ✨' : `${P.xp} / ${need} XP`;
    num.textContent = P.level;
  };
  $('.xpbar').classList.remove('shine');
  void fill.offsetWidth;
  $('.xpbar').classList.add('shine');
  if (fillFirst) {
    fill.style.width = '100%';
    setTimeout(() => { fill.style.transition = 'none'; fill.style.width = '0%'; void fill.offsetWidth; fill.style.transition = ''; set(); }, 650);
  } else set();
}

function agePills(sel) {
  return AGES.map(a => `<button type="button" class="age-pill ${a.age === sel ? 'sel' : ''}" data-act="age" data-v="${a.age}">${a.label}<small>år</small></button>`).join('');
}

/** Gir XP, deler ut skatter og viser nivå-feiring. */
async function grantXp(amount, anchor) {
  const [x, y] = anchor ? (Array.isArray(anchor) ? anchor : centerOf(anchor)) : [innerWidth / 2, innerHeight / 2];
  floatText(x, y - 20, `+${amount} XP`);
  const lv = addXp(P, amount);
  for (const l of lv) {
    const a = artifactForLevel(l);
    if (a && !P.items.includes(a.id)) {
      P.items.push(a.id);
      if (a.slot && !P.equipped[a.slot]) P.equipped[a.slot] = a.id;
    }
  }
  persist();
  updateHud(lv.length > 0);
  if (lv.length) {
    await wait(750);
    for (const l of lv) await levelUp(l);
    const av = $('.hud-av');
    if (av) av.innerHTML = avatarHTML(P, 'sm');
  }
}

function levelUp(level) {
  return new Promise(resolve => {
    const art = artifactForLevel(level);
    const ov = $('#overlay');
    ov.hidden = false;
    ov.innerHTML = `<div class="levelup" role="dialog" aria-label="Nytt nivå">
      <div class="rays"></div>
      <div class="lu-content">
        <div class="lu-title">NIVÅ OPP!</div>
        <div class="lu-level"><span>${level}</span></div>
        ${art ? `<div class="flip"><div class="flip-inner">
          <div class="art-card back">?</div>
          <div class="art-card front r-${art.rarity}">
            <div class="art-emoji">${art.e}</div>
            <div class="art-name">${esc(art.n)}</div>
            <div class="art-rarity">${art.slot ? 'Nytt utstyr: ' + SLOT_NAMES[art.slot] : art.rarityName}</div>
          </div></div></div>` : ''}
        <button class="btn big gold" data-close disabled>Hurra! ✨</button>
      </div></div>`;
    sfx.levelUp();
    confetti(170);
    fireworks(7);
    speak(`Hurra! Du er nå på nivå ${level}!` + (art ? ` Du fikk ${art.n}!` : ''));
    const btn = $('[data-close]', ov);
    setTimeout(() => { btn.disabled = false; btn.focus(); }, 1300);
    const close = () => {
      if (btn.disabled) return;
      sfx.pop();
      ov.hidden = true;
      ov.innerHTML = '';
      overlayKey = null;
      resolve();
    };
    btn.onclick = close;
    overlayKey = e => { if (['Enter', ' ', 'Escape'].includes(e.key)) { e.preventDefault(); close(); } };
  });
}

// ───────────────────────── Skjermer ─────────────────────────
const SCREENS = {};

SCREENS.profiles = () => {
  app.innerHTML = `<div class="screen center scroll">
    <h1 class="logo">Stjerne<span>skolen</span> <i>⭐</i></h1>
    <p class="sub">${db.profiles.length ? 'Hvem skal spille?' : 'Velkommen! Lag den første spilleren.'}</p>
    <div class="profile-grid">
      ${db.profiles.map((p, i) => `<button class="profile-card" data-act="pick" data-id="${p.id}">
        ${avatarHTML(p, 'lg')}<b>${esc(p.name)}</b>
        <span class="pill">Nivå ${p.level} · ${ageLabel(p.age)} år</span>${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}</button>`).join('')}
      <button class="profile-card add" data-act="new"><span class="plus">＋</span><b>Ny spiller</b><kbd>N</kbd></button>
    </div></div>`;
  const choose = id => { P = db.profiles.find(p => p.id === id); db.current = id; persist(); go('home'); };
  return {
    onAct(a, b) { if (a === 'pick') choose(b.dataset.id); if (a === 'new') go('create'); },
    onKey(e) {
      if (/^[1-9]$/.test(e.key) && db.profiles[e.key - 1]) choose(db.profiles[e.key - 1].id);
      else if (e.key.toLowerCase() === 'n' || (e.key === 'Enter' && !db.profiles.length)) go('create');
    },
  };
};

SCREENS.create = () => {
  let av = pick(AVATARS), age = 4;
  app.innerHTML = `<div class="screen center scroll"><form class="panel" autocomplete="off">
    <h2>Ny spiller</h2>
    <label class="field"><span>Navn</span><input id="nm" maxlength="14" placeholder="Skriv navnet" enterkeyhint="done"></label>
    <div class="field"><span>Velg figur</span><div class="av-pick">
      ${AVATARS.map(a => `<button type="button" class="av-opt ${a === av ? 'sel' : ''}" data-act="av" data-v="${a}">${a}</button>`).join('')}</div></div>
    <div class="field"><span>Alder</span><div class="age-pick">${agePills(age)}</div></div>
    <div class="row">${db.profiles.length ? '<button type="button" class="btn ghost" data-act="cancel">Avbryt</button>' : ''}
      <button type="submit" class="btn">Start ✨</button></div>
  </form></div>`;
  const nm = $('#nm');
  setTimeout(() => nm.focus(), 50);
  const ok = () => {
    const name = nm.value.trim();
    if (!name) { nm.classList.add('shake'); setTimeout(() => nm.classList.remove('shake'), 500); nm.focus(); return; }
    const p = newProfile(name, av, age);
    db.profiles.push(p);
    db.current = p.id;
    P = p;
    persist();
    go('home');
  };
  $('form', app).addEventListener('submit', e => { e.preventDefault(); ok(); });
  return {
    onAct(a, b) {
      if (a === 'av') { av = b.dataset.v; $$('.av-opt').forEach(x => x.classList.toggle('sel', x === b)); }
      if (a === 'age') { age = +b.dataset.v; $$('.age-pill').forEach(x => x.classList.toggle('sel', x === b)); }
      if (a === 'cancel') go('profiles');
    },
    onKey(e) {
      if (e.key === 'Escape' && db.profiles.length) go('profiles');
      if (e.key === 'Enter' && !e.target.matches('input')) { e.preventDefault(); ok(); }
    },
  };
};

SCREENS.home = () => {
  app.innerHTML = `${hud()}<div class="screen home scroll">
    <div class="hello">${avatarHTML(P, 'xl')}<div><h1>Hei, ${esc(P.name)}!</h1><p>Hva vil du gjøre i dag?</p></div></div>
    <div class="tiles">
      <button class="tile t-math" data-act="math"><span class="tile-ico">🔢</span><b>Matte</b><small>Si svaret høyt</small><kbd>1</kbd></button>
      <button class="tile t-write" data-act="write"><span class="tile-ico">✏️</span><b>Skriving</b><small>Tegn med fingeren</small><kbd>2</kbd></button>
      <button class="tile t-coll" data-act="coll"><span class="tile-ico">🏆</span><b>Samling</b><small>${P.items.length} / ${TOTAL_ART} skatter</small><kbd>3</kbd></button>
    </div>
    <div class="age-row"><span>Alder <kbd>+</kbd><kbd>−</kbd></span><div class="age-pick">${agePills(P.age)}</div></div>
    <button class="link" data-act="delete">Slett spiller</button>
  </div>`;
  updateHud();
  const setAge = v => {
    P.age = v; persist();
    $$('.age-pill').forEach(x => x.classList.toggle('sel', +x.dataset.v === v));
    speak(`${ageLabel(v).replace('½', ' og et halvt')} år`);
  };
  const act = a => {
    if (a === 'math') go('math');
    if (a === 'write') go('write');
    if (a === 'coll') go('collection');
    if (a === 'back') go('profiles');
  };
  return {
    onAct(a, b) {
      if (a === 'age') setAge(+b.dataset.v);
      else if (a === 'delete') {
        if (confirm(`Slette ${P.name} og all fremgang? Dette kan ikke angres.`)) {
          db.profiles = db.profiles.filter(p => p !== P);
          db.current = null; P = null; persist(); go('profiles');
        }
      } else act(a);
    },
    onKey(e) {
      const k = e.key.toLowerCase();
      if (k === '1' || k === 'm') act('math');
      else if (k === '2' || k === 's') act('write');
      else if (k === '3' || k === 'c') act('coll');
      else if (k === 'escape' || k === 'p') act('back');
      else if (k === '+' || k === '-') {
        const i = AGES.findIndex(a => a.age === P.age) + (k === '+' ? 1 : -1);
        if (AGES[i]) setAge(AGES[i].age);
      }
    },
  };
};

// ───────────────────────── Matte ─────────────────────────
SCREENS.math = () => {
  const cfg = ageCfg();
  const ROUND = 10;
  let q = null, i = 0, firstTry = 0, streak = 0, tries = 0, typed = '';
  let alive = true, busy = false, stopListen = null, autoRetries = 0;

  app.innerHTML = `${hud()}<div class="screen math">
    <div class="progress">${'<i></i>'.repeat(ROUND)}</div>
    <div class="q-card"><div class="q-body"></div></div>
    <div class="mic-area">
      <button class="icon-btn big" data-act="repeat" title="Hør igjen (mellomrom)" aria-label="Hør spørsmålet igjen">🔊</button>
      <button class="mic" data-act="mic" aria-label="Snakk"><span class="mic-ico">🎤</span><span class="mic-ring"></span></button>
      <div class="streak" aria-live="polite"></div>
    </div>
    <div class="heard" aria-live="polite"></div>
    ${canListen ? '' : '<div class="notice">Denne nettleseren kan ikke høre tale. Bruk Chrome (Android) eller Safari (iPad). En voksen kan taste svaret og trykke Enter.</div>'}
  </div>`;
  updateHud();
  const body = $('.q-body'), mic = $('.mic'), heard = $('.heard');

  const setMic = st => {
    mic.dataset.state = st;
    const msg = { listening: 'Jeg lytter … si svaret!', idle: 'Trykk på mikrofonen og si svaret', blocked: 'Mikrofonen er blokkert – gi tilgang i nettleseren', unsupported: '' }[st];
    // Det barnet sist sa blir stående mens vi lytter på nytt (nyttig for voksne)
    if (msg && !(st === 'listening' && $('.said', heard))) heard.innerHTML = `<span class="hint">${msg}</span>`;
  };
  const slot = () => $('.answer-slot', body);

  function stop() { stopListen?.(); stopListen = null; }

  async function next() {
    if (!alive) return;
    if (i >= ROUND) return summary();
    q = makeQuestion(cfg, q);
    tries = 0; typed = ''; busy = false; autoRetries = 0;
    body.innerHTML = q.html;
    window.__testHook?.(q); // brukes kun av automatiske tester
    body.classList.remove('enter'); void body.offsetWidth; body.classList.add('enter');
    $$('.progress i').forEach((d, k) => d.classList.toggle('now', k === i));
    await ask();
  }

  async function ask() {
    stop();
    setMic('speaking');
    heard.innerHTML = '';
    await speak(q.say);
    if (alive && !busy) listenNow();
  }

  function listenNow() {
    if (!alive || busy) return;
    stop();
    if (!canListen) { setMic('unsupported'); return; }
    let handled = false;
    setMic('listening');
    stopListen = startListening({
      onResult(alts, final) {
        if (handled) return;
        const r = judge(alts, final, q.answer);
        heard.innerHTML = `<span class="said">«${esc(alts[0])}»</span>`;
        if (r.correct) { handled = true; stop(); correct(); }
        else if (final) {
          handled = true;
          if (r.heard != null) wrong(r.heard); else retry();
        }
      },
      onState(s, err) {
        if (handled) return;
        if (s === 'listening') setMic('listening');
        else if (s === 'ended') { handled = true; retry(); }
        else if (s === 'error') {
          if (err === 'not-allowed' || err === 'service-not-allowed') { handled = true; setMic('blocked'); }
          else if (err === 'no-speech' || err === 'aborted' || err === 'network') { /* onend følger */ }
          else { handled = true; setMic('idle'); }
        } else if (s === 'unsupported') { handled = true; setMic('unsupported'); }
      },
    });
  }

  function retry() {
    if (!alive || busy) return;
    if (autoRetries++ < 2) setTimeout(listenNow, 250);
    else setMic('idle');
  }

  function check(n) {
    if (busy || !q) return;
    if (n === q.answer) correct(); else wrong(n);
  }

  async function correct() {
    busy = true;
    stop();
    const s = slot();
    s.textContent = q.answer;
    s.classList.add('right');
    $$('.cmp-card', body).forEach(c => c.classList.toggle('win', +c.dataset.v === q.answer));
    sfx.correct();
    const [x, y] = centerOf(s);
    burst(x, y, { n: 30 });
    setMic('happy');
    const first = tries === 0;
    if (first) { firstTry++; streak++; } else streak = 0;
    $$('.progress i')[i].classList.add(first ? 'star' : 'ok');
    const xp = first ? 10 + Math.min(10, Math.max(0, streak - 2) * 2) : 5;
    if (streak >= 3) {
      $('.streak').innerHTML = `🔥 ${streak} på rad!`;
      if (streak % 3 === 0) burst(x, y, { n: 40, speed: 12, kinds: ['star'] });
    } else $('.streak').innerHTML = '';
    i++;
    P.stats.math++;
    const said = speak(streak >= 3 && streak % 3 === 0 ? `${streak} riktige på rad! Wow!` : pick(PRAISE));
    await grantXp(xp, s);
    await said;
    await wait(500);
    next();
  }

  async function wrong(n) {
    busy = true;
    stop();
    tries++;
    streak = 0;
    $('.streak').innerHTML = '';
    const s = slot();
    s.textContent = n;
    s.classList.remove('wrong'); void s.offsetWidth; s.classList.add('wrong');
    sfx.wrong();
    setMic('speaking');
    if (tries >= 3) {
      await wait(600);
      s.textContent = q.answer;
      s.classList.remove('wrong');
      s.classList.add('reveal');
      $$('.progress i')[i].classList.add('miss');
      i++;
      await Promise.all([speak(`Svaret er ${q.answer}. Det klarer du neste gang!`), wait(1500)]);
      await grantXp(2, s);
      await wait(400);
      return next();
    }
    // Minstetid så markeringen synes også når enheten mangler norsk stemme
    await Promise.all([speak(tries === 1 ? `Du sa ${n}. Nesten! Prøv igjen.` : `Ikke helt. Hør godt etter: ${q.say}`), wait(1000)]);
    if (!alive) return;
    s.textContent = '?';
    s.classList.remove('wrong');
    busy = false;
    autoRetries = 0;
    typed = '';
    listenNow();
  }

  async function summary() {
    stop();
    const stars = firstTry >= 9 ? 3 : firstTry >= 6 ? 2 : 1;
    body.innerHTML = `<div class="summary"><h2>Runden er ferdig!</h2>
      <div class="big-stars">${[1, 2, 3].map(k => `<span class="${k <= stars ? 'on' : ''}" style="--d:${k * 250}ms">⭐</span>`).join('')}</div>
      <p>${firstTry} av ${ROUND} riktige på første forsøk</p>
      <div class="row"><button class="btn ghost" data-act="back">Hjem <kbd>Esc</kbd></button>
      <button class="btn" data-act="again">Spill igjen <kbd>Enter</kbd></button></div></div>`;
    $('.mic-area').style.visibility = 'hidden';
    heard.innerHTML = '';
    sfx.levelUp();
    confetti(100);
    speak(stars === 3 ? 'Tre stjerner! Du er en mattestjerne!' : 'Bra jobba! Vil du spille igjen?');
    const bonus = stars * 10;
    await grantXp(bonus, $('.big-stars'));
  }

  // Tips første gang
  const start = async () => {
    if (!P.seenMicTip && canListen) {
      P.seenMicTip = true; persist();
      body.innerHTML = '<div class="tip"><span class="mic-demo">🎤</span><p>Når mikrofonen blinker, sier du svaret høyt!</p></div>';
      await Promise.all([speak('Når mikrofonen blinker, sier du svaret høyt!'), wait(2500)]);
    }
    next();
  };
  start();

  return {
    cleanup() { alive = false; stop(); },
    onAct(a) {
      if (a === 'back') go('home');
      if (a === 'again') go('math');
      if (a === 'repeat' && q && !busy) ask();
      if (a === 'mic' && q && !busy) { autoRetries = 0; listenNow(); }
    },
    onKey(e) {
      if (e.key === 'Escape') return go('home');
      if (i >= ROUND && e.key === 'Enter') return go('math');
      if (busy || !q) return;
      // Skjult reserve for voksne: tast svaret + Enter
      if (/^\d$/.test(e.key) && typed.length < 3) { typed += e.key; slot().textContent = typed; slot().classList.add('typed'); }
      else if (e.key === 'Backspace') { typed = typed.slice(0, -1); slot().textContent = typed || '?'; }
      else if (e.key === 'Enter' && typed) { const n = +typed; typed = ''; slot().classList.remove('typed'); check(n); }
      else if (e.key === ' ') { e.preventDefault(); ask(); }
    },
  };
};

// ───────────────────────── Skriving ─────────────────────────
SCREENS.write = (mode = 'letters') => {
  const cfg = ageCfg();
  const nameWord = toTraceable(P.name);
  const words = [...(nameWord ? [[nameWord, P.avatar]] : []), ...WORDS];
  let idx = 0, wi = 0, li = 0, tracer = null, timer = null, gen = 0;
  P.traced = P.traced || {};

  const items = () => mode === 'letters' ? LETTERS : mode === 'digits' ? DIGITS : words.map(w => w[0]);
  const currentChar = () => mode === 'words' ? words[wi][0][li] : items()[idx];

  function render() {
    clearTimeout(timer);
    tracer?.destroy();
    app.innerHTML = `${hud()}<div class="screen write">
      <div class="tabs" role="tablist">
        ${[['letters', 'ABC', 'Bokstaver'], ['digits', '123', 'Tall'], ['words', '📖', 'Ord']].map(([m, ico, lbl]) =>
          `<button class="tab ${m === mode ? 'sel' : ''}" data-act="mode" data-v="${m}"><b>${ico}</b> ${lbl}</button>`).join('')}
        <kbd class="tab-kbd">Tab</kbd>
      </div>
      <div class="write-main">
        <button class="icon-btn big nav" data-act="prev" aria-label="Forrige">‹</button>
        <div class="trace-card">
          <div class="trace-head"></div>
          <svg class="trace" aria-label="Tegneflate"></svg>
          <div class="trace-tools">
            <button class="icon-btn" data-act="say" title="Hør (mellomrom)">🔊</button>
            <button class="icon-btn" data-act="reset" title="Start på nytt (R)">↺</button>
          </div>
        </div>
        <button class="icon-btn big nav" data-act="next" aria-label="Neste">›</button>
      </div>
      <div class="strip scroll-x">${items().map((c, k) =>
        `<button class="chip ${P.traced[c] ? 'done' : ''}" data-act="jump" data-i="${k}">${esc(c)}</button>`).join('')}</div>
    </div>`;
    updateHud();
    tracer = new Tracer($('.trace'), {
      tol: cfg.tol, width: cfg.width,
      onStrokeDone: pt => { sfx.stroke(); burst(pt[0], pt[1], { n: 12, speed: 5, size: 8 }); },
      onMiss: kind => { sfx.oops(); if (kind === 'start') speak('Start ved den grønne prikken!', { rate: 1 }); },
      onComplete: done,
    });
    loadChar(true);
  }

  function head() {
    const h = $('.trace-head');
    if (mode === 'words') {
      const [w, e] = words[wi];
      h.innerHTML = `<span class="pic-big">${e}</span><div class="word">${Array.from(w).map((c, k) =>
        `<span class="${k < li ? 'ok' : k === li ? 'now' : ''}">${esc(c)}</span>`).join('')}</div>`;
    } else if (mode === 'letters') {
      const c = currentChar(), [w, e] = EXAMPLES[c];
      h.innerHTML = `<span class="pic-big">${e}</span><span class="ex"><b>${c}</b> som i <b>${w}</b></span>`;
    } else {
      const n = +currentChar();
      h.innerHTML = `<span class="ex"><b>${n}</b></span><span class="mini-pics">${n ? DIGIT_PICS[n].repeat(n) : '⚪ (ingen)'}</span>`;
    }
    $$('.chip').forEach((c, k) => {
      const on = k === (mode === 'words' ? wi : idx);
      c.classList.toggle('now', on);
      if (on) c.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
  }

  function sayIt() {
    const c = currentChar();
    if (mode === 'letters') speak(`${c}. ${c} som i ${EXAMPLES[c][0]}.`);
    else if (mode === 'digits') speak(`Tallet ${c}.`);
    else speak(li === 0 ? `Skriv ${words[wi][0].toLowerCase()}. Start med ${c}.` : `${c}`);
  }

  function loadChar(announce) {
    gen++;
    tracer.load(currentChar());
    head();
    if (announce) sayIt();
  }

  async function done(pt) {
    const c = currentChar(), g = gen;
    const later = (fn, ms) => { if (g === gen) timer = setTimeout(() => g === gen && fn(), ms); };
    sfx.correct();
    burst(pt[0], pt[1], { n: 34 });
    const [cx, cy] = centerOf($('.trace'));
    burst(cx, cy, { n: 24, speed: 10, kinds: ['star'] });
    P.traced[c] = (P.traced[c] || 0) + 1;
    if (mode === 'words') {
      li++;
      if (li >= words[wi][0].length) {
        P.stats.words++;
        head();
        confetti(90);
        speak(`Hurra! Du skrev ${words[wi][0].toLowerCase()}!`);
        await grantXp(12 + words[wi][0].length * 4, $('.trace'));
        later(() => { wi = (wi + 1) % words.length; li = 0; loadChar(true); }, 1600);
      } else {
        await grantXp(4, pt);
        later(() => loadChar(true), 600);
      }
    } else {
      P.stats.letters++;
      $$('.chip')[idx]?.classList.add('done');
      speak(pick(['Flott!', 'Supert!', 'Så fint!', 'Kjempebra!']) + ` Du skrev ${c}!`);
      await grantXp(12, $('.trace'));
      later(() => step(1), 1500);
    }
    persist();
  }

  function step(d) {
    clearTimeout(timer);
    if (mode === 'words') { wi = (wi + d + words.length) % words.length; li = 0; }
    else idx = (idx + d + items().length) % items().length;
    loadChar(true);
  }

  render();

  return {
    cleanup() { clearTimeout(timer); tracer?.destroy(); },
    onAct(a, b) {
      if (a === 'back') go('home');
      if (a === 'mode') { mode = b.dataset.v; idx = 0; wi = 0; li = 0; render(); }
      if (a === 'prev') step(-1);
      if (a === 'next') step(1);
      if (a === 'say') sayIt();
      if (a === 'reset') tracer.reset();
      if (a === 'jump') { clearTimeout(timer); if (mode === 'words') { wi = +b.dataset.i; li = 0; } else idx = +b.dataset.i; loadChar(true); }
    },
    onKey(e) {
      const k = e.key;
      if (k === 'Escape') return go('home');
      if (k === 'ArrowRight') return step(1);
      if (k === 'ArrowLeft') return step(-1);
      if (k === ' ') { e.preventDefault(); return sayIt(); }
      if (k === 'Tab') {
        e.preventDefault();
        const ms = ['letters', 'digits', 'words'];
        mode = ms[(ms.indexOf(mode) + (e.shiftKey ? 2 : 1)) % 3]; idx = 0; wi = 0; li = 0;
        return render();
      }
      const u = k.toUpperCase();
      if (mode === 'letters' && LETTERS.includes(u)) { idx = LETTERS.indexOf(u); clearTimeout(timer); return loadChar(true); }
      if (mode === 'digits' && DIGITS.includes(k)) { idx = +k; clearTimeout(timer); return loadChar(true); }
      if (k === 'Backspace' || (mode === 'words' && u === 'R')) tracer.reset();
    },
  };
};

// ───────────────────────── Samling ─────────────────────────
SCREENS.collection = () => {
  const card = a => {
    const has = P.items.includes(a.id);
    const on = a.slot && P.equipped[a.slot] === a.id;
    return `<button class="art-card mini r-${a.rarity} ${has ? '' : 'locked'} ${on ? 'equipped' : ''}" data-act="art" data-id="${a.id}" ${has ? '' : 'aria-disabled="true"'}>
      <span class="art-emoji">${has ? a.e : '?'}</span>
      <span class="art-name">${has ? esc(a.n) : 'Nivå ' + a.level}</span>
      ${has && a.slot ? `<span class="equip-tag">${on ? 'I bruk ✓' : 'Bruk'}</span>` : ''}
    </button>`;
  };
  const render = () => {
    const cos = ARTIFACTS.filter(a => a.slot), col = ARTIFACTS.filter(a => !a.slot);
    app.innerHTML = `${hud()}<div class="screen coll scroll">
      <div class="coll-head">${avatarHTML(P, 'xl')}<div><h2>${esc(P.name)} sin samling</h2>
        <p>${P.items.length} av ${TOTAL_ART} skatter · Ny skatt hvert nivå!</p></div></div>
      <h3>Utstyr til figuren <small>(hvert 5. nivå)</small></h3>
      <div class="art-grid">${cos.map(card).join('')}</div>
      <h3>Matteskatter</h3>
      <div class="art-grid">${col.map(card).join('')}</div>
    </div>`;
    updateHud();
  };
  render();
  return {
    onAct(a, b) {
      if (a === 'back') return go('home');
      if (a !== 'art') return;
      const art = ART[b.dataset.id];
      if (!P.items.includes(art.id)) { speak(`Denne får du på nivå ${art.level}.`); return; }
      if (art.slot) {
        P.equipped[art.slot] = P.equipped[art.slot] === art.id ? null : art.id;
        persist();
        const y = $('.coll').scrollTop;
        render();
        $('.coll').scrollTop = y;
      }
      speak(art.n);
      const [x, yy] = centerOf(b);
      burst(x, yy, { n: 14, speed: 5 });
    },
    onKey(e) { if (e.key === 'Escape') go('home'); },
  };
};

// ───────────────────────── Bakgrunn og oppstart ─────────────────────────
(function sky() {
  const s = $('.sky');
  for (let k = 0; k < 28; k++) {
    const st = document.createElement('i');
    st.style.left = Math.random() * 100 + '%';
    st.style.top = Math.random() * 100 + '%';
    st.style.setProperty('--s', (0.5 + Math.random()) + '');
    st.style.animationDelay = (Math.random() * 4) + 's';
    s.appendChild(st);
  }
})();

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

go(P ? 'home' : 'profiles');
