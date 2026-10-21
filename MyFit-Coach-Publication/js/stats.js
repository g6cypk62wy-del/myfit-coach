// Statistiques calculées UNIQUEMENT à partir des données enregistrées.
// Quand il n'y a pas assez de données, les fonctions le disent (null / listes vides).

import { exerciseById } from './data/exercises.js';
import { totals } from './nutrition/journal.js';
import { isoDate, addDays, weekOf } from './dates.js';
import { WEEKDAYS } from './profile-schema.js';
import { minutesText } from './text.js';

const DAY = 86400000;

export function weekRange(now = new Date()) {
  const days = weekOf(now);
  return { from: days[0], to: addDays(days[6], 1), days };
}

export function sessionsBetween(sessions, from, to) {
  return sessions.filter((s) => {
    const d = new Date(s.startedAt);
    return d >= from && d < to;
  });
}

// Charge maximale théorique (formule d'Epley) : sert seulement à comparer des séries entre elles.
export function e1rm(weight, reps) {
  if (!weight || !reps) return null;
  return weight * (1 + reps / 30);
}

function bestSet(sets) {
  let best = null;
  for (const s of sets) {
    const score = s.weight ? e1rm(s.weight, s.value) : s.value;
    if (score != null && (!best || score > best.score)) best = { ...s, score };
  }
  return best;
}

// Progrès par exercice : première et dernière fois (au moins 2 séances).
export function exerciseProgress(sessions) {
  const byEx = new Map();
  for (const s of [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    for (const e of s.exercises) {
      const best = bestSet(e.sets);
      if (!best) continue;
      if (!byEx.has(e.ex)) byEx.set(e.ex, []);
      byEx.get(e.ex).push({ date: s.startedAt, best });
    }
  }
  const out = [];
  for (const [ex, list] of byEx) {
    if (list.length < 2) continue;
    const first = list[0].best;
    const last = list[list.length - 1].best;
    const change = first.score ? (last.score - first.score) / first.score : 0;
    out.push({ ex, name: exerciseById(ex)?.name ?? ex, times: list.length, first, last, change, history: list });
  }
  return out.sort((a, b) => b.change - a.change);
}

// Historique d'un exercice pour un graphique : meilleure charge (ou valeur) par séance.
export function exerciseSeries(sessions, exId) {
  return [...sessions]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((s) => {
      const sets = s.exercises.filter((e) => e.ex === exId).flatMap((e) => e.sets);
      if (!sets.length) return null;
      const weights = sets.map((x) => x.weight).filter((w) => w > 0);
      return {
        date: s.startedAt,
        weight: weights.length ? Math.max(...weights) : null,
        value: Math.max(...sets.map((x) => x.value ?? 0)),
      };
    })
    .filter(Boolean);
}

// Nombre de séances par semaine sur les n dernières semaines (la plus ancienne en premier).
export function sessionsPerWeek(sessions, n = 8, now = new Date()) {
  const { from } = weekRange(now);
  return Array.from({ length: n }, (_, i) => {
    const start = addDays(from, -7 * (n - 1 - i));
    const end = addDays(start, 7);
    return { start, count: sessionsBetween(sessions, start, end).length };
  });
}

// Régularité : semaines avec au moins une séance, depuis la première séance (max n semaines).
export function regularity(sessions, n = 8, now = new Date()) {
  if (!sessions.length) return null;
  const first = new Date([...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0].startedAt);
  const weeks = sessionsPerWeek(sessions, n, now).filter((w) => addDays(w.start, 7) > first);
  if (!weeks.length) return null;
  return { active: weeks.filter((w) => w.count > 0).length, total: weeks.length };
}

export function setsCount(sessions) {
  return sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
}

export function volume(sessions) {
  let v = 0;
  for (const s of sessions) for (const e of s.exercises) for (const x of e.sets) if (x.weight && x.value) v += x.weight * x.value;
  return v;
}

export function average(nums) {
  const xs = nums.filter((x) => typeof x === 'number');
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

// Moyennes nutritionnelles sur les jours COMPLETS (toutes les valeurs connues) d'une période.
export function nutritionTrend(journal, from, to) {
  const days = Object.entries(journal || {}).filter(([d]) => d >= isoDate(from) && d < isoDate(to));
  const complete = [];
  for (const [d, entries] of days) {
    const t = totals(entries);
    if (entries.length && t.kcal.unknown === 0) complete.push({ date: d, kcal: t.kcal.value, prot: t.prot.unknown ? null : t.prot.value });
  }
  return {
    loggedDays: days.length,
    completeDays: complete.length,
    avgKcal: complete.length >= 3 ? average(complete.map((x) => x.kcal)) : null,
    avgProt: complete.length >= 3 ? average(complete.map((x) => x.prot)) : null,
  };
}

// Bilan de la semaine en cours (calculé à l'ouverture, aucun envoi automatique).
export function weeklyReview({ sessions = [], program = null, journal = {}, targets = null }, now = new Date()) {
  const { from, to } = weekRange(now);
  const week = sessionsBetween(sessions, from, to);
  const planned = program?.sessions.length ?? null;
  const todayIdx = (now.getDay() + 6) % 7;
  const plannedSoFar = program ? program.sessions.filter((s) => WEEKDAYS.findIndex((w) => w.id === s.day) <= todayIdx).length : null;
  const difficulty = average(week.map((s) => s.review?.difficulty));
  const pains = week.filter((s) => s.review?.pain === 'oui').length;
  const nutrition = nutritionTrend(journal, from, to);
  const progress = exerciseProgress(sessions).filter((p) => p.change > 0.02 && p.history.some((h) => new Date(h.date) >= from));

  const wins = [];
  const watch = [];
  const next = [];
  if (week.length) {
    const n = setsCount(week);
    wins.push(`${week.length} séance${week.length > 1 ? 's' : ''} réalisée${week.length > 1 ? 's' : ''} (${n} série${n > 1 ? 's' : ''}, ${minutesText(week.reduce((m, s) => m + s.durationMin, 0))} au total).`);
  }
  if (progress.length) wins.push(`Progrès mesurés sur : ${progress.slice(0, 3).map((p) => p.name).join(', ')}.`);
  if (nutrition.loggedDays) wins.push(`${nutrition.loggedDays} jour${nutrition.loggedDays > 1 ? 's' : ''} de journal alimentaire rempli${nutrition.loggedDays > 1 ? 's' : ''}.`);
  if (difficulty !== null && difficulty >= 8.5) watch.push('Tes séances ont été ressenties comme très difficiles : pense à la récupération (sommeil, repas, jours de repos).');
  if (pains) watch.push(`Douleur signalée lors de ${pains} séance${pains > 1 ? 's' : ''} : n’augmente pas les charges sur les exercices concernés et demande conseil si elle persiste.`);
  if (planned !== null && plannedSoFar !== null && week.length < plannedSoFar) {
    next.push('Cette semaine a été moins remplie que prévu : ce n’est pas un échec. Reprends simplement avec la prochaine séance prévue.');
  }
  if (nutrition.avgProt !== null && targets?.prot && nutrition.avgProt < targets.prot[0]) {
    next.push(`Protéines : ${Math.round(nutrition.avgProt)} g en moyenne sur les jours complets, sous ton repère (${targets.prot[0]}–${targets.prot[1]} g). Une source de protéines à chaque repas peut aider.`);
  }
  if (week.length && (difficulty === null || difficulty <= 7) && !pains) next.push('Si la technique est bonne, les suggestions de charge pendant la séance t’indiqueront où progresser.');

  return {
    from, to, sessions: week, planned, plannedSoFar, difficulty, pains, nutrition, progress, wins, watch, next,
    enoughData: week.length > 0 || nutrition.loggedDays > 0,
  };
}

export function daysSinceLastSession(sessions, now = new Date()) {
  if (!sessions.length) return null;
  const last = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  return Math.floor((now - new Date(last.startedAt)) / DAY);
}
