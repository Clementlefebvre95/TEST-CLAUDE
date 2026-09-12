// ============================================================
// Contenu pédagogique - ANGLAIS
// Leçons de grammaire + phrases du jour (rotation quotidienne)
// ============================================================

const LESSONS_EN = [
  {
    titre: "Le présent simple",
    categorie: "Conjugaison",
    resume: "On l'utilise pour les habitudes, les vérités générales et les faits permanents.",
    points: [
      "Même forme que l'infinitif à toutes les personnes... sauf à la 3e personne du singulier qui prend -s.",
      "Négation : don't / doesn't + base verbale (pas de -s sur le verbe !).",
      "Question : Do / Does + sujet + base verbale."
    ],
    tableau: {
      titre: "to work (travailler)",
      lignes: [["I", "work"], ["you", "work"], ["he / she / it", "works"], ["we", "work"], ["they", "work"]]
    },
    exemples: [
      { src: "She works in a hospital.", fr: "Elle travaille dans un hôpital." },
      { src: "I don't drink coffee.", fr: "Je ne bois pas de café." },
      { src: "Does he speak French?", fr: "Est-ce qu'il parle français ?" }
    ],
    astuce: "Erreur classique des francophones : *He work* → il faut He workS."
  },
  {
    titre: "Le présent continu (be + -ing)",
    categorie: "Conjugaison",
    resume: "Pour une action en train de se dérouler maintenant, ou temporaire.",
    points: [
      "Formation : am / is / are + verbe-ing.",
      "Les verbes d'état (know, want, like, believe, need) ne se mettent normalement pas au -ing.",
      "Attention à l'orthographe : write → writing, run → running, study → studying."
    ],
    tableau: {
      titre: "to eat (manger)",
      lignes: [["I", "am eating"], ["you", "are eating"], ["he / she / it", "is eating"], ["we", "are eating"], ["they", "are eating"]]
    },
    exemples: [
      { src: "I'm working from home this week.", fr: "Je travaille à la maison cette semaine." },
      { src: "What are you doing?", fr: "Qu'est-ce que tu fais ?" },
      { src: "It isn't raining anymore.", fr: "Il ne pleut plus." }
    ],
    astuce: "En français on dit « je travaille » dans les deux cas ; en anglais il faut choisir : habitude = simple, maintenant = continu."
  },
  {
    titre: "Présent simple ou présent continu ?",
    categorie: "Grammaire",
    resume: "Le choix dépend de l'idée : habituel/permanent vs en cours/temporaire.",
    points: [
      "Simple : always, usually, often, every day, never.",
      "Continu : now, at the moment, today, this week, right now.",
      "I think = je pense (opinion) / I'm thinking = je réfléchis (action)."
    ],
    exemples: [
      { src: "He usually takes the bus, but today he is walking.", fr: "Il prend d'habitude le bus, mais aujourd'hui il marche." },
      { src: "Water boils at 100 degrees.", fr: "L'eau bout à 100 degrés." },
      { src: "I'm living with my parents until June.", fr: "J'habite chez mes parents jusqu'en juin." }
    ],
    astuce: "Si tu peux ajouter « en ce moment » en français, prends le continu."
  },
  {
    titre: "Le prétérit simple (verbes réguliers)",
    categorie: "Conjugaison",
    resume: "Le passé de l'action terminée, avec un moment précis dans le passé.",
    points: [
      "Formation : verbe + -ed, identique à toutes les personnes.",
      "Négation : didn't + base verbale (sans -ed) : I didn't watch.",
      "Question : Did + sujet + base verbale : Did you watch?"
    ],
    tableau: {
      titre: "to watch (regarder)",
      lignes: [["affirmatif", "I watched"], ["négatif", "I didn't watch"], ["question", "Did I watch?"]]
    },
    exemples: [
      { src: "We visited Rome last year.", fr: "Nous avons visité Rome l'année dernière." },
      { src: "She didn't answer my message.", fr: "Elle n'a pas répondu à mon message." },
      { src: "Did you call him yesterday?", fr: "Tu l'as appelé hier ?" }
    ],
    astuce: "Après did/didn't, le verbe redevient à l'infinitif : *didn't watched* est faux."
  },
  {
    titre: "20 verbes irréguliers essentiels",
    categorie: "Vocabulaire & conjugaison",
    resume: "Les verbes les plus fréquents sont justement les irréguliers : il faut les connaître par cœur.",
    points: [
      "Ordre à retenir : base / prétérit / participe passé.",
      "go → went → gone, do → did → done, have → had → had, be → was-were → been.",
      "take → took → taken, make → made → made, see → saw → seen, come → came → come."
    ],
    tableau: {
      titre: "À réciter à voix haute",
      lignes: [
        ["be", "was / were → been"], ["go", "went → gone"], ["do", "did → done"],
        ["say", "said → said"], ["get", "got → got(ten)"], ["make", "made → made"],
        ["know", "knew → known"], ["think", "thought → thought"], ["take", "took → taken"],
        ["see", "saw → seen"]
      ]
    },
    exemples: [
      { src: "I went to the market and bought some fruit.", fr: "Je suis allé au marché et j'ai acheté des fruits." },
      { src: "He told me the truth.", fr: "Il m'a dit la vérité." }
    ],
    astuce: "Apprends-les par familles de sons : think/thought, bring/brought, buy/bought."
  },
  {
    titre: "Le present perfect (have + participe passé)",
    categorie: "Conjugaison",
    resume: "Un lien entre le passé et le présent : bilan, expérience, résultat actuel.",
    points: [
      "Formation : have / has + participe passé.",
      "Jamais avec une date passée précise (yesterday, in 2019, last week).",
      "Mots typiques : ever, never, already, yet, just, since, for."
    ],
    tableau: {
      titre: "to finish",
      lignes: [["I / you / we / they", "have finished"], ["he / she / it", "has finished"], ["négation", "haven't / hasn't finished"]]
    },
    exemples: [
      { src: "I have never been to Japan.", fr: "Je ne suis jamais allé au Japon." },
      { src: "She has just arrived.", fr: "Elle vient d'arriver." },
      { src: "Have you finished your homework yet?", fr: "Tu as fini tes devoirs ?" }
    ],
    astuce: "« Je viens de » se traduit par have just + participe passé."
  },
  {
    titre: "Present perfect ou prétérit ?",
    categorie: "Grammaire",
    resume: "La question à se poser : est-ce que le moment est terminé et précis ?",
    points: [
      "Moment précis et fini → prétérit : I saw him yesterday.",
      "Période non finie ou sans date → present perfect : I have seen him twice this week.",
      "for + durée / since + point de départ / ago + prétérit."
    ],
    exemples: [
      { src: "I have lived here for ten years.", fr: "J'habite ici depuis dix ans." },
      { src: "I moved here ten years ago.", fr: "J'ai déménagé ici il y a dix ans." },
      { src: "She has worked here since 2020.", fr: "Elle travaille ici depuis 2020." }
    ],
    astuce: "« Depuis » + présent en français = present perfect en anglais, pas le présent !"
  },
  {
    titre: "Le past continuous (was/were + -ing)",
    categorie: "Conjugaison",
    resume: "Une action en cours dans le passé, souvent interrompue par une autre.",
    points: [
      "Formation : was / were + verbe-ing.",
      "Souvent avec when (prétérit) ou while (past continuous).",
      "Décor de l'histoire = continu ; événement = prétérit simple."
    ],
    exemples: [
      { src: "I was cooking when the phone rang.", fr: "Je cuisinais quand le téléphone a sonné." },
      { src: "While they were sleeping, it started to snow.", fr: "Pendant qu'ils dormaient, il s'est mis à neiger." }
    ],
    astuce: "Équivalent direct de l'imparfait français dans un récit."
  },
  {
    titre: "Le futur avec will",
    categorie: "Conjugaison",
    resume: "Décision immédiate, prédiction, promesse, proposition.",
    points: [
      "will + base verbale, invariable. Contraction : I'll, he'll.",
      "Négation : won't (= will not).",
      "Souvent avec I think, probably, maybe, I'm sure."
    ],
    exemples: [
      { src: "I'll help you with that.", fr: "Je vais t'aider avec ça." },
      { src: "It will probably rain tomorrow.", fr: "Il pleuvra probablement demain." },
      { src: "I won't tell anyone.", fr: "Je ne le dirai à personne." }
    ],
    astuce: "Le téléphone sonne, tu dis « j'y vais » → I'll get it (décision sur le moment)."
  },
  {
    titre: "Le futur avec be going to",
    categorie: "Conjugaison",
    resume: "Intention déjà décidée ou prédiction fondée sur un indice visible.",
    points: [
      "Formation : am / is / are + going to + base verbale.",
      "Intention : I'm going to start the gym next month.",
      "Preuve présente : Look at those clouds, it's going to rain."
    ],
    exemples: [
      { src: "We're going to buy a house.", fr: "Nous allons acheter une maison." },
      { src: "He's going to be late again.", fr: "Il va encore être en retard." }
    ],
    astuce: "Plan déjà en tête → going to. Décision qui vient de naître → will."
  },
  {
    titre: "Can, could, be able to",
    categorie: "Modaux",
    resume: "Exprimer la capacité, la permission et la possibilité.",
    points: [
      "can + base verbale, jamais de -s ni de to : she can swim.",
      "could = passé de can, ou demande polie.",
      "Pour les temps où can n'existe pas : be able to (I will be able to)."
    ],
    exemples: [
      { src: "Can you help me for a second?", fr: "Tu peux m'aider deux secondes ?" },
      { src: "I could read when I was four.", fr: "Je savais lire quand j'avais quatre ans." },
      { src: "Could you repeat that, please?", fr: "Pourriez-vous répéter, s'il vous plaît ?" }
    ],
    astuce: "« Je peux » et « je sais » (compétence) se disent tous les deux can."
  },
  {
    titre: "Must, have to, mustn't, don't have to",
    categorie: "Modaux",
    resume: "Obligation personnelle, obligation extérieure et interdiction.",
    points: [
      "must = obligation ressentie par celui qui parle : I must call my mother.",
      "have to = règle extérieure : I have to wear a uniform.",
      "mustn't = interdiction ; don't have to = ce n'est pas obligatoire (nuance très différente !)."
    ],
    exemples: [
      { src: "You mustn't smoke here.", fr: "Tu ne dois pas fumer ici (interdit)." },
      { src: "You don't have to come.", fr: "Tu n'es pas obligé de venir." },
      { src: "She had to leave early.", fr: "Elle a dû partir tôt." }
    ],
    astuce: "Au passé, must n'existe pas : on utilise had to."
  },
  {
    titre: "Should, ought to, had better",
    categorie: "Modaux",
    resume: "Donner un conseil ou dire ce qui serait une bonne idée.",
    points: [
      "should + base verbale = tu devrais.",
      "shouldn't = tu ne devrais pas.",
      "had better ('d better) = tu ferais mieux de (plus fort, avertissement)."
    ],
    exemples: [
      { src: "You should take a break.", fr: "Tu devrais faire une pause." },
      { src: "We shouldn't wait any longer.", fr: "Nous ne devrions pas attendre plus longtemps." },
      { src: "You'd better call her now.", fr: "Tu ferais mieux de l'appeler maintenant." }
    ],
    astuce: "Should exprime le conditionnel français « devrais », pas le futur."
  },
  {
    titre: "If clauses type 1 (le réel)",
    categorie: "Grammaire",
    resume: "Une condition possible dans le futur et sa conséquence probable.",
    points: [
      "Structure : If + présent simple, will + base verbale.",
      "Jamais de will dans la partie if !",
      "On peut remplacer will par can, may, l'impératif."
    ],
    exemples: [
      { src: "If it rains, we will stay at home.", fr: "S'il pleut, nous resterons à la maison." },
      { src: "If you finish early, call me.", fr: "Si tu finis tôt, appelle-moi." }
    ],
    astuce: "Comme en français : « si » n'est jamais suivi du futur."
  },
  {
    titre: "If clauses type 2 (l'irréel du présent)",
    categorie: "Grammaire",
    resume: "Une situation imaginaire, hypothétique ou improbable.",
    points: [
      "Structure : If + prétérit, would + base verbale.",
      "Avec le verbe be, on utilise were à toutes les personnes en anglais soigné : If I were you.",
      "Traduit le « si + imparfait, conditionnel » français."
    ],
    exemples: [
      { src: "If I had more time, I would learn Spanish.", fr: "Si j'avais plus de temps, j'apprendrais l'espagnol." },
      { src: "If I were you, I would accept.", fr: "Si j'étais toi, j'accepterais." }
    ],
    astuce: "If I was est courant à l'oral, mais If I were reste la forme correcte à l'écrit."
  },
  {
    titre: "If clauses type 3 (le regret)",
    categorie: "Grammaire",
    resume: "Ce qui aurait pu se passer mais ne s'est pas passé.",
    points: [
      "Structure : If + past perfect (had + participe), would have + participe passé.",
      "Exprime le regret ou le reproche.",
      "Contractions fréquentes à l'oral : If I'd known, I'd have come."
    ],
    exemples: [
      { src: "If I had known, I would have come.", fr: "Si j'avais su, je serais venu." },
      { src: "She would have passed if she had studied.", fr: "Elle aurait réussi si elle avait révisé." }
    ],
    astuce: "Trois éléments à retenir : had + participe / would have + participe."
  },
  {
    titre: "Les comparatifs",
    categorie: "Grammaire",
    resume: "Comparer deux éléments : plus, moins, aussi.",
    points: [
      "Adjectif court (1 syllabe) : -er + than → taller than.",
      "Adjectif long (3 syllabes ou +) : more + adjectif + than → more interesting than.",
      "Égalité : as + adjectif + as. Infériorité : less + adjectif + than.",
      "Irréguliers : good → better, bad → worse, far → further."
    ],
    exemples: [
      { src: "This book is more interesting than the other one.", fr: "Ce livre est plus intéressant que l'autre." },
      { src: "She is as tall as her brother.", fr: "Elle est aussi grande que son frère." },
      { src: "Today is worse than yesterday.", fr: "Aujourd'hui c'est pire qu'hier." }
    ],
    astuce: "Adjectif en -y : happy → happier, easy → easier."
  },
  {
    titre: "Les superlatifs",
    categorie: "Grammaire",
    resume: "Dire que quelque chose est le plus ou le moins.",
    points: [
      "Court : the + adjectif + -est → the biggest.",
      "Long : the most + adjectif → the most expensive.",
      "Irréguliers : the best, the worst, the furthest.",
      "On précise souvent avec in (lieu) ou of (groupe) : the best in the world."
    ],
    exemples: [
      { src: "It's the best restaurant in town.", fr: "C'est le meilleur restaurant de la ville." },
      { src: "That was the most difficult exam of the year.", fr: "C'était l'examen le plus difficile de l'année." }
    ],
    astuce: "En anglais on dit in town / in the world là où le français dit « de »."
  },
  {
    titre: "A, an, the ou rien du tout",
    categorie: "Grammaire",
    resume: "L'usage des articles, une des difficultés majeures pour les francophones.",
    points: [
      "a / an : une chose parmi d'autres, première mention. an devant un son voyelle (an hour, an MP3).",
      "the : élément identifié, déjà connu ou unique.",
      "Pas d'article pour les généralités au pluriel ou les indénombrables : I like music, Dogs are loyal.",
      "Pas d'article devant les pays, langues, repas : I speak English, at breakfast."
    ],
    exemples: [
      { src: "I bought a car. The car is red.", fr: "J'ai acheté une voiture. La voiture est rouge." },
      { src: "Life is beautiful.", fr: "La vie est belle." }
    ],
    astuce: "Si le français met « le/la/les » pour parler en général, l'anglais ne met rien."
  },
  {
    titre: "Dénombrables et indénombrables",
    categorie: "Grammaire",
    resume: "Some, any, much, many, a few, a little : lequel choisir ?",
    points: [
      "Dénombrables (pluriel possible) : many, a few, How many?",
      "Indénombrables (money, water, information, advice, news) : much, a little, How much?",
      "some en affirmatif et dans les offres ; any en question et négation."
    ],
    exemples: [
      { src: "How much time do we have?", fr: "Combien de temps avons-nous ?" },
      { src: "I don't have any money left.", fr: "Il ne me reste plus d'argent." },
      { src: "Would you like some tea?", fr: "Voulez-vous du thé ?" }
    ],
    astuce: "Attention : information, advice, furniture, news n'ont jamais de -s en anglais."
  },
  {
    titre: "Les questions : ordre des mots",
    categorie: "Grammaire",
    resume: "L'anglais garde toujours le même ordre : mot interrogatif + auxiliaire + sujet + verbe.",
    points: [
      "QU + AUX + S + V : Where do you live?",
      "Avec be, pas d'auxiliaire : Where are you?",
      "Question indirecte : on revient à l'ordre normal : I don't know where he lives."
    ],
    exemples: [
      { src: "What time does the train leave?", fr: "À quelle heure part le train ?" },
      { src: "Can you tell me where the station is?", fr: "Pouvez-vous me dire où est la gare ?" }
    ],
    astuce: "Erreur fréquente : *Where he lives?* → Where does he live?"
  },
  {
    titre: "Les question tags",
    categorie: "Grammaire",
    resume: "Le petit bout de phrase qui demande confirmation : « n'est-ce pas ? »",
    points: [
      "Phrase affirmative → tag négatif, et inversement.",
      "On reprend l'auxiliaire : You're French, aren't you?",
      "S'il n'y a pas d'auxiliaire, on utilise do/does/did : He works here, doesn't he?"
    ],
    exemples: [
      { src: "You've met her before, haven't you?", fr: "Tu l'as déjà rencontrée, non ?" },
      { src: "It isn't very expensive, is it?", fr: "Ce n'est pas très cher, si ?" }
    ],
    astuce: "Un seul « n'est-ce pas ? » français, mais une dizaine de tags anglais différents."
  },
  {
    titre: "La voix passive",
    categorie: "Grammaire",
    resume: "Quand l'action compte plus que celui qui la fait.",
    points: [
      "Formation : be (au temps voulu) + participe passé.",
      "L'agent est introduit par by, souvent omis.",
      "Très fréquent en anglais écrit, journalistique et technique."
    ],
    tableau: {
      titre: "to build",
      lignes: [["présent", "It is built"], ["prétérit", "It was built"], ["present perfect", "It has been built"], ["futur", "It will be built"]]
    },
    exemples: [
      { src: "This bridge was built in 1890.", fr: "Ce pont a été construit en 1890." },
      { src: "My bike has been stolen.", fr: "On m'a volé mon vélo." }
    ],
    astuce: "Le « on » français impersonnel se traduit très souvent par un passif."
  },
  {
    titre: "Les phrasal verbs incontournables",
    categorie: "Vocabulaire",
    resume: "Verbe + particule = un sens nouveau, souvent imprévisible.",
    points: [
      "give up = abandonner, look for = chercher, find out = découvrir.",
      "turn on / off = allumer / éteindre, put off = reporter, get up = se lever.",
      "Séparables : turn the light off / turn off the light. Avec un pronom, obligatoirement au milieu : turn it off."
    ],
    exemples: [
      { src: "Don't give up, you're almost there.", fr: "N'abandonne pas, tu y es presque." },
      { src: "I'm looking for my keys.", fr: "Je cherche mes clés." },
      { src: "We had to put off the meeting.", fr: "Nous avons dû reporter la réunion." }
    ],
    astuce: "Apprends le phrasal verb en bloc avec un exemple, jamais la particule seule."
  },
  {
    titre: "In, on, at : le temps",
    categorie: "Grammaire",
    resume: "Trois prépositions, trois niveaux de précision.",
    points: [
      "in + longue période : in 2025, in July, in the morning, in two weeks.",
      "on + jour ou date : on Monday, on 3 May, on my birthday.",
      "at + heure précise ou moment : at 7 pm, at night, at the weekend, at Christmas."
    ],
    exemples: [
      { src: "The meeting is on Tuesday at 9 am.", fr: "La réunion est mardi à 9h." },
      { src: "I was born in November.", fr: "Je suis né en novembre." }
    ],
    astuce: "Du plus large au plus précis : in → on → at."
  },
  {
    titre: "In, on, at : le lieu",
    categorie: "Grammaire",
    resume: "Les mêmes mots, mais une logique d'espace.",
    points: [
      "in = à l'intérieur, dans un volume : in the box, in London, in the car.",
      "on = sur une surface : on the table, on the wall, on the bus/train.",
      "at = un point, une adresse, un événement : at home, at work, at the station, at the party."
    ],
    exemples: [
      { src: "She's at work, her keys are on the table.", fr: "Elle est au travail, ses clés sont sur la table." },
      { src: "I met him at a party in Paris.", fr: "Je l'ai rencontré à une fête à Paris." }
    ],
    astuce: "in the car mais on the bus : on retient les exceptions par l'usage."
  },
  {
    titre: "Used to / be used to / get used to",
    categorie: "Grammaire",
    resume: "Trois structures proches mais très différentes.",
    points: [
      "used to + base verbale = habitude passée révolue : I used to smoke.",
      "be used to + -ing = être habitué à : I'm used to getting up early.",
      "get used to + -ing = s'habituer progressivement."
    ],
    exemples: [
      { src: "I used to live in Lyon.", fr: "J'habitais (autrefois) à Lyon." },
      { src: "He isn't used to driving on the left.", fr: "Il n'a pas l'habitude de conduire à gauche." }
    ],
    astuce: "Après be/get used TO, le verbe prend -ing : c'est un to préposition, pas un infinitif."
  },
  {
    titre: "Gérondif ou infinitif ?",
    categorie: "Grammaire",
    resume: "Certains verbes appellent -ing, d'autres to + verbe.",
    points: [
      "Suivis de -ing : enjoy, avoid, finish, mind, suggest, keep, practise.",
      "Suivis de to + verbe : want, decide, hope, need, promise, agree, learn.",
      "Après une préposition, toujours -ing : good at cooking, instead of waiting.",
      "stop doing (arrêter de faire) vs stop to do (s'arrêter pour faire)."
    ],
    exemples: [
      { src: "I enjoy learning languages.", fr: "J'aime apprendre les langues." },
      { src: "She decided to move to Madrid.", fr: "Elle a décidé de déménager à Madrid." }
    ],
    astuce: "Une phrase ne peut pas commencer par To learn... comme sujet courant : Learning languages is fun."
  },
  {
    titre: "Le discours indirect",
    categorie: "Grammaire",
    resume: "Rapporter les paroles de quelqu'un fait reculer les temps d'un cran.",
    points: [
      "présent → prétérit, prétérit → past perfect, will → would, can → could.",
      "say + phrase / tell + quelqu'un + phrase.",
      "Les repères changent : now → then, today → that day, tomorrow → the next day."
    ],
    exemples: [
      { src: "He said he was tired.", fr: "Il a dit qu'il était fatigué." },
      { src: "She told me she would call back.", fr: "Elle m'a dit qu'elle rappellerait." }
    ],
    astuce: "*He told that...* est faux : tell veut toujours un destinataire."
  },
  {
    titre: "Les pronoms relatifs",
    categorie: "Grammaire",
    resume: "Who, which, that, whose : relier deux idées dans une seule phrase.",
    points: [
      "who = personnes, which = choses, that = les deux (registre courant).",
      "whose = dont (possession) : the man whose car was stolen.",
      "Le relatif complément peut disparaître : the film (that) I saw."
    ],
    exemples: [
      { src: "The woman who lives next door is a doctor.", fr: "La femme qui habite à côté est médecin." },
      { src: "This is the book I told you about.", fr: "C'est le livre dont je t'ai parlé." }
    ],
    astuce: "En anglais la préposition se met souvent à la fin : the person I work with."
  },
  {
    titre: "Le present perfect continu",
    categorie: "Conjugaison",
    resume: "Insister sur la durée d'une activité commencée dans le passé et toujours en cours.",
    points: [
      "Formation : have / has been + verbe-ing.",
      "Souvent avec for, since, all day, how long.",
      "Le résultat visible compte : I'm tired because I've been running."
    ],
    exemples: [
      { src: "I've been waiting for an hour.", fr: "J'attends depuis une heure." },
      { src: "How long have you been learning English?", fr: "Depuis combien de temps apprends-tu l'anglais ?" }
    ],
    astuce: "Durée en cours → continu ; résultat/quantité finie → simple (I've read three books)."
  },
  {
    titre: "So, such, too, enough",
    categorie: "Grammaire",
    resume: "Nuancer l'intensité : tellement, trop, assez.",
    points: [
      "so + adjectif/adverbe : so tired. such + (a) + nom : such a good film.",
      "too + adjectif = trop (excès négatif) : too expensive.",
      "enough après l'adjectif mais avant le nom : big enough / enough time."
    ],
    exemples: [
      { src: "It was such a long day that I fell asleep.", fr: "C'était une journée si longue que je me suis endormi." },
      { src: "This coffee is too hot to drink.", fr: "Ce café est trop chaud pour être bu." },
      { src: "We don't have enough chairs.", fr: "Nous n'avons pas assez de chaises." }
    ],
    astuce: "Ne confonds pas too (trop) et very (très) : très bon = very good, pas *too good*."
  },
  {
    titre: "Le past perfect (had + participe)",
    categorie: "Conjugaison",
    resume: "Le passé avant le passé, pour remettre deux événements dans l'ordre.",
    points: [
      "Formation : had + participe passé, invariable.",
      "Souvent avec before, after, already, by the time.",
      "Sert aussi dans le discours indirect et les if clauses type 3."
    ],
    exemples: [
      { src: "When I arrived, they had already left.", fr: "Quand je suis arrivé, ils étaient déjà partis." },
      { src: "She had never seen the sea before that trip.", fr: "Elle n'avait jamais vu la mer avant ce voyage." }
    ],
    astuce: "Équivalent du plus-que-parfait français : « il était parti »."
  },
  {
    titre: "Make ou do ?",
    categorie: "Vocabulaire",
    resume: "Deux verbes traduits par « faire », mais chacun a son territoire.",
    points: [
      "make = fabriquer, produire, créer : make a cake, make a decision, make a mistake, make money.",
      "do = accomplir une tâche, une activité : do the dishes, do homework, do sport, do business.",
      "Expressions à mémoriser en bloc."
    ],
    exemples: [
      { src: "I made a mistake in my report.", fr: "J'ai fait une erreur dans mon rapport." },
      { src: "Can you do the dishes tonight?", fr: "Tu peux faire la vaisselle ce soir ?" }
    ],
    astuce: "Résultat concret ou décision → make ; corvée ou activité → do."
  }
];

const SENTENCES_EN = [
  { src: "Could you say that again, please? I didn't catch it.", fr: "Pourriez-vous répéter, s'il vous plaît ? Je n'ai pas saisi.", note: "catch = attraper, ici « comprendre au vol »." },
  { src: "I'm looking forward to meeting you.", fr: "J'ai hâte de vous rencontrer.", note: "look forward TO + -ing : c'est une préposition." },
  { src: "It's not a big deal, don't worry about it.", fr: "Ce n'est pas grave, ne t'en fais pas.", note: "a big deal = une affaire importante." },
  { src: "I'll let you know as soon as I find out.", fr: "Je te tiens au courant dès que je le saurai.", note: "Après as soon as, on met le présent, pas le futur." },
  { src: "Sorry, I'm running a bit late.", fr: "Désolé, j'ai un peu de retard.", note: "run late = être en retard (expression courante)." },
  { src: "Would you mind opening the window?", fr: "Cela vous dérangerait-il d'ouvrir la fenêtre ?", note: "Would you mind + -ing : demande très polie." },
  { src: "That makes sense to me now.", fr: "Ça a du sens pour moi maintenant.", note: "make sense = avoir du sens." },
  { src: "I used to be afraid of flying.", fr: "J'avais peur de l'avion avant.", note: "used to + base verbale = habitude passée." },
  { src: "We're running out of milk.", fr: "On n'a bientôt plus de lait.", note: "run out of = être à court de." },
  { src: "Let me know if you need a hand.", fr: "Dis-moi si tu as besoin d'un coup de main.", note: "give / need a hand = aider." },
  { src: "I've been meaning to call you all week.", fr: "Ça fait toute la semaine que je veux t'appeler.", note: "have been meaning to = avoir l'intention depuis un moment." },
  { src: "It depends on what you want to do.", fr: "Ça dépend de ce que tu veux faire.", note: "depend ON, jamais *depend of*." },
  { src: "She's really good at solving problems.", fr: "Elle est vraiment douée pour résoudre les problèmes.", note: "good at + -ing." },
  { src: "Take your time, there's no rush.", fr: "Prends ton temps, rien ne presse.", note: "no rush = pas d'urgence." },
  { src: "I can't make it tonight, I'm sorry.", fr: "Je ne peux pas venir ce soir, désolé.", note: "make it = réussir à venir / à être là." },
  { src: "Do you mind if I sit here?", fr: "Ça vous dérange si je m'assois ici ?", note: "Répondre Not at all = pas du tout (donc oui, vas-y)." },
  { src: "I'd rather stay home tonight.", fr: "Je préférerais rester à la maison ce soir.", note: "would rather + base verbale, sans to." },
  { src: "He keeps changing his mind.", fr: "Il n'arrête pas de changer d'avis.", note: "keep + -ing = n'arrêter pas de." },
  { src: "Let's get down to business.", fr: "Passons aux choses sérieuses.", note: "Expression très utilisée en réunion." },
  { src: "I'm not sure I follow you.", fr: "Je ne suis pas sûr de te suivre.", note: "Manière polie de dire « je ne comprends pas »." },
  { src: "It's worth trying at least once.", fr: "Ça vaut le coup d'essayer au moins une fois.", note: "be worth + -ing." },
  { src: "She turned down the job offer.", fr: "Elle a refusé l'offre d'emploi.", note: "turn down = refuser (ou baisser le son)." },
  { src: "I'm getting used to the new schedule.", fr: "Je commence à m'habituer au nouveau planning.", note: "get used to + nom ou -ing." },
  { src: "As far as I know, the shop is still open.", fr: "Pour autant que je sache, le magasin est encore ouvert.", note: "as far as I know = à ma connaissance." },
  { src: "We ran into each other at the airport.", fr: "On s'est croisés par hasard à l'aéroport.", note: "run into someone = tomber sur quelqu'un." },
  { src: "Could you keep an eye on my bag?", fr: "Tu peux surveiller mon sac ?", note: "keep an eye on = garder un œil sur." },
  { src: "I completely forgot about the meeting.", fr: "J'ai complètement oublié la réunion.", note: "forget about something." },
  { src: "It's about time we left.", fr: "Il est grand temps qu'on parte.", note: "It's about time + prétérit, structure irrégulière." },
  { src: "He's been working here since 2018.", fr: "Il travaille ici depuis 2018.", note: "since + date, present perfect obligatoire." },
  { src: "I don't feel like cooking tonight.", fr: "Je n'ai pas envie de cuisiner ce soir.", note: "feel like + -ing = avoir envie de." },
  { src: "Sorry to bother you, but do you have a minute?", fr: "Désolé de vous déranger, auriez-vous une minute ?", note: "bother = déranger." },
  { src: "That's exactly what I was going to say.", fr: "C'est exactement ce que j'allais dire.", note: "was going to = futur dans le passé." },
  { src: "Make yourself at home.", fr: "Fais comme chez toi.", note: "Formule d'accueil standard." },
  { src: "I'll take care of it right away.", fr: "Je m'en occupe tout de suite.", note: "take care of = s'occuper de." },
  { src: "The sooner, the better.", fr: "Le plus tôt sera le mieux.", note: "Structure the + comparatif, the + comparatif." },
  { src: "I'm afraid I have some bad news.", fr: "J'ai bien peur d'avoir une mauvaise nouvelle.", note: "I'm afraid = formule d'atténuation, pas la peur." },
  { src: "You'd better double-check before sending it.", fr: "Tu ferais mieux de vérifier deux fois avant d'envoyer.", note: "had better + base verbale." },
  { src: "Things are getting better little by little.", fr: "Les choses s'améliorent petit à petit.", note: "get + comparatif = devenir de plus en plus." },
  { src: "What do you do for a living?", fr: "Qu'est-ce que tu fais dans la vie ?", note: "Question standard pour demander le métier." },
  { src: "I couldn't agree more.", fr: "Je suis entièrement d'accord.", note: "Littéralement « je ne pourrais pas être plus d'accord »." },
  { src: "We'll figure it out together.", fr: "On trouvera une solution ensemble.", note: "figure out = comprendre, résoudre." },
  { src: "He apologised for being late.", fr: "Il s'est excusé d'être en retard.", note: "apologise FOR + -ing." },
  { src: "It happens all the time.", fr: "Ça arrive tout le temps.", note: "all the time = tout le temps, très fréquent." },
  { src: "Let me think it over.", fr: "Laisse-moi y réfléchir.", note: "think over = peser le pour et le contre." },
  { src: "I'm on my way.", fr: "Je suis en route.", note: "À envoyer par SMS quand on part." },
  { src: "Long time no see!", fr: "Ça fait longtemps qu'on ne s'est pas vus !", note: "Expression figée, grammaticalement incorrecte mais universelle." },
  { src: "Do you want me to give you a lift?", fr: "Tu veux que je te dépose ?", note: "give someone a lift (GB) / a ride (US)." },
  { src: "I got the hang of it after a few tries.", fr: "J'ai pris le coup de main après quelques essais.", note: "get the hang of = prendre le coup." },
  { src: "She's been through a lot this year.", fr: "Elle a traversé beaucoup d'épreuves cette année.", note: "go through = traverser (une épreuve)." },
  { src: "Better late than never.", fr: "Mieux vaut tard que jamais.", note: "Proverbe identique en français." }
];
