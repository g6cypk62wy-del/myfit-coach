// Coach SANS IA : réponses calculées par des règles à partir des données enregistrées.
// Il ne devine rien. Quand une donnée manque, il le dit et indique où la remplir.
// Chaque réponse précise sur quelles données elle s'appuie (« basis »).

import { normalize, frNumber } from './text.js';
import { exerciseById } from './data/exercises.js';
import { WEEKDAYS } from './profile-schema.js';
import { filterIdeas } from './nutrition/ideas.js';
import { totals } from './nutrition/journal.js';
import { isAvailable } from './training/program.js';
import { weeklyReview, exerciseProgress, daysSinceLastSession } from './stats.js';
import { isoDate } from './dates.js';

export { normalize };

export const SUGGESTIONS = [
  'Que dois-je travailler aujourd’hui ?',
  'Je n’ai que 30 minutes',
  'La machine est occupée',
  'Ma dernière séance était difficile',
  'Que manger ce soir ?',
  'J’ai un petit budget',
  'Bilan de ma semaine',
  'Où ai-je progressé ?',
  'Je reprends après une interruption',
];

// L'ordre compte : la douleur passe toujours en premier (sécurité).
const INTENTS = [
  { id: 'douleur', re: /douleur|j'ai mal|mal (au|a la|aux|a l')|blesse|blessure|\bentorse\b/ },
  { id: 'temps', re: /\b\d+\s?(min|minutes)\b|peu de temps|pas le temps|pas beaucoup de temps/ },
  { id: 'machine', re: /machine|occupe|\bpris(e)?\b par/ },
  { id: 'difficile', re: /difficile|\bdur(e)?\b|epuise|fatigue|creve|trop lourd/ },
  { id: 'reprise', re: /repren|reprise|interruption|apres une pause|apres un arret|longtemps sans/ },
  { id: 'budget', re: /budget|pas cher|econom|argent|moins cher/ },
  { id: 'manger', re: /manger|repas|diner|dejeuner|petit-dej|collation|faim|cuisiner|recette/ },
  { id: 'bilan', re: /bilan|ma semaine|resume de/ },
  { id: 'progres', re: /progress|evolu|ameliore/ },
  { id: 'aujourdhui', re: /aujourd'hui|travailler|quoi faire|seance du jour|programme/ },
];

export function detectIntent(text) {
  const t = normalize(text);
  if (!t) return null;
  return INTENTS.find((i) => i.re.test(t))?.id ?? 'inconnu';
}

const PROFILE_ACTION = { label: 'Compléter mon profil', href: '#/profil' };
const dayLabel = (id) => WEEKDAYS.find((w) => w.id === id)?.label.toLowerCase() ?? id;

function reply(intent, paragraphs, extra = {}) {
  return { intent, paragraphs, missing: [], action: null, basis: [], list: [], after: [], ...extra };
}

function needProfile(intent, what) {
  return reply(intent, [`Pour ${what}, il me manque encore :`], { missing: ['ton profil (objectifs, niveau, disponibilités)'], action: PROFILE_ACTION });
}

function needProgram(intent, what) {
  return reply(intent, [`Pour ${what}, il me manque encore :`], {
    missing: ['ton programme d’entraînement'], action: { label: 'Créer mon programme', href: '#/entrainement' },
  });
}

// Prochaine séance prévue à partir d'aujourd'hui (incluse).
function nextPlanned(program, now) {
  const idx = (now.getDay() + 6) % 7;
  for (let k = 0; k < 7; k++) {
    const day = WEEKDAYS[(idx + k) % 7].id;
    const s = program.sessions.find((x) => x.day === day);
    if (s) return { session: s, inDays: k };
  }
  return null;
}

// ---------- Réponses ----------

function today(data, now) {
  if (!data.profile) return needProfile('aujourdhui', 'te dire quoi travailler aujourd’hui');
  if (!data.program) return needProgram('aujourdhui', 'te dire quoi travailler aujourd’hui');
  if (data.activeSession) {
    return reply('aujourdhui', ['Tu as une séance en cours : reprends-la là où tu en étais.'], { action: { label: 'Reprendre la séance', href: '#/seance' }, basis: ['ta séance en cours'] });
  }
  const doneToday = data.sessions.filter((s) => isoDate(new Date(s.startedAt)) === isoDate(now));
  if (doneToday.length) {
    return reply('aujourdhui', [
      `Tu as déjà fait « ${doneToday[0].name} » aujourd’hui. Bravo !`,
      'Le reste de la journée sert à récupérer : de la marche, un peu de mobilité, un repas avec des protéines et une bonne nuit.',
    ], { basis: ['tes séances réalisées'] });
  }
  const last = data.sessions[0];
  const recentHard = last && (now - new Date(last.startedAt)) / 86400000 < 2 && (last.review?.difficulty >= 9 || last.review?.pain === 'oui');
  const next = nextPlanned(data.program, now);
  const paragraphs = [];
  let action = null;
  const list = [];
  if (next && next.inDays === 0) {
    paragraphs.push(`Aujourd’hui, ton programme prévoit « ${next.session.name} » :`);
    list.push(...next.session.exercises.map((e) => exerciseById(e.ex)?.name ?? e.ex));
    action = { label: 'Démarrer cette séance', start: next.session.id };
  } else if (next) {
    paragraphs.push(`Aujourd’hui est un jour de repos dans ton programme. Prochaine séance : « ${next.session.name} », ${next.inDays === 1 ? 'demain' : dayLabel(next.session.day)}.`);
    paragraphs.push('Le repos fait partie de la progression. Si tu as envie de bouger : marche, vélo tranquille ou mobilité.');
  }
  const after = [];
  if (recentHard) {
    after.push(last.review?.pain === 'oui'
      ? 'Tu as signalé une douleur lors de ta dernière séance : va doucement, évite les exercices qui la réveillent, et arrête en cas de douleur.'
      : 'Ta dernière séance a été très difficile : garde des charges modérées aujourd’hui.');
  }
  return reply('aujourdhui', paragraphs, { action, list, after, basis: ['ton programme', 'tes séances réalisées'] });
}

function shortSession(text, data, now) {
  if (!data.profile) return needProfile('temps', 'te proposer une séance courte adaptée');
  if (!data.program) return needProgram('temps', 'te proposer une séance courte adaptée');
  const minutes = Number(normalize(text).match(/(\d+)\s?min/)?.[1]) || 30;
  const next = nextPlanned(data.program, now);
  const session = next?.session ?? data.program.sessions[0];
  const count = Math.max(2, Math.min(session.exercises.length, Math.floor(minutes / 9)));
  // On garde d'abord les gros mouvements (polyarticulaires), dans l'ordre de la séance.
  const kept = [...session.exercises]
    .map((e, i) => ({ e, i, compose: exerciseById(e.ex)?.kind === 'compose' ? 1 : 0 }))
    .sort((a, b) => (b.compose - a.compose) || (a.i - b.i))
    .slice(0, count)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.e);
  return reply('temps', [
    `Avec ${minutes} minutes, voici une version courte de « ${session.name} » : ${count} exercices, en priorité les mouvements principaux. Fais 2 séries par exercice avec environ 1 minute de repos.`,
  ], {
    list: kept.map((e) => exerciseById(e.ex)?.name ?? e.ex),
    after: ['Échauffe-toi 3 à 5 minutes (vélo, mobilité) avant de commencer.'],
    action: { label: 'Démarrer la version courte', start: session.id, only: kept.map((e) => e.ex) },
    basis: ['ton programme'],
  });
}

function machine(data) {
  const general = 'Tu peux demander poliment combien de séries il reste, ou faire l’exercice suivant puis revenir.';
  if (data.activeSession) {
    const item = data.activeSession.exercises[data.activeSession.current ?? 0];
    const ex = item && exerciseById(item.ex);
    if (ex) {
      const alts = [ex.easier, ...ex.replacements].filter(Boolean).map(exerciseById)
        .filter((r) => r && (!data.gym || isAvailable(r, data.gym)));
      return reply('machine', [
        `Pour « ${ex.name} » : ${general.charAt(0).toLowerCase() + general.slice(1)}`,
        alts.length ? 'Remplacements possibles avec les équipements de ta salle :' : 'Aucun remplacement disponible avec les équipements cochés dans ta salle.',
      ], {
        list: alts.map((r) => r.name),
        after: ['Dans la séance, le bouton « Machine occupée » fait le remplacement pour toi.'],
        action: { label: 'Retour à la séance', href: '#/seance' },
        basis: ['ta séance en cours', 'les équipements de ta salle'],
      });
    }
  }
  return reply('machine', [
    general,
    'Pendant une séance, le bouton « Machine occupée » de chaque exercice te propose un remplacement qui travaille les mêmes muscles, avec le matériel de ta salle.',
  ]);
}

function hard(data) {
  const last = data.sessions[0];
  if (!last) {
    return reply('difficile', ['Pour analyser ta dernière séance, il me manque encore :'], {
      missing: ['au moins une séance réalisée et enregistrée'],
      after: ['Une séance difficile, ça arrive, et ce n’est pas un échec.'],
    });
  }
  const r = last.review || {};
  const doneSets = last.exercises.reduce((n, e) => n + e.sets.length, 0);
  const plannedSets = last.exercises.reduce((n, e) => n + Math.max(e.target?.sets ?? 0, e.sets.length), 0);
  const p = [
    `Ta dernière séance (« ${last.name} ») : ${doneSets} série${doneSets > 1 ? 's' : ''} sur ${plannedSets} prévue${plannedSets > 1 ? 's' : ''}${r.difficulty ? `, difficulté ressentie ${r.difficulty}/10` : ''}${r.energy ? `, énergie ${r.energy}` : ''}.`,
    'Une séance difficile n’est pas un échec : le sommeil, le stress ou l’alimentation de la veille jouent beaucoup.',
  ];
  if (r.pain === 'oui') p.push('Tu as signalé une douleur : n’augmente pas les charges sur les exercices concernés. Si elle persiste, consulte un professionnel de santé.');
  else if (r.difficulty >= 9) p.push('La prochaine fois, garde les mêmes charges ou allège d’environ 10 % : les suggestions pendant la séance en tiendront compte.');
  else p.push('Tes charges semblent adaptées : garde-les et vise la même qualité de mouvement.');
  if (r.energy === 'basse' || data.profile?.data.profil?.recuperation === 'mal') p.push('Ton énergie ou ta récupération sont basses : une nuit plus longue et un repas avec des glucides et des protéines avant la séance peuvent aider.');
  return reply('difficile', p, { basis: ['ta dernière séance enregistrée', 'ton ressenti'] });
}

const PROTEIN_TAGS = ['volaille', 'viande', 'poisson', 'oeufs', 'soja', 'crustaces'];
const PROTEIN_WORDS = ['lentille', 'pois chiche', 'haricots rouges', 'skyr', 'fromage blanc', 'tofu'];
const isProteinRich = (idea) => idea.ingredients.some((i) => i.tags.some((t) => PROTEIN_TAGS.includes(t)) || PROTEIN_WORDS.some((w) => normalize(i.name).includes(w)));

function eat(data, now) {
  if (!data.profile) {
    return reply('manger', ['Pour te proposer une idée de repas qui te convient, il me manque encore :'], {
      missing: ['tes préférences alimentaires, allergies et contraintes'], action: PROFILE_ACTION,
    });
  }
  const alim = data.profile.data.alimentation ?? {};
  const trainedToday = data.sessions.some((s) => isoDate(new Date(s.startedAt)) === isoDate(now));
  let { ideas } = filterIdeas(alim, { moment: trainedToday ? 'apres' : 'repas' });
  if (!ideas.length) ({ ideas } = filterIdeas(alim, { moment: 'repas' }));
  const entries = data.journal?.[isoDate(now)] ?? [];
  const t = totals(entries);
  const p = [];
  const basis = ['tes allergies et préférences'];
  if (entries.length && t.prot.unknown === 0 && data.targets?.prot && t.prot.value < data.targets.prot[0] * 0.6) {
    ideas = [...ideas.filter(isProteinRich), ...ideas.filter((i) => !isProteinRich(i))];
    p.push(`D’après ton journal, tu as mangé environ ${Math.round(t.prot.value)} g de protéines aujourd’hui : une idée riche en protéines serait utile ce soir.`);
    basis.push('ton journal du jour', 'tes repères');
  } else if (trainedToday) {
    p.push('Tu t’es entraîné·e aujourd’hui : un repas avec des protéines et des glucides aide à récupérer.');
    basis.push('ta séance du jour');
  }
  if (!alim.allergies?.length) p.push('Attention : tes allergies ne sont pas renseignées, vérifie les ingrédients.');
  p.push(ideas.length ? 'Quelques idées compatibles avec ton profil :' : 'Je n’ai aucune idée compatible avec toutes tes contraintes.');
  return reply('manger', p, {
    list: ideas.slice(0, 3).map((i) => `${i.name} (${i.time ? i.time + ' min' : 'sans préparation'})`),
    action: { label: 'Voir toutes les idées', href: '#/idees' },
    basis,
  });
}

const CHEAP_PROTEINS = [
  { name: 'Œufs', tags: ['oeufs'] },
  { name: 'Lentilles, pois chiches, haricots secs', tags: [] },
  { name: 'Sardines ou thon en boîte', tags: ['poisson'] },
  { name: 'Fromage blanc ou yaourt nature', tags: ['lait'] },
  { name: 'Tofu', tags: ['soja'] },
  { name: 'Cuisses ou pilons de poulet', tags: ['volaille', 'viande'] },
];

function budget(data) {
  if (!data.profile) {
    return reply('budget', ['Pour te proposer des idées économiques qui respectent tes goûts et contraintes, il me manque encore :'], {
      missing: ['tes préférences alimentaires, allergies et contraintes'], action: PROFILE_ACTION,
    });
  }
  const alim = data.profile.data.alimentation ?? {};
  const allergyTag = { lactose: 'lait', oeufs: 'oeufs', poisson: 'poisson', soja: 'soja' };
  const blocked = new Set((alim.allergies ?? []).map((a) => allergyTag[a]).filter(Boolean));
  const regime = alim.regime ?? [];
  if (regime.includes('vegetarien') || regime.includes('vegetalien')) ['viande', 'poisson', 'volaille'].forEach((t) => blocked.add(t));
  if (regime.includes('vegetalien')) ['oeufs', 'lait'].forEach((t) => blocked.add(t));
  if (regime.includes('pescetarien')) ['viande', 'volaille'].forEach((t) => blocked.add(t));
  const sources = CHEAP_PROTEINS.filter((s) => !s.tags.some((t) => blocked.has(t)));
  const cheap = filterIdeas(alim).ideas.filter((i) => i.budget === 1).slice(0, 3);
  const after = ['Astuces : légumes surgelés (aussi nutritifs que frais), féculents en grand paquet, cuisiner en double pour le lendemain.'];
  if (cheap.length) after.push(`Idées de repas petit budget : ${cheap.map((i) => i.name).join(' · ')}.`);
  return reply('budget', ['Sources de protéines économiques compatibles avec ton profil :'], {
    list: sources.map((s) => s.name), after, action: { label: 'Voir les idées de repas', href: '#/idees' }, basis: ['tes allergies et préférences'],
  });
}

function week(data, now) {
  const r = weeklyReview(data, now);
  if (!r.enoughData) {
    return reply('bilan', ['Pour faire le bilan de ta semaine, il me manque encore :'], {
      missing: ['au moins une séance réalisée ou un repas enregistré cette semaine'],
    });
  }
  const list = [...r.wins];
  if (r.planned !== null) list.push(`${r.sessions.length} séance${r.sessions.length > 1 ? 's' : ''} sur ${r.planned} prévue${r.planned > 1 ? 's' : ''} dans ton programme.`);
  if (r.difficulty !== null) list.push(`Difficulté moyenne ressentie : ${frNumber(r.difficulty)}/10.`);
  if (r.nutrition.avgKcal !== null) list.push(`Énergie moyenne sur ${r.nutrition.completeDays} jours complets : ${Math.round(r.nutrition.avgKcal)} kcal.`);
  else if (r.nutrition.loggedDays) list.push('Pas assez de jours complets (3 minimum) pour une moyenne alimentaire fiable.');
  return reply('bilan', ['Bilan de ta semaine, calculé maintenant à partir de tes données :'], {
    list, after: [...r.watch, ...r.next], action: { label: 'Voir mes statistiques', href: '#/progression' }, basis: ['tes séances', 'ton journal alimentaire'],
  });
}

function progress(data) {
  const prog = exerciseProgress(data.sessions);
  if (!prog.length) {
    return reply('progres', ['Pour mesurer tes progrès, il me manque encore :'], {
      missing: ['au moins deux séances enregistrées sur un même exercice'],
      after: ['Au début, les progrès se voient surtout dans l’aisance et la technique : c’est normal.'],
    });
  }
  const up = prog.filter((x) => x.change > 0.01);
  if (!up.length) {
    return reply('progres', [
      `J’ai comparé ${prog.length} exercice${prog.length > 1 ? 's' : ''} faits plusieurs fois : pas encore de hausse mesurable.`,
      'C’est fréquent sur quelques semaines : la régularité finit par payer.',
    ], { basis: ['tes séances enregistrées'] });
  }
  const fmt = (b) => (b.weight ? `${frNumber(b.weight)} kg × ${b.value}` : `${b.value}`);
  return reply('progres', ['Progrès mesurés entre ta première et ta dernière fois :'], {
    list: up.slice(0, 5).map((x) => `${x.name} : ${fmt(x.first)} → ${fmt(x.last)} (${x.times} séances)`),
    after: ['La comparaison utilise la meilleure série de chaque séance.'],
    action: { label: 'Voir les graphiques', href: '#/progression' },
    basis: ['tes séances enregistrées'],
  });
}

function comeback(data, now) {
  const days = daysSinceLastSession(data.sessions, now);
  if (days === null) {
    return reply('reprise', [
      'Je n’ai encore aucune séance enregistrée : on part de zéro, sans pression.',
      'Pour les premières séances, choisis des charges légères et garde 2 à 3 répétitions en réserve.',
    ], { action: data.program ? { label: 'Voir mon programme', href: '#/entrainement' } : PROFILE_ACTION });
  }
  if (days < 10) {
    return reply('reprise', [`Ta dernière séance date de ${days} jour${days > 1 ? 's' : ''} : pas besoin d’adapter, reprends normalement.`], { basis: ['tes séances enregistrées'] });
  }
  return reply('reprise', [
    `Ta dernière séance date de ${days} jours. Bienvenue de retour, c’est ça qui compte !`,
    days > 21
      ? 'Pour la première semaine : environ 20 % plus léger que tes dernières charges, une série de moins par exercice, et pas d’effort maximal.'
      : 'Pour la première séance : environ 10 % plus léger que tes dernières charges.',
    'Les suggestions affichées pendant la séance tiennent déjà compte de ta pause.',
  ], { action: data.program ? { label: 'Voir mon programme', href: '#/entrainement' } : null, basis: ['tes séances enregistrées'] });
}

// data = { profile, program, sessions, journal, activeSession, gym, targets } — uniquement ce qui est enregistré.
// profile = profil VALIDÉ ({ data: { profil, objectifs, … } }), jamais le brouillon.
export function coachReply(text, data = {}, now = new Date()) {
  const intent = detectIntent(text);
  if (!intent) return null;
  const d = { sessions: [], journal: {}, ...data };
  d.sessions = [...d.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  let r;
  switch (intent) {
    case 'douleur':
      r = reply(intent, [
        'Si tu ressens une douleur inquiétante, arrête l’exercice. Ne force pas pour finir la série.',
        'Je ne peux pas poser de diagnostic. Si la douleur est vive, inhabituelle ou qu’elle persiste, consulte un professionnel de santé (médecin, kiné).',
      ]);
      break;
    case 'aujourdhui': r = today(d, now); break;
    case 'temps': r = shortSession(text, d, now); break;
    case 'machine': r = machine(d); break;
    case 'difficile': r = hard(d); break;
    case 'manger': r = eat(d, now); break;
    case 'budget': r = budget(d); break;
    case 'bilan': r = week(d, now); break;
    case 'progres': r = progress(d); break;
    case 'reprise': r = comeback(d, now); break;
    default:
      r = reply('inconnu', [
        'Je ne sais pas encore répondre à cette question. Je ne suis pas une IA : je réponds à des questions précises, à partir de tes données.',
        'Essaie une des suggestions ci-dessous.',
      ], { showSuggestions: true });
  }
  // Ton choisi dans le profil : un mot d'encouragement si « doux ».
  if (d.profile?.data.motivation?.ton === 'doux' && !['douleur', 'inconnu'].includes(intent) && !r.missing.length) {
    r.after = [...r.after, 'Tu avances à ton rythme, et c’est très bien.'];
  }
  return r;
}
