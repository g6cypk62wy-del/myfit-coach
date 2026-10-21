// Briques d'interface partagées : icônes, en-têtes, états vides, feuilles, messages.

// Échappe le texte saisi par l'utilisatrice avant de l'afficher (sécurité).
export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Icônes dessinées pour l'app (traits de 1,8 px, 24×24).
const PATHS = {
  home: '<path d="M3.5 10.5 12 4l8.5 6.5"/><path d="M5.5 9v10a1 1 0 0 0 1 1H10v-5.5h4V20h3.5a1 1 0 0 0 1-1V9"/>',
  training: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  nutrition: '<path d="M12 7.5c-1.4-1.6-4.2-1.9-5.9-.2-2.1 2.1-1.6 6.6.6 9.8 1.4 2 3 2.9 4.3 2.4l1-.4 1 .4c1.3.5 2.9-.4 4.3-2.4 2.2-3.2 2.7-7.7.6-9.8-1.7-1.7-4.5-1.4-5.9.2Z"/><path d="M12 7.5c0-2 .8-3.4 2.5-4"/>',
  progress: '<path d="M4 19.5h16"/><path d="M5.5 15.5 10 11l3 3 5.5-6"/><path d="M15 8h3.5v3.5"/>',
  coach: '<path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.2 0-2.3-.2-3.3-.6L4 19.5l1.2-3.6A7.2 7.2 0 0 1 4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5Z"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c1.2-3.3 3.9-5 7-5s5.8 1.7 7 5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.6Z"/>',
  back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  chevron: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  prev: '<path d="M14.5 6 8.5 12l6 6"/>',
  next: '<path d="m9.5 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="m6 14.5 6-6 6 6"/>',
  down: '<path d="m6 9.5 6 6 6-6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5L8 5.5Z"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  send: '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/>',
  trash: '<path d="M4.5 7h15M10 4h4M6.5 7l.8 12a1 1 0 0 0 1 1h7.4a1 1 0 0 0 1-1l.8-12M10 11v5M14 11v5"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.75" cy="7" r=".9" fill="currentColor"/><circle cx="4.75" cy="12" r=".9" fill="currentColor"/><circle cx="4.75" cy="17" r=".9" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  book: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5v-14Z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>',
  building: '<path d="M4.5 20V8l7.5-4 7.5 4v12"/><path d="M3 20h18M9 20v-5h6v5M9 10.5h.01M15 10.5h.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6l-7-2.5Z"/>',
  sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || ''}</svg>`;
}

// En-tête d'écran : grand titre façon iOS, bouton retour éventuel, actions à droite.
export function pageHeader({ title, eyebrow = '', back = '', actions = '' }) {
  return `
    <header class="page-head">
      <div class="page-head-bar">
        ${back ? `<a class="icon-btn" href="${back}" aria-label="Retour">${icon('back')}</a>` : '<span></span>'}
        <div class="page-head-actions">${actions}</div>
      </div>
      ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}
      <h1 class="page-title" tabindex="-1">${title}</h1>
    </header>`;
}

export const profileButton = `<a class="icon-btn" href="#/profil" aria-label="Mon profil et paramètres">${icon('user')}</a>`;

// État vide honnête : on dit ce qui manque et comment le remplir.
export function emptyState({ icon: ic = 'info', title, text, action = '' }) {
  return `
    <div class="empty">
      <div class="empty-ico">${icon(ic)}</div>
      <p class="empty-title">${title}</p>
      ${text ? `<p class="empty-text">${text}</p>` : ''}
      ${action}
    </div>`;
}

// ---------- Feuille (panneau qui monte du bas) ----------

let openSheetState = null;

export function closeSheet() {
  if (!openSheetState) return;
  const { root, previousFocus, onKey } = openSheetState;
  openSheetState = null;
  document.removeEventListener('keydown', onKey);
  root.classList.add('closing');
  const done = () => { root.innerHTML = ''; root.classList.remove('closing'); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
  else setTimeout(done, 200);
  previousFocus?.focus?.();
}

// actions : [{ label, kind: 'primary' | 'danger' | 'ghost', onClick }]
export function openSheet({ title, body = '', actions = [] }) {
  closeSheet();
  const root = document.getElementById('sheet-root');
  const titleId = 'sheet-title-' + Date.now();
  root.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="sheet-grip" aria-hidden="true"></div>
      <div class="sheet-head">
        <h2 id="${titleId}">${title}</h2>
        <button class="icon-btn" type="button" data-close aria-label="Fermer">${icon('close')}</button>
      </div>
      <div class="sheet-body">${body}</div>
      ${actions.length ? `<div class="sheet-actions">${actions
        .map((a, i) => `<button type="button" class="btn btn-${a.kind || 'ghost'}" data-action-index="${i}">${a.label}</button>`)
        .join('')}</div>` : ''}
    </div>`;

  const onKey = (e) => {
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'Tab') trapFocus(e, root.querySelector('.sheet'));
  };
  openSheetState = { root, previousFocus: document.activeElement, onKey };
  document.addEventListener('keydown', onKey);

  root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeSheet));
  root.querySelectorAll('[data-action-index]').forEach((el) =>
    el.addEventListener('click', () => {
      const action = actions[Number(el.dataset.actionIndex)];
      const keepOpen = action.onClick?.() === false;
      if (!keepOpen) closeSheet();
    }),
  );
  (root.querySelector('.sheet-actions .btn') || root.querySelector('[data-close]'))?.focus();
}

function trapFocus(e, container) {
  const items = [...container.querySelectorAll('a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])')];
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
}

// Feuille « pas encore construit » : on dit honnêtement à quelle phase la fonction arrive.
export function notYet({ title, text, phase, extra = '' }) {
  openSheet({
    title,
    body: `
      <p>${text}</p>
      <p class="note">${icon('info')}<span>Cette fonction sera construite à la <strong>phase ${phase}</strong>. Pour l’instant, rien n’est enregistré.</span></p>
      ${extra}`,
    actions: [{ label: 'Compris', kind: 'primary' }],
  });
}

// ---------- Messages courts (toasts) ----------

export function toast(message, kind = 'info') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = message;
  root.append(el);
  setTimeout(() => el.classList.add('leaving'), 3200);
  setTimeout(() => el.remove(), 3600);
}
