# Serveur de synchronisation

Cloudflare Worker + KV. Gratuit pour cet usage (100 000 lectures et 1 000 écritures
par jour sur l'offre gratuite ; deux joueurs en consomment une fraction).

## Mise en place

```bash
cd server
npx wrangler login                      # ouvre le navigateur, une seule fois
npx wrangler kv namespace create SYNC   # renvoie un id
# recopier cet id dans wrangler.toml, à la place de REMPLACER_PAR_VOTRE_ID
npx wrangler deploy
```

`wrangler deploy` affiche l'adresse du service, par exemple :

```
https://sprite-sync.VOTRE-COMPTE.workers.dev
```

Coller cette adresse dans la section **Sauvegarde et synchronisation** du site,
choisir un nom de salon et une clé, puis faire la même chose sur l'autre appareil
avec **le même salon et la même clé** mais un **profil différent**.

## Modèle

Un salon contient plusieurs profils nommés. Chacun synchronise son propre profil
entre ses appareils ; les profils ne sont jamais fusionnés entre eux. Chaque
membre du salon peut lire les collections des autres, ce qui permet de comparer
qui possède quoi.

## Routes

| Méthode | Chemin | Effet |
|---|---|---|
| `GET` | `/v1/rooms/:room` | tous les profils du salon |
| `PUT` | `/v1/rooms/:room/profiles/:profile` | enregistre un profil |
| `DELETE` | `/v1/rooms/:room/profiles/:profile` | supprime un profil |

Toutes exigent l'en-tête `x-sync-key`.

Un `PUT` dont le `updatedAt` est plus ancien que la version stockée renvoie `409`
au lieu d'écraser : c'est ce qui protège contre la perte de données quand deux
appareils écrivent en même temps.

## Ce que vaut la sécurité

La clé du salon est partagée et n'est **jamais stockée en clair** (SHA-256
uniquement). C'est adapté à un usage privé entre amis, pas à des données
sensibles : qui connaît le nom du salon et la clé peut lire et modifier les
profils. Le premier à utiliser un nom de salon en fixe la clé.
