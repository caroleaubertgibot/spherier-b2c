require('dotenv').config({ quiet: true });

const { creerClientServeur, TABLE_SNAPSHOTS } = require('../../supabase-client.js');
const { assemblerBlob } = require('../../blob-snapshot.js');
const { getReferentiel } = require('../../index.js');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function reponse(statusCode, payload) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(payload) };
}

// POST /api/snapshot-save
// Corps attendu : { clientId, label?, levels: { CODE: 1..4 }, cibles: ["CODE", ...] }
// Le navigateur n'envoie que les niveaux, les cibles et un libellé libre ; la structure
// (dimensions, thèmes, libellés de compétences) est gelée ici à partir de Notion.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return reponse(405, { erreur: 'Méthode non autorisée, utilisez POST.' });
  }

  let corps;
  try {
    corps = JSON.parse(event.body || '{}');
  } catch {
    return reponse(400, { erreur: 'Corps de requête JSON invalide.' });
  }

  const { clientId, levels, cibles } = corps;
  // Le navigateur parle de "label", la colonne s'appelle "libelle" : on accepte les deux.
  const libelleBrut = corps.label ?? corps.libelle;

  if (!clientId || !UUID_RE.test(clientId)) {
    return reponse(400, { erreur: 'clientId manquant ou invalide (UUID attendu).' });
  }
  if (levels !== undefined && (typeof levels !== 'object' || levels === null || Array.isArray(levels))) {
    return reponse(400, { erreur: 'levels doit être un objet { CODE: niveau }.' });
  }
  if (cibles !== undefined && !Array.isArray(cibles)) {
    return reponse(400, { erreur: 'cibles doit être un tableau de Codes.' });
  }

  const libelle = typeof libelleBrut === 'string' && libelleBrut.trim() !== ''
    ? libelleBrut.trim()
    : null;

  try {
    const referentiel = await getReferentiel();
    const blob = assemblerBlob({
      referentiel,
      niveaux: levels || {},
      cibles: cibles || [],
    });

    const supabase = creerClientServeur();
    const { data, error } = await supabase
      .from(TABLE_SNAPSHOTS)
      .insert({ client_id: clientId, libelle, blob })
      .select('id, client_id, libelle, cree_le, blob')
      .single();

    if (error) {
      console.error('Insertion du snapshot impossible:', error);
      return reponse(502, { erreur: 'Insertion du snapshot impossible.' });
    }

    return reponse(201, { snapshot: data });
  } catch (err) {
    console.error('snapshot-save:', err);
    return reponse(500, { erreur: 'Erreur serveur inattendue.' });
  }
};
