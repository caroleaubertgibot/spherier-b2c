const { ECHELLE_V2 } = require('./dimensions-v2.js');

// Niveau à partir duquel une compétence compte pour débloquer les thématiques suivantes.
const NIVEAU_ACQUIS = 2;

// Calcul de l'ouverture des thématiques.
//
// La règle vit ICI et nulle part ailleurs : le serveur la calcule, le navigateur ne fait
// que l'afficher. L'état ouvert/verrouillé n'est jamais stocké — il se déduit toujours
// du dernier snapshot et du graphe courant, donc corriger une filiation dans Notion
// rouvre ou referme les thématiques sans migration de données.
//
// - Une thématique racine (que rien ne nourrit) est toujours ouverte.
// - Une thématique non racine est ouverte dès qu'AU MOINS UNE de ses sources a la
//   moitié de ses compétences (arrondi inférieur) au niveau 2 ou plus.
function calculerOuverture({ referentiel, levels = {} }) {
  const competencesParTheme = new Map();
  referentiel.competencies.forEach((c) => {
    if (!c.theme) return;
    if (!competencesParTheme.has(c.theme)) competencesParTheme.set(c.theme, []);
    competencesParTheme.get(c.theme).push(c.id);
  });

  const themeParId = new Map(referentiel.themes.map((t) => [t.id, t]));

  // Relation inverse : qui nourrit qui. `feeds` donne les cibles, on a besoin des sources.
  const sourcesParTheme = new Map(referentiel.themes.map((t) => [t.id, []]));
  referentiel.themes.forEach((source) => {
    source.feeds.forEach((cibleId) => {
      if (sourcesParTheme.has(cibleId)) sourcesParTheme.get(cibleId).push(source.id);
    });
  });

  // Avancement d'une thématique : combien de ses compétences ont atteint le niveau acquis,
  // et combien il en faut.
  function progression(themeId) {
    const codes = competencesParTheme.get(themeId) ?? [];
    const atteintes = codes.filter((code) => (levels[code] ?? 0) >= NIVEAU_ACQUIS).length;
    return { atteintes, seuil: Math.floor(codes.length / 2), total: codes.length };
  }

  const themes = {};
  referentiel.themes.forEach((theme) => {
    const sources = sourcesParTheme.get(theme.id) ?? [];

    if (sources.length === 0) {
      themes[theme.id] = { status: 'open', unlock_hint: '' };
      return;
    }

    const details = sources.map((sourceId) => {
      const source = themeParId.get(sourceId);
      const p = progression(sourceId);
      return { nom: source ? source.name : sourceId, ...p, satisfaite: p.atteintes >= p.seuil };
    });

    const ouverte = details.some((d) => d.satisfaite);
    themes[theme.id] = {
      status: ouverte ? 'open' : 'locked',
      unlock_hint: ouverte ? '' : indiceDeDeblocage(details),
    };
  });

  return themes;
}

// Phrase affichée sur une thématique verrouillée : elle doit dire quoi faire, et où en
// est le membre, pas seulement qu'elle est fermée.
function indiceDeDeblocage(details) {
  const palier = ECHELLE_V2[NIVEAU_ACQUIS];
  const conditions = details.map(
    (d) => `« ${d.nom} » (${d.atteintes}/${d.seuil} compétence${d.seuil > 1 ? 's' : ''} au palier « ${palier} » ou plus)`
  );
  const liste = conditions.length === 1 ? conditions[0] : conditions.join(' ou ');
  return `Se débloque via ${liste}.`;
}

// Niveaux complets : toute compétence du référentiel est présente, à 0 par défaut.
// Le 0 n'est pas un palier nommé, c'est l'étoile éteinte.
function niveauxComplets({ referentiel, levels = {} }) {
  const complets = {};
  referentiel.competencies.forEach((c) => {
    complets[c.id] = normaliserNiveau(levels[c.id]);
  });
  return complets;
}

function normaliserNiveau(valeur) {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return 0;
  return Math.min(3, Math.max(0, Math.round(n)));
}

module.exports = { calculerOuverture, niveauxComplets, normaliserNiveau, NIVEAU_ACQUIS };
