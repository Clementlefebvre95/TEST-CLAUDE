// ============================================================
// Mes Recettes IA - vanilla JS app, localStorage backed
// ============================================================

const STORE_KEYS = {
  apiKey: 'recipe_api_key',
  model: 'recipe_model',
  provider: 'recipe_provider',
  recipes: 'recipe_library',
  habits: 'recipe_habits', // { cuisines: {name: count}, ingredients: {name: count} }
};

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_PROVIDER = 'gemini';

// ---------- Storage helpers ----------
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
};

function getHabits() {
  return store.get(STORE_KEYS.habits, { cuisines: {}, ingredients: {} });
}
function bumpHabit(category, name) {
  if (!name) return;
  const habits = getHabits();
  const key = name.toLowerCase().trim();
  if (!key) return;
  habits[category][key] = (habits[category][key] || 0) + 1;
  store.set(STORE_KEYS.habits, habits);
}
function topHabits(category, n = 5) {
  const h = getHabits()[category] || {};
  return Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, n);
}

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'library') renderLibrary();
    if (btn.dataset.tab === 'shopping') renderShoppingPicker();
    if (btn.dataset.tab === 'settings') renderHabits();
    if (btn.dataset.tab === 'generate') renderHabitHint();
  });
});

// ---------- Cuisine chips ----------
let selectedCuisine = '';
document.querySelectorAll('#cuisine-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#cuisine-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedCuisine = chip.dataset.cuisine;
    document.getElementById('cuisine-other').value = '';
  });
});
document.getElementById('cuisine-other').addEventListener('input', e => {
  if (e.target.value.trim()) {
    document.querySelectorAll('#cuisine-chips .chip').forEach(c => c.classList.remove('active'));
    selectedCuisine = e.target.value.trim();
  }
});

// ---------- Habit hint + suggestions ----------
function renderHabitHint() {
  const cuisines = topHabits('cuisines', 3);
  const ingredients = topHabits('ingredients', 8);
  const hint = document.getElementById('habit-hint');
  if (cuisines.length) {
    hint.innerHTML = `🧠 Tu cuisines souvent : <strong>${cuisines.map(([c]) => c).join(', ')}</strong>`;
  } else {
    hint.textContent = '';
  }
  const sugg = document.getElementById('ingredient-suggestions');
  sugg.innerHTML = '';
  ingredients.forEach(([name]) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = '+ ' + name;
    b.type = 'button';
    b.addEventListener('click', () => {
      const input = document.getElementById('ingredients');
      const cur = input.value.trim();
      input.value = cur ? cur + ', ' + name : name;
    });
    sugg.appendChild(b);
  });
}

// ---------- AI API call (Gemini or Claude) ----------
const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];

async function callAI(prompt, maxTokens = 2048) {
  const apiKey = store.get(STORE_KEYS.apiKey, '');
  const model = store.get(STORE_KEYS.model, DEFAULT_MODEL);
  const provider = store.get(STORE_KEYS.provider, DEFAULT_PROVIDER);
  if (!apiKey) throw new Error('Configure ta clé API dans Réglages.');

  const doFetch = async () => {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
          },
        }),
      });
      return res;
    }
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model, max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  };

  const maxAttempts = 4;
  let lastStatus, lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res;
    try { res = await doFetch(); }
    catch (e) {
      lastErr = e;
      if (attempt < maxAttempts) {
        updateRetryStatus(attempt, maxAttempts);
        await sleep(attempt * 2000);
        continue;
      }
      throw e;
    }

    if (res.ok) {
      const data = await res.json();
      return provider === 'gemini'
        ? data.candidates[0].content.parts[0].text
        : data.content[0].text;
    }

    lastStatus = res.status;
    const errText = await res.text();
    lastErr = new Error(`API ${res.status}: ${errText}`);

    if (RETRYABLE_STATUSES.includes(res.status) && attempt < maxAttempts) {
      updateRetryStatus(attempt, maxAttempts, res.status);
      await sleep(attempt * 2000);
      continue;
    }
    throw lastErr;
  }
  throw lastErr || new Error('API unreachable');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function updateRetryStatus(attempt, max, status) {
  const el = document.querySelector('#recipe-output .loading-msg');
  if (!el) return;
  const reason = status === 503 ? 'serveur saturé'
    : status === 429 ? 'limite temporaire atteinte'
    : 'erreur temporaire';
  el.textContent = `${reason}, nouvelle tentative (${attempt}/${max - 1})…`;
}

// ---------- Generate recipe ----------
const RECIPE_SCHEMA_PROMPT = `Tu es un chef expérimenté. Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans backticks), avec ce schéma exact :
{
  "title": "string",
  "cuisine": "string",
  "servings": number,
  "time_minutes": number,
  "difficulty": "facile|moyenne|experte",
  "ingredients": [{"name": "string", "quantity": "string"}],
  "steps": ["string"],
  "tips": ["string"]
}

RÈGLES DE FIABILITÉ (importantes) :
- Quantités précises et cohérentes pour le nombre de personnes demandé.
- Utilise PRIORITAIREMENT les ingrédients fournis. Tu peux ajouter des basiques (sel, poivre, huile, eau, ail, oignon, herbes) si nécessaire, mais signale-le.
- Étapes courtes, numérotables, avec températures/temps de cuisson explicites.
- Vérifie les proportions (ex: ratio liquide/féculent, levée, etc.).
- Reste fidèle à la cuisine demandée.`;

document.getElementById('generate-btn').addEventListener('click', async () => {
  const cuisine = selectedCuisine || document.getElementById('cuisine-other').value.trim();
  const ingredientsRaw = document.getElementById('ingredients').value.trim();
  const excludedRaw = document.getElementById('excluded').value.trim();
  const servings = document.getElementById('servings').value;
  const timeLimit = document.getElementById('time-limit').value;
  const difficulty = document.getElementById('difficulty').value;
  const preferences = document.getElementById('preferences').value.trim();

  if (!cuisine) return alert('Choisis un type de cuisine');
  if (!ingredientsRaw) return alert('Ajoute au moins un ingrédient');

  const ingredientList = ingredientsRaw.split(',').map(s => s.trim()).filter(Boolean);
  const excludedList = excludedRaw.split(',').map(s => s.trim()).filter(Boolean);

  // Track habits
  bumpHabit('cuisines', cuisine);
  ingredientList.forEach(i => bumpHabit('ingredients', i));

  // Suggest a variant if often-cooked
  const habits = getHabits();
  const oftenCuisine = (habits.cuisines[cuisine.toLowerCase()] || 0) >= 3;
  const variantHint = oftenCuisine
    ? "L'utilisateur cuisine souvent ce type de plat — propose une VARIANTE originale (technique, ingrédient ou présentation différente) tout en restant authentique."
    : '';

  const userPrompt = `Cuisine : ${cuisine}
Ingrédients disponibles : ${ingredientList.join(', ')}
${excludedList.length ? `🚫 INGRÉDIENTS INTERDITS (ne JAMAIS utiliser, même en petite quantité, même sous une autre forme comme purée/coulis/jus) : ${excludedList.join(', ')}` : ''}
Personnes : ${servings}
${timeLimit ? `Temps maximum : ${timeLimit} minutes` : ''}
Difficulté visée : ${difficulty}
${preferences ? `Préférences/contraintes : ${preferences}` : ''}
${variantHint}

Génère UNE recette complète au format JSON demandé.${excludedList.length ? ' Vérifie deux fois que les ingrédients interdits ne figurent NULLE PART dans la liste finale.' : ''}`;

  const out = document.getElementById('recipe-output');
  out.classList.remove('hidden');
  out.innerHTML = '<div class="recipe-block"><span class="loading"></span><span class="loading-msg">Préparation de ta recette…</span></div>';

  try {
    let recipe = await generateWithRetry(RECIPE_SCHEMA_PROMPT + '\n\n' + userPrompt);

    // Safety check: if a forbidden ingredient slipped through, ask for a fix
    if (excludedList.length) {
      const violations = findViolations(recipe, excludedList);
      if (violations.length) {
        const fixPrompt = RECIPE_SCHEMA_PROMPT + '\n\n' + userPrompt +
          `\n\nLa recette précédente contenait : ${violations.join(', ')}. Refais-la SANS ces ingrédients. Voici la version à corriger :\n${JSON.stringify(recipe)}`;
        recipe = await generateWithRetry(fixPrompt);
      }
    }

    recipe.id = 'r_' + Date.now();
    recipe.source = 'ai';
    recipe.created_at = Date.now();
    renderRecipe(out, recipe, { showSave: true });
  } catch (e) {
    out.innerHTML = `<div class="error">Erreur : ${escapeHTML(e.message)}</div>`;
  }
});

function findViolations(recipe, excluded) {
  const text = JSON.stringify(recipe).toLowerCase();
  return excluded.filter(ex => {
    const word = ex.toLowerCase().trim();
    if (!word) return false;
    return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text);
  });
}

async function generateWithRetry(prompt, attempts = 2) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const text = await callAI(prompt, 4000);
      return parseRecipeJSON(text);
    } catch (e) {
      lastError = e;
      if (!String(e.message).includes('JSON')) throw e;
    }
  }
  throw lastError;
}

function parseRecipeJSON(text) {
  // Strategy 1: direct parse
  try { return JSON.parse(text); } catch {}

  // Strategy 2: strip markdown code fences
  let cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}

  // Strategy 3: extract first {...} block
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    let candidate = match[0];
    try { return JSON.parse(candidate); } catch {}

    // Strategy 4: repair common issues
    // - smart quotes -> straight quotes
    candidate = candidate
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      // - trailing commas before } or ]
      .replace(/,(\s*[}\]])/g, '$1');
    try { return JSON.parse(candidate); } catch {}

    // Strategy 5: truncate at last valid closing brace
    for (let i = candidate.length; i > 0; i--) {
      if (candidate[i - 1] === '}') {
        try { return JSON.parse(candidate.slice(0, i)); } catch {}
      }
    }
  }
  throw new Error('Réponse IA invalide (JSON cassé). Réessaie.');
}

// ---------- Render recipe ----------
function renderRecipe(container, recipe, { showSave = false } = {}) {
  const ingredientsHTML = recipe.ingredients.map(i =>
    `<li><strong>${escapeHTML(i.quantity || '')}</strong> ${escapeHTML(i.name || '')}</li>`).join('');
  const stepsHTML = recipe.steps.map(s => `<li>${escapeHTML(s)}</li>`).join('');
  const tipsHTML = (recipe.tips || []).map(t => `<li>${escapeHTML(t)}</li>`).join('');

  container.innerHTML = `
    <div class="recipe-block">
      <h2>${escapeHTML(recipe.title)}</h2>
      <div class="recipe-meta">
        <span>🌍 ${escapeHTML(recipe.cuisine)}</span>
        <span>👥 ${recipe.servings} pers.</span>
        <span>⏱️ ${recipe.time_minutes} min</span>
        <span>📊 ${escapeHTML(recipe.difficulty)}</span>
      </div>
      <h3>Ingrédients</h3>
      <ul>${ingredientsHTML}</ul>
      <h3>Préparation</h3>
      <ol>${stepsHTML}</ol>
      ${tipsHTML ? `<h3>Conseils</h3><ul>${tipsHTML}</ul>` : ''}
      <div class="recipe-actions">
        ${showSave ? '<button class="primary save-btn">💾 Enregistrer</button>' : ''}
        <button class="secondary regen-btn">🔄 Variante</button>
      </div>
    </div>
  `;

  const saveBtn = container.querySelector('.save-btn');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    saveRecipe(recipe);
    saveBtn.textContent = '✓ Enregistré';
    saveBtn.disabled = true;
  });
  const regenBtn = container.querySelector('.regen-btn');
  if (regenBtn) regenBtn.addEventListener('click', async () => {
    regenBtn.disabled = true;
    regenBtn.innerHTML = '<span class="loading"></span>Variante…';
    try {
      const text = await callAI(RECIPE_SCHEMA_PROMPT + '\n\nVoici une recette précédente :\n' + JSON.stringify(recipe) + '\n\nPropose une VARIANTE différente (autre technique, autre ingrédient principal ou autre style) tout en respectant les ingrédients de base. Format JSON.', 2500);
      const variant = parseRecipeJSON(text);
      variant.id = 'r_' + Date.now();
      variant.source = 'ai';
      variant.created_at = Date.now();
      renderRecipe(container, variant, { showSave: true });
    } catch (e) {
      regenBtn.disabled = false;
      regenBtn.textContent = '🔄 Variante';
      alert('Erreur : ' + e.message);
    }
  });
}

// ---------- Save / Library ----------
function saveRecipe(recipe) {
  const recipes = store.get(STORE_KEYS.recipes, []);
  recipes.unshift(recipe);
  store.set(STORE_KEYS.recipes, recipes);
}
function deleteRecipe(id) {
  const recipes = store.get(STORE_KEYS.recipes, []).filter(r => r.id !== id);
  store.set(STORE_KEYS.recipes, recipes);
  renderLibrary();
}

function renderLibrary() {
  const list = document.getElementById('library-list');
  const search = document.getElementById('library-search').value.toLowerCase();
  const recipes = store.get(STORE_KEYS.recipes, [])
    .filter(r => !search || r.title.toLowerCase().includes(search) || (r.cuisine || '').toLowerCase().includes(search));
  if (!recipes.length) {
    list.innerHTML = '<p class="hint">Aucune recette pour le moment.</p>';
    return;
  }
  list.innerHTML = recipes.map(r => `
    <div class="library-item">
      <div class="info" data-id="${r.id}">
        <div class="title">${escapeHTML(r.title)}</div>
        <div class="meta">${escapeHTML(r.cuisine || '')} · ${r.servings} pers. · ${r.time_minutes || '?'} min</div>
      </div>
      <span class="badge ${r.source === 'own' ? 'own' : 'ai'}">${r.source === 'own' ? 'Perso' : 'IA'}</span>
      <button class="secondary delete-btn" data-id="${r.id}">🗑️</button>
    </div>
  `).join('');
  list.querySelectorAll('.info').forEach(el => {
    el.addEventListener('click', () => openRecipeModal(el.dataset.id));
  });
  list.querySelectorAll('.delete-btn').forEach(el => {
    el.addEventListener('click', () => {
      if (confirm('Supprimer cette recette ?')) deleteRecipe(el.dataset.id);
    });
  });
}
document.getElementById('library-search').addEventListener('input', renderLibrary);

function openRecipeModal(id) {
  const recipe = store.get(STORE_KEYS.recipes, []).find(r => r.id === id);
  if (!recipe) return;
  const modal = document.getElementById('recipe-modal');
  const content = document.getElementById('recipe-modal-content');
  renderRecipe(content, recipe);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'secondary';
  closeBtn.textContent = 'Fermer';
  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  content.querySelector('.recipe-actions').appendChild(closeBtn);
  modal.classList.remove('hidden');
}

// ---------- Add own recipe ----------
document.getElementById('add-own-btn').addEventListener('click', () => {
  document.getElementById('own-recipe-modal').classList.remove('hidden');
});
document.getElementById('cancel-own-btn').addEventListener('click', () => {
  document.getElementById('own-recipe-modal').classList.add('hidden');
});
document.getElementById('save-own-btn').addEventListener('click', () => {
  const title = document.getElementById('own-title').value.trim();
  const cuisine = document.getElementById('own-cuisine').value.trim();
  const servings = parseInt(document.getElementById('own-servings').value, 10) || 2;
  const ingredientsLines = document.getElementById('own-ingredients').value.split('\n').map(l => l.trim()).filter(Boolean);
  const steps = document.getElementById('own-steps').value.split('\n').map(l => l.trim()).filter(Boolean);
  if (!title || !ingredientsLines.length || !steps.length) return alert('Titre, ingrédients et étapes requis');

  const ingredients = ingredientsLines.map(line => {
    const m = line.match(/^([\d.,]+\s*\S*)\s+(.+)$/);
    return m ? { quantity: m[1], name: m[2] } : { quantity: '', name: line };
  });

  const recipe = {
    id: 'r_' + Date.now(),
    source: 'own',
    title, cuisine, servings,
    time_minutes: 0,
    difficulty: '—',
    ingredients, steps, tips: [],
    created_at: Date.now(),
  };
  saveRecipe(recipe);
  document.getElementById('own-recipe-modal').classList.add('hidden');
  ['own-title', 'own-cuisine', 'own-ingredients', 'own-steps'].forEach(id => document.getElementById(id).value = '');
  renderLibrary();
});

// ---------- Shopping list ----------
function renderShoppingPicker() {
  const picker = document.getElementById('shopping-recipe-picker');
  const recipes = store.get(STORE_KEYS.recipes, []);
  if (!recipes.length) {
    picker.innerHTML = '<p class="hint">Enregistre des recettes d\'abord.</p>';
    return;
  }
  picker.innerHTML = recipes.map(r => `
    <label class="shopping-pick">
      <input type="checkbox" value="${r.id}" />
      <span>${escapeHTML(r.title)} <small>(${r.servings} pers.)</small></span>
    </label>
  `).join('');
  document.getElementById('shopping-output').classList.add('hidden');
}

document.getElementById('build-shopping-btn').addEventListener('click', async () => {
  const checked = [...document.querySelectorAll('#shopping-recipe-picker input:checked')].map(i => i.value);
  if (!checked.length) return alert('Sélectionne au moins une recette');
  const recipes = store.get(STORE_KEYS.recipes, []).filter(r => checked.includes(r.id));
  const out = document.getElementById('shopping-output');
  out.classList.remove('hidden');
  out.innerHTML = '<div class="recipe-block"><span class="loading"></span>Construction de la liste…</div>';

  const prompt = `Tu es un assistant cuisine. Voici plusieurs recettes :
${recipes.map(r => `--- ${r.title} (${r.servings} pers.) ---\n${r.ingredients.map(i => `${i.quantity || ''} ${i.name}`).join('\n')}`).join('\n\n')}

Génère UNE liste de courses CONSOLIDÉE (additionne les quantités identiques, regroupe par catégorie : Frais, Épicerie, Frigo/Crémerie, Surgelés, Boissons, Autres).
Réponds UNIQUEMENT en JSON :
{
  "categories": [
    {"name": "string", "items": [{"name": "string", "quantity": "string"}]}
  ]
}`;

  try {
    const text = await callAI(prompt, 1500);
    const list = parseRecipeJSON(text);
    out.innerHTML = '<h3>🛒 Liste de courses</h3>' + list.categories.map(cat => `
      <h4>${escapeHTML(cat.name)}</h4>
      <ul class="shopping-list">
        ${cat.items.map(i => `<li>${escapeHTML(i.quantity || '')} ${escapeHTML(i.name)}</li>`).join('')}
      </ul>
    `).join('');
  } catch (e) {
    out.innerHTML = `<div class="error">Erreur : ${escapeHTML(e.message)}</div>`;
  }
});

// ---------- Settings ----------
function loadSettings() {
  document.getElementById('api-key').value = store.get(STORE_KEYS.apiKey, '') || '';
  document.getElementById('model').value = store.get(STORE_KEYS.model, DEFAULT_MODEL);
  document.getElementById('provider').value = store.get(STORE_KEYS.provider, DEFAULT_PROVIDER);
  updateModelOptions();
}
document.getElementById('save-settings').addEventListener('click', () => {
  store.set(STORE_KEYS.apiKey, document.getElementById('api-key').value.trim());
  store.set(STORE_KEYS.model, document.getElementById('model').value);
  store.set(STORE_KEYS.provider, document.getElementById('provider').value);
  alert('Réglages enregistrés ✓');
});

function updateModelOptions() {
  const provider = document.getElementById('provider').value;
  const modelSelect = document.getElementById('model');
  const options = provider === 'gemini'
    ? [
        ['gemini-2.0-flash', 'Gemini 2.0 Flash (gratuit, rapide)'],
        ['gemini-2.5-flash', 'Gemini 2.5 Flash'],
        ['gemini-2.5-pro', 'Gemini 2.5 Pro (max qualité)'],
      ]
    : [
        ['claude-sonnet-4-6', 'Claude Sonnet 4.6 (recommandé)'],
        ['claude-haiku-4-5-20251001', 'Claude Haiku 4.5 (rapide)'],
        ['claude-opus-4-7', 'Claude Opus 4.7 (max qualité)'],
      ];
  const current = modelSelect.value;
  modelSelect.innerHTML = options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  if (options.some(o => o[0] === current)) modelSelect.value = current;
}
document.getElementById('provider').addEventListener('change', updateModelOptions);
document.getElementById('reset-habits').addEventListener('click', () => {
  if (confirm('Effacer toutes les habitudes ?')) {
    store.set(STORE_KEYS.habits, { cuisines: {}, ingredients: {} });
    renderHabits();
  }
});

function renderHabits() {
  const cuisines = topHabits('cuisines', 10);
  const ingredients = topHabits('ingredients', 10);
  const max = Math.max(1, ...cuisines.map(([, c]) => c), ...ingredients.map(([, c]) => c));
  const display = document.getElementById('habits-display');
  display.innerHTML = `
    <h4>Cuisines préférées</h4>
    ${cuisines.length ? cuisines.map(([n, c]) => `<div class="habit-bar"><span style="width:120px">${escapeHTML(n)}</span><div class="bar" style="width:${(c/max)*200}px"></div><span>${c}</span></div>`).join('') : '<p class="hint">Aucune donnée.</p>'}
    <h4>Ingrédients fréquents</h4>
    ${ingredients.length ? ingredients.map(([n, c]) => `<div class="habit-bar"><span style="width:120px">${escapeHTML(n)}</span><div class="bar" style="width:${(c/max)*200}px"></div><span>${c}</span></div>`).join('') : '<p class="hint">Aucune donnée.</p>'}
  `;
}

// ---------- Utils ----------
function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- Init ----------
loadSettings();
renderHabitHint();
