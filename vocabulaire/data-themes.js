// ============================================================
// Leçons de vocabulaire par thème — les escales du voyage
// Chaque thème : un identifiant stable, un titre, une accroche et
// dix mots [langue étrangère, français]. L'ordre est celui de la carte.
// ============================================================

const THEMES_ES = [
  { id: 'cafe', titre: 'Au café', accroche: 'Commander et payer sans hésiter', mots: [
    ['el café', 'le café'], ['la taza', 'la tasse'], ['el vaso', 'le verre'], ['la leche', 'le lait'],
    ['el azúcar', 'le sucre'], ['el zumo', 'le jus'], ['el camarero', 'le serveur'], ['la cuenta', "l'addition"],
    ['la propina', 'le pourboire'], ['pedir', 'commander'] ] },
  { id: 'maison', titre: 'La maison', accroche: 'Les pièces et les meubles', mots: [
    ['la casa', 'la maison'], ['la cocina', 'la cuisine'], ['el dormitorio', 'la chambre'], ['el baño', 'la salle de bain'],
    ['el salón', 'le salon'], ['la ventana', 'la fenêtre'], ['la puerta', 'la porte'], ['la mesa', 'la table'],
    ['la silla', 'la chaise'], ['la cama', 'le lit'] ] },
  { id: 'voyager', titre: 'Voyager', accroche: "De l'aéroport à l'hôtel", mots: [
    ['el viaje', 'le voyage'], ['el billete', 'le billet'], ['la maleta', 'la valise'], ['el aeropuerto', "l'aéroport"],
    ['el tren', 'le train'], ['la estación', 'la gare'], ['el pasaporte', 'le passeport'], ['el hotel', "l'hôtel"],
    ['la playa', 'la plage'], ['reservar', 'réserver'] ] },
  { id: 'ville', titre: 'En ville', accroche: 'Se repérer et demander son chemin', mots: [
    ['la calle', 'la rue'], ['la plaza', 'la place'], ['el barrio', 'le quartier'], ['la tienda', 'le magasin'],
    ['el semáforo', 'le feu rouge'], ['la esquina', 'le coin de rue'], ['el puente', 'le pont'], ['el museo', 'le musée'],
    ['cerca', 'près'], ['cruzar', 'traverser'] ] },
  { id: 'marche', titre: 'Au marché', accroche: 'Faire ses courses', mots: [
    ['el mercado', 'le marché'], ['la fruta', 'le fruit'], ['la verdura', 'le légume'], ['el pan', 'le pain'],
    ['la carne', 'la viande'], ['el pescado', 'le poisson'], ['el queso', 'le fromage'], ['barato', 'bon marché'],
    ['caro', 'cher'], ['comprar', 'acheter'] ] },
  { id: 'restaurant', titre: 'Au restaurant', accroche: 'De la réservation au dessert', mots: [
    ['la carta', 'le menu'], ['el plato', "l'assiette"], ['la cuchara', 'la cuillère'], ['el tenedor', 'la fourchette'],
    ['el cuchillo', 'le couteau'], ['el postre', 'le dessert'], ['la bebida', 'la boisson'], ['el entrante', "l'entrée"],
    ['la servilleta', 'la serviette'], ['probar', 'goûter'] ] },
  { id: 'famille', titre: 'La famille', accroche: 'Présenter les siens', mots: [
    ['la madre', 'la mère'], ['el padre', 'le père'], ['el hermano', 'le frère'], ['la hermana', 'la sœur'],
    ['los abuelos', 'les grands-parents'], ['el hijo', 'le fils'], ['la hija', 'la fille'], ['el primo', 'le cousin'],
    ['la tía', 'la tante'], ['el marido', 'le mari'] ] },
  { id: 'corps', titre: 'Le corps', accroche: 'Chez le médecin', mots: [
    ['la cabeza', 'la tête'], ['el brazo', 'le bras'], ['la pierna', 'la jambe'], ['la mano', 'la main'],
    ['el pie', 'le pied'], ['los ojos', 'les yeux'], ['la boca', 'la bouche'], ['la espalda', 'le dos'],
    ['el corazón', 'le cœur'], ['doler', 'faire mal'] ] },
  { id: 'meteo', titre: 'La météo', accroche: "Parler du temps qu'il fait", mots: [
    ['el tiempo', 'le temps'], ['el sol', 'le soleil'], ['la lluvia', 'la pluie'], ['la nieve', 'la neige'],
    ['el viento', 'le vent'], ['la nube', 'le nuage'], ['la tormenta', "l'orage"], ['el calor', 'la chaleur'],
    ['el frío', 'le froid'], ['llover', 'pleuvoir'] ] },
  { id: 'travail', titre: 'Au travail', accroche: 'Réunions et collègues', mots: [
    ['el trabajo', 'le travail'], ['la reunión', 'la réunion'], ['el jefe', 'le patron'], ['el compañero', 'le collègue'],
    ['la oficina', 'le bureau'], ['el sueldo', 'le salaire'], ['el ordenador', "l'ordinateur"], ['la empresa', "l'entreprise"],
    ['el horario', "l'horaire"], ['trabajar', 'travailler'] ] },
  { id: 'emotions', titre: 'Les émotions', accroche: 'Dire comment on se sent', mots: [
    ['feliz', 'heureux'], ['triste', 'triste'], ['cansado', 'fatigué'], ['enfadado', 'fâché'],
    ['nervioso', 'nerveux'], ['tranquilo', 'calme'], ['preocupado', 'inquiet'], ['sorprendido', 'surpris'],
    ['el miedo', 'la peur'], ['la alegría', 'la joie'] ] },
  { id: 'temps', titre: 'Le temps qui passe', accroche: 'Jours, semaines et habitudes', mots: [
    ['hoy', "aujourd'hui"], ['mañana', 'demain'], ['ayer', 'hier'], ['la semana', 'la semaine'],
    ['el mes', 'le mois'], ['el año', "l'année"], ['temprano', 'tôt'], ['tarde', 'tard'],
    ['siempre', 'toujours'], ['nunca', 'jamais'] ] },
];

const THEMES_EN = [
  { id: 'cafe', titre: 'Au café', accroche: 'Commander et payer sans hésiter', mots: [
    ['a coffee', 'un café'], ['a cup', 'une tasse'], ['a glass', 'un verre'], ['milk', 'le lait'],
    ['sugar', 'le sucre'], ['juice', 'le jus'], ['a waiter', 'un serveur'], ['the bill', "l'addition"],
    ['a tip', 'un pourboire'], ['to order', 'commander'] ] },
  { id: 'maison', titre: 'La maison', accroche: 'Les pièces et les meubles', mots: [
    ['a house', 'une maison'], ['the kitchen', 'la cuisine'], ['the bedroom', 'la chambre'], ['the bathroom', 'la salle de bain'],
    ['the living room', 'le salon'], ['a window', 'une fenêtre'], ['a door', 'une porte'], ['a table', 'une table'],
    ['a chair', 'une chaise'], ['a bed', 'un lit'] ] },
  { id: 'voyager', titre: 'Voyager', accroche: "De l'aéroport à l'hôtel", mots: [
    ['a trip', 'un voyage'], ['a ticket', 'un billet'], ['a suitcase', 'une valise'], ['the airport', "l'aéroport"],
    ['a train', 'un train'], ['the station', 'la gare'], ['a passport', 'un passeport'], ['a hotel', 'un hôtel'],
    ['the beach', 'la plage'], ['to book', 'réserver'] ] },
  { id: 'ville', titre: 'En ville', accroche: 'Se repérer et demander son chemin', mots: [
    ['a street', 'une rue'], ['a square', 'une place'], ['a neighbourhood', 'un quartier'], ['a shop', 'un magasin'],
    ['traffic lights', 'le feu rouge'], ['a corner', 'un coin de rue'], ['a bridge', 'un pont'], ['a museum', 'un musée'],
    ['nearby', 'tout près'], ['to cross', 'traverser'] ] },
  { id: 'marche', titre: 'Au marché', accroche: 'Faire ses courses', mots: [
    ['the market', 'le marché'], ['fruit', 'les fruits'], ['vegetables', 'les légumes'], ['bread', 'le pain'],
    ['meat', 'la viande'], ['fish', 'le poisson'], ['cheese', 'le fromage'], ['cheap', 'bon marché'],
    ['expensive', 'cher'], ['to buy', 'acheter'] ] },
  { id: 'restaurant', titre: 'Au restaurant', accroche: 'De la réservation au dessert', mots: [
    ['the menu', 'le menu'], ['a plate', 'une assiette'], ['a spoon', 'une cuillère'], ['a fork', 'une fourchette'],
    ['a knife', 'un couteau'], ['dessert', 'le dessert'], ['a drink', 'une boisson'], ['a starter', 'une entrée'],
    ['a napkin', 'une serviette'], ['to taste', 'goûter'] ] },
  { id: 'famille', titre: 'La famille', accroche: 'Présenter les siens', mots: [
    ['the mother', 'la mère'], ['the father', 'le père'], ['a brother', 'un frère'], ['a sister', 'une sœur'],
    ['grandparents', 'les grands-parents'], ['a son', 'un fils'], ['a daughter', 'une fille'], ['a cousin', 'un cousin'],
    ['an aunt', 'une tante'], ['a husband', 'un mari'] ] },
  { id: 'corps', titre: 'Le corps', accroche: 'Chez le médecin', mots: [
    ['the head', 'la tête'], ['an arm', 'un bras'], ['a leg', 'une jambe'], ['a hand', 'une main'],
    ['a foot', 'un pied'], ['the eyes', 'les yeux'], ['the mouth', 'la bouche'], ['the back', 'le dos'],
    ['the heart', 'le cœur'], ['to hurt', 'faire mal'] ] },
  { id: 'meteo', titre: 'La météo', accroche: "Parler du temps qu'il fait", mots: [
    ['the weather', 'le temps'], ['the sun', 'le soleil'], ['the rain', 'la pluie'], ['the snow', 'la neige'],
    ['the wind', 'le vent'], ['a cloud', 'un nuage'], ['a storm', 'un orage'], ['the heat', 'la chaleur'],
    ['the cold', 'le froid'], ['to rain', 'pleuvoir'] ] },
  { id: 'travail', titre: 'Au travail', accroche: 'Réunions et collègues', mots: [
    ['a job', 'un emploi'], ['a meeting', 'une réunion'], ['the boss', 'le patron'], ['a colleague', 'un collègue'],
    ['the office', 'le bureau'], ['the salary', 'le salaire'], ['a computer', 'un ordinateur'], ['a company', 'une entreprise'],
    ['a schedule', 'un emploi du temps'], ['to work', 'travailler'] ] },
  { id: 'emotions', titre: 'Les émotions', accroche: 'Dire comment on se sent', mots: [
    ['happy', 'heureux'], ['sad', 'triste'], ['tired', 'fatigué'], ['angry', 'fâché'],
    ['nervous', 'nerveux'], ['calm', 'calme'], ['worried', 'inquiet'], ['surprised', 'surpris'],
    ['fear', 'la peur'], ['joy', 'la joie'] ] },
  { id: 'temps', titre: 'Le temps qui passe', accroche: 'Jours, semaines et habitudes', mots: [
    ['today', "aujourd'hui"], ['tomorrow', 'demain'], ['yesterday', 'hier'], ['a week', 'une semaine'],
    ['a month', 'un mois'], ['a year', 'une année'], ['early', 'tôt'], ['late', 'tard'],
    ['always', 'toujours'], ['never', 'jamais'] ] },
];
