// Progression : statistiques, graphiques, mesures et bilan de la semaine.
// Tout est calculé à l'ouverture de la page à partir des données enregistrées.

import { pageHeader, profileButton, emptyState, icon, esc, openSheet, toast } from '../ui.js';
import { addDays, isoDate, fromIso } from '../dates.js';
import { getSessions, getProgram } from '../training/store.js';
import { exerciseById } from '../data/exercises.js';
import {
  sessionsBetween, sessionsPerWeek, regularity, setsCount, average, exerciseSeries, nutritionTrend, weeklyReview, weekRange,
} from '../stats.js';
import { barChart, lineChart, bindChartTips } from '../charts.js';
import { frNumber, parseFr, uid, minutesText } from '../text.js';

export const title = 'Progression';

const PERIODS = [
  { id: 'semaine', label: 'Semaine', weeks: 1, text: 'cette semaine' },
  { id: 'mois', label: 'Mois', weeks: 4, text: 'ces 4 dernières semaines' },
  { id: '3mois', label: '3 mois', weeks: 13, text: 'ces 3 derniers mois' },
  { id: 'tout', label: 'Tout', weeks: null, text: 'depuis le début' },
];
const MEASURES = [
  { id: 'poids', label: 'Poids', unit: 'kg', min: 30, max: 300 },
  { id: 'taille', label: 'Tour de taille', unit: 'cm', min: 40, max: 200 },
  { id: 'hanches', label: 'Tour de hanches', unit: 'cm', min: 50, max: 220 },
  { id: 'cuisse', label: 'Tour de cuisse', unit: 'cm', min: 25, max: 120 },
  { id: 'bras', label: 'Tour de bras', unit: 'cm', min: 15, max: 70 },
];
const SHORT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
let period = 'mois';
let chosenEx = null;
let chosenMeasure = 'poids';

export function render(root, ctx) {
  const { store } = ctx;
  const now = new Date();

  function draw() {
    const sessions = getSessions(store);
    const program = getProgram(store);
    const journal = store.get('journal', {});
    const measures = [...store.get('measures', [])].sort((a, b) => a.date.localeCompare(b.date));
    const p = PERIODS.find((x) => x.id === period);
    const { to } = weekRange(now);
    const first = sessions.length ? new Date(sessions[sessions.length - 1].startedAt) : now;
    const from = p.weeks ? addDays(weekRange(now).from, -7 * (p.weeks - 1)) : weekRange(first).from;
    const inPeriod = sessionsBetween(sessions, from, to);
    const weeksCount = Math.max(1, Math.round((to - from) / (7 * 86400000)));
    const reg = regularity(inPeriod.length ? sessions : [], weeksCount, now);
    const diff = average(inPeriod.map((s) => s.review?.difficulty));
    const nut = nutritionTrend(journal, from, to);
    const review = weeklyReview({ sessions, program, journal, targets: store.get('nutritionTargets') }, now);

    // Exercices faits au moins une fois (pour le graphique d'évolution).
    const doneEx = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.ex)))];
    if (!doneEx.includes(chosenEx)) chosenEx = doneEx[0] ?? null;
    const series = chosenEx ? exerciseSeries(sessions, chosenEx).filter((x) => new Date(x.date) >= from) : [];
    const useWeight = series.some((x) => x.weight);
    const exPoints = series.map((x) => ({
      x: new Date(x.date), y: useWeight ? (x.weight ?? 0) : x.value, label: SHORT.format(new Date(x.date)),
    }));
    const ex = chosenEx && exerciseById(chosenEx);
    const valueUnit = useWeight ? ' kg' : ex?.measure === 'minutes' ? ' min' : ex?.measure === 'seconds' ? ' s' : ' rép.';

    const weeks = sessionsPerWeek(sessions, Math.min(12, Math.max(4, weeksCount)), now); // 4 à 12 barres
    const mDef = MEASURES.find((m) => m.id === chosenMeasure);
    const mPoints = measures.filter((m) => typeof m[chosenMeasure] === 'number' && fromIso(m.date) >= from)
      .map((m) => ({ x: fromIso(m.date), y: m[chosenMeasure], label: SHORT.format(fromIso(m.date)) }));

    const tile = (label, value, need) => `
      <div class="stat card">
        <p class="stat-label">${label}</p>
        <p class="stat-value${value === null ? ' empty-val' : ''}">${value ?? '—'}</p>
        ${value === null ? `<p class="stat-need">${need}</p>` : ''}
      </div>`;

    root.innerHTML = `
      ${pageHeader({ title: 'Progression', eyebrow: 'Tes statistiques', actions: profileButton })}

      <div class="segmented" role="tablist" aria-label="Période">
        ${PERIODS.map((x) => `<button type="button" role="tab" aria-selected="${x.id === period}" class="${x.id === period ? 'on' : ''}" data-period="${x.id}">${x.label}</button>`).join('')}
      </div>

      <div class="stats">
        ${tile('Séances réalisées', sessions.length ? String(inPeriod.length) : null, 'Il faut une séance terminée')}
        ${tile('Régularité', reg && inPeriod.length ? `${reg.active}/${reg.total} sem.` : null, 'Semaines avec au moins une séance')}
        ${tile('Séries validées', inPeriod.length ? String(setsCount(inPeriod)) : null, 'Il faut une séance terminée')}
        ${tile('Ressenti moyen', diff !== null ? `${frNumber(diff)}/10` : null, 'Indique ton ressenti en fin de séance')}
      </div>

      <section class="block">
        <h2 class="block-title">Bilan de la semaine</h2>
        <div class="card review">
          ${review.enoughData ? `
            ${review.wins.length ? `<p class="review-h">Ce que tu as fait</p><ul>${review.wins.map((w) => `<li>${w}</li>`).join('')}</ul>` : ''}
            ${review.planned !== null ? `<p class="row-sub">${review.sessions.length} séance${review.sessions.length > 1 ? 's' : ''} sur ${review.planned} prévue${review.planned > 1 ? 's' : ''} cette semaine.</p>` : ''}
            ${review.watch.length ? `<p class="review-h">À surveiller</p><ul>${review.watch.map((w) => `<li>${w}</li>`).join('')}</ul>` : ''}
            ${review.next.length ? `<p class="review-h">Pour la semaine prochaine</p><ul>${review.next.map((w) => `<li>${w}</li>`).join('')}</ul>` : ''}
            <p class="hint">Calculé à l’ouverture de cette page. Aucun bilan n’est envoyé automatiquement.</p>`
          : emptyState({ icon: 'target', title: 'Pas encore de données cette semaine', text: 'Le bilan apparaîtra dès qu’une séance ou un repas sera enregistré. Une semaine plus calme n’est pas un échec.' })}
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">Séances par semaine</h2>
        <div class="card">
          ${sessions.length ? barChart(weeks.map((w) => ({
            label: SHORT.format(w.start).replace(/\.$/, ''), value: w.count,
            tip: `Semaine du ${SHORT.format(w.start)} : ${w.count} séance${w.count > 1 ? 's' : ''}`,
          })), { summary: `Séances par semaine sur ${weeks.length} semaines : ${weeks.map((w) => w.count).join(', ')}.`, headers: ['Semaine du', 'Séances'], integer: true })
          : emptyState({ icon: 'progress', title: 'Pas encore de séance', text: 'Le graphique apparaîtra après ta première séance terminée.' })}
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">Évolution par exercice</h2>
        <div class="card">
          ${doneEx.length ? `
            <label class="sr-only" for="ex-select">Exercice</label>
            <select class="input" id="ex-select">${doneEx.map((id) => `<option value="${id}" ${id === chosenEx ? 'selected' : ''}>${exerciseById(id)?.name ?? id}</option>`).join('')}</select>
            ${exPoints.length >= 2
              ? `<p class="chart-caption">${useWeight ? 'Charge la plus lourde' : 'Meilleure série'} par séance (${p.text})</p>
                 ${lineChart(exPoints, { summary: `${ex.name} : de ${frNumber(exPoints[0].y)} à ${frNumber(exPoints[exPoints.length - 1].y)}${valueUnit}`, unit: valueUnit, headers: ['Séance', useWeight ? 'Charge max' : 'Meilleure série'] })}`
              : `<p class="hint">Il faut au moins deux séances avec cet exercice ${p.text} pour tracer une évolution${exPoints.length ? ` (1 séance pour l’instant : ${frNumber(exPoints[0].y)}${valueUnit})` : ''}.</p>`}`
          : emptyState({ icon: 'list', title: 'Aucun exercice suivi', text: 'Chaque exercice réalisé aura sa courbe : charges, répétitions. Aucune courbe n’est dessinée sans vraies données.' })}
        </div>
      </section>

      <section class="block">
        <div class="meal-head"><h2 class="block-title">Mesures (facultatives)</h2>
          <button type="button" class="link-btn" data-act="add-measure">${icon('plus')} Ajouter</button></div>
        <div class="card">
          ${measures.length ? `
            <div class="chips-scroll in-card">${MEASURES.filter((m) => measures.some((x) => typeof x[m.id] === 'number')).map((m) => `<button type="button" class="chip" aria-pressed="${m.id === chosenMeasure}" data-measure="${m.id}">${m.label}</button>`).join('')}</div>
            ${mPoints.length >= 2 ? lineChart(mPoints, { summary: `${mDef.label} : de ${frNumber(mPoints[0].y)} à ${frNumber(mPoints[mPoints.length - 1].y)} ${mDef.unit}`, unit: ' ' + mDef.unit, headers: ['Date', mDef.label] })
              : `<p class="hint">${mPoints.length ? `Une seule mesure ${p.text} : ${frNumber(mPoints[0].y)} ${mDef.unit}. Il en faut deux pour une courbe.` : `Aucune mesure de ${mDef.label.toLowerCase()} ${p.text}.`}</p>`}
            <ul class="measure-list">${[...measures].reverse().slice(0, 6).map((m) => `
              <li><span>${SHORT.format(fromIso(m.date))}</span><span>${MEASURES.filter((d) => typeof m[d.id] === 'number').map((d) => `${d.label.replace('Tour de ', '')} ${frNumber(m[d.id])} ${d.unit}`).join(' · ')}</span>
              <button type="button" class="link-btn danger-text" data-del-measure="${m.id}" aria-label="Supprimer la mesure du ${SHORT.format(fromIso(m.date))}">Suppr.</button></li>`).join('')}</ul>`
          : emptyState({ icon: 'target', title: 'Aucune mesure', text: 'Tu peux suivre ton poids ou tes tours de taille si tu le souhaites. Ce n’est jamais obligatoire.' })}
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">Alimentation</h2>
        <div class="card kv-card">
          <div class="kv"><span>Jours de journal ${p.text}</span><span>${nut.loggedDays}</span></div>
          <div class="kv"><span>Jours complets (valeurs toutes connues)</span><span>${nut.completeDays}</span></div>
          <div class="kv"><span>Énergie moyenne</span><span>${nut.avgKcal !== null ? `${Math.round(nut.avgKcal)} kcal` : '—'}</span></div>
          <div class="kv"><span>Protéines moyennes</span><span>${nut.avgProt !== null ? `${Math.round(nut.avgProt)} g` : '—'}</span></div>
        </div>
        <p class="hint">Les moyennes demandent au moins 3 jours complets, pour ne pas tirer de conclusion sur trop peu de données.</p>
      </section>

      <section class="block">
        <h2 class="block-title">Historique ${p.text}</h2>
        ${inPeriod.length ? `<div class="card list">${inPeriod.map((s) => `
          <a class="row-link" href="#/historique/${s.id}"><span class="row-text"><span class="row-title">${esc(s.name)}</span>
          <span class="row-sub">${SHORT.format(new Date(s.startedAt))} · ${minutesText(s.durationMin)}${s.review?.difficulty ? ` · ressenti ${s.review.difficulty}/10` : ''}</span></span>${icon('chevron', 'row-chev')}</a>`).join('')}</div>`
        : `<div class="card">${emptyState({ icon: 'clock', title: 'Aucune séance sur cette période', text: '' })}</div>`}
      </section>`;
  }
  draw();
  bindChartTips(root);

  function addMeasure() {
    openSheet({
      title: 'Nouvelle mesure',
      body: `
        <p class="muted">Remplis seulement ce que tu veux suivre.</p>
        <label class="field"><span class="field-label small">Date</span><input class="input" type="date" id="m-date" value="${isoDate(now)}" max="${isoDate(now)}"></label>
        <div class="free-grid">${MEASURES.map((m) => `<label class="field"><span class="field-label small">${m.label} (${m.unit})</span><input class="input" data-m="${m.id}" inputmode="decimal" autocomplete="off"></label>`).join('')}</div>`,
      actions: [
        { label: 'Annuler', kind: 'ghost' },
        { label: 'Enregistrer', kind: 'primary', onClick: () => {
          const date = document.getElementById('m-date').value;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > isoDate(now)) { toast('Choisis une date (pas dans le futur).', 'error'); return false; }
          const entry = { id: uid(), date };
          for (const m of MEASURES) {
            const v = parseFr(document.querySelector(`[data-m="${m.id}"]`).value);
            if (v === null) continue;
            if (Number.isNaN(v) || v < m.min || v > m.max) { toast(`${m.label} : valeur entre ${m.min} et ${m.max} ${m.unit}.`, 'error'); return false; }
            entry[m.id] = v;
          }
          if (Object.keys(entry).length <= 2) { toast('Remplis au moins une mesure.', 'error'); return false; }
          if (!store.set('measures', [...store.get('measures', []), entry])) { toast('Enregistrement impossible.', 'error'); return false; }
          if (!(chosenMeasure in entry)) chosenMeasure = MEASURES.find((m) => m.id in entry).id;
          toast('Mesure enregistrée.');
          draw();
          return true;
        } },
      ],
    });
  }

  root.addEventListener('change', (e) => {
    if (e.target.id === 'ex-select') { chosenEx = e.target.value; draw(); }
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-period]');
    if (b) { period = b.dataset.period; draw(); root.querySelector(`[data-period="${period}"]`)?.focus(); return; }
    const m = e.target.closest('[data-measure]');
    if (m) { chosenMeasure = m.dataset.measure; draw(); return; }
    if (e.target.closest('[data-act="add-measure"]')) { addMeasure(); return; }
    const del = e.target.closest('[data-del-measure]')?.dataset.delMeasure;
    if (del) {
      openSheet({
        title: 'Supprimer cette mesure ?',
        body: '<p>Elle sera retirée de ton suivi. Cette action est définitive.</p>',
        actions: [{ label: 'Annuler', kind: 'ghost' }, { label: 'Supprimer', kind: 'danger', onClick: () => {
          store.set('measures', store.get('measures', []).filter((x) => x.id !== del)); toast('Mesure supprimée.'); draw();
        } }],
      });
    }
  });
}
