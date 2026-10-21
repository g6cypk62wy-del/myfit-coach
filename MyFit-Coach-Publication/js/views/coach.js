import { pageHeader, profileButton, icon, esc, openSheet, toast } from '../ui.js';
import { coachReply, SUGGESTIONS } from '../coach-rules.js';
import { getProfile } from '../profile-store.js';
import { getProgram, getSessions, getActive, getGym } from '../training/store.js';
import { startSession } from './entrainement.js';

export const title = 'Mon coach';

const WELCOME = {
  from: 'coach',
  paragraphs: [
    'Bonjour ! Je suis ton coach.',
    'Je ne suis pas une IA : mes réponses sont calculées à partir des données que tu enregistres dans l’app (profil, programme, séances, journal). Quand il me manque une information, je te le dis.',
  ],
};
const MAX_MESSAGES = 60;

function bubble(m, i) {
  if (m.from === 'me') return `<div class="msg msg-me"><p>${esc(m.text)}</p></div>`;
  const [first, ...rest] = m.paragraphs;
  const action = m.action
    ? m.action.start
      ? `<button type="button" class="btn btn-primary btn-sm" data-start="${esc(m.action.start)}" data-only="${esc((m.action.only ?? []).join(','))}">${m.action.label}</button>`
      : `<a class="btn btn-ghost btn-sm" href="${m.action.href}">${m.action.label}</a>`
    : '';
  return `
    <div class="msg msg-coach" data-i="${i}">
      <p>${first}</p>
      ${m.missing?.length ? `<ul class="missing">${m.missing.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
      ${rest.map((p) => `<p>${p}</p>`).join('')}
      ${m.list?.length ? `<ul class="coach-list">${m.list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${(m.after ?? []).map((p) => `<p>${p}</p>`).join('')}
      ${action}
      ${m.basis?.length ? `<p class="basis">Basé sur : ${m.basis.join(', ')}</p>` : ''}
    </div>`;
}

export function render(root, ctx) {
  const { store } = ctx;
  root.classList.add('view-coach');
  let messages = store.get('coachMessages', []);

  root.innerHTML = `
    ${pageHeader({ title: 'Mon coach', actions: `<button type="button" class="icon-btn" data-act="clear" aria-label="Effacer la conversation">${icon('trash')}</button>${profileButton}` })}
    <p class="badge">${icon('info')} Coach sans IA · réponses fondées sur tes données</p>

    <div class="chat" id="chat" aria-live="polite"></div>

    <div class="suggestions" role="list" aria-label="Questions suggérées">
      ${SUGGESTIONS.map((s) => `<button type="button" class="chip" role="listitem" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}
    </div>

    <form class="composer" id="composer" autocomplete="off">
      <label class="sr-only" for="ask">Ta question</label>
      <textarea id="ask" rows="1" maxlength="500" placeholder="Pose ta question…" enterkeyhint="send"></textarea>
      <button class="send" type="submit" aria-label="Envoyer" disabled>${icon('send')}</button>
    </form>`;

  const chat = root.querySelector('#chat');
  const form = root.querySelector('#composer');
  const input = root.querySelector('#ask');
  const send = form.querySelector('.send');

  function drawChat() {
    chat.innerHTML = [WELCOME, ...messages].map(bubble).join('');
  }
  drawChat();

  function ask(text) {
    const clean = text.trim();
    if (!clean) return;
    const data = {
      profile: getProfile(store),
      program: getProgram(store),
      sessions: getSessions(store),
      journal: store.get('journal', {}),
      activeSession: getActive(store),
      gym: getGym(store),
      targets: store.get('nutritionTargets'),
    };
    messages.push({ from: 'me', text: clean });
    messages.push({ from: 'coach', ...coachReply(clean, data) });
    messages = messages.slice(-MAX_MESSAGES);
    if (!store.set('coachMessages', messages)) toast('La conversation n’a pas pu être enregistrée.', 'error');
    drawChat();
    chat.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    send.disabled = !input.value.trim();
  }
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ask(input.value);
    input.value = '';
    autosize();
  });
  root.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-suggest]');
    if (chip) { ask(chip.dataset.suggest); return; }
    const start = e.target.closest('[data-start]');
    if (start) {
      const only = start.dataset.only ? start.dataset.only.split(',') : null;
      startSession(ctx, start.dataset.start, only);
      return;
    }
    if (e.target.closest('[data-act="clear"]')) {
      if (!messages.length) { toast('La conversation est déjà vide.'); return; }
      openSheet({
        title: 'Effacer la conversation ?',
        body: '<p>Les messages échangés avec le coach seront supprimés. Tes autres données ne changent pas.</p>',
        actions: [
          { label: 'Annuler', kind: 'ghost' },
          { label: 'Effacer', kind: 'danger', onClick: () => { messages = []; store.remove('coachMessages'); drawChat(); } },
        ],
      });
    }
  });

  requestAnimationFrame(() => {
    if (messages.length) chat.lastElementChild?.scrollIntoView({ block: 'start' });
  });
}
