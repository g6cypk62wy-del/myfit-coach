// Séance en cours : fonctions pures qui modifient l'objet séance.
// L'objet est enregistré à chaque changement (clé « activeSession ») pour survivre
// à un changement d'écran, une fermeture de l'app ou un rechargement.

import { exerciseById } from '../data/exercises.js';
import { uid } from '../text.js';

const blankSets = (n, weight = null) => Array.from({ length: Math.max(1, n) }, () => ({ weight, value: null, done: false }));

function itemFromTarget(exId, target = {}) {
  const ex = exerciseById(exId);
  const t = {
    sets: target.sets ?? (ex?.measure === 'minutes' ? 1 : 3),
    reps: target.reps ?? (ex?.measure === 'reps' ? [8, 12] : null),
    seconds: target.seconds ?? (ex?.measure === 'seconds' ? [20, 40] : null),
    minutes: target.minutes ?? (ex?.measure === 'minutes' ? [10, 15] : null),
    rest: target.rest ?? 90,
  };
  return { uid: uid(), ex: exId, target: t, sets: blankSets(t.sets), note: '', replacedFrom: null };
}

// planned : une séance du programme (ou null pour une séance libre).
export function createSession({ planned = null, program = null, now = Date.now(), onlyExercises = null } = {}) {
  const items = (planned?.exercises ?? [])
    .filter((it) => !onlyExercises || onlyExercises.includes(it.ex))
    // Version courte : 2 séries maximum et repos d'1 minute au plus.
    .map((it) => itemFromTarget(it.ex, onlyExercises ? { ...it, sets: Math.min(2, it.sets ?? 2), rest: Math.min(60, it.rest ?? 60) } : it));
  return {
    id: uid(),
    name: planned ? planned.name : 'Séance libre',
    plannedId: planned?.id ?? null,
    programCreatedAt: program?.createdAt ?? null,
    short: Boolean(onlyExercises),
    startedAt: now,
    pausedAt: null,
    pausedMs: 0,
    rest: null,
    current: 0,
    exercises: items,
    notes: '',
  };
}

export function elapsedMs(s, now = Date.now()) {
  const end = s.pausedAt ?? now;
  return Math.max(0, end - s.startedAt - s.pausedMs);
}

export function togglePause(s, now = Date.now()) {
  if (s.pausedAt) {
    s.pausedMs += now - s.pausedAt;
    // Le repos reprend là où il en était.
    if (s.rest?.remainingAtPause != null) s.rest = { ...s.rest, endsAt: now + s.rest.remainingAtPause, remainingAtPause: null };
    s.pausedAt = null;
  } else {
    s.pausedAt = now;
    if (s.rest) s.rest = { ...s.rest, remainingAtPause: Math.max(0, s.rest.endsAt - now) };
  }
  return s;
}

export function setField(s, i, j, field, value) {
  const set = s.exercises[i]?.sets[j];
  if (set) set[field] = value;
  return s;
}

// Valide une série. Renvoie false si la valeur (répétitions, secondes ou minutes) manque.
export function completeSet(s, i, j, now = Date.now()) {
  const item = s.exercises[i];
  const set = item?.sets[j];
  if (!set || set.value === null || set.value === undefined || Number.isNaN(set.value)) return false;
  set.done = true;
  s.current = i;
  const remaining = item.sets.some((x) => !x.done) || s.exercises.slice(i + 1).length > 0;
  if (item.target.rest > 0 && remaining) startRest(s, item.target.rest, now);
  // Exercice terminé : on passe au suivant non terminé.
  if (!item.sets.some((x) => !x.done)) {
    const next = s.exercises.findIndex((x, k) => k > i && x.sets.some((y) => !y.done));
    if (next >= 0) s.current = next;
  }
  return true;
}

export function uncompleteSet(s, i, j) {
  const set = s.exercises[i]?.sets[j];
  if (set) set.done = false;
  return s;
}

export function addSet(s, i) {
  const item = s.exercises[i];
  if (!item) return s;
  const last = item.sets[item.sets.length - 1];
  item.sets.push({ weight: last?.weight ?? null, value: null, done: false });
  return s;
}

// Retire la dernière série non validée (il reste toujours au moins une série).
export function removeSet(s, i) {
  const item = s.exercises[i];
  if (!item || item.sets.length <= 1) return false;
  const idx = item.sets.map((x) => x.done).lastIndexOf(false);
  if (idx < 0) return false;
  item.sets.splice(idx, 1);
  return true;
}

export function replaceExercise(s, i, newExId) {
  const item = s.exercises[i];
  if (!item) return s;
  const keepCount = item.sets.length;
  const fresh = itemFromTarget(newExId, {
    sets: keepCount,
    reps: item.target.reps,
    seconds: item.target.seconds,
    minutes: item.target.minutes,
    rest: item.target.rest,
  });
  fresh.replacedFrom = item.replacedFrom ?? item.ex;
  fresh.note = item.note;
  s.exercises[i] = fresh;
  return s;
}

// « Machine occupée » : l'exercice passe à la fin, on le fera plus tard.
export function moveToEnd(s, i) {
  const [item] = s.exercises.splice(i, 1);
  if (item) s.exercises.push(item);
  const next = s.exercises.findIndex((x) => x.sets.some((y) => !y.done));
  s.current = next >= 0 ? next : 0;
  return s;
}

export function addExercise(s, exId) {
  s.exercises.push(itemFromTarget(exId));
  s.current = s.exercises.length - 1;
  return s;
}

export function removeExercise(s, i) {
  const item = s.exercises[i];
  if (!item || item.sets.some((x) => x.done)) return false;
  s.exercises.splice(i, 1);
  s.current = Math.min(s.current, Math.max(0, s.exercises.length - 1));
  return true;
}

export function startRest(s, seconds, now = Date.now()) {
  s.rest = { duration: seconds, endsAt: now + seconds * 1000, remainingAtPause: s.pausedAt ? seconds * 1000 : null };
  return s;
}

export function addRest(s, seconds, now = Date.now()) {
  if (!s.rest) return startRest(s, seconds, now);
  if (s.rest.remainingAtPause != null) s.rest.remainingAtPause += seconds * 1000;
  else s.rest.endsAt = Math.max(s.rest.endsAt, now) + seconds * 1000;
  s.rest.duration += seconds;
  return s;
}

export function stopRest(s) {
  s.rest = null;
  return s;
}

export function restRemainingMs(s, now = Date.now()) {
  if (!s.rest) return 0;
  if (s.rest.remainingAtPause != null) return s.rest.remainingAtPause;
  return Math.max(0, s.rest.endsAt - now);
}

export function doneSetsCount(s) {
  return s.exercises.reduce((n, it) => n + it.sets.filter((x) => x.done).length, 0);
}

// Transforme la séance en séance RÉALISÉE (seules les séries validées sont gardées).
export function finishSession(s, review = {}, now = Date.now()) {
  if (s.pausedAt) togglePause(s, now);
  const exercises = s.exercises
    .map((it) => ({
      ex: it.ex,
      replacedFrom: it.replacedFrom,
      note: it.note?.trim() || '',
      target: it.target,
      sets: it.sets.filter((x) => x.done).map((x) => ({ weight: x.weight ?? null, value: x.value })),
    }))
    .filter((it) => it.sets.length);
  return {
    id: s.id,
    name: s.name,
    plannedId: s.plannedId,
    short: s.short,
    startedAt: new Date(s.startedAt).toISOString(),
    endedAt: new Date(now).toISOString(),
    durationMin: Math.round(elapsedMs(s, now) / 60000),
    exercises,
    review: {
      difficulty: review.difficulty ?? null,
      energy: review.energy ?? null,
      pain: review.pain ?? null,
      painNote: review.painNote?.trim() || '',
      notes: (review.notes ?? s.notes ?? '').trim(),
    },
  };
}

export function formatClock(ms) {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`;
}
