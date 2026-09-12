// ============================================================
// Contenu pédagogique - ESPAGNOL
// Leçons de grammaire + phrases du jour (rotation quotidienne)
// ============================================================

const LESSONS_ES = [
  {
    titre: "Le présent des verbes en -ar",
    categorie: "Conjugaison",
    resume: "Le premier groupe espagnol, le plus nombreux et le plus régulier.",
    points: [
      "On enlève -ar et on ajoute les terminaisons : -o, -as, -a, -amos, -áis, -an.",
      "Le pronom sujet (yo, tú...) est facultatif : la terminaison suffit.",
      "Même modèle pour trabajar, estudiar, cantar, comprar, viajar."
    ],
    tableau: {
      titre: "hablar (parler)",
      lignes: [["yo", "hablo"], ["tú", "hablas"], ["él / ella / usted", "habla"], ["nosotros", "hablamos"], ["vosotros", "habláis"], ["ellos / ustedes", "hablan"]]
    },
    exemples: [
      { src: "Hablo español todos los días.", fr: "Je parle espagnol tous les jours." },
      { src: "¿Trabajas el sábado?", fr: "Tu travailles samedi ?" }
    ],
    astuce: "En espagnol on omet le sujet : dire « yo hablo » partout sonne lourd."
  },
  {
    titre: "Le présent des verbes en -er et -ir",
    categorie: "Conjugaison",
    resume: "Deux groupes presque identiques, sauf à nosotros et vosotros.",
    points: [
      "-er : -o, -es, -e, -emos, -éis, -en (comer).",
      "-ir : -o, -es, -e, -imos, -ís, -en (vivir).",
      "La seule différence est donc aux deux premières personnes du pluriel."
    ],
    tableau: {
      titre: "comer / vivir",
      lignes: [["yo", "como / vivo"], ["tú", "comes / vives"], ["él", "come / vive"], ["nosotros", "comemos / vivimos"], ["vosotros", "coméis / vivís"], ["ellos", "comen / viven"]]
    },
    exemples: [
      { src: "Vivimos en Madrid desde hace dos años.", fr: "Nous habitons à Madrid depuis deux ans." },
      { src: "¿Qué comes normalmente?", fr: "Qu'est-ce que tu manges d'habitude ?" }
    ],
    astuce: "desde hace + durée = depuis (durée), desde + date = depuis (point de départ)."
  },
  {
    titre: "Ser ou estar ?",
    categorie: "Grammaire",
    resume: "Deux verbes pour « être », c'est LA difficulté de l'espagnol.",
    points: [
      "SER : identité, origine, profession, caractère, heure, possession. Ce qui définit.",
      "ESTAR : lieu, état passager, humeur, résultat. Ce qui peut changer.",
      "Ser + adjectif = caractéristique ; estar + adjectif = état du moment."
    ],
    tableau: {
      titre: "Comparaison",
      lignes: [["Es guapo", "Il est beau (en général)"], ["Está guapo", "Il est beau (ce soir)"], ["Es aburrido", "Il est ennuyeux"], ["Está aburrido", "Il s'ennuie"], ["Soy de Francia", "Je viens de France"], ["Estoy en Francia", "Je suis en France"]]
    },
    exemples: [
      { src: "Soy profesor, pero hoy estoy de vacaciones.", fr: "Je suis professeur, mais aujourd'hui je suis en vacances." },
      { src: "La sopa está fría.", fr: "La soupe est froide (maintenant)." }
    ],
    astuce: "Un lieu est presque toujours avec estar... sauf un événement : la fiesta es en mi casa."
  },
  {
    titre: "Les verbes à diphtongue e → ie",
    categorie: "Conjugaison",
    resume: "Le e du radical devient ie quand l'accent tonique tombe dessus.",
    points: [
      "Le changement touche yo, tú, él et ellos ; pas nosotros ni vosotros.",
      "Verbes concernés : pensar, querer, empezar, entender, cerrar, preferir, sentir.",
      "On les appelle verbes à affaiblissement ou verbes-bottes (la forme du tableau)."
    ],
    tableau: {
      titre: "querer (vouloir)",
      lignes: [["yo", "quiero"], ["tú", "quieres"], ["él", "quiere"], ["nosotros", "queremos"], ["vosotros", "queréis"], ["ellos", "quieren"]]
    },
    exemples: [
      { src: "Quiero aprender español rápido.", fr: "Je veux apprendre l'espagnol vite." },
      { src: "La película empieza a las ocho.", fr: "Le film commence à huit heures." }
    ],
    astuce: "Dessine la « botte » : les 4 formes qui diphtonguent forment une botte dans le tableau."
  },
  {
    titre: "Les verbes à diphtongue o → ue",
    categorie: "Conjugaison",
    resume: "Même logique que e → ie, mais avec le son o.",
    points: [
      "poder, dormir, volver, encontrar, contar, recordar, costar, morir.",
      "Cas particulier : jugar → juego (u → ue).",
      "Toujours la même botte : nosotros et vosotros restent réguliers."
    ],
    tableau: {
      titre: "poder (pouvoir)",
      lignes: [["yo", "puedo"], ["tú", "puedes"], ["él", "puede"], ["nosotros", "podemos"], ["vosotros", "podéis"], ["ellos", "pueden"]]
    },
    exemples: [
      { src: "No puedo ir esta noche.", fr: "Je ne peux pas y aller ce soir." },
      { src: "¿Cuánto cuesta este libro?", fr: "Combien coûte ce livre ?" }
    ],
    astuce: "Duermo, vuelvo, encuentro : dès que tu entends l'accent sur le o, il devient ue."
  },
  {
    titre: "Les verbes à affaiblissement e → i",
    categorie: "Conjugaison",
    resume: "Uniquement des verbes en -ir : le e devient i.",
    points: [
      "pedir, repetir, servir, seguir, vestirse, medir.",
      "Même botte : pido, pides, pide, pedimos, pedís, piden.",
      "seguir perd le u devant o : sigo (et non *siguo*)."
    ],
    tableau: {
      titre: "pedir (demander)",
      lignes: [["yo", "pido"], ["tú", "pides"], ["él", "pide"], ["nosotros", "pedimos"], ["vosotros", "pedís"], ["ellos", "piden"]]
    },
    exemples: [
      { src: "Siempre pido lo mismo en este bar.", fr: "Je commande toujours la même chose dans ce bar." },
      { src: "¿Puedes repetir, por favor?", fr: "Tu peux répéter, s'il te plaît ?" }
    ],
    astuce: "pedir = demander/commander ; preguntar = poser une question. Ne pas confondre."
  },
  {
    titre: "Les irréguliers de la 1re personne",
    categorie: "Conjugaison",
    resume: "Beaucoup de verbes ne sont irréguliers qu'au yo du présent.",
    points: [
      "-go : hacer → hago, poner → pongo, salir → salgo, tener → tengo, venir → vengo, decir → digo.",
      "-zco : conocer → conozco, conducir → conduzco, traducir → traduzco.",
      "Autres : saber → sé, dar → doy, ver → veo, estar → estoy."
    ],
    tableau: {
      titre: "tener (avoir)",
      lignes: [["yo", "tengo"], ["tú", "tienes"], ["él", "tiene"], ["nosotros", "tenemos"], ["vosotros", "tenéis"], ["ellos", "tienen"]]
    },
    exemples: [
      { src: "Hago deporte tres veces por semana.", fr: "Je fais du sport trois fois par semaine." },
      { src: "No conozco a su hermana.", fr: "Je ne connais pas sa sœur." }
    ],
    astuce: "tener combine les deux irrégularités : -go au yo et diphtongue e → ie ailleurs."
  },
  {
    titre: "Estar + gerundio (l'action en cours)",
    categorie: "Conjugaison",
    resume: "L'équivalent de « être en train de ».",
    points: [
      "Formation du gérondif : -ar → -ando, -er/-ir → -iendo.",
      "Irréguliers : leer → leyendo, dormir → durmiendo, decir → diciendo, pedir → pidiendo.",
      "Structure : estar conjugué + gerundio."
    ],
    exemples: [
      { src: "Estoy estudiando para el examen.", fr: "Je suis en train d'étudier pour l'examen." },
      { src: "¿Qué estás haciendo?", fr: "Qu'est-ce que tu fais (là, maintenant) ?" }
    ],
    astuce: "Contrairement à l'anglais, on ne l'utilise pas pour le futur : *estoy yendo mañana* est faux."
  },
  {
    titre: "Le pretérito perfecto (he hablado)",
    categorie: "Conjugaison",
    resume: "Le passé composé espagnol, pour un passé relié au présent.",
    points: [
      "Formation : haber (he, has, ha, hemos, habéis, han) + participe passé.",
      "Participe : -ar → -ado, -er/-ir → -ido.",
      "Irréguliers : hecho (hacer), dicho (decir), visto (ver), escrito (escribir), puesto (poner), vuelto (volver), abierto (abrir).",
      "Mots déclencheurs : hoy, esta semana, este año, ya, todavía no, nunca."
    ],
    exemples: [
      { src: "Hoy he comido demasiado.", fr: "Aujourd'hui j'ai trop mangé." },
      { src: "Nunca he estado en Argentina.", fr: "Je ne suis jamais allé en Argentine." }
    ],
    astuce: "Le participe ne s'accorde JAMAIS après haber : he escrito una carta (pas *escrita*)."
  },
  {
    titre: "Le pretérito indefinido (réguliers)",
    categorie: "Conjugaison",
    resume: "Le passé simple espagnol, très utilisé à l'oral pour un fait terminé.",
    points: [
      "-ar : -é, -aste, -ó, -amos, -asteis, -aron.",
      "-er / -ir : -í, -iste, -ió, -imos, -isteis, -ieron.",
      "Mots déclencheurs : ayer, anoche, el año pasado, en 2019, hace dos años."
    ],
    tableau: {
      titre: "hablar / comer",
      lignes: [["yo", "hablé / comí"], ["tú", "hablaste / comiste"], ["él", "habló / comió"], ["nosotros", "hablamos / comimos"], ["vosotros", "hablasteis / comisteis"], ["ellos", "hablaron / comieron"]]
    },
    exemples: [
      { src: "Ayer hablé con mi jefe.", fr: "Hier j'ai parlé avec mon patron." },
      { src: "Comimos en un restaurante italiano.", fr: "Nous avons mangé dans un restaurant italien." }
    ],
    astuce: "Les accents changent tout : hablo (je parle) ≠ habló (il parla)."
  },
  {
    titre: "Les indefinidos irréguliers",
    categorie: "Conjugaison",
    resume: "Les verbes les plus fréquents ont un radical à part et aucun accent écrit.",
    points: [
      "ser et ir se conjuguent pareil : fui, fuiste, fue, fuimos, fuisteis, fueron.",
      "tener → tuve, estar → estuve, poder → pude, poner → puse, saber → supe, hacer → hice.",
      "decir → dije, traer → traje (attention : dijeron, trajeron, sans i)."
    ],
    tableau: {
      titre: "tener",
      lignes: [["yo", "tuve"], ["tú", "tuviste"], ["él", "tuvo"], ["nosotros", "tuvimos"], ["vosotros", "tuvisteis"], ["ellos", "tuvieron"]]
    },
    exemples: [
      { src: "Fue un día muy largo.", fr: "Ce fut une journée très longue." },
      { src: "No pude venir porque tuve una reunión.", fr: "Je n'ai pas pu venir parce que j'ai eu une réunion." }
    ],
    astuce: "Ces irréguliers n'ont jamais d'accent écrit : tuve, hice, dije."
  },
  {
    titre: "L'imparfait (pretérito imperfecto)",
    categorie: "Conjugaison",
    resume: "Le temps des descriptions, des habitudes et du décor passé.",
    points: [
      "-ar : -aba, -abas, -aba, -ábamos, -abais, -aban.",
      "-er / -ir : -ía, -ías, -ía, -íamos, -íais, -ían.",
      "Seulement trois irréguliers : ser (era), ir (iba), ver (veía)."
    ],
    tableau: {
      titre: "hablar / comer",
      lignes: [["yo", "hablaba / comía"], ["tú", "hablabas / comías"], ["él", "hablaba / comía"], ["nosotros", "hablábamos / comíamos"], ["ellos", "hablaban / comían"]]
    },
    exemples: [
      { src: "Cuando era niño, iba a la playa cada verano.", fr: "Quand j'étais enfant, j'allais à la plage chaque été." },
      { src: "Llovía y hacía frío.", fr: "Il pleuvait et il faisait froid." }
    ],
    astuce: "Seulement trois irréguliers : c'est le temps le plus facile de l'espagnol."
  },
  {
    titre: "Indefinido ou imperfecto ?",
    categorie: "Grammaire",
    resume: "Action ponctuelle terminée contre décor ou habitude.",
    points: [
      "Indefinido : ce qui fait avancer l'histoire, un fait daté, une action unique.",
      "Imperfecto : le contexte, la description, la répétition, l'âge, l'heure, la météo.",
      "Souvent combinés : imperfecto (décor) + indefinido (événement)."
    ],
    exemples: [
      { src: "Dormía cuando sonó el teléfono.", fr: "Je dormais quand le téléphone a sonné." },
      { src: "Todos los veranos íbamos a Galicia, pero en 2019 fuimos a Portugal.", fr: "Tous les étés nous allions en Galice, mais en 2019 nous sommes allés au Portugal." }
    ],
    astuce: "Même logique qu'en français : imparfait = décor, passé simple/composé = événement."
  },
  {
    titre: "Le futur simple",
    categorie: "Conjugaison",
    resume: "Un seul jeu de terminaisons pour les trois groupes.",
    points: [
      "On ajoute à l'infinitif : -é, -ás, -á, -emos, -éis, -án.",
      "Radicaux irréguliers : tendr-, pondr-, saldr-, vendr-, podr-, sabr-, habr-, har-, dir-, querr-.",
      "Sert aussi à exprimer une supposition : Serán las cinco (il doit être cinq heures)."
    ],
    tableau: {
      titre: "hablar",
      lignes: [["yo", "hablaré"], ["tú", "hablarás"], ["él", "hablará"], ["nosotros", "hablaremos"], ["vosotros", "hablaréis"], ["ellos", "hablarán"]]
    },
    exemples: [
      { src: "Mañana te diré la verdad.", fr: "Demain je te dirai la vérité." },
      { src: "¿Dónde estará mi móvil?", fr: "Où peut bien être mon portable ?" }
    ],
    astuce: "À l'oral on préfère souvent ir a + infinitif : voy a llamarte."
  },
  {
    titre: "Le conditionnel",
    categorie: "Conjugaison",
    resume: "Politesse, souhait, conseil et hypothèse.",
    points: [
      "Infinitif + -ía, -ías, -ía, -íamos, -íais, -ían.",
      "Mêmes radicaux irréguliers que le futur : tendría, haría, diría, podría.",
      "Formule de politesse : ¿Podría...? ¿Me gustaría...?"
    ],
    exemples: [
      { src: "Me gustaría reservar una mesa.", fr: "J'aimerais réserver une table." },
      { src: "Yo que tú, no diría nada.", fr: "À ta place, je ne dirais rien." }
    ],
    astuce: "Le conditionnel a exactement les terminaisons de l'imparfait des verbes en -er."
  },
  {
    titre: "Le subjonctif présent : formation",
    categorie: "Conjugaison",
    resume: "On part du yo du présent, on enlève le -o et on inverse les voyelles.",
    points: [
      "Verbes en -ar → terminaisons en e : hable, hables, hable, hablemos, habléis, hablen.",
      "Verbes en -er / -ir → terminaisons en a : coma, comas, coma, comamos, comáis, coman.",
      "L'irrégularité du yo se propage : tengo → tenga, hago → haga, conozco → conozca.",
      "Irréguliers à part : sea (ser), esté (estar), vaya (ir), haya (haber), sepa (saber), dé (dar)."
    ],
    exemples: [
      { src: "Quiero que vengas a mi casa.", fr: "Je veux que tu viennes chez moi." },
      { src: "Espero que tengas razón.", fr: "J'espère que tu as raison." }
    ],
    astuce: "Truc de mémorisation : -ar devient e, -er/-ir deviennent a."
  },
  {
    titre: "Quand utiliser le subjonctif",
    categorie: "Grammaire",
    resume: "Volonté, émotion, doute, but, futur incertain.",
    points: [
      "Après querer que, esperar que, pedir que, es necesario que.",
      "Après une émotion : me alegro de que, me molesta que.",
      "Après cuando, en cuanto, hasta que quand on parle du futur : cuando llegues.",
      "Après para que (but) et aunque (concession hypothétique)."
    ],
    exemples: [
      { src: "Llámame cuando llegues.", fr: "Appelle-moi quand tu arriveras." },
      { src: "No creo que sea buena idea.", fr: "Je ne crois pas que ce soit une bonne idée." }
    ],
    astuce: "Grosse différence avec le français : « quand tu arriveras » → cuando llegues (subjonctif)."
  },
  {
    titre: "L'impératif",
    categorie: "Conjugaison",
    resume: "Donner un ordre, un conseil, une consigne.",
    points: [
      "tú affirmatif = 3e personne du présent : habla, come, escribe.",
      "Irréguliers tú : di, haz, ve, pon, sal, ten, ven, sé.",
      "vosotros : infinitif dont le -r devient -d : hablad, comed.",
      "Négatif et usted : on utilise le subjonctif : no hables, hable usted, no habléis."
    ],
    exemples: [
      { src: "Ven aquí y siéntate.", fr: "Viens ici et assieds-toi." },
      { src: "No te preocupes.", fr: "Ne t'inquiète pas." }
    ],
    astuce: "À l'affirmatif les pronoms se collent au verbe (dímelo), au négatif ils passent devant (no me lo digas)."
  },
  {
    titre: "Gustar et les verbes à construction inversée",
    categorie: "Grammaire",
    resume: "Ce n'est pas « j'aime », c'est « cela me plaît ».",
    points: [
      "Structure : (A mí) me + gusta / gustan + le vrai sujet.",
      "Le verbe s'accorde avec la chose aimée : me gusta el café / me gustan los libros.",
      "Même modèle : encantar, interesar, molestar, doler, faltar, parecer.",
      "Pour insister ou contraster : A mí me gusta, a ella no."
    ],
    tableau: {
      titre: "Pronoms",
      lignes: [["me", "à moi"], ["te", "à toi"], ["le", "à lui / elle / vous"], ["nos", "à nous"], ["os", "à vous"], ["les", "à eux / elles"]]
    },
    exemples: [
      { src: "Me encanta la música española.", fr: "J'adore la musique espagnole." },
      { src: "Me duelen los pies.", fr: "J'ai mal aux pieds." }
    ],
    astuce: "Avec un verbe à l'infinitif, toujours le singulier : me gusta viajar y leer."
  },
  {
    titre: "Les pronoms COD et COI",
    categorie: "Grammaire",
    resume: "Leur place et leur ordre obéissent à des règles strictes.",
    points: [
      "COD : me, te, lo/la, nos, os, los/las. COI : me, te, le, nos, os, les.",
      "Ordre : COI avant COD → Me lo dio.",
      "le / les deviennent SE devant lo/la/los/las : Se lo dije (et non *le lo*).",
      "Place : devant le verbe conjugué, ou collés à l'infinitif, au gérondif et à l'impératif affirmatif."
    ],
    exemples: [
      { src: "¿El libro? Se lo di a Marta ayer.", fr: "Le livre ? Je l'ai donné à Marta hier." },
      { src: "Voy a comprártelo.", fr: "Je vais te l'acheter." }
    ],
    astuce: "Quand les deux pronoms se collent au verbe, un accent écrit apparaît : dámelo, diciéndoselo."
  },
  {
    titre: "Por ou para ?",
    categorie: "Grammaire",
    resume: "Deux traductions de « pour », mais deux logiques opposées.",
    points: [
      "PARA : le but, la destination, l'échéance, le destinataire. Ce vers quoi on va.",
      "POR : la cause, le moyen, l'échange, la durée, le passage. Ce d'où l'on vient.",
      "para mí = pour moi (opinion, destinataire) / por mí = à cause de moi, à ma place."
    ],
    tableau: {
      titre: "Repères",
      lignes: [["para + but", "Estudio para aprender"], ["por + cause", "Lo hago por ti"], ["para + date", "Para el lunes"], ["por + lieu traversé", "Paso por el centro"], ["por + prix", "Lo compré por 20 euros"]]
    },
    exemples: [
      { src: "Este regalo es para ti.", fr: "Ce cadeau est pour toi." },
      { src: "Gracias por tu ayuda.", fr: "Merci pour ton aide." }
    ],
    astuce: "Si tu peux remplacer par « en raison de » → por ; par « afin de » → para."
  },
  {
    titre: "Muy ou mucho ?",
    categorie: "Grammaire",
    resume: "Très, beaucoup : deux mots qui ne se placent pas au même endroit.",
    points: [
      "muy est invariable et accompagne un adjectif ou un adverbe : muy rápido, muy bien.",
      "mucho accompagne un nom (et s'accorde) ou un verbe : muchos amigos, trabajo mucho.",
      "Exceptions figées : muy bueno mais mucho mejor, mucho peor, mucho más."
    ],
    exemples: [
      { src: "Es muy amable y ayuda mucho.", fr: "Il est très aimable et il aide beaucoup." },
      { src: "Tengo muchas ganas de verte.", fr: "J'ai très envie de te voir." }
    ],
    astuce: "Devant un adjectif = muy, devant un nom = mucho/a/os/as."
  },
  {
    titre: "Tener que, hay que, deber",
    categorie: "Grammaire",
    resume: "Exprimer l'obligation, personnelle ou générale.",
    points: [
      "tener que + infinitif = obligation personnelle : tengo que estudiar.",
      "hay que + infinitif = obligation impersonnelle (il faut) : hay que reservar.",
      "deber + infinitif = devoir moral ; deber de + infinitif = supposition."
    ],
    exemples: [
      { src: "Tengo que salir a las siete.", fr: "Je dois partir à sept heures." },
      { src: "Hay que llegar temprano.", fr: "Il faut arriver tôt." }
    ],
    astuce: "« Il faut que je parte » se dit tengo que salir, pas *hay que yo salir*."
  },
  {
    titre: "Comparatifs et superlatifs",
    categorie: "Grammaire",
    resume: "Plus que, moins que, aussi que, le plus.",
    points: [
      "más / menos + adjectif + que ; tan + adjectif + como (égalité).",
      "Superlatif : el / la / los / las + más + adjectif + de.",
      "Irréguliers : mejor, peor, mayor, menor.",
      "Superlatif absolu en -ísimo : guapísimo, buenísimo, carísimo."
    ],
    exemples: [
      { src: "Este hotel es más caro que el otro.", fr: "Cet hôtel est plus cher que l'autre." },
      { src: "Es la mejor pizza de la ciudad.", fr: "C'est la meilleure pizza de la ville." }
    ],
    astuce: "Devant un nombre, que devient de : más de veinte personas."
  },
  {
    titre: "L'apocope",
    categorie: "Grammaire",
    resume: "Certains mots perdent leur fin devant un nom masculin singulier.",
    points: [
      "bueno → buen, malo → mal, primero → primer, tercero → tercer, alguno → algún, ninguno → ningún.",
      "grande → gran devant tout nom singulier, avec un sens de « grand » moral : una gran mujer.",
      "ciento → cien devant un nom ou devant mil/millones."
    ],
    exemples: [
      { src: "Es un buen amigo y un gran hombre.", fr: "C'est un bon ami et un grand homme." },
      { src: "No hay ningún problema.", fr: "Il n'y a aucun problème." }
    ],
    astuce: "un hombre grande = un homme de grande taille ; un gran hombre = un homme remarquable."
  },
  {
    titre: "Les règles d'accentuation",
    categorie: "Orthographe",
    resume: "L'accent écrit espagnol suit une logique, il n'est jamais décoratif.",
    points: [
      "Mot finissant par voyelle, -n ou -s : accent tonique sur l'avant-dernière syllabe (llanas), pas d'accent écrit.",
      "Mot finissant par une autre consonne : accent sur la dernière syllabe (agudas), pas d'accent écrit.",
      "Toute exception à ces deux règles porte un accent écrit : canción, fácil, café.",
      "Les esdrújulas (accent sur l'antépénultième) prennent toujours l'accent : música, teléfono."
    ],
    exemples: [
      { src: "El médico habló con el paciente.", fr: "Le médecin a parlé avec le patient." },
      { src: "¿Cómo se dice esto?", fr: "Comment dit-on cela ?" }
    ],
    astuce: "L'accent distingue aussi les mots : el/él, tu/tú, si/sí, mas/más, se/sé."
  },
  {
    titre: "Les verbes pronominaux",
    categorie: "Conjugaison",
    resume: "Les verbes en -se, très courants pour la routine quotidienne.",
    points: [
      "levantarse, ducharse, vestirse, acostarse, llamarse, irse, quedarse.",
      "Le pronom s'accorde avec le sujet : me levanto, te levantas, se levanta.",
      "Avec un infinitif, le pronom peut se coller : voy a ducharme."
    ],
    exemples: [
      { src: "Me levanto a las siete y me ducho.", fr: "Je me lève à sept heures et je me douche." },
      { src: "¿Cómo te llamas?", fr: "Comment tu t'appelles ?" }
    ],
    astuce: "Le pronominal change parfois le sens : ir (aller) → irse (s'en aller)."
  },
  {
    titre: "Saber ou conocer ?",
    categorie: "Vocabulaire",
    resume: "Deux verbes pour « savoir / connaître ».",
    points: [
      "saber = savoir une information, savoir faire quelque chose : sé nadar, sé la respuesta.",
      "conocer = connaître une personne, un lieu, être familier de : conozco Madrid.",
      "Au passé simple, le sens change : supe = j'ai appris, conocí = j'ai rencontré."
    ],
    exemples: [
      { src: "Sé que la conoces.", fr: "Je sais que tu la connais." },
      { src: "La conocí en Sevilla.", fr: "Je l'ai rencontrée à Séville." }
    ],
    astuce: "saber + infinitif existe, conocer + infinitif n'existe pas."
  },
  {
    titre: "Le « a » personnel",
    categorie: "Grammaire",
    resume: "Une particularité espagnole sans équivalent français.",
    points: [
      "Quand le COD est une personne déterminée, on met a devant : Veo a María.",
      "Pas de a si la personne est indéterminée : Busco un médico (n'importe lequel).",
      "S'applique aussi aux animaux familiers : Quiero a mi perro."
    ],
    exemples: [
      { src: "Llamé a mi hermano.", fr: "J'ai appelé mon frère." },
      { src: "Espero a mis amigos.", fr: "J'attends mes amis." }
    ],
    astuce: "Oublier ce a est l'erreur n°1 des francophones à l'écrit."
  },
  {
    titre: "Les périphrases verbales",
    categorie: "Grammaire",
    resume: "Des structures toutes faites très fréquentes à l'oral.",
    points: [
      "acabar de + infinitif = venir de : acabo de llegar.",
      "volver a + infinitif = refaire : vuelvo a intentarlo.",
      "seguir + gerundio = continuer à : sigo trabajando.",
      "llevar + durée + gerundio = faire quelque chose depuis : llevo dos años estudiando."
    ],
    exemples: [
      { src: "Acabo de terminar el informe.", fr: "Je viens de terminer le rapport." },
      { src: "Llevo tres meses aprendiendo español.", fr: "Ça fait trois mois que j'apprends l'espagnol." }
    ],
    astuce: "llevar + gerundio remplace le « depuis » français de manière beaucoup plus naturelle."
  },
  {
    titre: "Les phrases conditionnelles avec si",
    categorie: "Grammaire",
    resume: "Trois structures selon le degré de réalité.",
    points: [
      "Réel : Si + présent, futur / présent / impératif → Si llueve, no saldré.",
      "Hypothétique : Si + imparfait du subjonctif, conditionnel → Si tuviera tiempo, iría.",
      "Irréel du passé : Si + plus-que-parfait du subjonctif, conditionnel passé → Si hubiera sabido, habría venido.",
      "Jamais de futur ni de conditionnel juste après si."
    ],
    exemples: [
      { src: "Si fuera rico, viajaría por todo el mundo.", fr: "Si j'étais riche, je voyagerais dans le monde entier." },
      { src: "Si puedes, llámame esta tarde.", fr: "Si tu peux, appelle-moi cet après-midi." }
    ],
    astuce: "L'imparfait du subjonctif se forme sur la 3e personne du pluriel de l'indefinido : tuvieron → tuviera."
  },
  {
    titre: "L'heure, les dates et les nombres",
    categorie: "Vocabulaire",
    resume: "Les formules à connaître par cœur pour le quotidien.",
    points: [
      "Heure : Es la una / Son las dos. y cuarto, y media, menos cuarto.",
      "Date : el 12 de septiembre de 2026 (pas de majuscule aux mois).",
      "Les jours prennent l'article : el lunes (lundi prochain), los lunes (tous les lundis)."
    ],
    exemples: [
      { src: "Son las ocho y media de la mañana.", fr: "Il est huit heures et demie du matin." },
      { src: "Mi cumpleaños es el tres de mayo.", fr: "Mon anniversaire est le trois mai." }
    ],
    astuce: "On ne dit pas *en lunes* : « lundi » se dit el lunes, tout simplement."
  },
  {
    titre: "Les démonstratifs et les possessifs",
    categorie: "Grammaire",
    resume: "Trois degrés de distance, contre deux en français.",
    points: [
      "este / esta / estos / estas = ici, près de moi.",
      "ese / esa / esos / esas = près de toi.",
      "aquel / aquella / aquellos / aquellas = là-bas, loin des deux.",
      "Possessifs : mi, tu, su, nuestro, vuestro, su — su veut dire son, leur ET votre."
    ],
    exemples: [
      { src: "Este libro es mío, ese es tuyo.", fr: "Ce livre-ci est à moi, celui-là est à toi." },
      { src: "Aquella casa al final de la calle.", fr: "Cette maison là-bas au bout de la rue." }
    ],
    astuce: "Pour lever l'ambiguïté de su, on précise : el coche de él, el coche de usted."
  },
  {
    titre: "Tú, usted, vosotros, ustedes",
    categorie: "Grammaire",
    resume: "Le tutoiement et le vouvoiement ne fonctionnent pas comme en français.",
    points: [
      "tú = tutoiement singulier ; usted = vouvoiement de politesse (avec le verbe à la 3e personne).",
      "vosotros = vous pluriel familier (Espagne) ; ustedes = vous pluriel poli, et pluriel unique en Amérique latine.",
      "En Amérique latine, vosotros n'existe pas : on dit toujours ustedes."
    ],
    exemples: [
      { src: "¿Usted quiere un café?", fr: "Vous voulez un café ? (politesse)" },
      { src: "¿Vosotros venís esta noche?", fr: "Vous venez ce soir ? (groupe familier)" }
    ],
    astuce: "Les Espagnols tutoient beaucoup plus que les Français : usted est réservé aux personnes âgées ou très formelles."
  }
];

const SENTENCES_ES = [
  { src: "¿Me puedes echar una mano?", fr: "Tu peux me donner un coup de main ?", note: "echar una mano = aider." },
  { src: "No pasa nada, no te preocupes.", fr: "Ce n'est rien, ne t'inquiète pas.", note: "no pasa nada : l'expression la plus utile d'Espagne." },
  { src: "Acabo de llegar a casa.", fr: "Je viens d'arriver à la maison.", note: "acabar de + infinitif = venir de." },
  { src: "¿Qué tal ha ido el día?", fr: "Comment s'est passée la journée ?", note: "ir bien / mal = bien / mal se passer." },
  { src: "Me da igual, elige tú.", fr: "Ça m'est égal, choisis toi.", note: "dar igual = être indifférent." },
  { src: "Tengo muchas ganas de verte.", fr: "J'ai très envie de te voir.", note: "tener ganas de + infinitif." },
  { src: "Llevo dos años aprendiendo español.", fr: "Ça fait deux ans que j'apprends l'espagnol.", note: "llevar + durée + gerundio." },
  { src: "¿Te importa si abro la ventana?", fr: "Ça te dérange si j'ouvre la fenêtre ?", note: "importar = déranger, ici." },
  { src: "Está a punto de empezar.", fr: "Ça va commencer d'un instant à l'autre.", note: "estar a punto de + infinitif." },
  { src: "Vale, quedamos a las ocho.", fr: "D'accord, on se donne rendez-vous à huit heures.", note: "vale = OK (Espagne) ; quedar = se donner rendez-vous." },
  { src: "No me acuerdo de su nombre.", fr: "Je ne me souviens pas de son nom.", note: "acordarse DE, ou recordar (sans préposition)." },
  { src: "Hace mucho que no nos vemos.", fr: "Ça fait longtemps qu'on ne s'est pas vus.", note: "hace + durée + que + présent." },
  { src: "Se me ha olvidado el móvil en casa.", fr: "J'ai oublié mon portable à la maison.", note: "Structure avec se : l'oubli n'est pas vraiment de ma faute." },
  { src: "Estoy hasta arriba de trabajo.", fr: "Je suis débordé de travail.", note: "estar hasta arriba = être surchargé." },
  { src: "¿Me lo puedes explicar otra vez?", fr: "Tu peux me l'expliquer encore une fois ?", note: "otra vez = encore une fois." },
  { src: "Merece la pena ir hasta allí.", fr: "Ça vaut la peine d'aller jusque là-bas.", note: "merecer la pena = valoir le coup." },
  { src: "Depende del tiempo que haga.", fr: "Ça dépend du temps qu'il fera.", note: "Subjonctif après que dans une relative au futur." },
  { src: "Claro que sí, cuenta conmigo.", fr: "Bien sûr, compte sur moi.", note: "contar con = compter sur. conmigo, contigo : formes soudées." },
  { src: "Me suena su cara, pero no sé de qué.", fr: "Son visage me dit quelque chose, mais je ne sais pas d'où.", note: "sonar = sembler familier." },
  { src: "No tengo ni idea.", fr: "Je n'en ai aucune idée.", note: "ni idea, très courant à l'oral." },
  { src: "Poco a poco se llega lejos.", fr: "Petit à petit on va loin.", note: "poco a poco = petit à petit." },
  { src: "¿Puedes hablar más despacio, por favor?", fr: "Tu peux parler plus lentement, s'il te plaît ?", note: "despacio = lentement (pas *lentamente* à l'oral)." },
  { src: "Ya voy, dame un minuto.", fr: "J'arrive, donne-moi une minute.", note: "ya voy = j'arrive (littéralement « déjà je vais »)." },
  { src: "Que tengas un buen día.", fr: "Passe une bonne journée.", note: "Souhait au subjonctif introduit par que." },
  { src: "Lo siento, me he equivocado.", fr: "Désolé, je me suis trompé.", note: "equivocarse = se tromper." },
  { src: "Esto no tiene sentido.", fr: "Ça n'a aucun sens.", note: "tener sentido = avoir du sens." },
  { src: "Nos vemos mañana sin falta.", fr: "On se voit demain sans faute.", note: "sin falta = sans faute." },
  { src: "Estoy pensando en cambiar de trabajo.", fr: "Je pense à changer de travail.", note: "pensar EN + infinitif." },
  { src: "A ver si nos tomamos un café.", fr: "On se prend un café un de ces jours ?", note: "a ver si = formule d'invitation vague." },
  { src: "De momento todo va bien.", fr: "Pour l'instant tout va bien.", note: "de momento = pour l'instant." },
  { src: "Me cae muy bien tu hermana.", fr: "Ta sœur me plaît beaucoup (comme personne).", note: "caer bien = être sympathique (jamais gustar pour ça !)." },
  { src: "¿Cuánto se tarda en llegar?", fr: "Combien de temps faut-il pour arriver ?", note: "tardar en + infinitif = mettre du temps à." },
  { src: "Dile que le llamo luego.", fr: "Dis-lui que je l'appelle plus tard.", note: "Impératif irrégulier di + pronom collé." },
  { src: "Hace un frío que pela.", fr: "Il fait un froid de canard.", note: "Expression familière très imagée." },
  { src: "Ojalá tengas razón.", fr: "Pourvu que tu aies raison.", note: "ojalá vient de l'arabe et exige le subjonctif." },
  { src: "Se me hace tarde, tengo que irme.", fr: "Il se fait tard, je dois y aller.", note: "irse = s'en aller (pronominal)." },
  { src: "No lo había pensado así.", fr: "Je ne l'avais pas vu comme ça.", note: "Plus-que-parfait : había + participe." },
  { src: "¿Qué te parece si vamos al cine?", fr: "Qu'est-ce que tu dirais d'aller au cinéma ?", note: "¿Qué te parece? = qu'en penses-tu ?" },
  { src: "Cada vez lo entiendo mejor.", fr: "Je comprends de mieux en mieux.", note: "cada vez + comparatif = de plus en plus." },
  { src: "Estaba a punto de llamarte.", fr: "J'étais sur le point de t'appeler.", note: "Imparfait de estar + a punto de." },
  { src: "Es más fácil de lo que parece.", fr: "C'est plus facile qu'il n'y paraît.", note: "de lo que = que ce que, dans une comparaison." },
  { src: "Me quedo con este, gracias.", fr: "Je prends celui-ci, merci.", note: "quedarse con = garder, prendre." },
  { src: "No hace falta que vengas.", fr: "Ce n'est pas la peine que tu viennes.", note: "hacer falta que + subjonctif." },
  { src: "Tarde o temprano lo vas a conseguir.", fr: "Tôt ou tard tu vas y arriver.", note: "conseguir = réussir, obtenir." },
  { src: "Échale un vistazo cuando puedas.", fr: "Jettes-y un œil quand tu pourras.", note: "echar un vistazo = jeter un coup d'œil." },
  { src: "Lo hice sin querer.", fr: "Je l'ai fait sans faire exprès.", note: "sin querer = involontairement." },
  { src: "Está lloviendo a cántaros.", fr: "Il pleut des cordes.", note: "cántaro = cruche : il pleut à seaux." },
  { src: "Me lo pensaré con calma.", fr: "Je vais y réfléchir tranquillement.", note: "pensárselo = y réfléchir." },
  { src: "Al final todo salió bien.", fr: "Finalement tout s'est bien passé.", note: "salir bien = bien se passer." },
  { src: "Más vale tarde que nunca.", fr: "Mieux vaut tard que jamais.", note: "Proverbe équivalent au français." }
];
