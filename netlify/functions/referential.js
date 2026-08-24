require('dotenv').config({ quiet: true });

const { getReferentielV2 } = require('../../referentiel-v2.js');

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function reponse(statusCode, payload, entetes = {}) {
  return { statusCode, headers: { ...HEADERS, ...entetes }, body: JSON.stringify(payload) };
}

// GET /api/referential
// Renvoie le graphe complet du référentiel v2, toujours lu en live depuis Notion :
// il n'est jamais figé dans un snapshot, pour que corriger un libellé côté Notion se
// répercute immédiatement sans redéploiement.
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return reponse(405, { erreur: 'Méthode non autorisée, utilisez GET.' });
  }

  try {
    const referentiel = await getReferentielV2();
    return reponse(200, referentiel, {
      // Cache court : le référentiel bouge rarement et la lecture coûte ~1,3 s.
      // Assez bref pour qu'une correction dans Notion se voie presque aussitôt.
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    });
  } catch (err) {
    console.error('referential:', err);
    return reponse(502, { erreur: 'Lecture du référentiel impossible.' });
  }
};
