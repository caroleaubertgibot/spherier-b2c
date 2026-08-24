// SOURCE UNIQUE des 5 dimensions du référentiel v2.
//
// Ces définitions n'existent PAS dans Notion (aucune base ne les porte) : elles sont
// câblées ici, comme prévu au brief. Le `id` sert aussi de préfixe aux codes de
// compétences (INT-01, ALI-24, …), et l'ordre du tableau est l'ordre d'affichage.
//
// À ne pas confondre avec dimensions.js, qui décrit les 4 anciens axes (Percevoir /
// Apaiser / Oser / Ancrer) du référentiel v1, encore utilisé par le renderer actuel.
const DIMENSIONS_V2 = [
  {
    id: 'INT',
    name: 'Intériorité',
    definition: "La dimension Intériorité réunit les compétences qui permettent de se connaître de l'intérieur : reconnaître ses émotions, ses besoins et ses croyances, entendre sa voix intérieure et construire une relation juste avec soi-même.",
  },
  {
    id: 'ALI',
    name: 'Alignement',
    definition: "La dimension Alignement réunit les compétences qui permettent de vivre en cohérence avec ce qui compte : connaître ses valeurs, affirmer son identité, lire les signaux de son corps et de son énergie, et ajuster sa vie pour que ce que l'on fait reflète ce que l'on est.",
  },
  {
    id: 'COM',
    name: 'Communication',
    definition: "La dimension Communication réunit les compétences qui permettent de faire passer ce qui compte : écouter vraiment, s'exprimer avec clarté, formuler une demande, un refus ou un retour, et tenir sa parole en public comme en privé.",
  },
  {
    id: 'REL',
    name: 'Relations',
    definition: "La dimension Relations réunit les compétences qui permettent de tenir le lien dans la durée : créer la confiance, poser et respecter des limites, traverser le conflit, réparer, et choisir les relations qui nous font grandir.",
  },
  {
    id: 'TRA',
    name: 'Trajectoire',
    definition: "La dimension Trajectoire réunit les compétences qui permettent de choisir et d'agir : clarifier ses priorités, décider, passer à l'action, persévérer et piloter ses projets de vie, de travail et d'argent.",
  },
];

// L'échelle à 3 niveaux. Le niveau 0 (étoile éteinte) n'y figure pas : c'est l'absence
// d'énoncé coché, pas un palier nommé.
const ECHELLE_V2 = {
  1: 'Je découvre',
  2: "J'expérimente",
  3: "J'incarne",
};

const NIVEAU_MIN = 0;
const NIVEAU_MAX = 3;

module.exports = { DIMENSIONS_V2, ECHELLE_V2, NIVEAU_MIN, NIVEAU_MAX };
