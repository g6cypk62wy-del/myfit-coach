import { pageHeader, profileButton, icon, emptyState, esc } from '../ui.js';
import { greeting, longDate, isoDate } from '../dates.js';
import { GOALS, WEEKDAYS } from '../profile-schema.js';
import { getProfile, getDraft, STEP_COUNT } from '../profile-store.js';
import { getProgram, getSessions, getActive, getGym } from '../training/store.js';
import { programMissing } from '../training/program.js';
import { dayEntries, totals } from '../nutrition/journal.js';
import { sessionsBetween, weekRange } from '../stats.js';
import { startSession } from './entrainement.js';

import { minutesText } from '../text.js';

export const title = 'Accueil';

const SHORT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

export function render(root, ctx) {
  const { store } = ctx;
  const profile = getProfile(store);
  const draft = getDraft(store);
  const program = getProgram(store);
  const sessions = getSessions(store);
  const active = getActive(store);
  const goals = profile?.data.objectifs?.objectifs ?? [];
  const now = new Date();
  const today = isoDate(now);
  const todayIdx = (now.getDay() + 6) % 7;
  const todayId = WEEKDAYS[todayIdx].id;
  const doneToday = sessions.filter((s) => isoDate(new Date(s.startedAt)) === today);
  const plannedToday = program?.sessions.find((s) => s.day === todayId) ?? null;
  const entries = dayEntries(store, today);
  const t = totals(entries);
  const targets = store.get('nutritionTargets');
  const { from, to } = weekRange(now);
  const weekDone = sessionsBetween(sessions, from, to).length;

  // Prochaine séance prévue (à partir de demain si celle du jour est faite ou absente).
  let next = null;
  if (program) {
    for (let k = 1; k < 8; k++) {
      const s = program.sessions.find((x) => x.day === WEEKDAYS[(todayIdx + k) % 7].id);
      if (s) { next = { s, k }; break; }
    }
  }
  const missing = program ? [] : programMissing(profile, getGym(store));

  const hero = !profile
    ? draft
      ? { kicker: `Étape ${draft.step} sur ${STEP_COUNT}`, title: 'Continue ton profil', sub: 'Tes réponses sont enregistrées. Reprends là où tu en étais.', href: `#/questionnaire/${draft.step}` }
      : { kicker: 'Pour commencer', title: 'Crée ton profil sportif', sub: 'Tes objectifs, ton niveau et tes disponibilités. Sans ça, l’app ne peut rien te proposer de personnalisé.', href: '#/questionnaire/1' }
    : !program && missing.length
      ? { kicker: 'Étape suivante', title: missing[0].href === '#/salle' ? 'Indique l’équipement de ta salle' : 'Complète ton profil', sub: missing[0].href === '#/salle' ? 'Coche ce que tu as vu dans ton club : ton programme sera construit avec.' : `Il manque : ${missing.map((m) => m.label.toLowerCase()).join(', ')}.`, href: missing[0].href }
      : !program
        ? { kicker: 'Étape suivante', title: 'Crée ton programme', sub: 'Ton profil et ta salle sont prêts.', href: '#/entrainement' }
        : null;

  const kcalText = entries.length
    ? `${t.kcal.unknown ? '≥ ' : ''}${Math.round(t.kcal.value)} kcal${targets ? ` (repère ${targets.kcal[0]}–${targets.kcal[1]})` : ''} · ${entries.length} aliment${entries.length > 1 ? 's' : ''}`
    : 'Aucun repas enregistré aujourd’hui';

  root.innerHTML = `
    ${pageHeader({ title: greeting(now), eyebrow: longDate(now), actions: profileButton })}

    ${hero ? `
    <a class="card card-hero" href="${hero.href}">
      <div class="card-hero-text">
        <p class="card-kicker">${hero.kicker}</p>
        <p class="card-hero-title">${hero.title}</p>
        <p class="card-hero-sub">${hero.sub}</p>
      </div>
      <span class="card-hero-arrow">${icon('chevron')}</span>
    </a>` : ''}

    <section class="block">
      <h2 class="block-title">Aujourd’hui</h2>
      <div class="card">
        ${active ? `<p class="row-title">Séance en cours : ${esc(active.name)}</p><a class="btn btn-primary btn-sm block-gap" href="#/seance">Reprendre</a>`
        : doneToday.length ? `<p class="row-title">✓ ${esc(doneToday[0].name)} réalisée</p><p class="row-sub">${minutesText(doneToday[0].durationMin)}. Place à la récupération.</p>`
        : plannedToday ? `<p class="row-title">Prévu : ${plannedToday.name}</p><p class="row-sub">${plannedToday.exercises.length} exercices</p>
            <button type="button" class="btn btn-primary btn-sm block-gap" data-start="${plannedToday.id}">${icon('play')} Démarrer</button>`
        : program ? '<p class="row-title">Jour de repos</p><p class="row-sub">Le repos fait partie de la progression.</p>'
        : emptyState({ icon: 'calendar', title: 'Rien de prévu pour l’instant', text: 'Ton résumé du jour apparaîtra ici dès que tu auras un programme.' })}
      </div>
    </section>

    ${next ? `
    <section class="block">
      <h2 class="block-title">Prochaine séance</h2>
      <a class="row-link card" href="#/entrainement">
        <span class="row-ico">${icon('training')}</span>
        <span class="row-text"><span class="row-title">${next.s.name}</span><span class="row-sub">${next.k === 1 ? 'Demain' : WEEKDAYS.find((w) => w.id === next.s.day).label} · ${next.s.exercises.length} exercices</span></span>
        ${icon('chevron', 'row-chev')}
      </a>
    </section>` : ''}

    ${program ? `
    <section class="block">
      <h2 class="block-title">Objectif de la semaine</h2>
      <div class="card week-goal">
        <div class="week-goal-top"><span class="row-title">${weekDone} / ${program.sessions.length} séance${program.sessions.length > 1 ? 's' : ''}</span><span class="row-sub">prévues dans ton programme</span></div>
        <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="${program.sessions.length}" aria-valuenow="${weekDone}" aria-label="Séances réalisées cette semaine"><span style="width:${Math.min(100, (weekDone / program.sessions.length) * 100)}%"></span></div>
        <p class="hint">${weekDone >= program.sessions.length ? 'Objectif de la semaine atteint. Bravo !' : 'Chaque séance compte, à ton rythme.'}</p>
      </div>
    </section>` : ''}

    ${goals.length ? `
    <section class="block">
      <h2 class="block-title">Tes priorités</h2>
      <a class="card goal-list goal-list-link" href="#/profil">
        ${goals.slice(0, 3).map((id, i) => `<span><b>${i + 1}</b>${GOALS.find((g) => g.id === id)?.label ?? id}</span>`).join('')}
      </a>
    </section>` : ''}

    <section class="block">
      <h2 class="block-title">Journal alimentaire</h2>
      <a class="row-link card" href="#/nutrition">
        <span class="row-ico">${icon('nutrition')}</span>
        <span class="row-text">
          <span class="row-title">${entries.length ? 'Aujourd’hui' : 'Noter un repas'}</span>
          <span class="row-sub">${kcalText}</span>
        </span>
        ${icon('chevron', 'row-chev')}
      </a>
    </section>

    <section class="block">
      <h2 class="block-title">Dernières activités</h2>
      ${sessions.length ? `<div class="card list">${sessions.slice(0, 3).map((s) => `
        <a class="row-link" href="#/historique/${s.id}">
          <span class="row-ico">${icon('check')}</span>
          <span class="row-text"><span class="row-title">${esc(s.name)}</span><span class="row-sub">${SHORT.format(new Date(s.startedAt))} · ${minutesText(s.durationMin)}</span></span>
          ${icon('chevron', 'row-chev')}
        </a>`).join('')}</div>`
      : `<div class="card">${emptyState({ icon: 'list', title: 'Aucune activité enregistrée', text: 'Tes séances réalisées s’afficheront ici.' })}</div>`}
    </section>`;

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-start]');
    if (b) startSession(ctx, b.dataset.start);
  });
}
