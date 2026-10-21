// Génération du programme d'entraînement.
// Fonction pure : mêmes données en entrée → même programme. Chaque choix est expliqué en français.
// Aucune donnée n'est inventée : si une info essentielle manque, on renvoie la liste de ce qui manque.

import { EXERCISES, exerciseById } from '../data/exercises.js';
import { GOALS, WEEKDAYS, missingEssentials } from '../profile-schema.js';
import { normalize } from '../text.js';

const LEVEL = { debut: 1, 'quelques-mois': 2, regulier: 3 };
const DURATION_SLOTS = { 30: 4, 45: 5, 60: 6, 75: 7, 90: 8 };
const goalLabel = (id) => (GOALS.find((g) => g.id === id)?.label ?? id).replace(/\s*\(.*\)/, '').toLowerCase();

// Mots repérés dans les réponses santé → articulations à ménager.
const JOINT_WORDS = [
  { joint: 'genou', words: ['genou', 'genoux', 'menisque', 'ligament croise', 'rotule'] },
  { joint: 'dos', words: ['dos', 'lombaire', 'lombaires', 'hernie', 'sciatique', 'colonne', 'lumbago'] },
  { joint: 'epaule', words: ['epaule', 'epaules', 'coiffe'] },
  { joint: 'poignet', words: ['poignet', 'poignets', 'canal carpien'] },
  { joint: 'coude', words: ['coude', 'coudes', 'tendinite du coude', 'epicondylite'] },
  { joint: 'hanche', words: ['hanche', 'hanches'] },
  { joint: 'cheville', words: ['cheville', 'chevilles', 'achille'] },
];
export const JOINT_LABELS = {
  genou: 'les genoux', dos: 'le bas du dos', epaule: 'les épaules', poignet: 'les poignets',
  coude: 'les coudes', hanche: 'les hanches', cheville: 'les chevilles',
};

export function jointsToProtect(sante = {}) {
  const text = normalize([sante.douleursDetail, sante.blessures, sante.limitations, sante.recommandations].filter(Boolean).join(' '));
  if (!text) return [];
  return JOINT_WORDS.filter((j) => j.words.some((w) => new RegExp(`\\b${w}\\b`).test(text))).map((j) => j.joint);
}

// ---------- Salle ----------

export function gymReady(gym) {
  return Boolean(gym && (gym.available?.length || gym.noEquipment));
}

export function isAvailable(ex, gym) {
  const available = new Set(gym?.available ?? []);
  const avoid = new Set(gym?.avoid ?? []);
  return ex.equip.every((need) => need.split('|').some((id) => available.has(id) && !avoid.has(id)));
}

// ---------- Ce qui manque ----------

export function programMissing(profile, gym) {
  const missing = [];
  if (!profile) return [{ label: 'Ton profil validé', href: '#/profil' }];
  for (const m of missingEssentials(profile.data)) {
    if (['profil', 'objectifs', 'experience', 'sante'].includes(m.step)) {
      missing.push({ label: m.label, href: '#/questionnaire/' + (['profil', 'objectifs', 'experience', 'sante'].indexOf(m.step) + 1) });
    }
  }
  if (!gymReady(gym)) missing.push({ label: 'Les équipements de ta salle', href: '#/salle' });
  return missing;
}

// ---------- Jours ----------

// Choisit les jours en les espaçant le plus possible dans la semaine.
export function pickDays(available, count) {
  const order = WEEKDAYS.map((d) => d.id);
  const days = order.filter((d) => available.includes(d));
  if (count >= days.length) return days;
  let best = null;
  const combos = (start, chosen) => {
    if (chosen.length === count) {
      const idx = chosen.map((d) => order.indexOf(d));
      const gaps = idx.map((v, i) => (i === idx.length - 1 ? idx[0] + 7 - v : idx[i + 1] - v));
      const score = Math.min(...gaps) * 10 - gaps.filter((g) => g === 1).length;
      if (!best || score > best.score) best = { score, chosen: [...chosen] };
      return;
    }
    for (let i = start; i < days.length; i++) combos(i + 1, [...chosen, days[i]]);
  };
  combos(0, []);
  return best.chosen;
}

// ---------- Modèles de séances ----------

const TEMPLATES = {
  fullA: ['squat', 'push-h', 'pull-v', 'hinge', 'push-v', 'pull-h', 'glute', 'iso-bras'],
  fullB: ['hinge', 'pull-h', 'push-h', 'squat', 'pull-v', 'glute', 'iso-epaules', 'iso-jambes'],
  fullC: ['squat', 'pull-v', 'push-h', 'glute', 'pull-h', 'iso-epaules', 'iso-bras', 'iso-jambes'],
  haut: ['push-h', 'pull-v', 'push-v', 'pull-h', 'iso-epaules', 'iso-bras', 'iso-pecs', 'iso-bras'],
  bas: ['squat', 'hinge', 'glute', 'iso-jambes', 'squat', 'glute', 'iso-jambes', 'iso-jambes'],
  leger: ['mobilite', 'cardio', 'core', 'mobilite'],
};

const SESSION_NAMES = {
  fullA: 'Corps entier A', fullB: 'Corps entier B', fullC: 'Corps entier C',
  haut: 'Haut du corps', bas: 'Bas du corps', leger: 'Cardio et mobilité (léger)',
};

function splitFor(level, count) {
  if (count <= 0) return { id: 'aucun', templates: [] };
  if (level === 1) {
    const base = ['fullA', 'fullB', 'fullA'].slice(0, Math.min(count, 3));
    const extra = Array(Math.max(0, count - 3)).fill('leger');
    return { id: 'corps-entier', templates: [...base, ...extra] };
  }
  if (count <= 3) return { id: 'corps-entier', templates: ['fullA', 'fullB', 'fullC'].slice(0, count) };
  if (count === 4) return { id: 'haut-bas', templates: ['haut', 'bas', 'haut', 'bas'] };
  if (count === 5) return { id: 'haut-bas', templates: ['haut', 'bas', 'fullA', 'haut', 'bas'] };
  return { id: 'haut-bas', templates: ['haut', 'bas', 'haut', 'bas', 'fullB', 'leger'] };
}

// Construit la liste des types d'exercices d'une séance, en tenant compte des priorités.
// Les priorités passent en tête ; mobilité (début), gainage et cardio (fin) ont une place réservée
// pour ne pas disparaître quand la séance est courte.
function planSlots(template, goals) {
  const main = [...TEMPLATES[template]];
  if (template === 'leger') return { start: [], main, end: [] };
  const top = goals.slice(0, 2);
  const isLower = template === 'bas' || template.startsWith('full');
  const isUpper = template === 'haut' || template.startsWith('full');
  if (top.includes('fessiers-jambes') && isLower) main.splice(1, 0, 'glute');
  if (top.includes('haut-du-corps') && isUpper) main.splice(2, 0, 'pull-h');
  const start = goals.includes('mobilite') ? ['mobilite'] : [];
  const end = [];
  if (goals.includes('abdos')) end.push('core');
  if (top.includes('endurance') || top.includes('perte-graisse')) end.push('cardio');
  return { start, main, end };
}

// ---------- Séries et répétitions ----------

function prescription(ex, level, goals) {
  const top = goals[0];
  if (ex.measure === 'minutes') return { sets: 1, minutes: top === 'endurance' ? [15, 20] : [10, 15], rest: 0 };
  if (ex.measure === 'seconds') {
    return ex.kind === 'mobilite' ? { sets: 1, seconds: [45, 60], rest: 15 } : { sets: level === 1 ? 2 : 3, seconds: [20, 40], rest: 45 };
  }
  if (ex.kind === 'gainage') return { sets: level === 1 ? 2 : 3, reps: [8, 12], rest: 45 };
  // Au poids du corps, on ne peut pas « charger » : on vise plus de répétitions.
  if (ex.load === 'corps') return { sets: level === 1 ? 2 : 3, reps: level === 1 ? [8, 12] : [10, 15], rest: 60 };
  const compound = ex.kind === 'compose';
  if (compound && top === 'force' && level >= 2 && !ex.unilateral) return { sets: 4, reps: [4, 6], rest: 150 };
  if (compound && level === 3) return { sets: 4, reps: [6, 10], rest: 120 };
  if (compound) return { sets: 3, reps: level === 1 ? [10, 12] : [8, 12], rest: 90 };
  const higher = top === 'endurance' || top === 'perte-graisse';
  return { sets: level === 1 ? 2 : 3, reps: higher ? [12, 15] : [10, 15], rest: 60 };
}

// ---------- Choix des exercices ----------

function candidates(pattern, ctx) {
  return EXERCISES.filter((ex) => ex.pattern === pattern && isAvailable(ex, ctx.gym) && ex.level <= ctx.level);
}

function score(ex, ctx) {
  let s = 0;
  const keys = (ex.keywords || []).map(normalize);
  if (keys.some((k) => ctx.likes.includes(k))) s += 30;
  if (ex.equip.some((e) => e.split('|').some((id) => ctx.known.has(id)))) s += 8;
  if (ctx.machinesNovice && ex.load === 'machine') s += 6;
  if (ex.goals.some((g) => ctx.goals.slice(0, 2).includes(g))) s += 5;
  // Plus on est avancé·e, plus on préfère les exercices qui se chargent.
  s -= (ctx.level - ex.level) * 4;
  if (ctx.level >= 2 && ex.load === 'corps') s -= 6;
  return s;
}

function chooseExercise(pattern, ctx, used) {
  const all = candidates(pattern, ctx);
  const safe = all.filter((ex) => !ex.stress.some((j) => ctx.joints.includes(j)));
  const liked = safe.filter((ex) => !(ex.keywords || []).map(normalize).some((k) => ctx.dislikes.includes(k)));
  const pool = (liked.length ? liked : safe).filter((ex) => !used.has(ex.id));
  if (!pool.length) {
    if (all.length && !safe.length) ctx.skippedForJoints.add(pattern);
    return null;
  }
  const ranked = [...pool].sort((a, b) => score(b, ctx) - score(a, ctx));
  // Varier d'une séance à l'autre : le n-ième passage sur ce type prend le n-ième meilleur.
  const turn = ctx.turns.get(pattern) ?? 0;
  ctx.turns.set(pattern, turn + 1);
  return ranked[turn % Math.min(ranked.length, 2)];
}

const WHY = {
  squat: 'Mouvement de base pour les cuisses et les fessiers.',
  hinge: 'Renforce l’arrière des cuisses, les fessiers et le dos.',
  glute: 'Cible directement les fessiers.',
  'push-h': 'Poussée devant toi : pectoraux et triceps.',
  'push-v': 'Poussée au-dessus de la tête : épaules.',
  'pull-v': 'Tirage vertical : largeur du dos.',
  'pull-h': 'Tirage horizontal : épaisseur du dos et posture.',
  'iso-jambes': 'Travail ciblé des jambes.',
  'iso-epaules': 'Travail ciblé des épaules.',
  'iso-bras': 'Travail ciblé des bras.',
  'iso-pecs': 'Travail ciblé des pectoraux.',
  core: 'Gainage : stabilité du tronc.',
  cardio: 'Cardio à intensité modérée pour l’endurance et la dépense.',
  mobilite: 'Mobilité pour bouger mieux et préparer le corps.',
};

// ---------- Génération ----------

export function generateProgram(profile, gym, now = new Date()) {
  const missing = programMissing(profile, gym);
  if (missing.length) return { missing };

  const d = profile.data;
  const level = LEVEL[d.experience.niveau] ?? 1;
  const goals = d.objectifs.objectifs;
  const wanted = Number(d.experience.seances);
  const days = pickDays(d.experience.jours, Math.min(wanted, d.experience.jours.length));
  const slotsCount = DURATION_SLOTS[d.experience.duree] ?? 5;
  const split = splitFor(level, days.length);
  const joints = d.sante.douleurs === 'oui' || d.sante.blessures || d.sante.limitations || d.sante.recommandations
    ? jointsToProtect(d.sante) : [];

  const ctx = {
    gym, level, goals, joints,
    likes: normalize(d.experience.aimes || ''),
    dislikes: normalize(d.experience.detestes || ''),
    known: new Set(gym.known ?? []),
    machinesNovice: d.experience.machines === 'pas-du-tout',
    turns: new Map(),
    skippedForJoints: new Set(),
  };

  const sessions = split.templates.map((tpl, i) => {
    const used = new Set();
    const { start, main, end: allEnd } = planSlots(tpl, goals);
    const max = tpl === 'leger' ? 4 : slotsCount;
    // Séance courte : un seul « extra » de fin (le plus prioritaire), pour garder poussée ET tirage.
    const end = max <= 5 && allEnd.length > 1
      ? [['endurance', 'perte-graisse'].includes(goals[0]) ? 'cardio' : allEnd[0]]
      : allEnd;
    const pick = (pattern) => {
      const ex = chooseExercise(pattern, ctx, used);
      if (!ex) return null;
      used.add(ex.id);
      return { ex: ex.id, ...prescription(ex, level, goals), why: WHY[pattern] };
    };
    const head = start.map(pick).filter(Boolean);
    const tail = end.map(pick).filter(Boolean);
    const body = [];
    for (const pattern of main) {
      if (head.length + body.length + tail.length >= max) break;
      const item = pick(pattern);
      if (item) body.push(item);
    }
    const exercises = [...head, ...body, ...tail];
    return {
      id: String.fromCharCode(65 + i),
      template: tpl,
      name: SESSION_NAMES[tpl],
      day: days[i],
      exercises,
    };
  });

  // ---------- Explications ----------
  const explanation = [];
  const dayLabels = days.map((id) => WEEKDAYS.find((w) => w.id === id).label.toLowerCase());
  explanation.push(`${days.length} séance${days.length > 1 ? 's' : ''} par semaine (${dayLabels.join(', ')}), espacées autant que tes disponibilités le permettent pour laisser récupérer les muscles.`);
  if (wanted > d.experience.jours.length) {
    explanation.push(`Tu souhaitais ${wanted} séances, mais tu as ${d.experience.jours.length} jour${d.experience.jours.length > 1 ? 's' : ''} disponible${d.experience.jours.length > 1 ? 's' : ''} : une séance par jour au maximum.`);
  }
  if (split.id === 'corps-entier') {
    explanation.push('Séances « corps entier » : chaque muscle est travaillé plusieurs fois par semaine, ce qui convient très bien pour progresser régulièrement.');
  } else if (split.id === 'haut-bas') {
    explanation.push('Répartition « haut du corps / bas du corps » : avec 4 séances ou plus, chaque partie a le temps de récupérer entre deux séances.');
  }
  if (level === 1 && days.length > 3) {
    explanation.push('Comme tu débutes, les séances au-delà de 3 sont des séances légères (cardio et mobilité) : la récupération compte autant que l’effort.');
  }
  explanation.push(`Environ ${slotsCount} exercices par séance pour tenir en ${d.experience.duree} minutes, échauffement compris.`);
  if (goals.length) {
    explanation.push(`Tes priorités (${goals.slice(0, 2).map(goalLabel).join(', puis ')}) passent en premier dans chaque séance, pour qu’elles soient travaillées même si tu manques de temps.`);
  }
  explanation.push(level === 1
    ? 'Répétitions plutôt élevées (10 à 12) et charges modérées : l’objectif est d’apprendre les bons gestes.'
    : 'Le nombre de répétitions dépend de l’exercice : moins de répétitions sur les gros mouvements, plus sur les exercices ciblés.');
  if (joints.length) {
    explanation.push(`D’après tes réponses santé, les exercices qui sollicitent fortement ${joints.map((j) => JOINT_LABELS[j]).join(' et ')} ont été évités quand une alternative existait.`);
  }
  const warnings = [];
  if (d.sante.douleurs === 'oui') {
    warnings.push('Tu as signalé une douleur : en cas de douleur pendant un exercice, arrête-le. Un avis médical ou kiné est recommandé avant de charger lourd.');
  }
  if (ctx.skippedForJoints.size) {
    warnings.push('Certains types d’exercices ont été retirés faute d’alternative ménageant tes articulations. Ton kiné ou médecin pourra t’indiquer quoi faire à la place.');
  }
  const thin = sessions.filter((s) => s.template !== 'leger' && s.exercises.length < Math.min(3, slotsCount));
  if (thin.length) {
    warnings.push('Peu d’exercices possibles avec les équipements cochés : ajoute ceux de ta salle dans « Ma salle On Air » pour des séances plus complètes.');
  }

  return {
    program: {
      version: 1,
      createdAt: now.toISOString(),
      basedOnProfile: profile.validatedAt,
      basedOnGym: gym.updatedAt ?? null,
      split: split.id,
      level,
      explanation,
      warnings,
      sessions,
    },
  };
}

// Le profil ou la salle ont-ils changé depuis la création du programme ?
export function programOutdated(program, profile, gym) {
  if (!program) return false;
  return program.basedOnProfile !== profile?.validatedAt || (program.basedOnGym ?? null) !== (gym?.updatedAt ?? null);
}

// Texte « 3 × 10–12 », « 1 × 10–15 min », « 2 × 20–40 s ».
export function targetText(item) {
  const range = (r, unit = '') => (r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]}–${r[1]}${unit}`);
  if (item.minutes) return `${range(item.minutes, ' min')}`;
  if (item.seconds) return `${item.sets} × ${range(item.seconds, ' s')}`;
  return `${item.sets} × ${range(item.reps)}`;
}

export { exerciseById };
