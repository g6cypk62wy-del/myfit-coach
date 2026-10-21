// Détail d'une séance réalisée (#/historique/<id>).

import { pageHeader, icon, esc, openSheet, toast } from '../ui.js';
import { exerciseById } from '../data/exercises.js';
import { getSessions, deleteSession } from '../training/store.js';
import { frNumber, minutesText } from '../text.js';

export const title = 'Séance réalisée';

const DATE = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const ENERGY = { basse: 'Basse', normale: 'Normale', haute: 'Haute' };

export function render(root, ctx) {
  const s = getSessions(ctx.store).find((x) => x.id === ctx.params[0]);
  if (!s) {
    root.innerHTML = `${pageHeader({ title: 'Séance introuvable', back: '#/entrainement' })}<p class="muted">Cette séance n’existe pas ou a été supprimée.</p>`;
    return;
  }
  const r = s.review || {};
  const val = (ex, set) => {
    if (ex?.measure === 'minutes') return `${frNumber(set.value)} min`;
    if (ex?.measure === 'seconds') return `${frNumber(set.value)} s`;
    return `${set.weight != null ? frNumber(set.weight) + ' kg × ' : ''}${frNumber(set.value)}`;
  };

  root.innerHTML = `
    ${pageHeader({ title: esc(s.name), eyebrow: DATE.format(new Date(s.startedAt)), back: '#/entrainement' })}
    <div class="card kv-card">
      <div class="kv"><span>Durée</span><span>${minutesText(s.durationMin)}</span></div>
      <div class="kv"><span>Difficulté ressentie</span><span>${r.difficulty ? r.difficulty + '/10' : 'Non indiquée'}</span></div>
      <div class="kv"><span>Énergie</span><span>${ENERGY[r.energy] ?? 'Non indiquée'}</span></div>
      <div class="kv"><span>Douleur</span><span>${r.pain === 'oui' ? 'Oui' : r.pain === 'non' ? 'Non' : 'Non indiquée'}</span></div>
      ${s.short ? '<div class="kv"><span>Version</span><span>Courte</span></div>' : ''}
    </div>
    ${r.pain === 'oui' && r.painNote ? `<p class="note note-warn">${icon('info')}<span>${esc(r.painNote)}</span></p>` : ''}

    <section class="block">
      <h2 class="block-title">Exercices</h2>
      <div class="card list">
        ${s.exercises.map((e) => {
          const ex = exerciseById(e.ex);
          return `
          <div class="hist-ex">
            <a class="row-title" href="#/exercices/${e.ex}">${ex?.name ?? e.ex}</a>
            ${e.replacedFrom ? `<p class="row-sub">À la place de : ${exerciseById(e.replacedFrom)?.name ?? e.replacedFrom}</p>` : ''}
            <p class="hist-sets">${e.sets.map((x, i) => `<span>${i + 1}. ${val(ex, x)}</span>`).join('')}</p>
            ${e.note ? `<p class="row-sub">${esc(e.note)}</p>` : ''}
          </div>`;
        }).join('')}
      </div>
    </section>

    ${r.notes ? `<section class="block"><h2 class="block-title">Notes</h2><p class="card prose">${esc(r.notes)}</p></section>` : ''}

    <button type="button" class="btn btn-ghost btn-block danger-text" data-act="delete">Supprimer cette séance</button>`;

  root.querySelector('[data-act="delete"]').addEventListener('click', () => {
    openSheet({
      title: 'Supprimer cette séance ?',
      body: '<p>Elle sera retirée de ton historique et de tes statistiques. Cette action est définitive.</p>',
      actions: [
        { label: 'Annuler', kind: 'ghost' },
        { label: 'Supprimer', kind: 'danger', onClick: () => {
          if (deleteSession(ctx.store, s.id)) toast('Séance supprimée.');
          else toast('La suppression a échoué.', 'error');
          ctx.navigate('#/entrainement');
        } },
      ],
    });
  });
}
