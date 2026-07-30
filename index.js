require('dotenv').config({ quiet: true });

const { Client, collectPaginatedAPI } = require('@notionhq/client');

const { NOTION_TOKEN, DB_THEMES, DB_COMPETENCES, DB_RESSOURCES } = process.env;

for (const [key, value] of Object.entries({
  NOTION_TOKEN,
  DB_THEMES,
  DB_COMPETENCES,
  DB_RESSOURCES,
})) {
  if (!value) {
    console.error(`Variable d'environnement manquante: ${key} (vérifie ton fichier .env)`);
    process.exit(1);
  }
}

const notion = new Client({ auth: NOTION_TOKEN });

function getTitle(page, propName) {
  const prop = page.properties[propName];
  return prop?.title?.[0]?.plain_text?.trim() ?? '';
}

function getRichText(page, propName) {
  const prop = page.properties[propName];
  return prop?.rich_text?.[0]?.plain_text?.trim() ?? '';
}

function getNumber(page, propName) {
  const prop = page.properties[propName];
  return prop?.number ?? null;
}

function getCheckbox(page, propName) {
  const prop = page.properties[propName];
  return prop?.checkbox ?? false;
}

function getSelect(page, propName) {
  const prop = page.properties[propName];
  return prop?.select?.name ?? '';
}

function getMultiSelect(page, propName) {
  const prop = page.properties[propName];
  return (prop?.multi_select ?? []).map((o) => o.name);
}

function getUrl(page, propName) {
  const prop = page.properties[propName];
  return prop?.url ?? '';
}

function getRelationIds(page, propName) {
  const prop = page.properties[propName];
  return (prop?.relation ?? []).map((r) => r.id);
}

async function queryAll(databaseId) {
  // Depuis l'introduction des "data sources" par l'API Notion, on interroge une
  // data source (pas directement la base) : on la résout d'abord via la base.
  const database = await notion.databases.retrieve({ database_id: databaseId });
  const dataSourceId = database.data_sources?.[0]?.id;
  if (!dataSourceId) {
    throw new Error(`Aucune data source trouvée pour la base ${databaseId}`);
  }
  return collectPaginatedAPI(notion.dataSources.query, { data_source_id: dataSourceId });
}

async function getReferentiel() {
  const [themePages, competencePages, ressourcePages] = await Promise.all([
    queryAll(DB_THEMES),
    queryAll(DB_COMPETENCES),
    queryAll(DB_RESSOURCES),
  ]);

  // Ressources actives, indexées par id de page Notion
  const ressourcesById = new Map();
  for (const page of ressourcePages) {
    if (!getCheckbox(page, 'Actif')) continue;
    ressourcesById.set(page.id, {
      titre: getTitle(page, 'Name'),
      type: getMultiSelect(page, 'Type'),
      lien: getUrl(page, 'URL'),
    });
  }

  // Compétences indexées par id de page Notion (liste plate et dédupliquée par Code)
  const competenceById = new Map();
  // Reconstruit la relation inverse Thème -> Codes de compétences à partir du côté Compétences,
  // car le nom de la propriété miroir côté Thèmes n'est pas garanti.
  const competenceCodesByThemeId = new Map();

  for (const page of competencePages) {
    const code = getRichText(page, 'Code');
    competenceById.set(page.id, {
      code,
      nom: getTitle(page, 'Name'),
      dimension: getSelect(page, 'Dimension'),
      description: getRichText(page, 'Description'),
      ressources: getRelationIds(page, '📋 Ressources')
        .map((id) => ressourcesById.get(id))
        .filter(Boolean),
    });

    if (!code) continue;
    for (const themeId of getRelationIds(page, '📚 Thèmes')) {
      if (!competenceCodesByThemeId.has(themeId)) {
        competenceCodesByThemeId.set(themeId, []);
      }
      competenceCodesByThemeId.get(themeId).push(code);
    }
  }

  // Compétences : liste plate et dédupliquée par Code
  const competences = [...competenceById.values()].filter((c) => c.code);

  // Thèmes actifs, triés par Ordre, avec leurs compétences résolues en Codes
  const themes = themePages
    .filter((page) => getCheckbox(page, 'Actif'))
    .map((page) => ({
      code: getRichText(page, 'Code'),
      nom: getTitle(page, 'Name'),
      ordre: getNumber(page, 'Ordre'),
      competences: competenceCodesByThemeId.get(page.id) ?? [],
    }))
    .sort((a, b) => (a.ordre ?? Infinity) - (b.ordre ?? Infinity));

  return { themes, competences };
}

async function main() {
  const result = await getReferentiel();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { getReferentiel };

if (require.main === module) {
  main().catch((err) => {
    console.error('Erreur lors de la lecture du référentiel Notion:', err.body ?? err.message ?? err);
    process.exit(1);
  });
}
