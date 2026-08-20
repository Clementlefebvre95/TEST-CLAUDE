# 📖 Mon Livre de Recettes

Un carnet de recettes personnel, simple, qui fonctionne dans le navigateur.
Aucun compte, aucun serveur : tout est enregistré sur ton appareil.

## Utilisation

Ouvre `index.html` dans ton navigateur (double-clic sur le fichier suffit).

- **Sommaire** : les 6 catégories — Apéritif, Entrée, Plat, Dessert, Sauce, Boisson.
- **＋** en haut à droite : écrire une nouvelle recette
  (titre, catégorie, temps, portions, ingrédients, préparation, notes).
- **📖** en haut à gauche : revenir au sommaire.
- **Recherche** : cherche dans les titres, les ingrédients et les notes.
- **Modifier / Supprimer** : depuis la fiche d'une recette.

## Sauvegarde

Les recettes sont stockées dans le `localStorage` du navigateur.
En bas de l'écran :

- **⬇️ Sauvegarder mes recettes** exporte un fichier `.json`.
- **⬆️ Restaurer** réimporte ce fichier (les recettes déjà présentes ne sont pas dupliquées).

Pense à exporter de temps en temps : vider les données du navigateur efface le livre.

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
