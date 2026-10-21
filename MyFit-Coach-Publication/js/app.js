// Point d'entrée : navigation entre les écrans, barre d'onglets, thème.

import { createStore, memoryStorage } from './store.js';
import { icon, toast, closeSheet } from './ui.js';
import * as accueil from './views/accueil.js';
import * as entrainement from './views/entrainement.js';
import * as nutrition from './views/nutrition.js';
import * as progression from './views/progression.js';
import * as coach from './views/coach.js';
import * as profil from './views/profil.js';
import * as parametres from './views/parametres.js';
import * as questionnaire from './views/questionnaire.js';
import * as salle from './views/salle.js';
import * as exercices from './views/exercices.js';
import * as seance from './views/seance.js';
import * as historique from './views/historique.js';
import * as ajout from './views/ajout.js';
import * as objectifsNutrition from './views/objectifs-nutrition.js';
import * as idees from './views/idees.js';
import { elapsedMs, formatClock } from './training/session.js';
import { ensureMeta } from './backup.js';

export const VERSION = '0.9.1';

const TABS = [
  { id: 'accueil', label: 'Accueil', icon: 'home', view: accueil },
  { id: 'entrainement', label: 'Entraînement', icon: 'training', view: entrainement },
  { id: 'nutrition', label: 'Nutrition', icon: 'nutrition', view: nutrition },
  { id: 'progression', label: 'Progression', icon: 'progress', view: progression },
  { id: 'coach', label: 'Mon coach', icon: 'coach', view: coach },
];

// Écrans hors onglets. « parent » = onglet mis en avant quand on y est.
const PAGES = {
  profil: { view: profil, parent: null },
  parametres: { view: parametres, parent: null },
  questionnaire: { view: questionnaire, parent: null },
  salle: { view: salle, parent: 'entrainement' },
  exercices: { view: exercices, parent: 'entrainement' },
  seance: { view: seance, parent: 'entrainement' },
  historique: { view: historique, parent: 'entrainement' },
  ajouter: { view: ajout, parent: 'nutrition' },
  'objectifs-nutrition': { view: objectifsNutrition, parent: 'nutrition' },
  idees: { view: idees, parent: 'nutrition' },
};

// Si localStorage est bloqué, l'app fonctionne quand même, en mémoire (perdu à la fermeture).
function pickStorage() {
  try {
    const s = window.localStorage;
    s.setItem('myfit:__test', '1');
    s.removeItem('myfit:__test');
    return { storage: s, persistent: true };
  } catch {
    return { storage: memoryStorage(), persistent: false };
  }
}

const { storage, persistent } = pickStorage();
let lastErrorToast = 0;
const store = createStore(storage, ({ action }) => {
  if (Date.now() - lastErrorToast < 2000) return;
  lastErrorToast = Date.now();
  toast(`Erreur d'${action} sur cet appareil. Tes dernières modifications n'ont peut-être pas été enregistrées.`, 'error');
});

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

const ctx = {
  store,
  persistent,
  version: VERSION,
  navigate: (hash) => { location.hash = hash; },
  applyTheme,
  rerender: () => render({ keepScroll: true }),
  backHref: () => `#/${lastTab}`,
  params: [],
};

const main = document.getElementById('main');
const tabbar = document.getElementById('tabbar');
let cleanup = null;
let firstRender = true;
let lastTab = 'accueil'; // onglet d'où l'on vient, pour le bouton retour du profil

function buildTabbar() {
  tabbar.innerHTML = TABS.map(
    (t) => `<a class="tab" href="#/${t.id}" data-tab="${t.id}">${icon(t.icon)}<span>${t.label}</span></a>`,
  ).join('');
}

// "#/questionnaire/2" → ['questionnaire', '2']
function routeParts() {
  const parts = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  return parts.length ? parts : ['accueil'];
}

function render({ keepScroll = false } = {}) {
  const [id, ...params] = routeParts();
  ctx.params = params;
  const tab = TABS.find((t) => t.id === id);
  const page = PAGES[id];
  const mod = tab?.view || page?.view;
  if (!mod) {
    location.replace('#/accueil');
    return;
  }

  if (tab) lastTab = tab.id;
  closeSheet();
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;

  const scrollY = window.scrollY;
  const view = document.createElement('section');
  view.className = 'view' + (firstRender || keepScroll ? '' : ' view-enter');
  try {
    main.replaceChildren(view);
    cleanup = mod.render(view, ctx);
  } catch (error) {
    console.error(error);
    view.innerHTML = `
      <div class="error-state" role="alert">
        <p class="empty-title">Cet écran n'a pas pu s'afficher.</p>
        <p class="empty-text">Tes données ne sont pas touchées. Essaie de recharger la page.</p>
        <button class="btn btn-primary" type="button" onclick="location.reload()">Recharger</button>
      </div>`;
  }

  document.title = `${mod.title} · MyFit Coach`;
  document.body.classList.toggle('no-tabbar', Boolean(mod.hideTabbar));
  updateLiveBanner(id);
  const active = tab?.id ?? page?.parent;
  tabbar.querySelectorAll('.tab').forEach((el) => {
    const on = el.dataset.tab === active;
    el.classList.toggle('active', on);
    if (on) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });

  if (keepScroll) window.scrollTo(0, scrollY);
  else window.scrollTo(0, 0);
  // Pour les lecteurs d'écran : on annonce le nouvel écran (sauf au démarrage).
  if (!firstRender && !keepScroll) view.querySelector('.page-title')?.focus({ preventScroll: true });
  firstRender = false;
}

// Bandeau « Séance en cours » visible sur tous les écrans tant qu'une séance est ouverte.
const banner = document.createElement('a');
banner.className = 'live-banner';
banner.href = '#/seance';
banner.hidden = true;
let bannerTimer = null;
function updateLiveBanner(routeId) {
  const active = store.get('activeSession');
  const show = Boolean(active) && routeId !== 'seance';
  banner.hidden = !show;
  document.body.classList.toggle('has-live-banner', show);
  clearInterval(bannerTimer);
  if (!show) return;
  const paint = () => {
    const a = store.get('activeSession');
    if (!a) { banner.hidden = true; clearInterval(bannerTimer); return; }
    banner.innerHTML = `<span class="live-dot" aria-hidden="true"></span><span>Séance en cours · ${a.pausedAt ? 'en pause' : formatClock(elapsedMs(a))}</span><strong>Reprendre</strong>`;
  };
  paint();
  bannerTimer = setInterval(paint, 1000);
}

// Hors connexion (service worker) et mises à jour.
function registerServiceWorker() {
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!('serviceWorker' in navigator) || !secure) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
      });
    });
  }).catch((e) => console.warn('Service worker non installé', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) { reloading = true; location.reload(); }
  });
}

function showUpdate(worker) {
  const bar = document.createElement('div');
  bar.className = 'update-bar';
  bar.setAttribute('role', 'status');
  bar.innerHTML = '<span>Une nouvelle version est disponible.</span><button type="button" class="btn btn-sm btn-primary">Mettre à jour</button>';
  bar.querySelector('button').addEventListener('click', () => worker.postMessage('skipWaiting'));
  document.body.append(bar);
}

// Demande au navigateur de ne pas effacer les données (à chaque ouverture, si l'app en contient) :
// sur iPhone, la demande répétée protège mieux les données de l'app installée sur l'écran d'accueil.
async function askPersistence() {
  if (!store.keys().some((k) => k !== 'meta' && k !== 'settings')) return;
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted?.())) await navigator.storage.persist();
  } catch { /* sans conséquence */ }
}

function start() {
  document.getElementById('app').append(banner);
  ensureMeta(store);
  applyTheme(store.get('settings', {}).theme);
  buildTabbar();
  window.addEventListener('hashchange', () => render());
  render();
  document.getElementById('boot')?.remove();
  if (!persistent) {
    toast('Ce navigateur bloque l’enregistrement : tes données seront perdues à la fermeture.', 'error');
  }
  registerServiceWorker();
  askPersistence();
}

window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  toast('Une erreur inattendue est survenue.', 'error');
});

start();
