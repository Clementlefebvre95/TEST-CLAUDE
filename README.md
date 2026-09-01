# 📖 Mon Livre de Recettes

Un carnet de recettes personnel, simple, qui fonctionne dans le navigateur.
Aucun compte, aucun serveur : tout est enregistré sur ton appareil.

## Utilisation

Ouvre `index.html` dans ton navigateur (double-clic sur le fichier suffit).

- **Sommaire** : les 6 catégories — Apéritif, Entrée, Plat, Dessert, Sauce, Boisson.
- **＋** en haut à droite : écrire une nouvelle recette
  (titre, catégorie, temps, portions, ingrédients, préparation, notes).
- **‹** en haut à gauche : revenir à l'écran précédent (une recette ramène à sa
  catégorie). Le bouton disparaît sur le sommaire.
- **⚙️ Réglages** en bas du sommaire : sauvegarde, restauration et synchro.
- **Recherche** : cherche dans les titres, les ingrédients et les notes.
- **Modifier / Supprimer** : depuis la fiche d'une recette.

## Mettre l'app sur ton ordinateur

Deux façons, au choix.

### 1. Un seul fichier (le plus simple)

Récupère `livre-de-recettes.html`, glisse-le dans ton dossier **Applis** et double-clique
dessus : il contient tout (mise en forme + code), aucun autre fichier n'est nécessaire.

Téléchargement direct :
<https://raw.githubusercontent.com/Clementlefebvre95/TEST-CLAUDE/claude/recipe-book-app-oiv1jj/livre-de-recettes.html>
(clic droit → « Enregistrer sous… »)

Astuce : une fois ouvert, mets la page en favori ou glisse l'onglet dans ta barre
de favoris pour la rouvrir en un clic.

### 2. Le dossier complet (avec l'installation sur téléphone)

Télécharge le dossier en `.zip` :
<https://github.com/Clementlefebvre95/TEST-CLAUDE/archive/refs/heads/claude/recipe-book-app-oiv1jj.zip>

Décompresse-le, range-le dans **Applis**, puis ouvre `index.html`.
Cette version-là gère aussi le mode hors ligne et l'installation sur téléphone (PWA).

### Regénérer le fichier unique

Après une modification de `index.html`, `styles.css` ou `app.js` :

```bash
node build.js
```

## ⚠️ Les recettes suivent le fichier

Les recettes sont enregistrées par le navigateur, séparément pour chaque
emplacement du fichier. Si tu déplaces `livre-de-recettes.html` ailleurs, le
navigateur peut ne plus retrouver tes recettes : exporte-les avant
(**⬇️ Sauvegarder mes recettes**), puis réimporte-les depuis le nouvel
emplacement (**⬆️ Restaurer**).

## Sauvegarde

Les recettes sont stockées dans le `localStorage` du navigateur.
Dans **⚙️ Réglages** (en bas du sommaire) :

- **⬇️ Sauvegarder mes recettes** exporte un fichier `.json`.
- **⬆️ Restaurer** réimporte ce fichier (les recettes déjà présentes ne sont pas dupliquées).

Pense à exporter de temps en temps : vider les données du navigateur efface le livre.

## Synchronisation entre appareils (optionnel)

Par défaut les recettes vivent dans le navigateur de l'appareil. La section
**Synchronisation automatique** des réglages permet de les conserver dans un **gist privé** de ton compte
GitHub : elles se retrouvent alors sur tous tes appareils et survivent à un
changement de téléphone.

Mise en route (une fois) :

1. Crée une clé sur <https://github.com/settings/tokens/new> — expiration
   « No expiration », et coche **uniquement** la case `gist`.
2. Dans l'app : **⚙️ Réglages** → colle la clé → **Activer la synchronisation**.

Sur un nouvel appareil, tu colles la même clé : l'app retrouve la sauvegarde
existante et rapatrie tes recettes.

Fonctionnement :

- la synchro part toute seule à chaque ajout, modification ou suppression,
  au démarrage, et quand tu reviens sur l'app ;
- en cas de conflit entre deux appareils, la version la plus récente de chaque
  recette gagne ; une suppression est mémorisée pour qu'une recette effacée ne
  réapparaisse pas depuis l'autre appareil ;
- si la clé expire ou est révoquée, un bandeau rouge le signale sur le sommaire
  au lieu d'échouer en silence ;
- la clé reste dans le navigateur, elle n'est envoyée qu'à `api.github.com`.

L'export `.json` reste disponible : c'est le filet de sécurité si tu désactives
la synchro.

## Sur téléphone

L'app est installable (PWA) : ouvre la page, puis « Ajouter à l'écran d'accueil ».
Elle s'ouvre ensuite comme une vraie application, même sans connexion.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | structure des écrans |
| `styles.css` | mise en forme |
| `app.js` | logique (stockage, navigation, recherche) |
| `manifest.json`, `sw.js`, `icon.svg` | installation + mode hors ligne |
