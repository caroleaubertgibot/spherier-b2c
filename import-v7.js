require('dotenv').config({ quiet: true });

const fs = require('fs');
const { Client } = require('@notionhq/client');

// ===========================================================================
// Refonte V7 du référentiel — purge et réimport complets.
// ===========================================================================
//
// Ce n'est pas une révision : 36 thématiques au lieu de 40, 250 compétences au lieu
// de 152 dont 94 seulement reprises. Les codes CHANGENT DE SENS — MOI-01 existe dans
// les deux versions et ne désigne pas la même compétence — d'où le passage de
// `referential_version` à 4 dans club.config.js, sans quoi un snapshot V3 relu avec
// le référentiel V7 afficherait des niveaux sur les mauvaises compétences, en silence.
//
// Source unique : referentiel-v7.json, produit du classeur V7 et validé avant écriture
// (comptes par dimension, difficultés, filiations, racines, codes, ordres).
//
// Phases, dans cet ordre — les relations échouent si on l'inverse :
//   2. sauvegarde de l'état actuel, puis purge
//   3. import : thématiques, puis filiations, puis compétences, puis énoncés
//   4. vérification PAR RELECTURE de Notion
//
// PHASE=2|3|4|tout   SIMULATION=1 pour n'écrire nulle part.

const SOURCE = 'referentiel-v7.json';
const SAUVEGARDE = 'sauvegardes/referentiel-v3-avant-refonte-v7.json';
const PAUSE_MS = 340;
const SEUILS = { 'Gestions des conflits': 4 };

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const SIMULATION = process.env.SIMULATION === '1';
const PHASE = process.env.PHASE || 'tout';

async function avecReprise(action, essais = 5) {
  for (let i = 1; i <= essais; i++) {
    try { return await action(); } catch (err) {
      const recuperable = err.code === 'rate_limited' || err.status === 429 || err.status >= 500;
      if (!recuperable || i === essais) throw err;
      await dormir(1000 * i);
    }
  }
}

const txt = (page, nom) => {
  const p = page.properties[nom];
  return ((p?.rich_text ?? p?.title ?? []).map((s) => s.plain_text).join('')).trim();
};
const rt = (v) => ({ rich_text: v ? [{ type: 'text', text: { content: String(v).slice(0, 2000) } }] : [] });
const ti = (v) => ({ title: [{ type: 'text', text: { content: String(v) } }] });

async function toutes(dsId) {
  let cursor, pages = [];
  do {
    const r = await avecReprise(() => notion.dataSources.query({ data_source_id: dsId, start_cursor: cursor, page_size: 100 }));
    pages.push(...r.results);
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return pages;
}

async function dataSources() {
  const [t, c] = await Promise.all([
    notion.databases.retrieve({ database_id: process.env.DB_THEMES }),
    notion.databases.retrieve({ database_id: process.env.DB_COMPETENCES }),
  ]);
  return { dsT: t.data_sources[0].id, dsC: c.data_sources[0].id };
}

// --- Phase 2 : sauvegarde puis purge ---------------------------------------
async function purger({ dsT, dsC }) {
  const [pagesT, pagesC] = await Promise.all([toutes(dsT), toutes(dsC)]);
  console.log(`état actuel : ${pagesT.length} thématiques · ${pagesC.length} compétences`);

  // Sauvegarde : relations exprimées par CODE, pour rester relisible hors de Notion.
  const codeParId = new Map(pagesT.map((p) => [p.id, txt(p, 'Code')]));
  const sauvegarde = {
    pris_le: new Date().toISOString(),
    motif: 'État V3 complet, juste avant la refonte V7 (purge et réimport).',
    themes: pagesT.map((p) => ({
      code: txt(p, 'Code'), name: txt(p, 'Name'),
      dimension: p.properties.Dimension?.select?.name ?? null,
      definition: txt(p, 'DefinitionThematique'),
      nourrit: (p.properties.Nourrit?.relation ?? []).map((r) => codeParId.get(r.id) ?? r.id),
      x: p.properties['Position X']?.number ?? null,
      y: p.properties['Position Y']?.number ?? null,
      ordre: p.properties.Ordre?.number ?? null,
      actif: p.properties.Actif?.checkbox === true,
    })),
    competences: pagesC.map((p) => ({
      code: txt(p, 'Code'), name: txt(p, 'Name'), description: txt(p, 'Description'),
      theme: codeParId.get((p.properties['📚 Thèmes']?.relation ?? [])[0]?.id) ?? null,
      difficulte: p.properties['Difficulté']?.select?.name ?? null,
      ordre: p.properties.Ordre?.number ?? null,
      actif: p.properties.Actif?.checkbox === true,
      enonces: { 1: txt(p, 'Énoncé N1'), 2: txt(p, 'Énoncé N2'), 3: txt(p, 'Énoncé N3') },
    })),
  };
  if (!SIMULATION) {
    fs.writeFileSync(SAUVEGARDE, JSON.stringify(sauvegarde, null, 1));
    console.log(`sauvegarde : ${SAUVEGARDE}`);
  } else {
    console.log(`[simulation] sauvegarde de ${sauvegarde.themes.length} thématiques et ${sauvegarde.competences.length} compétences`);
  }

  console.log(`à supprimer : ${pagesC.length} compétences puis ${pagesT.length} thématiques`);
  if (SIMULATION) return;

  // Les compétences d'abord : supprimer une thématique d'abord laisserait des
  // relations pendantes le temps de la purge.
  let n = 0;
  for (const p of [...pagesC, ...pagesT]) {
    await avecReprise(() => notion.pages.update({ page_id: p.id, in_trash: true }));
    await dormir(PAUSE_MS);
    if (++n % 40 === 0) console.log(`  ${n} / ${pagesC.length + pagesT.length} supprimées…`);
  }
  console.log(`  ${n} pages mises à la corbeille`);

  // La propriété _archive Dimension n'a plus d'objet : on la retire du schéma.
  const ds = await notion.dataSources.retrieve({ data_source_id: dsC });
  if (ds.properties['_archive Dimension']) {
    await avecReprise(() => notion.dataSources.update({
      data_source_id: dsC, properties: { '_archive Dimension': null },
    }));
    const apres = await notion.dataSources.retrieve({ data_source_id: dsC });
    console.log(apres.properties['_archive Dimension']
      ? '  ATTENTION : _archive Dimension n\'a pas pu être retirée'
      : '  _archive Dimension retirée du schéma');
  }
}

// --- Phase 3 : import ------------------------------------------------------
async function importer({ dsT, dsC }) {
  const src = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  console.log(`source : ${src.themes.length} thématiques · ${src.competences.length} compétences · ${Object.keys(src.enonces).length} jeux d'énoncés`);

  if (SIMULATION) {
    const avecSeuil = src.themes.filter((t) => SEUILS[t.name] !== undefined).map((t) => `${t.name}=${SEUILS[t.name]}`);
    console.log(`[simulation] création de ${src.themes.length} thématiques (dont seuil : ${avecSeuil.join(', ') || 'aucun'})`);
    console.log(`[simulation] ${src.themes.reduce((n, t) => n + t.nourrit.length, 0)} filiations`);
    console.log(`[simulation] ${src.competences.length} compétences avec leurs énoncés`);
    return;
  }

  // 1. Les thématiques, SANS filiation : les cibles n'existent pas encore.
  const idParNom = new Map();
  let n = 0;
  for (const t of src.themes) {
    const page = await avecReprise(() => notion.pages.create({
      parent: { type: 'data_source_id', data_source_id: dsT },
      properties: {
        Name: ti(t.name),
        Code: rt(t.code),
        DefinitionThematique: rt(t.definition),
        Dimension: { select: { name: t.dimension } },
        'Position X': { number: t.x },
        'Position Y': { number: t.y },
        Ordre: { number: t.ordre },
        Actif: { checkbox: true },
        ...(SEUILS[t.name] !== undefined ? { Seuil: { number: SEUILS[t.name] } } : {}),
      },
    }));
    idParNom.set(t.name, page.id);
    await dormir(PAUSE_MS);
    if (++n % 12 === 0) console.log(`  ${n} / ${src.themes.length} thématiques…`);
  }
  console.log(`  ${n} thématiques créées`);

  // 2. Les filiations, résolues PAR NOM comme le demande la source.
  let f = 0;
  for (const t of src.themes) {
    if (!t.nourrit.length) continue;
    const cibles = t.nourrit.map((nom) => {
      const id = idParNom.get(nom);
      if (!id) throw new Error(`filiation « ${t.name} » → « ${nom} » : cible introuvable`);
      return { id };
    });
    await avecReprise(() => notion.pages.update({
      page_id: idParNom.get(t.name), properties: { Nourrit: { relation: cibles } },
    }));
    f += cibles.length;
    await dormir(PAUSE_MS);
  }
  console.log(`  ${f} filiations posées`);

  // 3. Les compétences, avec leurs énoncés dans la même écriture : une compétence
  //    sans ses trois énoncés est inévaluable, autant ne jamais la créer incomplète.
  let c = 0;
  for (const comp of src.competences) {
    const idTheme = idParNom.get(comp.theme);
    if (!idTheme) throw new Error(`compétence ${comp.code} : thématique « ${comp.theme} » introuvable`);
    const e = src.enonces[comp.code] || {};
    await avecReprise(() => notion.pages.create({
      parent: { type: 'data_source_id', data_source_id: dsC },
      properties: {
        Name: ti(comp.name),
        Code: rt(comp.code),
        Description: rt(comp.definition),
        'Difficulté': { select: { name: comp.difficulte } },
        Ordre: { number: comp.ordre },
        Actif: { checkbox: true },
        '📚 Thèmes': { relation: [{ id: idTheme }] },
        'Énoncé N1': rt(e['1']), 'Énoncé N2': rt(e['2']), 'Énoncé N3': rt(e['3']),
      },
    }));
    await dormir(PAUSE_MS);
    if (++c % 40 === 0) console.log(`  ${c} / ${src.competences.length} compétences…`);
  }
  console.log(`  ${c} compétences créées, énoncés compris`);
}

// --- Phase 4 : vérification par relecture ----------------------------------
async function verifier({ dsT, dsC }) {
  const src = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const [pagesT, pagesC] = await Promise.all([toutes(dsT), toutes(dsC)]);
  const T = pagesT.filter((p) => p.properties.Actif?.checkbox === true);
  const C = pagesC.filter((p) => p.properties.Actif?.checkbox === true);

  const A = [];
  const chk = (n, c, d = '') => A.push((c ? '  OK   ' : '  ÉCART ') + n + (d ? `  [${d}]` : ''));

  chk('36 thématiques actives', T.length === 36, String(T.length));
  chk('250 compétences actives', C.length === 250, String(C.length));

  const nomT = new Map(T.map((p) => [p.id, txt(p, 'Name')]));
  const dimT = (p) => p.properties.Dimension?.select?.name;
  for (const [dim, nt, nc] of [['Moi', 16, 114], ['Moi et les autres', 10, 78], ['Moi et le monde', 10, 58]]) {
    const th = T.filter((p) => dimT(p) === dim);
    const idsTh = new Set(th.map((p) => p.id));
    const co = C.filter((p) => idsTh.has((p.properties['📚 Thèmes']?.relation ?? [])[0]?.id));
    chk(`${dim} : ${nt} thém. / ${nc} comp.`, th.length === nt && co.length === nc, `${th.length} / ${co.length}`);
  }

  const diff = {};
  C.forEach((p) => { const d = p.properties['Difficulté']?.select?.name ?? '(vide)'; diff[d] = (diff[d] ?? 0) + 1; });
  chk('118 Fondamental / 132 Avancé', diff.Fondamental === 118 && diff['Avancé'] === 132, JSON.stringify(diff));

  const fil = T.reduce((n, p) => n + (p.properties.Nourrit?.relation ?? []).length, 0);
  chk('34 filiations', fil === 34, String(fil));

  const cibles = new Set(T.flatMap((p) => (p.properties.Nourrit?.relation ?? []).map((r) => nomT.get(r.id))));
  const racines = T.map((p) => txt(p, 'Name')).filter((n) => !cibles.has(n)).sort();
  const attendues = ['Corps et énergie', 'Lien', 'Rêves', 'Valeurs', 'Écoute', 'Émotions'].sort();
  chk('6 racines attendues', JSON.stringify(racines) === JSON.stringify(attendues), racines.join(' · '));

  const codes = C.map((p) => txt(p, 'Code'));
  chk('250 codes uniques', new Set(codes).size === 250, `${new Set(codes).size}`);
  for (const [pref, n] of [['MOI', 114], ['AUT', 78], ['MON', 58]]) {
    const nums = codes.filter((c) => c.startsWith(pref + '-')).map((c) => Number(c.split('-')[1])).sort((a, b) => a - b);
    const attendu = Array.from({ length: n }, (_, i) => i + 1);
    chk(`${pref}-01 → ${pref}-${n} sans trou`, JSON.stringify(nums) === JSON.stringify(attendu), `${nums.length} codes`);
  }

  const vides = C.filter((p) => !txt(p, 'Énoncé N1') || !txt(p, 'Énoncé N2') || !txt(p, 'Énoncé N3')).map((p) => txt(p, 'Code'));
  chk('3 énoncés non vides par compétence', vides.length === 0, vides.slice(0, 5).join(' '));

  const orph = C.filter((p) => !(p.properties['📚 Thèmes']?.relation ?? []).length).map((p) => txt(p, 'Code'));
  chk('aucune compétence orpheline', orph.length === 0, orph.slice(0, 5).join(' '));

  const parTheme = new Map();
  C.forEach((p) => {
    const t = (p.properties['📚 Thèmes']?.relation ?? [])[0]?.id;
    if (!parTheme.has(t)) parTheme.set(t, []);
    parTheme.get(t).push(p.properties.Ordre?.number ?? null);
  });
  const mauvais = [...parTheme.entries()].filter(([, o]) => {
    const tri = o.slice().sort((a, b) => a - b);
    return JSON.stringify(tri) !== JSON.stringify(tri.map((_, i) => (i + 1) * 10));
  }).map(([t]) => nomT.get(t));
  chk('Ordre par pas de 10 dans chaque thématique', mauvais.length === 0, mauvais.slice(0, 3).join(' | '));

  const seuil = T.filter((p) => p.properties.Seuil?.number != null)
    .map((p) => `${txt(p, 'Name')}=${p.properties.Seuil.number}`);
  chk('Seuil posé sur Gestions des conflits seulement', seuil.length === 1 && seuil[0] === 'Gestions des conflits=4', seuil.join(', ') || 'aucun');

  // Le contenu, pas seulement les comptes : on compare chaque champ à la source.
  const parCode = new Map(C.map((p) => [txt(p, 'Code'), p]));
  const ecarts = [];
  src.competences.forEach((s) => {
    const p = parCode.get(s.code);
    if (!p) { ecarts.push(`${s.code} absente`); return; }
    if (txt(p, 'Name') !== s.name) ecarts.push(`${s.code} nom`);
    if (txt(p, 'Description') !== s.definition) ecarts.push(`${s.code} définition`);
    if ((p.properties['Difficulté']?.select?.name) !== s.difficulte) ecarts.push(`${s.code} difficulté`);
    if (nomT.get((p.properties['📚 Thèmes']?.relation ?? [])[0]?.id) !== s.theme) ecarts.push(`${s.code} thématique`);
    const e = src.enonces[s.code] || {};
    [1, 2, 3].forEach((n) => { if (txt(p, `Énoncé N${n}`) !== (e[String(n)] ?? e[n])) ecarts.push(`${s.code} énoncé ${n}`); });
  });
  chk('chaque compétence conforme à la source, champ par champ', ecarts.length === 0, `${ecarts.length} écart(s) : ${ecarts.slice(0, 4).join(', ')}`);

  console.log(A.join('\n'));
  return A.every((l) => l.startsWith('  OK'));
}

(async () => {
  const ds = await dataSources();
  console.log(SIMULATION ? '=== SIMULATION — aucune écriture ===\n' : '=== REFONTE V7 ===\n');
  if (PHASE === '2' || PHASE === 'tout') { console.log('--- Phase 2 : sauvegarde et purge ---'); await purger(ds); console.log(); }
  if (PHASE === '3' || PHASE === 'tout') { console.log('--- Phase 3 : import ---'); await importer(ds); console.log(); }
  if (PHASE === '4' || PHASE === 'tout') {
    if (SIMULATION) { console.log('--- Phase 4 : vérification (ignorée en simulation) ---'); return; }
    console.log('--- Phase 4 : vérification par relecture de Notion ---');
    process.exitCode = (await verifier(ds)) ? 0 : 1;
  }
})().catch((err) => { console.error('ÉCHEC :', err.message); process.exit(1); });
