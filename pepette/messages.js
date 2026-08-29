// ============================================================
// Pepette — messages personnalisés
// Période couverte : 1er septembre → 31 décembre
//
// Trois sources de texte :
//   1. special[]  : messages datés (jour précis), prioritaires
//   2. pools{}    : réserve par mois, tirée de façon stable pour un jour donné
//   3. espagnol[] : messages en espagnol (+ traduction française)
//
// Le tirage est DÉTERMINISTE : la même date donne toujours le même message,
// donc pepette ne voit jamais deux fois la même phrase dans la journée.
// ============================================================

const PEPETTE_MESSAGES = {

  // ----------------------------------------------------------
  // 1. Messages datés — clé "MM-JJ"
  //    Un tableau : si plusieurs phrases, une seule est tirée (stable).
  // ----------------------------------------------------------
  special: {

    // --- Avant le départ ---------------------------------------------------
    "09-01": [
      "Nouveau mois, pepette. Septembre commence et il commence par toi. ☀️",
      "Plus que deux jours avant l’Espagne. J’espère que ta valise est plus organisée que mes pensées quand je te regarde.",
    ],
    "09-02": [
      "Dernière soirée avant le grand départ. Repose-toi bien pepette, demain tu t’envoles. 🧳",
      "Veille de départ. Prends ton chargeur, ton passeport, et un peu de moi dans ta poche.",
    ],

    // --- 3 septembre : départ en Espagne -----------------------------------
    "09-03": [
      "Ça y est pepette, l’Espagne t’attend. Profite de chaque tapa, de chaque ruelle, de chaque coucher de soleil. ¡Buen viaje mi amor! Je compte déjà les jours jusqu’au 7. ✈️🇪🇸",
      "Bon voyage ma pepette. Fais bien attention à toi là-bas, ris beaucoup, dors un peu, et reviens-moi entière le 7. ✈️",
    ],

    // --- Pendant le séjour (4 → 6 septembre) --------------------------------
    "09-04": [
      "Premier vrai jour en Espagne. J’espère que le soleil est à la hauteur de toi — spoiler : c’est impossible. 🌞",
      "Buenos días pepette. Petit-déjeuner au soleil, journée entière devant toi. Profite, tu l’as mérité.",
    ],
    "09-05": [
      "Deuxième jour là-bas. Bois de l’eau, mets de la crème, et envoie-moi une photo du ciel. 🇪🇸",
      "J’espère que tu es en train de rire quelque part au soleil pendant que je lis ça. C’est exactement ce que je te souhaite.",
    ],
    "09-06": [
      "Dernier jour en Espagne, pepette. Savoure-le à fond — demain tu rentres et je t’attends. 🧡",
      "Dernier coucher de soleil espagnol. Regarde-le bien pour deux.",
    ],

    // --- 7 septembre : retour ----------------------------------------------
    "09-07": [
      "Aujourd’hui tu rentres. L’Espagne t’a eue 4 jours, c’était déjà 4 de trop. Bon retour ma pepette. 🏡❤️",
      "Retour à la maison. Ta valise sera pleine de sable et de souvenirs — raconte-moi tout, j’ai le temps. ✈️🏡",
    ],
    "09-08": [
      "Premier jour d’après-Espagne. Le décalage, c’est pas l’heure, c’est juste que tout est plus calme sans les vacances.",
      "Retour à la routine, pepette. Mais la routine avec toi, ça reste mon endroit préféré.",
    ],

    // --- Repères de saison --------------------------------------------------
    "09-22": ["Premier jour d’automne. Les feuilles tombent, moi aussi, mais pour toi. 🍂"],
    "09-30": ["Dernier jour de septembre. On a passé un mois de plus ensemble, et c’est ma statistique préférée."],
    "10-01": ["Octobre, pepette. Le mois des pulls trop grands, des thés brûlants et des soirées sans envie de sortir. Mon préféré. 🍁"],
    "10-31": ["Joyeux Halloween pepette 🎃 Le seul truc effrayant ici, c’est le nombre de messages que je t’écris."],
    "11-01": ["Novembre commence. Le mois gris devient supportable dès que tu souris. ☕"],
    "11-11": ["Jour férié pepette. Traduction : une journée de plus pour ne rien faire, ensemble si possible."],
    "11-30": ["Dernier jour de novembre. Demain on allume les guirlandes, promis. ✨"],
    "12-01": ["1er décembre. Premier chocolat du calendrier, première guirlande, premier « il fait vraiment froid ». Décembre est là. 🎄"],
    "12-06": ["Décembre file, pepette. Emmitoufle-toi bien aujourd’hui. 🧣"],
    "12-24": ["Joyeux réveillon ma pepette 🎄 Profite des tiens ce soir, mange trop, ris fort. Tu es mon plus beau cadeau de l’année."],
    "12-25": ["Joyeux Noël pepette ❤️ Que cette journée soit douce, lente et pleine de gens qui t’aiment. J’en fais partie, en première ligne."],
    "12-31": ["Dernier jour de l’année, pepette. Merci pour ces mois-là — l’Espagne, l’automne, les soirées sans rien faire. On remet ça l’année prochaine ? 🥂"],
  },

  // ----------------------------------------------------------
  // 2. Réserve par mois (9 = septembre … 12 = décembre)
  // ----------------------------------------------------------
  pools: {

    9: [
      "Bonjour pepette. Où que tu ailles aujourd’hui, tu es déjà la meilleure partie de ma journée. ☀️",
      "L’été s’en va, mais toi tu restes ma plus belle saison.",
      "Petit rappel de septembre : tu fais bien plus que ce que tu crois faire.",
      "J’espère que ton café est chaud et ta journée douce, pepette. ☕",
      "Rentrée, agenda, réveil trop tôt… et toi qui gères tout ça. Chapeau ma pepette.",
      "Si la journée est longue, souviens-toi qu’elle finit toujours quelque part au calme.",
      "Tu as le droit de ralentir aujourd’hui. Personne ne compte les points.",
      "Le soleil de septembre est le plus doux de l’année. Comme toi, en fait.",
      "Pense à boire de l’eau, à manger un vrai truc, et à te reposer. C’est tout ce que je demande. 💧",
      "Il y a des gens qui rendent les lundis supportables. Tu es toute la semaine.",
      "Bonne journée pepette. Je ne suis pas loin, même quand je ne dis rien.",
      "Petite pensée de septembre : tu es entourée de gens qui t’aiment, dont un particulièrement bavard.",
      "Ce soir, pull, plaid, rien à faire. Ça se mérite, et tu l’as mérité.",
      "Fin d’été, début de tout le reste. On y va ensemble, pepette. 🍂",
    ],

    10: [
      "Octobre, pepette. Le mois où on a enfin le droit de rester sous un plaid sans se justifier. 🍁",
      "Il fait gris ? Toi non. Bonne journée ma pepette.",
      "Un thé, une couverture, une série idiote. Programme validé pour ce soir. ☕",
      "Tu portes des couches de vêtements et je porte de l’admiration. Chacun son style.",
      "Les feuilles tombent, la lumière change, et tu restes le truc le plus constant de mes journées.",
      "Petit rappel d’automne : tu n’as pas à être productive tous les jours pour avoir de la valeur.",
      "J’espère que tu as bien dormi pepette. Sinon, sieste autorisée, c’est signé.",
      "Il fait nuit à 19h et j’ai déjà envie que tu sois là.",
      "Prends ton écharpe. Oui, aujourd’hui aussi. 🧣",
      "Journée d’octobre = 60 % de café, 40 % de courage. Tu gères les deux.",
      "Si tu lis ça, souffle un coup. Voilà. C’est déjà mieux.",
      "Tu es la seule bonne raison que je connaisse d’aimer les jours qui raccourcissent.",
      "Bonne soirée pepette. Range le téléphone, allume une bougie, respire.",
      "Automne, pluie, chaussettes épaisses : le monde est bien fait quand tu es dedans.",
    ],

    11: [
      "Novembre, pepette. Le mois le plus long de l’année — sauf quand tu es là. ☕",
      "Bonjour ma pepette. Objectif du jour : traverser la journée, et c’est déjà beaucoup.",
      "Le ciel est bas, mais tes journées n’ont pas à l’être.",
      "Un mois gris supporte très bien une personne lumineuse. Ça tombe bien.",
      "Petit rappel : tu as le droit d’annuler des trucs pour rester au chaud. 🛋️",
      "J’espère que quelqu’un t’a fait rire aujourd’hui. Sinon, dis-le-moi, je m’en occupe.",
      "Novembre c’est fait pour les soupes, les gros pulls et les gens qu’on aime. Tu coches trois cases.",
      "Ne te compare à personne aujourd’hui, pepette. Tu es hors catégorie.",
      "Si ta journée est nulle, elle est juste nulle. Elle ne dit rien sur toi.",
      "Bonne nuit pepette. Demain sera plus doux, et je serai encore là.",
      "Le froid arrive. Heureusement, tu as un stock illimité de câlins en attente. 🧡",
      "Un mois de plus, et toujours la même chance de t’avoir.",
      "Chocolat chaud obligatoire ce soir. C’est la règle de novembre.",
      "Tiens bon pepette, décembre est juste derrière la porte. ✨",
    ],

    12: [
      "Décembre, pepette. Guirlandes, odeurs de cannelle, et toi. Rien à ajouter. 🎄",
      "Bonjour ma pepette. Il fait froid dehors et chaud partout où tu es.",
      "Fin d’année : bilan rapide, tu es ce qu’il m’est arrivé de mieux. ❤️",
      "Ne cours pas trop pour les cadeaux. Ta présence suffit largement à tout le monde.",
      "Les journées sont courtes, tant mieux : on rentre plus tôt sous le plaid. 🛋️",
      "Chocolat chaud, marché de Noël, mains froides. Programme parfait avec toi. ☕",
      "Petit rappel de décembre : tu n’es pas obligée d’être partout pour tout le monde.",
      "J’espère que ta journée sent bon le sapin et le repos.",
      "Décembre est le mois des gens qu’on aime, donc c’est un peu ton mois.",
      "Bonne soirée pepette. Guirlandes allumées, téléphone éteint, tout va bien.",
      "Il paraît qu’il va neiger. Il paraît surtout que tu es la plus belle chose de cet hiver. ❄️",
      "Cette année a été ce qu’elle a été. Toi, tu as été formidable.",
      "Emmitoufle-toi bien aujourd’hui pepette, il fait un froid de canard. 🧣",
      "Encore quelques jours et on tourne la page ensemble. 🥂",
    ],
  },

  // ----------------------------------------------------------
  // 3. Messages en espagnol (traduction fournie)
  //    Utilisables toute l'année, mais surtout du 3 au 7 septembre.
  // ----------------------------------------------------------
  espagnol: [
    { es: "Buenos días pepette. Que tengas un día tan bonito como tú. ☀️", fr: "Bonjour pepette. Que ta journée soit aussi belle que toi." },
    { es: "¡Buen viaje mi amor! España tiene suerte de tenerte unos días. ✈️", fr: "Bon voyage mon amour ! L’Espagne a de la chance de t’avoir quelques jours." },
    { es: "Te echo de menos, pepette. Vuelve pronto. 🧡", fr: "Tu me manques, pepette. Reviens vite." },
    { es: "Disfruta cada tapa, cada calle, cada atardecer. 🌅", fr: "Profite de chaque tapa, chaque ruelle, chaque coucher de soleil." },
    { es: "Cuídate mucho allí, ¿vale? Bebe agua y ponte crema. 💧", fr: "Prends bien soin de toi là-bas, d’accord ? Bois de l’eau et mets de la crème." },
    { es: "Hoy vuelves a casa. Te espero, pepette. 🏡", fr: "Aujourd’hui tu rentres à la maison. Je t’attends, pepette." },
    { es: "Eres mi lugar favorito, no importa el país. ❤️", fr: "Tu es mon endroit préféré, peu importe le pays." },
    { es: "Que el sol de España sea la mitad de bonito que tu sonrisa. 🌞", fr: "Que le soleil d’Espagne soit à moitié aussi beau que ton sourire." },
    { es: "Buenas noches pepette. Sueña con cosas bonitas. 🌙", fr: "Bonne nuit pepette. Fais de beaux rêves." },
    { es: "No hay prisa hoy. Descansa, te lo mereces.", fr: "Pas de précipitation aujourd’hui. Repose-toi, tu le mérites." },
    { es: "Un abrazo enorme desde aquí, pepette. 🤗", fr: "Un énorme câlin d’ici, pepette." },
    { es: "Hoy también eres suficiente. Siempre lo eres.", fr: "Aujourd’hui aussi tu es suffisante. Tu l’es toujours." },
    { es: "Hace frío fuera, pero contigo siempre es verano. ❄️", fr: "Il fait froid dehors, mais avec toi c’est toujours l’été." },
    { es: "Cuéntamelo todo cuando vuelvas. Tengo tiempo.", fr: "Raconte-moi tout quand tu rentres. J’ai le temps." },
    { es: "Feliz Navidad, pepette. Eres mi mejor regalo. 🎄", fr: "Joyeux Noël, pepette. Tu es mon plus beau cadeau." },
    { es: "Feliz año nuevo mi amor. Otro año contigo, por favor. 🥂", fr: "Bonne année mon amour. Encore une année avec toi, s’il te plaît." },
    { es: "Estoy orgulloso de ti, aunque no te lo diga suficiente.", fr: "Je suis fier de toi, même si je ne te le dis pas assez." },
    { es: "Respira, pepette. Todo va a salir bien.", fr: "Respire, pepette. Tout va bien se passer." },
    { es: "Mi día empieza de verdad cuando hablo contigo.", fr: "Ma journée commence vraiment quand je te parle." },
    { es: "Vuelve con hambre de historias, yo te escucho. 🇪🇸", fr: "Reviens avec plein d’histoires, je t’écoute." },
  ],
};

// ============================================================
// Sélection
// ============================================================

/** Clé "MM-JJ" pour une date donnée. */
function cleJour(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const jj = String(date.getDate()).padStart(2, "0");
  return mm + "-" + jj;
}

/** Tirage stable : la même date renvoie toujours le même index. */
function indexStable(date, longueur) {
  if (!longueur) return 0;
  const graine = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  // petit hash pour éviter que deux jours consécutifs tombent côte à côte
  const melange = (graine * 2654435761) % 4294967296;
  return Math.abs(melange) % longueur;
}

/**
 * Message du jour.
 * @param {Date}    date
 * @param {object}  options
 * @param {boolean} options.espagnol  force un message en espagnol
 * @returns {{texte: string, type: string, traduction?: string}}
 */
function messageDuJour(date = new Date(), options = {}) {
  if (options.espagnol) {
    const m = PEPETTE_MESSAGES.espagnol[indexStable(date, PEPETTE_MESSAGES.espagnol.length)];
    return { texte: m.es, traduction: m.fr, type: "espagnol" };
  }

  const cle = cleJour(date);
  const dates = PEPETTE_MESSAGES.special[cle];
  if (dates && dates.length) {
    return { texte: dates[indexStable(date, dates.length)], type: "special" };
  }

  const pool = PEPETTE_MESSAGES.pools[date.getMonth() + 1];
  if (pool && pool.length) {
    return { texte: pool[indexStable(date, pool.length)], type: "mois" };
  }

  return { texte: "Bonne journée pepette. ❤️", type: "defaut" };
}

/** Message en espagnol du jour (raccourci). */
function messageEspagnolDuJour(date = new Date()) {
  return messageDuJour(date, { espagnol: true });
}

// Export navigateur + module
if (typeof window !== "undefined") {
  window.PEPETTE_MESSAGES = PEPETTE_MESSAGES;
  window.messageDuJour = messageDuJour;
  window.messageEspagnolDuJour = messageEspagnolDuJour;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PEPETTE_MESSAGES, messageDuJour, messageEspagnolDuJour, cleJour };
}
