// Repères nutritionnels (#/objectifs-nutrition) : estimation expliquée, ou valeurs choisies.

import { pageHeader, icon, toast, openSheet } from '../ui.js';
import { getProfile } from '../profile-store.js';
import { estimateTargets, nutritionGoal } from '../nutrition/targets.js';
import { GOALS } from '../profile-schema.js';
import { parseFr, frNumber } from '../text.js';

export const title = 'Repères nutritionnels';

export function render(root, ctx) {
  const { store } = ctx;
  const profile = getProfile(store);
  const p = profile?.data ?? {};
  const settings = store.get('nutritionSettings', {});
  let sexe = settings.sexe ?? null;
  let poids = settings.poids ?? p.profil?.poids ?? null;

  function inputs() {
    return {
      poids, taille: p.profil?.taille, age: p.profil?.age, sexe,
      activite: p.profil?.activite, seances: p.experience?.seances,
      goal: nutritionGoal(p.objectifs?.objectifs ?? []),
    };
  }

  function draw() {
    const current = store.get('nutritionTargets');
    const est = profile ? estimateTargets(inputs()) : null;
    const goal = GOALS.find((g) => g.id === inputs().goal);
    root.innerHTML = `
      ${pageHeader({ title: 'Repères nutritionnels', eyebrow: 'Facultatif', back: '#/nutrition' })}
      <p class="note">${icon('info')}<span>Ces repères sont des <strong>estimations</strong>, pas des règles. Tu peux t’en passer, les modifier, ou choisir tes propres valeurs. Aucun régime restrictif n’est proposé.</span></p>

      ${current ? `
      <section class="block">
        <h2 class="block-title">Tes repères actuels</h2>
        <div class="card kv-card">
          <div class="kv"><span>Énergie</span><span>${current.kcal[0]}–${current.kcal[1]} kcal/jour</span></div>
          <div class="kv"><span>Protéines</span><span>${current.prot[0]}–${current.prot[1]} g/jour</span></div>
          <div class="kv"><span>Origine</span><span>${current.mode === 'manuel' ? 'Choisis par toi' : 'Estimation de l’app'}</span></div>
        </div>
        <button type="button" class="btn btn-ghost btn-block" data-act="clear">Retirer ces repères</button>
      </section>` : ''}

      <section class="block">
        <h2 class="block-title">Estimation</h2>
        ${!profile ? `<div class="card"><p class="empty-title">Profil nécessaire</p><p class="empty-text">L’estimation utilise ton âge, ta taille, ton activité et tes objectifs.</p><a class="btn btn-primary btn-block" href="#/profil">Compléter mon profil</a></div>` : `
        <div class="card form-card">
          <label class="field"><span class="field-label">Poids pour le calcul (kg)</span>
            <input class="input" id="poids" type="text" inputmode="decimal" value="${poids ? frNumber(poids) : ''}" placeholder="ex. 64">
            <span class="field-hint">Utilisé seulement ici. Il n’est pas ajouté à ton profil.</span></label>
          <fieldset class="field"><legend class="field-label">Sexe pour la formule <span class="tag">Facultatif</span></legend>
            <div class="opts">${[['f', 'Femme'], ['h', 'Homme'], [null, 'Je préfère ne pas le dire']].map(([v, l]) => `<button type="button" class="opt" role="radio" aria-checked="${sexe === v}" data-sexe="${v ?? ''}">${l}</button>`).join('')}</div>
            <span class="field-hint">Les formules diffèrent selon le sexe biologique. Sans réponse, la fourchette est simplement plus large.</span></fieldset>
        </div>
        ${est?.missing ? `<p class="hint">Il manque ${est.missing.join(', ')} pour estimer.</p>` : `
        <div class="card result-card block-gap">
          <div class="big-range"><span>${est.kcal[0]}–${est.kcal[1]}</span><small>kcal par jour</small></div>
          <div class="big-range"><span>${est.prot[0]}–${est.prot[1]} g</span><small>de protéines par jour</small></div>
          <p class="row-sub">Objectif pris en compte : ${goal ? goal.label.toLowerCase() : 'aucun'}.</p>
        </div>
        <details class="card why block-gap"><summary>Hypothèses et limites</summary>
          <ul>${est.assumptions.map((a) => `<li>${a}</li>`).join('')}</ul>
          <ul>${est.limits.map((a) => `<li>${a}</li>`).join('')}</ul>
        </details>
        <button type="button" class="btn btn-primary btn-block" data-act="use">Utiliser ces repères</button>`}`}
        <button type="button" class="btn btn-ghost btn-block" data-act="manual">Choisir mes propres valeurs</button>
      </section>`;
  }
  draw();

  function saveSettings() {
    store.set('nutritionSettings', { ...store.get('nutritionSettings', {}), sexe, poids });
  }

  root.addEventListener('change', (e) => {
    if (e.target.id !== 'poids') return;
    const v = parseFr(e.target.value);
    if (v !== null && (Number.isNaN(v) || v < 30 || v > 300)) { toast('Indique un poids entre 30 et 300 kg.', 'error'); return; }
    poids = v;
    saveSettings();
    draw();
  });

  root.addEventListener('click', (e) => {
    const sx = e.target.closest('[data-sexe]');
    if (sx) { sexe = sx.dataset.sexe || null; saveSettings(); draw(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'use') {
      const est = estimateTargets(inputs());
      if (est.missing) return;
      store.set('nutritionTargets', { kcal: est.kcal, prot: est.prot, mode: 'estimation', assumptions: est.assumptions, createdAt: new Date().toISOString() });
      toast('Repères enregistrés. Tu peux les changer à tout moment.');
      draw();
    } else if (act === 'clear') {
      store.remove('nutritionTargets');
      toast('Repères retirés.');
      draw();
    } else if (act === 'manual') {
      const cur = store.get('nutritionTargets');
      openSheet({
        title: 'Mes propres valeurs',
        body: `
          <p class="muted">Indique des fourchettes (minimum et maximum).</p>
          <div class="qty-row"><label class="field"><span class="field-label small">kcal min</span><input class="input" id="k0" inputmode="numeric" value="${cur?.kcal[0] ?? ''}"></label>
          <label class="field"><span class="field-label small">kcal max</span><input class="input" id="k1" inputmode="numeric" value="${cur?.kcal[1] ?? ''}"></label></div>
          <div class="qty-row"><label class="field"><span class="field-label small">Protéines min (g)</span><input class="input" id="p0" inputmode="numeric" value="${cur?.prot[0] ?? ''}"></label>
          <label class="field"><span class="field-label small">Protéines max (g)</span><input class="input" id="p1" inputmode="numeric" value="${cur?.prot[1] ?? ''}"></label></div>`,
        actions: [
          { label: 'Annuler', kind: 'ghost' },
          { label: 'Enregistrer', kind: 'primary', onClick: () => {
            const v = ['k0', 'k1', 'p0', 'p1'].map((id) => parseFr(document.getElementById(id).value));
            if (v.some((x) => x === null || Number.isNaN(x))) { toast('Remplis les quatre valeurs avec des nombres.', 'error'); return false; }
            if (v[0] > v[1] || v[2] > v[3]) { toast('Le minimum doit être inférieur au maximum.', 'error'); return false; }
            if (v[0] < 1000) { toast('Moins de 1000 kcal par jour n’est pas un repère raisonnable sans suivi médical.', 'error'); return false; }
            if (v[1] > 6000 || v[3] > 400) { toast('Ces valeurs semblent trop élevées.', 'error'); return false; }
            store.set('nutritionTargets', { kcal: [v[0], v[1]], prot: [v[2], v[3]], mode: 'manuel', createdAt: new Date().toISOString() });
            toast('Repères enregistrés.');
            draw();
            return true;
          } },
        ],
      });
    }
  });
}
