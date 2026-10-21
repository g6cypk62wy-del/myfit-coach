import { pageHeader, icon, openSheet, toast, esc } from '../ui.js';
import { isoDate } from '../dates.js';
import { validateBackup, applyBackup, KNOWN_KEYS } from '../backup.js';

export const title = 'Paramètres';

const THEMES = [
  { id: 'auto', label: 'Automatique' },
  { id: 'light', label: 'Clair' },
  { id: 'dark', label: 'Sombre' },
];
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Éléments réellement saisis (hors informations techniques).
const userKeys = (store) => store.keys().filter((k) => k !== 'meta');

export function render(root, ctx) {
  const { store } = ctx;
  let storageInfo = null;

  async function loadStorageInfo() {
    try {
      const persisted = await navigator.storage?.persisted?.();
      const est = await navigator.storage?.estimate?.();
      storageInfo = { persisted, usage: est?.usage ?? null };
    } catch {
      storageInfo = { persisted: null, usage: null };
    }
    const el = root.querySelector('#storage-info');
    if (el) el.textContent = storageText();
  }
  const storageText = () => {
    if (!storageInfo) return 'Vérification du stockage…';
    const p = storageInfo.persisted === true ? 'Le navigateur s’est engagé à conserver tes données.'
      : storageInfo.persisted === false ? 'Le navigateur peut effacer les données si l’appareil manque de place ou après une longue période sans utilisation. Ajouter l’app à l’écran d’accueil réduit ce risque.'
      : 'Le navigateur ne précise pas s’il conserve les données durablement.';
    const u = storageInfo.usage != null ? ` Espace utilisé : environ ${Math.max(1, Math.round(storageInfo.usage / 1024))} Ko.` : '';
    return p + u;
  };

  function draw() {
    const settings = store.get('settings', {});
    const meta = store.get('meta', {});
    const theme = settings.theme || 'auto';
    const count = userKeys(store).length;

    root.innerHTML = `
      ${pageHeader({ title: 'Paramètres', back: '#/profil' })}

      <section class="block">
        <h2 class="block-title">Apparence</h2>
        <div class="segmented" role="radiogroup" aria-label="Thème">
          ${THEMES.map((t) => `
            <button type="button" role="radio" aria-checked="${t.id === theme}" class="${t.id === theme ? 'on' : ''}" data-set-theme="${t.id}">${t.label}</button>`).join('')}
        </div>
        <p class="hint">« Automatique » suit le réglage clair/sombre de ton iPhone.</p>
      </section>

      <section class="block">
        <h2 class="block-title">Mes données</h2>
        <div class="card info-card">
          <span class="row-ico">${icon('shield')}</span>
          <p>Tes données sont enregistrées <strong>uniquement sur cet appareil</strong>, dans le navigateur. Ce n’est pas une sauvegarde en ligne : si tu effaces les données de Safari ou changes de téléphone, elles sont perdues. Exporte-les de temps en temps et garde le fichier (Fichiers, iCloud Drive…).</p>
        </div>
        ${ctx.persistent ? '' : '<p class="hint hint-warn">Attention : ce navigateur bloque l’enregistrement. Rien ne sera conservé après fermeture.</p>'}
        <div class="card list">
          <button type="button" class="row-link" data-act="export">
            <span class="row-ico">${icon('download')}</span>
            <span class="row-text"><span class="row-title">Exporter mes données</span><span class="row-sub">${count ? `${count} élément${count > 1 ? 's' : ''} enregistré${count > 1 ? 's' : ''}` : 'Rien d’enregistré pour l’instant'} · fichier JSON${meta.lastExport ? ` · dernier export le ${DATE.format(new Date(meta.lastExport))}` : ''}</span></span>
          </button>
          <button type="button" class="row-link" data-act="import">
            <span class="row-ico">${icon('up')}</span>
            <span class="row-text"><span class="row-title">Restaurer une sauvegarde</span><span class="row-sub">À partir d’un fichier exporté depuis MyFit Coach</span></span>
          </button>
          <button type="button" class="row-link row-danger" data-act="delete">
            <span class="row-ico">${icon('trash')}</span>
            <span class="row-text"><span class="row-title">Supprimer mes données</span><span class="row-sub">Efface tout ce que l’app a enregistré sur cet appareil</span></span>
          </button>
        </div>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
        <p class="hint" id="storage-info">${storageText()}</p>
      </section>

      <section class="block">
        <h2 class="block-title">Confidentialité</h2>
        <div class="card prose privacy">
          <p><strong>Aucun compte, aucun suivi, aucune publicité.</strong> L’app n’envoie pas tes données à un serveur.</p>
          <p>Seules deux choses passent par Internet :</p>
          <ul>
            <li>le chargement de l’app et de la table Ciqual depuis son propre site ;</li>
            <li>les recherches « Open Food Facts », qui envoient uniquement les mots que tu tapes à openfoodfacts.org.</li>
          </ul>
          <p>Chaque personne qui utilise l’app a ses données sur son propre téléphone : personne d’autre ne peut les voir.</p>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">À propos</h2>
        <div class="card list about">
          <div class="kv"><span>Version</span><span>${ctx.version} · prototype</span></div>
          <div class="kv"><span>Coach</span><span>Sans IA (règles)</span></div>
          <div class="kv"><span>Stockage</span><span>Sur l’appareil</span></div>
          <div class="kv"><span>Base alimentaire</span><span>Ciqual 2020 (ANSES)</span></div>
        </div>
        <p class="hint">Données alimentaires : Anses, table Ciqual 2020, Licence Ouverte. Produits de marque : Open Food Facts, licence ODbL. L’app ne remplace pas un avis médical.</p>
      </section>`;
  }
  draw();
  loadStorageInfo();

  function doExport() {
    const payload = store.exportAll({ version: ctx.version });
    const date = isoDate(new Date()); // date locale (pas UTC)
    try {
      download(`myfit-coach-${date}.json`, JSON.stringify(payload, null, 2));
      store.set('meta', { ...store.get('meta', {}), lastExport: new Date().toISOString() });
      toast('Export prêt.');
      draw();
    } catch (error) {
      console.error(error);
      toast('L’export a échoué. Réessaie.', 'error');
    }
  }

  async function doImport(file) {
    let json;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('trop gros');
      json = JSON.parse(await file.text());
    } catch {
      toast('Fichier illisible : ce n’est pas une sauvegarde valide.', 'error');
      return;
    }
    const res = validateBackup(json);
    if (!res.ok) { toast(res.error, 'error'); return; }
    const labels = Object.keys(res.data).filter((k) => k !== 'meta').map((k) => KNOWN_KEYS[k]);
    openSheet({
      title: 'Restaurer cette sauvegarde ?',
      body: `
        <p>${res.exportedAt ? `Sauvegarde du ${DATE.format(new Date(res.exportedAt))}. ` : ''}Elle contient : ${labels.length ? esc(labels.join(', ')) : 'aucune donnée'}.</p>
        <p class="muted">${res.counts.sessions} séance(s) réalisée(s) · ${res.counts.jours} jour(s) de journal alimentaire.</p>
        <p><strong>Toutes les données actuelles de cet appareil seront remplacées.</strong> Exporte-les d’abord si tu veux les garder.</p>
        ${res.ignored.length ? `<p class="hint">${res.ignored.length} élément(s) inconnu(s) seront ignorés.</p>` : ''}`,
      actions: [
        { label: 'Annuler', kind: 'ghost' },
        { label: 'Remplacer', kind: 'danger', onClick: () => {
          if (applyBackup(store, res.data)) {
            ctx.applyTheme(store.get('settings', {}).theme);
            toast('Sauvegarde restaurée.');
          } else {
            toast('La restauration a échoué : tes données d’avant ont été remises.', 'error');
          }
          draw();
        } },
      ],
    });
  }

  root.addEventListener('change', (e) => {
    if (e.target.id === 'import-file' && e.target.files?.[0]) {
      doImport(e.target.files[0]);
      e.target.value = '';
    }
  });

  root.addEventListener('click', (e) => {
    const themeBtn = e.target.closest('[data-set-theme]');
    if (themeBtn) {
      const settings = store.get('settings', {});
      const theme = themeBtn.dataset.setTheme;
      if (store.set('settings', { ...settings, theme })) {
        ctx.applyTheme(theme);
        draw();
        root.querySelector(`[data-set-theme="${theme}"]`)?.focus();
      }
      return;
    }

    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'export') doExport();
    else if (act === 'import') root.querySelector('#import-file').click();
    else if (act === 'delete') {
      const count = userKeys(store).length;
      if (!count) {
        toast('Il n’y a aucune donnée à supprimer.');
        return;
      }
      openSheet({
        title: 'Supprimer mes données ?',
        body: `<p>Cela efface <strong>définitivement</strong> tout ce que l’app a enregistré sur cet appareil (${count} élément${count > 1 ? 's' : ''}) : profil, séances, journal, réglages.</p>
               <p class="muted">Conseil : exporte d’abord tes données si tu veux les garder.</p>`,
        actions: [
          { label: 'Annuler', kind: 'ghost' },
          {
            label: 'Supprimer',
            kind: 'danger',
            onClick: () => {
              const before = store.keys().length;
              const removed = store.clearAll();
              ctx.applyTheme('auto');
              if (removed === before) toast('Données supprimées.');
              else toast('Certaines données n’ont pas pu être supprimées.', 'error');
              draw();
            },
          },
        ],
      });
    }
  });
}
