// Catalogue GÉNÉRIQUE d'équipements de salle de sport.
// Ce n'est PAS l'inventaire d'un club : chaque personne coche ce qu'elle a vu dans sa salle.

export const EQUIPMENT_CATEGORIES = [
  { id: 'libres', label: 'Poids libres' },
  { id: 'jambes', label: 'Machines jambes et fessiers' },
  { id: 'haut', label: 'Machines haut du corps' },
  { id: 'poulies', label: 'Poulies' },
  { id: 'accessoires', label: 'Accessoires et poids du corps' },
  { id: 'cardio', label: 'Cardio' },
];

export const EQUIPMENT = [
  { id: 'halteres', label: 'Haltères', cat: 'libres' },
  { id: 'barre', label: 'Barre et disques', cat: 'libres' },
  { id: 'kettlebell', label: 'Kettlebells', cat: 'libres' },
  { id: 'banc', label: 'Banc réglable', cat: 'libres' },
  { id: 'rack', label: 'Rack ou cage à squat', cat: 'libres' },

  { id: 'presse-cuisses', label: 'Presse à cuisses', cat: 'jambes' },
  { id: 'smith', label: 'Smith machine (barre guidée)', cat: 'jambes' },
  { id: 'leg-extension', label: 'Leg extension', cat: 'jambes' },
  { id: 'leg-curl', label: 'Leg curl', cat: 'jambes' },
  { id: 'hip-thrust-machine', label: 'Machine hip thrust / fessiers', cat: 'jambes' },
  { id: 'abducteurs', label: 'Machine abducteurs', cat: 'jambes' },
  { id: 'adducteurs', label: 'Machine adducteurs', cat: 'jambes' },
  { id: 'banc-lombaires', label: 'Banc à lombaires (45°)', cat: 'jambes' },

  { id: 'chest-press', label: 'Chest press (développé assis)', cat: 'haut' },
  { id: 'pec-deck', label: 'Pec deck (butterfly)', cat: 'haut' },
  { id: 'shoulder-press', label: 'Shoulder press (développé épaules)', cat: 'haut' },
  { id: 'machine-traction-assistee', label: 'Tractions assistées (machine)', cat: 'haut' },
  { id: 'barre-traction', label: 'Barre de traction', cat: 'haut' },
  { id: 'chaise-romaine', label: 'Chaise romaine (dips, relevés de jambes)', cat: 'haut' },

  { id: 'tirage-vertical', label: 'Tirage vertical (poulie haute)', cat: 'poulies' },
  { id: 'tirage-horizontal', label: 'Tirage horizontal (poulie basse, rowing)', cat: 'poulies' },
  { id: 'poulie-vis-a-vis', label: 'Poulies réglables / vis-à-vis', cat: 'poulies' },

  { id: 'tapis-sol', label: 'Tapis de sol', cat: 'accessoires' },
  { id: 'elastiques', label: 'Élastiques de résistance', cat: 'accessoires' },
  { id: 'trx', label: 'Sangles de suspension (TRX)', cat: 'accessoires' },
  { id: 'step', label: 'Step ou box', cat: 'accessoires' },
  { id: 'swiss-ball', label: 'Swiss ball', cat: 'accessoires' },

  { id: 'tapis-course', label: 'Tapis de course', cat: 'cardio' },
  { id: 'velo', label: 'Vélo', cat: 'cardio' },
  { id: 'rameur', label: 'Rameur', cat: 'cardio' },
  { id: 'elliptique', label: 'Elliptique', cat: 'cardio' },
];

export const equipmentLabel = (id, custom = []) =>
  EQUIPMENT.find((e) => e.id === id)?.label ?? custom.find((e) => e.id === id)?.label ?? id;
