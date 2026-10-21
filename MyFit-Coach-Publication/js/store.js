// Stockage des données SUR L'APPAREIL (localStorage).
// Ce n'est pas une sauvegarde en ligne : si les données du navigateur sont
// effacées, tout est perdu. D'où l'export JSON dans Paramètres.

export const PREFIX = 'myfit:';

// createStore reçoit le stockage à utiliser : localStorage dans le navigateur,
// un faux stockage en mémoire dans les tests.
export function createStore(storage, onError = () => {}) {
  function fail(action, error) {
    onError({ action, error });
  }

  return {
    get(key, fallback = null) {
      try {
        const raw = storage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (error) {
        fail('lecture', error);
        return fallback;
      }
    },

    // Renvoie true si l'enregistrement a réussi, false sinon (stockage plein, bloqué…).
    set(key, value) {
      try {
        storage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (error) {
        fail('enregistrement', error);
        return false;
      }
    },

    remove(key) {
      try {
        storage.removeItem(PREFIX + key);
        return true;
      } catch (error) {
        fail('suppression', error);
        return false;
      }
    },

    // Liste des clés de l'app (sans le préfixe). Les données d'autres sites sont ignorées.
    keys() {
      const out = [];
      try {
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
        }
      } catch (error) {
        fail('lecture', error);
      }
      return out.sort();
    },

    // Tout ce que l'app a enregistré, pour l'export.
    exportAll(meta = {}) {
      const data = {};
      for (const k of this.keys()) data[k] = this.get(k);
      return { app: 'MyFit Coach', ...meta, exportedAt: new Date().toISOString(), data };
    },

    // Efface uniquement les données de l'app. Renvoie le nombre de clés supprimées.
    clearAll() {
      const keys = this.keys();
      let removed = 0;
      for (const k of keys) if (this.remove(k)) removed++;
      return removed;
    },
  };
}

// Faux stockage en mémoire (tests, ou navigateur qui bloque localStorage).
export function memoryStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}
