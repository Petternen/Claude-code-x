// ───────────────────────── Alderstrinn ─────────────────────────
// types: vekting av oppgavetyper. *Max: tallområder. picsMax: vis figurer
// som støtte når tallene er så små. tol/width: toleranse og bredde (SVG-enheter)
// for sporing av bokstaver – yngre barn får bredere spor og mer slingringsmonn.
export const AGES = [
  { age: 3,   label: '3',  types: { count: 1 },                                         countMax: 4,  seqMax: 5,  tol: 19, width: 30 },
  { age: 3.5, label: '3½', types: { count: 3, next: 1 },                                countMax: 6,  seqMax: 6,  tol: 18, width: 28 },
  { age: 4,   label: '4',  types: { count: 3, next: 2, compare: 1, add: 1 },            countMax: 8,  seqMax: 10, cmpMax: 5,  addMax: 5,  picsMax: 10, tol: 17, width: 26 },
  { age: 4.5, label: '4½', types: { count: 2, next: 2, compare: 2, add: 3, sub: 1 },    countMax: 10, seqMax: 10, cmpMax: 10, addMax: 6,  subMax: 5,  picsMax: 10, tol: 16, width: 24 },
  { age: 5,   label: '5',  types: { count: 1, next: 2, before: 1, compare: 2, add: 3, sub: 2 }, countMax: 12, seqMax: 20, cmpMax: 20, addMax: 10, subMax: 10, picsMax: 6, tol: 15, width: 22 },
  { age: 5.5, label: '5½', types: { next: 1, before: 1, compare: 1, add: 3, sub: 3, seq: 1 }, seqMax: 20, cmpMax: 30, addMax: 15, subMax: 12, picsMax: 5, steps: [1, 2], tol: 14, width: 21 },
  { age: 6,   label: '6',  types: { before: 1, compare: 1, add: 3, sub: 3, seq: 2 },   seqMax: 50, cmpMax: 50, addMax: 20, subMax: 20, picsMax: 0, steps: [1, 2, 5, 10], tol: 13, width: 20 },
];

export const AVATARS = ['🦊', '🐻', '🐰', '🐼', '🦁', '🐸', '🐯', '🐨', '🐵', '🐧', '🐱', '🐶'];

export const NOUNS = [
  { e: '🍎', pl: 'epler' }, { e: '🐞', pl: 'marihøner' }, { e: '⭐', pl: 'stjerner' },
  { e: '🐟', pl: 'fisker' }, { e: '🎈', pl: 'ballonger' }, { e: '🌸', pl: 'blomster' },
  { e: '🐥', pl: 'kyllinger' }, { e: '🚗', pl: 'biler' }, { e: '🍓', pl: 'jordbær' },
  { e: '🦋', pl: 'sommerfugler' }, { e: '🍌', pl: 'bananer' }, { e: '🐸', pl: 'frosker' },
];

export const PRAISE = ['Riktig!', 'Supert!', 'Kjempebra!', 'Wow, så flink!', 'Helt riktig!', 'Du er en stjerne!', 'Fantastisk!'];

// ───────────────────────── Bokstaver og tall ─────────────────────────
// Hver bokstav er en liste med strøk (SVG-stier) i rekkefølgen de skal tegnes.
// Koordinatsystem: bredde 0–100, høyde 0–140, grunnlinje y=130.
const O = (cx, rx) => {
  const k = 0.5523, ry = 60, cy = 70;
  return `M${cx} ${cy - ry} C${cx - rx * k} ${cy - ry} ${cx - rx} ${cy - ry * k} ${cx - rx} ${cy} ` +
    `C${cx - rx} ${cy + ry * k} ${cx - rx * k} ${cy + ry} ${cx} ${cy + ry} ` +
    `C${cx + rx * k} ${cy + ry} ${cx + rx} ${cy + ry * k} ${cx + rx} ${cy} ` +
    `C${cx + rx} ${cy - ry * k} ${cx + rx * k} ${cy - ry} ${cx} ${cy - ry}`;
};

export const GLYPHS = {
  A: ['M50 10 L15 130', 'M50 10 L85 130', 'M30 85 L70 85'],
  B: ['M22 10 L22 130', 'M22 10 L55 10 C86 10 86 68 55 68 L22 68', 'M22 68 L60 68 C94 68 94 130 60 130 L22 130'],
  C: ['M82 30 C72 4 18 2 18 70 C18 138 72 136 82 110'],
  D: ['M22 10 L22 130', 'M22 10 L45 10 C96 10 96 130 45 130 L22 130'],
  E: ['M22 10 L22 130', 'M22 10 L80 10', 'M22 70 L70 70', 'M22 130 L80 130'],
  F: ['M22 10 L22 130', 'M22 10 L80 10', 'M22 70 L70 70'],
  G: ['M82 30 C72 4 18 2 18 70 C18 138 76 138 82 100 L82 78 L58 78'],
  H: ['M20 10 L20 130', 'M80 10 L80 130', 'M20 70 L80 70'],
  I: ['M50 10 L50 130'],
  J: ['M70 10 L70 100 C70 140 22 140 20 106'],
  K: ['M22 10 L22 130', 'M80 10 L24 74 L80 130'],
  L: ['M22 10 L22 130 L80 130'],
  M: ['M14 130 L14 10 L50 82 L86 10 L86 130'],
  N: ['M20 130 L20 10 L80 130 L80 10'],
  O: [O(50, 36)],
  P: ['M22 10 L22 130', 'M22 10 L55 10 C88 10 88 74 55 74 L22 74'],
  Q: [O(50, 36), 'M58 100 L88 136'],
  R: ['M22 10 L22 130', 'M22 10 L55 10 C88 10 88 72 55 72 L22 72', 'M48 72 L82 130'],
  S: ['M80 28 C72 4 22 4 22 38 C22 70 80 62 80 98 C80 136 24 136 18 110'],
  T: ['M50 10 L50 130', 'M14 10 L86 10'],
  U: ['M20 10 L20 90 C20 142 80 142 80 90 L80 10'],
  V: ['M14 10 L50 130 L86 10'],
  W: ['M6 10 L28 130 L50 44 L72 130 L94 10'],
  X: ['M18 10 L82 130', 'M82 10 L18 130'],
  Y: ['M18 10 L50 70', 'M82 10 L50 70 L50 130'],
  Z: ['M18 10 L82 10 L18 130 L82 130'],
  'Æ': ['M48 10 L8 130', 'M48 10 L48 130', 'M48 10 L92 10', 'M28 74 L84 74', 'M48 130 L92 130'],
  'Ø': [O(50, 36), 'M86 6 L14 134'],
  'Å': ['M50 42 L16 130', 'M50 42 L84 130', 'M32 98 L68 98',
        'M50 4 C43 4 38 9 38 16 C38 23 43 28 50 28 C57 28 62 23 62 16 C62 9 57 4 50 4'],
  0: [O(50, 30)],
  1: ['M28 38 L56 10 L56 130'],
  2: ['M22 40 C20 0 82 0 80 40 C78 70 42 94 20 130 L82 130'],
  3: ['M22 26 C34 2 80 4 78 38 C76 60 58 68 42 68 C62 68 82 78 82 100 C82 138 30 138 18 112'],
  4: ['M56 10 L18 92 L86 92', 'M66 46 L66 130'],
  5: ['M28 10 L24 62 C46 46 82 54 82 92 C82 136 30 138 18 112', 'M28 10 L78 10'],
  6: ['M74 18 C54 0 18 10 18 80 C18 140 82 140 82 96 C82 54 24 54 20 90'],
  7: ['M18 10 L82 10 L38 130'],
  8: ['M78 32 C78 2 22 2 22 32 C22 60 78 70 78 102 C78 140 22 140 22 102 C22 70 78 60 78 32'],
  9: ['M80 42 C78 4 20 4 20 42 C20 80 80 80 80 42 L76 130'],
};

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'.split('');
export const DIGITS = '0123456789'.split('');

export const EXAMPLES = {
  A: ['Ape', '🐒'], B: ['Bil', '🚗'], C: ['Cello', '🎻'], D: ['Due', '🕊️'], E: ['Elefant', '🐘'],
  F: ['Fisk', '🐟'], G: ['Gris', '🐷'], H: ['Hus', '🏠'], I: ['Is', '🍦'], J: ['Jordbær', '🍓'],
  K: ['Katt', '🐱'], L: ['Løve', '🦁'], M: ['Mus', '🐭'], N: ['Nese', '👃'], O: ['Ost', '🧀'],
  P: ['Pære', '🍐'], Q: ['Quiz', '❓'], R: ['Rev', '🦊'], S: ['Sol', '☀️'], T: ['Tog', '🚂'],
  U: ['Ugle', '🦉'], V: ['Vann', '💧'], W: ['Wienerbrød', '🥐'], X: ['Xylofon', '🎶'], Y: ['Yoghurt', '🥣'],
  Z: ['Zebra', '🦓'], 'Æ': ['Ærfugl', '🦆'], 'Ø': ['Ørn', '🦅'], 'Å': ['Åker', '🌾'],
};
export const DIGIT_PICS = ['⚪', '🍎', '🐞', '⭐', '🐟', '🎈', '🌸', '🐥', '🚗', '🍓'];

export const WORDS = [
  ['IS', '🍦'], ['SOL', '☀️'], ['MOR', '👩'], ['FAR', '👨'], ['BIL', '🚗'], ['HUS', '🏠'], ['OST', '🧀'],
  ['KU', '🐄'], ['BÅT', '⛵'], ['MUS', '🐭'], ['TOG', '🚂'], ['SNØ', '❄️'], ['KATT', '🐱'], ['HUND', '🐶'],
  ['FISK', '🐟'], ['EPLE', '🍎'], ['BALL', '⚽'], ['MELK', '🥛'], ['LØVE', '🦁'], ['MAMMA', '👩'], ['PAPPA', '👨'],
];

// ───────────────────────── Skatter (artifacts) ─────────────────────────
// Nivå 2–60 gir én skatt hver. Hvert 5. nivå: utstyr til figuren (hatt, venn, glød).
const COLLECTIBLES = [
  ['⭐', 'Ener-stjerne'], ['🎲', 'Terning-tvilling'], ['🔺', 'Trekant-krystall'], ['🍀', 'Firkløver'],
  ['🖐️', 'Femmerhånd'], ['🐝', 'Sekskant-bie'], ['🌈', 'Sjufarget regnbue'], ['🐙', 'Åttearmet blekksprut'],
  ['🧮', 'Kuleramme'], ['🔟', 'Ti-krystall'], ['➕', 'Plusskrystall'], ['➖', 'Minusstein'],
  ['🍩', 'Null-smultring'], ['📏', 'Målelinjal'], ['⚖️', 'Balansevekt'], ['🧩', 'Tallpuslebit'],
  ['🪙', 'Gullmynt'], ['🔮', 'Tellekule'], ['🗝️', 'Tallnøkkel'], ['🧭', 'Tallkompass'],
  ['⏰', 'Klokkekompis'], ['🎯', 'Blink-bonus'], ['🧸', 'Tellebamse'], ['🪁', 'Tall-drage på snor'],
  ['🌙', 'Halvmåne'], ['☀️', 'Solstråle-sum'], ['🪐', 'Ringplanet'], ['☄️', 'Regnekomet'],
  ['🦔', 'Piggteller'], ['🐬', 'Hoppe-delfin'], ['🍕', 'Pizzabiter'], ['🥨', 'Åtte-kringle'],
  ['🎂', 'Bursdagskake'], ['🧲', 'Tallmagnet'], ['🔔', 'Riktig-bjelle'], ['🎵', 'Rytmenoter'],
  ['🐢', 'Sekskant-skilpadde'], ['🌻', 'Spiral-solsikke'], ['❄️', 'Seksarmet snøkrystall'], ['🐚', 'Spiralskjell'],
  ['💎', 'Tall-diamant'], ['🏰', 'Tallslott'], ['🌋', 'Pluss-vulkan'], ['🌠', 'Stjerneskudd'],
  ['🏆', 'Mattepokal'], ['🌌', 'Melkeveien'], ['🌟', 'Superstjerne'],
];
const COSMETICS = {
  5:  { slot: 'pet',  e: '🐣', n: 'Kyllingvenn' },
  10: { slot: 'hat',  e: '🧢', n: 'Tellecaps' },
  15: { slot: 'aura', e: '💠', n: 'Isblå glød', aura: 'ice' },
  20: { slot: 'hat',  e: '🎩', n: 'Tryllehatt' },
  25: { slot: 'pet',  e: '🐲', n: 'Tall-drage' },
  30: { slot: 'aura', e: '🌈', n: 'Regnbueglød', aura: 'rainbow' },
  35: { slot: 'hat',  e: '🎓', n: 'Mattemester-lue' },
  40: { slot: 'pet',  e: '🦖', n: 'Dinovenn' },
  45: { slot: 'aura', e: '✨', n: 'Gullglød', aura: 'gold' },
  50: { slot: 'hat',  e: '👑', n: 'Tallkrone' },
  55: { slot: 'pet',  e: '🦉', n: 'Kloke-ugla' },
  60: { slot: 'aura', e: '🌌', n: 'Stjernestøv-aura', aura: 'galaxy' },
};
export const SLOT_NAMES = { hat: 'Hatt', pet: 'Venn', aura: 'Glød' };

function rarity(level) {
  if (level < 15) return ['common', 'Vanlig'];
  if (level < 30) return ['rare', 'Sjelden'];
  if (level < 45) return ['epic', 'Episk'];
  return ['legend', 'Legendarisk'];
}

export const ARTIFACTS = [];
{
  let c = 0;
  for (let lvl = 2; lvl <= 60; lvl++) {
    const [rk, rn] = rarity(lvl);
    const base = COSMETICS[lvl]
      ? { ...COSMETICS[lvl] }
      : { e: COLLECTIBLES[c][0], n: COLLECTIBLES[c++][1] };
    ARTIFACTS.push({ id: 'a' + lvl, level: lvl, rarity: rk, rarityName: rn, ...base });
  }
  if (c !== COLLECTIBLES.length) console.warn('Samlekort-liste har feil lengde', c, COLLECTIBLES.length);
}
export const ART = Object.fromEntries(ARTIFACTS.map(a => [a.id, a]));
export const artifactForLevel = lvl => ART['a' + lvl] || null;
