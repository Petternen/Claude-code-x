const KEY = 'stjerneskolen.v1';

// Eksponentiell XP-kurve: nivå L → L+1 krever 60 · 1,08^(L−1) XP.
// Totalt ca. 69 000 XP til nivå 60 ≈ 6 måneder à 15 min/dag (~350 XP/dag).
export const XP_BASE = 60;
export const XP_GROWTH = 1.08;
export const MAX_LEVEL = 60;
export const xpForLevel = l => Math.round(XP_BASE * Math.pow(XP_GROWTH, l - 1));

export function load() {
  try {
    const db = JSON.parse(localStorage.getItem(KEY));
    if (db && Array.isArray(db.profiles)) return db;
  } catch { /* tom eller blokkert lagring */ }
  return { profiles: [], current: null };
}

export function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignorer */ }
}

export function newProfile(name, avatar, age) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, avatar, age,
    level: 1, xp: 0, totalXp: 0,
    items: [], equipped: { hat: null, pet: null, aura: null },
    stats: { math: 0, letters: 0, words: 0 },
    traced: {}, seenMicTip: false,
  };
}

/** Legger til XP og returnerer listen over nye nivåer som ble nådd. */
export function addXp(p, amount) {
  const gained = [];
  p.totalXp += amount;
  if (p.level >= MAX_LEVEL) return gained;
  p.xp += amount;
  while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    gained.push(p.level);
  }
  if (p.level >= MAX_LEVEL) p.xp = 0;
  return gained;
}
