// Journal alimentaire du jour.

import { pageHeader, profileButton, icon, emptyState, openSheet, closeSheet, toast, esc } from '../ui.js';
import { addDays, relativeDay, longDate, sameDay, isoDate, fromIso } from '../dates.js';
import { NUTRIENT_LABELS } from '../nutrition/foods.js';
import {
  MEALS, UNITS, dayEntries, entryNutrients, totals, updateEntry, deleteEntry, duplicateMeal, saveMealAsRecipe,
} from '../nutrition/journal.js';
import { frNumber, parseFr } from '../text.js';

export const title = 'Nutrition';

const SOURCE_LABEL = { ciqual: 'Ciqual', off: 'Open Food Facts', libre: 'Saisie libre' };
let currentDay = null; // garde le jour choisi en revenant de l'ajout d'un aliment

function kcalText(v) {
  if (v.value === null) return '<span class="unknown">kcal inconnues</span>';
  const approx = v.status === 'estime' ? '≈ ' : '';
  return `${approx}${Math.round(v.value)} kcal`;
}

function totalCell(t, n, target) {
  const unit = n === 'kcal' ? '' : ' g';
  const val = n === 'kcal' ? Math.round(t[n].value) : frNumber(t[n].value, 0);
  const partial = t[n].unknown > 0;
  return `
    <div class="tot">
      <span class="tot-label">${NUTRIENT_LABELS[n]}</span>
      <span class="tot-value">${t[n].count ? `${partial ? '≥ ' : ''}${val}${unit}` : '—'}</span>
      ${target ? `<span class="tot-target">repère ${target[0]}–${target[1]}${unit}</span>` : ''}
    </div>`;
}

export function render(root, ctx) {
  const { store } = ctx;
  const today = new Date();
  let day = currentDay ? fromIso(currentDay) : today;

  function draw() {
    const date = isoDate(day);
    currentDay = date;
    const entries = dayEntries(store, date);
    const t = totals(entries);
    const targets = store.get('nutritionTargets');
    const unknownCount = entries.filter((e) => entryNutrients(e).kcal.value === null).length;
    const estimated = entries.filter((e) => entryNutrients(e).kcal.status === 'estime').length;
    const isToday = sameDay(day, today);

    root.innerHTML = `
      ${pageHeader({ title: 'Nutrition', eyebrow: 'Journal alimentaire', actions: profileButton })}

      <div class="date-nav card">
        <button type="button" class="icon-btn" data-act="prev" aria-label="Jour précédent">${icon('prev')}</button>
        <div class="date-nav-label">
          <strong>${relativeDay(day, today)}</strong>
          ${isToday ? `<span class="muted">${longDate(day)}</span>` : '<button type="button" class="link-btn" data-act="today">Revenir à aujourd’hui</button>'}
        </div>
        <button type="button" class="icon-btn" data-act="next" aria-label="Jour suivant">${icon('next')}</button>
      </div>

      <section class="block">
        <h2 class="block-title">Totaux du jour</h2>
        ${entries.length ? `
        <div class="card totals">
          ${['kcal', 'prot', 'gluc', 'lip'].map((n) => totalCell(t, n, n === 'kcal' ? targets?.kcal : n === 'prot' ? targets?.prot : null)).join('')}
        </div>
        ${unknownCount ? `<p class="hint">${unknownCount} aliment${unknownCount > 1 ? 's' : ''} sans valeur énergétique connue : le total est un minimum (≥).</p>` : ''}
        ${estimated ? `<p class="hint">≈ ${estimated} valeur${estimated > 1 ? 's' : ''} estimée${estimated > 1 ? 's' : ''} (ml comptés comme des grammes, ou énergie calculée).</p>` : ''}`
        : `<div class="card">${emptyState({ icon: 'list', title: 'Aucun aliment enregistré', text: 'Les totaux seront calculés uniquement à partir de ce que tu saisis. Si une valeur est inconnue, l’app l’indiquera au lieu de l’inventer.' })}</div>`}
        ${!targets ? '<p class="hint"><a class="link-inline" href="#/objectifs-nutrition">Définir des repères (facultatif)</a></p>' : ''}
      </section>

      ${MEALS.map((m) => {
        const items = entries.filter((e) => e.meal === m.id);
        const mt = totals(items);
        return `
        <section class="block meal" data-meal="${m.id}">
          <div class="meal-head">
            <h2 class="block-title">${m.label}${items.length ? ` · ${mt.kcal.unknown ? '≥ ' : ''}${Math.round(mt.kcal.value)} kcal` : ''}</h2>
            ${items.length ? `<button type="button" class="icon-btn icon-btn-sm" data-meal-menu="${m.id}" aria-label="Options du ${m.label.toLowerCase()}">⋯</button>` : ''}
          </div>
          <div class="card list">
            ${items.map((e) => {
              const v = entryNutrients(e);
              const qty = e.source === 'libre' ? (e.quantityText ? esc(e.quantityText) : '')
                : `${frNumber(e.quantity)} ${e.unit === 'portion' ? `${e.quantity > 1 ? 'portions' : 'portion'}${e.portionGrams ? ` (${frNumber(e.quantity * e.portionGrams)} g)` : ' (poids inconnu)'}` : e.unit}`;
              return `
              <button type="button" class="row-link" data-entry="${e.id}">
                <span class="row-text"><span class="row-title">${esc(e.name)}</span>
                <span class="row-sub">${qty}${qty ? ' · ' : ''}${SOURCE_LABEL[e.source]}${e.fromRecipe ? ' · ' + esc(e.fromRecipe) : ''}</span></span>
                <span class="entry-kcal">${kcalText(v.kcal)}</span>
              </button>`;
            }).join('')}
            <a class="row-link add-row" href="#/ajouter/${date}/${m.id}">
              <span class="row-ico">${icon('plus')}</span><span class="row-title">Ajouter ${m.to}</span>
            </a>
          </div>
        </section>`;
      }).join('')}

      <section class="block">
        <h2 class="block-title">Aller plus loin</h2>
        <div class="card list">
          <a class="row-link" href="#/idees"><span class="row-ico">${icon('nutrition')}</span><span class="row-text"><span class="row-title">Idées de repas</span><span class="row-sub">Selon tes goûts, allergies et budget · liste de courses</span></span>${icon('chevron', 'row-chev')}</a>
          <a class="row-link" href="#/objectifs-nutrition"><span class="row-ico">${icon('target')}</span><span class="row-text"><span class="row-title">Repères nutritionnels</span><span class="row-sub">${targets ? `${targets.kcal[0]}–${targets.kcal[1]} kcal · ${targets.prot[0]}–${targets.prot[1]} g de protéines` : 'Non définis (facultatif)'}</span></span>${icon('chevron', 'row-chev')}</a>
        </div>
      </section>`;
  }
  draw();

  function editEntry(e) {
    const date = isoDate(day);
    const v = entryNutrients(e);
    const status = (x) => ({ base: '', approx: ' (traces / valeur très faible)', estime: ' (estimé)', saisi: ' (saisi par toi)', inconnu: '' }[x.status]);
    const line = (n) => `<div class="kv"><span>${NUTRIENT_LABELS[n]}</span><span>${v[n].value === null ? '<span class="unknown">inconnu</span>' : `${n === 'kcal' ? Math.round(v[n].value) + ' kcal' : frNumber(v[n].value) + ' g'}${status(v[n])}`}</span></div>`;
    openSheet({
      title: esc(e.name),
      body: `
        ${e.source !== 'libre' ? `
        <div class="qty-row">
          <label class="field"><span class="field-label small">Quantité</span>
            <input class="input" id="edit-qty" type="text" inputmode="decimal" value="${frNumber(e.quantity)}"></label>
          <label class="field"><span class="field-label small">Unité</span>
            <select class="input" id="edit-unit">${Object.entries(UNITS).map(([k, l]) => `<option value="${k}" ${k === e.unit ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <label class="field" id="edit-portion-wrap" ${e.unit === 'portion' ? '' : 'hidden'}><span class="field-label small">Poids d’une portion (g), si tu le connais</span>
          <input class="input" id="edit-portion" type="text" inputmode="decimal" value="${e.portionGrams ? frNumber(e.portionGrams) : ''}"></label>` : ''}
        <div class="card kv-card flat">${['kcal', 'prot', 'gluc', 'lip', 'fibres', 'sel'].map(line).join('')}</div>
        <p class="hint">Source : ${SOURCE_LABEL[e.source]}${e.source === 'off' ? ' (données collaboratives, à vérifier sur l’emballage)' : e.source === 'ciqual' ? ' (valeurs moyennes ANSES)' : ''}.</p>`,
      actions: [
        { label: 'Supprimer', kind: 'ghost', onClick: () => {
          if (deleteEntry(store, date, e.id)) toast('Aliment supprimé.'); else toast('La suppression a échoué.', 'error');
          draw();
        } },
        ...(e.source !== 'libre' ? [{ label: 'Enregistrer', kind: 'primary', onClick: () => {
          const q = parseFr(document.getElementById('edit-qty').value);
          const unit = document.getElementById('edit-unit').value;
          const pg = parseFr(document.getElementById('edit-portion')?.value);
          if (!q || Number.isNaN(q) || q <= 0) { toast('Indique une quantité valide.', 'error'); return false; }
          if (pg !== null && (Number.isNaN(pg) || pg <= 0)) { toast('Poids de portion invalide.', 'error'); return false; }
          if (!updateEntry(store, date, e.id, { quantity: q, unit, portionGrams: unit === 'portion' ? pg : null })) toast('Enregistrement impossible.', 'error');
          else toast('Modifié.');
          draw();
          return true;
        } }] : []),
      ],
    });
    document.getElementById('edit-unit')?.addEventListener('change', (ev) => {
      document.getElementById('edit-portion-wrap').hidden = ev.target.value !== 'portion';
    });
  }

  function mealMenu(mealId) {
    const date = isoDate(day);
    const meal = MEALS.find((m) => m.id === mealId);
    openSheet({
      title: meal.label,
      body: `
        <div class="list choose-list">
          <button type="button" class="row-link" data-menu="dup"><span class="row-text"><span class="row-title">Dupliquer ce repas</span><span class="row-sub">Vers un autre jour ou un autre repas</span></span></button>
          <button type="button" class="row-link" data-menu="recipe"><span class="row-text"><span class="row-title">Enregistrer comme recette favorite</span><span class="row-sub">Pour l’ajouter en un geste plus tard</span></span></button>
        </div>
        <div id="menu-form"></div>`,
    });
    const form = document.getElementById('menu-form');
    document.querySelector('#sheet-root [data-menu="dup"]').addEventListener('click', () => {
      form.innerHTML = `
        <div class="qty-row">
          <label class="field"><span class="field-label small">Jour</span><input class="input" type="date" id="dup-date" value="${isoDate(addDays(day, 1))}"></label>
          <label class="field"><span class="field-label small">Repas</span><select class="input" id="dup-meal">${MEALS.map((m) => `<option value="${m.id}" ${m.id === mealId ? 'selected' : ''}>${m.label}</option>`).join('')}</select></label>
        </div>
        <button type="button" class="btn btn-primary btn-block" id="dup-go">Dupliquer</button>`;
      document.getElementById('dup-go').addEventListener('click', () => {
        const to = document.getElementById('dup-date').value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) { toast('Choisis une date.', 'error'); return; }
        const n = duplicateMeal(store, date, mealId, to, document.getElementById('dup-meal').value);
        closeSheet();
        toast(n ? `${n} aliment${n > 1 ? 's' : ''} copié${n > 1 ? 's' : ''}.` : 'Rien à copier.');
        draw();
      });
    });
    document.querySelector('#sheet-root [data-menu="recipe"]').addEventListener('click', () => {
      form.innerHTML = `
        <label class="field"><span class="field-label small">Nom de la recette</span><input class="input" id="rec-name" maxlength="60" placeholder="ex. Mon bol du matin"></label>
        <button type="button" class="btn btn-primary btn-block" id="rec-go">Enregistrer</button>`;
      document.getElementById('rec-name').focus();
      document.getElementById('rec-go').addEventListener('click', () => {
        const name = document.getElementById('rec-name').value.trim();
        if (!name) { toast('Donne un nom à la recette.', 'error'); return; }
        const r = saveMealAsRecipe(store, date, mealId, name);
        closeSheet();
        toast(r ? 'Recette enregistrée.' : 'Enregistrement impossible.', r ? 'info' : 'error');
      });
    });
  }

  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'prev') { day = addDays(day, -1); draw(); return; }
    if (act === 'next') { day = addDays(day, 1); draw(); return; }
    if (act === 'today') { day = today; draw(); return; }
    const id = e.target.closest('[data-entry]')?.dataset.entry;
    if (id) { const entry = dayEntries(store, isoDate(day)).find((x) => x.id === id); if (entry) editEntry(entry); return; }
    const menu = e.target.closest('[data-meal-menu]')?.dataset.mealMenu;
    if (menu) mealMenu(menu);
  });
}
