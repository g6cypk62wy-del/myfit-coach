// Outils de texte partagés.

// Minuscules, sans accents, apostrophes uniformisées : « Où » → « ou ».
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/œ/g, 'oe')
    .trim();
}

// Nombre à la française : 72.5 → « 72,5 ».
export function frNumber(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return String(r).replace('.', ',');
}

// Saisie « 72,5 » → 72.5 ; vide → null ; invalide → NaN.
export function parseFr(raw) {
  const t = String(raw ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Durée lisible : 0 → « moins d’1 min ».
export const minutesText = (n) => (n >= 1 ? `${n} min` : 'moins d’1 min');
