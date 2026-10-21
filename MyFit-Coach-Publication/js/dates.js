// Petites fonctions de dates, toujours en heure locale du téléphone.

const LONG = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const SHORT_DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

// "2026-10-21" (sans passer par l'heure UTC, qui décalerait parfois d'un jour).
export function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

export function sameDay(a, b) {
  return isoDate(a) === isoDate(b);
}

// "Mardi 21 octobre"
export function longDate(d) {
  const s = LONG.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "mar." → "Mar"
export function shortDay(d) {
  const s = SHORT_DAY.format(d).replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Les 7 jours de la semaine (lundi → dimanche) qui contient la date d.
export function weekOf(d) {
  const offset = (d.getDay() + 6) % 7; // lundi = 0
  const monday = addDays(d, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// "Aujourd'hui", "Hier", "Demain" ou la date longue.
export function relativeDay(d, today = new Date()) {
  const diff = Math.round((fromIso(isoDate(d)) - fromIso(isoDate(today))) / 86400000);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === -1) return 'Hier';
  if (diff === 1) return 'Demain';
  return longDate(d);
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Bonne nuit';
  if (h < 18) return 'Bonjour';
  return 'Bonsoir';
}
