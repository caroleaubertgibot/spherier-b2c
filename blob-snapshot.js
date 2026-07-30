const { dimensionsPourBlob } = require('./dimensions.js');
const { VERSION_SCHEMA } = require('./supabase-client.js');

// Assemble le blob à geler dans un snapshot.
//
// Le navigateur n'envoie que des niveaux et des cibles ; c'est ici, côté serveur, que
// la structure est figée autour, à partir du référentiel Notion courant.
//
// GELÉ      : structure (dimensions, thèmes), libellés de compétences, niveaux, cibles.
// NON GELÉ  : les ressources et les libellés de paliers — relus en direct du référentiel
//             à l'affichage, ils n'ont donc rien à faire dans le blob.
function assemblerBlob({ referentiel, niveaux = {}, cibles = [] }) {
  const codesConnus = new Set(referentiel.competences.map((c) => c.code));

  // Liste plate et dédupliquée par Code, un seul niveau par compétence, quel que soit
  // le nombre de thèmes qui la référencent.
  const competences = referentiel.competences.map((c) => ({
    code: c.code,
    nom: c.nom,
    dimension: c.dimension,
    niveau: normaliserNiveau(niveaux[c.code]),
  }));

  const themes = referentiel.themes.map((t) => ({
    code: t.code,
    nom: t.nom,
    ordre: t.ordre,
    // Les thèmes ne référencent les compétences que par Code.
    competences: t.competences.filter((code) => codesConnus.has(code)),
  }));

  // On ne gèle que des cibles qui existent réellement dans le référentiel, dédupliquées.
  const ciblesRetenues = [...new Set(cibles)].filter((code) => codesConnus.has(code));

  return {
    version_schema: VERSION_SCHEMA,
    dimensions: dimensionsPourBlob(),
    themes,
    competences,
    cibles: ciblesRetenues,
  };
}

// Un niveau absent ou hors bornes retombe sur 1 ("Je découvre").
function normaliserNiveau(valeur) {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return 1;
  return Math.min(4, Math.max(1, Math.round(n)));
}

module.exports = { assemblerBlob, normaliserNiveau };
