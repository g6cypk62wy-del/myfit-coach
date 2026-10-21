import { pageHeader, icon } from '../ui.js';
import { STEPS, GOALS, stepStatus, missingEssentials } from '../profile-schema.js';
import { getProfile, getDraft, draftHasChanges, STEP_COUNT } from '../profile-store.js';

export const title = 'Profil';

const STATUS_LABEL = { manquant: 'Manquant', incomplet: 'Incomplet', renseigne: 'Renseigné' };

const SUBTITLES = {
  profil: 'Âge, taille, activité, sommeil',
  objectifs: 'À choisir et à classer par priorité',
  experience: 'Niveau, séances par semaine, jours disponibles',
  sante: 'Blessures, douleurs, limitations',
  alimentation: 'Habitudes, goûts, allergies, budget',
  motivation: 'Ce qui t’aide, ce qui te freine',
};

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function render(root, { store, backHref }) {
  const profile = getProfile(store);
  const draft = getDraft(store);
  const pendingChanges = Boolean(profile && draft && draftHasChanges(store));
  // On affiche ce qui est validé ; sans profil validé, le brouillon en cours.
  const data = profile?.data ?? draft?.data ?? {};
  const missing = missingEssentials(data);
  const goals = data.objectifs?.objectifs ?? [];

  let headline = 'Profil non renseigné';
  let sub = 'Aucune information n’est connue tant que tu ne l’as pas saisie.';
  let cta = { label: 'Créer mon profil', href: '#/questionnaire/1' };
  if (profile) {
    headline = 'Profil validé';
    sub = `Validé le ${DATE.format(new Date(profile.validatedAt))}`;
    cta = { label: 'Modifier mon profil', href: '#/questionnaire/synthese' };
  } else if (draft) {
    headline = 'Profil en cours';
    sub = `Étape ${draft.step} sur ${STEP_COUNT} · tes réponses sont enregistrées`;
    cta = { label: 'Continuer mon profil', href: `#/questionnaire/${draft.step}` };
  }

  root.innerHTML = `
    ${pageHeader({ title: 'Mon profil', back: backHref() })}

    <div class="card profile-card">
      <div class="avatar${profile ? ' avatar-ok' : ''}" aria-hidden="true">${icon(profile ? 'check' : 'user')}</div>
      <div>
        <p class="row-title">${headline}</p>
        <p class="row-sub">${sub}</p>
      </div>
    </div>

    ${pendingChanges ? `
    <p class="note">${icon('info')}<span>Des modifications sont en cours et pas encore validées. Ton profil validé reste utilisé en attendant.</span></p>
    <a class="btn btn-primary btn-block btn-lg" href="#/questionnaire/synthese">Reprendre les modifications</a>` : `
    <a class="btn btn-primary btn-block btn-lg" href="${cta.href}">${cta.label}</a>`}

    ${(profile || draft) && missing.length ? `
    <div class="card card-warn block-gap">
      <p class="row-title">Infos essentielles manquantes</p>
      <ul class="missing">${missing.map((m) => `<li>${m.label}</li>`).join('')}</ul>
      <p class="row-sub">Sans elles, l’app ne créera pas de programme définitif.</p>
    </div>` : ''}

    ${goals.length ? `
    <section class="block">
      <h2 class="block-title">Tes priorités</h2>
      <ol class="card goal-list">
        ${goals.map((id) => `<li>${GOALS.find((g) => g.id === id)?.label ?? id}</li>`).join('')}
      </ol>
    </section>` : ''}

    <section class="block">
      <h2 class="block-title">Ce que l’app sait de toi</h2>
      <div class="card list">
        ${STEPS.map((s, i) => {
          const status = stepStatus(s, data[s.id] || {});
          return `
          <a class="row-link" href="#/questionnaire/${i + 1}" aria-label="${s.title} : ${STATUS_LABEL[status]}. Modifier">
            <span class="row-text"><span class="row-title">${s.title}</span><span class="row-sub">${SUBTITLES[s.id]}</span></span>
            <span class="pill pill-${status}">${STATUS_LABEL[status]}</span>
          </a>`;
        }).join('')}
      </div>
      <p class="hint">Seules les informations de santé utiles au coaching sont demandées. L’app ne pose jamais de diagnostic.</p>
    </section>

    <section class="block">
      <h2 class="block-title">Réglages</h2>
      <div class="card list">
        <a class="row-link" href="#/parametres">
          <span class="row-ico">${icon('settings')}</span>
          <span class="row-text"><span class="row-title">Paramètres</span><span class="row-sub">Apparence, export et suppression des données</span></span>
          ${icon('chevron', 'row-chev')}
        </a>
      </div>
    </section>`;
}
