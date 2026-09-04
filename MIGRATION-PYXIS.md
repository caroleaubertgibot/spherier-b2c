# Session Pyxis — ce qu'il faut créer, et ce qu'il faut en rapporter

**Objet** : ne pas terminer la visio en s'apercevant qu'il manque un identifiant.

Le principe : **tout ce qui se crée en séance produit une ou deux valeurs à noter.**
Chaque valeur ci-dessous porte son emplacement exact dans l'interface. Ce qui n'est pas
listé ici n'est pas à chercher pendant la visio.

Un mot sur les secrets : trois des valeurs à collecter sont des clés qui donnent un
accès complet. Elles ne passent ni par courriel ni par messagerie — un gestionnaire de
mots de passe partagé, ou saisies directement dans Netlify pendant la séance.

---

## Une règle qui s'applique à toutes les étapes : nommer `spherier-b2c`

Cette migration ne concerne que le **club de dev perso**. Le club de coachs migrera plus
tard, après le lancement des deux clubs — mais il migrera. On ouvre donc les comptes
Pyxis en le prévoyant dès maintenant : cela ne coûte rien aujourd'hui et évite un
renommage général quand la seconde instance arrivera.

**Tout se nomme `spherier-b2c`, jamais « spherier » tout court** — dépôt, projet
Supabase, site Netlify. Un nom générique se paie deux fois : au moment où il devient
ambigu, et au moment où il faut le changer.

Et les comptes se structurent pour qu'un second projet Supabase et un second site
Netlify puissent s'ajouter **sans réorganisation** : une organisation Supabase qui
accueille plusieurs projets, une équipe Netlify qui accueille plusieurs sites. Pas un
compte par instance.

> Chez Netlify, le nom du site **est** son sous-domaine : le renommer change l'URL des
> membres. C'est là que la règle compte le plus.

---

## Vue d'ensemble

| # | Étape | Qui | Ce qu'on en rapporte |
|---|---|---|---|
| 1 | Espace Notion + page « Référentiel Sphérier » | Pyxis | l'identifiant de la page |
| 2 | Intégration Notion + connexion à la page | Pyxis | le jeton d'intégration |
| 3 | Projet Supabase + schéma SQL | Pyxis | l'URL du projet et la clé de service |
| 4 | Dépôt GitHub | Pyxis | le nom du dépôt et mon accès |
| 5 | Équipe et site Netlify | Pyxis | le nom d'équipe et le sous-domaine |
| 6 | Domaine et DNS | Pyxis | qui tient la zone, et le nom visé |

**Ce qui se fait APRÈS la séance, par script** : les quatre bases Notion, avec leurs
noms de propriétés exacts. Aucune saisie manuelle — une faute de frappe sur un nom de
propriété vide silencieusement le champ correspondant, sans message d'erreur.

---

## 1 · Notion — l'espace et la page

**À faire en séance**
1. Créer l'espace de travail Notion (ou choisir celui qui accueillera le sphérier).
2. Y créer une **page vide** nommée `Référentiel Sphérier`. Elle restera vide : c'est le
   script qui y déposera les quatre bases.

**À rapporter — l'identifiant de la page**

Ouvrir la page, cliquer sur `Partager` → `Copier le lien`. Le lien ressemble à :

```
https://www.notion.so/Referentiel-Spherier-a1b2c3d4e5f67890abcdef1234567890
```

L'identifiant est la **suite de 32 caractères à la fin**, juste après le dernier tiret :
`a1b2c3d4e5f67890abcdef1234567890`. Coller le lien entier suffit, je saurai l'extraire.

> Si le lien se termine par `?pvs=4` ou similaire, ignorer cette partie.

---

## 2 · Notion — l'intégration

**À faire en séance**
1. Aller sur **notion.so/profile/integrations** → `Nouvelle intégration`.
2. Nom : `Sphérier`. Espace de travail : celui de l'étape 1.
3. Capacités : **Lire**, **Mettre à jour** et **Insérer** du contenu. Pas besoin des
   informations utilisateur.
4. **Connecter l'intégration à la page** — c'est l'étape qu'on oublie : retourner sur la
   page `Référentiel Sphérier`, menu `•••` en haut à droite → `Connexions` →
   `Ajouter des connexions` → choisir `Sphérier`.

> Sans cette connexion, le script ne voit pas la page et échoue sur « page introuvable ».
> Les bases créées ensuite héritent de la connexion, il n'y aura rien à repartager.

**À rapporter — le jeton d'intégration** *(secret)*

Sur la page de l'intégration, onglet `Configuration` → **Internal Integration Secret** →
`Afficher` → `Copier`. Il commence par `ntn_`.

---

## 3 · Supabase — le projet et son schéma

**À faire en séance**
1. Créer l'**organisation** (si elle n'existe pas) puis le **projet**.
   - Organisation : un nom générique — `Pyxis` ou `Sphérier` — car elle accueillera
     aussi le projet du club de coachs plus tard.
   - Projet : **`spherier-b2c`**, explicitement. Pas `spherier`.
   - Région : **Europe (eu-west-1 ou eu-central-1)** — les membres sont en France, et
     les données restent dans l'UE.
2. Choisir un mot de passe de base de données et le ranger dans le gestionnaire de mots
   de passe. Il ne servira pas au sphérier, mais il est irrécupérable ensuite.
3. Attendre que le projet soit prêt (une à deux minutes).
4. Menu de gauche → `SQL Editor` → `New query` → coller **tout** le fichier
   [`supabase/schema.sql`](supabase/schema.sql) → `Run`.

> Le script affiche un tableau de contrôle : **toutes les lignes doivent afficher
> « OK »**. Sinon, le relancer en entier — il est conçu pour être rejoué sans risque.

**À rapporter — deux valeurs**

- **L'URL du projet** : `Project Settings` → `Data API` → **Project URL**.
  De la forme `https://abcdefgh.supabase.co`.
  ⚠️ **Sans rien après `.co`** — pas de `/rest/v1/`. Cette erreur nous a déjà coûté une
  soirée de débogage sur l'autre instance.
- **La clé de service** *(secret)* : `Project Settings` → `API Keys` → la clé
  **`service_role`** / `secret`. Cliquer sur `Reveal` puis copier.
  ⚠️ **Surtout pas la clé `anon` / publique** : elle est bloquée par la protection RLS
  et le sphérier ne pourrait rien lire ni écrire.

---

## 4 · GitHub — le dépôt

**À faire en séance**
1. Créer le dépôt, **privé**, sous le compte ou l'organisation Pyxis.
   Nom : **`spherier-b2c`**.
2. M'y donner accès en écriture (`Settings` → `Collaborators`), ou à Cyril.

**À rapporter**

- Le chemin complet du dépôt : `organisation/nom-du-depot`.
- Confirmer que l'invitation d'accès est bien envoyée et acceptée.

---

## 5 · Netlify — l'équipe et le site

**À faire en séance**
1. Créer ou identifier l'**équipe** Netlify qui hébergera le site. Elle accueillera
   aussi le site des coachs plus tard : lui donner un nom générique, pas un nom
   d'instance.
2. Créer le site depuis le dépôt GitHub de l'étape 4. Netlify demandera d'installer son
   application GitHub sur l'organisation : **autoriser au moins ce dépôt**.
3. Réglages de build : **aucune commande de build**, dossier publié `public`, dossier de
   fonctions `netlify/functions`. Le `netlify.toml` du dépôt les porte déjà.

**À rapporter**

- Le **nom d'équipe** (visible dans l'URL d'administration :
  `app.netlify.com/teams/<nom-equipe>/…`).
- Le **nom du site** : **`spherier-b2c`**, qui est aussi son sous-domaine —
  `spherier-b2c.netlify.app`.
  ⚠️ Chez Netlify **le nom du site EST le sous-domaine** : le renommer change l'URL que
  les membres ont entre les mains. C'est la raison d'être de la règle de nommage.
- **Qui pose les variables d'environnement.** Sur les offres gratuites, l'API refuse de
  les écrire : il faut passer par l'interface, donc quelqu'un ayant accès à l'équipe.
  À décider en séance, pas après.

**Les sept variables à poser**, une fois les valeurs ci-dessus collectées :

```
NOTION_TOKEN          étape 2
DB_THEMES             produit par le script de création des bases
DB_COMPETENCES        produit par le script de création des bases
DB_RESSOURCES         produit par le script de création des bases
SUPABASE_URL          étape 3
SUPABASE_SECRET_KEY   étape 3
REFRESH_TOKEN         valeur aléatoire, que je génère
CLUB                  'b2c'
```

Toutes marquées comme **secrètes**. Elles ne sont lues qu'au déploiement : après
modification, redéployer.

---

## 6 · Domaine et DNS

**À rapporter**

- Le **nom de domaine visé** pour le sphérier — domaine racine ou sous-domaine.
- **Qui tient la zone DNS** : le registrar, et qui y a les accès. C'est souvent la seule
  chose que personne n'a sous la main le jour venu.
- Si un certificat ou une redirection existent déjà sur ce nom.

> Sans domaine personnalisé, le sphérier reste servi sur `<site>.netlify.app`, ce qui
> fonctionne parfaitement. Le domaine peut donc venir après.

---

## Après la séance — ce que je fais

1. Générer un `REFRESH_TOKEN` aléatoire.
2. Lancer le script de création des **quatre bases Notion** avec le jeton et
   l'identifiant de page. Il crée Thèmes, Compétences, Ressources et Clients avec les
   noms de propriétés exacts, et affiche les trois identifiants de bases.
3. Poser les sept variables, déployer, et vérifier que `/api/referential` répond et que
   `club` vaut bien la valeur attendue.
4. Importer le référentiel depuis l'export gelé
   ([`sauvegardes/export-notion-2026-09-04.json`](sauvegardes/export-notion-2026-09-04.json)),
   dont **toutes les relations sont exprimées par `Code`** — c'est ce qui le rend
   utilisable dans un espace Notion différent de celui d'origine.
5. Régénérer les UUID des membres **par script** sur la nouvelle base Clients. Jamais à
   la main : un UUID est le seul secret protégeant les données d'un membre, il doit être
   aléatoire.

---

## Deux corrections à apporter au schéma cible

Relevées en gelant l'espace actuel — à ne pas reproduire chez Pyxis.

**La base Clients doit porter une propriété d'URL d'espace.** Elle avait été décidée et
n'a jamais été créée. Elle alimente le lien « ← Mon espace » de l'en-tête du sphérier ;
si le champ est vide, le lien n'apparaît simplement pas. Le script de création la pose.

**La relation Ressources ↔ Compétences doit être bidirectionnelle.** Dans l'espace
actuel elle est déclarée d'un seul côté (`single_property` sur Compétences), si bien que
la base Ressources ne montre pas à quelles compétences elle est rattachée. L'export a dû
reconstituer ce lien par inversion. Le script de création la pose en duale.

> Rappel qui vaut pour toutes les relations : **une relation duale se crée en UNE seule
> instruction**. La créer en deux fois produit deux paires orphelines non synchronisées,
> sans que rien ne le signale.
