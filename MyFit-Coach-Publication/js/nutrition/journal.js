// Journal alimentaire : calculs à partir des entrées RÉELLES.
// On distingue toujours : valeur de la base · valeur estimée · valeur saisie par toi · inconnue.

import { NUTRIENTS, readPer100, energyEstimate } from './foods.js';
import { uid } from '../text.js';

export const MEALS = [
  { id: 'petit-dejeuner', label: 'Petit-déjeuner', to: 'au petit-déjeuner' },
  { id: 'dejeuner', label: 'Déjeuner', to: 'au déjeuner' },
  { id: 'diner', label: 'Dîner', to: 'au dîner' },
  { id: 'collations', label: 'Collations', to: 'aux collations' },
  { id: 'boissons', label: 'Boissons', to: 'aux boissons' },
];

export const UNITS = { g: 'g', ml: 'ml', portion: 'portion(s)' };

// Grammes réellement mangés. ml → g en supposant 1 ml ≈ 1 g (estimation signalée).
export function gramsOf(entry) {
  if (entry.unit === 'g') return { grams: entry.quantity, estimated: false };
  if (entry.unit === 'ml') return { grams: entry.quantity, estimated: true, note: '1 ml compté comme 1 g' };
  if (entry.unit === 'portion' && entry.portionGrams) return { grams: entry.quantity * entry.portionGrams, estimated: false };
  return { grams: null, estimated: false };
}

// Valeurs d'une entrée : { kcal: { value, status, note? }, … }
// status : 'base' | 'estime' | 'saisi' | 'approx' | 'inconnu'
export function entryNutrients(entry) {
  const out = {};
  if (entry.source === 'libre') {
    for (const n of NUTRIENTS) {
      const v = entry.userValues?.[n];
      out[n] = typeof v === 'number' ? { value: v, status: 'saisi' } : { value: null, status: 'inconnu' };
    }
    return out;
  }
  const { grams, estimated, note } = gramsOf(entry);
  for (const n of NUTRIENTS) {
    if (grams === null) { out[n] = { value: null, status: 'inconnu', note: 'poids de la portion inconnu' }; continue; }
    const r = readPer100(entry.per100?.[n]);
    if (r.value === null && n === 'kcal') {
      const est = energyEstimate(entry.per100 || {});
      out[n] = est === null
        ? { value: null, status: 'inconnu' }
        : { value: (est * grams) / 100, status: 'estime', note: 'calculée à partir des protéines, glucides et lipides' };
      continue;
    }
    if (r.value === null) { out[n] = { value: null, status: 'inconnu' }; continue; }
    out[n] = {
      value: (r.value * grams) / 100,
      status: estimated ? 'estime' : r.status,
      note: [note && estimated ? note : null, r.note].filter(Boolean).join(' · ') || undefined,
    };
  }
  return out;
}

// Totaux du jour : somme des valeurs connues + nombre d'entrées dont la valeur est inconnue.
export function totals(entries) {
  const out = {};
  for (const n of NUTRIENTS) out[n] = { value: 0, unknown: 0, estimated: 0, count: 0 };
  for (const e of entries) {
    const v = entryNutrients(e);
    for (const n of NUTRIENTS) {
      out[n].count++;
      if (v[n].value === null) out[n].unknown++;
      else {
        out[n].value += v[n].value;
        if (v[n].status === 'estime') out[n].estimated++;
      }
    }
  }
  return out;
}

// ---------- Stockage ----------
// journal : { 'AAAA-MM-JJ': [entrées] } · recipes : [{ id, name, items }]

export function dayEntries(store, date) {
  return store.get('journal', {})[date] ?? [];
}

function writeDay(store, date, entries) {
  const journal = store.get('journal', {});
  if (entries.length) journal[date] = entries;
  else delete journal[date];
  return store.set('journal', journal);
}

export function addEntry(store, date, meal, data) {
  const entry = { ...data, id: uid(), date, meal, createdAt: new Date().toISOString() };
  return writeDay(store, date, [...dayEntries(store, date), entry]) ? entry : null;
}

export function updateEntry(store, date, id, changes) {
  return writeDay(store, date, dayEntries(store, date).map((e) => (e.id === id ? { ...e, ...changes } : e)));
}

export function deleteEntry(store, date, id) {
  return writeDay(store, date, dayEntries(store, date).filter((e) => e.id !== id));
}

const strip = ({ id, date, meal, createdAt, ...rest }) => rest;

// Copie un repas vers une autre date / un autre repas.
export function duplicateMeal(store, fromDate, fromMeal, toDate, toMeal) {
  const items = dayEntries(store, fromDate).filter((e) => e.meal === fromMeal);
  if (!items.length) return 0;
  const copies = items.map((e) => ({ ...strip(e), id: uid(), date: toDate, meal: toMeal, createdAt: new Date().toISOString() }));
  return writeDay(store, toDate, [...dayEntries(store, toDate), ...copies]) ? copies.length : 0;
}

export const getRecipes = (store) => store.get('recipes', []);

export function saveMealAsRecipe(store, date, meal, name) {
  const items = dayEntries(store, date).filter((e) => e.meal === meal).map(strip);
  if (!items.length) return null;
  const recipe = { id: uid(), name: name.trim(), items, createdAt: new Date().toISOString() };
  return store.set('recipes', [...getRecipes(store), recipe]) ? recipe : null;
}

export function addRecipeToMeal(store, recipeId, date, meal) {
  const r = getRecipes(store).find((x) => x.id === recipeId);
  if (!r) return 0;
  const copies = r.items.map((it) => ({ ...it, id: uid(), date, meal, fromRecipe: r.name, createdAt: new Date().toISOString() }));
  return writeDay(store, date, [...dayEntries(store, date), ...copies]) ? copies.length : 0;
}

export function deleteRecipe(store, id) {
  return store.set('recipes', getRecipes(store).filter((r) => r.id !== id));
}

// Jours qui ont au moins une entrée (pour les tendances).
export function journalDays(store) {
  return Object.keys(store.get('journal', {})).sort();
}
