// ───────────── Opplesning (tekst-til-tale) ─────────────
let voice = null;
function pickVoice() {
  const vs = window.speechSynthesis?.getVoices() || [];
  voice = vs.find(v => /^nb/i.test(v.lang)) || vs.find(v => /^no/i.test(v.lang)) ||
          vs.find(v => /^nn/i.test(v.lang)) || null;
}
if (window.speechSynthesis) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* ignorer */ }
}

export function speak(text, { rate = 0.92 } = {}) {
  return new Promise(resolve => {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return resolve();
    stopSpeaking();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'nb-NO';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = 1.1;
    let done = false;
    const fin = () => { if (!done) { done = true; clearTimeout(t); resolve(); } };
    u.onend = fin;
    u.onerror = fin;
    // Sikkerhetsnett: noen nettlesere sender aldri onend
    const t = setTimeout(fin, 1800 + text.length * 95);
    speechSynthesis.speak(u);
  });
}

// ───────────── Talegjenkjenning ─────────────
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = !!SR;

/**
 * Starter én lytte-økt. onResult(alternativer[], erFinal), onState(tilstand, feil).
 * Returnerer en stopp-funksjon.
 */
export function startListening({ onResult, onState }) {
  if (!SR) { onState('unsupported'); return () => {}; }
  const r = new SR();
  r.lang = 'nb-NO';
  r.interimResults = true;
  r.maxAlternatives = 5;
  r.continuous = false;
  let stopped = false;
  r.onstart = () => !stopped && onState('listening');
  r.onresult = e => {
    if (stopped) return;
    const res = e.results[e.results.length - 1];
    const alts = Array.from(res, a => a.transcript);
    onResult(alts, res.isFinal);
  };
  r.onerror = e => !stopped && onState('error', e.error);
  r.onend = () => !stopped && onState('ended');
  try { r.start(); } catch (err) { onState('error', String(err?.message || err)); }
  return () => { stopped = true; try { r.abort(); } catch { /* ignorer */ } };
}

// ───────────── Tolking av norske tallord ─────────────
const UNITS = { null: 0, en: 1, 'én': 1, ett: 1, ei: 1, eitt: 1, to: 2, tre: 3, fire: 4, fem: 5,
  seks: 6, sju: 7, syv: 7, 'åtte': 8, ni: 9 };
const TEENS = { ti: 10, elleve: 11, tolv: 12, tretten: 13, fjorten: 14, femten: 15, seksten: 16,
  sytten: 17, atten: 18, nitten: 19 };
const TENS = { tjue: 20, tyve: 20, tretti: 30, tredve: 30, 'førti': 40, femti: 50, seksti: 60,
  sytti: 70, 'åtti': 80, nitti: 90 };

function compound(tok) {
  for (const [t, tv] of Object.entries(TENS)) {
    if (tok.startsWith(t) && tok.length > t.length) {
      const rest = tok.slice(t.length);
      if (UNITS[rest] > 0) return tv + UNITS[rest];
    }
  }
  return null;
}

export function parseNumbers(text) {
  const toks = String(text).toLowerCase().replace(/[.,!?;:]/g, ' ').split(/[\s-]+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (/^\d+$/.test(t)) { out.push(+t); continue; }
    if (t === 'hundre' || t === 'hundrede') { out.push(100); continue; }
    if (t in TEENS) { out.push(TEENS[t]); continue; }
    const c = compound(t);
    if (c != null) { out.push(c); continue; }
    if (t in TENS) {
      const nx = toks[i + 1];
      if (UNITS[nx] > 0) { out.push(TENS[t] + UNITS[nx]); i++; } else out.push(TENS[t]);
      continue;
    }
    if (t in UNITS) {
      // Gammel tellemåte: «fem og tjue»
      if (toks[i + 1] === 'og' && toks[i + 2] in TENS && UNITS[t] > 0) {
        out.push(TENS[toks[i + 2]] + UNITS[t]); i += 2;
      } else out.push(UNITS[t]);
    }
  }
  return out;
}

/**
 * Bedømmer et svar. Endelig resultat: siste tall barnet sa teller (barn teller
 * ofte høyt «1, 2, 3 … 5»). Foreløpig resultat godtas bare om det er ett entydig tall.
 */
export function judge(alts, final, answer) {
  let heard = null;
  for (const a of alts) {
    const nums = parseNumbers(a);
    if (!nums.length) continue;
    const last = nums[nums.length - 1];
    if (final ? last === answer : (nums.length === 1 && nums[0] === answer)) return { correct: true, heard: answer };
    if (heard == null) heard = last;
  }
  return { correct: false, heard };
}
