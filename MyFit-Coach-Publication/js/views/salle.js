// « Ma salle On Air » : la personne coche ce qu'elle a réellement vu dans son club.

import { pageHeader, icon, esc, toast, openSheet } from '../ui.js';
import { EQUIPMENT, EQUIPMENT_CATEGORIES } from '../data/equipment.js';
import { getGym, saveGym } from '../training/store.js';
import { uid } from '../text.js';

export const title = 'Ma salle';

export function render(root, ctx) {
  const { store } = ctx;
  const gym = getGym(store) ?? { club: '', available: [], known: [], avoid: [], custom: [], noEquipment: false };
  gym.custom ??= [];

  function save() {
    if (!saveGym(store, gym)) toast('Impossible d’enregistrer sur cet appareil.', 'error');
    const el = root.querySelector('#gym-count');
    if (el) el.textContent = countText();
  }
  const countText = () => {
    const n = gym.available.length + gym.custom.length;
    return n ? `${n} équipement${n > 1 ? 's' : ''} coché${n > 1 ? 's' : ''}` : 'Aucun équipement coché';
  };

  function row(e, isCustom = false) {
    const on = gym.available.includes(e.id) || isCustom;
    return `
      <div class="eq-row${on ? ' on' : ''}" data-eq="${e.id}">
        <button type="button" class="eq-main" role="switch" aria-checked="${on}" data-act="toggle" ${isCustom ? 'disabled' : ''}>
          <span class="eq-check" aria-hidden="true">${on ? icon('check') : ''}</span>
          <span class="eq-label">${esc(e.label)}</span>
        </button>
        ${on && !isCustom ? `
        <div class="eq-flags">
          <button type="button" class="mini-chip" aria-pressed="${gym.known.includes(e.id)}" data-act="known">Je sais l’utiliser</button>
          <button type="button" class="mini-chip mini-chip-warn" aria-pressed="${gym.avoid.includes(e.id)}" data-act="avoid">À éviter</button>
        </div>` : ''}
        ${isCustom ? `<button type="button" class="link-btn" data-act="remove-custom">Retirer</button>` : ''}
      </div>`;
  }

  function draw() {
    root.innerHTML = `
      ${pageHeader({ title: 'Ma salle', eyebrow: 'Équipements disponibles', back: '#/entrainement' })}

      <p class="note">${icon('info')}<span>L’app ne connaît pas l’inventaire réel de ton club. Coche uniquement ce que tu as vu sur place : le programme n’utilisera que ces équipements.</span></p>

      <div class="field block-gap">
        <label class="field-label" for="club">Nom du club</label>
        <input id="club" class="input" type="text" maxlength="80" placeholder="ex. On Air Fitness (ville)" value="${esc(gym.club || '')}">
      </div>

      <div class="card list block-gap">
        <button type="button" class="eq-main eq-solo" role="switch" aria-checked="${Boolean(gym.noEquipment)}" data-act="no-equipment">
          <span class="eq-check" aria-hidden="true">${gym.noEquipment ? icon('check') : ''}</span>
          <span class="eq-label">Je m’entraîne aussi sans matériel<br><span class="row-sub">Exercices au poids du corps toujours possibles</span></span>
        </button>
      </div>

      <p class="hint" id="gym-count" aria-live="polite">${countText()}</p>

      ${EQUIPMENT_CATEGORIES.map((c) => `
        <section class="block">
          <h2 class="block-title">${c.label}</h2>
          <div class="card list">${EQUIPMENT.filter((e) => e.cat === c.id).map((e) => row(e)).join('')}</div>
        </section>`).join('')}

      <section class="block">
        <h2 class="block-title">Ajoutés par toi</h2>
        <div class="card list">
          ${gym.custom.length ? gym.custom.map((e) => row(e, true)).join('') : '<p class="row-sub pad">Rien pour l’instant.</p>'}
        </div>
        <button type="button" class="btn btn-ghost btn-block" data-act="add-custom">${icon('plus')} Ajouter un équipement</button>
        <p class="hint">Les équipements ajoutés sont notés pour toi, mais le programme ne s’en sert pas encore (l’app ne sait pas quels exercices y faire).</p>
      </section>`;
  }
  draw();

  root.addEventListener('input', (e) => {
    if (e.target.id === 'club') { gym.club = e.target.value; save(); }
  });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('[data-eq]')?.dataset.eq;
    const act = btn.dataset.act;
    const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
    if (act === 'toggle') {
      gym.available = toggleIn(gym.available, id);
      if (!gym.available.includes(id)) {
        gym.known = gym.known.filter((x) => x !== id);
        gym.avoid = gym.avoid.filter((x) => x !== id);
      }
    } else if (act === 'known') gym.known = toggleIn(gym.known, id);
    else if (act === 'avoid') gym.avoid = toggleIn(gym.avoid, id);
    else if (act === 'no-equipment') gym.noEquipment = !gym.noEquipment;
    else if (act === 'remove-custom') gym.custom = gym.custom.filter((x) => x.id !== id);
    else if (act === 'add-custom') {
      openSheet({
        title: 'Ajouter un équipement',
        body: `<div class="field"><label class="field-label" for="custom-name">Nom de l’équipement</label>
               <input id="custom-name" class="input" type="text" maxlength="60" placeholder="ex. Machine à mollets"></div>`,
        actions: [
          { label: 'Annuler', kind: 'ghost' },
          {
            label: 'Ajouter', kind: 'primary',
            onClick: () => {
              const name = document.getElementById('custom-name').value.trim();
              if (!name) { toast('Indique un nom.', 'error'); return false; }
              gym.custom.push({ id: 'perso-' + uid(), label: name });
              save();
              draw();
              return true;
            },
          },
        ],
      });
      setTimeout(() => document.getElementById('custom-name')?.focus(), 50);
      return;
    } else return;
    save();
    const y = window.scrollY;
    draw();
    window.scrollTo(0, y);
    root.querySelector(id ? `[data-eq="${id}"] [data-act="${act}"]` : `[data-act="${act}"]`)?.focus({ preventScroll: true });
  });
}
