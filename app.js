// ============================================================
// Mon Livre de Recettes — app locale, sauvegarde dans le navigateur
// ============================================================

const STORE_KEY = 'livre_de_recettes';
const DELETED_KEY = 'livre_recettes_supprimees';
const SYNC_KEYS = {
  token: 'livre_gh_token',
  gist: 'livre_gist_id',
  last: 'livre_derniere_synchro',
  error: 'livre_synchro_erreur',
};
const GIST_FILE = 'mes-recettes.json';

const CATEGORIES = [
  { id: 'aperitif', name: 'Apéritif', emoji: '🥂' },
  { id: 'entree',   name: 'Entrée',   emoji: '🥒' },
  { id: 'plat',     name: 'Plat',     emoji: '🥩' },
  { id: 'dessert',  name: 'Dessert',  emoji: '🍫' },
  { id: 'sauce',    name: 'Sauce',    emoji: '🥣' },
  { id: 'boisson',  name: 'Boisson',  emoji: '🥤' },
];

const catById = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[2];

// ---------- Stockage ----------
function loadRecipes() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
function saveRecipes(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

// Les suppressions sont mémorisées ({ id: date }) pour qu'une recette effacée
// sur un appareil ne réapparaisse pas depuis un autre lors de la synchro.
function loadDeleted() {
  try {
    const d = JSON.parse(localStorage.getItem(DELETED_KEY));
    return d && typeof d === 'object' ? d : {};
  } catch {
    return {};
  }
}
function saveDeleted(d) {
  localStorage.setItem(DELETED_KEY, JSON.stringify(d));
}

let recipes = loadRecipes();
let deletedAt = loadDeleted();

// ---------- Petits utilitaires ----------
const $ = sel => document.querySelector(sel);

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

// Enlève les accents et la casse : « Pâtes » et « pates » deviennent identiques.
function normalize(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .trim();
}

function toLines(text) {
  return String(text ?? '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- Navigation ----------
// Une pile mémorise les écrans traversés : le bouton « ‹ » en haut à gauche
// ramène à l'écran précédent (une recette renvoie donc vers sa catégorie).
let currentCategory = null;
let currentRecipeId = null;
let screen = { name: 'home' };
let backStack = [];

function showView(name, title) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + name).classList.add('active');
  $('#page-title').textContent = title;
  $('#btn-back').classList.toggle('invisible', backStack.length === 0);
  window.scrollTo(0, 0);
}

function drawScreen(s) {
  if (s.name === 'home') {
    currentCategory = null;
    currentRecipeId = null;
    $('#search').value = '';
    $('#search-results').classList.add('hidden');
    $('#summary').classList.remove('hidden');
    renderSummary();
    return showView('home', 'Mon Livre de Recettes');
  }
  if (s.name === 'category') {
    currentCategory = s.catId;
    currentRecipeId = null;
    renderCategory(s.catId);
    return showView('category', catById(s.catId).name);
  }
  if (s.name === 'recipe') {
    currentRecipeId = s.recipeId;
    renderRecipe(s.recipeId);
    const r = recipes.find(x => x.id === s.recipeId);
    return showView('recipe', r ? r.title : 'Recette');
  }
  if (s.name === 'settings') {
    renderSettingsView();
    return showView('settings', 'Réglages');
  }
  if (s.name === 'edit') {
    return showView('edit', s.title || 'Recette');
  }
}

function goTo(next, { replace = false } = {}) {
  if (!replace) backStack.push(screen);
  screen = next;
  drawScreen(screen);
}

function goBack() {
  screen = backStack.pop() || { name: 'home' };
  drawScreen(screen);
}

function goHome() {
  backStack = [];
  goTo({ name: 'home' }, { replace: true });
}

function goCategory(catId) {
  goTo({ name: 'category', catId });
}

// Après un enregistrement, la fiche remplace l'écran d'édition au lieu de
// s'empiler : le retour ramène alors à la liste, pas au formulaire.
function goRecipe(id, options = {}) {
  const top = backStack[backStack.length - 1];
  if (options.replace && top && top.name === 'recipe' && top.recipeId === id) backStack.pop();
  goTo({ name: 'recipe', recipeId: id }, options);
}

// ---------- Sommaire ----------
function renderSummary() {
  const grid = $('#category-grid');
  grid.innerHTML = CATEGORIES.map(cat => {
    const n = recipes.filter(r => r.category === cat.id).length;
    const label = n === 0 ? 'aucune recette' : n === 1 ? '1 recette' : n + ' recettes';
    return `
      <button class="cat-card" data-cat="${cat.id}">
        <span class="emoji">${cat.emoji}</span>
        <span class="name">${cat.name}</span>
        <span class="count">${label}</span>
      </button>`;
  }).join('');

  grid.querySelectorAll('.cat-card').forEach(btn => {
    btn.addEventListener('click', () => goCategory(btn.dataset.cat));
  });

  $('#summary-empty').innerHTML = recipes.length ? '' : `
    <div class="empty">
      Ton livre est encore vide.<br />
      Appuie sur <strong>＋</strong> en haut à droite pour écrire ta première recette.
    </div>`;
}

// ---------- Ligne de recette ----------
function rowHtml(r, where = '') {
  const cat = catById(r.category);
  const meta = [cat.name, r.time, r.servings, where].filter(Boolean).join(' · ');
  return `
    <button class="recipe-row" data-id="${r.id}">
      <span class="dot">${cat.emoji}</span>
      <span class="info">
        <span class="title">${escapeHtml(r.title)}</span><br />
        <span class="meta">${escapeHtml(meta)}</span>
      </span>
      <span class="chev">›</span>
    </button>`;
}

function bindRows(root) {
  root.querySelectorAll('.recipe-row').forEach(btn => {
    btn.addEventListener('click', () => goRecipe(btn.dataset.id));
  });
}

// ---------- Vue catégorie ----------
function renderCategory(catId) {
  const cat = catById(catId);
  const list = recipes
    .filter(r => r.category === catId)
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'));

  $('#category-header').innerHTML = `
    <div class="cat-header">
      <h2>${cat.emoji} ${cat.name}</h2>
      <p>${list.length} recette${list.length > 1 ? 's' : ''}</p>
    </div>`;

  const container = $('#category-list');
  container.innerHTML = list.length
    ? list.map(rowHtml).join('')
    : `<div class="empty">Aucune recette dans « ${cat.name} » pour le moment.</div>`;
  bindRows(container);
}

// ---------- Vue recette ----------
function renderRecipe(id) {
  const r = recipes.find(x => x.id === id);
  const el = $('#recipe-detail');
  if (!r) {
    el.innerHTML = `<div class="empty">Recette introuvable.</div>`;
    return;
  }
  const cat = catById(r.category);
  const tags = [
    `<span class="tag">${cat.emoji} ${cat.name}</span>`,
    r.time ? `<span class="tag">⏱ ${escapeHtml(r.time)}</span>` : '',
    r.servings ? `<span class="tag">👥 ${escapeHtml(r.servings)}</span>` : '',
  ].filter(Boolean).join('');

  const ingredients = (r.ingredients || []).map(i => `<li>${escapeHtml(i)}</li>`).join('');
  const steps = (r.steps || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');

  el.innerHTML = `
    <h2>${escapeHtml(r.title)}</h2>
    <div class="tags">${tags}</div>

    ${ingredients ? `<h3>Ingrédients</h3><ul>${ingredients}</ul>` : ''}
    ${steps ? `<h3>Préparation</h3><ol>${steps}</ol>` : ''}
    ${r.notes ? `<div class="notes">📝 ${escapeHtml(r.notes)}</div>` : ''}

    <div class="detail-actions">
      <button class="btn" id="btn-edit">✏️ Modifier</button>
      <button class="btn danger" id="btn-delete">🗑 Supprimer</button>
    </div>`;

  $('#btn-edit').addEventListener('click', () => openEditor(r.id));
  $('#btn-delete').addEventListener('click', () => deleteRecipe(r.id));
}

// ---------- Éditeur ----------
function fillCategorySelect() {
  $('#f-category').innerHTML = CATEGORIES
    .map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`)
    .join('');
}

function openEditor(id) {
  const r = id ? recipes.find(x => x.id === id) : null;
  $('#f-id').value = r ? r.id : '';
  $('#f-title').value = r ? r.title : '';
  $('#f-category').value = r ? r.category : (currentCategory || 'plat');
  $('#f-time').value = r ? (r.time || '') : '';
  $('#f-servings').value = r ? (r.servings || '') : '';
  $('#f-ingredients').value = r ? (r.ingredients || []).join('\n') : '';
  $('#f-steps').value = r ? (r.steps || []).join('\n') : '';
  $('#f-notes').value = r ? (r.notes || '') : '';
  goTo({ name: 'edit', title: r ? 'Modifier la recette' : 'Nouvelle recette' });
}

$('#recipe-form').addEventListener('submit', e => {
  e.preventDefault();
  const id = $('#f-id').value;
  const data = {
    title: $('#f-title').value.trim(),
    category: $('#f-category').value,
    time: $('#f-time').value.trim(),
    servings: $('#f-servings').value.trim(),
    ingredients: toLines($('#f-ingredients').value),
    steps: toLines($('#f-steps').value),
    notes: $('#f-notes').value.trim(),
    updatedAt: Date.now(),
  };
  if (!data.title) return;

  if (id) {
    const idx = recipes.findIndex(x => x.id === id);
    recipes[idx] = { ...recipes[idx], ...data };
  } else {
    data.id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    data.createdAt = Date.now();
    recipes.push(data);
  }
  saveRecipes(recipes);
  toast('Recette enregistrée ✅');
  goRecipe(id || data.id, { replace: true });
  scheduleSync();
});

$('#btn-cancel').addEventListener('click', goBack);

function deleteRecipe(id) {
  const r = recipes.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`Supprimer « ${r.title} » ? Cette action est définitive.`)) return;
  recipes = recipes.filter(x => x.id !== id);
  deletedAt[id] = Date.now();
  saveRecipes(recipes);
  saveDeleted(deletedAt);
  toast('Recette supprimée');
  scheduleSync();
  goBack();
}

// ---------- Recherche ----------
// Les résultats sont classés : d'abord les titres qui commencent par la
// recherche, puis les autres titres, puis les ingrédients, la catégorie et les
// notes. À rang égal, ordre alphabétique.
function scoreRecipe(r, q) {
  const title = normalize(r.title);
  if (title.startsWith(q)) return { rank: 0, where: '' };
  if (new RegExp('\\b' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(title)) return { rank: 1, where: '' };
  if (title.includes(q)) return { rank: 2, where: '' };

  const ingredients = (r.ingredients || []).map(normalize);
  if (ingredients.some(i => i.startsWith(q))) return { rank: 3, where: 'dans les ingrédients' };
  if (ingredients.some(i => i.includes(q))) return { rank: 4, where: 'dans les ingrédients' };

  if (normalize(catById(r.category).name).includes(q)) return { rank: 5, where: '' };
  if (normalize(r.notes).includes(q)) return { rank: 6, where: 'dans les notes' };
  return null;
}

$('#search').addEventListener('input', e => {
  const q = normalize(e.target.value);
  const box = $('#search-results');

  if (!q) {
    box.classList.add('hidden');
    $('#summary').classList.remove('hidden');
    return;
  }

  const found = recipes
    .map(r => ({ recipe: r, ...(scoreRecipe(r, q) || {}) }))
    .filter(x => x.rank !== undefined)
    .sort((a, b) => a.rank - b.rank || a.recipe.title.localeCompare(b.recipe.title, 'fr'));

  $('#summary').classList.add('hidden');
  box.classList.remove('hidden');
  box.innerHTML = found.length
    ? `<h2 class="section-title">${found.length} résultat${found.length > 1 ? 's' : ''}</h2>
       <div class="recipe-list">${found.map(x => rowHtml(x.recipe, x.where)).join('')}</div>`
    : `<div class="empty">Aucune recette ne correspond à « ${escapeHtml(e.target.value.trim())} ».</div>`;
  bindRows(box);
});

// ---------- Sauvegarde / restauration ----------
$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(recipes, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `mes-recettes-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Fichier de sauvegarde créé');
});

$('#btn-import').addEventListener('click', () => $('#import-file').click());

$('#import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error('format');
      const existingIds = new Set(recipes.map(r => r.id));
      const added = imported.filter(r => r && r.title && !existingIds.has(r.id));
      recipes = recipes.concat(added);
      saveRecipes(recipes);
      goHome();
      toast(`${added.length} recette(s) restaurée(s)`);
      scheduleSync();
    } catch {
      toast('Fichier illisible ❌');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ---------- Boutons de la barre ----------
$('#btn-back').addEventListener('click', goBack);
$('#btn-new').addEventListener('click', () => {
  currentRecipeId = null;
  openEditor(null);
});

// ============================================================
// Synchronisation avec un gist GitHub privé
// ============================================================

const GH_API = 'https://api.github.com';

const sync = {
  get token() { return localStorage.getItem(SYNC_KEYS.token) || ''; },
  set token(v) { v ? localStorage.setItem(SYNC_KEYS.token, v) : localStorage.removeItem(SYNC_KEYS.token); },
  get gistId() { return localStorage.getItem(SYNC_KEYS.gist) || ''; },
  set gistId(v) { v ? localStorage.setItem(SYNC_KEYS.gist, v) : localStorage.removeItem(SYNC_KEYS.gist); },
  get lastAt() { return Number(localStorage.getItem(SYNC_KEYS.last)) || 0; },
  set lastAt(v) { localStorage.setItem(SYNC_KEYS.last, String(v)); },
  get error() { return localStorage.getItem(SYNC_KEYS.error) || ''; },
  set error(v) { v ? localStorage.setItem(SYNC_KEYS.error, v) : localStorage.removeItem(SYNC_KEYS.error); },
  get enabled() { return Boolean(this.token); },
};

let syncing = false;
let activationError = '';   // message affiché quand une clé vient d'être refusée

function ghFetch(path, options = {}) {
  return fetch(GH_API + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + sync.token,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

function localDoc() {
  return { app: 'livre-de-recettes', version: 1, updatedAt: Date.now(), recipes, deleted: deletedAt };
}

// Fusion : la version la plus récente de chaque recette gagne ; une suppression
// l'emporte si elle est postérieure à la dernière modification.
function mergeDocs(a, b) {
  const deleted = { ...(a.deleted || {}) };
  for (const [id, at] of Object.entries(b.deleted || {})) {
    deleted[id] = Math.max(deleted[id] || 0, at);
  }

  const byId = new Map();
  for (const r of [...(a.recipes || []), ...(b.recipes || [])]) {
    if (!r || !r.id) continue;
    const kept = byId.get(r.id);
    if (!kept || (r.updatedAt || 0) > (kept.updatedAt || 0)) byId.set(r.id, r);
  }

  const merged = [...byId.values()].filter(r => !(deleted[r.id] > (r.updatedAt || 0)));
  return { app: 'livre-de-recettes', version: 1, recipes: merged, deleted };
}

function sameContent(a, b) {
  const norm = doc => JSON.stringify({
    recipes: [...(doc.recipes || [])].sort((x, y) => x.id.localeCompare(y.id)),
    deleted: doc.deleted || {},
  });
  return norm(a) === norm(b);
}

async function readGist() {
  const res = await ghFetch('/gists/' + sync.gistId);
  if (res.status === 404) return null;           // gist supprimé côté GitHub
  if (!res.ok) throw new Error(httpMessage(res.status));
  const data = await res.json();
  const file = data.files && data.files[GIST_FILE];
  if (!file) return { recipes: [], deleted: {} };
  const raw = file.truncated ? await (await fetch(file.raw_url)).text() : file.content;
  try {
    const doc = JSON.parse(raw);
    return { recipes: doc.recipes || [], deleted: doc.deleted || {} };
  } catch {
    throw new Error('le fichier de sauvegarde en ligne est illisible');
  }
}

// Sur un nouvel appareil, le gist existe déjà côté GitHub : on le retrouve
// au lieu d'en créer un second, sinon les deux téléphones s'ignoreraient.
async function findGist() {
  const res = await ghFetch('/gists?per_page=100');
  if (!res.ok) throw new Error(httpMessage(res.status));
  const list = await res.json();
  const found = list.find(g => g.files && g.files[GIST_FILE]);
  return found ? found.id : '';
}

async function writeGist(doc) {
  const body = JSON.stringify({
    description: 'Mon livre de recettes — sauvegarde automatique',
    files: { [GIST_FILE]: { content: JSON.stringify(doc, null, 2) } },
  });
  const res = sync.gistId
    ? await ghFetch('/gists/' + sync.gistId, { method: 'PATCH', body })
    : await ghFetch('/gists', { method: 'POST', body: JSON.stringify({ ...JSON.parse(body), public: false }) });
  if (!res.ok) throw new Error(httpMessage(res.status));
  const data = await res.json();
  if (data.id) sync.gistId = data.id;
}

function httpMessage(status) {
  if (status === 401) return 'clé refusée par GitHub (expirée ou incorrecte)';
  if (status === 403) return 'accès refusé — la clé n\'a peut-être pas la permission « gist »';
  if (status === 404) return 'sauvegarde en ligne introuvable';
  return 'GitHub a répondu ' + status;
}

async function syncNow({ silent = false } = {}) {
  if (!sync.enabled || syncing) return;
  syncing = true;
  renderSettingsView();
  try {
    if (!sync.gistId) sync.gistId = await findGist();

    let remote = sync.gistId ? await readGist() : null;
    if (remote === null && sync.gistId) sync.gistId = '';   // gist supprimé : on le recrée

    const mine = localDoc();
    const merged = remote ? mergeDocs(mine, remote) : { recipes, deleted: deletedAt };

    if (!remote || !sameContent(merged, remote)) await writeGist(merged);

    if (!sameContent(merged, mine)) {
      recipes = merged.recipes;
      deletedAt = merged.deleted;
      saveRecipes(recipes);
      saveDeleted(deletedAt);
      refreshCurrentView();
    }

    sync.lastAt = Date.now();
    sync.error = '';
    if (!silent) toast('Recettes synchronisées ☁️');
  } catch (err) {
    sync.error = err.message || 'synchronisation impossible';
    if (!silent) toast('Synchro impossible : ' + sync.error);
  } finally {
    syncing = false;
    renderSyncBanner();
    renderSettingsView();
  }
}

let syncTimer = null;
function scheduleSync() {
  if (!sync.enabled) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow({ silent: true }), 1200);
}

function refreshCurrentView() {
  if (screen.name === 'recipe' && currentRecipeId) renderRecipe(currentRecipeId);
  else if (screen.name === 'category' && currentCategory) renderCategory(currentCategory);
  else if (screen.name === 'home') renderSummary();
}

// ---------- Affichage de l'état ----------
function formatDelay(ts) {
  if (!ts) return 'jamais';
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

function renderSyncBanner() {
  const banner = $('#sync-banner');
  if (sync.enabled && sync.error) {
    banner.innerHTML = `<span>⚠️ Synchronisation en panne : ${escapeHtml(sync.error)}</span>
      <button type="button" id="banner-fix">Réparer</button>`;
    banner.classList.remove('hidden');
    $('#banner-fix').addEventListener('click', showSettings);
  } else {
    banner.classList.add('hidden');
  }
}

function renderSettingsView() {
  const status = $('#sync-status');
  status.classList.toggle('error', Boolean(sync.error));
  $('#sync-on').classList.toggle('hidden', !sync.enabled);
  $('#sync-off').classList.toggle('hidden', sync.enabled);

  if (!sync.enabled) {
    status.classList.toggle('error', Boolean(activationError));
    status.innerHTML = activationError
      ? `<span class="state">❌ Clé refusée</span><br />
         ${escapeHtml(activationError)}<br />
         Vérifie que la case <strong>gist</strong> était bien cochée en créant la clé.`
      : `<span class="state">Synchronisation désactivée</span><br />
         Tes recettes vivent uniquement dans ce navigateur.`;
    return;
  }
  if (syncing) {
    status.innerHTML = `<span class="state">Synchronisation en cours…</span>`;
    return;
  }
  if (sync.error) {
    status.innerHTML = `<span class="state">⚠️ Synchronisation en panne</span><br />
      ${escapeHtml(sync.error)}<br />
      Dernière réussie : ${formatDelay(sync.lastAt)}.`;
    return;
  }
  status.innerHTML = `<span class="state">✅ Synchronisation active</span><br />
    ${recipes.length} recette${recipes.length > 1 ? 's' : ''} en ligne · dernière synchro ${formatDelay(sync.lastAt)}.`;

  $('#sync-gist-link').innerHTML = sync.gistId
    ? `Tes recettes sont consultables sur
       <a href="https://gist.github.com/${escapeHtml(sync.gistId)}" target="_blank" rel="noopener">gist.github.com</a>.`
    : '';
}

function showSettings() {
  activationError = '';
  goTo({ name: 'settings' });
}

// ---------- Boutons de la vue synchro ----------
$('#btn-settings').addEventListener('click', showSettings);

$('#btn-sync-on').addEventListener('click', async () => {
  const token = $('#f-token').value.trim();
  if (!token) return toast('Colle ta clé GitHub d\'abord');
  sync.token = token;
  sync.error = '';
  activationError = '';
  $('#f-token').value = '';
  await syncNow();
  if (sync.error) {
    activationError = sync.error;
    sync.token = '';     // clé invalide : inutile de la conserver
    sync.error = '';
    $('#f-token').value = token;
    renderSettingsView();
  }
});

$('#btn-sync-now').addEventListener('click', () => syncNow());

$('#btn-sync-off').addEventListener('click', () => {
  if (!confirm('Désactiver la synchronisation ? Tes recettes restent sur cet appareil et en ligne.')) return;
  sync.token = '';
  sync.error = '';
  renderSettingsView();
  renderSyncBanner();
  toast('Synchronisation désactivée');
});

// Resynchroniser en revenant sur l'app (utile sur téléphone).
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleSync();
});

// ---------- Démarrage ----------
fillCategorySelect();
goHome();
renderSettingsView();
renderSyncBanner();
if (sync.enabled) syncNow({ silent: true });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
