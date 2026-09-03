// ============================================================================
// CONFIGURATION DU CLUB — le seul fichier à relire pour monter une instance.
// ============================================================================
//
// Le sphérier a deux instances : `b2c` (Les Sommets, club de dev perso) et `coachs`
// (club de coachs). Même socle, contenus et référentiels différents, évolutions
// indépendantes ensuite.
//
// Tout ce qui distingue une instance de l'autre est ICI. Le reste du code ne connaît
// aucune dimension, aucun libellé, aucun seuil : il les lit dans ce fichier, et le
// navigateur les reçoit dans la réponse de `/api/referential`.
//
// Ce qui n'est PAS ici, et n'a pas à y être :
//   — le contenu (dimensions détaillées, thématiques, compétences, énoncés,
//     ressources) : il vit dans Notion et se modifie sans déploiement ;
//   — les secrets : ils vivent dans les variables d'environnement ;
//   — la géométrie du ciel (positions X/Y) : elle vit dans Notion aussi.
//
// Une chose IMPORTANTE, vérifiée sur le code : les préfixes des codes de compétences
// (`MOI-01`, `AUT-58`…) ne portent AUCUNE logique. Une compétence est rattachée à sa
// dimension par sa thématique, jamais par son code. Une autre instance peut donc
// choisir les préfixes qu'elle veut, ou n'en pas mettre.

// --- Quelle instance ? ------------------------------------------------------------
//
// Garde-fou contre une configuration croisée : si la variable CLUB de l'environnement
// ne correspond pas à ce que ce fichier déclare, c'est que le dépôt d'une instance
// tourne avec les secrets de l'autre. Sans ce contrôle, l'erreur serait silencieuse —
// on lirait le Notion d'un club en écrivant dans le Supabase de l'autre.
const CLUB = 'b2c';

const CLUBS_CONNUS = ['b2c', 'coachs'];

function verifierClub() {
  const attendu = CLUB;
  const declare = process.env.CLUB;
  if (!CLUBS_CONNUS.includes(attendu)) {
    throw new Error(`club.config.js : CLUB « ${attendu} » inconnu (attendus : ${CLUBS_CONNUS.join(', ')})`);
  }
  // La variable d'environnement est facultative en local ; si elle est posée, elle doit
  // correspondre. C'est en production qu'elle compte, où les deux instances existent.
  if (declare && declare !== attendu) {
    throw new Error(
      `CONFIGURATION CROISÉE : le code est celui du club « ${attendu} » mais la variable `
      + `d'environnement CLUB vaut « ${declare} ». Les secrets Notion et Supabase sont `
      + `probablement ceux de l'autre instance. On s'arrête plutôt que d'écrire au mauvais endroit.`
    );
  }
  return attendu;
}

// --- Version du référentiel -------------------------------------------------------
//
// À ne pas confondre avec le « v2 » des noms de fichiers, qui désigne la réécriture de
// l'application. Un snapshot d'une autre version est IGNORÉ et non relu : sans ce
// garde-fou, ses codes seraient tous filtrés comme inconnus et le membre apparaîtrait
// remis à zéro sans que rien ne le signale.
//
// À incrémenter à chaque changement de codes. Une instance neuve part de 1.
//
// Passée à 4 avec la refonte V7 : les codes CHANGENT DE SENS. MOI-01 existe en V3
// comme en V7 et ne désigne pas la même compétence. Un snapshot V3 relu avec le
// référentiel V7 ne planterait pas — il afficherait des niveaux sur les mauvaises
// compétences, en silence. C'est la seule chose qui l'en empêche.
const VERSION_REFERENTIEL = 4;

// --- Les dimensions ---------------------------------------------------------------
//
// Ces définitions n'existent PAS dans Notion : elles sont câblées ici. L'ordre du
// tableau est l'ORDRE CANONIQUE — celui de l'API, de la vue d'ensemble, de l'accordéon
// et des parcours d'évaluation. Le ciel a son propre ordre visuel (plus bas).
//
// Deux définitions par dimension :
//   definition     — version longue, pour le référentiel (Notion, Excel, documents)
//   definition_ui  — version courte et au TUTOIEMENT, pour l'interface
// Le tutoiement est la règle dans tout ce qui s'adresse au membre.
//
// `couleur` est la teinte de la dimension. Elle voyage jusqu'au navigateur, qui en
// fabrique ses variables CSS : aucun identifiant de dimension n'est écrit dans la
// feuille de style.
const DIMENSIONS = [
  {
    id: 'MOI',
    name: 'Moi',
    definition: "La dimension Moi réunit les compétences qui se travaillent à l'intérieur, sans témoin : reconnaître ce que l'on ressent, comprendre ce qui nous meut, prendre soin de son corps et de son énergie, et construire une relation juste avec soi-même.",
    definition_ui: "Ce qui se travaille à l'intérieur, sans témoin : ce que tu ressens, ce qui te meut, ton corps et ton énergie, et la relation que tu entretiens avec toi-même.",
    couleur: '#d97a4a',
  },
  {
    id: 'AUT',
    name: 'Moi et les autres',
    definition: "La dimension Moi et les autres réunit les compétences qui se jouent dans le lien : écouter et se faire entendre, poser ses limites, traverser le conflit et réparer, et tenir sa place aussi bien dans ses relations les plus proches que dans un groupe.",
    definition_ui: "Ce qui se joue dans le lien : écouter et te faire entendre, poser tes limites, traverser le conflit et réparer, tenir ta place auprès des tiens comme dans un groupe.",
    couleur: '#7eb0ce',
  },
  {
    id: 'MON',
    name: 'Moi et le monde',
    definition: "La dimension Moi et le monde réunit les compétences qui se jouent dans ce que l'on construit au-dehors : choisir un cap, décider, passer à l'action, piloter son travail, son argent et ses projets, et donner à sa vie une direction qui lui ressemble.",
    definition_ui: "Ce qui se joue dans ce que tu construis dehors : choisir un cap, décider, agir, piloter ton travail, ton argent et tes projets, et donner à ta vie une direction qui te ressemble.",
    couleur: '#6e9c8f',
  },
];

// --- L'échelle d'auto-évaluation --------------------------------------------------
//
// Les trois énoncés d'une compétence SONT l'échelle : le membre lit trois phrases en
// escalier et coche la plus haute qui est vraie pour lui. Le niveau 0 n'y figure pas :
// c'est l'absence d'énoncé coché, pas un palier nommé.
const ECHELLE = {
  1: 'Je découvre',
  2: "J'expérimente",
  3: "J'incarne",
};

// --- La difficulté d'une compétence -----------------------------------------------
//
// Propriété `Difficulté` dans Notion. Les NOMS doivent correspondre exactement aux
// options du select Notion : c'est la clé de correspondance.
//
// Le mot qualifie la COMPÉTENCE, pas la personne — un membre à « J'incarne » sur une
// compétence dite « Débutant » y lisait une contradiction avec l'échelle ci-dessus.
//
// Le vert et l'orange sont sémantiques : ils ne concurrencent ni les teintes de
// dimension ni le doré de la sélection.
const DIFFICULTES = [
  { nom: 'Fondamental', couleur: '#7c9c6e' },
  { nom: 'Avancé', couleur: '#d08b3f' },
];

// --- Règles de progression --------------------------------------------------------
//
// NIVEAU_ACQUIS : le palier à partir duquel une compétence compte pour ouvrir la
// thématique suivante. « J'expérimente », pas « J'incarne » : ouvrir doit rester
// atteignable.
//
// MAX_CIBLES_MAINTENANT : plafond des compétences travaillées « ce mois ». Contrainte
// pédagogique, appliquée par le SERVEUR autant que par l'interface.
//
// seuilDOuverture : combien de compétences d'une thématique source doivent atteindre
// NIVEAU_ACQUIS pour ouvrir ce qu'elle nourrit.
//
//     min(SEUIL_MAXI, max(1, floor(n / 2)))
//
// La moitié, jamais zéro, jamais plus de SEUIL_MAXI. Le plancher évite qu'une
// thématique très courte ouvre ses suites sans que rien n'ait été travaillé. Le
// plafond répond au problème inverse, apparu avec le référentiel V7 : « Gestions des
// conflits » compte 14 compétences, soit un seuil automatique de 7 — il aurait fallu
// en acquérir sept pour ouvrir « Couple ».
//
// Le plafond touche CINQ thématiques du V7, et non deux comme envisagé au départ :
// Gestions des conflits (7 → 4), puis les quatre à dix compétences — Croyances,
// Polarités, Écoute, Parentalité (5 → 4).
//
// Une thématique peut en outre porter une propriété `Seuil` dans Notion, qui SURCHARGE
// entièrement ce calcul. Le pilote du club ajuste ainsi une thématique sans
// déploiement, comme il le fait déjà pour tout le reste du référentiel.
const NIVEAU_MIN = 0;
const NIVEAU_MAX = 3;
const NIVEAU_ACQUIS = 2;
const MAX_CIBLES_MAINTENANT = 3;

const SEUIL_MAXI = 4;

function seuilDOuverture(nombreDeCompetences, seuilImpose = null) {
  // `Seuil` renseigné dans Notion : il fait foi, plafond compris — c'est le sens même
  // d'une surcharge. Un zéro ou un négatif serait une faute de saisie qui ouvrirait
  // tout : on garde le plancher à 1.
  if (Number.isFinite(seuilImpose)) return Math.max(1, Math.round(seuilImpose));
  return Math.min(SEUIL_MAXI, Math.max(1, Math.floor(nombreDeCompetences / 2)));
}

// --- Le ciel (page d'accueil desktop) ---------------------------------------------
//
// `ordre` est l'ordre VISUEL des blocs, délibérément distinct de l'ordre canonique.
// « Moi » est le centre du modèle : les deux autres dimensions sont nommées par rapport
// à lui. Une disposition radiale dit cette structure, une disposition linéaire
// suggérerait un ordre de lecture qui n'existe pas.
//
// `centre` est le bloc sur lequel le ciel s'ouvre, centré, avec une amorce de chaque
// côté.
//
// `largeursFil` règle la largeur du fil décoratif de part et d'autre du bloc centré.
// Le fil ne porte aucun sens : sa largeur sert à ÉGALISER ce que montre chaque amorce.
// À place égale les voisines ne montrent pas la même chose — le bord clairsemé de l'une
// laisse voir moins de thématiques que le bord dense de l'autre. Ces valeurs sont donc
// MESURÉES sur le rendu réel, et à remesurer si la police de la constellation ou les
// positions changent.
//
// Remesurées sur le référentiel V7, où « Moi » est devenu le bloc le plus large —
// 569 px contre 362 et 457 — ce qui laisse 336 px de chaque côté sur une piste de 1240.
// Il faut 168 px d'amorce à gauche et 228 px à droite pour montrer quatre thématiques
// entières de chaque côté.
//
// UN ARBITRAGE À CONNAÎTRE avant d'y toucher. L'en-tête d'un bloc est CENTRÉ sur lui :
// le rendre lisible depuis le côté demande une amorce PROFONDE, donc un fil ÉTROIT, ce
// qui montre du même coup beaucoup plus de thématiques. Les deux exigences tirent en
// sens inverse. Mesuré : l'en-tête de « Moi et les autres » n'est entier qu'à partir
// d'un fil de 67 px — soit huit thématiques visibles — et celui de « Moi et le monde »
// qu'à partir de 20 px, ce qui n'est plus un fil. Montrer quatre thématiques de chaque
// côté coûte donc les deux en-têtes ; les garder lisibles coûte l'équilibre des comptes.
//
// Une instance qui n'aurait pas trois dimensions laisse `ordre` et `centre` à null :
// le ciel retombe alors sur l'ordre canonique et centre le premier bloc.
const CIEL = {
  ordre: ['AUT', 'MOI', 'MON'],
  centre: 'MOI',
  largeursFil: { AUT: 168, MON: 108 },
};

// --- Journal de démarrage ---------------------------------------------------------
//
// Chaque fonction Netlify charge ce module, directement ou par le référentiel : cette
// ligne apparaît donc une fois par démarrage à froid, dans les journaux de l'instance.
// C'est la façon la plus directe de répondre à « sur quel club tourne cette fonction ? »
// sans avoir à appeler l'API.
//
// La vérification est faite ICI, au chargement, et non à la première requête : une
// configuration croisée doit échouer tout de suite et bruyamment, pas au moment où un
// membre enregistre.
verifierClub();
console.log(`[sphérier] club = ${CLUB} · référentiel v${VERSION_REFERENTIEL} · ${DIMENSIONS.length} dimensions`);

module.exports = {
  CLUB,
  CLUBS_CONNUS,
  verifierClub,
  VERSION_REFERENTIEL,
  DIMENSIONS,
  ECHELLE,
  DIFFICULTES,
  NIVEAU_MIN,
  NIVEAU_MAX,
  NIVEAU_ACQUIS,
  MAX_CIBLES_MAINTENANT,
  SEUIL_MAXI,
  seuilDOuverture,
  CIEL,
};
