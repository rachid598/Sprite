# Spiritdex

Traqueur de collection pour les Sprites de Fortnite, en français. Quatre onglets :
Ma collection, Comparer, Sauvegarde, Synchro.

Site statique, sans dépendances, sans build, sans backend. Tout tourne dans le navigateur.

## Fonctionnalités

- **Deux saisons** — un sélecteur dans l'en-tête bascule entre la Saison 4
  (*Override*, 10 Sprites / 30 cases) et la Saison 3 (25 Sprites / 117 cases).
  Chaque saison a sa collection, ses variantes, son stockage et sa branche de
  synchronisation : rien ne se mélange, rien ne s'écrase.
- **Checklist** — une case par couple Sprite × variante, propre à la saison
  affichée.
- **Progression** — pourcentage global, Sprites débloqués, collections complétées.
- **Filtres** — statut (tous / possédés / manquants / maîtrisés), rareté, variante,
  recherche texte, tri par rareté, nom, progression, maîtrise ou taux d'apparition.
- **Progression par rareté** — une barre par rareté sous les compteurs, en plus du
  total général.
- **Filtres repliables** — rareté et variante se replient sur téléphone ; un badge
  signale les filtres actifs restés hors de vue.
- **Cochage instantané** — un clic ne met à jour que la case et sa carte, jamais
  toute la grille (133 ms → 33 ms sur processeur bridé ×4).
- **Application installable** — manifeste + service worker : le site s'installe sur
  téléphone comme sur ordinateur et fonctionne **entièrement hors ligne**, les 118
  illustrations comprises (136 fichiers pré-mis en cache).
- **Sauvegarde locale** — `localStorage`, aucun compte, aucune donnée envoyée.
- **Sauvegarde fichier** — export de la collection en `.json` et ré-import, avec le
  même arbitrage remplacer / fusionner que pour les liens partagés.
- **Onglet Comparer** — vue dédiée face à un membre du salon : bandeau « vous vs
  lui », quatre familles (il peut vous aider / vous pouvez l'aider / vous deux /
  ni l'un ni l'autre) et grille illustrée variante par variante.
- **Trois niveaux par case** — un clic marque *obtenu*, un deuxième *maîtrisé*
  (couronne dorée), un troisième efface. Deux boutons par carte : « Tout cocher »
  et « Tout maîtriser ».
- **Décochage réversible** — « Tout décocher » laisse une bannière *Annuler*
  pendant quinze secondes, l'état d'avant étant conservé en mémoire.
- **Verrou d'édition** — un bouton cadenas bloque la saisie pour éviter les clics
  involontaires. Filtres, tri, comparaison, export et synchro restent actifs ;
  seule la modification des cases est suspendue. Le choix est mémorisé.
- **Rappel de sauvegarde** — une bannière propose d'enregistrer un fichier au-delà
  de quinze cases cochées sans export, puis de nouveau chaque fois que la
  collection a gagné vingt cases depuis la dernière sauvegarde. La synchro ne
  fait pas taire le rappel, elle en relève seulement le seuil.
- **Synchronisation entre appareils** — Firebase Realtime Database via son API
  REST, sans bibliothèque ni outil à installer (`docs/firebase.md`). Un salon
  contient plusieurs profils nommés : chacun synchronise sa propre collection
  entre ses appareils et consulte celle des autres, sans fusion. Une solution
  auto-hébergée reste disponible dans `server/`.
- **Partage & synchronisation** — la collection est encodée en champ de bits dans l'URL
  (`?c=…`). Ouvrir le lien sur un autre appareil propose de remplacer, fusionner ou ignorer.
  Le lien, l'export PNG et le détail « ce qu'il me manque / ce que je possède »
  sont regroupés en bas de l'onglet Comparer.
- Accessible au clavier, responsive, respecte `prefers-reduced-motion`.

## Structure

```
index.html          redirection vers fr/
fr/index.html       la page du site
assets/css/         feuille de style unique
assets/js/data.js   base de données des Sprites, variantes, raretés
assets/js/i18n.js   tous les textes affichés
sw.js               service worker (généré — voir tools/gen-sw.mjs)
tools/gen-sw.mjs    régénère sw.js depuis la liste réelle des fichiers
fr/manifest.webmanifest     manifeste d'installation
assets/sprites/     illustrations des Sprites (118 fichiers .webp 128 px)
assets/js/art.js    rendu des illustrations, avec repli SVG généré
assets/js/pwa.js    service worker, invite d'installation, état réseau
assets/js/salon.js  client de synchronisation (API REST Firebase)
docs/firebase.md    guide de mise en place pas à pas
server/             Worker Cloudflare + KV (voir server/README.md)
assets/js/store.js  persistance locale et encodage du code de partage
assets/js/app.js    rendu, filtres, interactions
```

## Développement

Les modules ES nécessitent un serveur HTTP (pas d'ouverture en `file://`) :

```bash
npx http-server -p 8000 .
# puis http://127.0.0.1:8000/fr/
```

## Saisons

`assets/js/data.js` définit `SAISONS` : chaque entrée porte ses Sprites, ses
variantes, son ordre de bits figé, sa clé de stockage et son octet de version.

Les exports (`SPRITES`, `TOTAL_SLOTS`, `ALL_SLOTS`…) sont des `let` : les modules
ES les exposent de façon **vive**, si bien que `setSaison(id)` met à jour tous
les fichiers qui les importent sans qu'aucun n'ait à être modifié.

Trois règles pour ne rien casser :

- **`cle` ne change jamais.** C'est le nom sous lequel la collection est
  enregistrée dans le navigateur. Celle de la Saison 3 garde le nom historique
  du projet (`sprite-tracker:v3`) ; la renommer rendrait les collections
  existantes invisibles, sans message d'erreur.
- **`codeVersion` vaut le numéro de la saison.** Un lien de partage émis dans
  une saison est donc refusé dans une autre, au lieu de produire une collection
  absurde. Même principe pour les sauvegardes `.json`, qui portent leur saison.
- **La Saison 3 garde son chemin de synchronisation** (`/profiles/…`). Les
  saisons suivantes vivent sous `/saisons/<id>/profiles/…` : un appareil resté
  en ancienne version continue de synchroniser la Saison 3 et ne peut pas
  toucher aux autres.

### Ajouter une saison

1. Définir `SPRITES_Sn`, `VARIANTS_Sn`, `SLOT_ORDER_Sn` (figé dès le premier
   jour), `RENAMES_Sn`, `VARIANT_RENAMES_Sn`, `DATA_DATE_Sn`, `DROP_DATE_Sn`.
2. Ajouter l'entrée **en tête** de `SAISONS` avec une `cle` neuve et une
   `codeVersion` inédite, et passer `encours: false` sur la précédente.
3. Mettre `SAISON_DEFAUT` sur la nouvelle saison.
4. Ajouter noms et effets dans `assets/js/i18n.js`, puis lancer
   `node tools/check-data.mjs` — il contrôle chaque saison séparément.

## Mettre à jour les données du jeu

À chaque saison, Fortnite ajoute des Sprites et des variantes. La règle absolue de
cette mise à jour : **la progression déjà enregistrée ne doit jamais disparaître.**

### Ce qui garantit qu'aucune case n'est perdue

Une case est stockée sous la forme `<idDuSprite>:<idDeLaVariante>` — par exemple
`reaper:gold`. Deux mécanismes la protègent :

- **Ajouter est sans risque.** Un nouveau Sprite ou une nouvelle variante ne touche
  à aucune clé existante. `ALL_SLOTS` place les nouveautés en fin de liste, donc les
  anciens codes de partage et les anciennes sauvegardes restent lisibles.
- **Renommer se déclare.** Changer un `id` sans rien dire ferait disparaître les
  cases correspondantes. C'est le rôle de `RENAMES` et `VARIANT_RENAMES` dans
  `assets/js/data.js` : `migrateSlot()` traduit l'ancien nom vers le nouveau à
  **chaque lecture** — `localStorage`, fichier `.json` importé, code de partage.
  Ces entrées ne coûtent rien et ne s'enlèvent jamais.

- **L'ordre des bits est figé.** `SLOT_ORDER` dans `assets/js/data.js` fixe la
  position de chaque case dans les codes de partage. Les cases absentes de cette
  liste sont ajoutées en fin de `ALL_SLOTS`, mais **dans l'ordre de `SPRITES`** :
  tant qu'elles n'y sont pas recopiées, ajouter une variante à un Sprite plus haut
  dans la liste les décalerait, et un ancien lien se relirait sur les mauvais
  Sprites. `node tools/check-data.mjs` refuse de passer tant que ce n'est pas fait
  et affiche le bloc à recopier.

Ce qui est **interdit** sans précaution : supprimer un Sprite ou une variante, ou
réordonner `SLOT_ORDER`. Les deux invalident les codes de partage existants. Si c'est
inévitable, incrémenter `CODE_VERSION` dans `assets/js/store.js`.

### Sources

Se limiter à des sources vérifiables, et croiser au moins deux d'entre elles avant
d'écrire quoi que ce soit :

| Source | Sert à |
|---|---|
| <https://fortnite.gg/sprites> | liste des Sprites, variantes, taux d'apparition |
| Notes de mise à jour d'Epic Games | confirmation des sorties et des effets passifs |
| Fichiers du jeu extraits (FModel, dataminers) | variantes présentes mais pas encore sorties |

Une variante vue uniquement dans les fichiers du jeu va dans `unreleased`, pas dans
`variants` : elle reste masquée par défaut et **ne compte pas** dans le total. Un
effet passif non documenté publiquement garde `ability.verified: false` — le site
affiche alors « Effet non confirmé » plutôt que d'inventer.

**Les taux d'apparition demandent une prudence particulière.** Ils changent à chaque
patch, quand de nouveaux Sprites entrent dans le butin, et les relevés publics se
contredisent : trois sources consultées en août 2026 donnaient trois jeux de chiffres
différents pour les mêmes Sprites. Retenir le relevé le plus récent explicitement
rattaché à une version du jeu, mettre `DROP_DATE` à sa date, et poser
`dropUnverified: true` sur tout Sprite sans chiffre publié — la carte affiche alors
« non confirmé ». Ne jamais additionner les taux pour les vérifier : ce sont des
probabilités indépendantes par coffre, pas une distribution qui totalise 100 %.

### Marche à suivre

1. Ajouter l'entrée **à la fin** de `SPRITES` dans `assets/js/data.js` (id, rareté,
   taux d'apparition, forme, palette, variantes, éventuellement `unreleased`).
2. Ajouter son nom dans `name`, et son effet dans `ability`, dans `assets/js/i18n.js`.
   Les libellés de `name` et de `variant` sont **purement d'affichage** : les clés
   servent au stockage, jamais les textes. Corriger un nom français ne touche donc
   à aucune progression enregistrée.
3. Ajouter l'illustration dans `assets/sprites/` (`.webp`, 128 px), une par variante.
   Si aucune image n'existe, `assets/js/art.js` dessine un repli SVG à partir de
   `SHAPES` (grille 64 × 64) et de la palette. Poser alors `noArt: true` sur le
   Sprite : le dessin est utilisé directement, sans requête vers un fichier absent.
4. Si un identifiant existant change, **ajouter l'ancien dans `RENAMES`** — ne jamais
   se contenter de le remplacer.
5. Mettre `DATA_DATE` à la date du jour : elle s'affiche en pied de page.
6. Lancer le contrôle, et **recopier le bloc `SLOT_ORDER`** qu'il affiche :

```bash
node tools/check-data.mjs   # sort en erreur tant que l'ordre n'est pas figé
```

7. Régénérer le service worker pour que le hors ligne reste complet :
   `node tools/gen-sw.mjs`.

Une mise à jour bien faite se voit à ceci : après rechargement, le nombre de cases
cochées est **identique ou supérieur** à celui d'avant. S'il baisse, un identifiant a
changé sans passer par `RENAMES`.

## Déploiement

GitHub Pages sert la branche `gh-pages` (source « Deploy from a branch »). Le
workflow `.github/workflows/pages.yml` republie cette branche à chaque push sur
la branche par défaut. Aucune étape de build : la racine est envoyée telle
quelle, et `.nojekyll` évite le traitement Jekyll.

Site publié : <https://rachid598.github.io/Sprite/>

Tous les chemins étant relatifs, le site fonctionne aussi bien à la racine d'un
domaine que dans un sous-dossier (`/Sprite/`), et sur n'importe quel autre
hébergement statique (Netlify, Cloudflare Pages…).

## Synchronisation

Optionnelle : sans serveur configuré, le site reste entièrement local.

- **Firebase** (recommandé, aucune installation) : `docs/firebase.md`
- **Cloudflare Worker** auto-hébergé : `server/README.md`

Le code du salon tient lieu de secret partagé : 20 caractères tirés au hasard,
et les règles Firebase conseillées refusent les codes de moins de 12 caractères.

Arbitrage des versions, par profil :

- le serveur est plus récent et l'appareil est vierge → la collection descend ;
- l'appareil est plus récent → elle remonte ;
- les deux ont changé → l'utilisateur choisit *remplacer*, *fusionner* ou *garder*.
  Rien n'est jamais écrasé en silence, et un `PUT` portant un horodatage plus
  ancien que la version stockée est refusé par le serveur (`409`).

## Contenu et illustrations

Les effets passifs marqués comme non confirmés le sont volontairement : seuls les effets
documentés publiquement sont affichés, le reste attend confirmation plutôt que d'être
inventé.

Les 118 illustrations de `assets/sprites/` sont les visuels des Sprites tirés du jeu,
redimensionnés en 128 px et hébergés avec le site (pas de lien direct vers un serveur
tiers). Ils appartiennent à Epic Games et sont utilisés ici dans le cadre d'un projet de
fan non commercial. `assets/js/art.js` conserve un dessin SVG généré, affiché
automatiquement si une image venait à manquer.

Projet de fan indépendant, sans lien avec Epic Games. Fortnite est une marque d'Epic
Games, Inc.
