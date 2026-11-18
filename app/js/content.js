// Innhold for Lesing, Butikk, Huskespill og Tegning.

// ───────────── Lesing ─────────────
// Ordlengde per alder: [minste, største] antall bokstaver.
export const READ_LEN = { 3: [2, 2], 3.5: [2, 2], 4: [2, 3], 4.5: [3, 3], 5: [3, 4], 5.5: [4, 5], 6: [4, 5] };
export const READ_WORDS = [
  ['IS', '🍦'], ['KU', '🐄'], ['ØY', '🏝️'], ['SE', '👀'], ['GÅ', '🚶'], ['LE', '😄'], ['SY', '🪡'],
  ['SOL', '☀️'], ['BIL', '🚗'], ['HUS', '🏠'], ['OST', '🧀'], ['MUS', '🐭'], ['TOG', '🚂'], ['SNØ', '❄️'],
  ['BÅT', '⛵'], ['REV', '🦊'], ['ULV', '🐺'], ['SKO', '👟'], ['EGG', '🥚'], ['HAV', '🌊'], ['LUE', '🧢'],
  ['FOT', '🦶'], ['ØRE', '👂'], ['BOK', '📕'], ['KATT', '🐱'], ['HUND', '🐶'], ['FISK', '🐟'], ['EPLE', '🍎'],
  ['BALL', '⚽'], ['MELK', '🥛'], ['LØVE', '🦁'], ['KAKE', '🍰'], ['BUSS', '🚌'], ['ROSE', '🌹'],
  ['MÅNE', '🌙'], ['SOPP', '🍄'], ['GRIS', '🐷'], ['BJØRN', '🐻'], ['BANAN', '🍌'], ['TIGER', '🐯'],
  ['SEBRA', '🦓'], ['SKOLE', '🏫'], ['KANIN', '🐰'], ['PIZZA', '🍕'], ['HJERTE', '❤️'],
];

// ───────────── Butikk ─────────────
// coins: myntene barnet har; max: høyeste pris/sum; types: oppgavetyper (vekting).
export const SHOP_AGES = {
  3:   { coins: [1], max: 5, types: { pay: 2, count: 1 }, showSum: true },
  3.5: { coins: [1], max: 6, types: { pay: 2, count: 1 }, showSum: true },
  4:   { coins: [1, 5], max: 10, types: { pay: 2, count: 2 }, showSum: true },
  4.5: { coins: [1, 5], max: 10, types: { pay: 2, count: 2, afford: 1 }, showSum: true },
  5:   { coins: [1, 5, 10], max: 20, types: { pay: 2, count: 2, afford: 1 }, showSum: false },
  5.5: { coins: [1, 5, 10, 20], max: 30, types: { pay: 2, count: 2, afford: 1 }, showSum: false },
  6:   { coins: [1, 5, 10, 20], max: 50, types: { pay: 2, count: 2, afford: 1, change: 2 }, showSum: false },
};
export const SHOP_ITEMS = [
  { e: '🍬', n: 'godteri' }, { e: '🍎', n: 'eple' }, { e: '🍌', n: 'banan' }, { e: '🍦', n: 'is' },
  { e: '🎈', n: 'ballong' }, { e: '🧃', n: 'juice' }, { e: '🥐', n: 'bolle' }, { e: '⚽', n: 'ball' },
  { e: '🚗', n: 'lekebil' }, { e: '🧸', n: 'bamse' }, { e: '📕', n: 'bok' }, { e: '🍕', n: 'pizza' },
  { e: '🪁', n: 'drage' }, { e: '🦖', n: 'dinosaur' }, { e: '🎨', n: 'fargeskrin' },
];

// ───────────── Huskespill ─────────────
export const MEMORY_PAIRS = { 3: 3, 3.5: 4, 4: 6, 4.5: 6, 5: 8, 5.5: 8, 6: 10 };
export const MEMORY_PICS = ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐸', '🦁', '🐷', '🐮', '🐵', '🐔', '🐧', '🐙',
  '🦋', '🐞', '🌻', '🍎', '🍓', '🍌', '⭐', '🌈', '🚗', '🚀', '⚽', '🎈'];

// ───────────── Tegning ─────────────
export const PAINT_COLORS = ['#1d1b2f', '#ff4d6d', '#ff9f1c', '#ffd23f', '#2fd18f', '#3aa8ff', '#7b5cff', '#ff7ab6', '#8d5a3b', '#ffffff'];
export const STAMPS = ['⭐', '❤️', '🌸', '🐞', '🦋', '☀️', '🌈', '🐶', '🐱', '🚗', '🎈', '🍎'];
// Fargeleggingsmaler: strek-SVG-stier i et 400×300-område.
export const TEMPLATES = [
  { id: 'hus', n: 'Hus', e: '🏠', d: [
    'M60 150 L200 40 L340 150 Z', 'M90 150 L90 280 L310 280 L310 150', 'M170 280 L170 200 L230 200 L230 280',
    'M110 175 L155 175 L155 215 L110 215 Z', 'M245 175 L290 175 L290 215 L245 215 Z', 'M10 280 L390 280',
    'M330 60 m-25 0 a25 25 0 1 0 50 0 a25 25 0 1 0 -50 0'] },
  { id: 'fisk', n: 'Fisk', e: '🐟', d: [
    'M60 150 C120 60 260 60 300 150 C260 240 120 240 60 150 Z', 'M300 150 L370 90 L360 150 L370 210 Z',
    'M110 140 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0', 'M160 95 C180 130 180 170 160 205',
    'M210 90 C230 130 230 170 210 210', 'M30 60 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0',
    'M50 30 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0'] },
  { id: 'sol', n: 'Sol', e: '☀️', d: [
    'M200 150 m-70 0 a70 70 0 1 0 140 0 a70 70 0 1 0 -140 0',
    'M200 40 L185 70 L215 70 Z', 'M200 260 L185 230 L215 230 Z', 'M90 150 L120 135 L120 165 Z', 'M310 150 L280 135 L280 165 Z',
    'M120 70 L150 90 L140 100 Z', 'M280 70 L250 90 L260 100 Z', 'M120 230 L150 210 L140 200 Z', 'M280 230 L250 210 L260 200 Z',
    'M175 140 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0', 'M225 140 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0',
    'M170 172 C185 195 215 195 230 172'] },
  { id: 'bil', n: 'Bil', e: '🚗', d: [
    'M40 210 L40 160 L100 160 L140 100 L270 100 L310 160 L360 160 L360 210 Z',
    'M150 112 L130 155 L200 155 L200 112 Z', 'M215 112 L215 155 L290 155 L262 112 Z',
    'M110 215 m-32 0 a32 32 0 1 0 64 0 a32 32 0 1 0 -64 0', 'M290 215 m-32 0 a32 32 0 1 0 64 0 a32 32 0 1 0 -64 0',
    'M10 250 L390 250'] },
  { id: 'blomst', n: 'Blomst', e: '🌸', d: [
    'M200 110 m-28 0 a28 28 0 1 0 56 0 a28 28 0 1 0 -56 0',
    'M200 82 C170 30 230 30 200 82', 'M200 138 C170 190 230 190 200 138', 'M172 110 C120 80 120 140 172 110', 'M228 110 C280 80 280 140 228 110',
    'M200 166 L200 290', 'M200 230 C160 200 130 220 140 240 C160 250 190 240 200 230', 'M200 250 C240 220 270 240 260 260 C240 270 210 260 200 250',
    'M20 290 L380 290'] },
  { id: 'katt', n: 'Katt', e: '🐱', d: [
    'M200 140 m-80 0 a80 70 0 1 0 160 0 a80 70 0 1 0 -160 0', 'M135 100 L130 40 L175 78', 'M265 100 L270 40 L225 78',
    'M170 130 m-10 0 a10 12 0 1 0 20 0 a10 12 0 1 0 -20 0', 'M230 130 m-10 0 a10 12 0 1 0 20 0 a10 12 0 1 0 -20 0',
    'M190 160 L210 160 L200 172 Z', 'M200 172 C190 185 175 185 170 178', 'M200 172 C210 185 225 185 230 178',
    'M150 165 L95 155', 'M150 172 L95 180', 'M250 165 L305 155', 'M250 172 L305 180'] },
];
