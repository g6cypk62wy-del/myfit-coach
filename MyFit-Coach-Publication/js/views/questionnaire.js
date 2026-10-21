// Questionnaire de profil : une étape par écran, enregistrement automatique,
// puis une synthèse modifiable avant validation.

import { icon, esc, openSheet, toast } from '../ui.js';
import {
  STEPS, visibleFields, parseNumber, stepErrors, stepWarnings, stepStatus, missingEssentials,
  formatValue, toggleMulti, toggleRank, moveRank, isAnswered,
} from '../profile-schema.js';
import {
  ensureDraft, saveDraftStep, validateDraft, discardDraft, draftHasChanges, getProfile, STEP_COUNT,
} from '../profile-store.js';

export const title = 'Mon profil';
export const hideTabbar = true;

const STATUS_LABEL = { manquant: 'Manquant', incomplet: 'Incomplet', renseigne: 'Renseigné' };

function progress(current) {
  return `
    <nav class="steps" aria-label="Étapes du questionnaire">
      ${STEPS.map((s, i) => `
        <a href="#/questionnaire/${i + 1}" class="step-dot${i + 1 === current ? ' on' : ''}${i + 1 < current ? ' done' : ''}"
           aria-label="Étape ${i + 1} : ${s.title}"${i + 1 === current ? ' aria-current="step"' : ''}></a>`).join('')}
      <a href="#/questionnaire/synthese" class="step-dot step-dot-end${current === 'synthese' ? ' on' : ''}" aria-label="Synthèse"${current === 'synthese' ? ' aria-current="step"' : ''}></a>
    </nav>`;
}

function topBar(label) {
  return `
    <div class="q-top">
      <a class="icon-btn" href="#/profil" data-act="quit" aria-label="Quitter le questionnaire">${icon('close')}</a>
      <span class="q-step-label">${label}</span>
      <span class="save-state" id="save-state" aria-live="polite"></span>
    </div>`;
}

// ---------- Rendu des champs ----------

function tags(f) {
  if (f.essential) return '<span class="tag tag-essential">Essentiel</span>';
  if (f.optional) return '<span class="tag">Facultatif</span>';
  return '';
}

function fieldShell(f, inner, error, { legend = false } = {}) {
  const hint = f.hint ? `<p class="field-hint" id="h-${f.id}">${f.hint}</p>` : '';
  const err = `<p class="field-error" id="e-${f.id}" ${error ? '' : 'hidden'}>${error ? esc(error) : ''}</p>`;
  if (legend) {
    return `<fieldset class="field" data-field="${f.id}"><legend class="field-label">${f.label} ${tags(f)}</legend>${hint}${inner}${err}</fieldset>`;
  }
  return `<div class="field" data-field="${f.id}"><label class="field-label" for="f-${f.id}">${f.label} ${tags(f)}</label>${hint}${inner}${err}</div>`;
}

function describedBy(f) {
  return `aria-describedby="${f.hint ? `h-${f.id} ` : ''}e-${f.id}"`;
}

function renderField(f, value, error, rawNumber) {
  switch (f.type) {
    case 'number': {
      const shown = rawNumber ?? (isAnswered(value) ? String(value).replace('.', ',') : '');
      return fieldShell(f, `
        <div class="input-unit">
          <input id="f-${f.id}" data-input="${f.id}" type="text" inputmode="${f.integer ? 'numeric' : 'decimal'}"
                 autocomplete="off" value="${esc(shown)}" ${describedBy(f)} ${error ? 'aria-invalid="true"' : ''}>
          <span class="unit">${f.unit}</span>
        </div>`, error);
    }
    case 'text':
      return fieldShell(f, `<input id="f-${f.id}" class="input" data-input="${f.id}" type="text" maxlength="${f.maxLength}"
        placeholder="${esc(f.placeholder || '')}" value="${esc(value || '')}" ${describedBy(f)}>`, error);
    case 'textarea':
      return fieldShell(f, `<textarea id="f-${f.id}" class="input" data-input="${f.id}" rows="3" maxlength="${f.maxLength}"
        ${describedBy(f)}>${esc(value || '')}</textarea>`, error);
    case 'choice':
      return fieldShell(f, `
        <div class="opts${f.compact ? ' opts-compact' : ''}" role="radiogroup" style="--cols: ${f.options.length}">
          ${f.options.map((o) => `<button type="button" class="opt" role="radio" aria-checked="${value === o.id}"
              data-pick="${f.id}" data-opt="${o.id}">${o.label}</button>`).join('')}
        </div>`, error, { legend: true });
    case 'multi':
      return fieldShell(f, `
        <div class="opts${f.compact ? ' opts-compact opts-days' : ''}" style="--cols: ${f.options.length}">
          ${f.options.map((o) => `<button type="button" class="opt" aria-pressed="${(value || []).includes(o.id)}"
              data-multi="${f.id}" data-opt="${o.id}">${o.label}</button>`).join('')}
        </div>`, error, { legend: true });
    case 'rank': {
      const list = value || [];
      const label = (id) => f.options.find((o) => o.id === id)?.label ?? id;
      return fieldShell(f, `
        ${list.length ? `<ol class="rank-list">
          ${list.map((id, i) => `
            <li>
              <span class="rank-num">${i + 1}</span>
              <span class="rank-label">${label(id)}</span>
              <button type="button" class="icon-btn rank-btn" data-rank-move="${id}" data-delta="-1" ${i === 0 ? 'disabled' : ''} aria-label="Monter ${label(id)}">${icon('up')}</button>
              <button type="button" class="icon-btn rank-btn" data-rank-move="${id}" data-delta="1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Descendre ${label(id)}">${icon('down')}</button>
            </li>`).join('')}
        </ol>` : '<p class="field-hint">Aucun objectif choisi pour l’instant.</p>'}
        <div class="opts">
          ${f.options.map((o) => `<button type="button" class="opt" aria-pressed="${list.includes(o.id)}"
              data-rank="${f.id}" data-opt="${o.id}">${o.label}</button>`).join('')}
        </div>`, error, { legend: true });
    }
    default:
      return '';
  }
}

// ---------- Étape ----------

function renderStep(root, ctx, n) {
  const { store } = ctx;
  const step = STEPS[n - 1];
  const draft = ensureDraft(store);
  if (!draft) {
    root.innerHTML = '<div class="error-state" role="alert"><p class="empty-title">Impossible d’enregistrer sur cet appareil.</p><p class="empty-text">Le questionnaire ne peut pas être sauvegardé. Vérifie que Safari n’est pas en navigation privée.</p></div>';
    return;
  }
  const data = { ...(draft.data[step.id] || {}) };
  const rawNumbers = {}; // saisies de nombres en cours, même invalides
  const shownErrors = {};
  saveDraftStep(store, step.id, data, n); // mémorise l'étape en cours

  root.innerHTML = `
    ${topBar(`Étape ${n} sur ${STEP_COUNT}`)}
    ${progress(n)}
    <header class="q-head">
      <h1 class="page-title" tabindex="-1">${step.title}</h1>
      <p class="q-intro">${step.intro}</p>
    </header>
    <form class="q-form" id="q-form" novalidate>
      <div id="q-fields"></div>
      <div id="q-warnings" aria-live="polite"></div>
    </form>
    <div class="q-footer">
      ${n > 1 ? `<a class="btn btn-ghost" href="#/questionnaire/${n - 1}">Précédent</a>` : '<a class="btn btn-ghost" href="#/profil">Plus tard</a>'}
      <button type="submit" form="q-form" class="btn btn-primary">${n < STEP_COUNT ? 'Suivant' : 'Voir la synthèse'}</button>
    </div>`;

  const fieldsEl = root.querySelector('#q-fields');
  const warnEl = root.querySelector('#q-warnings');
  const saveState = root.querySelector('#save-state');

  function drawFields(focusSelector) {
    const savedErrors = stepErrors(step, data);
    fieldsEl.innerHTML = visibleFields(step, data)
      .map((f) => renderField(f, data[f.id], shownErrors[f.id] || savedErrors[f.id], rawNumbers[f.id]))
      .join('');
    if (focusSelector) fieldsEl.querySelector(focusSelector)?.focus();
  }

  function drawWarnings() {
    const w = stepWarnings(step, data);
    warnEl.innerHTML = w.map((t) => `<p class="note note-warn">${icon('info')}<span>${t}</span></p>`).join('');
  }

  let saveTimer;
  function save(now = false) {
    clearTimeout(saveTimer);
    const run = () => {
      const ok = saveDraftStep(store, step.id, data, n);
      saveState.textContent = ok ? 'Enregistré' : 'Non enregistré';
      saveState.classList.toggle('save-error', !ok);
    };
    if (now) run();
    else saveTimer = setTimeout(run, 350);
  }

  function setError(id, message) {
    if (message) shownErrors[id] = message;
    else delete shownErrors[id];
    const el = root.querySelector(`#e-${id}`);
    const input = root.querySelector(`#f-${id}`);
    if (el) { el.textContent = message || ''; el.hidden = !message; }
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  drawFields();
  drawWarnings();

  root.addEventListener('input', (e) => {
    const id = e.target.dataset.input;
    if (!id) return;
    const f = step.fields.find((x) => x.id === id);
    if (f.type === 'number') {
      rawNumbers[id] = e.target.value;
      const { value, error } = parseNumber(f, e.target.value);
      if (!error) {
        if (value === undefined) delete data[id]; else data[id] = value;
        setError(id, null);
        save();
        drawWarnings();
      } else if (shownErrors[id]) {
        setError(id, error); // l'erreur affichée suit la saisie
      }
    } else {
      if (e.target.value.trim()) data[id] = e.target.value; else delete data[id];
      save();
    }
  });

  // En quittant un champ nombre : on montre l'erreur s'il y en a une.
  root.addEventListener('change', (e) => {
    const id = e.target.dataset.input;
    const f = id && step.fields.find((x) => x.id === id);
    if (f?.type !== 'number') return;
    const { error } = parseNumber(f, e.target.value);
    setError(id, error || null);
    if (error) delete data[id];
    save(true);
  });

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    let focus;
    if (t.dataset.pick) {
      const id = t.dataset.pick;
      data[id] = data[id] === t.dataset.opt ? undefined : t.dataset.opt; // re-toucher = désélectionner
      if (data[id] === undefined) delete data[id];
      focus = `[data-pick="${id}"][data-opt="${t.dataset.opt}"]`;
    } else if (t.dataset.multi) {
      const f = step.fields.find((x) => x.id === t.dataset.multi);
      data[f.id] = toggleMulti(f, data[f.id], t.dataset.opt);
      if (!data[f.id].length) delete data[f.id];
      focus = `[data-multi="${f.id}"][data-opt="${t.dataset.opt}"]`;
    } else if (t.dataset.rank) {
      const id = t.dataset.rank;
      data[id] = toggleRank(data[id], t.dataset.opt);
      if (!data[id].length) delete data[id];
      focus = `[data-rank="${id}"][data-opt="${t.dataset.opt}"]`;
    } else if (t.dataset.rankMove) {
      const f = step.fields.find((x) => x.type === 'rank');
      data[f.id] = moveRank(data[f.id], t.dataset.rankMove, Number(t.dataset.delta));
      focus = `[data-rank-move="${t.dataset.rankMove}"][data-delta="${t.dataset.delta}"]:not([disabled])`;
    } else {
      return;
    }
    // Les champs nombres en cours de saisie sont conservés tels quels.
    drawFields(focus);
    drawWarnings();
    save(true);
  });

  root.querySelector('#q-form').addEventListener('submit', (e) => {
    e.preventDefault();
    // Vérifie les nombres saisis, même ceux qui n'ont pas encore été quittés.
    for (const f of visibleFields(step, data).filter((x) => x.type === 'number')) {
      const input = root.querySelector(`#f-${f.id}`);
      const { error } = parseNumber(f, input?.value);
      setError(f.id, error || null);
    }
    const errors = { ...stepErrors(step, data), ...shownErrors };
    const first = Object.keys(errors)[0];
    if (first) {
      drawFields();
      root.querySelector(`[data-field="${first}"] input, [data-field="${first}"] textarea, [data-field="${first}"] button`)?.focus();
      toast('Une réponse est à corriger avant de continuer.', 'error');
      return;
    }
    save(true);
    ctx.navigate(n < STEP_COUNT ? `#/questionnaire/${n + 1}` : '#/questionnaire/synthese');
  });

  return () => { clearTimeout(saveTimer); saveDraftStep(store, step.id, data, n); };
}

// ---------- Synthèse ----------

function renderSummary(root, ctx) {
  const { store } = ctx;
  const draft = ensureDraft(store);
  if (!draft) {
    root.innerHTML = '<div class="error-state" role="alert"><p class="empty-title">Impossible d’enregistrer sur cet appareil.</p></div>';
    return;
  }
  const editing = Boolean(getProfile(store));
  const changed = draftHasChanges(store);
  const missing = missingEssentials(draft.data);
  const warnings = STEPS.flatMap((s) => stepWarnings(s, draft.data[s.id] || {}));

  root.innerHTML = `
    ${topBar('Synthèse')}
    ${progress('synthese')}
    <header class="q-head">
      <h1 class="page-title" tabindex="-1">Synthèse</h1>
      <p class="q-intro">Vérifie tes réponses. Tu peux tout modifier avant de valider, et encore après.</p>
    </header>

    ${missing.length ? `
    <div class="card card-warn">
      <p class="row-title">Il manque ${missing.length} info${missing.length > 1 ? 's' : ''} essentielle${missing.length > 1 ? 's' : ''}</p>
      <ul class="missing">${missing.map((m) => `<li><a class="link-inline" href="#/questionnaire/${STEPS.findIndex((s) => s.id === m.step) + 1}">${m.label}</a></li>`).join('')}</ul>
      <p class="row-sub">Tu peux valider quand même, mais l’app ne créera pas de programme définitif tant qu’il manque une info essentielle.</p>
    </div>` : ''}

    ${warnings.map((t) => `<p class="note note-warn">${icon('info')}<span>${t}</span></p>`).join('')}

    ${STEPS.map((s, i) => {
      const d = draft.data[s.id] || {};
      const fields = visibleFields(s, d);
      const answered = fields.filter((f) => isAnswered(d[f.id]));
      const unanswered = fields.length - answered.length;
      const status = stepStatus(s, d);
      return `
        <section class="card summary">
          <div class="summary-head">
            <h2>${s.title}</h2>
            <span class="pill pill-${status}">${STATUS_LABEL[status]}</span>
          </div>
          ${answered.length ? `<dl class="summary-list">
            ${answered.map((f) => `<div><dt>${f.label}</dt><dd>${esc(formatValue(f, d[f.id]))}</dd></div>`).join('')}
          </dl>` : '<p class="row-sub">Aucune réponse pour l’instant.</p>'}
          ${answered.length && unanswered ? `<p class="row-sub">${unanswered} question${unanswered > 1 ? 's' : ''} sans réponse</p>` : ''}
          <a class="btn btn-ghost btn-sm" href="#/questionnaire/${i + 1}">Modifier</a>
        </section>`;
    }).join('')}

    <div class="summary-actions">
      <button type="button" class="btn btn-primary btn-block btn-lg" data-act="validate" ${editing && !changed ? 'disabled' : ''}>
        ${editing ? 'Valider les modifications' : 'Valider mon profil'}
      </button>
      ${editing && changed ? '<button type="button" class="btn btn-ghost btn-block" data-act="discard">Annuler les modifications</button>' : ''}
      ${editing && !changed ? '<p class="hint">Aucune modification par rapport à ton profil validé.</p>' : ''}
    </div>`;

  function doValidate() {
    const profile = validateDraft(store);
    if (!profile) {
      toast('Le profil n’a pas pu être enregistré. Réessaie.', 'error');
      return;
    }
    toast(editing ? 'Modifications enregistrées.' : 'Profil enregistré.');
    ctx.navigate('#/profil');
  }

  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'validate') {
      if (!missing.length) { doValidate(); return; }
      openSheet({
        title: 'Valider sans tout remplir ?',
        body: `<p>Il manque encore : <strong>${missing.map((m) => m.label.toLowerCase()).join(', ')}</strong>.</p>
               <p>Ton profil sera enregistré, mais l’app ne créera pas de programme définitif tant que ces infos manquent.</p>`,
        actions: [
          { label: 'Compléter', kind: 'ghost', onClick: () => ctx.navigate(`#/questionnaire/${STEPS.findIndex((s) => s.id === missing[0].step) + 1}`) },
          { label: 'Valider', kind: 'primary', onClick: doValidate },
        ],
      });
    } else if (act === 'discard') {
      openSheet({
        title: 'Annuler les modifications ?',
        body: '<p>Ton profil validé reste tel quel. Seules les modifications en cours sont effacées.</p>',
        actions: [
          { label: 'Garder', kind: 'ghost' },
          {
            label: 'Annuler les modifications',
            kind: 'danger',
            onClick: () => {
              discardDraft(store);
              toast('Modifications annulées.');
              ctx.navigate('#/profil');
            },
          },
        ],
      });
    }
  });
}

export function render(root, ctx) {
  root.classList.add('view-questionnaire');
  const param = ctx.params[0];
  if (param === 'synthese') return renderSummary(root, ctx);
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1 || n > STEP_COUNT) {
    const draft = ensureDraft(ctx.store);
    location.replace(`#/questionnaire/${draft?.step || 1}`);
    return;
  }
  return renderStep(root, ctx, n);
}
