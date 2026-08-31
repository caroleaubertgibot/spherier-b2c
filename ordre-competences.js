require('dotenv').config({ quiet: true });

const fs = require('fs');
const { Client } = require('@notionhq/client');

// Création et initialisation de la propriété `Ordre` sur la base Compétences,
// conservée comme trace.
//
// Elle pilote l'ordre d'affichage des compétences À L'INTÉRIEUR de leur thématique, sur
// le modèle de l'`Ordre` déjà présent sur les Thèmes. Les codes (MOI-01, AUT-58…) restent
// des identifiants permanents : on ne les renumérote jamais, y compris pour insérer une
// compétence entre deux autres.
//
// Pas de 10 : insérer une compétence entre la 3e et la 4e revient à lui donner 35, sans
// toucher à la suite.
//
// Une valeur vide n'est pas une erreur : c'est le cas normal d'une compétence qu'on
// vient d'ajouter dans Notion. Elle se place en FIN de sa thématique, jamais en tête —
// voir le tri côté application.

const PROP = 'Ordre';
const PAS = 10;
const PAUSE_MS = 340;
const SAUVEGARDE = 'sauvegardes/ordre-competences-initial.json';

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

const texte = (page, nom) => {
  const p = page.properties[nom];
  return ((p?.rich_text ?? p?.title ?? []).map((s) => s.plain_text).join('')).trim();
};

const themeDe = (page) => (page.properties['📚 Thèmes']?.relation ?? [])[0]?.id ?? null;

async function toutes(dsId) {
  let cursor, pages = [];
  do {
    const r = await avecReprise(() => notion.dataSources.query({ data_source_id: dsId, start_cursor: cursor, page_size: 100 }));
    pages.push(...r.results);
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return pages;
}

async function executer({ simulation }) {
  const dbC = await notion.databases.retrieve({ database_id: process.env.DB_COMPETENCES });
  const dsC = dbC.data_sources[0].id;

  // Noms des thématiques, pour un journal lisible.
  const dbT = await notion.databases.retrieve({ database_id: process.env.DB_THEMES });
  const nomTheme = new Map();
  (await toutes(dbT.data_sources[0].id)).forEach((pg) => nomTheme.set(pg.id, texte(pg, 'Name')));

  // 1. La propriété
  let ds = await notion.dataSources.retrieve({ data_source_id: dsC });
  const existe = Boolean(ds.properties[PROP]);
  console.log(`propriété « ${PROP} » : ${existe ? `déjà présente (${ds.properties[PROP].type})` : 'à créer'}`);
  if (existe && ds.properties[PROP].type !== 'number') {
    throw new Error(`« ${PROP} » existe mais n'est pas un number (${ds.properties[PROP].type})`);
  }
  if (!existe && !simulation) {
    await avecReprise(() => notion.dataSources.update({
      data_source_id: dsC,
      properties: { [PROP]: { number: { format: 'number' } } },
    }));
    ds = await notion.dataSources.retrieve({ data_source_id: dsC });
    if (!ds.properties[PROP]) throw new Error(`création de « ${PROP} » ignorée par l'API`);
    console.log(`  propriété créée (${ds.properties[PROP].type})`);
  }

  // 2. Les valeurs : par thématique, dans l'ordre actuel des codes, par pas de 10.
  const pages = await toutes(dsC);
  const actives = pages.filter((pg) => !/\[archive\]/i.test(titre(pg)) && pg.properties.Actif?.checkbox === true);
  console.log(`\npages : ${pages.length} · actives : ${actives.length}`);

  const sansTheme = actives.filter((pg) => !themeDe(pg)).map((pg) => texte(pg, 'Code'));
  if (sansTheme.length) throw new Error(`compétences sans thématique : ${sansTheme.join(', ')}`);

  const parTheme = new Map();
  actives.forEach((pg) => {
    const t = themeDe(pg);
    if (!parTheme.has(t)) parTheme.set(t, []);
    parTheme.get(t).push(pg);
  });

  const voulu = new Map();
  [...parTheme.entries()]
    .sort((a, b) => (nomTheme.get(a[0]) ?? '').localeCompare(nomTheme.get(b[0]) ?? '', 'fr'))
    .forEach(([t, liste]) => {
      liste
        .sort((a, b) => texte(a, 'Code').localeCompare(texte(b, 'Code'), 'fr'))
        .forEach((pg, i) => voulu.set(pg.id, { code: texte(pg, 'Code'), theme: nomTheme.get(t), ordre: (i + 1) * PAS }));
    });

  console.log(`thématiques : ${parTheme.size} · valeurs à poser : ${voulu.size}`);
  const apercu = [...voulu.values()].filter((v) => v.theme === nomTheme.get([...parTheme.keys()][0]));
  console.log('exemple :', [...voulu.values()].slice(0, 5).map((v) => `${v.code}=${v.ordre}`).join('  '));
  const tailles = {};
  [...parTheme.values()].forEach((l) => { tailles[l.length] = (tailles[l.length] ?? 0) + 1; });
  console.log('compétences par thématique :', Object.entries(tailles).map(([k, v]) => `${k} comp. × ${v} thém.`).join(' · '));

  if (simulation) {
    console.log('\n=== SIMULATION (aucune écriture) ===');
    return;
  }

  fs.writeFileSync(SAUVEGARDE, JSON.stringify({
    pose_le: new Date().toISOString(),
    pas: PAS,
    valeurs: Object.fromEntries([...voulu.values()].map((v) => [v.code, v.ordre])),
  }, null, 2));
  console.log(`sauvegarde : ${SAUVEGARDE}`);

  let n = 0;
  for (const [pageId, v] of voulu) {
    const actuel = pages.find((p) => p.id === pageId).properties[PROP]?.number ?? null;
    if (actuel !== v.ordre) {
      await avecReprise(() => notion.pages.update({ page_id: pageId, properties: { [PROP]: { number: v.ordre } } }));
      await dormir(PAUSE_MS);
    }
    if (++n % 20 === 0) console.log(`  ${n} / ${voulu.size}…`);
  }

  // 3. Relecture depuis Notion
  const apres = (await toutes(dsC)).filter((pg) => !/\[archive\]/i.test(titre(pg)) && pg.properties.Actif?.checkbox === true);
  const vides = apres.filter((pg) => pg.properties[PROP]?.number == null).map((pg) => texte(pg, 'Code'));

  const parThemeApres = new Map();
  apres.forEach((pg) => {
    const t = themeDe(pg);
    if (!parThemeApres.has(t)) parThemeApres.set(t, []);
    parThemeApres.get(t).push(pg.properties[PROP]?.number ?? null);
  });

  let mauvaises = [];
  parThemeApres.forEach((liste, t) => {
    const attendu = liste.map((_, i) => (i + 1) * PAS).join(',');
    const obtenu = liste.slice().sort((a, b) => a - b).join(',');
    if (attendu !== obtenu) mauvaises.push(`${nomTheme.get(t)} : ${obtenu}`);
    if (new Set(liste).size !== liste.length) mauvaises.push(`${nomTheme.get(t)} : doublons`);
  });

  console.log('\nRELECTURE DEPUIS NOTION');
  console.log(`  compétences actives : ${apres.length}`);
  console.log(`  sans Ordre : ${vides.length}${vides.length ? ' — ' + vides.join(', ') : ''}`);
  console.log(`  thématiques mal numérotées : ${mauvaises.length}${mauvaises.length ? '\n    ' + mauvaises.join('\n    ') : ''}`);

  const ok = apres.length === 152 && vides.length === 0 && mauvaises.length === 0;
  console.log(ok ? '\n  OK  152 compétences, chaque thématique numérotée 10, 20, 30… sans trou ni doublon'
    : '\n  ÉCART');
  process.exitCode = ok ? 0 : 1;
}

executer({ simulation: process.env.SIMULATION === '1' }).catch((err) => {
  console.error('ÉCHEC :', err.message);
  process.exit(1);
});
