# Tableau Sage

Un tableau de bord qui affiche le **chiffre d'affaires** et les **stocks** d'une
société **Sage 100** (Gestion commerciale, version SQL Server).

- Un seul fichier à envoyer : `dist/TableauSage.exe` (Windows 10 ou 11).
- Rien à installer : on double-clique, le tableau de bord s'ouvre dans le navigateur.
- **Lecture seule** : l'application ne modifie jamais rien dans Sage, et ses
  lectures ne bloquent pas les personnes qui travaillent dans Sage.
- Les données restent sur le réseau du bureau : rien n'est envoyé sur Internet.

## Ce qu'on y voit

**Chiffre d'affaires** (HT, factures de vente, avoirs et retours déduits)
- aujourd'hui, ce mois-ci et depuis le 1er janvier, comparés à la même période
  de l'an dernier ;
- un graphique mois par mois, cette année et l'an dernier, avec une vue tableau ;
- les 10 meilleurs clients et les 10 articles les plus vendus de l'année.

**Stocks** (articles actifs dont Sage suit le stock)
- valeur du stock, nombre d'articles, articles en rupture et sous le stock minimum ;
- la liste complète, avec recherche, tri, filtre par dépôt, quantités en stock,
  réservées, disponibles et commandées.

## Envoyer l'application

Gmail et la plupart des messageries bloquent les fichiers `.exe`, même dans un
`.zip`. Passez plutôt par **WeTransfer**, **Google Drive**, **WhatsApp** ou une
**clé USB**.

## Pour la personne au bureau

1. Enregistrez `TableauSage.exe` sur le PC, par exemple sur le Bureau. Le mieux
   est de choisir **un PC où Sage est déjà utilisé** : on sait alors qu'il voit
   le serveur.
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

## Pour l'informaticien ou le revendeur Sage

L'application lit les tables de la base de la société : `F_DOCENTETE`,
`F_DOCLIGNE`, `F_COMPTET`, `F_ARTICLE`, `F_ARTSTOCK`, `F_DEPOT`, `F_FAMILLE`
(et `P_DOSSIER` pour la raison sociale). Elle n'écrit jamais.

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
- stock = somme de `F_ARTSTOCK` pour les articles `AR_Sommeil = 0` et
  `AR_SuiviStock <> 0`, disponible = `AS_QteSto − AS_QteRes`.

La configuration est enregistrée dans `%AppData%\TableauSage\config.json`.
Pour tout recommencer, supprimez ce fichier ou utilisez
« Paramètres → Reprendre la configuration ».

## Pour les développeurs

Programme Go : un petit serveur local (`127.0.0.1:8765`) qui sert la page
(`web/`) et une API JSON. Il s'exécute uniquement sur le poste de la personne
et ne répond qu'aux requêtes venant de cette page.

```sh
go run . -demo                 # démonstration avec des données fictives
go test ./...                  # tests unitaires
./build.sh                     # construit ../dist/TableauSage.exe
```

Test complet contre un vrai SQL Server : `TestSQLMatchesDemo` crée une base aux
tables Sage, y charge les données de démonstration, puis vérifie que les
requêtes SQL donnent exactement les mêmes chiffres que le calcul de référence
en Go (y compris les avoirs, les retours et les documents à ignorer).

```sh
docker run -d --name sagesql --network host -e ACCEPT_EULA=Y \
  -e 'MSSQL_SA_PASSWORD=Test-Sage-2026!' mcr.microsoft.com/mssql/server:2022-latest
TEST_SQL_SERVER=localhost TEST_SQL_USER=sa TEST_SQL_PASSWORD='Test-Sage-2026!' go test ./...
```
