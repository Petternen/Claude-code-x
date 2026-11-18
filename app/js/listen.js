// Felles talelytting for nye aktiviteter (Lesing, Butikk).
import { canListen, startListening, parseNumbers } from './speech.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MSG = {
  listening: 'Jeg lytter …', idle: 'Trykk på mikrofonen og svar',
  blocked: 'Mikrofonen er blokkert – gi tilgang i nettleseren', unsupported: '',
};

/**
 * Lytter etter ett svar. judge(alts, final) → { correct, heard } der heard != null
 * betyr «barnet sa noe tolkbart, men feil». Kaller onCorrect / onWrong(heard).
 * Prøver stille på nytt to ganger ved stillhet, så vises «trykk på mikrofonen».
 */
export function createListener({ mic, heard, judge, onCorrect, onWrong, onListen }) {
  let stopFn = null, retries = 0, alive = true;
  const set = st => {
    mic.dataset.state = st;
    if (MSG[st] && !(st === 'listening' && heard.querySelector('.said'))) heard.innerHTML = `<span class="hint">${MSG[st]}</span>`;
  };
  const stop = () => { stopFn?.(); stopFn = null; };
  function listen() {
    if (!alive) return;
    stop();
    if (!canListen) { set('unsupported'); return; }
    let handled = false;
    set('listening');
    onListen?.();
    stopFn = startListening({
      onResult(alts, final) {
        if (handled) return;
        heard.innerHTML = `<span class="said">«${esc(alts[0])}»</span>`;
        const r = judge(alts, final);
        if (r.correct) { handled = true; stop(); set('happy'); onCorrect(); }
        else if (final) { handled = true; if (r.heard != null) { set('speaking'); onWrong(r.heard); } else retry(); }
      },
      onState(s, err) {
        if (handled) return;
        if (s === 'listening') set('listening');
        else if (s === 'ended') { handled = true; retry(); }
        else if (s === 'error') {
          if (err === 'not-allowed' || err === 'service-not-allowed') { handled = true; set('blocked'); }
          else if (!['no-speech', 'aborted', 'network'].includes(err)) { handled = true; set('idle'); }
        } else if (s === 'unsupported') { handled = true; set('unsupported'); }
      },
    });
  }
  function retry() {
    if (!alive) return;
    if (retries++ < 2) setTimeout(listen, 250); else set('idle');
  }
  return {
    listen() { retries = 0; listen(); },
    stop() { stop(); },
    speaking() { stop(); set('speaking'); heard.innerHTML = ''; },
    destroy() { alive = false; stop(); },
  };
}

/** Tallsvar (som i matte): siste tall teller. */
export function numberJudge(answer) {
  return (alts, final) => {
    let heard = null;
    for (const a of alts) {
      const n = parseNumbers(a);
      if (!n.length) continue;
      const last = n[n.length - 1];
      if (final ? last === answer : (n.length === 1 && n[0] === answer)) return { correct: true };
      heard ??= last;
    }
    return { correct: false, heard };
  };
}

const YES = ['ja', 'jo', 'jepp', 'japp', 'jada', 'javisst', 'yes'];
const NO = ['nei', 'næ', 'neida', 'nope', 'no'];
export function yesNo(text) {
  const t = String(text).toLowerCase().replace(/[.,!?]/g, ' ').split(/\s+/).filter(Boolean);
  const y = t.some(w => YES.includes(w)), n = t.some(w => NO.includes(w));
  return y === n ? null : y;
}
export function yesNoJudge(answer) {
  return (alts, final) => {
    let heard = null;
    for (const a of alts) {
      const v = yesNo(a);
      if (v == null) continue;
      if (v === answer) return { correct: true };
      heard ??= v ? 'ja' : 'nei';
    }
    return { correct: false, heard: final ? heard : null };
  };
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}
const norm = s => String(s).toLowerCase().normalize('NFC').replace(/[.,!?«»"]/g, ' ').split(/\s+/).filter(Boolean);

/** Lesing: riktig når ordet finnes i talen (lange ord tåler én bokstav feil). */
export function wordMatches(text, word) {
  const w = word.toLowerCase();
  return norm(text).some(t => t === w || (w.length >= 4 && t.length >= 3 && lev(t, w) <= 1));
}
export function wordJudge(word) {
  return (alts, final) => {
    for (const a of alts) if (wordMatches(a, word)) return { correct: true };
    const said = norm(alts[0] || '');
    return { correct: false, heard: final && said.length ? said.join(' ') : null };
  };
}
