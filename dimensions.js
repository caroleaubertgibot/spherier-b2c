// SOURCE UNIQUE des 4 dimensions pour tout le projet.
// Notion ne porte que le nom de la dimension (un select sur les compétences) : ni
// sous-titre, ni ordre, ni couleur. Cette liste est donc la référence canonique,
// consommée à la fois par les fonctions serveur (assemblage du blob) et par le
// renderer (injectée au build dans spherier.html). Ne pas la dupliquer ailleurs.
//
// - code       : identité stable, en majuscules
// - nom        : doit correspondre EXACTEMENT à la valeur du select "Dimension" dans Notion
// - sous_titre : libellé secondaire affiché sous le nom de zone
// - ordre      : ordre canonique Percevoir -> Apaiser -> Oser -> Ancrer
// - angle      : présentation seule (position de la zone sur la croix, en degrés)
// - couleur    : présentation seule (teinte de la dimension)
// - description: présentation seule (phrase générique affichée dans le panneau zone)
const DIMENSIONS = [
  {
    code: 'PERCEVOIR', nom: 'Percevoir', sous_titre: 'Conscience', ordre: 1,
    angle: -90, couleur: '#d97a4a',
    description: "Percevoir, c'est accueillir consciemment ce qui se joue en vous, avant d'agir.",
  },
  {
    code: 'APAISER', nom: 'Apaiser', sous_titre: 'Régulation', ordre: 2,
    angle: 180, couleur: '#7eb0ce',
    description: "Apaiser, c'est calmer la réaction et retrouver du calme intérieur.",
  },
  {
    code: 'OSER', nom: 'Oser', sous_titre: 'Action', ordre: 3,
    angle: 0, couleur: '#c4523e',
    description: "Oser, c'est agir concrètement malgré la peur ou l'inconfort.",
  },
  {
    code: 'ANCRER', nom: 'Ancrer', sous_titre: 'Intégration', ordre: 4,
    angle: 90, couleur: '#9c8fd1',
    description: "Ancrer, c'est inscrire ce progrès dans la durée et votre quotidien.",
  },
];

// Projection canonique écrite dans le blob : la présentation (angle, couleur) est
// volontairement exclue, elle n'a pas à être gelée dans un snapshot.
function dimensionsPourBlob() {
  return DIMENSIONS.slice()
    .sort((a, b) => a.ordre - b.ordre)
    .map(({ code, nom, sous_titre, ordre }) => ({ code, nom, sous_titre, ordre }));
}

module.exports = { DIMENSIONS, dimensionsPourBlob };
