# Sprite Tracker

Traqueur de collection pour les Sprites de Fortnite : checklist interactive de tous les
Sprites et de leurs variantes, progression, recherche de partenaires d'échange, FAQ.
Bilingue français / anglais.

Site statique, sans dépendances, sans build, sans backend. Tout tourne dans le navigateur.

## Fonctionnalités

- **Checklist** — une case par couple Sprite × variante (117 cases pour 24 Sprites).
- **Progression** — pourcentage global, Sprites débloqués, collections complétées.
- **Filtres** — statut (tous / possédés / manquants), rareté, variante, recherche texte,
  tri par rareté, nom, progression ou taux d'apparition.
- **Application installable** — manifeste + service worker : le site s'installe sur
  téléphone comme sur ordinateur et fonctionne **entièrement hors ligne**, les 117
  illustrations comprises (136 fichiers pré-mis en cache).
- **Sauvegarde locale** — `localStorage`, aucun compte, aucune donnée envoyée.
- **Sauvegarde fichier** — export de la collection en `.json` et ré-import, avec le
  même arbitrage remplacer / fusionner que pour les liens partagés.
- **Onglet Comparer** — vue dédiée face à un membre du salon : bandeau « vous vs
  lui », quatre familles (il peut vous aider / vous pouvez l'aider / vous deux /
  ni l'un ni l'autre) et grille illustrée variante par variante.
- **Trois niveaux par case** — un clic marque *obtenu*, un deuxième *maîtrisé*
  (couronne dorée), un troisième efface.
- **Synchronisation entre appareils** — Firebase Realtime Database via son API
  REST, sans bibliothèque ni outil à installer (`docs/firebase.md`). Un salon
  contient plusieurs profils nommés : chacun synchronise sa propre collection
  entre ses appareils et consulte celle des autres, sans fusion. Une solution
  auto-hébergée reste disponible dans `server/`.
- **Partage & synchronisation** — la collection est encodée en champ de bits dans l'URL
  (`?c=…`). Ouvrir le lien sur un autre appareil propose de remplacer, fusionner ou ignorer.
- **Échanges** — liste « ce qu'il me manque » / « ce que je possède », résumé formaté
  pour Discord, export PNG de la progression.
- **FAQ** avec données structurées `FAQPage` générées automatiquement.
- Accessible au clavier, responsive, respecte `prefers-reduced-motion`.

## Structure

```
index.html          redirection vers la langue du navigateur
fr/index.html       page française
en/index.html       page anglaise (même squelette, attribut lang différent)
assets/css/         feuille de style unique
assets/js/data.js   base de données des Sprites, variantes, raretés
assets/js/i18n.js   toutes les chaînes FR / EN
sw.js               service worker (généré — voir tools/gen-sw.mjs)
tools/gen-sw.mjs    régénère sw.js depuis la liste réelle des fichiers
fr|en/manifest.webmanifest  manifeste d'installation par langue
assets/sprites/     illustrations des Sprites (117 fichiers .webp 128 px)
assets/js/art.js    rendu des illustrations, avec repli SVG généré
assets/js/pwa.js    service worker, invite d'installation, état réseau
assets/js/sync.js   client de synchronisation (API REST Firebase)
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

## Ajouter ou modifier un Sprite

1. Ajouter une entrée **à la fin** de `SPRITES` dans `assets/js/data.js` (id, rareté,
   taux d'apparition, forme, palette, variantes).
2. Ajouter son nom dans `name` et, si l'effet est confirmé, dans `ability` des deux
   langues de `assets/js/i18n.js`, puis passer `ability.verified` à `true`.
3. Si la forme n'existe pas encore, ajouter un tracé dans `SHAPES` (`assets/js/art.js`),
   sur une grille 64 × 64.

4. Si vous ajoutez ou retirez des fichiers, régénérer le service worker pour que le
   mode hors ligne reste complet : `node tools/gen-sw.mjs`.

Les codes de partage sont un champ de bits calculé sur l'ordre de `ALL_SLOTS`. Ajouter
des entrées en fin de liste garde les anciens liens valides ; **réordonner ou supprimer**
des entrées les invalide — dans ce cas, incrémenter `CODE_VERSION` dans
`assets/js/store.js`.

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

Les 117 illustrations de `assets/sprites/` sont les visuels des Sprites tirés du jeu,
redimensionnés en 128 px et hébergés avec le site (pas de lien direct vers un serveur
tiers). Ils appartiennent à Epic Games et sont utilisés ici dans le cadre d'un projet de
fan non commercial. `assets/js/art.js` conserve un dessin SVG généré, affiché
automatiquement si une image venait à manquer.

Projet de fan indépendant, sans lien avec Epic Games. Fortnite est une marque d'Epic
Games, Inc.
