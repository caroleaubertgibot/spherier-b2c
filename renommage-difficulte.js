require('dotenv').config({ quiet: true });

const fs = require('fs');
const { Client } = require('@notionhq/client');

// Passage de l'option Notion « Débutant » à « Fondamental », conservé comme trace.
//
// CE QUI ÉTAIT DEMANDÉ, ET POURQUOI ÇA N'A PAS PU SE FAIRE AINSI.
// Le vrai renommage — renvoyer la liste des options en conservant l'`id` de chacune et
// en ne changeant qu'un `name` — est ACCEPTÉ par l'API (200) et silencieusement IGNORÉ :
// l'option revient inchangée dans la réponse. Vérifié par quatre chemins : SDK avec la
// propriété désignée par son nom, SDK avec son id (`SYhM`), appel REST direct sur
// `PATCH /v1/data_sources/{id}`, et sur l'ancien `PATCH /v1/databases/{id}` en versions
// 2025-09-03 et 2022-06-28. Aucun n'a renommé quoi que ce soit.
//
// En revanche AJOUTER une option fonctionne, et écrire une propriété de page aussi.
//
// CE QUE FAIT DONC CE SCRIPT, en trois temps :
//   1. ajouter l'option « Fondamental » (les existantes conservées par leur id) ;
//   2. réaffecter à « Fondamental » les pages portant « Débutant » — écriture de page,
//      le seul chemin fiable ;
//   3. retirer « Débutant » du schéma, une fois plus aucune page ne s'y rattachant.
//
// Ce n'est donc pas un renommage : l'option change d'identité et les 87 affectations
// sont réécrites plutôt que préservées. Le résultat observable est le même, et une
// sauvegarde est prise avant toute modification.
//
// À noter : le renommage depuis l'interface Notion (••• sur l'option -> Renommer) est,
// lui, un vrai renommage. C'est une REDÉFINITION des options qui efface les valeurs —
// l'erreur du 27 août.

const PROP = 'Difficulté';
const ANCIEN = 'Débutant';
const NOUVEAU = 'Fondamental';
const COULEUR = 'green';
const SAUVEGARDE = 'sauvegardes/difficulte-avant-renommage-fondamental.json';
const PAUSE_MS = 340;

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function avecReprise(action, essais = 4) {
  for (let i = 1; i <= essais; i++) {
    try {
      return await action();
    } catch (err) {
      const recuperable = err.code === 'rate_limited' || err.status === 429 || err.status >= 500;
      if (!recuperable || i === essais) throw err;
      await dormir(1000 * i);
    }
  }
}

const titre = (page) => {
  const t = Object.values(page.properties).find((p) => p.type === 'title');
  return ((t?.title) ?? []).map((s) => s.plain_text).join('');
};

const codeDe = (page) => {
  const p = page.properties.Code;
  if (p?.type === 'rich_text') return (p.rich_text ?? []).map((s) => s.plain_text).join('').trim();
  return (p?.formula?.string ?? '').trim();
};

async function pagesActives(dsId) {
  let cursor, pages = [];
  do {
    const r = await avecReprise(() => notion.dataSources.query({ data_source_id: dsId, start_cursor: cursor, page_size: 100 }));
    pages.push(...r.results);
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return pages.filter((pg) => !/\[archive\]/i.test(titre(pg)));
}

async function optionsDe(dsId) {
  const ds = await notion.dataSources.retrieve({ data_source_id: dsId });
  return ds.properties[PROP].select.options;
}

async function ecrireOptions(dsId, options) {
  await avecReprise(() => notion.dataSources.update({
    data_source_id: dsId,
    properties: { [PROP]: { select: { options } } },
  }));
}

function repartition(pages) {
  const c = {};
  pages.forEach((pg) => { const d = pg.properties[PROP]?.select?.name ?? '(vide)'; c[d] = (c[d] ?? 0) + 1; });
  return c;
}

async function executer({ simulation }) {
  const db = await notion.databases.retrieve({ database_id: process.env.DB_COMPETENCES });
  const dsId = db.data_sources[0].id;

  let options = await optionsDe(dsId);
  console.log('options :', options.map((o) => `${o.name} (${o.id.slice(0, 8)})`).join('  ·  '));

  const avant = await pagesActives(dsId);
  console.log(`pages actives : ${avant.length} ·`, JSON.stringify(repartition(avant)));

  // Sauvegarde avant toute modification.
  const affectations = {};
  avant.forEach((pg) => { affectations[codeDe(pg)] = pg.properties[PROP]?.select?.name ?? null; });
  if (!simulation) {
    fs.writeFileSync(SAUVEGARDE, JSON.stringify({
      pris_le: new Date().toISOString(),
      options: options.map(({ id, name, color }) => ({ id, name, color })),
      affectations,
    }, null, 2));
    console.log(`sauvegarde : ${SAUVEGARDE}`);
  }

  const aBasculer = avant.filter((pg) => pg.properties[PROP]?.select?.name === ANCIEN);
  console.log(`\n1. option « ${NOUVEAU} » : ${options.some((o) => o.name === NOUVEAU) ? 'déjà présente' : 'à créer'}`);
  console.log(`2. pages à réaffecter : ${aBasculer.length}`);
  console.log(`3. option « ${ANCIEN} » : ${options.some((o) => o.name === ANCIEN) ? 'à retirer ensuite' : 'déjà absente'}`);

  if (simulation) {
    console.log('\n=== SIMULATION (aucune écriture) ===');
    return;
  }

  // 1. Créer l'option, les existantes conservées par leur id.
  if (!options.some((o) => o.name === NOUVEAU)) {
    await ecrireOptions(dsId, [...options.map((o) => ({ id: o.id })), { name: NOUVEAU, color: COULEUR }]);
    options = await optionsDe(dsId);
    if (!options.some((o) => o.name === NOUVEAU)) throw new Error(`création de « ${NOUVEAU} » ignorée par l'API`);
    console.log(`\n  option « ${NOUVEAU} » créée`);
  }

  // 2. Réaffecter, page par page.
  let n = 0;
  for (const pg of aBasculer) {
    await avecReprise(() => notion.pages.update({
      page_id: pg.id,
      properties: { [PROP]: { select: { name: NOUVEAU } } },
    }));
    await dormir(PAUSE_MS);
    if (++n % 20 === 0) console.log(`  ${n} / ${aBasculer.length} réaffectées…`);
  }
  console.log(`  ${n} pages réaffectées`);

  // 3. Retirer l'ancienne option, maintenant que plus rien ne s'y rattache.
  const restantes = (await pagesActives(dsId)).filter((pg) => pg.properties[PROP]?.select?.name === ANCIEN);
  if (restantes.length > 0) {
    throw new Error(`${restantes.length} pages encore sur « ${ANCIEN} » : on ne retire pas l'option`);
  }
  options = await optionsDe(dsId);
  if (options.some((o) => o.name === ANCIEN)) {
    await ecrireOptions(dsId, options.filter((o) => o.name !== ANCIEN).map((o) => ({ id: o.id })));
    options = await optionsDe(dsId);
    console.log(options.some((o) => o.name === ANCIEN)
      ? `  ATTENTION : « ${ANCIEN} » n'a pas pu être retirée (option orpheline, sans effet)`
      : `  option « ${ANCIEN} » retirée`);
  }

  // Relecture finale, depuis Notion.
  const apres = await pagesActives(dsId);
  const compte = repartition(apres);
  const vides = apres.filter((pg) => !pg.properties[PROP]?.select?.name).map(codeDe);

  console.log('\nRELECTURE DEPUIS NOTION');
  console.log('  options :', (await optionsDe(dsId)).map((o) => o.name).join(' / '));
  console.log(`  pages actives : ${apres.length}`);
  Object.entries(compte).forEach(([k, v]) => console.log(`  ${k} : ${v}`));
  if (vides.length) console.log(`  SANS VALEUR : ${vides.join(', ')}`);

  const ok = apres.length === 152 && vides.length === 0
    && compte[NOUVEAU] === 87 && compte['Avancé'] === 65 && !compte[ANCIEN];
  console.log(ok ? `\n  OK  87 ${NOUVEAU} / 65 Avancé sur 152 pages actives, aucune vide`
    : '\n  ÉCART avec les 87 / 65 attendus');
  process.exitCode = ok ? 0 : 1;
}

executer({ simulation: process.env.SIMULATION === '1' }).catch((err) => {
  console.error('ÉCHEC :', err.message);
  process.exit(1);
});
