# Tableau Sage

Un tableau de bord qui affiche le **chiffre d'affaires**, les **stocks** et les
**fournisseurs** d'une société **Sage 100** (Gestion commerciale, version SQL
Server), sur le PC du bureau et, si on le souhaite, sur un téléphone.

- Un seul fichier à envoyer : `dist/TableauSage.exe` (Windows 10 ou 11).
- Rien à installer : on double-clique, le tableau de bord s'ouvre dans le navigateur.
- **Lecture seule** : l'application ne modifie jamais rien dans Sage, et ses
  lectures ne bloquent pas les personnes qui travaillent dans Sage.
- Les données ne passent pas par Internet : elles restent sur le PC du bureau,
  et sur les téléphones qu'on autorise (Wi-Fi du bureau ou Tailscale).

## Ce qu'on y voit

**Ventes** (chiffre d'affaires HT, factures de vente, avoirs et retours déduits)
- aujourd'hui, ce mois-ci et depuis le 1er janvier, comparés à la même période
  de l'an dernier ;
- un graphique mois par mois, cette année et l'an dernier, avec une vue tableau ;
- les 10 meilleurs clients et les 10 articles les plus vendus de l'année.

**Stocks** (articles actifs dont Sage suit le stock)
- valeur du stock, nombre d'articles, articles en rupture et sous le stock minimum ;
- la liste complète, avec recherche, tri, filtre par dépôt, fournisseur
  principal, quantités en stock, réservées, disponibles et commandées.

**Fournisseurs**
- achats HT (factures fournisseurs, avoirs et retours déduits) ce mois-ci et
  depuis le 1er janvier, comparés à l'an dernier, et un graphique par mois ;
- les commandes fournisseurs en cours, avec leur date de livraison prévue et
  celles **en retard** en premier ;
- les principaux fournisseurs et la liste complète, avec recherche ;
- la **fiche de chaque fournisseur** : contact, téléphone et e-mail (un appui
  suffit pour appeler depuis un téléphone), achats de l'année et de l'an
  dernier, commandes en cours, articles achetés, et **ses articles à
  réapprovisionner** (en rupture ou sous le minimum).

Pas encore : ce qui reste à payer aux fournisseurs. Le calcul dépend de la
façon dont les règlements sont saisis dans Sage (en comptabilité ou en gestion
commerciale) ; il pourra être ajouté une fois vérifié sur la vraie base.

## Envoyer l'application

Gmail et la plupart des messageries bloquent les fichiers `.exe`, même dans un
`.zip`. Envoyez plutôt ce lien de téléchargement :
https://github.com/Clementlefebvre95/TEST-CLAUDE/raw/claude/dazzling-brahmagupta-djb7iu/dist/TableauSage.exe
(ou passez par WeTransfer, Google Drive, WhatsApp ou une clé USB).

## Pour la personne au bureau

1. Enregistrez `TableauSage.exe` sur le PC, dans un endroit où il restera (par
   exemple dans Documents). Le mieux est de choisir **un PC où Sage est déjà
   utilisé** : on sait alors qu'il voit le serveur.
2. Double-cliquez dessus. Si Windows affiche « Windows a protégé votre
   ordinateur », cliquez sur **Informations complémentaires**, puis sur
   **Exécuter quand même**. Ce message apparaît parce que le fichier ne vient
   pas d'un éditeur connu.
3. Une fenêtre noire s'ouvre (laissez-la ouverte) et le navigateur affiche la
   page de configuration :
   - **Serveur** : cliquez sur « Rechercher sur le réseau » et choisissez le
     serveur trouvé, ou tapez son nom (souvent `NOMDUPC\SAGE100`) ;
   - **Identification** : essayez d'abord « Mon compte Windows ». Si c'est refusé,
     choisissez « Identifiant SQL » et saisissez l'identifiant fourni ;
   - **Société** : cochez la société, puis « Ouvrir le tableau de bord ».
4. C'est terminé. Les fois suivantes, un double-clic suffit : la configuration
   est retenue. Le mot de passe est chiffré avec le compte Windows et ne peut
   être lu que sur ce PC, par ce compte.

En cas de problème, la page affiche un message en clair. Le lien « Copier le
message » permet de l'envoyer à la personne qui vous aide.

### Trouver le nom du serveur SQL

1. Dans Tableau Sage, cliquez sur **Rechercher sur le réseau**, puis sur le nom
   trouvé. Si rien n'apparaît :
2. Sur le PC qui sert de serveur à Sage : touches **Windows + R**, tapez
   `services.msc`, **Entrée**. Cherchez une ligne **SQL Server (…)** : le mot
   entre parenthèses est le nom de l'instance (par exemple `SAGE100`).
3. Clic droit sur le bouton **Démarrer**, puis **Système** : notez le **Nom de
   l'appareil** (par exemple `BUREAU-PC`).
4. Le nom du serveur est `BUREAU-PC\SAGE100`. Si l'instance s'appelle
   `MSSQLSERVER`, c'est juste `BUREAU-PC`.

## Ouvrir le tableau de bord sur un téléphone

Les chiffres sont consultables sur un téléphone, avec un code d'accès. Depuis
un téléphone, on ne peut que regarder : ni la configuration ni les réglages ne
sont accessibles, et rien ne peut être modifié dans Sage.

### 1. Sur le PC du bureau (une seule fois)

1. Dans Tableau Sage, cliquez sur **Accès téléphone**, puis cochez
   **Autoriser l'accès depuis un téléphone**.
2. Si Windows demande l'autorisation du pare-feu : cochez **Réseaux privés** et
   **Réseaux publics**, puis **Autoriser l'accès** (un mot de passe
   administrateur peut être demandé). Si vous avez cliqué sur « Annuler » par
   erreur : Paramètres Windows › Pare-feu › « Autoriser une application via le
   pare-feu » › cochez TableauSage.
3. Notez le **code d'accès** (8 chiffres) et l'**adresse** affichés, par
   exemple `http://192.168.1.20:8765`.
4. Cochez aussi :
   - **Démarrer le tableau de bord avec Windows** : il se relance tout seul,
     réduit dans la barre des tâches, après un redémarrage (ne déplacez plus le
     fichier ensuite) ;
   - **Empêcher la mise en veille de ce PC** : sinon le téléphone ne le trouve
     plus quand il dort. L'écran peut s'éteindre.

Le PC doit rester allumé, avec une session Windows ouverte.

### 2a. Au bureau, sur le même Wi-Fi

Sur le téléphone connecté au Wi-Fi du bureau, ouvrez l'adresse notée (par
exemple `http://192.168.1.20:8765`), puis tapez le code. Il n'est demandé qu'une
fois par téléphone.

### 2b. De partout, avec Tailscale (gratuit)

Tailscale relie le téléphone au PC du bureau par un lien privé et chiffré. Rien
n'est ouvert sur Internet.

1. Créez un compte sur **tailscale.com** (par exemple avec un compte Google).
2. Sur le PC du bureau : téléchargez Tailscale pour Windows sur
   tailscale.com/download, installez-le, connectez-vous avec ce compte.
3. Sur le téléphone : installez l'appli **Tailscale** (App Store ou Google
   Play), connectez-vous avec le **même compte**, et activez-la.
4. Dans Tableau Sage, sur le PC, **Accès téléphone** affiche maintenant une
   adresse « De partout, avec Tailscale » (elle commence par `http://100.`).
   Ouvrez-la sur le téléphone et tapez le code.

### 3. Comme une appli

Sur le téléphone, ajoutez la page à l'écran d'accueil : sur iPhone, bouton
**Partager** puis **Sur l'écran d'accueil** ; sur Android, menu **⋮** puis
**Ajouter à l'écran d'accueil**.

### Sécurité

- Tant que l'accès téléphone n'est pas coché, le tableau de bord n'écoute que
  sur le PC lui-même : rien n'est visible sur le réseau.
- Il faut le code pour voir les chiffres. Après 5 codes faux, le téléphone doit
  attendre 15 minutes.
- **Changer le code** (dans Accès téléphone) déconnecte tous les téléphones.
  Décocher l'accès les coupe immédiatement.
- Le code est enregistré chiffré, comme le mot de passe.

## Pour l'informaticien ou le revendeur Sage

L'application lit les tables de la base de la société : `F_DOCENTETE`,
`F_DOCLIGNE`, `F_COMPTET`, `F_ARTICLE`, `F_ARTSTOCK`, `F_DEPOT`, `F_FAMILLE`,
`F_ARTFOURNISS` (et `P_DOSSIER` pour la raison sociale). Elle n'écrit jamais.
Ces colonnes sont lues quand elles existent, et simplement omises sinon :
`DO_DateLivr`, `DO_Cloture`, `CT_Type`, `CT_Sommeil`, `CT_Contact`,
`CT_Telephone`, `CT_EMail`, `CT_Ville`, et la table `F_ARTFOURNISS`.

Si le compte Windows de l'utilisateur n'a pas accès à la base, créez un
identifiant **en lecture seule** (le serveur doit accepter l'authentification
SQL Server, en mode « mixte ») :

```sql
CREATE LOGIN tableau_sage WITH PASSWORD = 'choisir-un-mot-de-passe-solide';
USE [NOM_DE_LA_BASE_SOCIETE];
CREATE USER tableau_sage FOR LOGIN tableau_sage;
ALTER ROLE db_datareader ADD MEMBER tableau_sage;
```

Pour que « Rechercher sur le réseau » trouve le serveur, le service
**SQL Server Browser** doit tourner (port UDP 1434). Sinon, saisissez le nom
du serveur à la main (`SERVEUR\INSTANCE` ou `SERVEUR,port`).

Règles de calcul :
- chiffre d'affaires = lignes des documents de vente `DO_Domaine = 0`,
  `DO_Type` 6 (facture) et 7 (facture comptabilisée), montant `DL_MontantHT` ;
  les factures de retour et d'avoir (`DO_Provenance` 1 et 2) sont déduites ;
- achats = même règle sur les documents d'achat `DO_Domaine = 1`, `DO_Type` 16
  et 17 ;
- commandes en cours = bons de commande fournisseur `DO_Domaine = 1`,
  `DO_Type = 12`, hors documents clôturés (`DO_Cloture`) ; en retard quand
  `DO_DateLivr` est passée ;
- fournisseurs = tiers `CT_Type = 1` actifs (`CT_Sommeil = 0`), plus tout tiers
  ayant des factures d'achat sur les deux dernières années ;
- fournisseur principal d'un article = la ligne `F_ARTFOURNISS` marquée
  `AF_Principal`, sinon la première par compte ;
- stock = somme de `F_ARTSTOCK` pour les articles `AR_Sommeil = 0` et
  `AR_SuiviStock <> 0`, disponible = `AS_QteSto − AS_QteRes`.

La configuration est enregistrée dans `%AppData%\TableauSage\config.json`.
Pour tout recommencer, supprimez ce fichier ou utilisez
« Paramètres → Reprendre la configuration ». Le démarrage avec Windows est une
entrée `TableauSage` dans `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.

## Pour les développeurs

Programme Go : un petit serveur local (`127.0.0.1:8765`) qui sert la page
(`web/`) et une API JSON. Quand l'accès téléphone est activé, il écoute aussi
sur les adresses réseau du PC (`phone.go`) : les autres appareils doivent
présenter le code, puis un cookie de session signé, et n'atteignent jamais la
configuration.

```sh
go run . -demo                 # démonstration avec des données fictives
go test ./...                  # tests unitaires et contrôle d'accès
./build.sh                     # construit ../dist/TableauSage.exe
```

Test complet contre un vrai SQL Server : `TestSQLMatchesDemo` crée une base aux
tables Sage, y charge les données de démonstration, puis vérifie que les
requêtes SQL donnent exactement les mêmes chiffres que le calcul de référence
en Go (ventes, achats, fournisseurs, commandes, stocks, y compris les avoirs,
les retours et les documents à ignorer). `TestSQLMinimalSchema` refait
l'exercice sur une base sans aucune colonne optionnelle.

```sh
docker run -d --name sagesql --network host -e ACCEPT_EULA=Y \
  -e 'MSSQL_SA_PASSWORD=Test-Sage-2026!' mcr.microsoft.com/mssql/server:2022-latest
TEST_SQL_SERVER=localhost TEST_SQL_USER=sa TEST_SQL_PASSWORD='Test-Sage-2026!' go test ./...
```
