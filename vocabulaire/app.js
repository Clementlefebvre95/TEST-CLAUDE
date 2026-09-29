// ============================================================
// Mes Mots — « Voyage »
// Trois pages : mes mots · le voyage (escales de vocabulaire, phrase
// et leçon du jour) · les jeux. Chaque bonne réponse fait avancer de
// 10 km ; chaque escale réussie reçoit un tampon.
// ============================================================

const LANGUES = {
  en: { adjectif: 'anglais', nom: 'Anglais', voix: 'en-GB', lecons: LESSONS_EN, phrases: SENTENCES_EN, themes: THEMES_EN },
  es: { adjectif: 'espagnol', nom: 'Espagnol', voix: 'es-ES', lecons: LESSONS_ES, phrases: SENTENCES_ES, themes: THEMES_ES },
};

const CLES = {
  langue: 'voc_last_lang',
  mots: code => `voc_words_${code}`,
  lecons: code => `voc_lecons_${code}`,     // leçons du jour enregistrées
  tampons: code => `voc_tampons_${code}`,   // escales réussies : { idTheme: date }
  voyage: 'voc_voyage',                     // { km, serie, dernierJour }
  masque: 'voc_masque',
  jeton: 'voc_gh_token',
  gist: 'voc_gh_gist',
  maj: 'voc_sync_last',
};

const NIVEAU_MAX = 5;         // un mot est « su » au niveau 5
const SEUIL_RECHERCHE = 12;   // la recherche n'apparaît qu'au-delà
const KM_PAR_BONNE = 10;
const SEUIL_TAMPON = 0.75;    // 75 % de bonnes réponses pour tamponner une escale
const ARTICLES = /^(el|la|los|las|un|una|unos|unas|the|a|an|to)\s+/i;

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
let langue = LANGUES[store.get(CLES.langue, 'es')] ? store.get(CLES.langue, 'es') : 'es';
let page = 'mots';
let masque = store.get(CLES.masque, false);
let devoiles = new Set();
let ouvert = null;              // ligne de mot dont les actions sont dépliées
let sousPage = 'carte';         // sous-onglet du voyage
let themeOuvert = null;         // escale ouverte en carte postale
let leconOuverte = null;        // leçon enregistrée rouverte (null = celle du jour)
let partie = null;              // jeu en cours

const L = () => LANGUES[langue];

// ---------- Utilitaires ----------
const html = t => String(t ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function melanger(liste) {
  const l = [...liste];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

// Entier qui augmente de 1 par jour
function numeroDuJour(decalage = 0) {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + decalage);
  return Math.round((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

function duJour(liste, decalage) {
  const n = numeroDuJour() + decalage;
  return liste[((n % liste.length) + liste.length) % liste.length];
}

const dateCourte = ms => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const km = n => `${n.toLocaleString('fr-FR')} km`;

function message(el, texte, type = 'ok') {
  el.textContent = texte;
  el.className = `message ${type === 'warn' ? 'warn' : ''}`;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 2800);
}

function parler(texte) {
  if (!texte || !('speechSynthesis' in window)) return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = L().voix;
    u.rate = 0.9;
    speechSynthesis.speak(u);
    return true;
  } catch { return false; }
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

// ============================================================
// Les mots
// ============================================================
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
      if (!deja) { locaux.push(m); index.set(m.mot.toLowerCase(), m); ajoutes++; return; }
      const avant = JSON.stringify(deja);
      deja.niveau = Math.max(deja.niveau, m.niveau);
      deja.vus = Math.max(deja.vus || 0, m.vus);
      deja.bons = Math.max(deja.bons || 0, m.bons);
      deja.cree = Math.min(deja.cree || Date.now(), m.cree);
      deja.revu = Math.max(deja.revu || 0, m.revu || 0) || null;
      if (!deja.note && m.note) deja.note = m.note;
      if (JSON.stringify(deja) !== avant) majs++;
    });
    store.set(CLES.mots(code), locaux);
  });
  return { ajoutes, majs };
}

// ============================================================
// Les leçons du jour enregistrées (rangées à part des mots)
// Retirer une leçon la marque « retirée » plutôt que de l'effacer :
// la modification la plus récente l'emporte entre deux appareils.
// ============================================================
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
  const t = Date.now();
  if (deja && !deja.retiree) { deja.retiree = true; deja.maj = t; }
  else if (deja) Object.assign(deja, { retiree: false, gardee: t, maj: t, categorie: lecon.categorie });
  else liste.push({ titre: lecon.titre, categorie: lecon.categorie, gardee: t, maj: t, retiree: false });
  ecrireLecons(liste);
  return !(deja && !deja.retiree);
}

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

// ============================================================
// Le voyage : tampons, kilomètres, jours d'affilée
// ============================================================
const lireTampons = (code = langue) => store.get(CLES.tampons(code), {}) || {};

function tamponner(idTheme) {
  const t = lireTampons();
  if (t[idTheme]) return false;
  t[idTheme] = Date.now();
  store.set(CLES.tampons(langue), t);
  planifierSauvegarde();
  return true;
}

const lireVoyage = () => ({ km: 0, serie: 0, dernierJour: null, ...store.get(CLES.voyage, {}) });

function ajouterKm(n) {
  const v = lireVoyage();
  v.km += n;
  store.set(CLES.voyage, v);
}

// Un jour compte dès qu'une partie est terminée
function marquerJour() {
  const v = lireVoyage();
  const aujourdhui = numeroDuJour();
  if (v.dernierJour === aujourdhui) return;
  v.serie = v.dernierJour === aujourdhui - 1 ? (v.serie || 0) + 1 : 1;
  v.dernierJour = aujourdhui;
  store.set(CLES.voyage, v);
}

// Série affichée : remise à zéro si un jour a été manqué
function serieActuelle() {
  const v = lireVoyage();
  return v.dernierJour !== null && v.dernierJour >= numeroDuJour() - 1 ? v.serie : 0;
}

function fusionnerVoyage(entrant) {
  if (!entrant || typeof entrant !== 'object') return;
  const v = lireVoyage();
  v.km = Math.max(v.km || 0, Number(entrant.km) || 0);
  if ((Number(entrant.dernierJour) || 0) > (v.dernierJour || 0)) {
    v.dernierJour = Number(entrant.dernierJour);
    v.serie = Number(entrant.serie) || 0;
  }
  store.set(CLES.voyage, v);
  ['en', 'es'].forEach(code => {
    const venus = entrant.tampons?.[code];
    if (!venus || typeof venus !== 'object') return;
    const locaux = lireTampons(code);
    Object.entries(venus).forEach(([id, date]) => {
      const d = Number(date);
      if (d && (!locaux[id] || d < locaux[id])) locaux[id] = d;
    });
    store.set(CLES.tampons(code), locaux);
  });
}

const contenu = () => {
  const v = lireVoyage();
  return {
    format: 'mes-mots-v2',
    exporte: new Date().toISOString(),
    mots: { en: lireMots('en'), es: lireMots('es') },
    lecons: { en: lireLecons('en'), es: lireLecons('es') },
    voyage: { km: v.km, serie: v.serie, dernierJour: v.dernierJour, tampons: { en: lireTampons('en'), es: lireTampons('es') } },
  };
};

const themeParId = id => L().themes.find(t => t.id === id);
const prochaineEscale = () => L().themes.find(t => !lireTampons()[t.id]) || null;

// ============================================================
// Page 1 : mes mots
// ============================================================
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

  $('liste-mots').innerHTML = visibles.map(m => {
    const cache = masque && !devoiles.has(m.id);
    return `
      <li class="ligne" data-id="${m.id}">
        <div class="ligne-haut">
          <span class="cote source">${m.niveau >= NIVEAU_MAX ? '<span class="pastille-su" title="Su"></span>' : ''}${html(m.mot)}</span>
          <span class="filet"></span>
          <span class="cote trad ${cache ? 'cachee' : ''}" ${cache ? `data-voir="${m.id}"` : ''}>${cache ? '• • •' : html(m.trad)}</span>
        </div>
        ${m.note && !cache ? `<p class="note">${html(m.note)}</p>` : ''}
        ${ouvert === m.id ? `
        <div class="ligne-actions">
          <button class="discret" data-dire="${html(m.mot)}">écouter</button>
          <button class="discret" data-suppr="1">supprimer</button>
        </div>` : ''}
      </li>`;
  }).join('');

  if (liste.length && !visibles.length) $('liste-mots').innerHTML = '<li class="vide">Aucun mot ne correspond.</li>';
}

// ============================================================
// Page 2 : le voyage
// ============================================================
function afficherVoyage() {
  const tampons = lireTampons();
  const nbTampons = Object.keys(tampons).length;
  const serie = serieActuelle();
  $('voyage-sous').textContent = `${L().nom} · ${nbTampons} tampon${nbTampons > 1 ? 's' : ''} sur ${L().themes.length}`
    + (serie ? ` · ${serie} jour${serie > 1 ? 's' : ''} d'affilée` : '');

  const onglet = sousPage === 'postale' ? 'carte' : sousPage;
  document.querySelectorAll('.sous-btn').forEach(b => b.classList.toggle('active', b.dataset.sous === onglet));
  document.querySelectorAll('.sous-vue').forEach(v => v.classList.toggle('active', v.id === `sv-${sousPage}`));
  $('nb-gardees').textContent = leconsGardees().length || '';

  afficherCarte();
  afficherPostale();
  afficherPhrase();
  afficherLeconDuJour();
  afficherGardees();
}

// Les escales, reliées par un chemin en pointillés
function afficherCarte() {
  const themes = L().themes;
  const tampons = lireTampons();
  const prochaine = prochaineEscale();

  $('prochaine').innerHTML = prochaine
    ? `<div><small>Prochaine escale</small><b>${html(prochaine.titre)}</b></div>
       <button class="bouton terre" data-theme="${prochaine.id}">Partir</button>`
    : `<div><small>Voyage terminé</small><b>Toutes les escales sont tamponnées</b></div>`;

  const L0 = 320, pas = 92, haut = 46;
  const xs = [78, 236, 130, 250, 70, 200];
  const points = themes.map((t, i) => ({ t, x: xs[i % xs.length], y: haut + i * pas }));
  const hauteur = haut + (themes.length - 1) * pas + 60;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    d += ` C ${a.x} ${a.y + pas * 0.55}, ${b.x} ${b.y - pas * 0.55}, ${b.x} ${b.y}`;
  }

  const coche = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const etoile = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 16l-6.5 5 2-7.5L2 9h7z" fill="#1d3557"/></svg>';

  $('carte-voyage').style.height = `${hauteur}px`;
  $('carte-voyage').innerHTML = `
    <svg class="chemin" width="${L0}" height="${hauteur}" viewBox="0 0 ${L0} ${hauteur}" aria-hidden="true">
      <path d="${d}" fill="none" stroke="#1d3557" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round" opacity=".35"/>
    </svg>
    ${points.map(({ t, x, y }, i) => {
      const faite = Boolean(tampons[t.id]);
      const ici = prochaine && prochaine.id === t.id;
      const etat = faite ? 'faite' : ici ? 'ici' : 'loin';
      const gauche = x > L0 / 2;
      const style = gauche ? `right:${L0 - x - 21}px; top:${y - 21}px;` : `left:${x - 21}px; top:${y - 21}px;`;
      return `<button class="escale ${etat} ${gauche ? 'gauche' : ''}" style="${style}" data-theme="${t.id}">
        <span class="rond">${faite ? coche : ici ? etoile : `<small style="font-size:12px;font-weight:800;color:#5b6f8c">${i + 1}</small>`}</span>
        <span class="nom"><span>${html(t.titre)}</span><small>${faite ? 'tamponné le ' + dateCourte(tampons[t.id]) : '10 mots'}</small></span>
      </button>`;
    }).join('')}`;
}

// Une escale ouverte, en carte postale
function afficherPostale() {
  const t = themeOuvert && themeParId(themeOuvert);
  if (!t) return;
  const date = lireTampons()[t.id];
  const index = L().themes.indexOf(t) + 1;

  $('postale-num').textContent = `Carte postale n° ${index}`;
  $('postale-titre').textContent = t.titre;
  $('postale-accroche').textContent = t.accroche;
  $('timbre').className = `timbre ${date ? 'pose' : 'vide'}`;
  $('timbre').innerHTML = date
    ? `<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" fill="#fffdf8"/><circle cx="12" cy="9.5" r="2.5" fill="#f4a261"/></svg>
       <span class="cachet">Tamponné<br>${dateCourte(date)}</span>`
    : `<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="9.5" r="2.3" fill="currentColor"/></svg><span>à gagner</span>`;
  $('postale-mots').innerHTML = t.mots.map(([src, fr]) =>
    `<span class="es" data-dire="${html(src)}">${html(src)}</span><span class="fr">${html(fr)}</span>`).join('');
  $('jouer-theme').textContent = date ? 'Rejouer cette escale' : 'Jouer et tamponner';
}

function afficherPhrase() {
  const phrase = duJour(L().phrases, langue === 'es' ? 11 : 3);
  const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('date').textContent = `Phrase du ${d}`;
  if ($('phrase').dataset.dire !== phrase.src) {     // nouvelle phrase : traduction de nouveau cachée
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
}

const leconDuJour = () => duJour(L().lecons, langue === 'es' ? 7 : 0);

function afficherLeconDuJour() {
  const rouverte = leconOuverte && L().lecons.find(l => l.titre === leconOuverte);
  if (leconOuverte && !rouverte) leconOuverte = null;
  const lecon = rouverte || leconDuJour();

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
      <table>${lecon.tableau.lignes.map(([g, d]) => `<tr><th>${html(g)}</th><td>${html(d)}</td></tr>`).join('')}</table>
    </div>` : '';

  if ($('lecon-plus').dataset.titre !== lecon.titre) $('lecon-plus').open = false;
  $('lecon-plus').dataset.titre = lecon.titre;
  $('lecon-exemples').innerHTML = lecon.exemples.map(ex => `
    <div class="exemple" data-dire="${html(ex.src)}"><p class="src">${html(ex.src)}</p><p class="fr">${html(ex.fr)}</p></div>`).join('');
  $('lecon-astuce').textContent = lecon.astuce || '';
  $('lecon-astuce').hidden = !lecon.astuce;
  $('lecon-points').innerHTML = lecon.points.map(p => `<li>${html(p)}</li>`).join('');
}

function afficherGardees() {
  const gardees = leconsGardees();
  $('gardees-vide').hidden = gardees.length > 0;
  $('gardees').innerHTML = gardees.map(l => `
    <li data-titre="${html(l.titre)}">
      <span class="titre-gardee">${html(l.titre)}</span>
      <span class="meta-gardee">${html(l.categorie)} · ${dateCourte(l.gardee)}</span>
    </li>`).join('');
}

// ============================================================
// Page 3 : jouer
// ============================================================
// Tous les mots des escales, pour compléter les choix des jeux
const motsDesThemes = () => L().themes.flatMap(t => t.mots.map(([src, fr]) => ({ src, fr })));

// Les mots d'une partie : ceux d'une escale, sinon les miens (les moins sûrs
// d'abord), sinon ceux des escales si j'en ai trop peu
function sourceDeJeu(idTheme) {
  if (idTheme) {
    const t = themeParId(idTheme);
    return { paires: t.mots.map(([src, fr]) => ({ src, fr })), theme: t };
  }
  const miens = lireMots()
    .sort((a, b) => a.niveau - b.niveau || (a.revu || 0) - (b.revu || 0))
    .map(m => ({ src: m.mot, fr: m.trad, id: m.id }));
  if (miens.length >= 4) return { paires: miens, theme: null };
  return { paires: motsDesThemes(), theme: null, secours: true };
}

function afficherJouer() {
  const v = lireVoyage();
  const serie = serieActuelle();
  $('jouer-sous').textContent = `${km(v.km)} parcourus` + (serie ? ` · ${serie} jour${serie > 1 ? 's' : ''} d'affilée` : '');
  const nb = lireMots().length;
  $('note-source').hidden = nb >= 4;
  $('note-source').textContent = nb === 0
    ? `Tu n'as pas encore de mots à toi : les jeux utilisent ceux des escales du voyage.`
    : `Avec ${nb} mot${nb > 1 ? 's' : ''} seulement, les jeux piochent aussi dans les escales du voyage.`;
}

// Des choix plausibles : d'autres mots de la même source, puis des escales
function leurres(cible, cle, nombre, source) {
  const vus = new Set([cible[cle].toLowerCase()]);
  const choix = [];
  for (const p of [...melanger(source), ...melanger(motsDesThemes())]) {   // la même source d'abord
    const v = p[cle].toLowerCase();
    if (vus.has(v)) continue;
    vus.add(v);
    choix.push(p[cle]);
    if (choix.length === nombre) break;
  }
  return choix;
}

const sansArticle = src => src.replace(ARTICLES, '');
const motsPourLettres = paires => paires.filter(p => {
  const base = sansArticle(p.src);
  return /^\p{L}+$/u.test(base) && base.length >= 3 && base.length <= 10;
});

function lancerJeu(type, idTheme = null) {
  const source = sourceDeJeu(idTheme);
  // Mes mots : les 16 moins sûrs, dans le désordre. Escales : tout mélangé.
  let paires = source.theme || source.secours
    ? melanger(source.paires)
    : melanger(source.paires.slice(0, 16));

  if (type === 'lettres') {
    paires = motsPourLettres(paires);
    if (paires.length < 3) paires = motsPourLettres(melanger(motsDesThemes()));
  }
  if (type === 'ecoute' && !('speechSynthesis' in window)) {
    $('note-source').hidden = false;
    $('note-source').textContent = 'Ton navigateur ne sait pas lire à voix haute : essaie un autre jeu.';
    return;
  }

  const total = { quiz: 8, paires: 6, lettres: 6, ecoute: 8 }[type];
  const tours = paires.slice(0, Math.min(total, paires.length));

  partie = { type, theme: source.theme, source: paires, tours, i: 0, resultats: [], verrou: false };
  $('partie').hidden = false;
  $('plus').hidden = true;
  document.body.style.overflow = 'hidden';

  if (type === 'paires') preparerPaires();
  if (type === 'lettres') preparerLettres();
  afficherTour();
}

function fermerPartie() {
  partie = null;
  $('partie').hidden = true;
  document.body.style.overflow = '';
  $('plus').hidden = page !== 'mots';
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  toutAfficher();
}

function afficherEtapes() {
  const n = partie.type === 'paires' ? partie.tours.length : partie.tours.length;
  const faits = partie.type === 'paires' ? partie.trouvees.size : partie.i;
  $('etapes').innerHTML = Array.from({ length: n }, (_, k) => {
    if (partie.type === 'paires') return `<i class="${k < faits ? 'ok' : ''}"></i>`;
    const r = partie.resultats[k];
    return `<i class="${r === true ? 'ok' : r === false ? 'ko' : k === faits ? 'ici' : ''}"></i>`;
  }).join('');
}

// Une réponse : fait progresser le mot s'il vient de ma liste, et le compteur
function noterReponse(paire, juste) {
  partie.resultats.push(juste);
  if (juste) ajouterKm(KM_PAR_BONNE);
  if (!paire.id) return;
  const m = lireMots().find(x => x.id === paire.id);
  if (!m) return;
  majMot(m.id, {
    niveau: juste ? Math.min(NIVEAU_MAX, m.niveau + 1) : Math.max(1, m.niveau - 1),
    vus: (m.vus || 0) + 1,
    bons: (m.bons || 0) + (juste ? 1 : 0),
    revu: Date.now(),
  });
}

function afficherTour() {
  afficherEtapes();
  afficherKm();
  if (partie.type === 'paires') return afficherPaires();
  if (partie.i >= partie.tours.length) return finPartie();
  if (partie.type === 'quiz') return afficherQuiz();
  if (partie.type === 'lettres') return afficherLettres();
  if (partie.type === 'ecoute') return afficherEcoute();
}

// ---------- Quiz éclair ----------
function afficherQuiz() {
  const cible = partie.tours[partie.i];
  const options = melanger([cible.fr, ...leurres(cible, 'fr', 3, partie.source)]);
  partie.options = options;
  $('partie-corps').innerHTML = `
    <div class="billet">
      <div class="billet-bandeau"><span>${langue.toUpperCase()} → FR</span><span>Question ${partie.i + 1} / ${partie.tours.length}</span></div>
      <div class="billet-mot"><small>Traduis</small><b data-dire="${html(cible.src)}">${html(cible.src)}</b></div>
      <div class="perfo"></div>
      <div class="portes">${options.map((o, k) =>
        `<button class="porte" data-choix="${k}"><i>PORTE ${'ABCD'[k]}</i>${html(o)}</button>`).join('')}</div>
    </div>`;
}

function repondreChoix(k, cle) {
  if (partie.verrou) return;
  partie.verrou = true;
  const cible = partie.tours[partie.i];
  const bonne = partie.options.indexOf(cible[cle]);
  const juste = k === bonne;
  const portes = $('partie-corps').querySelectorAll('.porte');
  portes.forEach(p => { p.disabled = true; });
  portes[bonne].classList.add('bonne');
  if (!juste) portes[k].classList.add('mauvaise');
  noterReponse(cible, juste);
  setTimeout(() => {
    partie.i++;
    partie.verrou = false;
    afficherTour();
  }, juste ? 650 : 1300);
}

// ---------- Écoute ----------
function afficherEcoute() {
  const cible = partie.tours[partie.i];
  const options = melanger([cible.src, ...leurres(cible, 'src', 3, partie.source)]);
  partie.options = options;
  $('partie-corps').innerHTML = `
    <div class="billet">
      <div class="billet-bandeau"><span>Écoute</span><span>${partie.i + 1} / ${partie.tours.length}</span></div>
      <div class="billet-mot">
        <small>Touche pour réécouter</small>
        <button class="ecouter-gros" id="reecouter" aria-label="Réécouter le mot">
          <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="#fff"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="perfo"></div>
      <div class="portes">${options.map((o, k) =>
        `<button class="porte" data-choix="${k}"><i>PORTE ${'ABCD'[k]}</i>${html(o)}</button>`).join('')}</div>
    </div>`;
  setTimeout(() => parler(cible.src), 250);
}

// ---------- Paires ----------
function preparerPaires() {
  partie.tuiles = melanger(partie.tours.flatMap((p, k) => [
    { k, texte: p.src, cote: 'src' },
    { k, texte: p.fr, cote: 'fr' },
  ]));
  partie.trouvees = new Set();
  partie.choisie = null;
  partie.erreurs = new Set();
}

function afficherPaires() {
  $('partie-corps').innerHTML = `
    <p class="consigne">Relie chaque mot à sa traduction</p>
    <div class="tuiles">${partie.tuiles.map((t, n) => {
      const trouvee = partie.trouvees.has(t.k);
      return `<button class="tuile ${t.cote} ${trouvee ? 'trouvee' : ''} ${partie.choisie === n ? 'choisie' : ''}"
        data-tuile="${n}" ${trouvee ? 'disabled' : ''}>${html(t.texte)}</button>`;
    }).join('')}</div>`;
}

function toucherTuile(n) {
  if (partie.verrou) return;
  const t = partie.tuiles[n];
  if (partie.trouvees.has(t.k)) return;
  if (t.cote === 'src') parler(t.texte);
  if (partie.choisie === null || partie.choisie === n) {
    partie.choisie = partie.choisie === n ? null : n;
    return afficherPaires();
  }
  const a = partie.tuiles[partie.choisie];
  if (a.cote === t.cote) { partie.choisie = n; return afficherPaires(); }

  if (a.k === t.k) {
    partie.trouvees.add(t.k);
    partie.choisie = null;
    noterReponse(partie.tours[t.k], !partie.erreurs.has(t.k));
    afficherEtapes();
    afficherKm();
    afficherPaires();
    if (partie.trouvees.size === partie.tours.length) setTimeout(finPartie, 450);
  } else {
    partie.erreurs.add(a.k);
    partie.erreurs.add(t.k);
    partie.verrou = true;
    const boutons = $('partie-corps').querySelectorAll('.tuile');
    boutons[partie.choisie].classList.add('erreur');
    boutons[n].classList.add('erreur');
    setTimeout(() => { partie.choisie = null; partie.verrou = false; afficherPaires(); }, 550);
  }
}

// ---------- Lettres mélangées ----------
function preparerLettres() {
  partie.tours = partie.tours.map(p => ({ ...p, base: sansArticle(p.src) }));
}

function nouveauMelange(mot) {
  const lettres = [...mot];
  for (let essai = 0; essai < 6; essai++) {
    const m = melanger(lettres);
    if (m.join('') !== mot) return m;
  }
  return lettres.reverse();
}

function afficherLettres() {
  const cible = partie.tours[partie.i];
  if (partie.lettresPour !== partie.i) {
    partie.lettresPour = partie.i;
    partie.tuilesLettres = nouveauMelange(cible.base.toLocaleLowerCase(langue));
    partie.placees = [];
  }
  const n = partie.tuilesLettres.length;
  const cases = Array.from({ length: n }, (_, k) => {
    const idx = partie.placees[k];
    const lettre = idx === undefined ? '' : partie.tuilesLettres[idx].toLocaleUpperCase(langue);
    return `<button class="case ${lettre ? 'remplie' : ''}" data-case="${k}" aria-label="Case ${k + 1}">${lettre}</button>`;
  }).join('');
  $('partie-corps').innerHTML = `
    <p class="consigne">Remets les lettres dans l'ordre</p>
    <p class="indice">« ${html(cible.fr)} »</p>
    <div class="cases" id="cases">${cases}</div>
    <div class="lettres">${partie.tuilesLettres.map((l, k) =>
      `<button class="lettre" data-lettre="${k}" ${partie.placees.includes(k) ? 'disabled' : ''}>${html(l.toLocaleUpperCase(langue))}</button>`).join('')}</div>
    <div class="sous-actions">
      <button class="lien" id="effacer-lettres">Tout effacer</button>
      <button class="lien" id="passer-mot">Passer</button>
    </div>`;
}

function poserLettre(k) {
  if (partie.verrou || partie.placees.includes(k)) return;
  partie.placees.push(k);
  afficherLettres();
  if (partie.placees.length === partie.tuilesLettres.length) verifierLettres();
}

function retirerLettre(position) {
  if (partie.verrou || partie.placees[position] === undefined) return;
  partie.placees.splice(position, 1);
  afficherLettres();
}

function verifierLettres() {
  const cible = partie.tours[partie.i];
  const propose = partie.placees.map(k => partie.tuilesLettres[k]).join('');
  const juste = propose === cible.base.toLocaleLowerCase(langue);
  partie.verrou = true;
  $('cases').classList.add(juste ? 'juste' : 'faux');
  if (juste) {
    parler(cible.src);
    noterReponse(cible, !partie.aide);
    setTimeout(() => { partie.i++; partie.aide = false; partie.verrou = false; afficherTour(); }, 900);
  } else {
    setTimeout(() => { partie.placees = []; partie.verrou = false; afficherLettres(); }, 650);
  }
}

function passerMot() {
  if (partie.verrou) return;
  const cible = partie.tours[partie.i];
  const lettres = [...cible.base.toLocaleLowerCase(langue)];
  const libres = partie.tuilesLettres.map((l, k) => k);
  partie.placees = lettres.map(l => {
    const k = libres.findIndex(x => x !== null && partie.tuilesLettres[x] === l);
    const idx = libres[k];
    libres[k] = null;
    return idx;
  });
  partie.verrou = true;
  afficherLettres();
  $('cases').classList.add('faux');
  noterReponse(cible, false);
  setTimeout(() => { partie.i++; partie.verrou = false; afficherTour(); }, 1400);
}

// ---------- Fin de partie ----------
function finPartie() {
  const bonnes = partie.resultats.filter(Boolean).length;
  const total = partie.tours.length;
  const gagnes = bonnes * KM_PAR_BONNE;
  marquerJour();

  let tampon = '';
  if (partie.theme && bonnes / total >= SEUIL_TAMPON) {
    if (tamponner(partie.theme.id)) tampon = `<span class="nouveau-tampon">Nouveau tampon : ${html(partie.theme.titre)}</span>`;
  }
  const reussi = bonnes / total >= SEUIL_TAMPON;
  const titre = bonnes === total ? 'Sans faute !' : reussi ? 'Bon voyage !' : 'Encore un effort';
  const conseil = partie.theme && !reussi
    ? `<p>Il faut ${Math.ceil(total * SEUIL_TAMPON)} bonnes réponses sur ${total} pour tamponner l'escale.</p>` : '';

  partie.fini = true;
  $('etapes').innerHTML = '';
  $('partie-corps').innerHTML = `
    <div class="fin">
      <div class="grand-cachet"><div><b>${bonnes}/${total}</b><small>${partie.theme ? html(partie.theme.titre) : 'Mes Mots'}</small></div></div>
      <h2>${titre}</h2>
      <p class="gain">+${km(gagnes)}</p>
      ${tampon}
      ${conseil}
      <div class="boutons">
        <button class="pilule" id="rejouer">Rejouer</button>
        <button class="bouton" id="terminer">Terminer</button>
      </div>
    </div>`;
  planifierSauvegarde();
}

function afficherKm() {
  $('km-valeur').textContent = km(lireVoyage().km);
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
      await Promise.all([
        ...['en', 'es'].flatMap(code => [
          db.doc(`mots/${code}`).set({ mots: c.mots[code], maj: Date.now() }),
          db.doc(`lecons/${code}`).set({ lecons: c.lecons[code], maj: Date.now() }),
        ]),
        db.doc('voyage/progres').set({ voyage: c.voyage, maj: Date.now() }),
      ]);
      store.set(CLES.maj, Date.now());
    },
    async tirer() {
      const codes = ['en', 'es'];
      const [snapsMots, snapsLecons, snapVoyage] = await Promise.all([
        Promise.all(codes.map(code => db.doc(`mots/${code}`).get())),
        Promise.all(codes.map(code => db.doc(`lecons/${code}`).get())),
        db.doc('voyage/progres').get(),
      ]);
      const mots = {}, lecons = {};
      let vide = true;
      codes.forEach((code, i) => {
        const dm = snapsMots[i].exists ? snapsMots[i].data() : null;
        const dl = snapsLecons[i].exists ? snapsLecons[i].data() : null;
        if (dm && Array.isArray(dm.mots)) { mots[code] = dm.mots; vide = false; }
        if (dl && Array.isArray(dl.lecons)) { lecons[code] = dl.lecons; vide = false; }
      });
      const dv = snapVoyage.exists ? snapVoyage.data() : null;
      if (dv && dv.voyage) { fusionnerVoyage(dv.voyage); vide = false; }
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
      fusionnerVoyage(data.voyage);
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
    $('sauvegarde').textContent = surClaude && !coffreResolu ? 'Connexion à ta sauvegarde…' : 'Tes mots sont enregistrés sur cet appareil.';
    return;
  }
  const quand = store.get(CLES.maj, 0);
  if (!quand) { $('sauvegarde').textContent = 'Sauvegarde en ligne active.'; return; }
  const min = Math.round((Date.now() - quand) / 60000);
  $('sauvegarde').textContent = min < 1 ? 'Sauvegardé en ligne à l\'instant.' : `Sauvegardé en ligne il y a ${min} min.`;
}

async function synchroniser({ silencieux = true } = {}) {
  if (!coffre || enCours) return;
  enCours = true;
  afficherSauvegarde('Synchronisation…');
  try {
    const res = await coffre.tirer();
    await coffre.pousser();
    toutAfficher();
    if (!silencieux) {
      message($('pied-message'), res.vide ? 'Sauvegarde en ligne activée.' : `Synchronisé : ${res.ajoutes} mot(s) récupéré(s).`);
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
    afficherSauvegarde('Sauvegarde…');
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
      fusionnerVoyage(data.voyage);
      message($('pied-message'), `${ajoutes} mot(s) importé(s), ${majs} mis à jour` + (lecons ? `, ${lecons} leçon(s).` : '.'));
      toutAfficher();
      planifierSauvegarde();
    } catch {
      message($('pied-message'), 'Fichier illisible.', 'warn');
    }
  };
  lecteur.readAsText(fichier);
}

// ============================================================
// Navigation et rendu
// ============================================================
function allerA(nouvelle) {
  page = nouvelle;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.querySelectorAll('.vue').forEach(v => v.classList.toggle('active', v.id === `page-${page}`));
  $('plus').hidden = page !== 'mots';
  if (page !== 'mots') basculerAjout(false);
  toutAfficher();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function choisirLangue(code) {
  if (!LANGUES[code]) return;
  langue = code;
  store.set(CLES.langue, code);
  devoiles.clear();
  leconOuverte = null;
  themeOuvert = null;
  if (sousPage === 'postale') sousPage = 'carte';
  document.querySelectorAll('.langue').forEach(b => b.classList.toggle('active', b.dataset.lang === code));
  $('mot').placeholder = `Mot en ${L().adjectif}`;
  toutAfficher();
}

function toutAfficher() {
  afficherKm();
  afficherMots();
  afficherVoyage();
  afficherJouer();
}

function ouvrirEscale(id) {
  themeOuvert = id;
  sousPage = 'postale';
  afficherVoyage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function basculerAjout(ouvrir) {
  const ouvre = ouvrir ?? $('ajout').hidden;
  $('ajout').hidden = !ouvre;
  $('plus').classList.toggle('ouvert', ouvre);
  $('plus').setAttribute('aria-label', ouvre ? 'Fermer' : 'Ajouter un mot');
  if (ouvre) $('mot').focus();
}

function ouvrirPanneau(ouvrir) {
  const montre = ouvrir ?? $('voile').hidden;
  $('voile').hidden = !montre;
  if (montre) afficherSauvegarde();
}

// ---------- Interactions ----------
document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => allerA(b.dataset.page)));
$('langues').addEventListener('click', e => {
  const b = e.target.closest('.langue');
  if (b) choisirLangue(b.dataset.lang);
});

// Mots
$('plus').addEventListener('click', () => basculerAjout());
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
  } else {
    message($('ajout-message'), 'Ce mot est déjà dans ta liste.', 'warn');
  }
});
$('recherche').addEventListener('input', afficherMots);
$('bascule-trad').addEventListener('click', () => {
  masque = !masque;
  devoiles.clear();
  store.set(CLES.masque, masque);
  afficherMots();
});
$('liste-mots').addEventListener('click', e => {
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
$('aller-voyage').addEventListener('click', () => { sousPage = 'carte'; allerA('voyage'); });

// Voyage
document.querySelectorAll('.sous-btn').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.sous === 'lecon' && sousPage === 'lecon') leconOuverte = null;
  sousPage = b.dataset.sous;
  afficherVoyage();
}));
$('page-voyage').addEventListener('click', e => {
  const escale = e.target.closest('[data-theme]');
  if (escale) return ouvrirEscale(escale.dataset.theme);
});
$('retour-carte').addEventListener('click', () => { sousPage = 'carte'; themeOuvert = null; afficherVoyage(); });
$('postale-mots').addEventListener('click', e => {
  const dire = e.target.closest('[data-dire]');
  if (dire) parler(dire.dataset.dire);
});
$('jouer-theme').addEventListener('click', () => lancerJeu('quiz', themeOuvert));
$('ajouter-theme').addEventListener('click', () => {
  const t = themeParId(themeOuvert);
  if (!t) return;
  let ajoutes = 0;
  [...t.mots].reverse().forEach(([src, fr]) => { if (ajouterMot(src, fr)) ajoutes++; });
  afficherMots();
  message($('postale-message'), ajoutes
    ? `${ajoutes} mot${ajoutes > 1 ? 's' : ''} ajouté${ajoutes > 1 ? 's' : ''} à ta liste.`
    : 'Ces mots sont déjà tous dans ta liste.', ajoutes ? 'ok' : 'warn');
});

$('phrase').addEventListener('click', e => parler(e.currentTarget.dataset.dire));
$('voir-trad').addEventListener('click', () => {
  const ouvre = $('bloc-trad').hidden;
  $('bloc-trad').hidden = !ouvre;
  $('voir-trad').textContent = ouvre ? 'Cacher la traduction' : 'Voir la traduction';
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
$('etoile').addEventListener('click', () => {
  const lecon = L().lecons.find(l => l.titre === $('etoile').dataset.titre);
  if (!lecon) return;
  const gardee = basculerGarde(lecon);
  afficherVoyage();
  message($('lecon-message'), gardee
    ? 'Leçon enregistrée. Tu la retrouves dans « Enregistrées ».'
    : 'Leçon retirée de tes leçons enregistrées.', gardee ? 'ok' : 'warn');
});
$('gardees').addEventListener('click', e => {
  const li = e.target.closest('li[data-titre]');
  if (!li) return;
  leconOuverte = li.dataset.titre;
  sousPage = 'lecon';
  afficherVoyage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('retour-lecon').addEventListener('click', () => { leconOuverte = null; afficherVoyage(); });

// Jouer
document.querySelectorAll('.billet-jeu').forEach(b => b.addEventListener('click', () => lancerJeu(b.dataset.jeu)));
$('quitter-partie').addEventListener('click', fermerPartie);
$('partie-corps').addEventListener('click', e => {
  if (!partie) return;
  if (e.target.closest('#terminer')) return fermerPartie();
  if (e.target.closest('#rejouer')) {
    const { type, theme } = partie;
    return lancerJeu(type, theme ? theme.id : null);
  }
  const choix = e.target.closest('[data-choix]');
  if (choix) return repondreChoix(Number(choix.dataset.choix), partie.type === 'ecoute' ? 'src' : 'fr');
  if (e.target.closest('#reecouter')) return parler(partie.tours[partie.i].src);
  const dire = e.target.closest('[data-dire]');
  if (dire) return parler(dire.dataset.dire);
  const tuile = e.target.closest('[data-tuile]');
  if (tuile) return toucherTuile(Number(tuile.dataset.tuile));
  const lettre = e.target.closest('[data-lettre]');
  if (lettre) return poserLettre(Number(lettre.dataset.lettre));
  const kase = e.target.closest('[data-case]');
  if (kase) return retirerLettre(Number(kase.dataset.case));
  if (e.target.closest('#effacer-lettres') && !partie.verrou) { partie.placees = []; return afficherLettres(); }
  if (e.target.closest('#passer-mot')) return passerMot();
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (partie) return fermerPartie();
  if (!$('voile').hidden) return ouvrirPanneau(false);
  if (!$('ajout').hidden) return basculerAjout(false);
});

// Réglages
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
