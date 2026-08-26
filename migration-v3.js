require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const { Client, collectPaginatedAPI } = require('@notionhq/client');

// Migration ponctuelle du référentiel v2 (5 dimensions) vers v3 (3 dimensions).
// Conservée dans le dépôt comme trace de ce qui a été écrit dans Notion.
//
// Pour chaque ligne du fichier de correspondance, la page est retrouvée par son `Code`
// ACTUEL — jamais par son titre, deux compétences pouvant porter des libellés proches.
// Seuls `Code`, `Description` et `Difficulté` sont écrits ; `Name` et la relation
// `📚 Thèmes` ne sont pas touchés, et les pages archivées sont ignorées.

const DS_COMPETENCES = '3aaabf02-c476-80d4-bc8d-000b153e2b22';
const PROP_DIFFICULTE = 'Difficulté';

// L'API Notion plafonne à ~3 requêtes par seconde. On reste en deçà, en série.
const PAUSE_MS = 340;

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const texte = (page, nom) => {
  const p = page.properties[nom];
  return ((p?.rich_text ?? p?.title ?? []).map((s) => s.plain_text).join('')).trim();
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Une coupure réseau ou une limite de débit ne doit pas laisser la base à moitié migrée.
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

async function migrer({ simulation }) {
  const chemin = process.argv[2] || path.join(process.env.HOME, 'Downloads', 'migration_competences_v2_vers_v3.json');
  const correspondance = JSON.parse(fs.readFileSync(chemin, 'utf8'));

  const pages = await collectPaginatedAPI(notion.dataSources.query, { data_source_id: DS_COMPETENCES });
  const actives = pages.filter((p) => p.properties.Actif?.checkbox === true);

  const parCode = new Map();
  actives.forEach((p) => {
    const code = texte(p, 'Code');
    if (code) parCode.set(code, p);
  });

  const journal = { ecrites: 0, deja: 0, introuvables: [], erreurs: [] };

  for (const ligne of correspondance) {
    // Reprise après interruption : une page déjà migrée porte son code v3.
    if (parCode.has(ligne.code_v3) && !parCode.has(ligne.code_v2)) {
      journal.deja += 1;
      continue;
    }
    const page = parCode.get(ligne.code_v2);
    if (!page) {
      journal.introuvables.push(ligne.code_v2);
      continue;
    }

    if (simulation) {
      journal.ecrites += 1;
      continue;
    }

    try {
      await avecReprise(() => notion.pages.update({
        page_id: page.id,
        properties: {
          Code: { rich_text: [{ text: { content: ligne.code_v3 } }] },
          Description: { rich_text: [{ text: { content: ligne.description_v3 } }] },
          [PROP_DIFFICULTE]: { select: { name: ligne.difficulte } },
        },
      }));
      journal.ecrites += 1;
      if (journal.ecrites % 20 === 0) {
        process.stdout.write(`  ${journal.ecrites}/${correspondance.length}…\n`);
      }
      await dormir(PAUSE_MS);
    } catch (err) {
      journal.erreurs.push({ code: ligne.code_v2, message: err.message });
    }
  }

  console.log(simulation ? '\n=== SIMULATION (aucune écriture) ===' : '\n=== MIGRATION TERMINÉE ===');
  console.log(`  pages écrites      : ${journal.ecrites}`);
  console.log(`  déjà migrées       : ${journal.deja}`);
  console.log(`  introuvables       : ${journal.introuvables.length}${journal.introuvables.length ? ' → ' + journal.introuvables.join(', ') : ''}`);
  console.log(`  erreurs            : ${journal.erreurs.length}`);
  journal.erreurs.forEach((e) => console.log(`     ${e.code} : ${e.message}`));

  if (journal.erreurs.length > 0 || journal.introuvables.length > 0) process.exit(1);
}

migrer({ simulation: process.env.SIMULATION === '1' }).catch((err) => {
  console.error('Migration interrompue :', err.message ?? err);
  process.exit(1);
});
