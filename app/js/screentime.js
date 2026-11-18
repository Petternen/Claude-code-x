// Skjermtid: X min spill → Y min pause for hele enheten. Teller bare når appen er åpen.
// Voksen-passord (PBKDF2-hash) låser opp og endrer tidene; gjenopprettingskode ved glemt passord.
const KEY = 'stjerneskolen.screentime';
export const DEFAULTS = { enabled: true, playMin: 10, pauseMin: 30, used: 0, extra: 0, pauseUntil: 0, lastActive: 0, pw: null, rec: null, warned: false };
const ITER = 150000;
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function loadST() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { ...DEFAULTS }; }
}
export function saveST(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignorer */ } }

// ── Passord ──
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export async function hashSecret(secret, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return { salt: b64(salt), hash: b64(new Uint8Array(bits)) };
}
export async function verifySecret(secret, stored) {
  if (!stored) return false;
  return (await hashSecret(secret, stored.salt)).hash === stored.hash;
}
/** Minst 8 tegn, minst én bokstav og ett tall. Returnerer feilmelding eller ''. */
export function passwordProblem(pw) {
  if (pw.length < 8) return 'Passordet må ha minst 8 tegn.';
  if (!/\p{L}/u.test(pw) || !/\d/.test(pw)) return 'Passordet må ha både bokstaver og tall.';
  return '';
}
export function newRecoveryCode() {
  const r = crypto.getRandomValues(new Uint8Array(16));
  const s = Array.from(r, x => CODE_ABC[x % CODE_ABC.length]).join('');
  return s.match(/.{4}/g).join('-');
}
export const normCode = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const clock = t => new Date(t).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });

/**
 * Starter skjermtid. hooks: { onLock(), avatarHTML(), speak(text) }.
 * Returnerer { isLocked, onKey(e) → håndtert?, openAdult(), state }.
 */
export function initScreenTime(hooks) {
  let st = loadST();
  let failed = 0, blockedUntil = 0;
  const now = () => Date.now();
  // En lang nok pause (appen lukket) nullstiller spilletiden
  if (!st.pauseUntil && st.lastActive && now() - st.lastActive >= st.pauseMin * 60000) { st.used = 0; st.extra = 0; st.warned = false; saveST(st); }
  const el = document.createElement('div');
  el.id = 'lock';
  el.hidden = true;
  document.body.appendChild(el);
  let dialog = null; // åpen voksen-dialog (element)

  const locked = () => st.enabled && st.pauseUntil > now();
  const limit = () => st.playMin * 60 + (st.extra || 0);
  function persist() { saveST(st); }

  function startPause() {
    st.pauseUntil = now() + st.pauseMin * 60000;
    st.used = 0; st.extra = 0; st.warned = false;
    persist();
    hooks.onLock?.();
    showLock();
    hooks.speak?.('Nå er det tid for pause! Figuren din skal sove litt.');
  }

  function showLock() {
    if (!el.hidden && el.querySelector('.lock-box')) return updateLock();
    el.hidden = false;
    el.innerHTML = `<div class="lock-box" role="dialog" aria-label="Pause">
      <div class="sleeper">${hooks.avatarHTML?.() || '😴'}<span class="zzz">💤</span></div>
      <h1>Tid for pause!</h1>
      <p class="lock-sub">Figuren din sover. Gå og lek litt!</p>
      <div class="lock-count" aria-live="polite"></div>
      <button class="btn ghost adult-btn" data-lock="adult">🔒 For voksne</button>
    </div><div class="adult-slot"></div>`;
    el.querySelector('[data-lock=adult]').onclick = () => openAdult();
    updateLock();
  }
  function updateLock() {
    const left = Math.max(0, (st.pauseUntil - now()) / 1000);
    const c = el.querySelector('.lock-count');
    if (c) c.innerHTML = `Du kan spille igjen om <b>${fmt(left)}</b><small>(kl. ${clock(st.pauseUntil)})</small>`;
  }
  function hideLock() { el.hidden = true; el.innerHTML = ''; dialog = null; }

  function endPause(msg = 'Pausen er over. Velkommen tilbake!') {
    st.pauseUntil = 0; st.used = 0; st.extra = 0; st.warned = false;
    persist();
    hideLock();
    hooks.speak?.(msg);
  }

  // ── Klokke ──
  let ticks = 0;
  const timer = setInterval(() => {
    const t = now();
    if (!st.enabled) return;
    if (st.pauseUntil) {
      if (st.pauseUntil > t) { if (el.hidden) showLock(); else updateLock(); return; }
      if (dialog) { st.pauseUntil = 0; persist(); return; }
      return endPause();
    }
    if (document.visibilityState !== 'visible') return;
    st.used += 1;
    st.lastActive = t;
    const left = limit() - st.used;
    if (left <= 60 && !st.warned && st.playMin > 1) {
      st.warned = true;
      hooks.speak?.('Ett minutt igjen før pause!');
      hooks.toast?.('⏱ 1 minutt igjen før pause');
    }
    if (left <= 0) return startPause();
    if (++ticks % 5 === 0) persist();
  }, 1000);
  const flush = () => { if (st.enabled && !st.pauseUntil) st.lastActive = now(); persist(); };
  document.addEventListener('visibilitychange', flush);
  addEventListener('pagehide', flush);
  if (locked()) showLock();

  // ── Voksen-dialoger ──
  function openDialog(html) {
    if (el.hidden) { el.hidden = false; el.innerHTML = '<div class="adult-slot"></div>'; }
    const slot = el.querySelector('.adult-slot');
    slot.innerHTML = `<form class="adult-box" autocomplete="off" novalidate>${html}
      <button type="button" class="icon-btn close" data-x aria-label="Lukk">✕</button></form>`;
    dialog = slot.firstElementChild;
    dialog.querySelector('[data-x]').onclick = closeDialog;
    setTimeout(() => dialog?.querySelector('input,button.btn')?.focus(), 30);
    return dialog;
  }
  function closeDialog() {
    if (!dialog) return;
    dialog.remove(); dialog = null;
    if (!locked()) hideLock(); else if (st.pauseUntil <= now()) endPause();
  }
  const msg = (d, text, ok = false) => { const m = d.querySelector('.msg'); m.textContent = text; m.classList.toggle('ok', ok); };

  function openAdult() {
    if (!st.pw) {
      if (locked()) {
        return openDialog(`<h2>For voksne</h2><p>Det er ikke laget et voksenpassord ennå, så pausen kan ikke låses opp.
          Den er over kl. <b>${clock(st.pauseUntil)}</b>.</p><p>Lag et passord under «For voksne» på hjem-skjermen etter pausen.</p>`);
      }
      return setupPassword();
    }
    const d = openDialog(`<h2>For voksne</h2><label class="field"><span>Voksenpassord</span>
      <input type="password" name="pw" autocomplete="current-password"></label><p class="msg" role="alert"></p>
      <div class="row"><button type="button" class="btn ghost" data-forgot>Glemt passord?</button><button class="btn">Lås opp</button></div>`);
    d.querySelector('[data-forgot]').onclick = recover;
    d.onsubmit = async e => {
      e.preventDefault();
      if (now() < blockedUntil) return msg(d, `For mange forsøk. Vent ${Math.ceil((blockedUntil - now()) / 1000)} sekunder.`);
      const ok = await verifySecret(d.pw.value, st.pw);
      if (!ok) {
        d.pw.value = '';
        if (++failed >= 5) { blockedUntil = now() + 30000; failed = 0; }
        return msg(d, 'Feil passord.');
      }
      failed = 0;
      settings();
    };
    return d;
  }

  function setupPassword(title = 'Lag voksenpassord') {
    const d = openDialog(`<h2>${title}</h2>
      <p>Passordet brukes til å låse opp pausen og endre skjermtiden. Minst 8 tegn, med både bokstaver og tall.</p>
      <label class="field"><span>Nytt passord</span><input type="password" name="pw" autocomplete="new-password"></label>
      <label class="field"><span>Gjenta passordet</span><input type="password" name="pw2" autocomplete="new-password"></label>
      <p class="msg" role="alert"></p><div class="row"><button class="btn">Lagre passord</button></div>`);
    d.onsubmit = async e => {
      e.preventDefault();
      const p = d.pw.value, problem = passwordProblem(p);
      if (problem) return msg(d, problem);
      if (p !== d.pw2.value) return msg(d, 'Passordene er ikke like.');
      const code = newRecoveryCode();
      st.pw = await hashSecret(p);
      st.rec = await hashSecret(normCode(code));
      persist();
      showCode(code);
    };
  }

  function showCode(code) {
    const d = openDialog(`<h2>Gjenopprettingskode</h2>
      <p>Skriv ned eller ta bilde av koden. Den vises bare <b>nå</b>, og trengs hvis du glemmer passordet.</p>
      <p class="rec-code" data-code>${code}</p>
      <label class="check"><input type="checkbox" name="ok"> Jeg har tatt vare på koden</label>
      <p class="msg" role="alert"></p><div class="row"><button class="btn">Ferdig</button></div>`);
    d.onsubmit = e => {
      e.preventDefault();
      if (!d.ok.checked) return msg(d, 'Kryss av når du har tatt vare på koden.');
      settings();
    };
  }

  function recover() {
    const d = openDialog(`<h2>Glemt passord</h2><p>Skriv inn gjenopprettingskoden du fikk da passordet ble laget.</p>
      <label class="field"><span>Gjenopprettingskode</span><input name="code" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX"></label>
      <p class="msg" role="alert"></p><div class="row"><button class="btn">Fortsett</button></div>`);
    d.onsubmit = async e => {
      e.preventDefault();
      if (now() < blockedUntil) return msg(d, 'For mange forsøk. Vent litt.');
      if (!(await verifySecret(normCode(d.code.value), st.rec))) {
        if (++failed >= 5) { blockedUntil = now() + 30000; failed = 0; }
        return msg(d, 'Feil kode.');
      }
      failed = 0;
      setupPassword('Lag nytt voksenpassord');
    };
  }

  function settings() {
    const isLocked = locked();
    const left = Math.max(0, limit() - st.used);
    const d = openDialog(`<h2>Skjermtid</h2>
      ${isLocked ? `<p class="status">Pause til kl. <b>${clock(st.pauseUntil)}</b></p>
        <div class="row"><button type="button" class="btn" data-unlock>Lås opp nå</button>
        <button type="button" class="btn ghost" data-extra>+10 minutter</button></div>`
      : `<p class="status">${st.enabled ? `Igjen før pause: <b>${fmt(left)}</b>` : 'Skjermtid er <b>av</b>.'}</p>
        <div class="row"><button type="button" class="btn ghost" data-extra>+10 minutter</button><button type="button" class="btn ghost" data-reset>Start tiden på nytt</button></div>`}
      <label class="check"><input type="checkbox" name="on" ${st.enabled ? 'checked' : ''}> Skjermtid er på</label>
      <div class="two"><label class="field"><span>Spilletid (min)</span><input type="number" name="play" min="1" max="240" value="${st.playMin}" inputmode="numeric"></label>
      <label class="field"><span>Pause (min)</span><input type="number" name="pause" min="1" max="480" value="${st.pauseMin}" inputmode="numeric"></label></div>
      <p class="msg" role="alert"></p>
      <div class="row"><button type="button" class="btn ghost" data-pw>Bytt passord</button><button class="btn">Lagre</button></div>`);
    d.querySelector('[data-unlock]')?.addEventListener('click', () => { closeDialog(); endPause('Pausen er låst opp. Kos deg!'); });
    d.querySelector('[data-extra]')?.addEventListener('click', () => {
      // Nøyaktig 10 minutter mer, uansett hvor kort spilletiden er
      if (locked()) { st.pauseUntil = 0; st.used = 0; st.extra = 600 - st.playMin * 60; } else st.extra = (st.extra || 0) + 600;
      st.warned = false; persist(); closeDialog(); hideLock();
      hooks.speak?.('Du fikk ti minutter ekstra!');
    });
    d.querySelector('[data-reset]')?.addEventListener('click', () => { st.used = 0; st.extra = 0; st.warned = false; persist(); msg(d, 'Tiden er startet på nytt.', true); settings(); });
    d.querySelector('[data-pw]').onclick = () => setupPassword('Bytt voksenpassord');
    d.onsubmit = e => {
      e.preventDefault();
      const play = Math.round(+d.play.value), pause = Math.round(+d.pause.value);
      if (!(play >= 1 && play <= 240 && pause >= 1 && pause <= 480)) return msg(d, 'Spilletid 1–240 min, pause 1–480 min.');
      st.playMin = play; st.pauseMin = pause; st.enabled = d.on.checked;
      if (!st.enabled) st.pauseUntil = 0;
      persist();
      msg(d, st.enabled ? 'Lagret.' : 'Lagret. Skjermtid er av.', true);
    };
  }

  return {
    isLocked: () => locked() || !!dialog,
    /** Fanger tastetrykk mens låst / dialog åpen. Returnerer true når håndtert. */
    onKey(e) {
      if (dialog) { if (e.key === 'Escape') closeDialog(); return true; }
      if (locked()) { if (!['Tab', 'Enter', ' '].includes(e.key)) e.preventDefault(); return true; }
      return false;
    },
    openAdult,
    get state() { return st; },
    stop() { clearInterval(timer); },
  };
}
