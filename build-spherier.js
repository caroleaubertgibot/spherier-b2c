const fs = require('fs');
const path = require('path');
const { getReferentiel } = require('./index.js');
const { DIMENSIONS } = require('./dimensions.js');

// Chaque placeholder est un commentaire suivi d'une valeur par défaut, pour que le
// template reste ouvrable tel quel dans un navigateur avant génération.
const PLACEHOLDERS = [
  { marker: '/*__REFERENTIEL__*/', value: () => referentielJson },
  { marker: '/*__DIMENSIONS__*/', value: () => JSON.stringify(DIMENSIONS, null, 2) },
];

let referentielJson = '{}';

function injectPlaceholder(html, marker, replacement) {
  const index = html.indexOf(marker);
  if (index === -1) {
    throw new Error(`Placeholder introuvable dans le template : ${marker}`);
  }
  // Consomme la valeur par défaut qui suit le marqueur : objet, tableau ou chaîne.
  const rest = html.slice(index + marker.length);
  const openChar = rest[0];

  if (openChar === "'" || openChar === '"') {
    const fin = rest.indexOf(openChar, 1);
    if (fin === -1) {
      throw new Error(`Chaîne par défaut non fermée après ${marker}`);
    }
    return html.slice(0, index) + replacement + rest.slice(fin + 1);
  }

  const closeChar = openChar === '[' ? ']' : '}';
  if (openChar !== '{' && openChar !== '[') {
    throw new Error(`Valeur par défaut inattendue après ${marker}`);
  }
  let depth = 0;
  let end = -1;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === openChar) depth++;
    else if (rest[i] === closeChar) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) {
    throw new Error(`Valeur par défaut non fermée après ${marker}`);
  }
  return html.slice(0, index) + replacement + rest.slice(end + 1);
}

async function build() {
  const referentiel = await getReferentiel();
  referentielJson = JSON.stringify(referentiel, null, 2);

  const templatePath = path.join(__dirname, 'spherier.template.html');
  const outputPath = path.join(__dirname, 'spherier.html');

  let html = fs.readFileSync(templatePath, 'utf8');
  for (const { marker, value } of PLACEHOLDERS) {
    html = injectPlaceholder(html, marker, value());
  }

  fs.writeFileSync(outputPath, html);

  const nbThemes = referentiel.themes.length;
  const nbCompetences = referentiel.competences.length;
  console.log(`Sphérier généré : ${outputPath}`);
  console.log(`  ${nbThemes} thème(s), ${nbCompetences} compétence(s)`);
}

build().catch((err) => {
  console.error('Erreur lors de la génération du sphérier:', err.body ?? err.message ?? err);
  process.exit(1);
});
