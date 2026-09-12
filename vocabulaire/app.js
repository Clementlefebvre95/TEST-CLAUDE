// ============================================================
// Mon Carnet de Vocabulaire - vanilla JS, localStorage
// Anglais / Espagnol : mots, leçon du jour, phrase du jour, révision
// ============================================================

const LANGS = {
  en: {
    code: 'en',
    nom: 'Anglais',
    adjectif: 'anglais',
    drapeau: '🇬🇧',
    voix: 'en-GB',
    lecons: LESSONS_EN,
    phrases: SENTENCES_EN,
  },
  es: {
    code: 'es',
    nom: 'Espagnol',
    adjectif: 'espagnol',
    drapeau: '🇪🇸',
    voix: 'es-ES',
    lecons: LESSONS_ES,
    phrases: SENTENCES_ES,
  },
};

const STORE_KEYS = {
  lang: 'voc_last_lang',        // la langue retrouvée à la reconnexion
  words: lang => `voc_words_${lang}`,
  stats: 'voc_stats',           // { streak, lastDay, jours: n }
};

const MAX_BOX = 5;              // un mot est "maîtrisé" arrivé à la boîte 5
const SESSION_SIZE = 20;

// ---------- Stockage ----------
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* quota plein ou mode privé : on ignore */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  },
};

// ---------- État ----------
let currentLang = LANGS[store.get(STORE_KEYS.lang, 'en')] ? store.get(STORE_KEYS.lang, 'en') : 'en';
let dayOffset = 0;              // 0 = aujourd'hui, -1 = hier, etc.
let editingId = null;           // mot en cours de modification
let session = { queue: [], index: 0, revealed: false, done: 0, bons: 0 };

const lang = () => LANGS[currentLang];

// ---------- Utilitaires ----------
const $ = id => document.getElementById(id);

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Numéro de jour stable (minuit local), sert à faire tourner le contenu
function dayNumber(offset = 0) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  // ms du minuit local ramenés en UTC : donne un entier qui augmente de 1 par jour
  return Math.round((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

function pickOfTheDay(list, offset, decalage) {
  const n = dayNumber(offset) + decalage;
  return list[((n % list.length) + list.length) % list.length];
}

function formatDate(offset) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const texte = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function flash(el, message, type = 'ok') {
  el.textContent = message;
  el.className = `flash ${type}`;
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.hidden = true; }, 2600);
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang().voix;
    u.rate = 0.9;
    speechSynthesis.speak(u);
  } catch { /* voix indisponible : tant pis */ }
}

// ---------- Mots ----------
function getWords(code = currentLang) {
  const list = store.get(STORE_KEYS.words(code), []);
  return Array.isArray(list) ? list : [];
}

function saveWords(list, code = currentLang) {
  store.set(STORE_KEYS.words(code), list);
  if (typeof scheduleSync === 'function') scheduleSync();
}

function addWord({ mot, trad, note }) {
  const list = getWords();
  const doublon = list.find(w => w.mot.toLowerCase().trim() === mot.toLowerCase().trim());
  if (doublon) return { ok: false, raison: 'doublon' };

  list.unshift({
    id: uid(),
    mot: mot.trim(),
    trad: trad.trim(),
    note: (note || '').trim(),
    box: 1,
    vus: 0,
    bons: 0,
    cree: Date.now(),
    revu: null,
  });
  saveWords(list);
  return { ok: true };
}

function updateWord(id, patch) {
  const list = getWords();
  const w = list.find(x => x.id === id);
  if (!w) return;
  Object.assign(w, patch);
  saveWords(list);
}

function deleteWord(id) {
  saveWords(getWords().filter(w => w.id !== id));
}

// ---------- Langue ----------
function setLang(code) {
  if (!LANGS[code]) return;
  currentLang = code;
  store.set(STORE_KEYS.lang, code);
  document.body.dataset.lang = code;

  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === code);
  });

  $('quick-word').placeholder = `Mot en ${lang().adjectif}`;
  $('word-label').textContent = `Mot en ${lang().adjectif}`;
  $('list-title').textContent = `Mes mots — ${lang().nom}`;
  cancelEdit();
  renderAll();
}

function renderAll() {
  renderToday();
  renderWordList();
  startSession();
  renderStats();
}

// ---------- Vue Aujourd'hui ----------
function renderToday() {
  const L = lang();
  const lecon = pickOfTheDay(L.lecons, dayOffset, currentLang === 'es' ? 7 : 0);
  const phrase = pickOfTheDay(L.phrases, dayOffset, currentLang === 'es' ? 11 : 3);

  $('day-label').textContent = dayOffset === 0
    ? `Aujourd'hui — ${formatDate(0)}`
    : formatDate(dayOffset);
  $('day-next').disabled = dayOffset >= 0;
  $('day-today').hidden = dayOffset === 0;

  const tableau = lecon.tableau ? `
    <div class="conj">
      <p class="conj-title">${escapeHtml(lecon.tableau.titre)}</p>
      <table>
        ${lecon.tableau.lignes.map(([g, d]) => `
          <tr><th>${escapeHtml(g)}</th><td>${escapeHtml(d)}</td></tr>`).join('')}
      </table>
    </div>` : '';

  $('lesson-card').innerHTML = `
    <div class="card-head">
      <span class="badge">${L.drapeau} Leçon du jour</span>
      <span class="tag">${escapeHtml(lecon.categorie)}</span>
    </div>
    <h2>${escapeHtml(lecon.titre)}</h2>
    <p class="resume">${escapeHtml(lecon.resume)}</p>
    <ul class="points">
      ${lecon.points.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
    </ul>
    ${tableau}
    <div class="examples">
      ${lecon.exemples.map(ex => `
        <div class="example">
          <p class="src">${escapeHtml(ex.src)}
            <button class="mini speak-btn" data-speak="${escapeHtml(ex.src)}" title="Écouter">🔊</button>
          </p>
          <p class="fr">${escapeHtml(ex.fr)}</p>
        </div>`).join('')}
    </div>
    ${lecon.astuce ? `<p class="astuce">💡 ${escapeHtml(lecon.astuce)}</p>` : ''}
  `;

  $('sentence-card').innerHTML = `
    <div class="card-head">
      <span class="badge">✍️ Phrase du jour</span>
    </div>
    <p class="big-sentence">${escapeHtml(phrase.src)}
      <button class="mini speak-btn" data-speak="${escapeHtml(phrase.src)}" title="Écouter">🔊</button>
    </p>
    <button class="ghost reveal-btn" id="reveal-sentence">Afficher la traduction</button>
    <div id="sentence-translation" hidden>
      <p class="fr big">${escapeHtml(phrase.fr)}</p>
      ${phrase.note ? `<p class="astuce">💡 ${escapeHtml(phrase.note)}</p>` : ''}
    </div>
    <div class="form-actions">
      <button class="primary" id="add-sentence">➕ Ajouter cette phrase à mon carnet</button>
    </div>
    <p class="flash" id="sentence-flash" hidden></p>
  `;

  $('reveal-sentence').addEventListener('click', e => {
    $('sentence-translation').hidden = false;
    e.target.hidden = true;
  });

  $('add-sentence').addEventListener('click', () => {
    const res = addWord({ mot: phrase.src, trad: phrase.fr, note: phrase.note || '' });
    const el = $('sentence-flash');
    if (res.ok) {
      flash(el, 'Phrase ajoutée à ton carnet ✅');
      renderWordList();
      renderStats();
    } else {
      flash(el, 'Elle est déjà dans ton carnet.', 'warn');
    }
  });

  document.querySelectorAll('#today .speak-btn').forEach(btn => {
    btn.addEventListener('click', () => speak(btn.dataset.speak));
  });
}

// ---------- Vue Vocabulaire ----------
function renderWordList() {
  const list = getWords();
  const recherche = $('search-input').value.toLowerCase().trim();
  const tri = $('sort-select').value;
  const filtre = $('filter-select').value;

  let visibles = list.filter(w => {
    if (filtre === 'mastered' && w.box < MAX_BOX) return false;
    if (filtre === 'learning' && w.box >= MAX_BOX) return false;
    if (!recherche) return true;
    return (w.mot + ' ' + w.trad + ' ' + (w.note || '')).toLowerCase().includes(recherche);
  });

  if (tri === 'alpha') {
    visibles.sort((a, b) => a.mot.localeCompare(b.mot, 'fr', { sensitivity: 'base' }));
  } else if (tri === 'weak') {
    visibles.sort((a, b) => a.box - b.box || b.cree - a.cree);
  } else {
    visibles.sort((a, b) => b.cree - a.cree);
  }

  const maitrises = list.filter(w => w.box >= MAX_BOX).length;
  $('word-counter').textContent = list.length
    ? `${list.length} mot${list.length > 1 ? 's' : ''} · ${maitrises} maîtrisé${maitrises > 1 ? 's' : ''}`
    : '';

  $('word-empty').hidden = list.length !== 0;
  $('word-list').innerHTML = visibles.map(w => `
    <li class="word-item ${w.box >= MAX_BOX ? 'mastered' : ''}" data-id="${w.id}">
      <div class="word-main">
        <p class="word-src">${escapeHtml(w.mot)}
          <button class="mini speak-btn" data-speak="${escapeHtml(w.mot)}" title="Écouter">🔊</button>
        </p>
        <p class="word-fr">${escapeHtml(w.trad)}</p>
        ${w.note ? `<p class="word-note">${escapeHtml(w.note)}</p>` : ''}
      </div>
      <div class="word-side">
        <span class="box-dots" title="Niveau ${w.box} sur ${MAX_BOX}">${
          '●'.repeat(w.box) + '○'.repeat(MAX_BOX - w.box)
        }</span>
        <div class="word-actions">
          <button class="mini" data-action="edit" title="Modifier">✏️</button>
          <button class="mini" data-action="delete" title="Supprimer">🗑️</button>
        </div>
      </div>
    </li>`).join('');

  if (list.length && !visibles.length) {
    $('word-list').innerHTML = '<li class="empty">Aucun mot ne correspond à cette recherche.</li>';
  }
}

function startEdit(id) {
  const w = getWords().find(x => x.id === id);
  if (!w) return;
  editingId = id;
  $('word-input').value = w.mot;
  $('trad-input').value = w.trad;
  $('note-input').value = w.note || '';
  $('word-submit').textContent = 'Enregistrer les modifications';
  $('word-cancel').hidden = false;
  $('word-input').focus();
  $('word-input').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEdit() {
  editingId = null;
  $('word-form').reset();
  $('word-submit').textContent = 'Ajouter au carnet';
  $('word-cancel').hidden = true;
}

// ---------- Vue Révision ----------
function startSession() {
  const list = getWords();
  const dir = $('review-direction').value;

  if (!list.length) {
    $('flashcard').hidden = true;
    $('review-empty').hidden = false;
    $('review-empty').textContent = `Ajoute d'abord quelques mots en ${lang().adjectif} pour pouvoir réviser.`;
    $('review-counter').textContent = '';
    return;
  }

  // Priorité aux mots peu maîtrisés, puis aux moins récemment revus
  const queue = [...list]
    .sort((a, b) => a.box - b.box || (a.revu || 0) - (b.revu || 0))
    .slice(0, SESSION_SIZE)
    .sort(() => Math.random() - 0.5)
    .map(w => ({
      id: w.id,
      sens: dir === 'mix' ? (Math.random() < 0.5 ? 'src2fr' : 'fr2src') : dir,
    }));

  session = { queue, index: 0, revealed: false, done: 0, bons: 0 };
  $('review-empty').hidden = true;
  $('flashcard').hidden = false;
  renderCard();
}

function renderCard() {
  const total = session.queue.length;

  if (session.index >= total) {
    $('flashcard').hidden = true;
    $('review-empty').hidden = false;
    $('review-empty').innerHTML = total
      ? `🎉 Série terminée : ${session.bons} / ${total} de réussite.<br>Lance une nouvelle série quand tu veux.`
      : '';
    $('review-counter').textContent = '';
    renderWordList();
    renderStats();
    return;
  }

  const item = session.queue[session.index];
  const w = getWords().find(x => x.id === item.id);
  if (!w) { session.index++; return renderCard(); }

  const versFr = item.sens === 'src2fr';
  $('flash-question').textContent = versFr ? w.mot : w.trad;
  $('flash-answer-text').textContent = versFr ? w.trad : w.mot;
  $('flash-note').textContent = w.note || '';
  $('flash-note').hidden = !w.note;

  $('flash-speak').hidden = !versFr;
  $('flash-speak').onclick = () => speak(w.mot);

  $('flash-answer').hidden = true;
  $('flash-reveal').hidden = false;
  $('grade-row').hidden = true;
  session.revealed = false;

  $('review-progress').textContent = `Carte ${session.index + 1} sur ${total}`;
  $('review-counter').textContent = `${session.bons} bonne${session.bons > 1 ? 's' : ''} réponse${session.bons > 1 ? 's' : ''}`;
}

function revealCard() {
  session.revealed = true;
  $('flash-answer').hidden = false;
  $('flash-reveal').hidden = true;
  $('grade-row').hidden = false;
  const item = session.queue[session.index];
  if (item.sens === 'fr2src') {
    const w = getWords().find(x => x.id === item.id);
    if (w) { $('flash-speak').hidden = false; $('flash-speak').onclick = () => speak(w.mot); }
  }
}

function gradeCard(reussi) {
  const item = session.queue[session.index];
  const w = getWords().find(x => x.id === item.id);
  if (w) {
    updateWord(w.id, {
      box: reussi ? Math.min(MAX_BOX, w.box + 1) : 1,
      vus: (w.vus || 0) + 1,
      bons: (w.bons || 0) + (reussi ? 1 : 0),
      revu: Date.now(),
    });
  }
  if (reussi) session.bons++;
  session.done++;
  session.index++;
  renderCard();
}

// ---------- Vue Réglages ----------
function renderStats() {
  const bloc = Object.values(LANGS).map(L => {
    const list = getWords(L.code);
    const maitrises = list.filter(w => w.box >= MAX_BOX).length;
    const revisions = list.reduce((n, w) => n + (w.vus || 0), 0);
    return `
      <div class="stat">
        <p class="stat-num">${list.length}</p>
        <p class="stat-label">${L.drapeau} mots en ${L.adjectif}</p>
        <p class="muted small">${maitrises} maîtrisé${maitrises > 1 ? 's' : ''} · ${revisions} révision${revisions > 1 ? 's' : ''}</p>
      </div>`;
  }).join('');

  const s = store.get(STORE_KEYS.stats, { jours: 0, streak: 0 });
  $('stats-grid').innerHTML = bloc + `
    <div class="stat">
      <p class="stat-num">${s.streak || 0}</p>
      <p class="stat-label">🔥 jours d'affilée</p>
      <p class="muted small">${s.jours || 0} jour${(s.jours || 0) > 1 ? 's' : ''} d'apprentissage au total</p>
    </div>`;
}

function trackVisit() {
  const today = dayNumber(0);
  const s = store.get(STORE_KEYS.stats, { jours: 0, streak: 0, lastDay: null });
  if (s.lastDay === today) return;
  s.streak = s.lastDay === today - 1 ? (s.streak || 0) + 1 : 1;
  s.jours = (s.jours || 0) + 1;
  s.lastDay = today;
  store.set(STORE_KEYS.stats, s);
}

function snapshot() {
  return {
    format: 'carnet-vocabulaire-v1',
    exporte: new Date().toISOString(),
    langue: currentLang,
    mots: { en: getWords('en'), es: getWords('es') },
    stats: store.get(STORE_KEYS.stats, {}),
  };
}

function normalizeWord(w) {
  return {
    id: w.id || uid(),
    mot: String(w.mot).trim(),
    trad: String(w.trad).trim(),
    note: String(w.note || '').trim(),
    box: Math.min(MAX_BOX, Math.max(1, Number(w.box) || 1)),
    vus: Number(w.vus) || 0,
    bons: Number(w.bons) || 0,
    cree: Number(w.cree) || Date.now(),
    revu: Number(w.revu) || null,
  };
}

// Fusionne des mots venus d'ailleurs (fichier ou cloud) dans le carnet local.
// Rien n'est jamais écrasé : on garde le meilleur niveau et le plus d'infos.
function mergeWords(motsParLangue) {
  let ajoutes = 0, fusionnes = 0;

  ['en', 'es'].forEach(code => {
    const entrants = Array.isArray(motsParLangue?.[code]) ? motsParLangue[code] : [];
    if (!entrants.length) return;

    const locaux = getWords(code);
    const index = new Map(locaux.map(w => [w.mot.toLowerCase().trim(), w]));

    entrants.forEach(brut => {
      if (!brut || !brut.mot || !brut.trad) return;
      const w = normalizeWord(brut);
      const existant = index.get(w.mot.toLowerCase());

      if (!existant) {
        locaux.push(w);
        index.set(w.mot.toLowerCase(), w);
        ajoutes++;
      } else {
        const avant = JSON.stringify(existant);
        existant.box = Math.max(existant.box, w.box);
        existant.vus = Math.max(existant.vus || 0, w.vus);
        existant.bons = Math.max(existant.bons || 0, w.bons);
        existant.cree = Math.min(existant.cree || Date.now(), w.cree);
        existant.revu = Math.max(existant.revu || 0, w.revu || 0) || null;
        if (!existant.note && w.note) existant.note = w.note;
        if (JSON.stringify(existant) !== avant) fusionnes++;
      }
    });

    saveWords(locaux, code);
  });

  return { ajoutes, fusionnes };
}

function exportData() {
  const data = snapshot();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `carnet-vocabulaire-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  flash($('settings-flash'), 'Carnet exporté ✅');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !data.mots) throw new Error('format');
      const { ajoutes, fusionnes } = mergeWords(data.mots);
      flash($('settings-flash'), `${ajoutes} mot(s) importé(s), ${fusionnes} mis à jour ✅`);
      renderAll();
      scheduleSync();
    } catch {
      flash($('settings-flash'), 'Fichier illisible ou format inattendu.', 'warn');
    }
  };
  reader.readAsText(file);
}

// ============================================================
// Sauvegarde en ligne (GitHub Gist privé)
// Le carnet est poussé dans un fichier JSON secret du compte GitHub :
// il survit donc au changement de téléphone ou de navigateur.
// ============================================================

const SYNC_KEYS = { token: 'voc_gh_token', gist: 'voc_gh_gist', last: 'voc_sync_last' };
const GIST_FILE = 'carnet-vocabulaire.json';
const GIST_DESC = 'Mon Carnet de Vocabulaire — sauvegarde automatique';

let syncTimer = null;
let syncEnCours = false;

const syncToken = () => store.get(SYNC_KEYS.token, '') || '';
const syncGistId = () => store.get(SYNC_KEYS.gist, '') || '';
const syncActive = () => Boolean(syncToken());

async function gh(chemin, options = {}) {
  const res = await fetch(`https://api.github.com${chemin}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${syncToken()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function messageErreur(err) {
  if (err && err.status === 401) return 'Jeton refusé par GitHub. Vérifie qu\'il est bien copié en entier.';
  if (err && err.status === 403) return 'GitHub a refusé : le droit « gist » est-il bien coché sur le jeton ?';
  if (err && err.status === 404) return 'Sauvegarde introuvable sur GitHub.';
  return 'Pas de connexion à GitHub pour le moment. Le carnet reste sur ce téléphone.';
}

// Retrouve la sauvegarde existante du compte à partir du seul jeton
async function trouverGist() {
  const gists = await gh('/gists?per_page=100');
  const trouve = (gists || []).find(g => g.files && g.files[GIST_FILE]);
  return trouve ? trouve.id : '';
}

async function lireGist(id) {
  const g = await gh(`/gists/${id}`);
  const fichier = g.files && g.files[GIST_FILE];
  if (!fichier) throw Object.assign(new Error('fichier absent'), { status: 404 });
  const contenu = fichier.truncated
    ? await (await fetch(fichier.raw_url)).text()
    : fichier.content;
  return JSON.parse(contenu);
}

async function pushCloud() {
  const corps = {
    description: GIST_DESC,
    files: { [GIST_FILE]: { content: JSON.stringify(snapshot(), null, 2) } },
  };
  let id = syncGistId();

  if (!id) {
    id = await trouverGist();
    if (id) store.set(SYNC_KEYS.gist, id);
  }

  try {
    const res = id
      ? await gh(`/gists/${id}`, { method: 'PATCH', body: JSON.stringify(corps) })
      : await gh('/gists', { method: 'POST', body: JSON.stringify({ ...corps, public: false }) });
    store.set(SYNC_KEYS.gist, res.id);
  } catch (err) {
    if (err.status === 404) {          // sauvegarde supprimée sur GitHub : on en recrée une
      store.remove(SYNC_KEYS.gist);
      const res = await gh('/gists', { method: 'POST', body: JSON.stringify({ ...corps, public: false }) });
      store.set(SYNC_KEYS.gist, res.id);
    } else {
      throw err;
    }
  }

  store.set(SYNC_KEYS.last, Date.now());
  renderSyncUI();
}

async function pullCloud() {
  let id = syncGistId();
  if (!id) {
    id = await trouverGist();
    if (!id) return { ajoutes: 0, fusionnes: 0, vide: true };
    store.set(SYNC_KEYS.gist, id);
  }
  const data = await lireGist(id);
  const resultat = mergeWords(data && data.mots);
  store.set(SYNC_KEYS.last, Date.now());
  return resultat;
}

// Au démarrage et sur demande : on récupère le cloud, puis on renvoie la fusion
async function syncNow({ silencieux = true } = {}) {
  if (!syncActive() || syncEnCours) return;
  syncEnCours = true;
  renderSyncUI('Synchronisation...');
  try {
    const res = await pullCloud();
    await pushCloud();
    renderAll();
    if (!silencieux) {
      flash($('sync-flash'), res.vide
        ? 'Première sauvegarde envoyée sur GitHub ✅'
        : `Carnet synchronisé ✅ (${res.ajoutes} mot(s) récupéré(s))`);
    }
  } catch (err) {
    if (!silencieux) flash($('sync-flash'), messageErreur(err), 'warn');
  } finally {
    syncEnCours = false;
    renderSyncUI();
  }
}

// Sauvegarde automatique, groupée, après chaque modification du carnet
function scheduleSync() {
  if (!syncActive()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    if (syncEnCours) return;
    syncEnCours = true;
    renderSyncUI('Sauvegarde...');
    try { await pushCloud(); }
    catch { /* on réessaiera à la prochaine modification */ }
    finally { syncEnCours = false; renderSyncUI(); }
  }, 2000);
}

function renderSyncUI(etat) {
  const statut = $('sync-status');
  const actif = syncActive();

  ['sync-push', 'sync-pull', 'sync-forget'].forEach(id => { $(id).hidden = !actif; });
  $('sync-save').textContent = actif ? 'Mettre à jour le jeton' : 'Activer la sauvegarde';
  $('sync-gist').value = syncGistId();

  if (etat) { statut.textContent = etat; return; }
  if (!actif) { statut.textContent = 'Non configurée'; return; }

  const last = store.get(SYNC_KEYS.last, 0);
  if (!last) { statut.textContent = 'Activée — pas encore sauvegardée'; return; }

  const minutes = Math.round((Date.now() - last) / 60000);
  statut.textContent = minutes < 1
    ? '✅ Sauvegardé à l\'instant'
    : minutes < 60
      ? `✅ Sauvegardé il y a ${minutes} min`
      : `✅ Sauvegardé le ${new Date(last).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
}

// ---------- Écouteurs ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'words') renderWordList();
    if (btn.dataset.tab === 'review') startSession();
    if (btn.dataset.tab === 'settings') { renderStats(); renderSyncUI(); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => setLang(btn.dataset.lang));
});

$('day-prev').addEventListener('click', () => { dayOffset--; renderToday(); });
$('day-next').addEventListener('click', () => { if (dayOffset < 0) { dayOffset++; renderToday(); } });
$('day-today').addEventListener('click', () => { dayOffset = 0; renderToday(); });

$('quick-form').addEventListener('submit', e => {
  e.preventDefault();
  const mot = $('quick-word').value.trim();
  const trad = $('quick-trad').value.trim();
  if (!mot || !trad) return;
  const res = addWord({ mot, trad });
  if (res.ok) {
    flash($('quick-flash'), `« ${mot} » ajouté à ton carnet ✅`);
    $('quick-form').reset();
    $('quick-word').focus();
    renderWordList();
    renderStats();
  } else {
    flash($('quick-flash'), 'Ce mot est déjà dans ton carnet.', 'warn');
  }
});

$('word-form').addEventListener('submit', e => {
  e.preventDefault();
  const mot = $('word-input').value.trim();
  const trad = $('trad-input').value.trim();
  const note = $('note-input').value.trim();
  if (!mot || !trad) return;

  if (editingId) {
    updateWord(editingId, { mot, trad, note });
    cancelEdit();
  } else {
    const res = addWord({ mot, trad, note });
    if (!res.ok) {
      alert('Ce mot est déjà dans ton carnet pour cette langue.');
      return;
    }
    $('word-form').reset();
    $('word-input').focus();
  }
  renderWordList();
  renderStats();
});

$('word-cancel').addEventListener('click', cancelEdit);

$('word-list').addEventListener('click', e => {
  const speakBtn = e.target.closest('.speak-btn');
  if (speakBtn) return speak(speakBtn.dataset.speak);

  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = e.target.closest('.word-item').dataset.id;

  if (btn.dataset.action === 'edit') startEdit(id);
  if (btn.dataset.action === 'delete') {
    const w = getWords().find(x => x.id === id);
    if (w && confirm(`Supprimer « ${w.mot} » ?`)) {
      deleteWord(id);
      if (editingId === id) cancelEdit();
      renderWordList();
      renderStats();
    }
  }
});

$('search-input').addEventListener('input', renderWordList);
$('sort-select').addEventListener('change', renderWordList);
$('filter-select').addEventListener('change', renderWordList);

$('flash-reveal').addEventListener('click', revealCard);
$('flash-known').addEventListener('click', () => gradeCard(true));
$('flash-again').addEventListener('click', () => gradeCard(false));
$('review-restart').addEventListener('click', startSession);
$('review-direction').addEventListener('change', startSession);

document.addEventListener('keydown', e => {
  if (!$('review').classList.contains('active') || $('flashcard').hidden) return;
  if (e.target.matches('input, select, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); if (!session.revealed) revealCard(); }
  if (session.revealed && (e.key === '1' || e.key === 'ArrowLeft')) gradeCard(false);
  if (session.revealed && (e.key === '2' || e.key === 'ArrowRight')) gradeCard(true);
});

$('sync-save').addEventListener('click', async () => {
  const token = $('sync-token').value.trim();
  const gist = $('sync-gist').value.trim();
  if (!token) {
    flash($('sync-flash'), 'Colle d\'abord ton jeton GitHub.', 'warn');
    return;
  }
  store.set(SYNC_KEYS.token, token);
  if (gist) store.set(SYNC_KEYS.gist, gist);
  $('sync-token').value = '';
  renderSyncUI();
  await syncNow({ silencieux: false });
});

$('sync-push').addEventListener('click', async () => {
  renderSyncUI('Sauvegarde...');
  try {
    await pushCloud();
    flash($('sync-flash'), 'Carnet sauvegardé sur GitHub ✅');
  } catch (err) {
    flash($('sync-flash'), messageErreur(err), 'warn');
  }
  renderSyncUI();
});

$('sync-pull').addEventListener('click', async () => {
  renderSyncUI('Récupération...');
  try {
    const res = await pullCloud();
    renderAll();
    flash($('sync-flash'), res.vide
      ? 'Aucune sauvegarde trouvée sur ce compte GitHub.'
      : `${res.ajoutes} mot(s) récupéré(s), ${res.fusionnes} mis à jour ✅`);
  } catch (err) {
    flash($('sync-flash'), messageErreur(err), 'warn');
  }
  renderSyncUI();
});

$('sync-forget').addEventListener('click', () => {
  if (!confirm('Oublier le jeton sur cet appareil ? Ta sauvegarde GitHub, elle, reste en ligne.')) return;
  store.remove(SYNC_KEYS.token);
  store.remove(SYNC_KEYS.last);
  renderSyncUI();
  flash($('sync-flash'), 'Jeton oublié sur cet appareil.', 'warn');
});

$('export-btn').addEventListener('click', exportData);
$('import-input').addEventListener('change', e => {
  if (e.target.files[0]) importData(e.target.files[0]);
  e.target.value = '';
});

$('reset-btn').addEventListener('click', () => {
  if (confirm(`Effacer TOUS les mots en ${lang().adjectif} ? Cette action est définitive.`)) {
    store.remove(STORE_KEYS.words(currentLang));
    renderAll();
    flash($('settings-flash'), 'Carnet vidé.', 'warn');
  }
});

// ---------- Démarrage ----------
trackVisit();
setLang(currentLang);   // restaure la dernière langue utilisée
renderSyncUI();
syncNow();              // récupère la sauvegarde en ligne si un jeton est configuré

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
