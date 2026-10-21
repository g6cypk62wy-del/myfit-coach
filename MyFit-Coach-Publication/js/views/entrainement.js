import { pageHeader, profileButton, icon, emptyState, openSheet, toast, esc } from '../ui.js';
import { weekOf, shortDay, sameDay, longDate, isoDate, fromIso } from '../dates.js';
import { WEEKDAYS } from '../profile-schema.js';
import { getProfile } from '../profile-store.js';
import { exerciseById } from '../data/exercises.js';
import { generateProgram, programMissing, programOutdated, targetText, gymReady } from '../training/program.js';
import {
  getGym, getProgram, getPreviousProgram, saveProgram, restorePreviousProgram, getSessions, getActive, saveActive,
} from '../training/store.js';
import { createSession } from '../training/session.js';

import { minutesText } from '../text.js';

export const title = 'Entraînement';

const DATE = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const dayId = (d) => WEEKDAYS[(d.getDay() + 6) % 7].id;

// Démarre une séance (prévue ou libre). Renvoie false s'il y en a déjà une.
export function startSession(ctx, plannedId = null, onlyExercises = null) {
  const { store } = ctx;
  if (getActive(store)) {
    toast('Une séance est déjà en cours.');
    ctx.navigate('#/seance');
    return false;
  }
  const program = getProgram(store);
  const planned = plannedId ? program?.sessions.find((s) => s.id === plannedId) : null;
  const session = createSession({ planned, program, onlyExercises });
  if (!saveActive(store, session)) {
    toast('Impossible d’enregistrer la séance sur cet appareil.', 'error');
    return false;
  }
  ctx.navigate('#/seance');
  return true;
}

function sessionCard(s, { withStart = false, todayId = null } = {}) {
  return `
    <div class="card plan-card">
      <div class="plan-head">
        <div>
          <p class="row-title">${s.name}</p>
          <p class="row-sub">${WEEKDAYS.find((w) => w.id === s.day)?.label ?? ''}${s.day === todayId ? ' · aujourd’hui' : ''} · ${s.exercises.length} exercice${s.exercises.length > 1 ? 's' : ''}</p>
        </div>
        <span class="plan-letter" aria-hidden="true">${WEEKDAYS.find((w) => w.id === s.day)?.label ?? s.id}</span>
      </div>
      <ol class="plan-list">
        ${s.exercises.map((e) => `<li><a href="#/exercices/${e.ex}">${exerciseById(e.ex)?.name ?? e.ex}</a><span>${targetText(e)}</span></li>`).join('')}
      </ol>
      ${withStart ? `<button type="button" class="btn btn-primary btn-block" data-start="${s.id}">${icon('play')} Démarrer cette séance</button>` : ''}
    </div>`;
}

export function render(root, ctx) {
  const { store } = ctx;
  const today = new Date();
  const week = weekOf(today);
  const profile = getProfile(store);
  const gym = getGym(store);
  const program = getProgram(store);
  const previous = getPreviousProgram(store);
  const sessions = getSessions(store);
  const active = getActive(store);
  const missing = programMissing(profile, gym);
  const outdated = programOutdated(program, profile, gym);
  let selected = isoDate(today);

  const doneOn = (iso) => sessions.filter((s) => isoDate(new Date(s.startedAt)) === iso);
  const plannedOn = (d) => program?.sessions.filter((s) => s.day === dayId(d)) ?? [];

  root.innerHTML = `
    ${pageHeader({ title: 'Entraînement', eyebrow: 'Cette semaine', actions: profileButton })}

    <div class="week" role="group" aria-label="Jours de la semaine">
      ${week.map((d) => {
        const done = doneOn(isoDate(d)).length > 0;
        const planned = plannedOn(d).length > 0;
        return `
        <button type="button" class="day${sameDay(d, today) ? ' today' : ''}" data-day="${isoDate(d)}" aria-pressed="false"
          aria-label="${longDate(d)}${planned ? ', séance prévue' : ''}${done ? ', séance réalisée' : ''}">
          <span class="day-name">${shortDay(d)}</span>
          <span class="day-num">${d.getDate()}</span>
          <span class="day-marks">${done ? '<i class="mark-done"></i>' : planned ? '<i class="mark-plan"></i>' : ''}</span>
        </button>`;
      }).join('')}
    </div>
    <p class="legend"><i class="mark-plan"></i> prévue <i class="mark-done"></i> réalisée</p>
    <div class="card day-detail" aria-live="polite" id="day-detail"></div>

    ${active
      ? `<a class="btn btn-primary btn-block btn-lg" href="#/seance">${icon('play')} Reprendre la séance en cours</a>`
      : `<button type="button" class="btn btn-primary btn-block btn-lg" data-act="start">${icon('play')} Démarrer une séance</button>`}

    <section class="block">
      <h2 class="block-title">Mon programme</h2>
      ${program ? `
        ${outdated ? `<p class="note note-warn">${icon('info')}<span>Ton profil ou ta salle ont changé depuis la création de ce programme. Tu peux le régénérer, ou le garder tel quel.</span></p>` : ''}
        ${program.warnings.map((w) => `<p class="note note-warn">${icon('info')}<span>${w}</span></p>`).join('')}
        <details class="card why">
          <summary>Pourquoi ce programme ?</summary>
          <ul>${program.explanation.map((x) => `<li>${x}</li>`).join('')}</ul>
          <p class="hint">Créé le ${new Date(program.createdAt).toLocaleDateString('fr-FR')}. Les charges ne sont pas fixées à l’avance : elles se règlent pendant la séance, selon tes sensations.</p>
        </details>
        ${program.sessions.map((s) => sessionCard(s, { todayId: dayId(today) })).join('')}
        <div class="btn-row">
          <button type="button" class="btn btn-ghost" data-act="regenerate">Régénérer</button>
          ${previous ? '<button type="button" class="btn btn-ghost" data-act="restore">Revenir au précédent</button>' : ''}
        </div>`
      : missing.length ? `
        <div class="card">
          ${emptyState({ icon: 'calendar', title: 'Pas encore de programme', text: 'Pour le créer, il manque :' })}
          <ul class="missing missing-links">${missing.map((m) => `<li><a class="link-inline" href="${m.href}">${m.label}</a></li>`).join('')}</ul>
        </div>`
      : `
        <div class="card">
          ${emptyState({ icon: 'calendar', title: 'Prêt à créer ton programme', text: 'Il sera construit à partir de ton profil validé et des équipements de ta salle. Chaque choix sera expliqué.' })}
          <button type="button" class="btn btn-primary btn-block" data-act="generate">Créer mon programme</button>
        </div>`}
    </section>

    <section class="block">
      <h2 class="block-title">Ressources</h2>
      <div class="card list">
        <a class="row-link" href="#/exercices">
          <span class="row-ico">${icon('book')}</span>
          <span class="row-text"><span class="row-title">Exercices</span><span class="row-sub">Fiches détaillées, réglages, erreurs fréquentes</span></span>
          ${icon('chevron', 'row-chev')}
        </a>
        <a class="row-link" href="#/salle">
          <span class="row-ico">${icon('building')}</span>
          <span class="row-text"><span class="row-title">Ma salle${gym?.club ? ` · ${esc(gym.club)}` : ' On Air'}</span>
          <span class="row-sub">${gymReady(gym) ? `${(gym.available?.length ?? 0) + (gym.custom?.length ?? 0)} équipement(s) coché(s)` : 'Équipements non renseignés'}</span></span>
          ${icon('chevron', 'row-chev')}
        </a>
      </div>
    </section>

    <section class="block">
      <h2 class="block-title">Historique</h2>
      ${sessions.length ? `
        <div class="card list">
          ${sessions.slice(0, 12).map((s) => `
            <a class="row-link" href="#/historique/${s.id}">
              <span class="row-ico">${icon('check')}</span>
              <span class="row-text"><span class="row-title">${esc(s.name)}</span>
              <span class="row-sub">${DATE.format(new Date(s.startedAt))} · ${minutesText(s.durationMin)} · ${s.exercises.length} exercice${s.exercises.length > 1 ? 's' : ''}</span></span>
              ${icon('chevron', 'row-chev')}
            </a>`).join('')}
        </div>
        ${sessions.length > 12 ? `<p class="hint">${sessions.length - 12} séance(s) plus ancienne(s) visibles dans Progression.</p>` : ''}`
      : `<div class="card">${emptyState({ icon: 'clock', title: 'Aucune séance réalisée', text: 'Seules les séances que tu termines vraiment apparaîtront ici. Une séance prévue n’est jamais comptée comme faite.' })}</div>`}
    </section>`;

  const detail = root.querySelector('#day-detail');
  function showDay() {
    const d = fromIso(selected);
    const planned = plannedOn(d);
    const done = doneOn(selected);
    detail.innerHTML = `
      <p class="day-detail-date">${sameDay(d, today) ? 'Aujourd’hui' : longDate(d)}</p>
      ${done.map((s) => `<p><a class="link-inline" href="#/historique/${s.id}">✓ ${esc(s.name)} réalisée (${minutesText(s.durationMin)})</a></p>`).join('')}
      ${planned.map((s) => `<p class="muted">Prévue : ${s.name} (${s.exercises.length} exercices)</p>`).join('')}
      ${!done.length && !planned.length ? `<p class="muted">${program ? 'Jour de repos.' : 'Aucune séance prévue ce jour.'}</p>` : ''}`;
    root.querySelectorAll('.day').forEach((b) => {
      const on = b.dataset.day === selected;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  showDay();

  function generate() {
    const res = generateProgram(getProfile(store), getGym(store));
    if (res.missing) { toast('Il manque encore des informations.', 'error'); ctx.rerender(); return; }
    if (!saveProgram(store, res.program)) { toast('Impossible d’enregistrer le programme.', 'error'); return; }
    toast('Programme créé.');
    ctx.rerender();
  }

  root.addEventListener('click', (e) => {
    const day = e.target.closest('[data-day]');
    if (day) { selected = day.dataset.day; showDay(); return; }
    const startId = e.target.closest('[data-start]')?.dataset.start;
    if (startId) { startSession(ctx, startId); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'generate') generate();
    else if (act === 'regenerate') {
      if (missing.length) { toast('Complète d’abord : ' + missing.map((m) => m.label.toLowerCase()).join(', ') + '.', 'error'); return; }
      openSheet({
        title: 'Régénérer le programme ?',
        body: '<p>Un nouveau programme sera créé à partir de ton profil et de ta salle actuels.</p><p class="muted">Ton programme actuel est gardé : tu pourras y revenir. Ton historique de séances ne change pas.</p>',
        actions: [{ label: 'Annuler', kind: 'ghost' }, { label: 'Régénérer', kind: 'primary', onClick: generate }],
      });
    } else if (act === 'restore') {
      openSheet({
        title: 'Revenir au programme précédent ?',
        body: '<p>Le programme actuel et le précédent sont échangés : tu pourras encore revenir en arrière.</p>',
        actions: [
          { label: 'Annuler', kind: 'ghost' },
          { label: 'Revenir', kind: 'primary', onClick: () => { if (restorePreviousProgram(store)) toast('Programme précédent rétabli.'); ctx.rerender(); } },
        ],
      });
    } else if (act === 'start') {
      const todayPlanned = plannedOn(today);
      openSheet({
        title: 'Démarrer une séance',
        body: program
          ? `<div class="list choose-list">${[...todayPlanned, ...program.sessions.filter((s) => !todayPlanned.includes(s))].map((s) => `
              <button type="button" class="row-link" data-choose="${s.id}">
                <span class="plan-letter" aria-hidden="true">${WEEKDAYS.find((w) => w.id === s.day)?.label ?? s.id}</span>
                <span class="row-text"><span class="row-title">${s.name}</span><span class="row-sub">${todayPlanned.includes(s) ? 'Prévue aujourd’hui · ' : ''}${s.exercises.length} exercices</span></span>
              </button>`).join('')}
              <button type="button" class="row-link" data-choose="libre">
                <span class="plan-letter" aria-hidden="true">+</span>
                <span class="row-text"><span class="row-title">Séance libre</span><span class="row-sub">Tu choisis les exercices au fur et à mesure</span></span>
              </button></div>`
          : `<p>Tu n’as pas encore de programme. Tu peux faire une séance libre : tu ajoutes les exercices toi-même.</p>
             <div class="list choose-list"><button type="button" class="row-link" data-choose="libre"><span class="plan-letter" aria-hidden="true">+</span><span class="row-text"><span class="row-title">Séance libre</span></span></button></div>`,
      });
      document.querySelectorAll('#sheet-root [data-choose]').forEach((b) => b.addEventListener('click', () => {
        startSession(ctx, b.dataset.choose === 'libre' ? null : b.dataset.choose);
      }));
    }
  });
}
