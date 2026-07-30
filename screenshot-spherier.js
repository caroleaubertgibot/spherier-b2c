const { chromium } = require('playwright');

// Servi par `netlify dev` : en file:// l'appel à /api/snapshot-latest échoue et la page
// retombe sur l'état par défaut, ce qui ne reflète pas le rendu réel.
const BASE_URL = process.env.SPHERIER_URL || 'http://localhost:8888';

// Le client est identifié par l'URL : sans ?c=<uuid>, la page affiche l'état
// "lien invalide" et non le sphérier réel.
const CLIENT_ID = process.env.SPHERIER_CLIENT || '74ea8846-86ab-4f5a-9345-0dd6db154caa';

async function run() {
  const fileUrl = `${BASE_URL}/spherier.html?c=${CLIENT_ID}`;
  const browser = await chromium.launch();
  const errors = [];

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  desktop.on('pageerror', (e) => errors.push('desktop: ' + e.message));
  await desktop.goto(fileUrl);
  await desktop.waitForTimeout(400);
  await desktop.screenshot({ path: 'screenshot-desktop.png' });

  // Clic sur une étoile -> panneau compétence (palier, description, ressources, CTA)
  await desktop.click('.node-sub');
  await desktop.waitForTimeout(300);
  await desktop.screenshot({ path: 'screenshot-desktop-detail.png' });

  // Bascule de la "cible du mois" -> anneau doré + compteur
  await desktop.click('#toggle-cta');
  await desktop.waitForTimeout(300);
  await desktop.screenshot({ path: 'screenshot-desktop-selected.png' });

  // Second thème -> cœur et étoiles repeuplés
  const tabs = await desktop.$$('.theme-tab');
  if (tabs.length > 1) {
    await tabs[1].click();
    await desktop.waitForTimeout(300);
    await desktop.screenshot({ path: 'screenshot-desktop-theme2.png' });
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on('pageerror', (e) => errors.push('mobile: ' + e.message));
  await mobile.goto(fileUrl);
  await mobile.waitForTimeout(400);
  await mobile.screenshot({ path: 'screenshot-mobile.png' });

  await mobile.click('.node-sub');
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: 'screenshot-mobile-detail.png' });

  await browser.close();

  if (errors.length > 0) {
    console.error('Erreurs JS détectées :');
    errors.forEach((e) => console.error('  - ' + e));
    process.exit(1);
  }
  console.log('Screenshots générés, aucune erreur JS.');
}

run().catch((err) => {
  if (/ERR_CONNECTION_REFUSED|ECONNREFUSED/.test(err.message)) {
    console.error(`Serveur injoignable sur ${BASE_URL} — lancez d'abord : npx netlify dev`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
