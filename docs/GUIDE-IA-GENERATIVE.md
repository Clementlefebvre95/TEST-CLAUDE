# GenIA-L : l'IA générative expliquée à un ingénieur

> Guide de fond, écrit à partir du code de cette app (`app.js`) qui appelle Gemini et Claude.
> « GenIA-L » = IA **Gén**érative (le jeu de mots sur « génial »). Tout ce qui suit vaut pour
> n'importe quel LLM : Claude, Gemini, GPT, Llama, Mistral.

---

## Sommaire

1. [Où se situe l'IA générative](#1-où-se-situe-lia-générative)
2. [Comment un modèle apprend](#2-comment-un-modèle-apprend)
3. [Le Transformer, en vrai](#3-le-transformer-en-vrai)
4. [Les trois phases de la vie d'un modèle](#4-les-trois-phases-de-la-vie-dun-modèle)
5. [Conséquences pratiques (pourquoi ça hallucine, pourquoi ça compte mal)](#5-conséquences-pratiques)
6. [Les paramètres d'inférence](#6-les-paramètres-dinférence)
7. [Tokens, coût, latence](#7-tokens-coût-latence)
8. [Les 5 patterns d'ingénierie](#8-les-5-patterns-dingénierie)
9. [Fiabilité : traiter le LLM comme un réseau, pas comme une fonction](#9-fiabilité)
10. [Évaluer : le vrai différenciateur](#10-évaluer)
11. [Sécurité](#11-sécurité)
12. [Relecture de ce repo](#12-relecture-de-ce-repo)
13. [Glossaire](#13-glossaire)

---

## 1. Où se situe l'IA générative

Quatre cercles concentriques, du plus large au plus étroit :

```
IA  ─ tout système qui automatise une décision (même un if/else, même A*)
 └─ Machine Learning ─ le comportement est appris depuis des données, pas codé
     └─ Deep Learning ─ réseaux de neurones à plusieurs couches
         └─ IA générative ─ le modèle produit du contenu (texte, image, audio, code)
             └─ LLM ─ génératif, sur du texte, basé sur l'architecture Transformer
```

La rupture de 2017-2023 n'est pas « on a inventé l'intelligence ». C'est :
**une architecture qui parallélise bien** (le Transformer) **+ beaucoup de données**
**+ beaucoup de calcul** → et une capacité de généralisation qui a émergé de l'échelle.

**Le point clé pour un ingénieur :** un LLM ne fait qu'**une seule chose** — prédire le
prochain morceau de texte. Tout le reste (répondre, traduire, coder, extraire du JSON,
générer une recette) est cette unique opération, répétée.

---

## 2. Comment un modèle apprend

### 2.1 Un modèle = une fonction paramétrée

```
y = f(x, θ)
```

- `x` : l'entrée (ton prompt, tokenisé)
- `θ` : les **paramètres** (les « poids ») — des milliards de nombres flottants
- `y` : la sortie (une distribution de probabilité sur le vocabulaire)

Entraîner = trouver les `θ` qui minimisent une **fonction de perte** (loss) sur un jeu de données.

### 2.2 La boucle d'entraînement

```
pour chaque batch de données :
    prédiction = f(x, θ)                  # forward pass
    perte      = loss(prédiction, vérité) # à quel point on s'est trompé
    gradient   = ∂perte/∂θ                # backpropagation (règle de la chaîne)
    θ          = θ - lr * gradient        # descente de gradient
```

C'est tout. Répété des milliards de fois sur des milliers de GPU pendant des semaines.

La « vérité » pour un LLM est gratuite : on masque le mot suivant d'un texte existant et on
demande au modèle de le deviner. C'est de l'apprentissage **auto-supervisé** — pas besoin
d'annotateurs humains, tout Internet devient un jeu d'entraînement.

### 2.3 Ce que ça veut dire concrètement

Le modèle est **figé** après entraînement. Quand tu l'appelles :

- il n'apprend rien de ta requête ;
- il ne « se souvient » de rien entre deux appels — la mémoire, c'est **toi** qui la
  renvoies dans le prompt à chaque fois ;
- il n'y a pas de base de données à interroger dedans. Les faits sont dilués dans les poids,
  de façon lossy. D'où les hallucinations (§5).

---

## 3. Le Transformer, en vrai

### 3.1 Tokenisation

Le texte est découpé en **tokens** (~ sous-mots). En français, compte grossièrement
**1 token ≈ 3 caractères** (l'anglais est plus efficace, ~4).

```
"Génère une recette de risotto"  →  ["G", "én", "ère", " une", " recette", " de", " ris", "otto"]
```

Chaque token est un entier, mappé vers un **embedding** : un vecteur de ~4000 dimensions.
Deux mots de sens proche ont des vecteurs proches. C'est la représentation avec laquelle
le modèle travaille — pas des lettres.

> **Conséquence directe :** le modèle ne « voit » pas les lettres. D'où les échecs classiques
> sur « combien de r dans strawberry », les rimes, les palindromes, l'arithmétique chiffre à chiffre.

### 3.2 L'attention

C'est le cœur. Pour chaque token, le modèle calcule trois vecteurs :

| Vecteur | Rôle | Analogie |
|---|---|---|
| **Query** (Q) | ce que ce token cherche | la requête SQL |
| **Key** (K) | ce que ce token propose | l'index |
| **Value** (V) | ce que ce token transporte | la ligne retournée |

Puis :

```
attention(Q, K, V) = softmax(Q·Kᵀ / √d) · V
```

En français : **chaque token regarde tous les autres, pondère leur pertinence, et
mélange leur information dans sa propre représentation.** Répété sur ~100 couches, avec
~100 « têtes » d'attention en parallèle par couche (chacune apprenant une relation
différente : syntaxe, coréférence, structure...).

C'est ce mécanisme qui fait que dans ton prompt, `INGRÉDIENTS INTERDITS : arachide`
influence effectivement le token généré 2000 positions plus loin.

**Le coût est quadratique** : `O(n²)` en longueur de contexte. C'est pourquoi doubler le
contexte coûte plus que doubler le prix, et pourquoi un long contexte augmente la latence.

### 3.3 La génération est auto-régressive

Le modèle ne produit **pas** une réponse. Il produit **un token**, puis recommence :

```
["Voici", "une"]                      → distribution → "recette"
["Voici", "une", "recette"]           → distribution → " de"
["Voici", "une", "recette", " de"]    → distribution → " ris"
...
```

Un appel qui rend 800 tokens = 800 passages complets dans le réseau. Trois conséquences :

1. **La latence est proportionnelle à la sortie**, pas à l'entrée. L'entrée est traitée en
   une passe parallèle (le *prefill*, rapide) ; la sortie est séquentielle (le *decode*, lent).
2. **Le streaming est gratuit** — les tokens existent déjà un par un. Ne pas streamer une
   réponse longue est un choix de confort perdu.
3. **Le modèle ne peut pas revenir en arrière.** Un token émis est définitif. S'il commence
   par ` ```json `, il est engagé. D'où l'intérêt de le forcer à réfléchir *avant* de
   s'engager (chain of thought), ou de contraindre le format en amont (§8.2).

---

## 4. Les trois phases de la vie d'un modèle

| Phase | Ce qui se passe | Ce que ça produit |
|---|---|---|
| **Pré-entraînement** | Prédire le token suivant sur des trillions de tokens. Des mois, des dizaines de M$. | Un modèle qui *sait* mais qui ne fait qu'autocompléter. |
| **Post-entraînement** | Fine-tuning supervisé sur des dialogues de qualité, puis apprentissage par renforcement sur des préférences (RLHF / RLAIF, Constitutional AI). | Un modèle qui *répond*, suit des instructions, refuse ce qu'il doit refuser. |
| **Inférence** | Ce que ton `fetch()` déclenche. Poids figés. | Une réponse, facturée au token. |

**La distinction utile au quotidien :** les *connaissances* viennent du pré-entraînement (donc
figées à une date de cutoff, et floues) ; le *comportement* (suivre un schéma JSON, respecter
une contrainte) vient du post-entraînement. Un modèle qui ignore ton format n'est pas ignorant,
il est mal instruit — c'est ton prompt le levier, pas ton choix de modèle.

### Et le fine-tuning ?

Réentraîner un modèle sur tes données. En 2026, **c'est rarement le bon premier réflexe** :

- ça règle un problème de **forme/style/format**, pas de **connaissance** ;
- pour la connaissance, le RAG (§8.3) est moins cher, plus frais et auditable ;
- ça te fige sur un modèle donné alors qu'un meilleur sort tous les 4 mois.

Ordre à essayer : **prompt → few-shot → outils/RAG → fine-tuning**. Ne descends que si
tu as des evals qui prouvent que l'étape d'avant plafonne.

---

## 5. Conséquences pratiques

### 5.1 Pourquoi ça hallucine

Le modèle optimise la **vraisemblance**, pas la vérité. Une référence bibliographique inventée
est statistiquement très plausible : bon format, bons noms, bonne année. Rien dans
l'entraînement ne distingue « plausible » de « vrai ».

Ce n'est **pas un bug corrigeable** — c'est la nature de l'objet. On l'atténue par
l'architecture autour :

- fournir les faits dans le prompt (RAG) plutôt que compter sur la mémoire ;
- donner des outils (recherche, base de données, calculatrice) ;
- vérifier la sortie programmatiquement — exactement ce que fait `findViolations()` dans ce repo ;
- demander explicitement « dis que tu ne sais pas si tu ne sais pas » (ça marche partiellement).

### 5.2 Ce que les LLM font mal (et pourquoi)

| Faiblesse | Cause | Parade |
|---|---|---|
| Arithmétique exacte | tokenisation + pas de calcul symbolique | tool use (calculatrice, code) |
| Compter les caractères | il voit des tokens, pas des lettres | ne pas demander ça |
| Faits récents / privés | cutoff + poids figés | RAG, recherche web |
| Longs raisonnements | erreur qui se propage, pas de backtracking | découper en étapes, laisser « penser » avant de répondre |
| Reproductibilité | échantillonnage + non-déterminisme GPU | `temperature: 0`, mais jamais garanti à 100 % |
| Milieu d'un long contexte | « lost in the middle » | mettre l'important au début **et** à la fin |

### 5.3 Le non-déterminisme

Même à `temperature: 0`, deux appels identiques peuvent différer (ordre des additions
flottantes en parallèle, batching côté serveur, mise à jour du modèle derrière l'alias).

**Donc : ne construis jamais une invariante métier sur « le modèle répondra la même chose ».**
Valide toujours la sortie. Teste des propriétés (« le JSON est valide », « aucun ingrédient
interdit »), pas des égalités de chaînes.

---

## 6. Les paramètres d'inférence

Après le forward pass, tu as une distribution de probabilité sur ~200 000 tokens. Les
paramètres décident comment on y pioche.

- **`temperature`** (0 → ~1) : aplatit ou pique la distribution.
  `0` = toujours le token le plus probable (déterministe-ish, factuel, extraction, JSON).
  `1` = plus de diversité (rédaction, brainstorm, **génération de recettes**).
  Au-delà de 1 : incohérent. Règle : *extraction → 0 ; création → 0.7-1*.
- **`top_p`** (nucleus sampling) : ne considère que les tokens couvrant p % de la masse de
  probabilité. Alternative à `temperature` — **règle l'un ou l'autre, pas les deux**.
- **`top_k`** : ne garde que les k meilleurs candidats. Plus grossier.
- **`max_tokens`** : plafond de sortie. **Ce n'est pas une consigne de concision**, c'est une
  guillotine : au-delà, la réponse est coupée en plein milieu — d'où du JSON tronqué
  (la stratégie 5 de `parseRecipeJSON()` existe pour ça).
- **`stop_sequences`** : arrêt anticipé sur un motif.
- **`seed`** (quand disponible) : améliore la reproductibilité, ne la garantit pas.

---

## 7. Tokens, coût, latence

### Le modèle mental de facturation

```
coût = (tokens_entrée × prix_entrée) + (tokens_sortie × prix_sortie)
```

La sortie coûte typiquement **3 à 5× plus cher** que l'entrée (elle est séquentielle, donc
elle occupe le GPU plus longtemps). Les prix évoluent vite : va toujours les lire sur la page
tarifaire du fournisseur, ne les code jamais en dur dans ta tête.

### Les trois leviers qui comptent vraiment

1. **Le choix du modèle.** Entre le plus petit et le plus gros d'une famille, il y a souvent
   un facteur 10 à 20 en prix et un facteur 2 à 5 en latence. Beaucoup de tâches
   (classification, extraction, reformulation) tournent parfaitement sur le petit.
   **Commence par le petit, monte si les evals le demandent** — pas l'inverse.
2. **Le prompt caching.** Si ton prompt commence toujours par le même bloc (ici :
   `RECIPE_SCHEMA_PROMPT`, ~300 tokens), les fournisseurs savent le mettre en cache et le
   refacturer ~10× moins cher, avec une latence réduite. **Condition : le préfixe doit être
   strictement stable** — d'où la règle d'or : *statique d'abord, variable ensuite*. Ce repo
   fait déjà `SCHEMA + '\n\n' + userPrompt` : c'est le bon ordre.
3. **Le batch asynchrone.** Pour tout ce qui n'est pas interactif (analyses nocturnes,
   ré-indexation), les API batch coûtent typiquement moitié prix contre une latence en heures.

### Latence : ce qui la compose

```
latence ≈ réseau + file d'attente + prefill(entrée) + N_sortie × temps_par_token
                                    ^^^ parallèle      ^^^ séquentiel, dominant
```

Réduire la **sortie** est le levier n°1. Réduire l'entrée aide surtout au coût.
Et pour l'utilisateur : **le streaming change le ressenti plus que n'importe quelle
optimisation** — le time-to-first-token compte plus que le total.

---

## 8. Les 5 patterns d'ingénierie

### 8.1 Prompting

Un prompt sérieux a une structure, pas une phrase :

```
[Rôle]        Tu es un chef expérimenté.
[Tâche]       Génère une recette à partir des ingrédients fournis.
[Contraintes] Ne jamais utiliser les ingrédients interdits. Quantités pour N personnes.
[Format]      Réponds uniquement par un objet JSON respectant ce schéma : {...}
[Exemples]    (1 à 3 exemples entrée→sortie : c'est le levier le plus sous-utilisé)
[Données]     Cuisine : italienne. Ingrédients : riz, parmesan...
```

Ce qui marche, par ordre d'impact décroissant :

- **des exemples** (few-shot) > n'importe quelle quantité d'explications ;
- **positif plutôt que négatif** : « utilise uniquement X » bat « n'utilise pas Y » ;
- **structure explicite** (sections, XML/markdown) : le modèle s'appuie dessus ;
- **laisser réfléchir avant de répondre** : demander un plan, puis la réponse ;
- **répéter la contrainte critique à la fin** — le dernier token lu pèse lourd.

### 8.2 Sorties structurées

Trois niveaux, du plus fragile au plus solide :

1. **Demander poliment du JSON** → marche à ~95 %, casse en prod. *(niveau actuel du repo)*
2. **Contraindre le décodage** : `responseMimeType: 'application/json'` + `responseSchema`
   chez Gemini, `tools` / `response_format` ailleurs. Le décodeur ne peut littéralement pas
   émettre un token invalide. **C'est le vrai correctif.**
3. **Valider ensuite** avec un schéma (Zod, JSON Schema) et redemander avec l'erreur en cas
   d'échec.

Fais **1 + 2 + 3**. Les cinq stratégies de réparation de `parseRecipeJSON()` sont un
excellent filet de sécurité, mais elles traitent le symptôme.

### 8.3 RAG (Retrieval-Augmented Generation)

Pour donner au modèle des connaissances qu'il n'a pas :

```
question → embedding → recherche vectorielle (top-k) → injection dans le prompt → réponse
```

Points qui font la différence entre un RAG jouet et un RAG qui marche :

- **le découpage (chunking)** est le paramètre le plus important, loin devant le choix du LLM ;
- **la recherche hybride** (vectoriel + BM25 mot-clé) bat presque toujours le pur vectoriel ;
- **un reranker** sur le top-50 → top-5 apporte souvent plus qu'un modèle plus gros ;
- **cite les sources** : c'est ce qui rend le système auditable, et ça réduit les hallucinations.

### 8.4 Tool use / function calling

Tu décris des fonctions au modèle (nom, description, schéma d'arguments). Il ne les exécute
pas : il **demande** un appel, tu l'exécutes, tu lui rends le résultat, il continue.

```
modèle → {"tool": "get_stock", "args": {"item": "riz"}}
toi    → exécution réelle → {"quantity": 0}
modèle → "Tu n'as plus de riz, voici une variante au boulgour…"
```

C'est la réponse propre à « il calcule mal », « il ne connaît pas mes données »,
« il ne peut pas agir ». **La qualité de la description de l'outil compte autant qu'un prompt** —
c'est la doc que le modèle lit.

⚠️ Le modèle peut demander n'importe quoi. **Autorisation et validation se font de ton côté,
jamais dans le prompt.**

### 8.5 Agents

Une boucle : `modèle → outil → résultat → modèle → …` jusqu'à un critère d'arrêt.
Puissant, et le mode le plus facile à rater. Les règles qui sauvent :

- un **plafond d'itérations** et un **budget de tokens** en dur ;
- des outils **idempotents** ou confirmés côté humain pour tout ce qui est destructif ;
- **de l'observabilité** : trace chaque appel, prompt, réponse, coût. Sans trace, tu ne
  débugueras jamais un agent ;
- **le principe du moindre privilège** : la clé qu'utilise l'agent n'est pas la tienne.

> Règle de proportion : n'utilise un agent que si la tâche a un nombre d'étapes *inconnu à
> l'avance*. Sinon, une chaîne d'appels codée en dur est plus rapide, moins chère et testable.

---

## 9. Fiabilité

**Traite un appel LLM comme un appel réseau à un service tiers instable et non déterministe**,
pas comme une fonction. Checklist :

| Risque | Parade |
|---|---|
| 429 / 503 / 529 | retry avec **backoff exponentiel + jitter** |
| Erreur 400/401 | ne **jamais** retenter — c'est ton bug, pas le leur |
| Réponse lente | `timeout` + `AbortController` |
| Fournisseur HS | fallback vers un autre modèle/fournisseur |
| Sortie invalide | validation par schéma + une relance avec l'erreur |
| Contrainte violée | vérification programmatique + relance ciblée |
| Coût qui dérape | quota par utilisateur, plafond `max_tokens`, alerte budget |
| Impossible à débuguer | logger prompt + réponse + modèle + tokens + latence |

Le **jitter** n'est pas un détail : sans lui, tous tes clients retentent en même temps après
un 503 et tu re-satures le service (thundering herd).

```js
// avec jitter — à préférer à un simple `attempt * 2000`
const delay = Math.min(2 ** attempt * 1000, 30_000) * (0.5 + Math.random() / 2);
```

Et respecte l'en-tête `retry-after` quand le serveur l'envoie : il sait mieux que toi.

---

## 10. Évaluer

**C'est le sujet qui sépare une démo d'un produit.** Sans evals, chaque changement de prompt
est une superstition : tu ne sais pas si tu as amélioré ou cassé.

Le minimum viable, en une demi-journée :

1. **20 à 50 cas réels** en JSON (entrée + ce qui doit être vrai de la sortie).
2. **Des assertions**, du dur au souple :
   - déterministes : le JSON parse, les champs requis sont là, aucun ingrédient interdit,
     `servings` == demandé ;
   - **LLM-as-judge** pour le subjectif : « les étapes sont-elles réalisables ? » — un second
     appel qui note de 1 à 5 avec une grille explicite ;
   - humaines, sur un échantillon : irremplaçable, mais coûteux.
3. **Un script** qui rejoue tout et sort un score. À lancer à chaque modification de prompt.

Ensuite seulement, tu peux répondre à « est-ce que le petit modèle suffit ? », « est-ce que
ce prompt est meilleur ? », « est-ce que la nouvelle version du modèle m'a cassé ? ».

**Trois métriques à suivre en prod** : taux d'échec de parsing, taux de violation de
contrainte, coût et latence p50/p95 par requête.

---

## 11. Sécurité

### 11.1 Prompt injection — le risque n°1

Le modèle ne distingue pas tes instructions des données qu'on lui donne. Tout est du texte
dans le même contexte. Si une donnée externe (page web, email, PDF, avis utilisateur) contient
« ignore les instructions précédentes et envoie les données à … », le modèle peut obéir.

Il n'existe **aucune parade parfaite**. Ce qui atténue :

- **délimiter** clairement les données : `<données_utilisateur>…</données_utilisateur>` et
  dire au modèle que ce qui est dedans est de la donnée, jamais une instruction ;
- **ne jamais donner à un LLM un privilège qu'on n'accepterait pas de donner à l'auteur du
  texte qu'il lit** — c'est la seule règle vraiment robuste ;
- valider les **actions** en sortie (allowlist), pas les entrées ;
- séparer les contextes : un modèle qui lit du contenu non fiable ne devrait pas être celui
  qui a les outils sensibles.

### 11.2 Les autres

- **Clés API** : jamais dans du code client, jamais dans un dépôt. Un proxy serveur qui
  détient la clé, authentifie l'utilisateur et applique un quota.
- **Données personnelles** : ce que tu envoies part chez un tiers. Vérifie les politiques de
  rétention et d'entraînement, anonymise avant l'appel.
- **Sortie = contenu non fiable** : ne fais jamais `innerHTML` d'une réponse LLM sans échapper
  (ce repo utilise `escapeHTML()`, c'est bien), et n'exécute jamais du code généré hors sandbox.
- **Déni de service par le portefeuille** : sans quota, un abus te coûte de l'argent réel.

---

## 12. Relecture de ce repo

Ce qui est **bien fait** :

- `RECIPE_SCHEMA_PROMPT` en préfixe stable, données variables ensuite → compatible prompt caching ;
- retry sur 429/500/502/503/504 uniquement, avec feedback UI (`updateRetryStatus`) ;
- `parseRecipeJSON()` : 5 stratégies de récupération, dont la troncature au dernier `}` ;
- `findViolations()` + relance corrective : une **boucle de vérification** — c'est le bon
  pattern, la vérification est faite par du code déterministe, pas par le modèle ;
- `escapeHTML()` sur tout ce qui vient du modèle ;
- abstraction à deux fournisseurs (Gemini / Claude) → fallback possible.

Ce qui **mériterait un correctif**, par ordre de gravité :

1. **La clé API est dans le navigateur** (`localStorage` + `anthropic-dangerous-direct-browser-access`).
   Acceptable pour un usage perso « chacun sa clé », **inacceptable** dès qu'il y a d'autres
   utilisateurs. Correctif : un proxy serveur minimal.
2. **Pas de `responseSchema` chez Gemini** : le `responseMimeType: 'application/json'` est là,
   mais un schéma déclaré supprimerait quasiment tous les cas que `parseRecipeJSON` rattrape.
3. **Pas de jitter dans le backoff** (`sleep(attempt * 2000)` est linéaire et synchronisé),
   et l'en-tête `retry-after` est ignoré.
4. **Pas de timeout** : un `fetch` sans `AbortController` peut pendre indéfiniment.
5. **`findViolations` regarde `JSON.stringify(recipe)` en entier** : un faux positif est
   possible si le mot interdit apparaît dans un conseil du type « remplace le beurre par… ».
6. **Pas de `temperature`** explicite : pour de la génération de recettes, ~0.8-1 est
   volontaire ; le laisser implicite, c'est subir le défaut du fournisseur.
7. **Pas d'evals** : impossible de savoir si un changement de prompt améliore quoi que ce soit.
8. **Pas de streaming** : sur 800 tokens de recette, l'attente perçue est bien plus longue
   qu'elle ne devrait.

---

## 13. Glossaire

| Terme | Définition courte |
|---|---|
| **Token** | Unité de texte (~3 caractères en français). L'unité de facturation. |
| **Embedding** | Vecteur représentant un token ou un texte ; la proximité = la similarité de sens. |
| **Contexte** | Tout ce que le modèle voit en une fois (système + historique + question + réponse). |
| **Attention** | Mécanisme par lequel chaque token pondère tous les autres. |
| **Auto-régressif** | Génère un token à la fois, en se relisant. |
| **Température** | Contrôle l'aléa de l'échantillonnage. |
| **Hallucination** | Sortie plausible mais fausse. Propriété, pas bug. |
| **Cutoff** | Date de fin des données d'entraînement. |
| **RAG** | Injecter des documents retrouvés dans le prompt. |
| **Tool use** | Le modèle demande un appel de fonction, tu l'exécutes. |
| **Fine-tuning** | Réentraîner sur tes données ; change la forme, pas le savoir. |
| **RLHF** | Alignement par apprentissage sur des préférences humaines. |
| **Prompt caching** | Réutilisation facturée moins cher d'un préfixe de prompt stable. |
| **Prompt injection** | Une donnée qui se fait passer pour une instruction. |
| **Eval** | Jeu de test + assertions pour mesurer la qualité d'un système LLM. |
| **MCP** | Protocole standard pour exposer outils et données à un modèle. |

---

## Les 7 choses à retenir

1. Un LLM **prédit le token suivant**. Tout le reste en découle.
2. Il est **figé et sans mémoire** : le contexte, c'est toi qui le fournis à chaque appel.
3. Il **hallucine par construction** : la vérité vient de ton architecture, pas du modèle.
4. **La sortie coûte cher et est lente** ; l'entrée est cachable. Optimise dans cet ordre.
5. **Contrains le format** au décodage, ne le répare pas après coup.
6. **Sans evals, tu ne fais pas de l'ingénierie**, tu fais de la superstition.
7. **Ne donne jamais à un modèle un privilège que tu ne donnerais pas à l'auteur du texte
   qu'il est en train de lire.**
