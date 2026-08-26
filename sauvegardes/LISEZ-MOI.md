# Sauvegardes de la table `snapshots`

Exports CSV de la table Supabase `snapshots`, pris à la main comme filet avant une
étape risquée. Supabase n'a pas de rétention longue sur le plan gratuit : ces fichiers
sont la seule copie hors ligne.

## Régénérer un export

```
npm run export:snapshots
```

Le fichier est daté du jour (`snapshots-AAAA-MM-JJ.csv`) et écrase celui de la même
journée. Colonnes : `id`, `client_id`, `libelle`, `cree_le`, `blob`.

Le `blob` est du JSON échappé selon les règles CSV, relisible tel quel par Excel,
Numbers ou un `csv.DictReader`. Un BOM est écrit en tête pour qu'Excel affiche
correctement les accents.

## Deux versions de blob cohabitent

- `version_schema: 1` — ancien référentiel (thèmes × 4 axes, échelle à 4 niveaux).
  Ces lignes sont ignorées en lecture par l'application, et conservées telles quelles.
- `referential_version: 2` — référentiel individus. Ne contient que `levels` et
  `selections` : la structure n'y est pas gelée, elle est relue en direct depuis
  Notion. **Un snapshot v2 n'est donc pas interprétable seul** — il faut le référentiel
  du moment pour en faire sens.

## Avant de mettre de vrais membres en production

Ces exports ne contiennent aujourd'hui que des comptes de test. Le jour où de vrais
membres s'auto-évaluent, ce CSV devient un fichier de données personnelles sensibles
— un positionnement intime, nominatif par son `client_id`. Versionner ces exports
dans Git deviendra alors discutable, même en dépôt privé : l'historique Git conserve
tout, indéfiniment, et une suppression ultérieure ne l'efface pas.

À ce moment-là, il faudra soit sortir ce dossier du dépôt (`.gitignore` + sauvegarde
ailleurs), soit s'en tenir aux sauvegardes propres à Supabase.
