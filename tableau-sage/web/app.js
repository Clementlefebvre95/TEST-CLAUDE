'use strict';

const $ = (id) => document.getElementById(id);
const NNBSP = String.fromCharCode(0x202f); // narrow no-break space, before units in French
const ACCENTS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

const state = {
  info: null,
  sales: null,
  stock: null,
  stockAll: null, // all depots, for the supplier sheet when a depot is selected
  purchases: null,
  tab: 'sales',
  filter: 'all',
  search: '',
  sort: { key: 'ref', dir: 1 },
  stockColumns: [],
  limit: 300,
  depot: 0,
  supplierSearch: '',
  supplierLimit: 50,
  ordersAll: false,
  selectedDb: '',
  canCancelSetup: false,
};

const TABS = { sales: 'ventes', stock: 'stocks', purchases: 'fournisseurs' };
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
const money = (v) => nf0.format(Math.round(v || 0)) + NNBSP + currency();
const moneyCompact = (v) => (Math.abs(v) < 1000 ? nf0.format(v) : nfCompact.format(v)) + NNBSP + currency();
const qty = (v) => nf2.format(v || 0);
const fold = (s) => (s || '').normalize('NFD').replace(ACCENTS, '').toLowerCase();
const fmtDate = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR') : '—');
const daysBetween = (from, to) => Math.round((new Date(to + 'T12:00:00') - new Date(from + 'T12:00:00')) / 86400000);
const plural = (n, one, many) => `${nf0.format(n)} ${n > 1 ? many : one}`;

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
    err.user = state.info && !state.info.local
      ? { title: 'Le tableau de bord du bureau ne répond pas', hint: "Vérifiez la connexion du téléphone (Wi-Fi du bureau ou Tailscale) et que le PC du bureau est allumé, avec Tableau Sage ouvert." }
      : { title: "L'application ne répond plus", hint: "La fenêtre noire de Tableau Sage a peut-être été fermée. Relancez l'application." };
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.error && data.error.title) || 'Erreur ' + res.status);
    err.user = (data && data.error) || { title: err.message };
    err.status = res.status;
    // A phone whose session ended (new code on the PC) goes back to the code screen.
    if (res.status === 401 && path !== '/api/login' && state.info && !state.info.local) {
      showLogin({ title: "Saisissez à nouveau le code d'accès", hint: 'Le code a peut-être été changé sur le PC du bureau.' });
    }
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
  for (const s of ['screen-loading', 'screen-login', 'screen-unavailable', 'screen-setup', 'screen-dash']) $(s).hidden = s !== id;
}

function resetData() {
  state.sales = state.stock = state.stockAll = state.purchases = null;
  charts.sales.report = charts.purchases.report = null;
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
  if (!s.local) {
    if (!s.authenticated) showLogin();
    else if (s.status !== 'ready') showScreen('screen-unavailable');
    else openDashboard();
    return;
  }
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

// ---------- phone: access code ----------

function showLogin(ue) {
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  showScreen('screen-login');
  renderError($('login-error'), ue || null);
  $('login-code').value = '';
  $('login-code').focus();
}

$('login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const code = $('login-code').value;
  if (!code.replace(/\D/g, '')) { $('login-code').focus(); return; }
  const btn = $('login-submit');
  busy(btn, true, 'Vérification…');
  try {
    const s = await api('/api/login', { code });
    resetData();
    applyState(s);
  } catch (e) {
    renderError($('login-error'), e.user);
    $('login-code').select();
  } finally {
    busy(btn, false);
  }
});

$('retry').addEventListener('click', boot);

$('logout').addEventListener('click', async () => {
  try { await api('/api/logout', {}); } catch (e) { /* signed out locally anyway */ }
  resetData();
  showLogin();
});

$('home-hint-close').addEventListener('click', () => {
  try { localStorage.setItem('homeHintDismissed', '1'); } catch (e) { /* private mode */ }
  $('home-hint').hidden = true;
});

function showHomeHint() {
  let dismissed = false;
  try { dismissed = localStorage.getItem('homeHintDismissed') === '1'; } catch (e) { /* private mode */ }
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  $('home-hint').hidden = state.info.local || dismissed || standalone;
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
    renderCompanies(await api('/api/databases', req));
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
  $('other-dbs-list').replaceChildren(...list.others.map((db) => companyChoice(db, db)));
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
    resetData();
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
    resetData();
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
  $('phone-btn').hidden = !s.local;
  $('settings').hidden = !s.local;
  $('logout').hidden = s.local;
  showHomeHint();
  const fromHash = Object.keys(TABS).find((k) => '#' + TABS[k] === location.hash);
  selectTab(fromHash || state.tab);
}

function selectTab(tab) {
  state.tab = tab;
  for (const t of Object.keys(TABS)) {
    $('tab-' + t).setAttribute('aria-selected', String(t === tab));
    $('view-' + t).hidden = t !== tab;
  }
  try { history.replaceState(null, '', '#' + TABS[tab]); } catch (e) { /* not essential */ }
  if (tab === 'sales') { if (state.sales) renderMonthChart('sales'); else loadSales(); }
  if (tab === 'stock' && !state.stock) loadStock();
  if (tab === 'purchases') { if (state.purchases) renderMonthChart('purchases'); else loadPurchases(); }
}
for (const t of Object.keys(TABS)) $('tab-' + t).addEventListener('click', () => selectTab(t));

let pending = 0;
async function load(fn) {
  pending++;
  document.querySelector('main').classList.add('loading');
  try {
    await fn();
    renderError($('dash-error'), null);
    $('updated').textContent = 'Mis à jour à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    if (e.status !== 401) renderError($('dash-error'), e.user);
  } finally {
    if (--pending === 0) document.querySelector('main').classList.remove('loading');
  }
}

const loadSales = () => load(async () => { state.sales = await api('/api/sales'); renderSales(); });
const loadStock = () => load(async () => { state.stock = await api('/api/stock?depot=' + state.depot); renderStock(); });
const loadPurchases = () => load(async () => { state.purchases = await api('/api/purchases'); renderPurchases(); });

function refreshAll() {
  state.stockAll = null;
  if (state.sales || state.tab === 'sales') loadSales();
  if (state.stock || state.tab === 'stock') loadStock();
  if (state.purchases || state.tab === 'purchases') loadPurchases();
}
$('refresh').addEventListener('click', refreshAll);
setInterval(() => {
  if (document.visibilityState === 'visible' && !$('screen-dash').hidden) refreshAll();
}, 10 * 60 * 1000);

// deltaLine compares with the same period last year. Sales going up is good
// news (green); for purchases the direction is neither good nor bad (ink).
function deltaLine(cur, prev, label, { neutral = false, none = 'Rien à comparer' } = {}) {
  if (!(prev > 0)) return h('div', { class: 'delta' }, `${none} ${label}`);
  const change = (cur - prev) / prev * 100;
  const up = change >= 0;
  return h('div', { class: 'delta' },
    h('span', { class: neutral ? 'flat' : up ? 'up' : 'down' }, (up ? '▲ ' : '▼ ') + nfPct.format(change) + ' %'),
    ` ${label} (${money(prev)})`);
}

function flowTiles(r, nouns) {
  const k = r.kpi;
  const today = new Date(r.today + 'T12:00:00');
  const month = MONTHS[today.getMonth()];
  const ly = r.year - 1;
  return [
    h('div', { class: 'tile hero' },
      h('div', { class: 'label' }, `${nouns.since} ${r.year}`),
      h('div', { class: 'value' }, money(k.year)),
      deltaLine(k.year, k.yearLastYear, `par rapport à la même période en ${ly}`, nouns),
      h('div', { class: 'delta' }, `Année ${ly} complète : ${money(k.lastYearTotal)}`)),
    h('div', { class: 'tile' },
      h('div', { class: 'label' }, `${nouns.month} (${month})`),
      h('div', { class: 'value' }, money(k.month)),
      deltaLine(k.month, k.monthLastYear, `vs ${month} ${ly} à la même date`, nouns)),
  ];
}

// Columns marked hideNarrow are left out on phones; the sheet has the detail.
const cellClass = (c, head) => [
  c.num ? 'num' : head ? '' : c.wrap ? 'wrap' : c.rank ? 'rank' : '',
  c.hideNarrow ? 'hide-narrow' : '',
].join(' ').trim();

function rankedTable(rows, cols) {
  return h('div', { class: 'table-scroll' }, h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, cols.map((c) => h('th', { class: cellClass(c, true) }, c.label)))),
    h('tbody', {}, rows.map((row, i) => h('tr', row.onclick ? { class: 'clickable', onclick: row.onclick } : {},
      cols.map((c) => h('td', { class: cellClass(c, false) }, c.cell(row, i))))))));
}

function shareCell(v, total) {
  const share = total > 0 ? v / total : 0;
  return h('div', { class: 'share' },
    h('span', { class: 'bar' }, h('i', { style: `width:${Math.max(2, Math.min(100, share * 100))}%` })),
    nf0.format(share * 100) + ' %');
}

const nameCell = (name, code, onclick) => [
  onclick ? h('button', { type: 'button', class: 'link-cell', onclick: (e) => { e.stopPropagation(); onclick(); } }, name) : name,
  h('div', { class: 'muted small' }, code),
];

// ---------- sales ----------

function renderSales() {
  const r = state.sales;
  const k = r.kpi;
  const today = new Date(r.today + 'T12:00:00');
  $('sales-tiles').replaceChildren(
    ...flowTiles(r, { since: 'Depuis le 1er janvier', month: 'Ce mois-ci', none: 'Pas de ventes à comparer' }),
    h('div', { class: 'tile' },
      h('div', { class: 'label' }, "Aujourd'hui"),
      h('div', { class: 'value' }, money(k.today)),
      h('div', { class: 'delta' }, today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))),
  );
  charts.sales.report = r;
  renderLegend('sales');
  renderMonthChart('sales');
  renderMonthTable('sales');

  $('top-clients').replaceChildren(r.topTiers.length ? rankedTable(r.topTiers, [
    { label: '#', rank: true, cell: (_, i) => i + 1 },
    { label: 'Client', wrap: true, cell: (c) => nameCell(c.name, c.code) },
    { label: 'CA HT', num: true, cell: (c) => money(c.ht) },
    { label: 'Part du CA', num: true, hideNarrow: true, cell: (c) => shareCell(c.ht, k.year) },
  ]) : h('p', { class: 'empty' }, 'Aucune vente depuis le 1er janvier.'));

  $('top-articles').replaceChildren(r.topArticles.length ? rankedTable(r.topArticles, [
    { label: '#', rank: true, cell: (_, i) => i + 1 },
    { label: 'Article', wrap: true, cell: (a) => nameCell(a.name, a.code) },
    { label: 'Quantité', num: true, cell: (a) => qty(a.qty) },
    { label: 'CA HT', num: true, cell: (a) => money(a.ht) },
  ]) : h('p', { class: 'empty' }, 'Aucune vente depuis le 1er janvier.'));
}

// ---------- month charts (sales and purchases) ----------

const charts = {
  sales: { report: null, mode: 'chart', title: "Chiffre d'affaires HT par mois" },
  purchases: { report: null, mode: 'chart', title: 'Achats HT par mois' },
};

function renderLegend(key) {
  const r = charts[key].report;
  $(key + '-legend').replaceChildren(
    h('span', {}, h('i', { style: 'background:var(--series-n1)' }), String(r.year - 1)),
    h('span', {}, h('i', { style: 'background:var(--series-n)' }), String(r.year)));
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

function renderMonthChart(key) {
  const box = $(key + '-chart');
  const r = charts[key].report;
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

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': `${charts[key].title}, ${r.year - 1} et ${r.year}. Détail dans la vue Tableau.` });
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
    bars.append(svg('path', { class: 'bar-n1', d: barPath(cx - bw - 1, base, y(prev[i]), bw) }));
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

function renderMonthTable(key) {
  const r = charts[key].report;
  const ly = r.year - 1;
  $(key + '-chart-table').replaceChildren(h('div', { class: 'table-scroll' }, h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Mois'), h('th', { class: 'num' }, String(ly)), h('th', { class: 'num' }, String(r.year)), h('th', { class: 'num' }, 'Évolution'))),
    h('tbody', {}, MONTHS.map((name, i) => {
      const c = r.current[i];
      const p = r.previous[i];
      const evo = c === null || !(p > 0) ? '—' : nfPct.format((c - p) / p * 100) + ' %';
      return h('tr', {}, h('td', {}, name), h('td', { class: 'num' }, money(p)), h('td', { class: 'num' }, c === null ? '—' : money(c)), h('td', { class: 'num' }, evo));
    })))));
}

function setChartMode(key, mode) {
  charts[key].mode = mode;
  for (const b of document.querySelectorAll(`[data-chart="${key}"]`)) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  $(key + '-chart').hidden = mode !== 'chart';
  $(key + '-chart-table').hidden = mode !== 'table';
  if (mode === 'chart') renderMonthChart(key);
}
for (const b of document.querySelectorAll('[data-chart]')) b.addEventListener('click', () => setChartMode(b.dataset.chart, b.dataset.mode));

const resize = new ResizeObserver((entries) => { for (const e of entries) renderMonthChart(e.target.dataset.key); });
resize.observe($('sales-chart'));
resize.observe($('purchases-chart'));

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

const itemStatus = (it) => (it.qty <= 0 ? 'out' : it.min > 0 && it.qty < it.min ? 'low' : 'ok');

function statusPill(status) {
  if (status === 'out') return h('span', { class: 'pill' }, h('span', { class: 'status-dot critical' }), 'En rupture');
  if (status === 'low') return h('span', { class: 'pill' }, h('span', { class: 'status-dot warning' }), 'Sous le minimum');
  return '';
}

function stockColumns(items) {
  const cols = [
    { key: 'ref', label: 'Référence', hideNarrow: true, cell: (it) => it.ref },
    // On phones the reference and the state go under the name.
    {
      key: 'name', label: 'Désignation', wrap: true,
      cell: (it) => [it.name, h('div', { class: 'muted small show-narrow' }, it.ref),
        it.status !== 'ok' ? h('div', { class: 'show-narrow' }, statusPill(it.status)) : null],
    },
    { key: 'family', label: 'Famille', hideNarrow: true, cell: (it) => it.family },
  ];
  if (items.some((it) => it.supplierName)) {
    cols.push({
      key: 'supplierName', label: 'Fournisseur', hideNarrow: true,
      cell: (it) => (it.supplier ? h('button', { type: 'button', class: 'link-cell', onclick: () => openSupplier(it.supplier, it.supplierName) }, it.supplierName) : '—'),
    });
  }
  cols.push(
    { key: 'qty', label: 'En stock', num: true, cell: (it) => qty(it.qty) },
    { key: 'reserved', label: 'Réservé', num: true, hideNarrow: true, cell: (it) => qty(it.reserved) },
    { key: 'available', label: 'Disponible', num: true, hideNarrow: true, cell: (it) => qty(it.available) },
    { key: 'ordered', label: 'Commandé', num: true, cell: (it) => qty(it.ordered) },
    { key: 'min', label: 'Minimum', num: true, hideNarrow: true, cell: (it) => (it.min ? qty(it.min) : '—') },
    { key: 'value', label: 'Valeur', num: true, hideNarrow: true, cell: (it) => money(it.value) },
    { key: 'status', label: 'État', hideNarrow: true, cell: (it) => statusPill(it.status) },
  );
  return cols;
}

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
  h('div', { class: 'delta' }, value ? 'Toucher pour voir la liste' : 'Aucun article'));

  $('stock-tiles').replaceChildren(
    h('div', { class: 'tile' }, h('div', { class: 'label' }, 'Valeur du stock'), h('div', { class: 'value' }, money(t.value)), h('div', { class: 'delta' }, 'Valorisation Sage')),
    h('div', { class: 'tile' }, h('div', { class: 'label' }, 'Articles suivis en stock'), h('div', { class: 'value' }, nf0.format(t.articles)), h('div', { class: 'delta' }, 'Articles actifs')),
    filterTile('out', 'En rupture', t.out, 'critical'),
    filterTile('low', 'Sous le minimum', t.low, 'warning'),
  );
  state.stockColumns = stockColumns(r.items);
  renderStockTable();
}

function renderStockTable() {
  const r = state.stock;
  if (!r) return;
  const cols = state.stockColumns;
  const q = fold(state.search.trim());
  let rows = r.items.map((it) => ({ ...it, available: it.qty - it.reserved, status: itemStatus(it) }));
  const total = rows.length;
  if (state.filter !== 'all') rows = rows.filter((it) => it.status === state.filter);
  if (q) rows = rows.filter((it) => fold([it.ref, it.name, it.family, it.supplierName].join(' ')).includes(q));

  const { key, dir } = state.sort;
  const order = { out: 0, low: 1, ok: 2 };
  rows.sort((a, b) => {
    const va = key === 'status' ? order[a.status] : a[key];
    const vb = key === 'status' ? order[b.status] : b[key];
    const c = typeof va === 'number' ? va - vb : String(va || '').localeCompare(String(vb || ''), 'fr', { numeric: true });
    return c * dir || a.ref.localeCompare(b.ref, 'fr', { numeric: true });
  });

  document.querySelector('#stock-table thead tr').replaceChildren(...cols.map((c) => {
    const th = h('th', { class: cellClass(c, true) }, h('button', { type: 'button', onclick: () => sortBy(c.key) }, c.label));
    if (key === c.key) th.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending');
    return th;
  }));

  const shown = rows.slice(0, state.limit);
  document.querySelector('#stock-table tbody').replaceChildren(...(shown.length
    ? shown.map((it) => h('tr', {}, cols.map((c) => h('td', { class: cellClass(c, false) }, c.cell(it)))))
    : [h('tr', {}, h('td', { colspan: cols.length, class: 'empty' }, 'Aucun article ne correspond.'))]));

  $('stock-count').textContent = rows.length === total
    ? plural(total, 'article', 'articles')
    : `${nf0.format(rows.length)} articles sur ${nf0.format(total)}`;
  if (shown.length < rows.length) $('stock-count').textContent += ` · ${nf0.format(shown.length)} affichés`;
  $('stock-more').hidden = shown.length >= rows.length;
}

function sortBy(key) {
  const numeric = state.stockColumns.find((c) => c.key === key).num;
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

// ---------- suppliers ----------

function ordersBySupplier() {
  const by = {};
  for (const o of state.purchases.orders) {
    const x = by[o.supplier] || (by[o.supplier] = { ht: 0, n: 0, late: 0 });
    x.ht += o.ht;
    x.n++;
    if (o.late) x.late++;
  }
  return by;
}

function lateLabel(o, today) {
  return h('span', { class: 'pill' }, h('span', { class: 'status-dot critical' }), `En retard de ${plural(daysBetween(o.delivery, today), 'jour', 'jours')}`);
}

function ordersTable(orders, { withSupplier }) {
  const p = state.purchases;
  const today = p.flow.today;
  const cols = [withSupplier
    ? { label: 'Fournisseur', wrap: true, cell: (o) => nameCell(o.name, `${o.piece} · du ${fmtDate(o.date)}`, () => openSupplier(o.supplier, o.name)) }
    : { label: 'Commande', cell: (o) => [o.piece, h('div', { class: 'muted small' }, 'du ' + fmtDate(o.date))] }];
  if (p.features.deliveryDates) {
    cols.push({
      label: 'Livraison prévue',
      cell: (o) => [fmtDate(o.delivery), h('div', { class: 'small' },
        o.late ? lateLabel(o, today) : h('span', { class: 'muted' }, o.delivery ? 'À venir' : 'Pas de date prévue'))],
    });
  }
  cols.push({ label: 'Montant HT', num: true, cell: (o) => money(o.ht) });
  return rankedTable(orders, cols);
}

function renderOrders() {
  const p = state.purchases;
  const box = $('orders');
  if (!p.orders.length) {
    box.replaceChildren(h('p', { class: 'empty' }, 'Aucune commande fournisseur en attente.'));
    return;
  }
  const shown = state.ordersAll ? p.orders : p.orders.slice(0, 8);
  box.replaceChildren(ordersTable(shown, { withSupplier: true }));
  if (p.orders.length > 8) {
    box.append(h('div', { class: 'more-row' }, h('button', {
      type: 'button', class: 'btn secondary',
      onclick: () => { state.ordersAll = !state.ordersAll; renderOrders(); },
    }, state.ordersAll ? 'Réduire la liste' : `Voir les ${p.orders.length} commandes`)));
  }
}

function renderPurchases() {
  const p = state.purchases;
  const r = p.flow;
  const lateText = p.ordersLate ? [', dont ', h('span', { class: 'status-dot critical' }), `${p.ordersLate} en retard`] : '';
  $('purchase-tiles').replaceChildren(
    ...flowTiles(r, { since: 'Achats depuis le 1er janvier', month: 'Achats ce mois-ci', neutral: true, none: "Pas d'achats à comparer" }),
    h('button', {
      type: 'button', class: 'tile', style: 'text-align:left;font:inherit;color:inherit;cursor:pointer',
      onclick: () => $('orders-card').scrollIntoView({ behavior: 'smooth', block: 'start' }),
    },
    h('div', { class: 'label' }, 'Commandes fournisseurs en cours'),
    h('div', { class: 'value' }, money(p.ordersTotal)),
    h('div', { class: 'delta' }, plural(p.orders.length, 'commande', 'commandes'), lateText)),
  );
  charts.purchases.report = r;
  renderLegend('purchases');
  renderMonthChart('purchases');
  renderMonthTable('purchases');

  $('top-suppliers').replaceChildren(r.topTiers.length ? rankedTable(r.topTiers.map((t) => ({ ...t, onclick: () => openSupplier(t.code, t.name) })), [
    { label: '#', rank: true, cell: (_, i) => i + 1 },
    { label: 'Fournisseur', wrap: true, cell: (t) => nameCell(t.name, t.code, t.onclick) },
    { label: 'Achats HT', num: true, cell: (t) => money(t.ht) },
    { label: 'Part des achats', num: true, hideNarrow: true, cell: (t) => shareCell(t.ht, r.kpi.year) },
  ]) : h('p', { class: 'empty' }, 'Aucun achat depuis le 1er janvier.'));

  renderOrders();
  renderSuppliers();
}

function renderSuppliers() {
  const p = state.purchases;
  const year = p.flow.year;
  const open = ordersBySupplier();
  const q = fold(state.supplierSearch.trim());
  let rows = p.suppliers;
  if (q) rows = rows.filter((s) => fold([s.name, s.code, s.city, s.contact].join(' ')).includes(q));
  const shown = rows.slice(0, state.supplierLimit).map((s) => ({ ...s, onclick: () => openSupplier(s.code, s.name) }));

  const cols = [{ label: 'Fournisseur', wrap: true, cell: (s) => nameCell(s.name, s.code, s.onclick) }];
  if (p.features.contacts) {
    cols.push({ label: 'Ville', hideNarrow: true, cell: (s) => s.city || '—' });
    cols.push({ label: 'Téléphone', hideNarrow: true, cell: (s) => (s.phone ? h('a', { href: telHref(s.phone), onclick: (e) => e.stopPropagation() }, s.phone) : '—') });
  }
  cols.push(
    { label: `Achats ${year}`, num: true, cell: (s) => money(s.year) },
    { label: `Même période ${year - 1}`, num: true, hideNarrow: true, cell: (s) => money(s.yearLastYear) },
    { label: 'Commandes en cours', num: true, cell: (s) => (open[s.code] ? money(open[s.code].ht) : '—') },
    { label: 'Dernier achat', hideNarrow: true, cell: (s) => fmtDate(s.lastPurchase) },
  );
  $('suppliers').replaceChildren(shown.length ? rankedTable(shown, cols) : h('p', { class: 'empty' }, q ? 'Aucun fournisseur ne correspond.' : 'Aucun fournisseur.'));
  $('suppliers-count').textContent = rows.length === p.suppliers.length
    ? plural(rows.length, 'fournisseur', 'fournisseurs')
    : `${nf0.format(rows.length)} fournisseurs sur ${nf0.format(p.suppliers.length)}`;
  $('suppliers-more').hidden = shown.length >= rows.length;
}

$('supplier-search').addEventListener('input', (e) => { state.supplierSearch = e.target.value; state.supplierLimit = 50; renderSuppliers(); });
$('suppliers-more').addEventListener('click', () => { state.supplierLimit += 50; renderSuppliers(); });

const telHref = (phone) => 'tel:' + phone.replace(/[^\d+]/g, '');

async function stockAllDepots() {
  if (state.stock && state.stock.depot === 0) return state.stock;
  if (!state.stockAll) state.stockAll = await api('/api/stock?depot=0');
  return state.stockAll;
}

// openSupplier shows a supplier's sheet: contact, purchases, open orders,
// what was bought, and its articles that are out of stock or below minimum.
async function openSupplier(code, fallbackName) {
  if (!state.purchases) await loadPurchases();
  const p = state.purchases;
  if (!p) return;
  const sp = p.suppliers.find((s) => s.code === code) || { code, name: fallbackName || code, year: 0, yearLastYear: 0, lastYear: 0 };
  const ly = p.flow.year - 1;
  const orders = p.orders.filter((o) => o.supplier === code);
  const open = ordersBySupplier()[code] || { ht: 0, n: 0, late: 0 };

  const contact = [];
  if (sp.contact) contact.push(h('span', {}, 'Contact : ', h('strong', {}, sp.contact)));
  if (sp.phone) contact.push(h('span', {}, 'Tél. ', h('a', { href: telHref(sp.phone) }, sp.phone)));
  if (sp.email) contact.push(h('span', {}, h('a', { href: 'mailto:' + sp.email }, sp.email)));

  const articles = h('div', {}, h('p', { class: 'muted small' }, 'Chargement…'));
  const reorder = h('div', {}, h('p', { class: 'muted small' }, 'Chargement…'));
  $('supplier-body').replaceChildren(
    h('header', { class: 'sheet-head' }, h('div', {},
      h('h2', {}, sp.name),
      h('p', { class: 'muted' }, [sp.code, sp.city].filter(Boolean).join(' · ')))),
    contact.length ? h('div', { class: 'contact' }, contact)
      : p.features.contacts ? h('p', { class: 'muted small' }, 'Coordonnées non renseignées dans Sage.') : null,
    h('div', { class: 'tiles small' },
      h('div', { class: 'tile' }, h('div', { class: 'label' }, 'Achats depuis le 1er janvier'), h('div', { class: 'value' }, money(sp.year)),
        deltaLine(sp.year, sp.yearLastYear, `vs même période ${ly}`, { neutral: true, none: "Pas d'achats à comparer" })),
      h('div', { class: 'tile' }, h('div', { class: 'label' }, `Achats ${ly}`), h('div', { class: 'value' }, money(sp.lastYear)),
        h('div', { class: 'delta' }, sp.lastPurchase ? 'Dernier achat le ' + fmtDate(sp.lastPurchase) : 'Aucun achat récent')),
      h('div', { class: 'tile' }, h('div', { class: 'label' }, 'Commandes en cours'), h('div', { class: 'value' }, money(open.ht)),
        h('div', { class: 'delta' }, plural(open.n, 'commande', 'commandes'), open.late ? [', dont ', h('span', { class: 'status-dot critical' }), `${open.late} en retard`] : ''))),
    h('section', {}, h('h3', {}, 'Commandes en cours'),
      orders.length ? ordersTable(orders, { withSupplier: false }) : h('p', { class: 'muted small' }, 'Aucune commande en attente chez ce fournisseur.')),
    h('section', {}, h('h3', {}, 'Articles achetés depuis le 1er janvier'), articles),
    p.features.articleSuppliers ? h('section', {}, h('h3', {}, 'Ses articles à réapprovisionner'), reorder) : null,
  );
  const dialog = $('supplier-dialog');
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;

  try {
    const { articles: list } = await api('/api/supplier-articles?code=' + encodeURIComponent(code));
    articles.replaceChildren(list.length ? rankedTable(list, [
      { label: 'Article', wrap: true, cell: (a) => nameCell(a.name, a.code) },
      { label: 'Quantité', num: true, cell: (a) => qty(a.qty) },
      { label: 'Montant HT', num: true, cell: (a) => money(a.ht) },
    ]) : h('p', { class: 'muted small' }, 'Aucun article acheté à ce fournisseur depuis le 1er janvier.'));
  } catch (e) {
    articles.replaceChildren(h('p', { class: 'muted small' }, e.user ? e.user.title : 'Erreur'));
  }
  if (!p.features.articleSuppliers) return;
  try {
    const stock = await stockAllDepots();
    const items = stock.items.filter((it) => it.supplier === code).map((it) => ({ ...it, status: itemStatus(it) })).filter((it) => it.status !== 'ok');
    items.sort((a, b) => (a.status === b.status ? a.ref.localeCompare(b.ref, 'fr', { numeric: true }) : a.status === 'out' ? -1 : 1));
    reorder.replaceChildren(items.length ? rankedTable(items, [
      { label: 'Article', wrap: true, cell: (it) => nameCell(it.name, it.ref) },
      { label: 'En stock', num: true, cell: (it) => qty(it.qty) },
      { label: 'Minimum', num: true, hideNarrow: true, cell: (it) => (it.min ? qty(it.min) : '—') },
      { label: 'Déjà commandé', num: true, cell: (it) => qty(it.ordered) },
      { label: 'État', cell: (it) => statusPill(it.status) },
    ]) : h('p', { class: 'muted small' }, "Aucun de ses articles n'est en rupture ou sous le minimum (d'après le fournisseur principal de chaque article)."));
  } catch (e) {
    reorder.replaceChildren(h('p', { class: 'muted small' }, e.user ? e.user.title : 'Erreur'));
  }
}

// ---------- settings (this PC only) ----------

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

// ---------- phone access (this PC only) ----------

$('phone-btn').addEventListener('click', async () => {
  $('phone-body').replaceChildren(h('p', { class: 'muted' }, 'Chargement…'));
  $('phone-dialog').showModal();
  try {
    renderPhone(await api('/api/phone'));
  } catch (e) {
    const box = h('div', { class: 'alert' });
    renderError(box, e.user);
    $('phone-body').replaceChildren(box);
  }
});

async function updatePhone(change, control) {
  if (control) control.disabled = true;
  try {
    renderPhone(await api('/api/phone', change));
  } catch (e) {
    const box = h('div', { class: 'alert', role: 'alert' });
    renderError(box, e.user);
    $('phone-body').prepend(box);
    if (control) control.disabled = false;
  }
}

function copyButton(text) {
  const btn = h('button', { type: 'button', class: 'btn secondary' }, 'Copier');
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copié'; } catch (e) { btn.textContent = "Sélectionnez l'adresse"; }
  });
  return btn;
}

function renderPhone(s) {
  const body = $('phone-body');
  if (!s.available) {
    body.replaceChildren(h('p', {}, "Connectez d'abord le tableau de bord à Sage (Paramètres › Reprendre la configuration). L'accès téléphone s'active ensuite ici."));
    return;
  }
  const enabled = h('input', { type: 'checkbox' });
  enabled.checked = s.enabled;
  enabled.addEventListener('change', () => updatePhone({ enabled: enabled.checked }, enabled));
  const parts = [
    h('label', { class: 'check' }, enabled, h('span', {},
      h('strong', {}, "Autoriser l'accès depuis un téléphone"),
      h('small', {}, 'Les chiffres deviennent consultables avec un code, depuis le Wi-Fi du bureau ou, de partout, avec Tailscale. Rien ne peut être modifié depuis un téléphone.'))),
  ];
  if (!s.enabled) {
    body.replaceChildren(...parts);
    return;
  }

  const newCode = h('button', { type: 'button', class: 'btn secondary' }, 'Changer le code');
  newCode.addEventListener('click', () => {
    if (confirm('Changer le code ? Les téléphones déjà connectés devront saisir le nouveau code.')) updatePhone({ newCode: true }, newCode);
  });
  parts.push(h('div', { class: 'panel' },
    h('h3', {}, "Code d'accès"),
    h('div', { class: 'phone-code' }, s.code.slice(0, 4) + ' ' + s.code.slice(4)),
    h('p', { class: 'help' }, "À saisir une seule fois sur chaque téléphone. Ne le communiquez qu'aux personnes autorisées."),
    newCode));

  const lan = s.addresses.filter((a) => a.kind === 'lan');
  const ts = s.addresses.filter((a) => a.kind === 'tailscale');
  const addr = (a, title) => h('div', { class: 'addr' }, h('div', {}, h('small', {}, title), h('code', {}, a.url)), copyButton(a.url));
  parts.push(h('div', { class: 'panel' },
    h('h3', {}, 'Adresse à ouvrir sur le téléphone'),
    lan.map((a) => addr(a, 'Au bureau, connecté au même Wi-Fi')),
    ts.map((a) => addr(a, 'De partout, avec Tailscale')),
    !s.addresses.length ? h('p', { class: 'help' }, 'Aucune adresse réseau trouvée : ce PC est-il bien connecté au réseau ?') : null,
    !ts.length ? h('p', { class: 'help' }, "Pour y accéder hors du bureau, installez Tailscale sur ce PC et sur le téléphone, avec le même compte : une adresse « De partout » apparaîtra ici (voir le mode d'emploi).") : null,
    h('p', { class: 'help' }, "La première fois, Windows peut demander l'autorisation du pare-feu : cochez « Réseaux privés » et « Réseaux publics », puis cliquez sur « Autoriser l'accès »."),
    s.problems && s.problems.length ? h('div', { class: 'alert' }, h('strong', {}, "Certaines adresses n'ont pas pu être ouvertes"), h('pre', {}, s.problems.join('\n'))) : null));

  const pc = [];
  if (s.autostart.supported) {
    const box = h('input', { type: 'checkbox' });
    box.checked = s.autostart.enabled;
    box.addEventListener('change', () => updatePhone({ autostart: box.checked }, box));
    pc.push(h('label', { class: 'check' }, box, h('span', {},
      h('strong', {}, 'Démarrer le tableau de bord avec Windows'),
      h('small', {}, `Il se lance tout seul, réduit dans la barre des tâches, à l'ouverture de la session. Ne déplacez plus le fichier : ${s.program}`))));
  }
  if (s.keepAwake.supported) {
    const box = h('input', { type: 'checkbox' });
    box.checked = s.keepAwake.enabled;
    box.addEventListener('change', () => updatePhone({ keepAwake: box.checked }, box));
    pc.push(h('label', { class: 'check' }, box, h('span', {},
      h('strong', {}, 'Empêcher la mise en veille de ce PC'),
      h('small', {}, "Tant que le tableau de bord est ouvert. L'écran peut s'éteindre, le PC reste joignable."))));
  }
  if (pc.length) parts.push(h('div', { class: 'panel' }, h('h3', {}, 'Pour que le téléphone trouve toujours le PC'), pc));
  body.replaceChildren(...parts);
}

boot();
