require('dotenv').config({ quiet: true });

const fs = require('fs');
const { Client } = require('@notionhq/client');

// Restauration ponctuelle de la propriété `Difficulté`, conservée comme trace.
//
// Le renommage des options dans Notion (Accessible -> Débutant, Exigeant -> Avancé) a
// effacé les 152 valeurs au lieu de les renommer. On les réécrit une par une.
//
// SOURCE. Le fichier `restauration_difficulte.csv` annoncé n'était pas disponible. Les
// valeurs sont reprises du fichier de correspondance de la migration v3
// (`migration_competences_v2_vers_v3.csv`), qui porte une colonne `difficulte` par
// `code_v3` : c'est exactement ce que la migration avait écrit dans Notion, donc l'état
// d'avant l'effacement. Sa répartition — 87 Accessible / 65 Exigeant sur 152 codes
// distincts — correspond aux 87 Débutant / 65 Avancé attendus.
//
// Comme pour la migration : page retrouvée par son `Code` EXACT, jamais par son titre ;
// pages `[archive]` ignorées ; aucune autre propriété touchée.

const SOURCE_CSV = `${process.env.HOME}/Downloads/migration_competences_v2_vers_v3.csv`;
const PROP_DIFFICULTE = 'Difficulté';

// Les options ont changé de nom : l'ancienne valeur ne peut pas être réécrite telle quelle.
const RENOMMAGE = { Accessible: 'Débutant', Exigeant: 'Avancé' };

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

function parserCsv(txt) {
  const lignes = [];
  let champs = [], courant = '', dansGuillemets = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (dansGuillemets) {
      if (c === '"') { if (txt[i + 1] === '"') { courant += '"'; i++; } else dansGuillemets = false; }
      else courant += c;
    } else if (c === '"') dansGuillemets = true;
    else if (c === ',') { champs.push(courant); courant = ''; }
    else if (c === '\n') { champs.push(courant); lignes.push(champs); champs = []; courant = ''; }
    else if (c !== '\r') courant += c;
  }
  if (courant || champs.length) { champs.push(courant); lignes.push(champs); }
  return lignes;
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

async function restaurer({ simulation }) {
  // 1. La source
  const rows = parserCsv(fs.readFileSync(SOURCE_CSV, 'utf8').replace(/^﻿/, ''));
  const entete = rows[0].map((x) => x.trim());
  const iCode = entete.indexOf('code_v3');
  const iDif = entete.indexOf('difficulte');
  if (iCode < 0 || iDif < 0) throw new Error('colonnes code_v3 / difficulte introuvables');

  const voulu = new Map();
  rows.slice(1).filter((r) => r.length > 1).forEach((r) => {
    const ancienne = (r[iDif] ?? '').trim();
    const nouvelle = RENOMMAGE[ancienne];
    if (!nouvelle) throw new Error(`difficulté inconnue « ${ancienne} » pour ${r[iCode]}`);
    voulu.set(r[iCode].trim(), nouvelle);
  });
  console.log(`source : ${voulu.size} codes`);

  // 2. Les options réellement déclarées dans Notion — on n'écrit rien qui n'existe pas
  const db = await notion.databases.retrieve({ database_id: process.env.DB_COMPETENCES });
  const dsId = db.data_sources[0].id;
  const ds = await notion.dataSources.retrieve({ data_source_id: dsId });
  const options = (ds.properties[PROP_DIFFICULTE]?.select?.options ?? []).map((o) => o.name);
  console.log(`options Notion : ${options.join(', ')}`);
  const inconnues = [...new Set(voulu.values())].filter((v) => !options.includes(v));
  if (inconnues.length) throw new Error(`options absentes de Notion : ${inconnues.join(', ')}`);

  // 3. Les pages
  let cursor, pages = [];
  do {
    const r = await avecReprise(() => notion.dataSources.query({ data_source_id: dsId, start_cursor: cursor, page_size: 100 }));
    pages.push(...r.results);
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);

  const actives = pages.filter((pg) => !/\[archive\]/i.test(titre(pg)));
  console.log(`pages : ${pages.length} · actives : ${actives.length} · archivées ignorées : ${pages.length - actives.length}`);

  const parCode = new Map();
  const doublons = [];
  actives.forEach((pg) => {
    const c = codeDe(pg);
    if (!c) return;
    if (parCode.has(c)) doublons.push(c);
    parCode.set(c, pg);
  });
  if (doublons.length) throw new Error(`codes en double : ${doublons.join(', ')}`);

  const manquants = [...voulu.keys()].filter((c) => !parCode.has(c));
  if (manquants.length) throw new Error(`codes du CSV absents de Notion : ${manquants.join(', ')}`);
  const orphelins = [...parCode.keys()].filter((c) => !voulu.has(c));
  if (orphelins.length) throw new Error(`pages sans valeur dans le CSV : ${orphelins.join(', ')}`);

  // 4. L'écriture
  let ecrites = 0, deja = 0;
  for (const [code, valeur] of voulu) {
    const page = parCode.get(code);
    const actuelle = page.properties[PROP_DIFFICULTE]?.select?.name ?? null;
    if (actuelle === valeur) { deja++; continue; }
    if (!simulation) {
      await avecReprise(() => notion.pages.update({
        page_id: page.id,
        properties: { [PROP_DIFFICULTE]: { select: { name: valeur } } },
      }));
      await dormir(PAUSE_MS);
    }
    ecrites++;
    if (ecrites % 20 === 0) console.log(`  ${ecrites} écrites…`);
  }

  console.log(simulation ? '\n=== SIMULATION (aucune écriture) ===' : '\n=== RESTAURATION TERMINÉE ===');
  console.log(`à écrire : ${ecrites} · déjà correctes : ${deja}`);

  // 5. Relecture depuis Notion, jamais depuis ce qu'on croit avoir écrit
  if (simulation) return;
  let c2, apres = [];
  do {
    const r = await avecReprise(() => notion.dataSources.query({ data_source_id: dsId, start_cursor: c2, page_size: 100 }));
    apres.push(...r.results);
    c2 = r.has_more ? r.next_cursor : null;
  } while (c2);

  const actives2 = apres.filter((pg) => !/\[archive\]/i.test(titre(pg)));
  const compte = {};
  const vides = [];
  actives2.forEach((pg) => {
    const d = pg.properties[PROP_DIFFICULTE]?.select?.name;
    if (!d) vides.push(codeDe(pg));
    compte[d ?? '(vide)'] = (compte[d ?? '(vide)'] ?? 0) + 1;
  });
  console.log('\nRELECTURE DEPUIS NOTION');
  console.log(`  pages actives : ${actives2.length}`);
  Object.entries(compte).forEach(([k, v]) => console.log(`  ${k} : ${v}`));
  if (vides.length) console.log(`  SANS VALEUR : ${vides.join(', ')}`);

  const attendu = { 'Débutant': 87, 'Avancé': 65 };
  const ok = actives2.length === 152 && vides.length === 0
    && compte['Débutant'] === attendu['Débutant'] && compte['Avancé'] === attendu['Avancé'];
  console.log(ok ? '\n  OK  87 Débutant / 65 Avancé sur 152 pages actives'
    : '\n  ÉCART avec les 87 / 65 attendus');
  process.exitCode = ok ? 0 : 1;
}

restaurer({ simulation: process.env.SIMULATION === '1' }).catch((err) => {
  console.error('ÉCHEC :', err.message);
  process.exit(1);
});
