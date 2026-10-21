// Idées de repas (#/idees) filtrées selon le profil, et liste de courses.

import { pageHeader, icon, esc, toast } from '../ui.js';
import { getProfile } from '../profile-store.js';
import { MOMENTS } from '../data/meal-ideas.js';
import { filterIdeas, shoppingList, BUDGET_LABEL } from '../nutrition/ideas.js';

export const title = 'Idées de repas';

let moment = 'repas';
let picked = new Set();

export function render(root, ctx) {
  const profile = getProfile(ctx.store);
  const alim = profile?.data.alimentation ?? {};
  const allergiesKnown = Array.isArray(alim.allergies) && alim.allergies.length > 0;

  function draw() {
    const { ideas, hidden } = filterIdeas(alim, { moment });
    const all = filterIdeas(alim).ideas;
    const selected = all.filter((i) => picked.has(i.id));
    root.innerHTML = `
      ${pageHeader({ title: 'Idées de repas', eyebrow: 'Selon ton profil', back: '#/nutrition' })}
      ${!profile ? `<p class="note note-warn">${icon('info')}<span>Sans profil validé, aucune allergie ni préférence n’est connue : vérifie chaque ingrédient toi-même.</span></p>`
        : !allergiesKnown ? `<p class="note note-warn">${icon('info')}<span>Tes allergies ne sont pas renseignées : vérifie chaque ingrédient. <a class="link-inline" href="#/questionnaire/5">Compléter</a></span></p>`
        : `<p class="note">${icon('shield')}<span>Filtré selon tes allergies, préférences et aliments non aimés.${alim.budget === 'serre' ? ' Les idées économiques passent en premier.' : ''}</span></p>`}

      <div class="chips-scroll" role="group" aria-label="Moment">
        ${MOMENTS.map((m) => `<button type="button" class="chip" aria-pressed="${moment === m.id}" data-moment="${m.id}">${m.label}</button>`).join('')}
      </div>

      <div class="ideas block-gap">
        ${ideas.length ? ideas.map((i) => `
          <article class="card idea">
            <div class="idea-head">
              <h2>${i.name}</h2>
              <button type="button" class="mini-chip" aria-pressed="${picked.has(i.id)}" data-pick="${i.id}">${picked.has(i.id) ? 'Dans la liste' : 'À la liste'}</button>
            </div>
            <p class="row-sub">${i.time ? `${i.time} min` : 'Sans préparation'} · ${BUDGET_LABEL[i.budget]}</p>
            <ul class="ing">${i.ingredients.map((x) => `<li>${x.name} <span>${x.qty}</span></li>`).join('')}</ul>
            <details><summary>Préparation</summary><ol>${i.steps.map((s) => `<li>${s}</li>`).join('')}</ol></details>
            ${i.note ? `<p class="hint">${i.note}</p>` : ''}
          </article>`).join('')
        : '<div class="card"><p class="empty-title">Aucune idée compatible pour ce moment</p><p class="empty-text">Essaie un autre moment de la journée.</p></div>'}
      </div>

      ${hidden.length ? `
      <details class="card why block-gap"><summary>${hidden.length} idée${hidden.length > 1 ? 's' : ''} masquée${hidden.length > 1 ? 's' : ''} pour toi</summary>
        <ul>${hidden.map((h) => `<li><strong>${h.idea.name}</strong> : ${h.reasons.join(', ')}</li>`).join('')}</ul>
      </details>` : ''}

      <section class="block">
        <h2 class="block-title">Liste de courses</h2>
        ${selected.length ? `
          <div class="card">
            <ul class="shop" id="shop">${shoppingList(selected).map((x) => `<li><span>${x.name}</span><span>${x.qty.join(' + ')}</span></li>`).join('')}</ul>
          </div>
          <div class="btn-row"><button type="button" class="btn btn-ghost" data-act="clear">Vider</button><button type="button" class="btn btn-primary" data-act="copy">Copier la liste</button></div>`
        : '<p class="hint">Ajoute des idées avec « À la liste » pour obtenir la liste de courses.</p>'}
      </section>
      <p class="hint">Idées générales, non personnalisées par une IA. Quantités indicatives pour une personne.</p>`;
  }
  draw();

  root.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-moment]');
    if (m) { moment = m.dataset.moment; draw(); return; }
    const p = e.target.closest('[data-pick]');
    if (p) {
      const id = p.dataset.pick;
      if (picked.has(id)) picked.delete(id); else picked.add(id);
      const y = window.scrollY; draw(); window.scrollTo(0, y);
      root.querySelector(`[data-pick="${id}"]`)?.focus({ preventScroll: true });
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'clear') { picked = new Set(); draw(); }
    else if (act === 'copy') {
      const text = [...root.querySelectorAll('#shop li')].map((li) => `- ${li.children[0].textContent} : ${li.children[1].textContent}`).join('\n');
      try { await navigator.clipboard.writeText('Liste de courses\n' + text); toast('Liste copiée.'); }
      catch { toast('Copie impossible : sélectionne le texte à la main.', 'error'); }
    }
  });
}

export { esc };
