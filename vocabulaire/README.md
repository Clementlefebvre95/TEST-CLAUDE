# 📖 Mes Mots

Application de vocabulaire anglais 🇬🇧 et espagnol 🇪🇸, en trois pages.

## Les trois pages

1. **Mes mots** — la liste arrive tout de suite, en bulles : la langue étrangère à gauche, le
   français à droite, sur la même ligne, comme une conversation. Le bouton **+** ouvre les deux
   champs d'ajout ; *masquer* cache toutes les traductions pour se tester, et chaque bulle masquée
   se révèle d'un clic. La recherche n'apparaît qu'au-delà de huit mots, une bordure verte et un ✓
   marquent les mots sus, et toucher un mot le fait prononcer.
2. **Du jour** — la phrase du jour (traduction masquée jusqu'au clic, note d'usage, ajout direct à
   la liste) puis la leçon du jour : résumé, tableau de conjugaison, exemples traduits, astuce,
   et le détail replié pour ceux qui veulent aller plus loin. Toucher la phrase la fait prononcer.
   34 leçons et 50 phrases par langue, une nouvelle chaque jour.
3. **Révision** — cartes mémo tirées en priorité parmi les mots les moins sûrs. Un mot réussi monte
   d'un niveau, un mot raté repart à zéro. Le sens de la question se change d'un clic ; au clavier :
   espace révèle, 1 = à revoir, 2 = je savais.

## Parti pris visuel

Même code couleur que Mes Recettes : fond crème `#faf7f2`, cartes blanches, orange `#e85d3a`.
Le vocabulaire se lit comme une conversation — bulle blanche à gauche pour la langue étrangère,
bulle orangée à droite pour le français. Les mots étrangers, les phrases et les questions sont
composés en serif (Newsreader, repli Georgia) comme les entrées d'un dictionnaire ; l'interface
reste dans la police système.

La langue choisie est retenue : à la réouverture, on retrouve celle de la dernière fois.

## Où tourne l'app

- **Artifact Claude** (`artifact.html`) : hébergée sur claude.ai, rien à installer, sauvegarde
  automatique sur le compte — les mots suivent d'un appareil à l'autre.
- **Site statique** (`index.html`, par exemple GitHub Pages) : installable sur l'écran d'accueil et
  utilisable hors ligne.

`artifact.html` est le corps de `index.html` sans l'enveloppe `<html>/<head>/<body>`, fournie par la
plateforme. Après modification de `index.html`, le régénérer :

```bash
python3 -c "src=open('index.html').read(); corps=src[src.index('>',src.index('<body'))+1:src.index('</body>')]; open('artifact.html','w').write('<title>Mes Mots</title>\n<link rel=\"stylesheet\" href=\"styles.css\" />\n'+corps.strip()+'\n')"
```

## Sauvegarde

Les mots vivent dans le navigateur (`localStorage`). Pour qu'ils survivent à un changement de
téléphone, l'app choisit toute seule le coffre disponible :

- **Sur Claude** : stockage de l'artifact, aucune configuration.
- **Ailleurs** : un jeton GitHub coché sur la seule case `gist`, à coller dans le pied de page. Les
  mots partent dans un gist privé après chaque ajout ; le même jeton les récupère sur un autre
  appareil. Rien n'est écrasé : à la fusion, chaque mot garde son meilleur niveau.
- **Dans tous les cas** : export et import d'un fichier JSON depuis le pied de page.

## Lancer en local

```bash
npx http-server -p 8080     # puis http://localhost:8080/vocabulaire/
```

Ni dépendance ni build : HTML, CSS et JavaScript natifs.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` / `artifact.html` | les trois pages, pour chacun des deux hébergements |
| `styles.css` | mise en forme : papier chaud, un seul accent, aucune boîte |
| `app.js` | mots, contenu du jour, révision, sauvegarde |
| `data-en.js` / `data-es.js` | leçons et phrases |
| `sw.js`, `manifest.json`, `icon.svg` | installation et mode hors ligne |

## Ajouter du contenu

Les leçons et les phrases sont de simples tableaux dans `data-en.js` et `data-es.js` : ajouter une
entrée suffit, la rotation quotidienne s'adapte à la longueur du tableau.
