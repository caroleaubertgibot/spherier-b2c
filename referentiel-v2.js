require('dotenv').config({ quiet: true });

const { Client, collectPaginatedAPI } = require('@notionhq/client');
const { DIMENSIONS_V2, ECHELLE_V2 } = require('./dimensions-v2.js');

const VERSION_REFERENTIEL = 2;

const { NOTION_TOKEN, DB_THEMES, DB_COMPETENCES, DB_RESSOURCES } = process.env;

const notion = new Client({ auth: NOTION_TOKEN });

// --- Lecture des propriétés Notion -------------------------------------------------

// Notion découpe un texte en plusieurs segments dès qu'il porte du formatage. Ne lire
// que le premier tronquerait silencieusement les définitions et les énoncés : on
// concatène toujours l'intégralité.
function texte(page, nom) {
  const prop = page.properties[nom];
  const segments = prop?.rich_text ?? prop?.title ?? [];
  return segments.map((s) => s.plain_text).join('').trim();
}

function nombre(page, nom) {
  return page.properties[nom]?.number ?? null;
}

function coche(page, nom) {
  return page.properties[nom]?.checkbox === true;
}

function selection(page, nom) {
  return page.properties[nom]?.select?.name ?? '';
}

function multiSelection(page, nom) {
  return (page.properties[nom]?.multi_select ?? []).map((o) => o.name);
}

function relations(page, nom) {
  return (page.properties[nom]?.relation ?? []).map((r) => r.id);
}

// La propriété URL est repérée par son TYPE plutôt que par son nom : le brief l'annonce
// sous « userDefined:URL » alors que l'API la renvoie sous « URL ». Cibler le type rend
// la lecture insensible à ce genre de renommage.
function url(page) {
  const cle = Object.keys(page.properties).find((k) => page.properties[k].type === 'url');
  return cle ? (page.properties[cle].url ?? '') : '';
}

async function interroger(databaseId) {
  const database = await notion.databases.retrieve({ database_id: databaseId });
  const dataSourceId = database.data_sources?.[0]?.id;
  if (!dataSourceId) {
    throw new Error(`Aucune data source trouvée pour la base ${databaseId}`);
  }
  return collectPaginatedAPI(notion.dataSources.query, { data_source_id: dataSourceId });
}

// --- Assemblage du référentiel ------------------------------------------------------

async function getReferentielV2() {
  for (const [cle, valeur] of Object.entries({ NOTION_TOKEN, DB_THEMES, DB_COMPETENCES, DB_RESSOURCES })) {
    if (!valeur) throw new Error(`Variable d'environnement manquante : ${cle}`);
  }

  const [pagesThemes, pagesCompetences, pagesRessources] = await Promise.all([
    interroger(DB_THEMES),
    interroger(DB_COMPETENCES),
    interroger(DB_RESSOURCES),
  ]);

  // Seules les lignes actives entrent dans le référentiel : les pages « [archive] »
  // sont à Actif = false et doivent rester invisibles.
  const themesActifs = pagesThemes.filter((p) => coche(p, 'Actif'));
  const idsThemesActifs = new Set(themesActifs.map((p) => p.id));

  const themes = themesActifs
    .map((p) => ({
      id: p.id,
      code: texte(p, 'Code'),
      name: texte(p, 'Name'),
      dimension: selection(p, 'Dimension'),
      definition: texte(p, 'DefinitionThematique'),
      // Une arête vers une thématique archivée serait un lien mort dans le graphe.
      feeds: relations(p, 'Nourrit').filter((id) => idsThemesActifs.has(id)),
      x: nombre(p, 'Position X'),
      y: nombre(p, 'Position Y'),
      order: nombre(p, 'Ordre'),
    }))
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  const ressourcesActives = pagesRessources.filter((p) => coche(p, 'Actif'));
  const idsRessourcesActives = new Set(ressourcesActives.map((p) => p.id));

  const resources = ressourcesActives.map((p) => {
    const themesLies = relations(p, '📚 Thèmes').filter((id) => idsThemesActifs.has(id));
    return {
      id: p.id,
      name: texte(p, 'Name'),
      type: multiSelection(p, 'Type'),
      url: url(p),
      // Le contrat prévoit un rattachement unique ; `themes` conserve l'intégralité au
      // cas où une ressource en viserait plusieurs, sans rien perdre en silence.
      theme: themesLies[0] ?? null,
      themes: themesLies,
    };
  });

  const competencies = pagesCompetences
    .filter((p) => coche(p, 'Actif'))
    .map((p) => {
      const themesLies = relations(p, '📚 Thèmes').filter((id) => idsThemesActifs.has(id));
      return {
        id: texte(p, 'Code'),
        theme: themesLies[0] ?? null,
        name: texte(p, 'Name'),
        definition: texte(p, 'Description'),
        statements: {
          1: texte(p, 'Énoncé N1'),
          2: texte(p, 'Énoncé N2'),
          3: texte(p, 'Énoncé N3'),
        },
        resources: relations(p, '📋 Ressources').filter((id) => idsRessourcesActives.has(id)),
      };
    })
    // Une compétence sans code n'est pas identifiable dans un snapshot : on l'écarte.
    .filter((c) => c.id)
    .sort((a, b) => a.id.localeCompare(b.id, 'fr'));

  return {
    version: VERSION_REFERENTIEL,
    dimensions: DIMENSIONS_V2,
    themes,
    competencies,
    resources,
    scale: ECHELLE_V2,
  };
}

module.exports = { getReferentielV2, VERSION_REFERENTIEL };
