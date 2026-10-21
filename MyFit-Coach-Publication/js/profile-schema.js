// Le questionnaire de profil : les 6 étapes, leurs questions et les règles de validation.
// Aucune réponse n'est obligatoire pour avancer, mais certaines sont « essentielles » :
// sans elles, l'app ne créera pas de programme définitif.

const opts = (pairs) => pairs.map(([id, label]) => ({ id, label }));

export const GOALS = opts([
  ['perte-graisse', 'Perte de graisse'],
  ['recomposition', 'Recomposition (moins de gras, plus de muscle)'],
  ['muscle', 'Développement musculaire'],
  ['fessiers-jambes', 'Fessiers et jambes'],
  ['haut-du-corps', 'Dos, épaules et bras'],
  ['abdos', 'Sangle abdominale'],
  ['force', 'Force'],
  ['endurance', 'Endurance'],
  ['mobilite', 'Mobilité et souplesse'],
  ['forme', 'Forme générale'],
]);

export const WEEKDAYS = opts([
  ['lun', 'Lun'], ['mar', 'Mar'], ['mer', 'Mer'], ['jeu', 'Jeu'], ['ven', 'Ven'], ['sam', 'Sam'], ['dim', 'Dim'],
]);

export const STEPS = [
  {
    id: 'profil',
    title: 'Toi',
    intro: 'Quelques repères de base. Tout est modifiable plus tard.',
    fields: [
      { id: 'age', label: 'Âge', type: 'number', unit: 'ans', min: 16, max: 100, integer: true, essential: true,
        rangeMessage: 'L’app est prévue pour les personnes de 16 à 100 ans.' },
      { id: 'taille', label: 'Taille', type: 'number', unit: 'cm', min: 120, max: 230, integer: true, essential: true },
      { id: 'poids', label: 'Poids actuel', type: 'number', unit: 'kg', min: 30, max: 300, optional: true },
      { id: 'poidsCible', label: 'Poids cible éventuel', type: 'number', unit: 'kg', min: 30, max: 300, optional: true,
        hint: 'Perdre du poids n’est pas un objectif obligatoire.' },
      { id: 'activite', label: 'Activité au quotidien', type: 'choice', options: opts([
        ['assise', 'Surtout en position assise'],
        ['mouvement', 'Souvent debout ou en mouvement'],
        ['physique', 'Très physique (travail manuel, beaucoup de marche)'],
      ]) },
      { id: 'sommeilHeures', label: 'Sommeil moyen par nuit', type: 'number', unit: 'h', min: 3, max: 14 },
      { id: 'recuperation', label: 'Comment récupères-tu en général ?', type: 'choice', options: opts([
        ['bien', 'Bien'], ['moyen', 'Moyennement'], ['mal', 'Mal, souvent de la fatigue'],
      ]) },
      { id: 'pas', label: 'Pas moyens par jour', type: 'number', unit: 'pas', min: 0, max: 60000, integer: true, optional: true,
        hint: 'Seulement si tu le connais (app Santé de l’iPhone).' },
    ],
    check(d) {
      const warnings = [];
      if (d.taille && d.poidsCible) {
        const imc = d.poidsCible / (d.taille / 100) ** 2;
        if (imc < 18.5) {
          warnings.push('Ce poids cible est bas pour ta taille. L’app ne proposera jamais de restriction pour l’atteindre ; si c’est important pour toi, parles-en à un professionnel de santé.');
        }
      }
      return warnings;
    },
  },
  {
    id: 'objectifs',
    title: 'Tes objectifs',
    intro: 'Choisis ce qui compte pour toi, puis classe-les. Le premier sera ta priorité.',
    fields: [
      { id: 'objectifs', label: 'Objectifs', type: 'rank', options: GOALS, essential: true },
      { id: 'motivations', label: 'Pourquoi ces objectifs comptent pour toi', type: 'textarea', optional: true, maxLength: 600 },
      { id: 'attentes', label: 'Ce que tu attends de l’app', type: 'textarea', optional: true, maxLength: 600 },
    ],
  },
  {
    id: 'experience',
    title: 'Ton expérience',
    intro: 'Pour proposer des séances à ton niveau, ni trop faciles ni trop dures.',
    fields: [
      { id: 'niveau', label: 'Ton niveau en sport', type: 'choice', essential: true, options: opts([
        ['debut', 'Je débute, ou je reprends après longtemps'],
        ['quelques-mois', 'Quelques mois de pratique'],
        ['regulier', 'Pratique régulière depuis plus d’un an'],
      ]) },
      { id: 'muscu', label: 'Expérience en musculation', type: 'choice', options: opts([
        ['jamais', 'Jamais'], ['un-peu', 'Un peu'], ['regulier', 'Régulièrement'],
      ]) },
      { id: 'seances', label: 'Séances par semaine souhaitées', type: 'choice', essential: true, compact: true,
        options: opts([['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']]) },
      { id: 'duree', label: 'Durée par séance', type: 'choice', essential: true, compact: true,
        options: opts([['30', '30 min'], ['45', '45 min'], ['60', '1 h'], ['75', '1 h 15'], ['90', '1 h 30']]) },
      { id: 'jours', label: 'Jours où tu peux t’entraîner', type: 'multi', essential: true, compact: true, options: WEEKDAYS },
      { id: 'machines', label: 'Les machines de musculation', type: 'choice', options: opts([
        ['pas-du-tout', 'Je ne les connais pas'], ['un-peu', 'Je connais les principales'], ['a-l-aise', 'Je suis à l’aise'],
      ]) },
      { id: 'aimes', label: 'Exercices que tu aimes', type: 'textarea', optional: true, maxLength: 400 },
      { id: 'detestes', label: 'Exercices que tu n’aimes pas', type: 'textarea', optional: true, maxLength: 400 },
      { id: 'autresSports', label: 'Autres sports pratiqués', type: 'text', optional: true, maxLength: 200 },
    ],
    check(d) {
      const warnings = [];
      const nbJours = d.jours?.length ?? 0;
      if (nbJours && d.seances && nbJours < Number(d.seances)) {
        warnings.push(`Tu as choisi ${d.seances} séances mais seulement ${nbJours} jour${nbJours > 1 ? 's' : ''} disponible${nbJours > 1 ? 's' : ''}. On en tiendra compte : pas plus d’une séance par jour.`);
      }
      return warnings;
    },
  },
  {
    id: 'sante',
    title: 'Santé et sécurité',
    intro: 'Uniquement ce qui sert à adapter tes séances. L’app ne pose aucun diagnostic et ne remplace pas un avis médical.',
    fields: [
      { id: 'douleurs', label: 'As-tu en ce moment une douleur pendant ou après l’effort ?', type: 'choice', essential: true,
        options: opts([['non', 'Non'], ['oui', 'Oui']]) },
      { id: 'douleursDetail', label: 'Où, et dans quels mouvements ?', type: 'textarea', maxLength: 400,
        showIf: (d) => d.douleurs === 'oui' },
      { id: 'blessures', label: 'Blessures ou opérations passées à prendre en compte', type: 'textarea', optional: true, maxLength: 400 },
      { id: 'limitations', label: 'Mouvements que tu ne peux pas ou ne veux pas faire', type: 'textarea', optional: true, maxLength: 400 },
      { id: 'recommandations', label: 'Recommandations d’un professionnel de santé', type: 'textarea', optional: true, maxLength: 400,
        hint: 'Par exemple : éviter de porter lourd, grossesse, suivi kiné en cours.' },
    ],
    check(d) {
      return d.douleurs === 'oui'
        ? ['Une douleur actuelle mérite un avis médical ou kiné avant de forcer. L’app évitera les mouvements que tu signales et te dira toujours d’arrêter en cas de douleur.']
        : [];
    },
  },
  {
    id: 'alimentation',
    title: 'Ton alimentation',
    intro: 'Pour des conseils qui te ressemblent. Aucun régime extrême ne sera proposé.',
    fields: [
      { id: 'nbRepas', label: 'Repas par jour', type: 'choice', compact: true,
        options: opts([['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5+', '5 ou plus']]) },
      { id: 'horaires', label: 'Horaires habituels', type: 'text', optional: true, maxLength: 120, placeholder: 'ex. 7h30, 12h30, 19h30' },
      { id: 'allergies', label: 'Allergies ou intolérances', type: 'multi', exclusive: 'aucune', essential: true,
        hint: 'Elles seront strictement respectées dans tous les conseils.',
        options: opts([
          ['aucune', 'Aucune'], ['gluten', 'Gluten'], ['lactose', 'Lactose'], ['arachides', 'Arachides'],
          ['fruits-a-coque', 'Fruits à coque'], ['oeufs', 'Œufs'], ['poisson', 'Poisson'], ['crustaces', 'Crustacés'],
          ['soja', 'Soja'], ['sesame', 'Sésame'],
        ]) },
      { id: 'allergiesAutres', label: 'Autres allergies, intolérances ou contraintes', type: 'text', optional: true, maxLength: 200 },
      { id: 'regime', label: 'Préférences culturelles, religieuses ou éthiques', type: 'multi', exclusive: 'aucune', optional: true,
        options: opts([
          ['aucune', 'Aucune'], ['vegetarien', 'Végétarien'], ['vegetalien', 'Végétalien'], ['pescetarien', 'Pescétarien'],
          ['halal', 'Halal'], ['casher', 'Casher'], ['sans-porc', 'Sans porc'], ['sans-alcool', 'Sans alcool'],
        ]) },
      { id: 'proteines', label: 'Sources de protéines que tu manges', type: 'multi', options: opts([
        ['viande', 'Viande rouge'], ['volaille', 'Volaille'], ['poisson', 'Poisson'], ['oeufs', 'Œufs'],
        ['laitiers', 'Produits laitiers'], ['legumineuses', 'Légumineuses'], ['tofu', 'Tofu, tempeh'], ['poudre', 'Protéine en poudre'],
      ]) },
      { id: 'fruitsLegumes', label: 'Fruits et légumes', type: 'choice', options: opts([
        ['rarement', 'Rarement'], ['parfois', 'Quelques fois par semaine'], ['chaque-jour', 'Chaque jour'], ['chaque-repas', 'À presque chaque repas'],
      ]) },
      { id: 'feculents', label: 'Féculents (pain, pâtes, riz, pommes de terre…)', type: 'choice', options: opts([
        ['rarement', 'Rarement'], ['certains-repas', 'À certains repas'], ['chaque-repas', 'À presque chaque repas'],
      ]) },
      { id: 'collations', label: 'Collations', type: 'choice', options: opts([
        ['jamais', 'Jamais'], ['parfois', 'Parfois'], ['chaque-jour', 'Chaque jour'],
      ]) },
      { id: 'boissons', label: 'Boissons habituelles', type: 'multi', options: opts([
        ['eau', 'Eau'], ['cafe', 'Café'], ['the', 'Thé, infusions'], ['sodas', 'Sodas'], ['jus', 'Jus'],
        ['alcool', 'Alcool'], ['energisantes', 'Boissons énergisantes'],
      ]) },
      { id: 'hydratation', label: 'Eau bue par jour, environ', type: 'choice', options: opts([
        ['<1', 'Moins d’1 L'], ['1-1.5', '1 à 1,5 L'], ['1.5-2', '1,5 à 2 L'], ['>2', 'Plus de 2 L'], ['inconnu', 'Je ne sais pas'],
      ]) },
      { id: 'fringales', label: 'Fringales', type: 'choice', options: opts([
        ['rarement', 'Rarement'], ['parfois', 'Parfois'], ['souvent', 'Souvent'],
      ]) },
      { id: 'fringalesMoment', label: 'À quel moment, en général ?', type: 'text', maxLength: 150,
        showIf: (d) => d.fringales === 'parfois' || d.fringales === 'souvent' },
      { id: 'budget', label: 'Budget alimentation', type: 'choice', options: opts([
        ['serre', 'Serré'], ['moyen', 'Moyen'], ['confortable', 'Confortable'],
      ]) },
      { id: 'tempsCuisine', label: 'Temps pour cuisiner un repas', type: 'choice', options: opts([
        ['<15', 'Moins de 15 min'], ['15-30', '15 à 30 min'], ['30-60', '30 min à 1 h'], ['>60', 'Plus d’1 h'],
      ]) },
      { id: 'exterieur', label: 'Repas pris à l’extérieur par semaine', type: 'choice', options: opts([
        ['rarement', 'Rarement'], ['1-2', '1 ou 2'], ['3-5', '3 à 5'], ['presque-tous', 'Presque tous'],
      ]) },
      { id: 'journeeType', label: 'Ta journée type', type: 'textarea', optional: true, maxLength: 1500,
        hint: 'Écris librement ce que tu manges un jour normal, du matin au soir.' },
    ],
  },
  {
    id: 'motivation',
    title: 'Ta motivation',
    intro: 'Pour que le coach t’accompagne de la façon qui te convient.',
    fields: [
      { id: 'moteurs', label: 'Ce qui te motive', type: 'multi', options: opts([
        ['sante', 'Ma santé'], ['energie', 'Avoir plus d’énergie'], ['apparence', 'Me sentir bien dans mon corps'],
        ['force', 'Gagner en force'], ['stress', 'Évacuer le stress'], ['defi', 'Relever un défi'], ['social', 'M’entraîner avec d’autres'],
      ]) },
      { id: 'difficultes', label: 'Ce qui te freine d’habitude', type: 'multi', options: opts([
        ['temps', 'Le manque de temps'], ['fatigue', 'La fatigue'], ['motivation', 'Une motivation en dents de scie'],
        ['quoi-faire', 'Ne pas savoir quoi faire'], ['regard', 'Le regard des autres'], ['douleurs', 'Des douleurs'],
        ['repas', 'L’organisation des repas'],
      ]) },
      { id: 'confiance', label: 'À quel point es-tu à l’aise à la salle ?', type: 'choice', options: opts([
        ['1', 'Pas du tout'], ['2', 'Un peu'], ['3', 'Moyennement'], ['4', 'Plutôt'], ['5', 'Tout à fait'],
      ]) },
      { id: 'accompagnement', label: 'Le type d’accompagnement que tu préfères', type: 'choice', options: opts([
        ['guide', 'Très guidé, étape par étape'], ['conseils', 'Quelques conseils, je m’organise'], ['autonome', 'Autonome, juste le suivi'],
      ]) },
      { id: 'ton', label: 'Le ton du coach', type: 'choice', options: opts([
        ['doux', 'Doux et encourageant'], ['direct', 'Direct et concis'],
      ]) },
      { id: 'autre', label: 'Autre chose à savoir ?', type: 'textarea', optional: true, maxLength: 600 },
    ],
  },
];

// ---------- Règles ----------

export function isAnswered(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function visibleFields(step, stepData = {}) {
  return step.fields.filter((f) => !f.showIf || f.showIf(stepData));
}

// Transforme une saisie de nombre ("72,5") en valeur, ou renvoie une erreur en français.
export function parseNumber(field, raw) {
  const text = String(raw ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (text === '') return { value: undefined };
  if (!/^\d+(\.\d+)?$/.test(text)) return { error: 'Indique un nombre.' };
  const n = Number(text);
  if (field.integer && !Number.isInteger(n)) return { error: 'Indique un nombre entier.' };
  if (n < field.min || n > field.max) {
    return { error: field.rangeMessage || `Indique une valeur entre ${field.min} et ${field.max}${field.unit ? ' ' + field.unit : ''}.` };
  }
  return { value: n };
}

// Erreurs de validation d'une étape (valeurs déjà enregistrées).
export function stepErrors(step, stepData = {}) {
  const errors = {};
  for (const f of visibleFields(step, stepData)) {
    const v = stepData[f.id];
    if (!isAnswered(v)) continue;
    if (f.type === 'number') {
      const { error } = parseNumber(f, v);
      if (error) errors[f.id] = error;
    } else if (f.type === 'choice') {
      if (!f.options.some((o) => o.id === v)) errors[f.id] = 'Choix inconnu.';
    } else if (f.type === 'multi' || f.type === 'rank') {
      if (!Array.isArray(v) || v.some((x) => !f.options.some((o) => o.id === x))) errors[f.id] = 'Choix inconnu.';
    } else if (f.maxLength && String(v).length > f.maxLength) {
      errors[f.id] = `${f.maxLength} caractères maximum.`;
    }
  }
  return errors;
}

export function stepWarnings(step, stepData = {}) {
  return step.check ? step.check(stepData) : [];
}

// 'manquant' : rien de répondu · 'incomplet' : il manque une info essentielle · 'renseigne' : ok.
export function stepStatus(step, stepData = {}) {
  const fields = visibleFields(step, stepData);
  if (!fields.some((f) => isAnswered(stepData[f.id]))) return 'manquant';
  return fields.some((f) => f.essential && !isAnswered(stepData[f.id])) ? 'incomplet' : 'renseigne';
}

export function missingEssentials(data = {}) {
  const out = [];
  for (const step of STEPS) {
    const d = data[step.id] || {};
    for (const f of visibleFields(step, d)) {
      if (f.essential && !isAnswered(d[f.id])) out.push({ step: step.id, field: f.id, label: f.label });
    }
  }
  return out;
}

// Texte lisible d'une réponse, pour la synthèse.
export function formatValue(field, value) {
  if (!isAnswered(value)) return '';
  const label = (id) => field.options?.find((o) => o.id === id)?.label ?? id;
  switch (field.type) {
    case 'number': return `${String(value).replace('.', ',')}${field.unit ? ' ' + field.unit : ''}`;
    case 'choice': return label(value);
    case 'multi': return value.map(label).join(', ');
    case 'rank': return value.map((id, i) => `${i + 1}. ${label(id)}`).join(' · ');
    default: return String(value);
  }
}

// Applique un clic sur une option d'un choix multiple (gère l'option exclusive « Aucune »).
export function toggleMulti(field, current = [], id) {
  const set = new Set(current);
  if (set.has(id)) set.delete(id);
  else if (field.exclusive && id === field.exclusive) return [id];
  else {
    set.add(id);
    if (field.exclusive) set.delete(field.exclusive);
  }
  return field.options.map((o) => o.id).filter((x) => set.has(x)); // ordre stable
}

// Classement : ajoute en dernier, retire, ou déplace d'un cran.
export function toggleRank(current = [], id) {
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
}

export function moveRank(current = [], id, delta) {
  const i = current.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= current.length) return current;
  const out = [...current];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// Retire les réponses aux questions masquées (ex. détail d'une douleur si « Non »).
export function cleanStep(step, stepData = {}) {
  const visible = new Set(visibleFields(step, stepData).map((f) => f.id));
  return Object.fromEntries(Object.entries(stepData).filter(([k, v]) => visible.has(k) && isAnswered(v)));
}
