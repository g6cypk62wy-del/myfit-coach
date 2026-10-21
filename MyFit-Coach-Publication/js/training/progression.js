// Suggestions de progression, calculées UNIQUEMENT à partir des séances réellement enregistrées.
// Ce sont des suggestions : il n'y a aucune obligation d'augmenter.

import { exerciseById } from '../data/exercises.js';
import { frNumber } from '../text.js';

const DAY = 86400000;

// Dernières performances d'un exercice, de la plus récente à la plus ancienne.
export function performancesFor(exId, sessions = []) {
  return sessions
    .filter((s) => s.exercises.some((e) => e.ex === exId))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((s) => ({
      date: s.startedAt,
      sessionId: s.id,
      review: s.review,
      sets: s.exercises.filter((e) => e.ex === exId).flatMap((e) => e.sets),
      target: s.exercises.find((e) => e.ex === exId).target,
    }));
}

const INCREMENT = {
  barre: 'ajoute 2,5 kg au total',
  machine: 'passe au cran suivant',
  poulie: 'passe au cran suivant',
  halteres: 'prends la paire d’haltères suivante (souvent +1 à 2 kg)',
  kettlebell: 'prends la kettlebell suivante',
  elastique: 'prends un élastique un peu plus résistant',
  corps: 'ajoute 1 ou 2 répétitions, ou passe à une variante plus difficile',
  temps: 'ajoute 5 à 10 secondes',
  cardio: 'ajoute 2 à 5 minutes ou augmente légèrement l’intensité',
};

const round = (w) => Math.round(w * 2) / 2; // au demi-kilo

export function topWeight(sets) {
  const ws = sets.map((s) => s.weight).filter((w) => typeof w === 'number' && w > 0);
  return ws.length ? Math.max(...ws) : null;
}

// target : la cible actuelle ({ reps: [min, max] } ou seconds / minutes).
export function suggestion(exId, target, sessions = [], now = new Date()) {
  const ex = exerciseById(exId);
  const perfs = performancesFor(exId, sessions);
  if (!ex) return null;
  if (!perfs.length) {
    return {
      kind: 'premiere',
      text: ex.measure === 'reps'
        ? 'Première fois : commence léger. Choisis une charge qui te permet de faire les répétitions prévues en gardant 2 à 3 répétitions en réserve.'
        : 'Première fois : commence tranquillement, à une intensité où tu restes à l’aise.',
    };
  }
  const last = perfs[0];
  const days = Math.floor((now - new Date(last.date)) / DAY);
  const w = topWeight(last.sets);
  const lastText = w ? `${frNumber(w)} kg` : null;

  if (days > 14) {
    const factor = days > 21 ? 0.8 : 0.9;
    const pct = days > 21 ? '20' : '10';
    return {
      kind: 'reprise',
      weight: w ? round(w * factor) : null,
      text: w
        ? `Ta dernière fois remonte à ${days} jours : reprends environ ${pct} % plus léger (${lastText} → ${frNumber(round(w * factor))} kg), puis remonte progressivement.`
        : `Ta dernière fois remonte à ${days} jours : reprends un peu plus doucement que d’habitude.`,
    };
  }

  if (last.review?.pain === 'oui') {
    return {
      kind: 'garder', weight: w,
      text: 'Tu avais signalé une douleur lors de cette séance : n’augmente pas. Si elle revient, arrête l’exercice.',
    };
  }

  const range = target?.reps ?? target?.seconds ?? target?.minutes ?? last.target?.reps ?? last.target?.seconds ?? last.target?.minutes;
  if (!range) return null;
  const [min, max] = range;
  const values = last.sets.map((s) => s.value ?? 0);
  const allTop = values.length > 0 && values.every((v) => v >= max);
  const below = values.filter((v) => v < min).length;
  const hard = last.review?.difficulty ?? null;

  if (allTop && (hard === null || hard <= 8)) {
    return {
      kind: 'augmenter', weight: w,
      text: `La dernière fois, tu as atteint le haut de la fourchette sur toutes les séries${lastText ? ` à ${lastText}` : ''}. Si la technique était propre, tu peux essayer : ${INCREMENT[ex.load]}. Ce n’est pas obligatoire.`,
    };
  }
  if (below >= Math.ceil(values.length / 2) && hard !== null && hard >= 9) {
    return {
      kind: 'reduire',
      weight: w ? round(w * 0.9) : null,
      text: w
        ? `La dernière séance était très difficile et plusieurs séries étaient sous l’objectif : allège un peu (${lastText} → ${frNumber(round(w * 0.9))} kg) pour retrouver de bonnes répétitions.`
        : 'La dernière séance était très difficile : vise un peu moins cette fois.',
    };
  }
  if (below) {
    return {
      kind: 'garder', weight: w,
      text: `Garde ${lastText ?? 'la même difficulté'} et vise au moins ${min} sur chaque série.`,
    };
  }
  return {
    kind: 'garder', weight: w,
    text: `Garde ${lastText ?? 'la même difficulté'} et essaie de gagner une répétition sur une ou deux séries.`,
  };
}
