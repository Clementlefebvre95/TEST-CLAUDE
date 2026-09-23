// ============================================================
// Mes Mots — vocabulaire anglais / espagnol
// Trois pages : la liste, le contenu du jour, la révision.
// Tout tient dans le navigateur, et en ligne quand c'est possible.
// ============================================================

const LANGUES = {
  en: { adjectif: 'anglais', voix: 'en-GB', lecons: LESSONS_EN, phrases: SENTENCES_EN },
  es: { adjectif: 'espagnol', voix: 'es-ES', lecons: LESSONS_ES, phrases: SENTENCES_ES },
};

const CLES = {
  langue: 'voc_last_lang',
  mots: code => `voc_words_${code}`,
  lecons: code => `voc_lecons_${code}`,   // leçons enregistrées, rangées à part des mots
  masque: 'voc_masque',
  sens: 'voc_sens',
  jeton: 'voc_gh_token',
  gist: 'voc_gh_gist',
  maj: 'voc_sync_last',
};

const NIVEAU_MAX = 5;        // « su » à la 5e réussite d'affilée
const TAILLE_SERIE = 20;
const SEUIL_RECHERCHE = 12;  // la recherche n'apparaît qu'au-delà

const SENS = [
  { cle: 'src2fr', texte: 'Deviner le français' },
  { cle: 'fr2src', texte: 'Deviner le mot étranger' },
  { cle: 'mix', texte: 'Alterner les deux' },
];

const $ = id => document.getElementById(id);

// ---------- Stockage local ----------
const store = {
  get(cle, defaut) {
    try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; }
    catch { return defaut; }
  },
  set(cle, valeur) { try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch {} },
  remove(cle) { try { localStorage.removeItem(cle); } catch {} },
};

// ---------- État ----------
let langue = LANGUES[store.get(CLES.langue, 'en')] ? store.get(CLES.langue, 'en') : 'en';
let masque = store.get(CLES.masque, false);
let sens = SENS.some(s => s.cle === store.get(CLES.sens)) ? store.get(CLES.sens) : 'src2fr';
let devoiles = new Set();
let ouvert = null;              // ligne dont les actions sont dépliées
let sousPage = 'phrase';        // sous-onglet de « Du jour »
let leconOuverte = null;        // titre d'une leçon enregistrée rouverte (null = celle du jour)
let serie = { cartes: [], i: 0, vue: false, bons: 0 };

const L = () => LANGUES[langue];

// ---------- Utilitaires ----------
const html = t => String(t ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Entier qui augmente de 1 par jour : fait tourner leçon et phrase
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
  el.className = `message ${type === 'warn' ? 'warn' : ''}`;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 2600);
}

function parler(texte) {
  if (!texte || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = L().voix;
    u.rate = 0.9;
    speechSynthesis.speak(u);
  } catch {}
}

// Premier appui : le bouton demande confirmation. Second : on exécute.
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

const normaliser = m => ({
  id: m.id || uid(),
  mot: String(m.mot).trim(),
  trad: String(m.trad).trim(),
  note: String(m.note || '').trim(),
  niveau: Math.min(NIVEAU_MAX, Math.max(1, Number(m.niveau ?? m.box) || 1)),
  vus: Number(m.vus) || 0,
  bons: Number(m.bons) || 0,
  cree: Number(m.cree) || Date.now(),
  revu: Number(m.revu) || null,
});

// Fusion : rien n'est écrasé, chaque mot garde son meilleur niveau
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

// ---------- Les leçons enregistrées ----------
// Chaque entrée garde sa date de modification : retirer une leçon la marque
// « retirée » au lieu de l'effacer, pour que le retrait gagne aussi sur les
// autres appareils au lieu d'être annulé par leur copie.
const lireLecons = (code = langue) => {
  const l = store.get(CLES.lecons(code), []);
  return Array.isArray(l) ? l : [];
};

function ecrireLecons(liste, code = langue) {
  store.set(CLES.lecons(code), liste);
  planifierSauvegarde();
}

const leconsGardees = (code = langue) =>
  lireLecons(code).filter(l => !l.retiree).sort((a, b) => b.gardee - a.gardee);

const estGardee = titre => leconsGardees().some(l => l.titre === titre);

function basculerGarde(lecon) {
  const liste = lireLecons();
  const deja = liste.find(l => l.titre === lecon.titre);
  const maintenant = Date.now();
  if (deja && !deja.retiree) {
    deja.retiree = true;
    deja.maj = maintenant;
  } else if (deja) {
    Object.assign(deja, { retiree: false, gardee: maintenant, maj: maintenant, categorie: lecon.categorie });
  } else {
    liste.push({ titre: lecon.titre, categorie: lecon.categorie, gardee: maintenant, maj: maintenant, retiree: false });
  }
  ecrireLecons(liste);
  return !(deja && !deja.retiree);
}

// Pour chaque leçon, la version modifiée le plus récemment l'emporte
function fusionnerLecons(parLangue) {
  let changements = 0;
  ['en', 'es'].forEach(code => {
    const entrants = Array.isArray(parLangue?.[code]) ? parLangue[code] : [];
    if (!entrants.length) return;
    const locales = lireLecons(code);
    const index = new Map(locales.map(l => [l.titre, l]));
    entrants.forEach(l => {
      if (!l || !l.titre) return;
      const propre = {
        titre: String(l.titre),
        categorie: String(l.categorie || ''),
        gardee: Number(l.gardee) || Date.now(),
        maj: Number(l.maj) || Number(l.gardee) || 0,
        retiree: Boolean(l.retiree),
      };
      const deja = index.get(propre.titre);
      if (!deja) { locales.push(propre); index.set(propre.titre, propre); changements++; }
      else if (propre.maj > (deja.maj || 0)) { Object.assign(deja, propre); changements++; }
    });
    store.set(CLES.lecons(code), locales);
  });
  return changements;
}

const contenu = () => ({
  format: 'mes-mots-v1',
  exporte: new Date().toISOString(),
  mots: { en: lireMots('en'), es: lireMots('es') },
  lecons: { en: lireLecons('en'), es: lireLecons('es') },
});

// ---------- Page 1 : la liste ----------
function afficherMots() {
  const liste = lireMots();
  const recherche = $('recherche').value.toLowerCase().trim();
  const visibles = recherche
    ? liste.filter(m => (m.mot + ' ' + m.trad + ' ' + m.note).toLowerCase().includes(recherche))
    : liste;

  $('vide').hidden = liste.length > 0;
  $('recherche').hidden = liste.length < SEUIL_RECHERCHE;
  $('bascule-trad').hidden = liste.length === 0;
  $('bascule-trad').textContent = masque ? 'montrer les traductions' : 'cacher les traductions';

  $('mots').innerHTML = visibles.map(m => {
    const cache = masque && !devoiles.has(m.id);
    const ouverte = ouvert === m.id;
    return `
      <li class="ligne" data-id="${m.id}">
        <div class="ligne-haut">
          <span class="cote source">${
            m.niveau >= NIVEAU_MAX ? '<span class="pastille-su" title="Su"></span>' : ''
          }${html(m.mot)}</span>
          <span class="filet"></span>
          <span class="cote trad ${cache ? 'cachee' : ''}" ${
            cache ? `data-voir="${m.id}"` : ''}>${cache ? '• • •' : html(m.trad)}</span>
        </div>
        ${m.note && !cache ? `<p class="note">${html(m.note)}</p>` : ''}
        ${ouverte ? `
        <div class="ligne-actions">
          <button class="discret" data-dire="${html(m.mot)}">écouter</button>
          <button class="discret" data-suppr="1">supprimer</button>
        </div>` : ''}
      </li>`;
  }).join('');

  if (liste.length && !visibles.length) {
    $('mots').innerHTML = '<li class="vide">Aucun mot ne correspond.</li>';
  }
}

// ---------- Page 2 : le contenu du jour ----------
const leconDuJour = () => duJour(L().lecons, langue === 'es' ? 7 : 0);

function dateCourte(ms) {
  return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function afficherJour() {
  // Sous-onglets
  document.querySelectorAll('.sous-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.sous === sousPage));
  document.querySelectorAll('.sous-vue').forEach(v =>
    v.classList.toggle('active', v.id === `sv-${sousPage}`));
  const gardees = leconsGardees();
  $('nb-gardees').textContent = gardees.length || '';

  // Phrase
  const phrase = duJour(L().phrases, langue === 'es' ? 11 : 3);
  const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('date').textContent = d.charAt(0).toUpperCase() + d.slice(1);
  if ($('phrase').dataset.dire !== phrase.src) {         // nouvelle phrase : traduction de nouveau cachée
    $('bloc-trad').hidden = true;
    $('voir-trad').textContent = 'Voir la traduction';
  }
  $('phrase').textContent = phrase.src;
  $('phrase').dataset.dire = phrase.src;
  $('phrase-fr').textContent = phrase.fr;
  $('phrase-note').textContent = phrase.note || '';
  $('phrase-note').hidden = !phrase.note;
  $('ajouter-phrase').dataset.mot = phrase.src;
  $('ajouter-phrase').dataset.trad = phrase.fr;
  $('ajouter-phrase').dataset.note = phrase.note || '';

  // Leçon : celle du jour, ou une leçon enregistrée rouverte
  const rouverte = leconOuverte && L().lecons.find(l => l.titre === leconOuverte);
  if (leconOuverte && !rouverte) leconOuverte = null;
  const lecon = rouverte || leconDuJour();
  afficherLecon(lecon, Boolean(rouverte));

  // Leçons enregistrées
  $('gardees-vide').hidden = gardees.length > 0;
  $('gardees').innerHTML = gardees.map(l => `
    <li data-titre="${html(l.titre)}">
      <span class="titre-gardee">${html(l.titre)}</span>
      <span class="meta-gardee">${html(l.categorie)} · ${dateCourte(l.gardee)}</span>
    </li>`).join('');
}

function afficherLecon(lecon, rouverte) {
  $('retour-lecon').hidden = !rouverte;
  $('lecon-cat').textContent = rouverte ? lecon.categorie : `Leçon du jour · ${lecon.categorie}`;
  $('lecon-titre').textContent = lecon.titre;
  $('lecon-resume').textContent = lecon.resume;

  const gardee = estGardee(lecon.titre);
  $('etoile').setAttribute('aria-pressed', String(gardee));
  $('etoile').title = gardee ? 'Retirer des leçons enregistrées' : 'Enregistrer la leçon';
  $('etoile').setAttribute('aria-label', $('etoile').title);
  $('etoile').dataset.titre = lecon.titre;

  $('lecon-conj').innerHTML = lecon.tableau ? `
    <div class="conj">
      <p class="conj-titre">${html(lecon.tableau.titre)}</p>
      <table>${lecon.tableau.lignes.map(([g, d2]) =>
        `<tr><th>${html(g)}</th><td>${html(d2)}</td></tr>`).join('')}</table>
    </div>` : '';

  // Le détail reste replié à chaque changement de leçon
  if ($('lecon-plus').dataset.titre !== lecon.titre) $('lecon-plus').open = false;
  $('lecon-plus').dataset.titre = lecon.titre;

  $('lecon-exemples').innerHTML = lecon.exemples.map(ex => `
    <div class="exemple">
      <p class="src" data-dire="${html(ex.src)}">${html(ex.src)}</p>
      <p class="fr">${html(ex.fr)}</p>
    </div>`).join('');
  $('lecon-astuce').textContent = lecon.astuce || '';
  $('lecon-astuce').hidden = !lecon.astuce;
  $('lecon-points').innerHTML = lecon.points.map(p => `<li>${html(p)}</li>`).join('');
}

// ---------- Page 3 : la révision ----------
function nouvelleSerie() {
  const liste = lireMots();
  $('sens').textContent = SENS.find(s => s.cle === sens).texte;

  if (!liste.length) {
    $('carte').hidden = true;
    $('revision-vide').hidden = false;
    $('revision-vide').textContent = `Ajoute d'abord quelques mots en ${L().adjectif}.`;
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
    $('revision-vide').textContent = `Série terminée : ${serie.bons} sur ${total}.`;
    afficherMots();
    return;
  }

  const carte = serie.cartes[serie.i];
  const m = lireMots().find(x => x.id === carte.id);
  if (!m) { serie.i++; return afficherCarte(); }

  const versFr = carte.sens === 'src2fr';
  $('question').textContent = versFr ? m.mot : m.trad;
  $('question').dataset.dire = versFr ? m.mot : '';
  $('reponse-mot').textContent = versFr ? m.trad : m.mot;
  $('reponse-note').textContent = m.note || '';
  $('reponse-note').hidden = !m.note;

  $('reponse').hidden = true;
  $('reveler').hidden = false;
  $('notes-carte').hidden = true;
  serie.vue = false;

  $('avancement').textContent = `${serie.i + 1} / ${total}`
    + (serie.bons ? ` · ${serie.bons} bonne${serie.bons > 1 ? 's' : ''}` : '');
}

function revelerCarte() {
  serie.vue = true;
  $('reponse').hidden = false;
  $('reveler').hidden = true;
  $('notes-carte').hidden = false;
  const m = lireMots().find(x => x.id === serie.cartes[serie.i].id);
  if (m) $('question').dataset.dire = m.mot;   // la version étrangère est désormais connue
}

function noter(reussi) {
  const m = lireMots().find(x => x.id === serie.cartes[serie.i].id);
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
//  - page publiée comme Artifact Claude : stockage du compte ;
//  - page hébergée ailleurs : gist privé GitHub.
// ============================================================

const FICHIER_GIST = 'mes-mots.json';
const surClaude = Boolean(window.claude && typeof window.claude.use === 'function');

let coffre = null;
let coffreResolu = false;
let minuterie = null;
let enCours = false;

async function capacite(nom) {
  try { return surClaude ? await window.claude.use(nom) : null; }
  catch { return null; }
}

function coffreClaude(db) {
  return {
    async pousser() {
      const c = contenu();
      await Promise.all(['en', 'es'].flatMap(code => [
        db.doc(`mots/${code}`).set({ mots: c.mots[code], maj: Date.now() }),
        db.doc(`lecons/${code}`).set({ lecons: c.lecons[code], maj: Date.now() }),
      ]));
      store.set(CLES.maj, Date.now());
    },
    async tirer() {
      const codes = ['en', 'es'];
      const [snapsMots, snapsLecons] = await Promise.all([
        Promise.all(codes.map(code => db.doc(`mots/${code}`).get())),
        Promise.all(codes.map(code => db.doc(`lecons/${code}`).get())),
      ]);
      const mots = {}, lecons = {};
      let vide = true;
      codes.forEach((code, i) => {
        const dm = snapsMots[i].exists ? snapsMots[i].data() : null;
        const dl = snapsLecons[i].exists ? snapsLecons[i].data() : null;
        if (dm && Array.isArray(dm.mots)) { mots[code] = dm.mots; vide = false; }
        if (dl && Array.isArray(dl.lecons)) { lecons[code] = dl.lecons; vide = false; }
      });
      if (vide) return { ajoutes: 0, majs: 0, vide: true };
      const res = fusionner(mots);
      fusionnerLecons(lecons);
      store.set(CLES.maj, Date.now());
      return res;
    },
  };
}

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
    async pousser() {
      const id = store.get(CLES.gist, '') || (await chercher());
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
      const data = JSON.parse(texte);
      const res = fusionner(data.mots);
      fusionnerLecons(data.lecons);
      store.set(CLES.maj, Date.now());
      return res;
    },
  };
}

function erreur(err) {
  if (err && err.status === 401) return 'Jeton refusé par GitHub : vérifie qu\'il est copié en entier.';
  if (err && err.status === 403) return 'GitHub a refusé : la case « gist » est-elle cochée ?';
  return 'Sauvegarde en ligne impossible pour l\'instant. Tes mots restent sur cet appareil.';
}

function afficherSauvegarde(etat) {
  $('bloc-github').hidden = surClaude;
  $('oublier-sync').hidden = !jeton();
  $('activer-sync').textContent = jeton() ? 'Changer le jeton' : 'Activer';

  if (etat) { $('sauvegarde').textContent = etat; return; }

  if (!coffre) {
    $('sauvegarde').textContent = surClaude && !coffreResolu
      ? 'Connexion...'
      : 'Enregistré sur cet appareil';
    return;
  }

  const quand = store.get(CLES.maj, 0);
  if (!quand) { $('sauvegarde').textContent = 'Sauvegarde en ligne active'; return; }
  const min = Math.round((Date.now() - quand) / 60000);
  $('sauvegarde').textContent = min < 1 ? 'Sauvegardé à l\'instant' : `Sauvegardé il y a ${min} min`;
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
      message($('pied-message'), res.vide
        ? 'Sauvegarde en ligne activée.'
        : `Synchronisé : ${res.ajoutes} mot(s) récupéré(s).`);
    }
  } catch (err) {
    if (!silencieux) message($('pied-message'), erreur(err), 'warn');
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
    try { await downloads.save({ filename: nom, data: texte }); message($('pied-message'), 'Fichier enregistré.'); }
    catch { message($('pied-message'), 'Export annulé.', 'warn'); }
    return;
  }

  const url = URL.createObjectURL(new Blob([texte], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
  message($('pied-message'), 'Fichier enregistré.');
}

function importer(fichier) {
  const lecteur = new FileReader();
  lecteur.onload = () => {
    try {
      const data = JSON.parse(lecteur.result);
      if (!data || !data.mots) throw new Error('format');
      const { ajoutes, majs } = fusionner(data.mots);
      const lecons = fusionnerLecons(data.lecons);
      message($('pied-message'), `${ajoutes} mot(s) importé(s), ${majs} mis à jour`
        + (lecons ? `, ${lecons} leçon(s).` : '.'));
      toutAfficher();
      planifierSauvegarde();
    } catch {
      message($('pied-message'), 'Fichier illisible.', 'warn');
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
  leconOuverte = null;
  document.querySelectorAll('.langue').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === code));
  $('mot').placeholder = `Mot en ${L().adjectif}`;
  toutAfficher();
}

function toutAfficher() {
  afficherMots();
  afficherJour();
  nouvelleSerie();
}

// ---------- Interactions ----------
document.querySelectorAll('.page-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.page-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.vue').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.page).classList.add('active');
    // Le + ajoute un mot : il n'a sa place que sur la page des mots
    $('plus').hidden = btn.dataset.page !== 'liste';
    if (btn.dataset.page !== 'liste') basculerAjout(false);
    if (btn.dataset.page === 'revision') nouvelleSerie();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

$('langues').addEventListener('click', e => {
  const b = e.target.closest('.langue');
  if (b) choisirLangue(b.dataset.lang);
});

$('ajout').addEventListener('submit', e => {
  e.preventDefault();
  const mot = $('mot').value.trim();
  const trad = $('trad').value.trim();
  if (!mot || !trad) return;
  if (ajouterMot(mot, trad)) {
    message($('ajout-message'), `« ${mot} » ajouté.`);
    $('ajout').reset();
    $('mot').focus();
    afficherMots();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    message($('ajout-message'), 'Ce mot est déjà dans ta liste.', 'warn');
  }
});

function basculerAjout(ouvrir) {
  const ouvert = ouvrir ?? $('ajout').hidden;
  $('ajout').hidden = !ouvert;
  $('plus').classList.toggle('ouvert', ouvert);
  $('plus').textContent = ouvert ? '×' : '+';
  $('plus').title = ouvert ? 'Fermer' : 'Ajouter un mot';
  if (ouvert) $('mot').focus();
}

$('plus').addEventListener('click', () => basculerAjout());

$('recherche').addEventListener('input', afficherMots);

$('bascule-trad').addEventListener('click', () => {
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
    const id = e.target.closest('.ligne').dataset.id;
    return confirmer(suppr, 'confirmer ?', () => { ouvert = null; supprimerMot(id); afficherMots(); });
  }

  const ligne = e.target.closest('.ligne');
  if (!ligne) return;
  const m = lireMots().find(x => x.id === ligne.dataset.id);
  ouvert = ouvert === ligne.dataset.id ? null : ligne.dataset.id;
  afficherMots();
  if (m && ouvert) parler(m.mot);
});

$('phrase').addEventListener('click', e => parler(e.currentTarget.dataset.dire));

$('voir-trad').addEventListener('click', () => {
  const ouvrir = $('bloc-trad').hidden;
  $('bloc-trad').hidden = !ouvrir;
  $('voir-trad').textContent = ouvrir ? 'Cacher la traduction' : 'Voir la traduction';
});

document.querySelectorAll('.sous-btn').forEach(b => b.addEventListener('click', () => {
  sousPage = b.dataset.sous;
  if (sousPage === 'lecon' && b.classList.contains('active')) leconOuverte = null;
  afficherJour();
}));

$('etoile').addEventListener('click', () => {
  const titre = $('etoile').dataset.titre;
  const lecon = L().lecons.find(l => l.titre === titre);
  if (!lecon) return;
  const gardee = basculerGarde(lecon);
  afficherJour();
  message($('lecon-message'), gardee
    ? 'Leçon enregistrée. Tu la retrouves dans « Enregistrées ».'
    : 'Leçon retirée de tes leçons enregistrées.', gardee ? 'ok' : 'warn');
});

$('gardees').addEventListener('click', e => {
  const li = e.target.closest('li[data-titre]');
  if (!li) return;
  leconOuverte = li.dataset.titre;
  sousPage = 'lecon';
  afficherJour();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

$('retour-lecon').addEventListener('click', () => {
  leconOuverte = null;
  afficherJour();
});

$('ajouter-phrase').addEventListener('click', e => {
  const b = e.target;
  if (ajouterMot(b.dataset.mot, b.dataset.trad, b.dataset.note)) {
    message($('phrase-message'), 'Phrase ajoutée à tes mots.');
    afficherMots();
  } else {
    message($('phrase-message'), 'Elle est déjà dans ta liste.', 'warn');
  }
});

$('lecon-exemples').addEventListener('click', e => {
  const dire = e.target.closest('[data-dire]');
  if (dire) parler(dire.dataset.dire);
});

$('question').addEventListener('click', e => parler(e.currentTarget.dataset.dire));
$('reveler').addEventListener('click', revelerCarte);
$('su').addEventListener('click', () => noter(true));
$('rate').addEventListener('click', () => noter(false));
$('rejouer').addEventListener('click', nouvelleSerie);

$('sens').addEventListener('click', () => {
  const i = SENS.findIndex(s => s.cle === sens);
  sens = SENS[(i + 1) % SENS.length].cle;
  store.set(CLES.sens, sens);
  nouvelleSerie();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('voile').hidden) return ouvrirPanneau(false);
  if (e.key === 'Escape' && !$('ajout').hidden) return basculerAjout(false);
  if (!$('revision').classList.contains('active') || $('carte').hidden) return;
  if (e.target.matches('input, select, textarea')) return;
  if (e.code === 'Space' && !serie.vue) { e.preventDefault(); revelerCarte(); }
  else if (serie.vue && (e.key === '1' || e.key === 'ArrowLeft')) noter(false);
  else if (serie.vue && (e.key === '2' || e.key === 'ArrowRight')) noter(true);
});

function ouvrirPanneau(ouvrirLe) {
  const montrer = ouvrirLe ?? $('voile').hidden;
  $('voile').hidden = !montrer;
  if (montrer) afficherSauvegarde();
}

$('ouvrir-panneau').addEventListener('click', () => ouvrirPanneau());
$('fermer-panneau').addEventListener('click', () => ouvrirPanneau(false));
$('voile').addEventListener('click', e => { if (e.target === $('voile')) ouvrirPanneau(false); });

$('exporter').addEventListener('click', exporter);
$('importer').addEventListener('click', () => $('fichier').click());
$('fichier').addEventListener('change', e => {
  if (e.target.files[0]) importer(e.target.files[0]);
  e.target.value = '';
});

$('activer-sync').addEventListener('click', async () => {
  const valeur = $('jeton').value.trim();
  if (!valeur) return message($('pied-message'), 'Colle d\'abord ton jeton GitHub.', 'warn');
  store.set(CLES.jeton, valeur);
  $('jeton').value = '';
  coffre = coffreGitHub();
  afficherSauvegarde();
  await synchroniser({ silencieux: false });
});

$('oublier-sync').addEventListener('click', e => {
  confirmer(e.currentTarget, 'confirmer ?', () => {
    store.remove(CLES.jeton);
    store.remove(CLES.maj);
    coffre = null;
    afficherSauvegarde();
    message($('pied-message'), 'Jeton oublié. La sauvegarde en ligne reste intacte.', 'warn');
  });
});

// ---------- Démarrage ----------
choisirLangue(langue);
initSauvegarde();

// Seulement pour la version installable (celle qui embarque un manifeste)
if ('serviceWorker' in navigator && document.querySelector('link[rel="manifest"]')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
