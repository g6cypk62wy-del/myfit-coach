// Ajouter un aliment à un repas (#/ajouter/<date>/<repas>).

import { pageHeader, icon, esc, toast, openSheet } from '../ui.js';
import { longDate, fromIso } from '../dates.js';
import {
  loadCiqual, searchFoods, searchOpenFoodFacts, readPer100, energyEstimate, CIQUAL_CREDIT, OFF_CREDIT,
} from '../nutrition/foods.js';
import { MEALS, UNITS, addEntry, entryNutrients, getRecipes, addRecipeToMeal, deleteRecipe } from '../nutrition/journal.js';
import { frNumber, parseFr } from '../text.js';

export const title = 'Ajouter un aliment';
export const hideTabbar = true;

let tab = 'chercher';

export function render(root, ctx) {
  const { store } = ctx;
  const [date, mealId] = ctx.params;
  const meal = MEALS.find((m) => m.id === mealId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !meal) { location.replace('#/nutrition'); return; }
  const back = '#/nutrition';
  let selected = null; // aliment choisi (Ciqual ou OFF)
  let offResults = null;
  let offState = 'idle'; // idle | loading | error | done
  let query = '';
  let controller = null;

  root.innerHTML = `
    ${pageHeader({ title: `Ajouter ${meal.to}`, eyebrow: longDate(fromIso(date)), back })}
    <div class="segmented" role="tablist">
      ${[['chercher', 'Chercher'], ['recettes', 'Recettes'], ['libre', 'Saisie libre']].map(([id, l]) => `<button type="button" role="tab" aria-selected="${tab === id}" class="${tab === id ? 'on' : ''}" data-tab="${id}">${l}</button>`).join('')}
    </div>
    <div id="pane" class="block-gap"></div>`;
  const pane = root.querySelector('#pane');

  // ---------- Chercher ----------
  function drawSearch() {
    if (selected) return drawQuantity();
    pane.innerHTML = `
      <label class="sr-only" for="food-q">Nom de l’aliment</label>
      <input id="food-q" class="input" type="search" placeholder="ex. riz cuit, banane, poulet…" value="${esc(query)}" autocomplete="off" enterkeyhint="search">
      <div id="results" aria-live="polite"></div>`;
    const input = pane.querySelector('#food-q');
    input.addEventListener('input', () => { query = input.value; offResults = null; offState = 'idle'; drawResults(); });
    drawResults();
    if (!query) input.focus();
  }

  async function drawResults() {
    const box = pane.querySelector('#results');
    if (!box) return;
    if (query.trim().length < 2) {
      box.innerHTML = `<p class="hint">Tape au moins 2 lettres. Base utilisée : Ciqual (ANSES), valeurs moyennes pour 100 g.</p>`;
      return;
    }
    box.innerHTML = '<div class="loading-row"><span class="spinner small"></span> Chargement de la base Ciqual…</div>';
    let foods;
    try {
      foods = await loadCiqual();
    } catch {
      box.innerHTML = `<p class="note note-warn">${icon('info')}<span>La base Ciqual n’a pas pu être chargée. Vérifie ta connexion, ou utilise la saisie libre.</span></p>`;
      return;
    }
    if (pane.querySelector('#results') !== box) return;
    const results = searchFoods(foods, query, 25);
    const item = (f, i, src) => {
      const k = readPer100(f.per100.kcal);
      const est = k.value === null ? energyEstimate(f.per100) : null;
      return `<button type="button" class="row-link" data-pick="${src}:${i}">
        <span class="row-text"><span class="row-title">${esc(f.name)}</span><span class="row-sub">${esc(f.group)}</span></span>
        <span class="entry-kcal">${k.value !== null ? `${Math.round(k.value)} kcal` : est !== null ? `≈ ${est} kcal` : '<span class="unknown">kcal ?</span>'}<small>/100 g</small></span>
      </button>`;
    };
    box.innerHTML = `
      ${results.length ? `<div class="card list block-gap">${results.map((f, i) => item(f, i, 'c')).join('')}</div>` : '<p class="hint block-gap">Aucun aliment Ciqual ne correspond. Essaie un autre mot, cherche un produit de marque, ou utilise la saisie libre.</p>'}
      <div class="block">
        <h2 class="block-title">Produits de marque</h2>
        ${offState === 'idle' ? `<button type="button" class="btn btn-ghost btn-block" data-act="off">Chercher « ${esc(query)} » dans Open Food Facts</button><p class="hint">Nécessite Internet. Données collaboratives : à vérifier sur l’emballage.</p>` : ''}
        ${offState === 'loading' ? '<div class="loading-row"><span class="spinner small"></span> Recherche en cours…</div>' : ''}
        ${offState === 'error' ? `<p class="note note-warn">${icon('info')}<span>Open Food Facts ne répond pas (pas de connexion, ou trop de recherches d’affilée). Réessaie dans un instant.</span></p><button type="button" class="btn btn-ghost btn-block" data-act="off">Réessayer</button>` : ''}
        ${offState === 'done' ? (offResults.length ? `<div class="card list">${offResults.map((f, i) => item(f, i, 'o')).join('')}</div>` : '<p class="hint">Aucun produit trouvé.</p>') : ''}
      </div>
      <p class="hint">${CIQUAL_CREDIT}</p>`;
    box._results = results;
  }

  async function searchOff() {
    offState = 'loading';
    drawResults();
    controller?.abort();
    controller = new AbortController();
    try {
      offResults = await searchOpenFoodFacts(query, { signal: controller.signal });
      offState = 'done';
    } catch (e) {
      if (e.name === 'AbortError') return;
      offState = 'error';
    }
    drawResults();
  }

  // ---------- Quantité ----------
  function drawQuantity() {
    const f = selected;
    const portionHint = f.serving ? `Portion indiquée sur l’emballage : ${esc(f.serving)}` : '';
    pane.innerHTML = `
      <div class="card">
        <p class="row-title">${esc(f.name)}</p>
        <p class="row-sub">${f.source === 'ciqual' ? 'Ciqual (ANSES) · valeurs moyennes' : 'Open Food Facts · à vérifier sur l’emballage'}</p>
      </div>
      <div class="qty-row block-gap">
        <label class="field"><span class="field-label small">Quantité</span>
          <input class="input" id="qty" type="text" inputmode="decimal" value="100" autocomplete="off"></label>
        <label class="field"><span class="field-label small">Unité</span>
          <select class="input" id="unit">${Object.entries(UNITS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      </div>
      <label class="field block-gap" id="portion-wrap" hidden><span class="field-label small">Poids d’une portion en grammes (si tu le connais)</span>
        <input class="input" id="portion" type="text" inputmode="decimal" placeholder="ex. 30" autocomplete="off">
        ${portionHint ? `<span class="field-hint">${portionHint}</span>` : ''}</label>
      <div class="card kv-card flat block-gap" id="preview" aria-live="polite"></div>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost" data-act="cancel-pick">Changer</button>
        <button type="button" class="btn btn-primary" data-act="add">Ajouter</button>
      </div>`;
    const update = () => {
      const unit = pane.querySelector('#unit').value;
      pane.querySelector('#portion-wrap').hidden = unit !== 'portion';
      const q = parseFr(pane.querySelector('#qty').value);
      const pg = parseFr(pane.querySelector('#portion').value);
      const prev = pane.querySelector('#preview');
      if (!q || Number.isNaN(q)) { prev.innerHTML = '<p class="row-sub pad">Indique une quantité.</p>'; return; }
      const v = entryNutrients({ source: f.source, per100: f.per100, quantity: q, unit, portionGrams: Number.isNaN(pg) ? null : pg });
      const fmt = (n, x) => (x.value === null ? '<span class="unknown">inconnu</span>' : `${n === 'kcal' ? Math.round(x.value) + ' kcal' : frNumber(x.value) + ' g'}${x.status === 'estime' ? ' (estimé)' : x.status === 'approx' ? ' (traces)' : ''}`);
      prev.innerHTML = [['kcal', 'Énergie'], ['prot', 'Protéines'], ['gluc', 'Glucides'], ['lip', 'Lipides']]
        .map(([n, l]) => `<div class="kv"><span>${l}</span><span>${fmt(n, v[n])}</span></div>`).join('')
        + (unit === 'ml' ? '<p class="hint pad">Estimation : 1 ml compté comme 1 g.</p>' : '')
        + (unit === 'portion' && (!pg || Number.isNaN(pg)) ? '<p class="hint pad">Sans le poids de la portion, les valeurs restent inconnues.</p>' : '');
    };
    pane.querySelector('#qty').addEventListener('input', update);
    pane.querySelector('#unit').addEventListener('change', update);
    pane.querySelector('#portion').addEventListener('input', update);
    update();
    pane.querySelector('#qty').select();
  }

  function addSelected() {
    const q = parseFr(pane.querySelector('#qty').value);
    const unit = pane.querySelector('#unit').value;
    const pg = parseFr(pane.querySelector('#portion').value);
    if (!q || Number.isNaN(q) || q <= 0) { toast('Indique une quantité valide.', 'error'); return; }
    if (pg !== null && (Number.isNaN(pg) || pg <= 0)) { toast('Poids de portion invalide.', 'error'); return; }
    const f = selected;
    const ok = addEntry(store, date, meal.id, {
      source: f.source, ref: f.ref, name: f.name, per100: f.per100, quantity: q, unit, portionGrams: unit === 'portion' ? pg : null,
    });
    if (!ok) { toast('Enregistrement impossible sur cet appareil.', 'error'); return; }
    toast(`${f.name.split(',')[0]} ajouté.`);
    ctx.navigate(back);
  }

  // ---------- Recettes ----------
  function drawRecipes() {
    const recipes = getRecipes(store);
    pane.innerHTML = recipes.length ? `
      <div class="card list">${recipes.map((r) => `
        <div class="recipe-row">
          <button type="button" class="row-link" data-recipe="${r.id}">
            <span class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${r.items.length} aliment${r.items.length > 1 ? 's' : ''} · ${r.items.map((i) => esc(i.name.split(',')[0])).slice(0, 3).join(', ')}</span></span>
            <span class="row-ico">${icon('plus')}</span>
          </button>
          <button type="button" class="link-btn danger-text" data-del-recipe="${r.id}">Supprimer</button>
        </div>`).join('')}</div>`
      : `<div class="card"><p class="empty-title">Aucune recette favorite</p><p class="empty-text">Dans le journal, ouvre le menu « ⋯ » d’un repas pour l’enregistrer comme recette.</p></div>`;
  }

  // ---------- Saisie libre ----------
  function drawFree() {
    pane.innerHTML = `
      <p class="hint">Pour un plat sans équivalent dans la base. Les valeurs nutritionnelles sont facultatives : si tu ne les connais pas, elles resteront « inconnues ».</p>
      <label class="field block-gap"><span class="field-label">Nom</span><input class="input" id="free-name" maxlength="80" placeholder="ex. Couscous chez Mamie"></label>
      <label class="field block-gap"><span class="field-label">Quantité (texte libre)</span><input class="input" id="free-qty" maxlength="40" placeholder="ex. 1 grande assiette"></label>
      <fieldset class="field block-gap"><legend class="field-label">Valeurs, si tu les connais <span class="tag">Facultatif</span></legend>
        <div class="free-grid">
          ${[['kcal', 'Énergie (kcal)'], ['prot', 'Protéines (g)'], ['gluc', 'Glucides (g)'], ['lip', 'Lipides (g)']].map(([n, l]) => `<label class="field"><span class="field-label small">${l}</span><input class="input" data-free="${n}" type="text" inputmode="decimal" autocomplete="off"></label>`).join('')}
        </div>
      </fieldset>
      <button type="button" class="btn btn-primary btn-block" data-act="add-free">Ajouter</button>`;
  }

  function addFree() {
    const name = pane.querySelector('#free-name').value.trim();
    if (!name) { toast('Indique un nom.', 'error'); pane.querySelector('#free-name').focus(); return; }
    const userValues = {};
    for (const input of pane.querySelectorAll('[data-free]')) {
      const v = parseFr(input.value);
      if (v === null) continue;
      if (Number.isNaN(v) || v < 0 || v > 5000) { toast('Une valeur n’est pas un nombre valide.', 'error'); input.focus(); return; }
      userValues[input.dataset.free] = v;
    }
    const ok = addEntry(store, date, meal.id, { source: 'libre', name, quantityText: pane.querySelector('#free-qty').value.trim(), userValues });
    if (!ok) { toast('Enregistrement impossible.', 'error'); return; }
    toast(`${name} ajouté.`);
    ctx.navigate(back);
  }

  function drawPane() {
    root.querySelectorAll('[data-tab]').forEach((b) => { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    if (tab === 'chercher') drawSearch();
    else if (tab === 'recettes') drawRecipes();
    else drawFree();
  }
  drawPane();

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; selected = null; drawPane(); return; }
    const pick = e.target.closest('[data-pick]')?.dataset.pick;
    if (pick) {
      const [src, i] = pick.split(':');
      selected = src === 'c' ? pane.querySelector('#results')._results[Number(i)] : offResults[Number(i)];
      drawQuantity();
      return;
    }
    const recipe = e.target.closest('[data-recipe]')?.dataset.recipe;
    if (recipe) {
      const n = addRecipeToMeal(store, recipe, date, meal.id);
      toast(n ? `Recette ajoutée (${n} aliment${n > 1 ? 's' : ''}).` : 'Ajout impossible.', n ? 'info' : 'error');
      if (n) ctx.navigate(back);
      return;
    }
    const del = e.target.closest('[data-del-recipe]')?.dataset.delRecipe;
    if (del) {
      const r = getRecipes(store).find((x) => x.id === del);
      openSheet({
        title: 'Supprimer la recette ?',
        body: `<p>« ${esc(r?.name ?? '')} » sera retirée de tes favoris. Les repas déjà notés ne changent pas.</p>`,
        actions: [
          { label: 'Annuler', kind: 'ghost' },
          { label: 'Supprimer', kind: 'danger', onClick: () => { deleteRecipe(store, del); toast('Recette supprimée.'); drawRecipes(); } },
        ],
      });
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'off') searchOff();
    else if (act === 'add') addSelected();
    else if (act === 'cancel-pick') { selected = null; drawSearch(); }
    else if (act === 'add-free') addFree();
  });

  return () => controller?.abort();
}

export { OFF_CREDIT };
