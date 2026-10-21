// Sauvegarde : vérification et restauration d'un fichier exporté.
// Seules les clés connues de l'app sont acceptées ; tout le reste est ignoré.

export const SCHEMA = 1;

export const KNOWN_KEYS = {
  settings: 'Réglages',
  profile: 'Profil validé',
  profileDraft: 'Profil en cours',
  gym: 'Ma salle',
  program: 'Programme',
  programPrevious: 'Programme précédent',
  activeSession: 'Séance en cours',
  sessions: 'Séances réalisées',
  journal: 'Journal alimentaire',
  recipes: 'Recettes favorites',
  nutritionTargets: 'Repères nutritionnels',
  nutritionSettings: 'Réglages nutrition',
  measures: 'Mesures',
  coachMessages: 'Conversation avec le coach',
  meta: 'Informations de l’app',
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Vérifie la forme générale des données (pas leur exactitude).
const SHAPES = {
  settings: isObj, profile: (v) => isObj(v) && isObj(v.data), profileDraft: (v) => isObj(v) && isObj(v.data),
  gym: (v) => isObj(v) && Array.isArray(v.available ?? []), program: (v) => isObj(v) && Array.isArray(v.sessions),
  programPrevious: (v) => isObj(v) && Array.isArray(v.sessions), activeSession: (v) => isObj(v) && Array.isArray(v.exercises),
  sessions: (v) => Array.isArray(v) && v.every((s) => isObj(s) && typeof s.startedAt === 'string' && Array.isArray(s.exercises)),
  journal: (v) => isObj(v) && Object.entries(v).every(([k, e]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(e)),
  recipes: Array.isArray, nutritionTargets: isObj, nutritionSettings: isObj,
  measures: Array.isArray, coachMessages: Array.isArray, meta: isObj,
};

export function validateBackup(json) {
  if (!isObj(json) || json.app !== 'MyFit Coach' || !isObj(json.data)) {
    return { ok: false, error: 'Ce fichier n’est pas une sauvegarde MyFit Coach.' };
  }
  const data = {};
  const ignored = [];
  const invalid = [];
  for (const [k, v] of Object.entries(json.data)) {
    if (!Object.prototype.hasOwnProperty.call(KNOWN_KEYS, k)) { ignored.push(k); continue; }
    if (!SHAPES[k](v)) { invalid.push(KNOWN_KEYS[k]); continue; }
    data[k] = v;
  }
  if (invalid.length) {
    return { ok: false, error: `Données illisibles dans : ${invalid.join(', ')}. Rien n’a été modifié.` };
  }
  const counts = {
    sessions: data.sessions?.length ?? 0,
    jours: Object.keys(data.journal ?? {}).length,
    profil: Boolean(data.profile),
  };
  return { ok: true, data, ignored, counts, exportedAt: json.exportedAt ?? null };
}

// Remplace toutes les données de l'app par celles de la sauvegarde.
export function applyBackup(store, data) {
  const previous = store.exportAll();
  store.clearAll();
  for (const [k, v] of Object.entries(data)) {
    if (!store.set(k, v)) {
      // Échec : on remet les anciennes données.
      store.clearAll();
      for (const [pk, pv] of Object.entries(previous.data)) store.set(pk, pv);
      return false;
    }
  }
  return true;
}

// Prépare les métadonnées au démarrage (version du format de données).
// N'écrit rien tant que l'app ne contient aucune donnée.
export function ensureMeta(store) {
  if (!store.keys().some((k) => k !== 'meta')) return;
  const meta = store.get('meta', {});
  if (meta.schema !== SCHEMA) store.set('meta', { ...meta, schema: SCHEMA });
}
