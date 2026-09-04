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

## Purge des comptes de test (27 août 2026)

Les quatre comptes de test ont été retirés de Supabase avant la bascule, après copie
de leurs snapshots et de leurs notes. La table `snapshots` est append-only par
principe, mais un `DELETE` reste possible avec la clé de service — d'où cette copie.

Ce fichier **n'est plus dans le dépôt** : il porte des données de membres. Voir la
section suivante.

## Ce que ce dossier contient, et ce qu'il ne contient plus (4 septembre 2026)

Séparation faite à l'occasion du gel avant migration Pyxis.

**Versionné ici** — sauvegardes de RÉFÉRENTIEL, sans aucune donnée personnelle :

- `export-notion-2026-09-04.json` — l'état complet de Notion, relations par `Code`
- `referentiel-v3-avant-refonte-v7.json` — l'état V3, juste avant la refonte
- `competences-avant-migration-v3-2026-08-26.json`
- `difficulte-avant-renommage-fondamental.json` — ses trois UUID sont des
  identifiants d'options Notion, pas des membres
- `ordre-competences-initial.json`

**Sorti du dépôt** — tout ce qui porte des données de membres :

- les exports de `snapshots` (`snapshots-*.csv`)
- `comptes-de-test-supprimes-*.json`
- la section Clients de l'export Notion, désormais dans un fichier séparé

Le `.gitignore` porte les motifs correspondants : ces fichiers ne peuvent plus
revenir par inadvertance.

**Ce qui reste dans l'HISTORIQUE.** Les exports de snapshots et le fichier des
comptes supprimés ont été versionnés avant cette décision : ils demeurent dans
l'historique Git, qu'une suppression ne réécrit pas. Ce sont exclusivement des
comptes de test, tous purgés de Supabase depuis. Le dépôt étant recréé sans
historique à la migration Pyxis, la question s'éteindra d'elle-même — mais il ne
faut plus rien y ajouter d'ici là.

## Avant de mettre de vrais membres en production

Ces exports ne contiennent aujourd'hui que des comptes de test. Le jour où de vrais
membres s'auto-évaluent, ce CSV devient un fichier de données personnelles sensibles
— un positionnement intime, nominatif par son `client_id`. Versionner ces exports
dans Git deviendra alors discutable, même en dépôt privé : l'historique Git conserve
tout, indéfiniment, et une suppression ultérieure ne l'efface pas.

À ce moment-là, il faudra soit sortir ce dossier du dépôt (`.gitignore` + sauvegarde
ailleurs), soit s'en tenir aux sauvegardes propres à Supabase.
