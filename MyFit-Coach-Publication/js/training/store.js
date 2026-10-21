// Lecture / écriture des données d'entraînement sur l'appareil.
// Clés : gym, program, programPrevious, activeSession, sessions.

export const getGym = (store) => store.get('gym');

export function saveGym(store, gym) {
  return store.set('gym', { ...gym, updatedAt: new Date().toISOString() });
}

export const getProgram = (store) => store.get('program');
export const getPreviousProgram = (store) => store.get('programPrevious');

// Le programme précédent est gardé : on peut revenir en arrière (rien d'irréversible).
export function saveProgram(store, program) {
  const current = getProgram(store);
  if (current && !store.set('programPrevious', current)) return false;
  return store.set('program', program);
}

export function restorePreviousProgram(store) {
  const prev = getPreviousProgram(store);
  if (!prev) return false;
  const current = getProgram(store);
  if (!store.set('program', prev)) return false;
  if (current) store.set('programPrevious', current);
  else store.remove('programPrevious');
  return true;
}

export const getActive = (store) => store.get('activeSession');
export const saveActive = (store, s) => store.set('activeSession', s);
export const clearActive = (store) => store.remove('activeSession');

// Séances réalisées, de la plus récente à la plus ancienne.
export function getSessions(store) {
  return [...store.get('sessions', [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function addSession(store, record) {
  const all = store.get('sessions', []);
  return store.set('sessions', [...all.filter((s) => s.id !== record.id), record]);
}

export function deleteSession(store, id) {
  return store.set('sessions', store.get('sessions', []).filter((s) => s.id !== id));
}
