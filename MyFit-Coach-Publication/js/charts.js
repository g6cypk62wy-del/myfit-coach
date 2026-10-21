// Graphiques SVG simples (une seule série, couleur d'accent), sans bibliothèque.
// Chaque graphique a : un résumé lisible (aria-label), une infobulle au survol / au toucher,
// et un tableau des valeurs (« Voir les valeurs ») pour l'accessibilité.

import { esc } from './ui.js';

const W = 340;
const H = 160;
const PAD = { l: 34, r: 10, t: 14, b: 26 };

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function table(rows, headers) {
  return `
    <details class="chart-table"><summary>Voir les valeurs</summary>
      <table><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    </details>`;
}

// data : [{ label, value, tip }]
export function barChart(data, { summary, unit = '', headers = ['Période', 'Valeur'], integer = false } = {}) {
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const step = iw / data.length;
  const bw = Math.max(6, Math.min(28, step - 6));
  const y = (v) => PAD.t + ih - (v / max) * ih;
  const ticks = [0, max / 2, max].filter((g) => !integer || Number.isInteger(g));
  const grid = ticks.map((g) => `
    <line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(g)}" y2="${y(g)}" class="grid"/>
    <text x="${PAD.l - 6}" y="${y(g) + 4}" class="axis" text-anchor="end">${Number.isInteger(g) ? g : String(g.toFixed(1)).replace('.', ',')}</text>`).join('');
  const bars = data.map((d, i) => {
    const x = PAD.l + i * step + (step - bw) / 2;
    const h = Math.max(0, PAD.t + ih - y(d.value));
    const r = Math.min(4, h / 2, bw / 2);
    // Barre avec coins arrondis en haut seulement (ancrée à la ligne de base).
    const path = h > 0
      ? `M${x},${PAD.t + ih} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + bw - r} Q${x + bw},${y(d.value)} ${x + bw},${y(d.value) + r} V${PAD.t + ih} Z`
      : '';
    return `
      <g class="hit" tabindex="0" data-tip="${esc(d.tip ?? `${d.label} : ${d.value}${unit}`)}">
        <rect x="${PAD.l + i * step}" y="${PAD.t}" width="${step}" height="${ih}" fill="transparent"/>
        ${path ? `<path d="${path}" class="bar"/>` : ''}
        <text x="${PAD.l + i * step + step / 2}" y="${H - 8}" class="axis" text-anchor="middle">${esc(d.label)}</text>
      </g>`;
  }).join('');
  return `
    <figure class="chart">
      <div class="chart-tip" aria-hidden="true"></div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary)}">${grid}${bars}</svg>
      ${table(data.map((d) => [d.label, `${d.value}${unit}`]), headers)}
    </figure>`;
}

// points : [{ x: Date, y: number, label, tip }] (déjà triés)
export function lineChart(points, { summary, unit = '', headers = ['Date', 'Valeur'] } = {}) {
  const ys = points.map((p) => p.y);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }
  const padY = (hi - lo) * 0.15;
  lo = Math.max(0, lo - padY);
  hi += padY;
  const t0 = points[0].x.getTime();
  const t1 = points[points.length - 1].x.getTime();
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (d) => PAD.l + (t1 === t0 ? iw / 2 : ((d.getTime() - t0) / (t1 - t0)) * iw);
  const y = (v) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih;
  const fmt = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  const grid = [lo, (lo + hi) / 2, hi].map((g) => `
    <line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(g)}" y2="${y(g)}" class="grid"/>
    <text x="${PAD.l - 6}" y="${y(g) + 4}" class="axis" text-anchor="end">${fmt(g)}</text>`).join('');
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const dots = points.map((p) => `
    <g class="hit" tabindex="0" data-tip="${esc(p.tip ?? `${p.label} : ${fmt(p.y)}${unit}`)}">
      <circle cx="${x(p.x)}" cy="${y(p.y)}" r="14" fill="transparent"/>
      <circle cx="${x(p.x)}" cy="${y(p.y)}" r="4" class="dot"/>
    </g>`).join('');
  const first = points[0];
  const last = points[points.length - 1];
  return `
    <figure class="chart">
      <div class="chart-tip" aria-hidden="true"></div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary)}">
        ${grid}
        <path d="${line}" class="line"/>
        ${dots}
        <text x="${PAD.l}" y="${H - 8}" class="axis">${esc(first.label)}</text>
        ${points.length > 1 ? `<text x="${W - PAD.r}" y="${H - 8}" class="axis" text-anchor="end">${esc(last.label)}</text>` : ''}
      </svg>
      ${table(points.map((p) => [p.label, `${fmt(p.y)}${unit}`]), headers)}
    </figure>`;
}

// Infobulle : survol (souris), toucher ou focus clavier sur un élément .hit.
export function bindChartTips(root) {
  const show = (g) => {
    const fig = g.closest('.chart');
    const tip = fig?.querySelector('.chart-tip');
    if (!tip) return;
    tip.textContent = g.dataset.tip;
    tip.classList.add('on');
    fig.querySelectorAll('.hit.active').forEach((x) => x.classList.remove('active'));
    g.classList.add('active');
  };
  const hide = (fig) => {
    fig?.querySelector('.chart-tip')?.classList.remove('on');
    fig?.querySelectorAll('.hit.active').forEach((x) => x.classList.remove('active'));
  };
  root.addEventListener('pointerover', (e) => { const g = e.target.closest('.hit'); if (g) show(g); });
  root.addEventListener('pointerleave', (e) => { if (e.target.classList?.contains('chart')) hide(e.target); }, true);
  root.addEventListener('focusin', (e) => { const g = e.target.closest('.hit'); if (g) show(g); });
  root.addEventListener('click', (e) => { const g = e.target.closest('.hit'); if (g) show(g); });
}
