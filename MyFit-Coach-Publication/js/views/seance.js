// Séance en direct (#/seance) et bilan de fin (#/seance/bilan).
// Tout est enregistré à chaque action : changer d'écran ou recharger ne perd rien.

import { pageHeader, icon, esc, openSheet, closeSheet, toast } from '../ui.js';
import { exerciseById, EXERCISES, MUSCLES } from '../data/exercises.js';
import { isAvailable } from '../training/program.js';
import { getActive, saveActive, clearActive, getGym, getSessions, addSession } from '../training/store.js';
import * as S from '../training/session.js';
import { suggestion } from '../training/progression.js';
import { parseFr, frNumber, normalize } from '../text.js';

export const title = 'Séance';
export const hideTabbar = true;

const DIFFICULTY = [
  [1, 'Très facile'], [2, 'Facile'], [3, 'Facile'], [4, 'Modérée'], [5, 'Modérée'],
  [6, 'Soutenue'], [7, 'Difficile'], [8, 'Très difficile'], [9, 'Presque au maximum'], [10, 'Maximale'],
];

function unitLabel(ex) {
  return ex.measure === 'minutes' ? 'min' : ex.measure === 'seconds' ? 's' : 'rép.';
}

function noSession(root) {
  root.innerHTML = `
    ${pageHeader({ title: 'Séance', back: '#/entrainement' })}
    <div class="card">
      <p class="empty-title">Aucune séance en cours</p>
      <p class="empty-text">Démarre une séance depuis l’onglet Entraînement.</p>
      <a class="btn btn-primary btn-block" href="#/entrainement">Aller à l’entraînement</a>
    </div>`;
}

// ---------- Séance en cours ----------

function renderLive(root, ctx) {
  const { store } = ctx;
  let s = getActive(store);
  if (!s) return noSession(root);
  const gym = getGym(store);
  const history = getSessions(store);

  function persist() {
    if (!saveActive(store, s)) toast('Attention : la séance n’a pas pu être enregistrée sur cet appareil.', 'error');
  }

  function setRow(item, i, set, j) {
    const ex = exerciseById(item.ex);
    const showWeight = ex.measure === 'reps' && !['temps', 'cardio'].includes(ex.load);
    const label = unitLabel(ex);
    if (set.done) {
      return `
        <div class="set-row done">
          <span class="set-num">${j + 1}</span>
          <span class="set-done-text">${showWeight && set.weight != null ? `${frNumber(set.weight)} kg × ` : ''}${frNumber(set.value)} ${label}</span>
          <button type="button" class="set-check on" data-undo="${i}:${j}" aria-label="Annuler la validation de la série ${j + 1}">${icon('check')}</button>
        </div>`;
    }
    return `
      <div class="set-row">
        <span class="set-num">${j + 1}</span>
        ${showWeight ? `<label class="set-field"><span class="sr-only">Charge série ${j + 1} en kg</span>
          <input type="text" inputmode="decimal" aria-label="Charge série ${j + 1}, en kg" data-w="${i}:${j}" value="${set.weight != null ? frNumber(set.weight) : ''}" placeholder="kg" autocomplete="off"></label>` : ''}
        <label class="set-field"><span class="sr-only">${label === 'rép.' ? 'Répétitions' : label === 's' ? 'Secondes' : 'Minutes'} série ${j + 1}</span>
          <input type="text" inputmode="decimal" aria-label="${label === 'rép.' ? 'Répétitions' : label === 's' ? 'Secondes' : 'Minutes'}, série ${j + 1}" data-v="${i}:${j}" value="${set.value != null ? frNumber(set.value) : ''}" placeholder="${label}" autocomplete="off"></label>
        <button type="button" class="set-check" data-done="${i}:${j}" aria-label="Valider la série ${j + 1}">${icon('check')}</button>
      </div>`;
  }

  function exerciseCard(item, i) {
    const ex = exerciseById(item.ex);
    const t = item.target;
    const range = t.reps ?? t.seconds ?? t.minutes;
    const tgt = range ? `${item.sets.length} × ${range[0]}–${range[1]} ${unitLabel(ex)}` : '';
    const doneCount = item.sets.filter((x) => x.done).length;
    const complete = doneCount === item.sets.length;
    const open = i === s.current;
    const sug = open ? suggestion(item.ex, t, history) : null;
    return `
      <section class="card ex-card${open ? ' open' : ''}${complete ? ' complete' : ''}" data-ex="${i}">
        <button type="button" class="ex-head" data-open="${i}" aria-expanded="${open}" aria-label="Exercice ${i + 1} : ${ex.name}, ${doneCount} sur ${item.sets.length} séries">
          <span class="ex-index">${complete ? icon('check') : i + 1}</span>
          <span class="row-text"><span class="row-title">${ex.name}</span>
          <span class="row-sub">${tgt} · ${doneCount}/${item.sets.length} série${item.sets.length > 1 ? 's' : ''}${item.replacedFrom ? ' · remplace ' + exerciseById(item.replacedFrom)?.name : ''}</span></span>
        </button>
        ${open ? `
          ${sug ? `<p class="sug">${icon('progress')}<span>${sug.text}</span></p>` : ''}
          <div class="sets">${item.sets.map((set, j) => setRow(item, i, set, j)).join('')}</div>
          <div class="ex-actions">
            <button type="button" class="mini-btn" data-add-set="${i}">${icon('plus')} Série</button>
            <button type="button" class="mini-btn" data-remove-set="${i}">− Série</button>
            <button type="button" class="mini-btn" data-replace="${i}">Remplacer</button>
            <button type="button" class="mini-btn" data-busy="${i}">Machine occupée</button>
            <a class="mini-btn" href="#/exercices/${ex.id}/seance">Fiche</a>
          </div>
          <label class="field-label small" for="note-${i}">Note</label>
          <textarea id="note-${i}" class="input input-sm" rows="1" maxlength="300" data-note="${i}" placeholder="Réglage de la machine, sensation…">${esc(item.note)}</textarea>` : ''}
      </section>`;
  }

  function draw() {
    root.innerHTML = `
      <div class="live-top">
        <a class="icon-btn" href="#/entrainement" aria-label="Réduire (la séance continue)">${icon('down')}</a>
        <div class="live-title">
          <span class="live-name">${esc(s.name)}</span>
          <span class="live-clock" id="clock" aria-live="off">${S.formatClock(S.elapsedMs(s))}</span>
        </div>
        <button type="button" class="icon-btn" data-act="pause" aria-label="${s.pausedAt ? 'Reprendre' : 'Mettre en pause'}">${s.pausedAt ? icon('play') : icon('pause')}</button>
      </div>
      <h1 class="sr-only page-title" tabindex="-1">Séance en cours : ${esc(s.name)}</h1>
      ${s.pausedAt ? `<p class="note note-warn">${icon('info')}<span>Séance en pause. Le chrono et le repos sont arrêtés.</span></p>` : ''}

      ${s.exercises.length ? s.exercises.map(exerciseCard).join('') : `
        <div class="card"><p class="empty-title">Séance libre</p><p class="empty-text">Ajoute ton premier exercice.</p></div>`}

      <button type="button" class="btn btn-ghost btn-block" data-act="add-ex">${icon('plus')} Ajouter un exercice</button>

      <section class="block">
        <label class="block-title" for="session-notes">Notes de séance</label>
        <textarea id="session-notes" class="input" rows="2" maxlength="600" data-session-notes placeholder="Comment ça s’est passé ?">${esc(s.notes)}</textarea>
      </section>

      <button type="button" class="btn btn-ghost btn-block danger-text" data-act="abandon">Abandonner la séance</button>

      <div class="rest-bar" id="rest-bar" hidden></div>
      <div class="q-footer live-footer">
        <span class="live-progress">${S.doneSetsCount(s)} série${S.doneSetsCount(s) > 1 ? 's' : ''} validée${S.doneSetsCount(s) > 1 ? 's' : ''}</span>
        <a class="btn btn-primary" href="#/seance/bilan">Terminer</a>
      </div>`;
    tick();
  }

  // Chrono et repos, mis à jour chaque seconde.
  let restWasRunning = false;
  function tick() {
    const clock = root.querySelector('#clock');
    if (clock) clock.textContent = S.formatClock(S.elapsedMs(s));
    const bar = root.querySelector('#rest-bar');
    if (!bar) return;
    const left = S.restRemainingMs(s);
    if (s.rest && left > 0) {
      restWasRunning = true;
      bar.hidden = false;
      const pct = Math.max(0, Math.min(100, (left / (s.rest.duration * 1000)) * 100));
      bar.innerHTML = `
        <div class="rest-fill" style="width:${pct}%"></div>
        <span class="rest-text">Repos <strong>${S.formatClock(left)}</strong></span>
        <button type="button" class="mini-btn" data-act="rest-plus">+15 s</button>
        <button type="button" class="mini-btn" data-act="rest-stop">Passer</button>`;
    } else if (s.rest && left <= 0) {
      bar.hidden = false;
      bar.innerHTML = `<span class="rest-text"><strong>Repos terminé</strong> · série suivante quand tu es prêt·e</span>
        <button type="button" class="mini-btn" data-act="rest-stop">OK</button>`;
      if (restWasRunning) {
        restWasRunning = false;
        try { navigator.vibrate?.(300); } catch { /* pas de vibration sur iPhone */ }
      }
    } else {
      bar.hidden = true;
    }
  }
  const timer = setInterval(tick, 500);

  draw();

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.w || t.dataset.v) {
      const [i, j] = (t.dataset.w || t.dataset.v).split(':').map(Number);
      const n = parseFr(t.value);
      const ok = n === null || !Number.isNaN(n);
      t.classList.toggle('invalid', !ok);
      if (ok) {
        S.setField(s, i, j, t.dataset.w ? 'weight' : 'value', n);
        // Pratique : la charge saisie est proposée pour les séries suivantes vides.
        // (sans tout redessiner, pour ne pas fermer le clavier).
        if (t.dataset.w && n !== null) {
          s.exercises[i].sets.forEach((x, k) => {
            if (k > j && !x.done && (x.weight == null || x.autoWeight)) {
              x.weight = n;
              x.autoWeight = true;
              const other = root.querySelector(`[data-w="${i}:${k}"]`);
              if (other && document.activeElement !== other) other.value = frNumber(n);
            }
          });
          s.exercises[i].sets[j].autoWeight = false;
        }
        persist();
      }
    } else if (t.dataset.note) {
      s.exercises[Number(t.dataset.note)].note = t.value;
      persist();
    } else if (t.hasAttribute('data-session-notes')) {
      s.notes = t.value;
      persist();
    }
  });


  function pick(ref) { return ref.split(':').map(Number); }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.open !== undefined) {
      s.current = Number(d.open);
      persist(); draw();
      root.querySelector(`[data-ex="${s.current}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (d.done) {
      const [i, j] = pick(d.done);
      const input = root.querySelector(`[data-v="${d.done}"]`);
      const v = parseFr(input?.value);
      if (v === null || Number.isNaN(v) || v <= 0) {
        toast(`Indique ${unitLabel(exerciseById(s.exercises[i].ex)) === 'rép.' ? 'le nombre de répétitions' : 'la durée'} avant de valider.`, 'error');
        input?.focus();
        return;
      }
      S.setField(s, i, j, 'value', v);
      const w = root.querySelector(`[data-w="${d.done}"]`);
      if (w) { const wv = parseFr(w.value); S.setField(s, i, j, 'weight', wv === null || Number.isNaN(wv) ? null : wv); }
      S.completeSet(s, i, j);
      persist(); draw();
    } else if (d.undo) {
      const [i, j] = pick(d.undo);
      S.uncompleteSet(s, i, j);
      persist(); draw();
    } else if (d.addSet) {
      S.addSet(s, Number(d.addSet)); persist(); draw();
    } else if (d.removeSet) {
      if (!S.removeSet(s, Number(d.removeSet))) toast('Il n’y a pas de série non validée à retirer.');
      persist(); draw();
    } else if (d.replace || d.busy) {
      const i = Number(d.replace ?? d.busy);
      const item = s.exercises[i];
      const ex = exerciseById(item.ex);
      const inSession = new Set(s.exercises.map((x) => x.ex));
      const options = [...new Set([ex.easier, ...ex.replacements].filter(Boolean))]
        .map(exerciseById)
        .filter((r) => r && !inSession.has(r.id) && (!gym || isAvailable(r, gym)));
      const sameMuscle = EXERCISES.filter((r) => r.pattern === ex.pattern && r.id !== ex.id && !inSession.has(r.id) && !options.includes(r) && (!gym || isAvailable(r, gym)));
      const list = [...options, ...sameMuscle].slice(0, 6);
      const busy = Boolean(d.busy);
      openSheet({
        title: busy ? 'Machine occupée' : 'Remplacer l’exercice',
        body: `
          ${busy ? `<button type="button" class="row-link choose" data-later="${i}"><span class="row-text"><span class="row-title">Le faire plus tard</span><span class="row-sub">Passe à l’exercice suivant, celui-ci va à la fin</span></span></button>` : ''}
          <p class="muted">${list.length ? 'Remplacer par un exercice qui travaille les mêmes muscles :' : 'Aucun remplacement disponible avec les équipements cochés.'}</p>
          <div class="list choose-list">${list.map((r) => `
            <button type="button" class="row-link" data-with="${r.id}"><span class="row-text"><span class="row-title">${r.name}</span><span class="row-sub">${r.muscles.map((m) => MUSCLES[m]).join(', ')}</span></span></button>`).join('')}</div>`,
      });
      document.querySelectorAll('#sheet-root [data-with]').forEach((x) => x.addEventListener('click', () => {
        if (item.sets.some((y) => y.done)) {
          // Les séries déjà faites sont gardées : le remplaçant est ajouté juste après.
          s.exercises.splice(i + 1, 0, null);
          const tmp = S.createSession({ planned: { exercises: [{ ex: x.dataset.with, ...item.target, sets: item.sets.filter((y) => !y.done).length || 1 }] } }).exercises[0];
          tmp.replacedFrom = item.ex;
          s.exercises[i + 1] = tmp;
          item.sets = item.sets.filter((y) => y.done);
          s.current = i + 1;
        } else {
          S.replaceExercise(s, i, x.dataset.with);
        }
        persist(); closeSheet(); draw();
        toast('Exercice remplacé.');
      }));
      document.querySelector('#sheet-root [data-later]')?.addEventListener('click', () => {
        S.moveToEnd(s, i); persist(); closeSheet(); draw();
        toast('Exercice déplacé à la fin de la séance.');
      });
    } else if (d.act === 'pause') {
      S.togglePause(s); persist(); draw();
    } else if (d.act === 'rest-plus') {
      S.addRest(s, 15); persist(); tick();
    } else if (d.act === 'rest-stop') {
      S.stopRest(s); persist(); tick();
    } else if (d.act === 'add-ex') {
      const inSession = new Set(s.exercises.map((x) => x.ex));
      const avail = EXERCISES.filter((x) => !inSession.has(x.id) && (!gym || isAvailable(x, gym)));
      openSheet({
        title: 'Ajouter un exercice',
        body: `<input class="input" type="search" id="add-q" placeholder="Rechercher" autocomplete="off">
               <div class="list choose-list" id="add-list"></div>`,
      });
      const listEl = document.getElementById('add-list');
      const fill = (q) => {
        const n = normalize(q);
        listEl.innerHTML = avail.filter((x) => !n || normalize(x.name).includes(n)).slice(0, 30)
          .map((x) => `<button type="button" class="row-link" data-add="${x.id}"><span class="row-text"><span class="row-title">${x.name}</span></span></button>`).join('')
          || '<p class="muted">Aucun résultat.</p>';
      };
      fill('');
      document.getElementById('add-q').addEventListener('input', (ev) => fill(ev.target.value));
      listEl.addEventListener('click', (ev) => {
        const add = ev.target.closest('[data-add]');
        if (!add) return;
        S.addExercise(s, add.dataset.add); persist(); closeSheet(); draw();
      });
    } else if (d.act === 'abandon') {
      openSheet({
        title: 'Abandonner la séance ?',
        body: '<p>La séance en cours sera effacée et <strong>ne sera pas comptée</strong> comme réalisée.</p><p class="muted">Si tu as fait une partie de la séance, choisis plutôt « Terminer » : seules les séries validées seront enregistrées.</p>',
        actions: [
          { label: 'Continuer', kind: 'ghost' },
          { label: 'Abandonner', kind: 'danger', onClick: () => { clearActive(store); toast('Séance abandonnée.'); ctx.navigate('#/entrainement'); } },
        ],
      });
    }
  });

  return () => clearInterval(timer);
}

// ---------- Bilan de fin ----------

function renderReview(root, ctx) {
  const { store } = ctx;
  const s = getActive(store);
  if (!s) return noSession(root);
  const done = S.doneSetsCount(s);
  const review = { difficulty: null, energy: null, pain: null, painNote: '', notes: s.notes || '' };
  const exercisesDone = s.exercises.filter((x) => x.sets.some((y) => y.done)).length;

  function draw() {
    root.innerHTML = `
      ${pageHeader({ title: 'Bilan de séance', back: '#/seance' })}
      <div class="card kv-card">
        <div class="kv"><span>Durée</span><span>${S.formatClock(S.elapsedMs(s))}</span></div>
        <div class="kv"><span>Exercices réalisés</span><span>${exercisesDone} / ${s.exercises.length}</span></div>
        <div class="kv"><span>Séries validées</span><span>${done}</span></div>
      </div>

      ${done ? `
      <fieldset class="field block-gap">
        <legend class="field-label">Difficulté ressentie</legend>
        <div class="opts opts-compact" style="--cols: 10">
          ${DIFFICULTY.map(([n, l]) => `<button type="button" class="opt" role="radio" aria-checked="${review.difficulty === n}" aria-label="${n} sur 10 : ${l}" data-diff="${n}">${n}</button>`).join('')}
        </div>
        <p class="field-hint">${review.difficulty ? `${review.difficulty}/10 : ${DIFFICULTY[review.difficulty - 1][1]}` : '1 = très facile · 10 = effort maximal'}</p>
      </fieldset>

      <fieldset class="field block-gap">
        <legend class="field-label">Ton énergie</legend>
        <div class="opts">${[['basse', 'Basse'], ['normale', 'Normale'], ['haute', 'Haute']].map(([v, l]) => `<button type="button" class="opt" role="radio" aria-checked="${review.energy === v}" data-energy="${v}">${l}</button>`).join('')}</div>
      </fieldset>

      <fieldset class="field block-gap">
        <legend class="field-label">Une douleur pendant la séance ?</legend>
        <div class="opts">${[['non', 'Non'], ['oui', 'Oui']].map(([v, l]) => `<button type="button" class="opt" role="radio" aria-checked="${review.pain === v}" data-pain="${v}">${l}</button>`).join('')}</div>
        ${review.pain === 'oui' ? `
          <textarea class="input" rows="2" maxlength="300" data-pain-note placeholder="Où, et pendant quel exercice ?">${esc(review.painNote)}</textarea>
          <p class="note note-warn">${icon('info')}<span>Si la douleur persiste, est vive ou inhabituelle, consulte un professionnel de santé. Les prochaines suggestions n’augmenteront pas la charge sur cet exercice.</span></p>` : ''}
      </fieldset>

      <div class="field block-gap">
        <label class="field-label" for="rev-notes">Notes</label>
        <textarea id="rev-notes" class="input" rows="3" maxlength="600" data-notes>${esc(review.notes)}</textarea>
      </div>

      <button type="button" class="btn btn-primary btn-block btn-lg" data-act="save">Enregistrer la séance</button>
      <p class="hint">Seules les séries validées sont enregistrées. Une séance prévue mais non faite n’est jamais comptée.</p>`
      : `
      <div class="card block-gap">
        <p class="empty-title">Aucune série validée</p>
        <p class="empty-text">Il n’y a rien à enregistrer. Tu peux revenir à la séance, ou l’abandonner.</p>
        <div class="btn-row"><a class="btn btn-ghost" href="#/seance">Revenir</a><button type="button" class="btn btn-danger" data-act="abandon">Abandonner</button></div>
      </div>`}`;
  }
  draw();

  root.addEventListener('input', (e) => {
    if (e.target.hasAttribute('data-pain-note')) review.painNote = e.target.value;
    if (e.target.hasAttribute('data-notes')) review.notes = e.target.value;
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    const y = window.scrollY;
    if (d.diff) { review.difficulty = review.difficulty === Number(d.diff) ? null : Number(d.diff); draw(); }
    else if (d.energy) { review.energy = review.energy === d.energy ? null : d.energy; draw(); }
    else if (d.pain) { review.pain = review.pain === d.pain ? null : d.pain; draw(); }
    else if (d.act === 'save') {
      const record = S.finishSession(s, review);
      if (!addSession(store, record)) { toast('Impossible d’enregistrer la séance. Réessaie.', 'error'); return; }
      clearActive(store);
      toast('Séance enregistrée. Bravo !');
      ctx.navigate(`#/historique/${record.id}`);
      return;
    } else if (d.act === 'abandon') {
      clearActive(store); toast('Séance abandonnée.'); ctx.navigate('#/entrainement'); return;
    } else return;
    window.scrollTo(0, y);
    root.querySelector(`[data-${Object.keys(d)[0].replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}="${Object.values(d)[0]}"]`)?.focus({ preventScroll: true });
  });
}

export function render(root, ctx) {
  root.classList.add('view-live');
  if (ctx.params[0] === 'bilan') return renderReview(root, ctx);
  return renderLive(root, ctx);
}
