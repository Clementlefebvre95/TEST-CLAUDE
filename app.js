// ============================================================
// Mon Livre de Recettes — app locale, sauvegarde dans le navigateur
// ============================================================

const STORE_KEY = 'livre_de_recettes';

const CATEGORIES = [
  { id: 'aperitif', name: 'Apéritif', emoji: '🥂' },
  { id: 'entree',   name: 'Entrée',   emoji: '🥗' },
  { id: 'plat',     name: 'Plat',     emoji: '🍲' },
  { id: 'dessert',  name: 'Dessert',  emoji: '🍰' },
  { id: 'sauce',    name: 'Sauce',    emoji: '🥣' },
  { id: 'boisson',  name: 'Boisson',  emoji: '🍹' },
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

let recipes = loadRecipes();

// ---------- Petits utilitaires ----------
const $ = sel => document.querySelector(sel);

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
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
let currentCategory = null;
let currentRecipeId = null;

function showView(name, title) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + name).classList.add('active');
  $('#page-title').textContent = title;
  window.scrollTo(0, 0);
}

function goHome() {
  currentCategory = null;
  currentRecipeId = null;
  $('#search').value = '';
  $('#search-results').classList.add('hidden');
  $('#summary').classList.remove('hidden');
  renderSummary();
  showView('home', 'Mon Livre de Recettes');
}

function goCategory(catId) {
  currentCategory = catId;
  renderCategory(catId);
  showView('category', catById(catId).name);
}

function goRecipe(id) {
  currentRecipeId = id;
  renderRecipe(id);
  const r = recipes.find(x => x.id === id);
  showView('recipe', r ? r.title : 'Recette');
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

  // Dernières recettes ajoutées
  const block = $('#recent-block');
  if (!recipes.length) {
    block.innerHTML = `
      <div class="empty">
        Ton livre est encore vide.<br />
        Appuie sur <strong>＋</strong> en haut à droite pour écrire ta première recette.
      </div>`;
    return;
  }
  const recent = [...recipes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5);
  block.innerHTML = `<h2 class="section-title">Dernières recettes</h2>
    <div class="recipe-list">${recent.map(rowHtml).join('')}</div>`;
  bindRows(block);
}

// ---------- Ligne de recette ----------
function rowHtml(r) {
  const cat = catById(r.category);
  const meta = [cat.name, r.time, r.servings].filter(Boolean).join(' · ');
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
  showView('edit', r ? 'Modifier la recette' : 'Nouvelle recette');
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
  goRecipe(id || data.id);
});

$('#btn-cancel').addEventListener('click', () => {
  if (currentRecipeId) goRecipe(currentRecipeId);
  else if (currentCategory) goCategory(currentCategory);
  else goHome();
});

function deleteRecipe(id) {
  const r = recipes.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`Supprimer « ${r.title} » ? Cette action est définitive.`)) return;
  recipes = recipes.filter(x => x.id !== id);
  saveRecipes(recipes);
  toast('Recette supprimée');
  if (currentCategory) goCategory(currentCategory);
  else goHome();
}

// ---------- Recherche ----------
$('#search').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  const box = $('#search-results');

  if (!q) {
    box.classList.add('hidden');
    $('#summary').classList.remove('hidden');
    return;
  }

  const found = recipes.filter(r => {
    const haystack = [r.title, catById(r.category).name, ...(r.ingredients || []), r.notes]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  $('#summary').classList.add('hidden');
  box.classList.remove('hidden');
  box.innerHTML = found.length
    ? `<h2 class="section-title">${found.length} résultat${found.length > 1 ? 's' : ''}</h2>
       <div class="recipe-list">${found.map(rowHtml).join('')}</div>`
    : `<div class="empty">Aucune recette ne correspond à « ${escapeHtml(q)} ».</div>`;
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
    } catch {
      toast('Fichier illisible ❌');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ---------- Boutons de la barre ----------
$('#btn-home').addEventListener('click', goHome);
$('#btn-new').addEventListener('click', () => {
  currentRecipeId = null;
  openEditor(null);
});

// ---------- Démarrage ----------
fillCategorySelect();
goHome();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
