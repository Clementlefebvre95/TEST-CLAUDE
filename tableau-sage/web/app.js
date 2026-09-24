'use strict';

const $ = (id) => document.getElementById(id);

const state = {
  info: null,
  sales: null,
  stock: null,
  tab: 'sales',
  chartMode: 'chart',
  filter: 'all',
  search: '',
  sort: { key: 'ref', dir: 1 },
  limit: 300,
  depot: 0,
  selectedDb: '',
  canCancelSetup: false,
};

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// ---------- helpers ----------

// h builds DOM nodes; strings become text nodes, so data from Sage is never parsed as HTML.
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function svg(tag, attrs, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  for (const c of children.flat()) {
    if (c === null || c === undefined) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const nfPct = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' });
const nfCompact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

const currency = () => (state.info && state.info.currency) || '€';
const money = (v) => nf0.format(Math.round(v || 0)) + ' ' + currency();
const moneyCompact = (v) => (Math.abs(v) < 1000 ? nf0.format(v) : nfCompact.format(v)) + ' ' + currency();
const qty = (v) => nf2.format(v || 0);

async function api(path, body) {
  const opts = body === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
  let res;
  try {
    res = await fetch(path, opts);
  } catch (e) {
    const err = new Error('Application arrêtée');
    err.user = { title: "L'application ne répond plus", hint: "La fenêtre noire de Tableau Sage a peut-être été fermée. Relancez l'application." };
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.error && data.error.title) || 'Erreur ' + res.status);
    err.user = (data && data.error) || { title: err.message };
    throw err;
  }
  return data;
}

function renderError(box, ue) {
  box.replaceChildren();
  if (!ue) { box.hidden = true; return; }
  box.append(h('strong', {}, ue.title || 'Erreur'));
  if (ue.hint) box.append(h('p', {}, ue.hint));
  if (ue.detail) {
    const copy = h('button', { type: 'button', class: 'link' }, 'Copier le message');
    copy.addEventListener('click', async () => {
      const text = `${ue.title}\n${ue.detail}`;
      try { await navigator.clipboard.writeText(text); copy.textContent = 'Message copié'; } catch (e) { copy.textContent = 'Sélectionnez le texte ci-dessus pour le copier'; }
    });
    box.append(h('details', {}, h('summary', {}, 'Détail technique (à envoyer à la personne qui vous aide)'), h('pre', {}, ue.detail), copy));
  }
  box.hidden = false;
}

function busy(btn, on, label) {
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; btn.classList.add('busy'); }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.classList.remove('busy'); }
}

function showScreen(id) {
  for (const s of ['screen-loading', 'screen-setup', 'screen-dash']) $(s).hidden = s !== id;
}

// ---------- startup ----------

async function boot() {
  try {
    applyState(await api('/api/state'));
  } catch (e) {
    showScreen('screen-setup');
    renderError($('setup-error'), e.user);
  }
}

function applyState(s) {
  state.info = s;
  if (s.status === 'ready') {
    openDashboard();
  } else if (s.status === 'connecting') {
    showScreen('screen-loading');
    $('loading-text').textContent = 'Connexion à Sage…';
    setTimeout(boot, 1000);
  } else {
    state.canCancelSetup = false;
    showSetup(s);
  }
}

// ---------- setup ----------

function showSetup(s) {
  showScreen('screen-setup');
  $('server').value = s.server || $('server').value;
  const auth = s.auth === 'sql' ? 'sql' : 'windows';
  document.querySelector(`input[name="auth"][value="${auth}"]`).checked = true;
  $('user').value = s.user || '';
  $('password').value = '';
  $('currency').value = s.currency || '€';
  state.selectedDb = s.database || '';
  $('sql-fields').hidden = auth !== 'sql';
  $('step-company').hidden = true;
  renderError($('setup-error'), s.error);
  $('try-demo').textContent = state.canCancelSetup ? 'Revenir au tableau de bord sans rien changer' : 'Voir une démonstration avec des données fictives';
  if (!$('server').value) $('server').focus();
}

function setupRequest() {
  const auth = document.querySelector('input[name="auth"]:checked').value;
  return {
    server: $('server').value.trim(),
    auth,
    user: auth === 'sql' ? $('user').value.trim() : '',
    password: auth === 'sql' ? $('password').value : '',
  };
}

function invalidateCompanies() {
  $('step-company').hidden = true;
  $('finish').disabled = true;
}

for (const r of document.querySelectorAll('input[name="auth"]')) {
  r.addEventListener('change', () => {
    $('sql-fields').hidden = r.value !== 'sql' || !r.checked;
    if (r.checked && r.value === 'sql') $('user').focus();
    invalidateCompanies();
  });
}
for (const id of ['server', 'user', 'password']) $(id).addEventListener('input', invalidateCompanies);

$('discover').addEventListener('click', async () => {
  const btn = $('discover');
  const box = $('servers-found');
  busy(btn, true, 'Recherche…');
  try {
    const { servers } = await api('/api/discover');
    box.replaceChildren();
    if (!servers.length) {
      box.append(h('p', { class: 'help' }, "Aucun serveur n'a répondu. Saisissez le nom à la main."));
    } else {
      box.append(h('span', { class: 'help', style: 'margin:0;align-self:center' }, 'Trouvé :'));
      for (const name of servers) {
        box.append(h('button', {
          type: 'button', class: 'chip',
          onclick: () => { $('server').value = name; invalidateCompanies(); $('connect').focus(); },
        }, name));
      }
    }
    box.hidden = false;
  } catch (e) {
    renderError($('setup-error'), e.user);
  } finally {
    busy(btn, false);
  }
});

$('setup-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const req = setupRequest();
  if (!req.server) { $('server').focus(); return; }
  if (req.auth === 'sql' && !req.user) { $('user').focus(); return; }
  const btn = $('connect');
  busy(btn, true, 'Connexion…');
  renderError($('setup-error'), null);
  try {
    const list = await api('/api/databases', req);
    renderCompanies(list);
  } catch (e) {
    invalidateCompanies();
    renderError($('setup-error'), e.user);
  } finally {
    busy(btn, false);
  }
});

function companyChoice(db, title, sub) {
  const input = h('input', { type: 'radio', name: 'company', value: db });
  input.checked = db === state.selectedDb;
  input.addEventListener('change', () => { state.selectedDb = db; $('finish').disabled = false; });
  return h('label', { class: 'choice' }, input, h('span', {}, h('strong', {}, title), sub ? h('small', {}, sub) : null));
}

function renderCompanies(list) {
  const box = $('companies');
  box.replaceChildren();
  const all = [...list.sage.map((c) => c.database), ...list.others];
  if (!all.includes(state.selectedDb)) state.selectedDb = '';
  if (list.sage.length === 1 && !state.selectedDb) state.selectedDb = list.sage[0].database;

  if (list.sage.length) {
    for (const c of list.sage) box.append(companyChoice(c.database, c.name, c.name !== c.database ? 'Base ' + c.database : null));
  } else {
    box.append(h('p', { class: 'help', style: 'margin:0' },
      "Connexion réussie, mais aucune société Sage 100 Gestion commerciale n'est visible avec cet identifiant."));
  }
  const others = $('other-dbs-list');
  others.replaceChildren(...list.others.map((db) => companyChoice(db, db)));
  $('other-dbs').hidden = !list.others.length;
  $('other-dbs').open = !list.sage.length;
  $('finish').disabled = !state.selectedDb;
  $('step-company').hidden = false;
  $('step-company').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('finish').addEventListener('click', async () => {
  const btn = $('finish');
  busy(btn, true, 'Vérification…');
  renderError($('setup-error'), null);
  try {
    const s = await api('/api/config', { ...setupRequest(), database: state.selectedDb, currency: $('currency').value.trim() });
    state.sales = state.stock = null;
    state.depot = 0;
    applyState(s);
  } catch (e) {
    renderError($('setup-error'), e.user);
    $('setup-error').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } finally {
    busy(btn, false);
  }
});

$('try-demo').addEventListener('click', async () => {
  if (state.canCancelSetup) { openDashboard(); return; }
  try {
    state.sales = state.stock = null;
    applyState(await api('/api/demo', {}));
  } catch (e) {
    renderError($('setup-error'), e.user);
  }
});

// ---------- dashboard ----------

function openDashboard() {
  showScreen('screen-dash');
  const s = state.info;
  $('company').textContent = s.company || s.database || 'Tableau Sage';
  document.title = (s.company || 'Tableau Sage') + ' · Tableau Sage';
  $('demo-badge').hidden = !s.demo;
  selectTab(state.tab);
  if (!state.sales) loadSales();
  if (!state.stock) loadStock();
}

function selectTab(tab) {
  state.tab = tab;
  for (const t of ['sales', 'stock']) {
    $('tab-' + t).setAttribute('aria-selected', String(t === tab));
    $('view-' + t).hidden = t !== tab;
  }
  if (tab === 'sales' && state.sales) renderChart();
}
$('tab-sales').addEventListener('click', () => selectTab('sales'));
$('tab-stock').addEventListener('click', () => selectTab('stock'));

let pending = 0;
async function load(fn) {
  pending++;
  document.querySelector('main').classList.add('loading');
  try {
    await fn();
    renderError($('dash-error'), null);
    $('updated').textContent = 'Mis à jour à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    renderError($('dash-error'), e.user);
  } finally {
    if (--pending === 0) document.querySelector('main').classList.remove('loading');
  }
}

const loadSales = () => load(async () => { state.sales = await api('/api/sales'); renderSales(); });
const loadStock = () => load(async () => { state.stock = await api('/api/stock?depot=' + state.depot); renderStock(); });

$('refresh').addEventListener('click', () => { loadSales(); loadStock(); });
setInterval(() => {
  if (document.visibilityState === 'visible' && !$('screen-dash').hidden) { loadSales(); loadStock(); }
}, 10 * 60 * 1000);

// ---------- sales ----------

function deltaLine(cur, prev, label) {
  if (!(prev > 0)) return h('div', { class: 'delta' }, `Pas de ventes à comparer ${label}`);
  const change = (cur - prev) / prev * 100;
  const up = change >= 0;
  return h('div', { class: 'delta' },
    h('span', { class: up ? 'up' : 'down' }, (up ? '▲ ' : '▼ ') + nfPct.format(change) + ' %'),
    ` ${label} (${money(prev)})`);
}

function renderSales() {
  const r = state.sales;
  const k = r.kpi;
  const today = new Date(r.today + 'T12:00:00');
  const month = MONTHS[today.getMonth()];
  const ly = r.year - 1;

  $('sales-tiles').replaceChildren(
    h('div', { class: 'tile hero' },
      h('div', { class: 'label' }, `Depuis le 1er janvier ${r.year}`),
      h('div', { class: 'value' }, money(k.year)),
      deltaLine(k.year, k.yearLastYear, `par rapport à la même période en ${ly}`),
      h('div', { class: 'delta' }, `Année ${ly} complète : ${money(k.lastYearTotal)}`)),
    h('div', { class: 'tile' },
      h('div', { class: 'label' }, `Ce mois-ci (${month})`),
      h('div', { class: 'value' }, money(k.month)),
      deltaLine(k.month, k.monthLastYear, `vs ${month} ${ly} à la même date`)),
    h('div', { class: 'tile' },
      h('div', { class: 'label' }, "Aujourd'hui"),
      h('div', { class: 'value' }, money(k.today)),
      h('div', { class: 'delta' }, today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))),
  );

  $('chart-legend').replaceChildren(
    h('span', {}, h('i', { style: 'background:var(--series-n1)' }), String(ly)),
    h('span', {}, h('i', { style: 'background:var(--series-n)' }), String(r.year)));
  renderChart();
  renderChartTable();

  const share = (v) => (k.year > 0 ? v / k.year : 0);
  $('top-clients').replaceChildren(r.topClients.length ? h('div', { class: 'table-scroll' }, h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Client'), h('th', { class: 'num' }, 'CA HT'), h('th', { class: 'num' }, 'Part du CA'))),
    h('tbody', {}, r.topClients.map((c, i) => h('tr', {},
      h('td', { class: 'rank' }, i + 1),
      h('td', { class: 'wrap' }, c.name, h('div', { class: 'muted small' }, c.code)),
      h('td', { class: 'num' }, money(c.ht)),
      h('td', { class: 'num' }, h('div', { class: 'share' },
        h('span', { class: 'bar' }, h('i', { style: `width:${Math.max(2, Math.min(100, share(c.ht) * 100))}%` })),
        nf0.format(share(c.ht) * 100) + ' %')))))))
    : h('p', { class: 'empty' }, 'Aucune vente depuis le 1er janvier.'));

  $('top-articles').replaceChildren(r.topArticles.length ? h('div', { class: 'table-scroll' }, h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Article'), h('th', { class: 'num' }, 'Quantité'), h('th', { class: 'num' }, 'CA HT'))),
    h('tbody', {}, r.topArticles.map((a, i) => h('tr', {},
      h('td', { class: 'rank' }, i + 1),
      h('td', { class: 'wrap' }, a.name, h('div', { class: 'muted small' }, a.code)),
      h('td', { class: 'num' }, qty(a.qty)),
      h('td', { class: 'num' }, money(a.ht)))))))
    : h('p', { class: 'empty' }, 'Aucune vente depuis le 1er janvier.'));
}

function niceStep(raw) {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

// Column with a 4px rounded data end, square at the baseline.
function barPath(x, base, top, w) {
  const hgt = Math.abs(base - top);
  const r = Math.min(4, hgt, w / 2);
  if (top <= base) {
    return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${base}Z`;
  }
  return `M${x},${base}V${top - r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top - r}V${base}Z`;
}

function renderChart() {
  const box = $('chart');
  const r = state.sales;
  if (!r || box.offsetParent === null) return;
  const W = box.clientWidth;
  const narrow = W < 560;
  const H = narrow ? 230 : 290;
  const cur = r.current;
  const prev = r.previous;
  const values = [...prev, ...cur.filter((v) => v !== null)];
  let max = Math.max(0, ...values);
  let min = Math.min(0, ...values);
  if (max === min) max = 1;
  const step = niceStep((max - min) / 4);
  max = Math.ceil(max / step) * step;
  min = Math.floor(min / step) * step;

  const ticks = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(v);
  const labelW = Math.max(...ticks.map((t) => moneyCompact(t).length)) * 6.6 + 8;
  const m = { top: 10, right: 4, bottom: 26, left: labelW };
  const pw = W - m.left - m.right;
  const ph = H - m.top - m.bottom;
  const y = (v) => m.top + (max - v) / (max - min) * ph;
  const band = pw / 12;
  const bw = Math.max(4, Math.min(24, (band * 0.7 - 2) / 2));
  const base = y(0);

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': `Chiffre d'affaires HT par mois, ${r.year - 1} et ${r.year}. Détail dans la vue Tableau.` });
  const grid = svg('g', { class: 'grid' });
  for (const t of ticks) {
    grid.append(svg('line', { x1: m.left, x2: W - m.right, y1: y(t), y2: y(t) }));
    root.append(svg('text', { x: m.left - 8, y: y(t) + 4, 'text-anchor': 'end' }, moneyCompact(t)));
  }
  root.prepend(grid);

  const today = new Date(r.today + 'T12:00:00');
  const bars = svg('g', {});
  const hits = svg('g', {});
  for (let i = 0; i < 12; i++) {
    const cx = m.left + band * i + band / 2;
    const x0 = cx - bw - 1;
    bars.append(svg('path', { class: 'bar-n1', d: barPath(x0, base, y(prev[i]), bw) }));
    if (cur[i] !== null) bars.append(svg('path', { class: 'bar-n', d: barPath(cx + 1, base, y(cur[i]), bw) }));
    root.append(svg('text', { x: cx, y: H - 6, 'text-anchor': 'middle' }, narrow ? MONTHS_SHORT[i][0].toUpperCase() : MONTHS_SHORT[i]));

    const inProgress = i === today.getMonth();
    const label = `${MONTHS[i]} : ${r.year} ${cur[i] === null ? 'à venir' : money(cur[i])}, ${r.year - 1} ${money(prev[i])}`;
    const hit = svg('rect', { class: 'band', x: m.left + band * i, y: m.top, width: band, height: ph, tabindex: 0, 'aria-label': label });
    const show = (ev) => showTooltip(ev, hit, MONTHS[i] + (inProgress ? ` (en cours, jusqu'au ${today.getDate()})` : ''), [
      [String(r.year), cur[i] === null ? '—' : money(cur[i]), 'var(--series-n)'],
      [String(r.year - 1), money(prev[i]), 'var(--series-n1)'],
    ]);
    hit.addEventListener('pointermove', show);
    hit.addEventListener('focus', show);
    hit.addEventListener('pointerleave', hideTooltip);
    hit.addEventListener('blur', hideTooltip);
    hits.append(hit);
  }
  root.append(hits, bars, svg('line', { class: 'baseline', x1: m.left, x2: W - m.right, y1: base, y2: base }));
  bars.style.pointerEvents = 'none';
  box.replaceChildren(root);
}

function renderChartTable() {
  const r = state.sales;
  const ly = r.year - 1;
  $('chart-table').replaceChildren(h('div', { class: 'table-scroll' }, h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Mois'), h('th', { class: 'num' }, String(ly)), h('th', { class: 'num' }, String(r.year)), h('th', { class: 'num' }, 'Évolution'))),
    h('tbody', {}, MONTHS.map((name, i) => {
      const c = r.current[i];
      const p = r.previous[i];
      const evo = c === null || !(p > 0) ? '—' : nfPct.format((c - p) / p * 100) + ' %';
      return h('tr', {}, h('td', {}, name), h('td', { class: 'num' }, money(p)), h('td', { class: 'num' }, c === null ? '—' : money(c)), h('td', { class: 'num' }, evo));
    })))));
}

function setChartMode(mode) {
  state.chartMode = mode;
  $('show-chart').setAttribute('aria-pressed', String(mode === 'chart'));
  $('show-table').setAttribute('aria-pressed', String(mode === 'table'));
  $('chart').hidden = mode !== 'chart';
  $('chart-table').hidden = mode !== 'table';
  if (mode === 'chart') renderChart();
}
$('show-chart').addEventListener('click', () => setChartMode('chart'));
$('show-table').addEventListener('click', () => setChartMode('table'));

new ResizeObserver(() => renderChart()).observe($('chart'));

const tooltip = $('tooltip');
function showTooltip(ev, target, title, rows) {
  tooltip.replaceChildren(h('div', { class: 't-title' }, title),
    ...rows.map(([name, value, color]) => h('div', { class: 't-row' },
      h('span', { class: 't-key' }, h('i', { style: 'background:' + color }), name), h('b', {}, value))));
  tooltip.hidden = false;
  const rect = target.getBoundingClientRect();
  const px = ev.clientX !== undefined && ev.type !== 'focus' ? ev.clientX : rect.left + rect.width / 2;
  const py = ev.clientY !== undefined && ev.type !== 'focus' ? ev.clientY : rect.top + rect.height / 3;
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  let left = px + 14;
  if (left + tw > window.innerWidth - 8) left = px - tw - 14;
  let top = py - th - 12;
  if (top < 8) top = py + 16;
  tooltip.style.left = Math.max(8, left) + 'px';
  tooltip.style.top = top + 'px';
}
function hideTooltip() { tooltip.hidden = true; }

// ---------- stock ----------

const STOCK_COLUMNS = [
  { key: 'ref', label: 'Référence' },
  { key: 'name', label: 'Désignation', wrap: true },
  { key: 'family', label: 'Famille' },
  { key: 'qty', label: 'En stock', num: true },
  { key: 'reserved', label: 'Réservé', num: true },
  { key: 'available', label: 'Disponible', num: true },
  { key: 'ordered', label: 'Commandé', num: true },
  { key: 'min', label: 'Minimum', num: true },
  { key: 'value', label: 'Valeur', num: true },
  { key: 'status', label: 'État' },
];

const itemStatus = (it) => (it.qty <= 0 ? 'out' : it.min > 0 && it.qty < it.min ? 'low' : 'ok');
const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function renderStock() {
  const r = state.stock;
  const sel = $('depot');
  sel.replaceChildren(h('option', { value: 0 }, 'Tous les dépôts'), ...r.depots.map((d) => h('option', { value: d.no }, d.name || 'Dépôt ' + d.no)));
  sel.value = String(r.depot);
  sel.closest('label').hidden = r.depots.length < 2;

  const t = r.totals;
  const filterTile = (filter, label, value, dot) => h('button', {
    type: 'button', class: 'tile', style: 'text-align:left;font:inherit;color:inherit;cursor:pointer',
    onclick: () => setFilter(state.filter === filter ? 'all' : filter),
    'aria-pressed': String(state.filter === filter),
  }, h('div', { class: 'label' }, h('span', { class: 'status-dot ' + dot }), label), h('div', { class: 'value' }, nf0.format(value)),
  h('div', { class: 'delta' }, value ? 'Cliquer pour voir la liste' : 'Aucun article'));

  $('stock-tiles').replaceChildren(
    h('div', { class: 'tile' }, h('div', { class: 'label' }, 'Valeur du stock'), h('div', { class: 'value' }, money(t.value)), h('div', { class: 'delta' }, 'Valorisation Sage')),
    h('div', { class: 'tile' }, h('div', { class: 'label' }, 'Articles suivis en stock'), h('div', { class: 'value' }, nf0.format(t.articles)), h('div', { class: 'delta' }, 'Articles actifs')),
    filterTile('out', 'En rupture', t.out, 'critical'),
    filterTile('low', 'Sous le minimum', t.low, 'warning'),
  );
  renderStockTable();
}

function renderStockTable() {
  const r = state.stock;
  if (!r) return;
  const q = fold(state.search.trim());
  let rows = r.items.map((it) => ({ ...it, available: it.qty - it.reserved, status: itemStatus(it) }));
  const total = rows.length;
  if (state.filter !== 'all') rows = rows.filter((it) => it.status === state.filter);
  if (q) rows = rows.filter((it) => fold(it.ref + ' ' + it.name + ' ' + it.family).includes(q));

  const { key, dir } = state.sort;
  const order = { out: 0, low: 1, ok: 2 };
  rows.sort((a, b) => {
    const va = key === 'status' ? order[a.status] : a[key];
    const vb = key === 'status' ? order[b.status] : b[key];
    const c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr', { numeric: true });
    return c * dir || a.ref.localeCompare(b.ref, 'fr', { numeric: true });
  });

  const head = document.querySelector('#stock-table thead tr');
  head.replaceChildren(...STOCK_COLUMNS.map((c) => {
    const th = h('th', { class: c.num ? 'num' : '' },
      h('button', { type: 'button', onclick: () => sortBy(c.key) }, c.label));
    if (key === c.key) th.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending');
    return th;
  }));

  const shown = rows.slice(0, state.limit);
  const body = document.querySelector('#stock-table tbody');
  body.replaceChildren(...(shown.length ? shown.map((it) => h('tr', {},
    h('td', {}, it.ref),
    h('td', { class: 'wrap' }, it.name),
    h('td', {}, it.family),
    h('td', { class: 'num' }, qty(it.qty)),
    h('td', { class: 'num' }, qty(it.reserved)),
    h('td', { class: 'num' }, qty(it.available)),
    h('td', { class: 'num' }, qty(it.ordered)),
    h('td', { class: 'num' }, it.min ? qty(it.min) : '—'),
    h('td', { class: 'num' }, money(it.value)),
    h('td', {}, it.status === 'out' ? h('span', { class: 'pill' }, h('span', { class: 'status-dot critical' }), 'En rupture')
      : it.status === 'low' ? h('span', { class: 'pill' }, h('span', { class: 'status-dot warning' }), 'Sous le minimum') : ''),
  )) : [h('tr', {}, h('td', { colspan: STOCK_COLUMNS.length, class: 'empty' }, 'Aucun article ne correspond.'))]));

  $('stock-count').textContent = rows.length === total
    ? `${nf0.format(total)} articles`
    : `${nf0.format(rows.length)} articles sur ${nf0.format(total)}`;
  if (shown.length < rows.length) $('stock-count').textContent += ` · ${nf0.format(shown.length)} affichés`;
  $('stock-more').hidden = shown.length >= rows.length;
}

function sortBy(key) {
  const numeric = STOCK_COLUMNS.find((c) => c.key === key).num;
  state.sort = state.sort.key === key ? { key, dir: -state.sort.dir } : { key, dir: numeric ? -1 : 1 };
  renderStockTable();
}

function setFilter(filter) {
  state.filter = filter;
  state.limit = 300;
  for (const b of document.querySelectorAll('[data-filter]')) b.setAttribute('aria-pressed', String(b.dataset.filter === filter));
  if (state.stock) renderStock();
}
for (const b of document.querySelectorAll('[data-filter]')) b.addEventListener('click', () => setFilter(b.dataset.filter));

$('search').addEventListener('input', (e) => { state.search = e.target.value; state.limit = 300; renderStockTable(); });
$('stock-more').addEventListener('click', () => { state.limit += 300; renderStockTable(); });
$('depot').addEventListener('change', (e) => { state.depot = Number(e.target.value); loadStock(); });

// ---------- settings ----------

$('settings').addEventListener('click', () => {
  const s = state.info;
  const rows = s.demo
    ? [['Mode', 'Démonstration (données fictives)'], ['Version', s.version]]
    : [['Société', s.company], ['Serveur SQL', s.server], ['Base', s.database],
      ['Identification', s.auth === 'sql' ? `Identifiant SQL (${s.user})` : 'Compte Windows'], ['Devise', s.currency], ['Version', s.version]];
  $('settings-info').replaceChildren(...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v || '—')]));
  $('reconfigure').textContent = s.demo ? 'Connecter à Sage' : 'Reprendre la configuration';
  $('settings-dialog').showModal();
});

$('reconfigure').addEventListener('click', () => {
  $('settings-dialog').close();
  state.canCancelSetup = true;
  showSetup({ ...state.info, error: null });
});

boot();
