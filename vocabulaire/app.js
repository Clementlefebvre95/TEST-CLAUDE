// ============================================================
// Mes Mots — vocabulaire anglais / espagnol
// 3 pages : mes mots · le contenu du jour · la révision
// Tout est enregistré dans le navigateur, et en ligne si possible.
// ============================================================

const LANGUES = {
  en: { nom: 'Anglais', adjectif: 'anglais', drapeau: '🇬🇧', voix: 'en-GB', lecons: LESSONS_EN, phrases: SENTENCES_EN },
  es: { nom: 'Espagnol', adjectif: 'espagnol', drapeau: '🇪🇸', voix: 'es-ES', lecons: LESSONS_ES, phrases: SENTENCES_ES },
};

const CLES = {
  langue: 'voc_last_lang',
  mots: code => `voc_words_${code}`,
  masque: 'voc_masque',
  jeton: 'voc_gh_token',
  gist: 'voc_gh_gist',
  maj: 'voc_sync_last',
};

const NIVEAU_MAX = 5;     // un mot atteint « maîtrisé » à la 5e réussite d'affilée
const TAILLE_SERIE = 20;

const $ = id => document.getElementById(id);

// ---------- Stockage local ----------
const store = {
  get(cle, defaut) {
    try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; }
    catch { return defaut; }
  },
  set(cle, valeur) {
    try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch {}
  },
  remove(cle) { try { localStorage.removeItem(cle); } catch {} },
};

// ---------- État ----------
let langue = LANGUES[store.get(CLES.langue, 'en')] ? store.get(CLES.langue, 'en') : 'en';
let masque = store.get(CLES.masque, false);
let devoiles = new Set();           // mots révélés un par un quand tout est masqué
let serie = { cartes: [], i: 0, vue: false, bons: 0 };

const L = () => LANGUES[langue];

// ---------- Utilitaires ----------
function html(texte) {
  return String(texte ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Entier qui augmente de 1 chaque jour : sert à faire tourner leçon et phrase
function numeroDuJour() {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.round((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

function duJour(liste, decalage) {
  const n = numeroDuJour() + decalage;
  return liste[((n % liste.length) + liste.length) % liste.length];
}

function message(el, texte, type = 'ok') {
  el.textContent = texte;
  el.className = `flash ${type}`;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 2600);
}

function parler(texte) {
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = L().voix;
    u.rate = 0.9;
    speechSynthesis.speak(u);
  } catch {}
}

// Premier clic : le bouton demande confirmation. Second clic : on exécute.
function confirmer(btn, texte, action) {
  if (btn.dataset.arme === '1') {
    clearTimeout(btn._t);
    btn.dataset.arme = '';
    btn.classList.remove('arme');
    btn.textContent = btn.dataset.avant;
    action();
    return;
  }
  btn.dataset.avant = btn.textContent;
  btn.dataset.arme = '1';
  btn.classList.add('arme');
  btn.textContent = texte;
  btn._t = setTimeout(() => {
    btn.dataset.arme = '';
    btn.classList.remove('arme');
    btn.textContent = btn.dataset.avant;
  }, 4000);
}

// ---------- Les mots ----------
const lireMots = (code = langue) => {
  const l = store.get(CLES.mots(code), []);
  return Array.isArray(l) ? l : [];
};

function ecrireMots(liste, code = langue) {
  store.set(CLES.mots(code), liste);
  planifierSauvegarde();
}

function ajouterMot(mot, trad, note = '') {
  const liste = lireMots();
  if (liste.some(m => m.mot.toLowerCase().trim() === mot.toLowerCase().trim())) return false;
  liste.unshift({
    id: uid(), mot: mot.trim(), trad: trad.trim(), note: note.trim(),
    niveau: 1, vus: 0, bons: 0, cree: Date.now(), revu: null,
  });
  ecrireMots(liste);
  return true;
}

function majMot(id, champs) {
  const liste = lireMots();
  const m = liste.find(x => x.id === id);
  if (!m) return;
  Object.assign(m, champs);
  ecrireMots(liste);
}

const supprimerMot = id => ecrireMots(lireMots().filter(m => m.id !== id));

function normaliser(m) {
  return {
    id: m.id || uid(),
    mot: String(m.mot).trim(),
    trad: String(m.trad).trim(),
    note: String(m.note || '').trim(),
    niveau: Math.min(NIVEAU_MAX, Math.max(1, Number(m.niveau ?? m.box) || 1)),
    vus: Number(m.vus) || 0,
    bons: Number(m.bons) || 0,
    cree: Number(m.cree) || Date.now(),
    revu: Number(m.revu) || null,
  };
}

// Fusionne des mots venus d'ailleurs : rien n'est écrasé, on garde le meilleur niveau
function fusionner(parLangue) {
  let ajoutes = 0, majs = 0;

  ['en', 'es'].forEach(code => {
    const entrants = Array.isArray(parLangue?.[code]) ? parLangue[code] : [];
    if (!entrants.length) return;

    const locaux = lireMots(code);
    const index = new Map(locaux.map(m => [m.mot.toLowerCase().trim(), m]));

    entrants.forEach(brut => {
      if (!brut || !brut.mot || !brut.trad) return;
      const m = normaliser(brut);
      const deja = index.get(m.mot.toLowerCase());
      if (!deja) {
        locaux.push(m);
        index.set(m.mot.toLowerCase(), m);
        ajoutes++;
      } else {
        const avant = JSON.stringify(deja);
        deja.niveau = Math.max(deja.niveau, m.niveau);
        deja.vus = Math.max(deja.vus || 0, m.vus);
        deja.bons = Math.max(deja.bons || 0, m.bons);
        deja.cree = Math.min(deja.cree || Date.now(), m.cree);
        deja.revu = Math.max(deja.revu || 0, m.revu || 0) || null;
        if (!deja.note && m.note) deja.note = m.note;
        if (JSON.stringify(deja) !== avant) majs++;
      }
    });

    store.set(CLES.mots(code), locaux);
  });

  return { ajoutes, majs };
}

const contenu = () => ({
  format: 'mes-mots-v1',
  exporte: new Date().toISOString(),
  mots: { en: lireMots('en'), es: lireMots('es') },
});

// ---------- Page 1 : mes mots ----------
function afficherMots() {
  const liste = lireMots();
  const recherche = $('recherche').value.toLowerCase().trim();
  const visibles = recherche
    ? liste.filter(m => (m.mot + ' ' + m.trad + ' ' + m.note).toLowerCase().includes(recherche))
    : liste;

  const maitrises = liste.filter(m => m.niveau >= NIVEAU_MAX).length;
  $('compteur').textContent = liste.length
    ? `${liste.length} mot${liste.length > 1 ? 's' : ''}${maitrises ? ` · ${maitrises} maîtrisé${maitrises > 1 ? 's' : ''}` : ''}`
    : '';
  $('vide').hidden = liste.length > 0;

  $('mots').innerHTML = visibles.map(m => {
    const cache = masque && !devoiles.has(m.id);
    const trad = cache
      ? `<button class="masque" data-voir="${m.id}">• • •</button>`
      : `<span>${html(m.trad)}</span>`;
    return `
      <li class="word-item ${m.niveau >= NIVEAU_MAX ? 'ok' : ''}" data-id="${m.id}">
        <div class="word-info">
          <div class="word-src">${html(m.mot)}</div>
          <div class="word-fr">${trad}${m.note ? ` <em>— ${html(m.note)}</em>` : ''}</div>
        </div>
        <span class="level">${'●'.repeat(m.niveau)}${'○'.repeat(NIVEAU_MAX - m.niveau)}</span>
        <button class="icon" data-dire="${html(m.mot)}" title="Écouter">🔊</button>
        <button class="icon" data-suppr="1" title="Supprimer">🗑️</button>
      </li>`;
  }).join('');

  if (liste.length && !visibles.length) {
    $('mots').innerHTML = '<li class="empty">Aucun mot ne correspond.</li>';
  }

  $('toggle-trad').textContent = masque ? '👁️ Montrer les traductions' : '🙈 Cacher les traductions';
  $('toggle-trad').classList.toggle('on', masque);
}

// ---------- Page 2 : le contenu du jour ----------
function afficherJour() {
  const lecon = duJour(L().lecons, langue === 'es' ? 7 : 0);
  const phrase = duJour(L().phrases, langue === 'es' ? 11 : 3);

  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('date-jour').textContent = date.charAt(0).toUpperCase() + date.slice(1);

  $('phrase').textContent = phrase.src;
  $('phrase-fr').textContent = phrase.fr;
  $('phrase-note').textContent = phrase.note ? `💡 ${phrase.note}` : '';
  $('phrase-note').hidden = !phrase.note;
  $('bloc-trad').hidden = true;
  $('voir-trad').hidden = false;
  $('ecouter-phrase').dataset.dire = phrase.src;
  $('ajouter-phrase').dataset.mot = phrase.src;
  $('ajouter-phrase').dataset.trad = phrase.fr;
  $('ajouter-phrase').dataset.note = phrase.note || '';

  $('lecon-cat').textContent = `${L().drapeau} ${lecon.categorie}`;
  $('lecon-titre').textContent = lecon.titre;
  $('lecon-resume').textContent = lecon.resume;

  $('lecon-tableau').innerHTML = lecon.tableau ? `
    <div class="conj">
      <p class="conj-title">${html(lecon.tableau.titre)}</p>
      <table>${lecon.tableau.lignes.map(([g, d]) =>
        `<tr><th>${html(g)}</th><td>${html(d)}</td></tr>`).join('')}</table>
    </div>` : '';

  $('lecon-exemples').innerHTML = lecon.exemples.map(ex => `
    <div class="example">
      <p class="src">${html(ex.src)}
        <button class="icon" data-dire="${html(ex.src)}" title="Écouter">🔊</button>
      </p>
      <p class="fr">${html(ex.fr)}</p>
    </div>`).join('');

  $('lecon-astuce').textContent = lecon.astuce ? `💡 ${lecon.astuce}` : '';
  $('lecon-astuce').hidden = !lecon.astuce;
  $('lecon-points').innerHTML = lecon.points.map(p => `<li>${html(p)}</li>`).join('');
}

// ---------- Page 3 : révision ----------
function nouvelleSerie() {
  const liste = lireMots();
  const sens = $('sens').value;

  if (!liste.length) {
    $('carte').hidden = true;
    $('revision-vide').hidden = false;
    $('revision-vide').textContent = `Ajoute d'abord quelques mots en ${L().adjectif}.`;
    $('score').textContent = '';
    return;
  }

  const cartes = [...liste]
    .sort((a, b) => a.niveau - b.niveau || (a.revu || 0) - (b.revu || 0))
    .slice(0, TAILLE_SERIE)
    .sort(() => Math.random() - 0.5)
    .map(m => ({ id: m.id, sens: sens === 'mix' ? (Math.random() < 0.5 ? 'src2fr' : 'fr2src') : sens }));

  serie = { cartes, i: 0, vue: false, bons: 0 };
  $('revision-vide').hidden = true;
  $('carte').hidden = false;
  afficherCarte();
}

function afficherCarte() {
  const total = serie.cartes.length;

  if (serie.i >= total) {
    $('carte').hidden = true;
    $('revision-vide').hidden = false;
    $('revision-vide').textContent = `🎉 Série terminée : ${serie.bons} / ${total}. Relance quand tu veux.`;
    $('score').textContent = '';
    afficherMots();
    return;
  }

  const carte = serie.cartes[serie.i];
  const m = lireMots().find(x => x.id === carte.id);
  if (!m) { serie.i++; return afficherCarte(); }

  const versFr = carte.sens === 'src2fr';
  $('question').textContent = versFr ? m.mot : m.trad;
  $('reponse-mot').textContent = versFr ? m.trad : m.mot;
  $('reponse-note').textContent = m.note || '';
  $('reponse-note').hidden = !m.note;
  $('ecouter-mot').hidden = !versFr;
  $('ecouter-mot').dataset.dire = m.mot;

  $('reponse').hidden = true;
  $('reveler').hidden = false;
  $('grade').hidden = true;
  serie.vue = false;

  $('avancement').textContent = `Carte ${serie.i + 1} sur ${total}`;
  $('score').textContent = serie.bons ? `${serie.bons} bonne${serie.bons > 1 ? 's' : ''}` : '';
}

function revelerCarte() {
  serie.vue = true;
  $('reponse').hidden = false;
  $('reveler').hidden = true;
  $('grade').hidden = false;
  const carte = serie.cartes[serie.i];
  const m = lireMots().find(x => x.id === carte.id);
  if (m) { $('ecouter-mot').hidden = false; $('ecouter-mot').dataset.dire = m.mot; }
}

function noter(reussi) {
  const carte = serie.cartes[serie.i];
  const m = lireMots().find(x => x.id === carte.id);
  if (m) {
    majMot(m.id, {
      niveau: reussi ? Math.min(NIVEAU_MAX, m.niveau + 1) : 1,
      vus: (m.vus || 0) + 1,
      bons: (m.bons || 0) + (reussi ? 1 : 0),
      revu: Date.now(),
    });
  }
  if (reussi) serie.bons++;
  serie.i++;
  afficherCarte();
}

// ============================================================
// Sauvegarde en ligne
// Deux coffres possibles, choisis automatiquement :
//  - page publiée comme Artifact Claude : stockage rattaché au compte ;
//  - page hébergée ailleurs : gist privé du compte GitHub.
// ============================================================

const FICHIER_GIST = 'mes-mots.json';
const surClaude = Boolean(window.claude && typeof window.claude.use === 'function');

let coffre = null;
let coffreResolu = false;
let minuterie = null;
let enCours = false;

async function capacite(nom) {
  try {
    if (!surClaude) return null;
    return await window.claude.use(nom);
  } catch { return null; }
}

// ---------- Coffre 1 : base de l'Artifact ----------
function coffreClaude(db) {
  return {
    type: 'claude',
    async pousser() {
      const c = contenu();
      await Promise.all(['en', 'es'].map(code =>
        db.doc(`mots/${code}`).set({ mots: c.mots[code], maj: Date.now() })));
      store.set(CLES.maj, Date.now());
    },
    async tirer() {
      const snaps = await Promise.all(['en', 'es'].map(code => db.doc(`mots/${code}`).get()));
      const mots = {};
      let vide = true;
      snaps.forEach((s, i) => {
        const d = s.exists ? s.data() : null;
        if (d && Array.isArray(d.mots)) { mots[['en', 'es'][i]] = d.mots; vide = false; }
      });
      if (vide) return { ajoutes: 0, majs: 0, vide: true };
      const res = fusionner(mots);
      store.set(CLES.maj, Date.now());
      return res;
    },
  };
}

// ---------- Coffre 2 : gist privé GitHub ----------
const jeton = () => store.get(CLES.jeton, '') || '';

async function gh(chemin, options = {}) {
  const res = await fetch(`https://api.github.com${chemin}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${jeton()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw Object.assign(new Error(`GitHub ${res.status}`), { status: res.status });
  return res.json();
}

function coffreGitHub() {
  const corps = () => ({
    description: 'Mes Mots — sauvegarde automatique',
    files: { [FICHIER_GIST]: { content: JSON.stringify(contenu(), null, 2) } },
  });

  // Retrouve la sauvegarde du compte à partir du seul jeton
  const chercher = async () => {
    const gists = await gh('/gists?per_page=100');
    const trouve = (gists || []).find(g => g.files && g.files[FICHIER_GIST]);
    return trouve ? trouve.id : '';
  };

  return {
    type: 'github',
    async pousser() {
      let id = store.get(CLES.gist, '') || (await chercher());
      try {
        const res = id
          ? await gh(`/gists/${id}`, { method: 'PATCH', body: JSON.stringify(corps()) })
          : await gh('/gists', { method: 'POST', body: JSON.stringify({ ...corps(), public: false }) });
        store.set(CLES.gist, res.id);
      } catch (err) {
        if (err.status !== 404) throw err;
        const res = await gh('/gists', { method: 'POST', body: JSON.stringify({ ...corps(), public: false }) });
        store.set(CLES.gist, res.id);
      }
      store.set(CLES.maj, Date.now());
    },
    async tirer() {
      const id = store.get(CLES.gist, '') || (await chercher());
      if (!id) return { ajoutes: 0, majs: 0, vide: true };
      store.set(CLES.gist, id);
      const g = await gh(`/gists/${id}`);
      const f = g.files && g.files[FICHIER_GIST];
      if (!f) return { ajoutes: 0, majs: 0, vide: true };
      const texte = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
      const res = fusionner(JSON.parse(texte).mots);
      store.set(CLES.maj, Date.now());
      return res;
    },
  };
}

function erreur(err) {
  if (err && err.status === 401) return 'Jeton refusé par GitHub : vérifie qu\'il est copié en entier.';
  if (err && err.status === 403) return 'GitHub a refusé : la case « gist » est-elle cochée sur le jeton ?';
  return 'Sauvegarde en ligne impossible pour l\'instant. Tes mots restent sur cet appareil.';
}

function afficherSauvegarde(etat) {
  const el = $('sauvegarde');
  $('bloc-github').hidden = surClaude;
  $('oublier-sync').hidden = !jeton();
  $('activer-sync').textContent = jeton() ? 'Mettre à jour le jeton' : 'Activer';

  if (etat) { el.textContent = etat; return; }

  if (!coffre) {
    el.textContent = surClaude && !coffreResolu
      ? 'Connexion à ta sauvegarde...'
      : 'Sauvegarde sur cet appareil seulement';
    return;
  }

  const quand = store.get(CLES.maj, 0);
  if (!quand) { el.textContent = '☁️ Sauvegarde en ligne activée'; return; }
  const min = Math.round((Date.now() - quand) / 60000);
  el.textContent = min < 1 ? '☁️ Sauvegardé à l\'instant' : `☁️ Sauvegardé il y a ${min} min`;
}

async function synchroniser({ silencieux = true } = {}) {
  if (!coffre || enCours) return;
  enCours = true;
  afficherSauvegarde('Synchronisation...');
  try {
    const res = await coffre.tirer();
    await coffre.pousser();
    toutAfficher();
    if (!silencieux) {
      message($('foot-flash'), res.vide
        ? 'Sauvegarde en ligne activée ✅'
        : `Synchronisé ✅ (${res.ajoutes} mot(s) récupéré(s))`);
    }
  } catch (err) {
    if (!silencieux) message($('foot-flash'), erreur(err), 'warn');
  } finally {
    enCours = false;
    afficherSauvegarde();
  }
}

// Sauvegarde automatique, groupée, après chaque modification
function planifierSauvegarde() {
  if (!coffre) return;
  clearTimeout(minuterie);
  minuterie = setTimeout(async () => {
    if (enCours) return;
    enCours = true;
    afficherSauvegarde('Sauvegarde...');
    try { await coffre.pousser(); } catch {}
    finally { enCours = false; afficherSauvegarde(); }
  }, 2000);
}

async function initSauvegarde() {
  if (!surClaude) {
    coffreResolu = true;
    if (jeton()) coffre = coffreGitHub();
    afficherSauvegarde();
    if (coffre) synchroniser();
    return;
  }
  afficherSauvegarde();
  const db = await capacite('db');
  coffreResolu = true;
  if (db) coffre = coffreClaude(db);
  afficherSauvegarde();
  if (coffre) synchroniser();
}

// ---------- Fichier ----------
async function exporter() {
  const texte = JSON.stringify(contenu(), null, 2);
  const nom = `mes-mots-${new Date().toISOString().slice(0, 10)}.json`;

  const downloads = await capacite('downloads');
  if (downloads) {
    try { await downloads.save({ filename: nom, data: texte }); message($('foot-flash'), 'Fichier enregistré ✅'); }
    catch { message($('foot-flash'), 'Export annulé.', 'warn'); }
    return;
  }

  const url = URL.createObjectURL(new Blob([texte], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
  message($('foot-flash'), 'Fichier enregistré ✅');
}

function importer(fichier) {
  const lecteur = new FileReader();
  lecteur.onload = () => {
    try {
      const data = JSON.parse(lecteur.result);
      if (!data || !data.mots) throw new Error('format');
      const { ajoutes, majs } = fusionner(data.mots);
      message($('foot-flash'), `${ajoutes} mot(s) importé(s), ${majs} mis à jour ✅`);
      toutAfficher();
      planifierSauvegarde();
    } catch {
      message($('foot-flash'), 'Fichier illisible.', 'warn');
    }
  };
  lecteur.readAsText(fichier);
}

// ---------- Langue et rendu ----------
function choisirLangue(code) {
  if (!LANGUES[code]) return;
  langue = code;
  store.set(CLES.langue, code);
  devoiles.clear();
  document.querySelectorAll('#langues .chip').forEach(c =>
    c.classList.toggle('active', c.dataset.lang === code));
  $('mot').placeholder = `Mot en ${L().adjectif}`;
  $('liste-titre').textContent = `Mes mots en ${L().adjectif}`;
  toutAfficher();
}

function toutAfficher() {
  afficherMots();
  afficherJour();
  nouvelleSerie();
}

// ---------- Interactions ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'revision') nouvelleSerie();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

$('langues').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (chip) choisirLangue(chip.dataset.lang);
});

$('add-form').addEventListener('submit', e => {
  e.preventDefault();
  const mot = $('mot').value.trim();
  const trad = $('trad').value.trim();
  if (!mot || !trad) return;
  if (ajouterMot(mot, trad)) {
    message($('add-flash'), `« ${mot} » ajouté ✅`);
    $('add-form').reset();
    $('mot').focus();
    afficherMots();
  } else {
    message($('add-flash'), 'Ce mot est déjà dans ta liste.', 'warn');
  }
});

$('recherche').addEventListener('input', afficherMots);

$('toggle-trad').addEventListener('click', () => {
  masque = !masque;
  devoiles.clear();
  store.set(CLES.masque, masque);
  afficherMots();
});

$('mots').addEventListener('click', e => {
  const voir = e.target.closest('[data-voir]');
  if (voir) { devoiles.add(voir.dataset.voir); return afficherMots(); }

  const dire = e.target.closest('[data-dire]');
  if (dire) return parler(dire.dataset.dire);

  const suppr = e.target.closest('[data-suppr]');
  if (suppr) {
    const id = e.target.closest('.word-item').dataset.id;
    confirmer(suppr, 'Supprimer ?', () => { supprimerMot(id); afficherMots(); });
  }
});

$('voir-trad').addEventListener('click', e => {
  $('bloc-trad').hidden = false;
  e.target.hidden = true;
});

$('ecouter-phrase').addEventListener('click', e => parler(e.target.dataset.dire));

$('ajouter-phrase').addEventListener('click', e => {
  const b = e.target;
  if (ajouterMot(b.dataset.mot, b.dataset.trad, b.dataset.note)) {
    message($('phrase-flash'), 'Phrase ajoutée à tes mots ✅');
    afficherMots();
  } else {
    message($('phrase-flash'), 'Elle est déjà dans ta liste.', 'warn');
  }
});

$('lecon-exemples').addEventListener('click', e => {
  const dire = e.target.closest('[data-dire]');
  if (dire) parler(dire.dataset.dire);
});

$('reveler').addEventListener('click', revelerCarte);
$('su').addEventListener('click', () => noter(true));
$('rate').addEventListener('click', () => noter(false));
$('rejouer').addEventListener('click', nouvelleSerie);
$('sens').addEventListener('change', nouvelleSerie);
$('ecouter-mot').addEventListener('click', e => parler(e.target.dataset.dire));

document.addEventListener('keydown', e => {
  if (!$('revision').classList.contains('active') || $('carte').hidden) return;
  if (e.target.matches('input, select, textarea')) return;
  if (e.code === 'Space' && !serie.vue) { e.preventDefault(); revelerCarte(); }
  else if (serie.vue && (e.key === '1' || e.key === 'ArrowLeft')) noter(false);
  else if (serie.vue && (e.key === '2' || e.key === 'ArrowRight')) noter(true);
});

$('exporter').addEventListener('click', exporter);
$('importer').addEventListener('click', () => $('fichier').click());
$('fichier').addEventListener('change', e => {
  if (e.target.files[0]) importer(e.target.files[0]);
  e.target.value = '';
});

$('activer-sync').addEventListener('click', async () => {
  const valeur = $('jeton').value.trim();
  if (!valeur) return message($('foot-flash'), 'Colle d\'abord ton jeton GitHub.', 'warn');
  store.set(CLES.jeton, valeur);
  $('jeton').value = '';
  coffre = coffreGitHub();
  afficherSauvegarde();
  await synchroniser({ silencieux: false });
});

$('oublier-sync').addEventListener('click', e => {
  confirmer(e.currentTarget, 'Confirmer ?', () => {
    store.remove(CLES.jeton);
    store.remove(CLES.maj);
    coffre = null;
    afficherSauvegarde();
    message($('foot-flash'), 'Jeton oublié. La sauvegarde en ligne reste intacte.', 'warn');
  });
});

// ---------- Démarrage ----------
choisirLangue(langue);
initSauvegarde();

// Uniquement pour la version installable (celle qui embarque un manifeste)
if ('serviceWorker' in navigator && document.querySelector('link[rel="manifest"]')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
