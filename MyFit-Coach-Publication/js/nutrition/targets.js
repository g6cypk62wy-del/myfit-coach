// Estimation de repères nutritionnels. Ce ne sont PAS des chiffres exacts :
// chaque résultat est une fourchette, avec ses hypothèses et ses limites.
// Aucune restriction extrême : jamais en dessous du métabolisme de base estimé.

const PAL = { assise: 1.4, mouvement: 1.6, physique: 1.8 };
const STRENGTH_GOALS = ['muscle', 'recomposition', 'perte-graisse', 'force', 'fessiers-jambes', 'haut-du-corps'];
const round = (x, step) => Math.round(x / step) * step;

// Formule de Mifflin-St Jeor (métabolisme de base, kcal/jour).
export function bmr({ poids, taille, age }, sexe) {
  const base = 10 * poids + 6.25 * taille - 5 * age;
  return sexe === 'h' ? base + 5 : base - 161;
}

// inputs : { poids, taille, age, sexe: 'f' | 'h' | null, activite, seances, goal }
export function estimateTargets(inputs) {
  const missing = [];
  if (!inputs.poids) missing.push('ton poids');
  if (!inputs.taille) missing.push('ta taille');
  if (!inputs.age) missing.push('ton âge');
  if (missing.length) return { missing };

  const sexes = inputs.sexe ? [inputs.sexe] : ['f', 'h'];
  const bmrs = sexes.map((s) => bmr(inputs, s));
  const bmrMin = Math.min(...bmrs);
  const bmrMax = Math.max(...bmrs);
  const pal = Math.min(2.0, (PAL[inputs.activite] ?? 1.5) + 0.025 * (Number(inputs.seances) || 0));
  // ±8 % : les formules se trompent souvent de cet ordre pour une personne donnée.
  const tdee = [bmrMin * pal * 0.92, bmrMax * pal * 1.08];

  let adj = [1, 1];
  let goalText = 'maintien du poids';
  if (inputs.goal === 'perte-graisse') { adj = [0.85, 0.9]; goalText = 'perte de graisse progressive (−10 à −15 %)'; }
  else if (inputs.goal === 'muscle') { adj = [1.05, 1.1]; goalText = 'prise de muscle (+5 à +10 %)'; }
  else if (inputs.goal === 'recomposition') { adj = [0.95, 1]; goalText = 'recomposition (léger déficit ou maintien)'; }

  let kcal = [round(tdee[0] * adj[0], 50), round(tdee[1] * adj[1], 50)];
  const floor = round(bmrMax, 50);
  const floored = kcal[0] < floor;
  kcal = [Math.max(kcal[0], floor), Math.max(kcal[1], floor)];

  const perKg = STRENGTH_GOALS.includes(inputs.goal) ? [1.6, 2.0] : [1.2, 1.6];
  const prot = [round(inputs.poids * perKg[0], 5), round(inputs.poids * perKg[1], 5)];

  const assumptions = [
    `Métabolisme de base estimé avec la formule de Mifflin-St Jeor : ${round(bmrMin, 10)}${bmrMax !== bmrMin ? `–${round(bmrMax, 10)}` : ''} kcal/jour.`,
    inputs.sexe ? 'Calcul fait avec le sexe que tu as choisi pour l’estimation.' : 'Sexe non indiqué : la fourchette couvre les deux formules, elle est donc plus large.',
    `Niveau d’activité estimé : × ${String(pal.toFixed(2)).replace('.', ',')} (activité quotidienne + ${Number(inputs.seances) || 0} séance(s) par semaine).`,
    `Objectif pris en compte : ${goalText}.`,
    `Protéines : ${String(perKg[0]).replace('.', ',')} à ${String(perKg[1]).replace('.', ',')} g par kg de poids corporel.`,
  ];
  const limits = [
    'Ce sont des estimations statistiques : ton besoin réel peut être 10 à 15 % différent.',
    'Le meilleur indicateur reste l’évolution de ton énergie, de tes performances et de tes mesures sur plusieurs semaines.',
    'Ces repères ne remplacent pas l’avis d’un·e diététicien·ne, en particulier en cas de problème de santé.',
  ];
  if (floored) limits.unshift('Le repère a été relevé pour ne jamais descendre sous ton métabolisme de base estimé.');

  return { kcal, prot, bmr: [round(bmrMin, 10), round(bmrMax, 10)], pal, assumptions, limits };
}

// Objectif principal utile au calcul : la première priorité parmi celles qui changent l'énergie.
export function nutritionGoal(goals = []) {
  return goals.find((g) => ['perte-graisse', 'muscle', 'recomposition'].includes(g)) ?? goals[0] ?? null;
}
