# 10 — Version automatisée (faceless + quasi-autonome)

Ce fichier **override tous les précédents**. On passe d'un **service** (ghostwriting, non-automatisable) à un **produit digital** (créé une fois, vendu à l'infini) avec acquisition X automatisée.

---

## 1. Pourquoi ce pivot est nécessaire

Un service = tu échanges temps contre argent. Impossible d'automatiser la création d'un thread custom pour un client B2B à qualité égale. Pour tourner sans toi, il faut :
- **Un produit fixe** → fabriqué 1 fois, vendu 1 000 fois.
- **Un canal de traffic automatisable** → X posts programmés à l'avance.
- **Un funnel de vente 100% self-service** → Gumroad gère paiement + livraison + support de base.
- **Des interactions prospect asynchrones** → DM auto-réponse + email drip.

Temps de toi requis **en régime de croisière** : ~3h/semaine (veille, optimisation, création nouveau contenu).

---

## 2. Le produit : **HookLab**

Un **pack digital** vendu 47€ en paiement unique (+ upsell 147€).

### Contenu du pack
Un Notion (gratuit, dupliquable) qui contient :
1. **500 hooks X viraux B2B** disséqués : texte + impressions + pourquoi ça marche + formule réutilisable.
2. **40 structures de threads** prouvées (problème-solution, teardown, liste, case study, contrarian…).
3. **100 CTAs testés** classés par objectif (follow / email / vente / DM).
4. **30 prompts IA** prêts à coller dans ChatGPT/Claude pour générer hooks dans ta niche.
5. **Swipe file** : 100 screenshots de threads à 500k+ vues avec commentaires.

### Pourquoi ça se vend
- Prix < 50€ = pas de friction (achat impulsif sur X).
- Douleur claire : fondateurs B2B en galère de contenu X.
- Alternative à engager un ghostwriter à 400€/mois.
- Valeur perçue immense (500 hooks prêts).

### Upsell "HookLab Pro" (147€)
- Tout HookLab +
- Mises à jour mensuelles (nouveaux hooks ajoutés).
- Accès privé Discord/X Circle (communauté, forme un effet de réseau, gère elle-même à terme).
- 3 templates Notion supplémentaires (calendrier éditorial, CRM prospects, tracker KPI).

### Coût de production
- Temps : 5–7 jours de rédaction intensive pour constituer HookLab.
- Argent : **0€** (Notion + Canva gratuits).

---

## 3. Stack d'automatisation complète

| Couche | Outil (gratuit) | Ce que ça automatise |
|---|---|---|
| **Produit** | Notion (free) + Gumroad | Stockage, livraison instantanée par email |
| **Paiement** | Gumroad (free, 10% commission sur free plan — basculer en plan 10$/mois dès 100€/mois de CA) | Checkout, factures, refund auto |
| **Contenu X** | Typefully (free 2/jour, Pro 15$/mois dès que besoin) | Programmation 30 jours à l'avance |
| **Génération contenu** | Claude.ai / ChatGPT (free) | Drafter les tweets/threads à partir de ton swipe file |
| **DM auto-réponse** | Typefully Inbox + macros Chrome (AutoKey / Magical) | Réponses prédéfinies en 1 clic |
| **Email drip** | Beehiiv (free) | Séquence de 7 emails post-achat pour upsell |
| **Analytics** | X Analytics + Gumroad Analytics | Tableau de bord |
| **Workflow "glue"** | Make.com (free 1 000 ops/mois) | Zapier-like : déclencheurs entre outils |

### Automatisations Make.com à configurer (1 soir de setup)

1. **Nouvel acheteur Gumroad** → ajoute email dans Beehiiv liste "Acheteurs" → déclenche séquence upsell J+1, J+3, J+7.
2. **Nouveau follower X du compte** → enregistre dans Google Sheet (pour retargeting futur).
3. **Tweet performant (> 10k impressions)** → Slack/email notif pour que tu le boostes (dépense 5€ pub).
4. **Inscription newsletter Beehiiv** → email de bienvenue avec 10 hooks gratuits (lead magnet).

---

## 4. Le funnel automatisé

```
[Tweet programmé par Typefully]
             ↓
[Lecteur voit le compte, clique bio]
             ↓
[Bio → lead magnet gratuit (10 hooks PDF)]
             ↓
[Inscription Beehiiv → email de bienvenue auto]
             ↓
[Séquence 5 emails sur 7 jours (valeur) → J5 vente HookLab]
             ↓
[Achat Gumroad → livraison auto Notion]
             ↓
[Séquence post-achat 7 jours → upsell Pro]
             ↓
[Client satisfait tweete → tu RT (seule action manuelle)]
```

Conversion réaliste (validée par dizaines de faceless pages B2B X) :
- 1% des followers achètent HookLab sur 90 jours.
- 15% des acheteurs HookLab upgrade en Pro.

### Exemple chiffré à 5 000 followers
- 5 000 followers × 1% = 50 ventes × 47€ = 2 350€
- 50 × 15% = 7 upsells × (147-47=100€) = 700€
- **Total ≈ 3 050€ sur 90 jours à partir de 5k followers**

À 15 000 followers (atteignable mois 6–9), tu dépasses 8 000€/trimestre.

---

## 5. Le compte X automatisé

### Positionnement
**@HookLab_io** (ou similaire). Brand, pas toi. Avatar logo. Bio :
```
500 hooks X viraux B2B décortiqués.

Tu écris moins. Ils lisent plus.

↓ 10 hooks gratuits
[lien Beehiiv]
```

### Format de publication (ultra-automatisable)

3 posts par jour, **programmés 30 jours à l'avance dans Typefully** :

| Slot | Type | Source |
|---|---|---|
| 8h | **Hook teardown** | "Ce hook a fait 500k vues. Voici pourquoi 🧵" — 1 exemple/jour de ton swipe file |
| 14h | **Template réutilisable** | "Template hook — formule [X] : [structure]. 5 exemples 👇" |
| 19h | **Mini-liste** | "5 hooks copier-coller pour fondateurs SaaS ce vendredi" |

1 fois par semaine : **thread complet** (plus long, plus viral) → source de followers.

### Workflow de création de contenu (2h/semaine pour 30 jours de contenu)

1. Tu ouvres ton swipe file.
2. Tu copies 21 hooks différents.
3. Pour chaque : tu demandes à Claude de générer le "teardown" texte (200 mots) en suivant un template fixe.
4. Tu copies dans Typefully, tu programmes 3/jour pendant 7 jours.
5. Pour le thread hebdo : 1 template × adaptation Claude × 45 min relecture.

**Total : 2h/semaine pour 21 posts + 1 thread = ~90 posts/mois.**

---

## 6. Ce qui reste manuel (irréductible)

Même "automatisé", il reste ~3h/semaine de taf :

| Tâche | Fréquence | Temps |
|---|---|---|
| Création batch de contenu | Hebdo | 2h |
| Réponse DMs (copier-coller templates) | 15 min/jour | 1h45/sem |
| Monitoring stats + optimisation | Hebdo | 30 min |
| Mise à jour produit (nouveaux hooks) | Mensuel | 2h/mois |
| **Total** | | **~4h/semaine** |

Si tu veux **0h/semaine**, il faudrait embaucher un VA Philippines à 5€/h → tâches déléguées, mais pas ton problème au lancement.

---

## 7. Budget revu (toujours 0–500€)

| Poste | Montant | Timing |
|---|---|---|
| Notion | 0€ | Tout |
| Gumroad | 0€ début, 9$/mois dès 100€ MRR | Mois 2 |
| Typefully free | 0€ mois 1–2 | — |
| Typefully Pro | 15$/mois | Dès mois 3 |
| Beehiiv | 0€ jusqu'à 2 500 abonnés | — |
| Make.com | 0€ free tier | — |
| Domaine .com | 12€ | Jour 1 |
| Canva | 0€ | — |
| **Pub X boost hooks viraux** | **200€** | **Mois 2 après 1 tweet 50k+ impressions** |
| Claude Pro (optionnel) | 20€/mois | Mois 2+ |
| Réserve | 200€ | Permanent |
| **Dépensé au max** | **~500€ sur 3 mois** | |

La pub X **est** l'accélérateur clé ici : un tweet qui performe organiquement + 5€/jour de boost pendant 10 jours = 500–1500 nouveaux followers ciblés.

---

## 8. Plan "DEMAIN" version automatique (1 journée)

Objectif jour 1 : infrastructure complète + produit v0.1 commencé.

- [ ] **09h00 — Nom + domaine (30 min)**
  - Nom de marque (ex: HookLab, ThreadForge, HookVault)
  - Vérifier .com + handle X dispo (namechk.com gratuit)
  - Acheter le domaine (Porkbun 12€)

- [ ] **09h30 — Comptes (1h)**
  - Gmail pro
  - Gumroad (free)
  - Beehiiv (free)
  - Typefully connecté à X
  - Notion
  - Make.com
  - Canva
  - X : nouveau compte brand ou reconvertir un existant

- [ ] **10h30 — Visuels (45 min)**
  - Logo monogramme Canva
  - Bannière X avec slogan
  - Template visuel pour tweets (optionnel)

- [ ] **11h15 — Lead magnet gratuit (1h45)**
  - PDF "10 hooks B2B gratuits" dans Canva
  - Upload dans Beehiiv comme "incentive" à l'inscription newsletter

- [ ] **13h00 — Pause**

- [ ] **14h00 — Notion HookLab v0.1 (3h)**
  - Créer la structure (DB Notion)
  - Remplir 50 hooks (commencer — tu continueras J2–J5)
  - Rendre dupliquable publiquement

- [ ] **17h00 — Gumroad produit (30 min)**
  - Créer l'offre HookLab à 47€
  - Lien du Notion dans "file delivery"
  - Email de confirmation custom

- [ ] **17h30 — Pre-lance X (30 min)**
  - 1 thread teaser : "On lance un pack de 500 hooks B2B en janvier. Voici 5 en avant-première :" → drive du trafic vers Beehiiv (pas encore Gumroad car produit pas fini)

- [ ] **18h00 — Stop.**

### J2–J7 : finir le produit + programmer 30j de contenu
- J2–J4 : compléter HookLab à 500 hooks (3–5h/jour)
- J5 : créer 30 jours de tweets dans Typefully
- J6 : setup Make.com workflows + séquence email Beehiiv
- J7 : **mise en vente officielle** → thread de lancement + offre "early bird 27€ les 48 premières heures"

---

## 9. Projections revues (faceless + automatique)

| | M1 | M2 | M3 | M6 |
|---|---|---|---|---|
| Followers X | 800 | 2 500 | 6 000 | 20 000 |
| Emails list | 150 | 500 | 1 500 | 6 000 |
| Ventes HookLab | 5 | 25 | 80 | 250 |
| Ventes Pro | 0 | 2 | 10 | 40 |
| **Revenu brut** | **235€** | **1 375€** | **5 200€** | **17 000€** |
| Temps/semaine | 25h (setup) | 10h | 5h | 3–4h |

Les chiffres M6+ sont **réalistes et observés** sur plusieurs faceless X shops B2B en 2024–2025 (cf. @Dickiebush, @heyblake, @justinwelsh adapté au "shop model"). Le mois 1 est volontairement modeste : c'est la phase de construction.

---

## 10. Règles critiques de ce modèle

1. **Ne jamais vendre avant d'avoir un produit terminé.** Si tu bricoles en live, tu perds crédibilité.
2. **Toujours tester les hooks avant de les ajouter au produit** : tu les postes, tu mesures, tu gardes uniquement ceux qui ont > 5k impressions organiques.
3. **Jamais deux plateformes au lancement.** X uniquement. LinkedIn peut venir M3+.
4. **Gumroad plan free = 10% de commission.** OK au début. Passe au plan 10$/mois dès que tu dépasses 100€/mois (rentable immédiatement).
5. **Ne sur-automatise pas les DMs.** X bannit les auto-DM. Utilise des snippets manuels (Magical, AutoKey) pour aller vite, pas un bot.
6. **Update le produit tous les 2 mois.** Les clients existants le voient, recommandent, et tu peux relancer la campagne "v2 disponible".

---

## 11. Extension naturelle (quand HookLab tourne)

Une fois stable, tu peux sortir d'autres produits "modulaires" et cross-sell à ta base :
- **ThreadLab** : 100 threads pleinement rédigés à personnaliser (97€).
- **BioLab** : 200 bios X analysées + template generator (27€).
- **CTA Vault** : 500 CTAs classés (37€).

Même audience, même canal, même infra → chaque produit additionnel = +30–50% de revenu sans refaire le funnel.

---

## 12. TL;DR

- Produit digital Notion vendu sur Gumroad à 47€ (+ upsell 147€).
- Compte X faceless qui poste 3×/jour via Typefully programmé à l'avance.
- Lead magnet PDF → newsletter Beehiiv → séquence email automatique → vente.
- Make.com orchestre les flux entre outils.
- 25h de setup la 1re semaine, puis **~4h/semaine** en régime de croisière.
- Budget **0€ strict** possible ; 200€ de pub X recommandés au mois 2.
- Première vente réaliste : J8–J10 après lancement officiel.
