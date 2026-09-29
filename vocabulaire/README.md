# ✈️ Mes Mots — le voyage

Application de vocabulaire anglais 🇬🇧 et espagnol 🇪🇸, pensée comme un voyage : chaque thème de
vocabulaire est une escale sur une carte, chaque escale réussie reçoit un tampon, et chaque bonne
réponse fait avancer de 10 km.

## Les trois pages

1. **Mots** — ta liste, la langue étrangère à gauche et le français à droite, au même format.
   Le **+** ouvre l'ajout ; *cacher les traductions* masque la colonne française pour se tester, et
   chaque traduction se révèle d'un toucher. Toucher une ligne prononce le mot et déplie
   *écouter* / *supprimer*. La recherche apparaît au-delà de douze mots ; une pastille verte marque
   les mots sus.
2. **Voyage** — quatre sous-onglets :
   - *Carte* : les douze escales de vocabulaire (Au café, La maison, Voyager, En ville…) reliées par
     un chemin. Une escale ouverte s'affiche en **carte postale** : ses dix mots, son timbre, le jeu
     pour la tamponner (75 % de bonnes réponses), et un lien pour ajouter ses mots à ta liste ;
   - *Phrase* : la phrase du jour, traduction cachée jusqu'au toucher ;
   - *Leçon* : la leçon de grammaire du jour, l'essentiel visible, le détail replié ; l'étoile
     l'enregistre ;
   - *Enregistrées* : les leçons gardées, rangées à part de tes mots.
3. **Jouer** — quatre jeux présentés en billets :
   - *Quiz éclair* : choisir la traduction parmi quatre « portes » ;
   - *Paires* : relier chaque mot à sa traduction ;
   - *Lettres mélangées* : remettre les lettres dans l'ordre (l'article est retiré) ;
   - *Écoute* : entendre le mot et le retrouver.
   Les jeux utilisent tes mots, les moins sûrs d'abord ; avec moins de quatre mots, ils piochent
   dans les escales. Une bonne réponse fait monter le mot d'un niveau, une erreur le fait
   redescendre.

La langue choisie, les kilomètres et les jours d'affilée sont retenus d'une ouverture à l'autre.

## Parti pris visuel

Un ciel clair en dégradé, du papier de carte postale, une encre marine `#1d3557` et des tampons
terre cuite `#e76f51`, avec le soleil `#f4a261` et la menthe `#2a9d8f` pour les réussites. Une
seule police, Bricolage Grotesque. Les jeux reprennent les objets du voyage : billet d'embarquement
perforé, portes, cachet de fin de partie.

## Sauvegarde

Tout est d'abord enregistré dans le navigateur (`localStorage`). Pour changer de téléphone :

- **Sur Claude** (`artifact.html`) : stockage de l'artifact, sans rien configurer
  (documents `mots/<langue>`, `lecons/<langue>`, `voyage/progres`).
- **Ailleurs** (`index.html`, GitHub Pages) : un jeton GitHub coché sur la seule case `gist`, dans
  les réglages (`⋯`). Le même jeton récupère tout sur un autre appareil.
- **Partout** : export et import d'un fichier JSON depuis les réglages.

À la fusion rien n'est écrasé : chaque mot garde son meilleur niveau, les tampons s'additionnent,
les kilomètres gardent le plus grand total, et le retrait d'une leçon enregistrée l'emporte s'il
est plus récent.

## Lancer en local

```bash
npx http-server -p 8080     # puis http://localhost:8080/vocabulaire/
```

Ni dépendance ni build : HTML, CSS et JavaScript natifs.

`artifact.html` est le corps de `index.html` sans l'enveloppe `<html>/<head>/<body>`, fournie par la
plateforme Artifact. Après une modification de `index.html`, le régénérer :

```bash
python3 -c "src=open('index.html').read(); corps=src[src.index('>',src.index('<body'))+1:src.index('</body>')]; open('artifact.html','w').write('<title>Mes Mots</title>\n<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&display=swap\" />\n<link rel=\"stylesheet\" href=\"styles.css\" />\n'+corps.strip()+'\n')"
```

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` / `artifact.html` | les trois pages, pour chacun des deux hébergements |
| `styles.css` | l'habillage « voyage » |
| `app.js` | mots, voyage, jeux, sauvegarde |
| `data-themes.js` | les douze escales de vocabulaire par langue (dix mots chacune) |
| `data-en.js` / `data-es.js` | leçons de grammaire et phrases du jour |
| `sw.js`, `manifest.json`, `icon*` | installation et mode hors ligne |
| `maquettes*.html`, `neon.html`, `design/` | maquettes des pistes explorées, hors application |

## Ajouter du contenu

Une escale de plus : un objet `{ id, titre, accroche, mots: [[étranger, français], …] }` dans
`THEMES_ES` et `THEMES_EN`, avec le même `id` dans les deux langues. La carte s'allonge toute seule.
