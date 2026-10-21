// Bases alimentaires :
// - Ciqual 2020 (ANSES), embarquée dans l'app (data/ciqual-2020.json), Licence Ouverte.
// - Open Food Facts (produits de marque), interrogée en ligne, données participatives.
// Une valeur absente reste « inconnue » : elle n'est jamais inventée.

import { normalize } from '../text.js';

export const NUTRIENTS = ['kcal', 'prot', 'gluc', 'lip', 'sucres', 'fibres', 'sel'];
export const NUTRIENT_LABELS = {
  kcal: 'Énergie', prot: 'Protéines', gluc: 'Glucides', lip: 'Lipides', sucres: 'dont sucres', fibres: 'Fibres', sel: 'Sel',
};
export const NUTRIENT_UNITS = { kcal: 'kcal', prot: 'g', gluc: 'g', lip: 'g', sucres: 'g', fibres: 'g', sel: 'g' };

export const CIQUAL_CREDIT = 'Anses. 2020. Table de composition nutritionnelle des aliments Ciqual (Licence Ouverte).';
export const OFF_CREDIT = 'Open Food Facts (données collaboratives, licence ODbL) : à vérifier sur l’emballage.';

let ciqual = null;
let loading = null;

// Charge la table Ciqual une seule fois.
export function loadCiqual(url = 'data/ciqual-2020.json') {
  if (ciqual) return Promise.resolve(ciqual);
  if (!loading) {
    loading = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((json) => {
        ciqual = json.foods.map(([code, name, group, values]) => ({
          source: 'ciqual',
          ref: String(code),
          name,
          group,
          key: normalize(name),
          per100: Object.fromEntries(NUTRIENTS.map((n, i) => [n, values[i] ?? null])),
        }));
        return ciqual;
      })
      .catch((e) => {
        loading = null;
        throw e;
      });
  }
  return loading;
}

export function setCiqualForTests(foods) {
  ciqual = foods;
}

// Recherche : tous les mots doivent être présents ; les noms qui commencent par la recherche passent en premier.
export function searchFoods(foods, query, limit = 30) {
  const q = normalize(query).replace(/[^a-z0-9 ]/g, ' ').trim();
  if (q.length < 2) return [];
  const words = q.split(/\s+/);
  const scored = [];
  for (const f of foods) {
    const key = f.key ?? normalize(f.name);
    if (!words.every((w) => key.includes(w))) continue;
    let score = 0;
    if (key.startsWith(words[0])) score += 50;
    if (new RegExp(`\\b${words[0]}`).test(key)) score += 20;
    if (/\bcru\b|\bcuit\b|\bnature\b/.test(key)) score += 3;
    score -= key.length / 10;
    scored.push([score, f]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map((x) => x[1]);
}

// ---------- Open Food Facts ----------

const OFF_FIELDS = {
  kcal: 'energy-kcal_100g', prot: 'proteins_100g', gluc: 'carbohydrates_100g', lip: 'fat_100g',
  sucres: 'sugars_100g', fibres: 'fiber_100g', sel: 'salt_100g',
};

export function mapOffProduct(p) {
  const n = p.nutriments || {};
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
  return {
    source: 'off',
    ref: String(p.code || ''),
    name: [p.product_name, p.brands?.split(',')[0]].filter(Boolean).join(' · ') || 'Produit sans nom',
    group: 'Produit de marque',
    serving: p.serving_size || '',
    per100: Object.fromEntries(Object.entries(OFF_FIELDS).map(([k, f]) => [k, num(n[f])])),
  };
}

export async function searchOpenFoodFacts(query, { signal } = {}) {
  const url = 'https://world.openfoodfacts.org/cgi/search.pl?' + new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '20',
    fields: 'code,product_name,brands,nutriments,serving_size',
  });
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return (j.products || []).filter((p) => p.product_name).map(mapOffProduct);
}

// ---------- Valeurs d'un aliment pour une quantité ----------

// Valeur pour 100 g : nombre, 't' (traces), '<x' (inférieur à x) ou null (inconnu).
// → { value, status } ; status : 'base' | 'approx' (traces ou « < ») | 'inconnu'.
export function readPer100(raw) {
  if (typeof raw === 'number') return { value: raw, status: 'base' };
  if (raw === 't') return { value: 0, status: 'approx', note: 'traces' };
  if (typeof raw === 'string' && raw.startsWith('<')) return { value: 0, status: 'approx', note: `moins de ${raw.slice(1).replace('.', ',')} g` };
  return { value: null, status: 'inconnu' };
}

// Énergie absente de la base : estimation à partir des macronutriments (4/4/9 kcal par g),
// clairement indiquée comme estimée.
export function energyEstimate(per100) {
  const p = readPer100(per100.prot);
  const g = readPer100(per100.gluc);
  const l = readPer100(per100.lip);
  if ([p, g, l].some((x) => x.value === null)) return null;
  return Math.round(p.value * 4 + g.value * 4 + l.value * 9);
}
