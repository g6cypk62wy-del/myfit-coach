// Filtrage des idées de repas selon le profil alimentaire.
// Les allergies, intolérances et préférences sont respectées STRICTEMENT : une idée qui contient
// un ingrédient concerné est masquée, avec la raison.

import { MEAL_IDEAS } from '../data/meal-ideas.js';
import { normalize } from '../text.js';

const ALLERGY_TAG = {
  gluten: 'gluten', lactose: 'lait', arachides: 'arachides', 'fruits-a-coque': 'fruits-a-coque', oeufs: 'oeufs',
  poisson: 'poisson', crustaces: 'crustaces', soja: 'soja', sesame: 'sesame',
};
const ALLERGY_LABEL = {
  gluten: 'gluten', lactose: 'lactose', arachides: 'arachides', 'fruits-a-coque': 'fruits à coque', oeufs: 'œufs',
  poisson: 'poisson', crustaces: 'crustacés', soja: 'soja', sesame: 'sésame',
};

const DIET_EXCLUDES = {
  vegetarien: ['viande', 'volaille', 'porc', 'poisson', 'crustaces'],
  vegetalien: ['viande', 'volaille', 'porc', 'poisson', 'crustaces', 'oeufs', 'lait'],
  pescetarien: ['viande', 'volaille', 'porc'],
  halal: ['porc', 'alcool'],
  casher: ['porc', 'alcool', 'crustaces'],
  'sans-porc': ['porc'],
  'sans-alcool': ['alcool'],
};
const DIET_LABEL = {
  vegetarien: 'végétarien', vegetalien: 'végétalien', pescetarien: 'pescétarien', halal: 'halal', casher: 'casher',
  'sans-porc': 'sans porc', 'sans-alcool': 'sans alcool',
};

// Mots significatifs d'un texte libre (« pas de champignons, ni d'olives » → champignon, olive).
function words(text) {
  return normalize(text)
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !['avec', 'sans', 'pour', 'tres', 'plus', 'aussi', 'mais', 'tout', 'tous', 'aime', 'aiment'].includes(w))
    .map((w) => w.replace(/s$/, ''));
}

export function ideaBlockers(idea, alim = {}) {
  const reasons = [];
  const tags = new Set(idea.ingredients.flatMap((i) => i.tags));
  for (const a of alim.allergies ?? []) {
    if (a !== 'aucune' && tags.has(ALLERGY_TAG[a])) reasons.push(`contient ${ALLERGY_LABEL[a]}`);
  }
  for (const d of alim.regime ?? []) {
    const hit = (DIET_EXCLUDES[d] ?? []).find((t) => tags.has(t));
    if (hit) reasons.push(`non compatible ${DIET_LABEL[d]}`);
  }
  const ingredientText = normalize(idea.ingredients.map((i) => i.name).join(' '));
  for (const w of words(alim.allergiesAutres || '')) {
    if (ingredientText.includes(w)) reasons.push(`contient « ${w} » (contrainte indiquée)`);
  }
  for (const w of words(alim.naimesPas || '')) {
    if (ingredientText.includes(w)) reasons.push(`contient « ${w} », que tu n’aimes pas`);
  }
  return [...new Set(reasons)];
}

// → { ideas: [...compatibles, triées], hidden: [{ idea, reasons }] }
export function filterIdeas(alim = {}, { moment = null, ideas = MEAL_IDEAS } = {}) {
  const ok = [];
  const hidden = [];
  for (const idea of ideas) {
    if (moment && !idea.moments.includes(moment)) continue;
    const reasons = ideaBlockers(idea, alim);
    if (reasons.length) hidden.push({ idea, reasons });
    else ok.push(idea);
  }
  const quick = alim.tempsCuisine === '<15';
  const tight = alim.budget === 'serre';
  const likes = words(alim.aimes || '');
  const score = (i) => {
    let s = 0;
    if (tight) s -= i.budget * 10;
    if (quick) s -= i.time > 15 ? 15 : 0;
    const text = normalize(i.name + ' ' + i.ingredients.map((x) => x.name).join(' '));
    if (likes.some((w) => text.includes(w))) s += 12;
    return s;
  };
  ok.sort((a, b) => score(b) - score(a));
  return { ideas: ok, hidden };
}

// Liste de courses : ingrédients regroupés par nom.
export function shoppingList(ideas) {
  const map = new Map();
  for (const idea of ideas) {
    for (const ing of idea.ingredients) {
      const key = normalize(ing.name);
      const cur = map.get(key) ?? { name: ing.name, qty: [] };
      cur.qty.push(ing.qty);
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export const BUDGET_LABEL = { 1: '€', 2: '€€', 3: '€€€' };
