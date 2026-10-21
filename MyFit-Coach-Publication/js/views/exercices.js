// Bibliothèque d'exercices (liste) et fiche détaillée (#/exercices/<id>).

import { pageHeader, icon, esc } from '../ui.js';
import { EXERCISES, MUSCLES, MUSCLE_GROUPS, exerciseById, RIR_ADVICE } from '../data/exercises.js';
import { equipmentLabel } from '../data/equipment.js';
import { GOALS } from '../profile-schema.js';
import { isAvailable, targetText } from '../training/program.js';
import { getGym, getProgram, getSessions } from '../training/store.js';
import { suggestion, performancesFor } from '../training/progression.js';
import { normalize, frNumber } from '../text.js';

export const title = 'Exercices';

const LEVELS = { 1: 'Débutant', 2: 'Intermédiaire', 3: 'Avancé' };
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

function equipText(ex, gym) {
  if (!ex.equip.length) return 'Aucun matériel';
  return ex.equip.map((need) => need.split('|').map((id) => equipmentLabel(id, gym?.custom)).join(' ou ')).join(' + ');
}

let lastFilter = { q: '', group: '' };

function renderList(root, ctx) {
  const gym = getGym(ctx.store);
  const draw = () => {
    const q = normalize(lastFilter.q);
    const group = MUSCLE_GROUPS.find((g) => g.id === lastFilter.group);
    const list = EXERCISES.filter((ex) =>
      (!q || normalize(ex.name).includes(q) || (ex.keywords || []).some((k) => normalize(k).includes(q))) &&
      (!group || [...ex.muscles].some((m) => group.muscles.includes(m))));
    root.querySelector('#ex-results').innerHTML = list.length ? list.map((ex) => {
      const ok = gym && isAvailable(ex, gym);
      return `
        <a class="row-link" href="#/exercices/${ex.id}">
          <span class="row-text">
            <span class="row-title">${ex.name}</span>
            <span class="row-sub">${ex.muscles.map((m) => MUSCLES[m]).join(', ')} · ${equipText(ex, gym)}</span>
          </span>
          ${gym ? `<span class="pill ${ok ? 'pill-renseigne' : 'pill-manquant'}">${ok ? 'Dans ta salle' : 'Non coché'}</span>` : ''}
        </a>`;
    }).join('') : '<p class="row-sub pad">Aucun exercice ne correspond.</p>';
    root.querySelector('#ex-count').textContent = `${list.length} exercice${list.length > 1 ? 's' : ''}`;
  };

  root.innerHTML = `
    ${pageHeader({ title: 'Exercices', eyebrow: 'Bibliothèque', back: '#/entrainement' })}
    <div class="field">
      <label class="sr-only" for="ex-q">Rechercher un exercice</label>
      <input id="ex-q" class="input" type="search" placeholder="Rechercher (ex. squat, rowing…)" value="${esc(lastFilter.q)}" autocomplete="off">
    </div>
    <div class="chips-scroll" role="group" aria-label="Filtrer par muscle">
      <button type="button" class="chip" aria-pressed="${!lastFilter.group}" data-group="">Tous</button>
      ${MUSCLE_GROUPS.map((g) => `<button type="button" class="chip" aria-pressed="${lastFilter.group === g.id}" data-group="${g.id}">${g.label}</button>`).join('')}
    </div>
    <p class="hint" id="ex-count" aria-live="polite"></p>
    <div class="card list" id="ex-results"></div>
    ${gym ? '' : '<p class="hint">Coche les équipements de ta salle dans « Ma salle » pour voir ce qui est faisable chez toi.</p>'}`;
  draw();

  root.querySelector('#ex-q').addEventListener('input', (e) => { lastFilter.q = e.target.value; draw(); });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-group]');
    if (!b) return;
    lastFilter.group = b.dataset.group;
    root.querySelectorAll('[data-group]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.group === lastFilter.group)));
    draw();
  });
}

function renderSheet(root, ctx, ex) {
  const gym = getGym(ctx.store);
  const program = getProgram(ctx.store);
  const sessions = getSessions(ctx.store);
  const inProgram = program?.sessions.flatMap((s) => s.exercises.filter((e) => e.ex === ex.id).map((e) => ({ ...e, session: s.name }))) ?? [];
  const target = inProgram[0] ?? null;
  const sug = suggestion(ex.id, target, sessions);
  const perfs = performancesFor(ex.id, sessions).slice(0, 5);
  const relevant = GOALS.filter((g) => ex.goals.includes(g.id));
  const back = ctx.params[1] === 'seance' ? '#/seance' : '#/exercices';
  const link = (id) => {
    const e = exerciseById(id);
    if (!e) return '';
    const ok = !gym || isAvailable(e, gym);
    return `<a class="row-link" href="#/exercices/${e.id}"><span class="row-text"><span class="row-title">${e.name}</span><span class="row-sub">${equipText(e, gym)}</span></span>${gym ? `<span class="pill ${ok ? 'pill-renseigne' : 'pill-manquant'}">${ok ? 'Dans ta salle' : 'Non coché'}</span>` : ''}</a>`;
  };
  const valueText = (s) => {
    if (ex.measure === 'minutes') return `${frNumber(s.value)} min`;
    if (ex.measure === 'seconds') return `${s.value} s`;
    return `${s.weight ? frNumber(s.weight) + ' kg × ' : ''}${s.value}`;
  };

  root.innerHTML = `
    ${pageHeader({ title: ex.name, eyebrow: `${LEVELS[ex.level]} · ${ex.kind === 'compose' ? 'Polyarticulaire' : ex.kind === 'isolation' ? 'Isolation' : ex.kind === 'gainage' ? 'Gainage' : ex.kind === 'cardio' ? 'Cardio' : 'Mobilité'}`, back })}

    <div class="card kv-card">
      <div class="kv"><span>Muscles principaux</span><span>${ex.muscles.map((m) => MUSCLES[m]).join(', ')}</span></div>
      ${ex.secondary.length ? `<div class="kv"><span>Aussi sollicités</span><span>${ex.secondary.map((m) => MUSCLES[m]).join(', ')}</span></div>` : ''}
      <div class="kv"><span>Matériel</span><span>${equipText(ex, gym)}</span></div>
      ${gym ? `<div class="kv"><span>Dans ta salle</span><span>${isAvailable(ex, gym) ? 'Oui' : 'Non coché'}</span></div>` : ''}
    </div>

    ${relevant.length ? `<section class="block"><h2 class="block-title">Utile pour</h2><p class="prose">${relevant.map((g) => g.label).join(' · ')}</p></section>` : ''}

    <section class="block">
      <h2 class="block-title">Séries et répétitions</h2>
      <div class="card prose">
        ${target ? `<p>Dans ton programme (${esc(target.session)}) : <strong>${targetText(target)}</strong>${target.rest ? `, repos ${target.rest >= 60 ? frNumber(target.rest / 60) + ' min' : target.rest + ' s'}` : ''}.</p>` : '<p>Cet exercice n’est pas dans ton programme actuel.</p>'}
        ${ex.measure === 'reps' ? `<p class="muted">${RIR_ADVICE}</p>` : ''}
      </div>
    </section>

    ${sug ? `<section class="block"><h2 class="block-title">Suggestion pour la prochaine fois</h2><p class="note">${icon('progress')}<span>${sug.text}</span></p></section>` : ''}

    <section class="block">
      <h2 class="block-title">Réglages</h2>
      <p class="card prose">${ex.setup}</p>
    </section>

    <section class="block">
      <h2 class="block-title">Étapes</h2>
      <ol class="card steps-list">${ex.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
    </section>

    <section class="block">
      <h2 class="block-title">Posture et respiration</h2>
      <div class="card prose"><p>${ex.posture}</p><p>${ex.breathing}</p></div>
    </section>

    <section class="block">
      <h2 class="block-title">Erreurs fréquentes</h2>
      <ul class="card steps-list">${ex.errors.map((s) => `<li>${s}</li>`).join('')}</ul>
    </section>

    <p class="note note-warn">${icon('info')}<span>En cas de douleur pendant l’exercice, arrête-toi. Une gêne musculaire normale n’est pas une douleur articulaire.</span></p>

    ${ex.easier ? `<section class="block"><h2 class="block-title">Variante plus facile</h2><div class="card list">${link(ex.easier)}</div></section>` : ''}
    ${ex.replacements.length ? `<section class="block"><h2 class="block-title">Exercices de remplacement</h2><div class="card list">${ex.replacements.map(link).join('')}</div></section>` : ''}

    <section class="block">
      <h2 class="block-title">Ton historique</h2>
      <div class="card list">
        ${perfs.length ? perfs.map((p) => `<div class="kv"><span>${DATE.format(new Date(p.date))}</span><span>${p.sets.map(valueText).join(' · ')}</span></div>`).join('')
          : '<p class="row-sub pad">Pas encore réalisé.</p>'}
      </div>
    </section>

    <p class="hint">Aucune vidéo n’est proposée : en cas de doute sur une machine, demande une démonstration au personnel de ta salle.</p>`;
}

export function render(root, ctx) {
  const id = ctx.params[0];
  if (!id) return renderList(root, ctx);
  const ex = exerciseById(id);
  if (!ex) {
    root.innerHTML = `${pageHeader({ title: 'Exercice introuvable', back: '#/exercices' })}<p class="muted">Cet exercice n’existe pas ou plus.</p>`;
    return;
  }
  return renderSheet(root, ctx, ex);
}
