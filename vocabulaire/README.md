# 📒 Mon Carnet de Vocabulaire

Application web (PWA) pour apprendre l'anglais et l'espagnol : on y note son vocabulaire au fil
de l'eau, et chaque jour l'app propose une leçon de grammaire et une phrase traduite.

## Ce que fait l'app

- **Deux langues** : anglais 🇬🇧 et espagnol 🇪🇸, chacune avec son propre carnet.
  La dernière langue utilisée est retrouvée automatiquement à l'ouverture suivante.
- **Leçon du jour** : une leçon différente chaque jour par langue (conjugaison, grammaire,
  vocabulaire) avec tableau de conjugaison, exemples traduits et astuce. 34 leçons par langue.
- **Phrase du jour** : une phrase authentique, sa traduction à dévoiler et une note d'usage.
  50 phrases par langue. Un bouton l'ajoute directement au carnet.
- **Carnet de vocabulaire** : ajout rapide, note ou exemple facultatif, recherche, tri, filtre,
  modification, suppression.
- **Révision** : cartes mémo avec système de boîtes (5 niveaux). Un mot réussi monte d'un niveau,
  un mot raté repart à 1 ; arrivé au niveau 5, il est marqué « maîtrisé ». Sens de révision au
  choix, raccourcis clavier (espace = révéler, 1 = à revoir, 2 = je savais).
- **Prononciation** : bouton 🔊 sur les mots et les phrases (synthèse vocale du navigateur).
- **Hors ligne** : installable sur l'écran d'accueil et utilisable sans connexion.

## Sauvegarde

Les données vivent dans le navigateur (`localStorage`), donc **sur ce téléphone uniquement**.
Deux façons de les emporter ailleurs :

1. **Sauvegarde en ligne (automatique)** — Réglages → Sauvegarde en ligne.
   Coller un jeton GitHub *classique* portant la seule autorisation `gist`
   ([créer le jeton](https://github.com/settings/tokens/new?scopes=gist&description=Carnet%20de%20vocabulaire)).
   Le carnet est alors écrit dans un gist **privé** du compte, mis à jour automatiquement après
   chaque modification. Sur un nouvel appareil, il suffit de coller le même jeton : l'app retrouve
   la sauvegarde toute seule et fusionne avec ce qui est déjà là (rien n'est écrasé, on garde le
   meilleur niveau de chaque mot).
   Le jeton ne quitte pas le navigateur et ne donne accès à aucun dépôt ; il est révocable sur GitHub.
2. **Fichier de sauvegarde (manuel)** — Réglages → Sauvegarde par fichier.
   Export en JSON, à ranger dans un cloud ou à s'envoyer par mail, puis réimport sur l'autre appareil.

## Lancer en local

```bash
npx http-server -p 8080     # puis ouvrir http://localhost:8080/vocabulaire/
```

Aucune dépendance, aucun build : HTML, CSS et JavaScript natifs.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | structure des 4 onglets |
| `styles.css` | mise en forme, thème de couleur par langue |
| `app.js` | logique : carnet, leçon du jour, révision, synchronisation |
| `data-en.js` / `data-es.js` | contenu pédagogique (leçons et phrases) |
| `sw.js`, `manifest.json`, `icon.svg` | installation et fonctionnement hors ligne |

## Ajouter du contenu

Les leçons et les phrases sont de simples tableaux dans `data-en.js` et `data-es.js`.
Ajouter une entrée suffit : la rotation quotidienne s'adapte à la longueur des tableaux.
