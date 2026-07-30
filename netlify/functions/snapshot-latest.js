require('dotenv').config({ quiet: true });

const { creerClientServeur, TABLE_SNAPSHOTS } = require('../../supabase-client.js');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function reponse(statusCode, payload) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(payload) };
}

// GET /api/snapshot-latest?clientId=<uuid>
// Renvoie le dernier snapshot du client, ou null s'il n'en a aucun.
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return reponse(405, { erreur: 'Méthode non autorisée, utilisez GET.' });
  }

  const clientId = (event.queryStringParameters || {}).clientId;
  if (!clientId || !UUID_RE.test(clientId)) {
    return reponse(400, { erreur: 'clientId manquant ou invalide (UUID attendu).' });
  }

  try {
    const supabase = creerClientServeur();
    const { data, error } = await supabase
      .from(TABLE_SNAPSHOTS)
      .select('id, client_id, libelle, cree_le, blob')
      .eq('client_id', clientId)
      .order('cree_le', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Lecture du snapshot impossible:', error);
      return reponse(502, { erreur: 'Lecture du snapshot impossible.' });
    }

    return reponse(200, { snapshot: data.length > 0 ? data[0] : null });
  } catch (err) {
    console.error('snapshot-latest:', err);
    return reponse(500, { erreur: 'Erreur serveur inattendue.' });
  }
};
