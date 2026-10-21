// Brouillon et profil validé.
// - « profileDraft » : les réponses en cours, enregistrées au fur et à mesure.
// - « profile »      : le profil validé après la synthèse. C'est lui que lisent les autres modules.
// Modifier un profil validé passe par un nouveau brouillon : rien ne change tant que la
// synthèse n'est pas validée à nouveau.

import { STEPS, cleanStep } from './profile-schema.js';

export const STEP_COUNT = STEPS.length;

const clone = (x) => JSON.parse(JSON.stringify(x ?? {}));
// Comparaison qui ne dépend pas de l'ordre des réponses.
const stable = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));

export function getProfile(store) {
  return store.get('profile');
}

export function getDraft(store) {
  return store.get('profileDraft');
}

// Crée le brouillon s'il n'existe pas (à partir du profil validé, s'il y en a un).
export function ensureDraft(store) {
  const existing = getDraft(store);
  if (existing) return existing;
  const profile = getProfile(store);
  const draft = {
    data: clone(profile?.data),
    step: 1,
    basedOn: profile?.validatedAt ?? null,
    updatedAt: new Date().toISOString(),
  };
  return store.set('profileDraft', draft) ? draft : null;
}

// Enregistre les réponses d'une étape. Renvoie false si l'enregistrement a échoué.
export function saveDraftStep(store, stepId, stepData, stepNumber) {
  const draft = ensureDraft(store);
  if (!draft) return false;
  draft.data[stepId] = stepData;
  if (stepNumber) draft.step = stepNumber;
  draft.updatedAt = new Date().toISOString();
  return store.set('profileDraft', draft);
}

// La synthèse est validée : le brouillon devient le profil.
export function validateDraft(store, now = new Date()) {
  const draft = getDraft(store);
  if (!draft) return null;
  const data = {};
  for (const step of STEPS) data[step.id] = cleanStep(step, draft.data[step.id]);
  const previous = getProfile(store);
  const profile = {
    version: 1,
    data,
    createdAt: previous?.createdAt ?? now.toISOString(),
    validatedAt: now.toISOString(),
  };
  if (!store.set('profile', profile)) return null;
  store.remove('profileDraft');
  return profile;
}

export function discardDraft(store) {
  return store.remove('profileDraft');
}

// Le brouillon diffère-t-il du profil validé ?
export function draftHasChanges(store) {
  const draft = getDraft(store);
  if (!draft) return false;
  const profile = getProfile(store);
  if (!profile) return true;
  return STEPS.some(
    (s) => stable(cleanStep(s, draft.data[s.id])) !== stable(cleanStep(s, profile.data[s.id])),
  );
}
