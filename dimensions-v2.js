// SOURCE UNIQUE des dimensions du référentiel.
//
// Le référentiel est passé de 5 à 3 dimensions (Moi / Moi et les autres / Moi et le
// monde) : mêmes 40 thématiques et 152 compétences, structure et codes différents.
//
// Ces définitions n'existent PAS dans Notion : elles sont câblées ici. Le `id` sert
// aussi de préfixe aux codes de compétences (MOI-01, AUT-58, MON-43), et l'ordre du
// tableau est l'ordre d'affichage.
//
// Deux définitions par dimension, toutes deux fournies par Cyril :
//   definition     — version longue, pour le référentiel (Notion, Excel, documents)
//   definition_ui  — version courte et au TUTOIEMENT, pour l'interface
// Le tutoiement est la règle dans tout ce qui s'adresse au membre.
const DIMENSIONS_V2 = [
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
//
// « Fondamental » et non « Débutant » : le mot qualifie la COMPÉTENCE, pas la personne.
// Un membre à « J'incarne » sur une compétence dite « Débutant » y aurait lu une
// contradiction avec l'échelle Je découvre / J'expérimente / J'incarne.
const DIFFICULTES = {
  'Fondamental': { libelle: 'Fondamental', couleur: '#7c9c6e' },
  'Avancé': { libelle: 'Avancé', couleur: '#d08b3f' },
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
