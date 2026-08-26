// SOURCE UNIQUE des dimensions du référentiel.
//
// Le référentiel est passé de 5 à 3 dimensions (Moi / Moi et les autres / Moi et le
// monde) : mêmes 40 thématiques et 152 compétences, structure et codes différents.
//
// Ces définitions n'existent PAS dans Notion : elles sont câblées ici. Le `id` sert
// aussi de préfixe aux codes de compétences (MOI-01, AUT-58, MON-43), et l'ordre du
// tableau est l'ordre d'affichage.
//
// ⚠ Les définitions ci-dessous sont provisoires : elles décrivent fidèlement le
// contenu de chaque dimension, mais elles ne sont pas écrites par Cyril. À relire.
const DIMENSIONS_V2 = [
  {
    id: 'MOI',
    name: 'Moi',
    definition: "La dimension Moi réunit les compétences qui permettent de se connaître et de se tenir : reconnaître ses émotions, ses besoins et ses croyances, écouter son corps, apaiser son stress, faire la paix avec son histoire et construire une relation juste avec soi-même.",
    couleur: '#d97a4a',
  },
  {
    id: 'AUT',
    name: 'Moi et les autres',
    definition: "La dimension Moi et les autres réunit les compétences qui permettent de tenir le lien : écouter vraiment, dire ce qui compte, poser ses limites, traverser le conflit et le réparer, et faire vivre ses relations d'amitié, de couple et de famille.",
    couleur: '#7eb0ce',
  },
  {
    id: 'MON',
    name: 'Moi et le monde',
    definition: "La dimension Moi et le monde réunit les compétences qui permettent d'agir et de choisir : clarifier ses priorités, décider, passer à l'action, persévérer, et piloter son travail, ses projets et son argent en cohérence avec ce qui compte.",
    couleur: '#6e9c8f',
  },
];

// L'échelle à 3 niveaux. Le niveau 0 (étoile éteinte) n'y figure pas : c'est l'absence
// d'énoncé coché, pas un palier nommé.
const ECHELLE_V2 = {
  1: 'Je découvre',
  2: "J'expérimente",
  3: "J'incarne",
};

// Difficulté d'une compétence (propriété `Difficulté` dans Notion).
// Le vert et l'orange sont sémantiques : ils ne concurrencent ni la teinte de dimension
// ni le doré de la sélection.
const DIFFICULTES = {
  Accessible: { libelle: 'Accessible', couleur: '#7c9c6e' },
  Exigeant: { libelle: 'Exigeant', couleur: '#d08b3f' },
};

const NIVEAU_MIN = 0;
const NIVEAU_MAX = 3;

// Version du RÉFÉRENTIEL, à ne pas confondre avec le « v2 » des noms de fichiers, qui
// désigne la réécriture de l'application.
//
// Passée à 3 avec le référentiel à 3 dimensions : tous les codes ont changé
// (INT-01 → MOI-01). Un snapshot en version 2 doit donc être IGNORÉ et non relu — sans
// ce garde-fou, ses codes seraient tous filtrés comme inconnus et le membre
// apparaîtrait remis à zéro, sans que rien ne le signale.
//
// Définie ici, dans le seul module sans dépendance, pour n'exister qu'à un endroit.
const VERSION_REFERENTIEL = 3;

module.exports = { DIMENSIONS_V2, ECHELLE_V2, DIFFICULTES, NIVEAU_MIN, NIVEAU_MAX, VERSION_REFERENTIEL };
