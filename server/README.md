# Serveur de synchronisation

Cloudflare Worker + KV. Gratuit pour cet usage : l'offre gratuite couvre 100 000
lectures et 1 000 écritures par jour, deux joueurs en consomment une fraction.

Commandes vérifiées avec **wrangler 4.118**.

## Déploiement

### 1. Créer un compte

<https://dash.cloudflare.com/sign-up> — gratuit, aucune carte bancaire demandée.

### 2. Se connecter depuis le terminal

```bash
cd server
npx wrangler login
```

Une page s'ouvre dans le navigateur, il faut autoriser Wrangler. Une seule fois.

### 3. Créer l'espace de stockage

```bash
npx wrangler kv namespace create SYNC
```

La commande affiche un identifiant, par exemple :

```
[[kv_namespaces]]
binding = "SYNC"
id = "a1b2c3d4e5f6..."
```

Recopier cet `id` dans `wrangler.toml`, à la place de `REMPLACER_PAR_VOTRE_ID`.

### 4. Publier

```bash
npx wrangler deploy
```

La sortie se termine par l'adresse du service :

```
https://sprite-sync.VOTRE-COMPTE.workers.dev
```

C'est cette adresse à coller dans le site.

### 5. Vérifier avant de brancher le site

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://VOTRE-ADRESSE.workers.dev/v1/rooms/essai
# attendu : 401  (route vivante, clé exigée)

curl -s -H "x-sync-key: cle-de-test-jetable" https://VOTRE-ADRESSE.workers.dev/v1/rooms/essai
# attendu : {"room":"essai","created":true,"profiles":{}}
```

Un `401` puis un `created:true` signifient que le service fonctionne. Utiliser un
nom de salon jetable pour ce test : le premier appel fixe la clé du salon.

## Alternative sans terminal

Le Worker tient dans un seul fichier, il peut être collé dans l'interface web :

1. Tableau de bord → **Workers & Pages** → **Create** → **Start from Hello World**
2. Remplacer tout le code par le contenu de `worker.js`, puis **Deploy**
3. **Storage & Databases** → **KV** → créer un espace nommé `sprite-sync`
4. Revenir au Worker → **Settings** → **Bindings** → **Add** → **KV namespace**
   - Variable name : `SYNC` (exactement ce nom, le code le cherche)
   - KV namespace : celui créé à l'étape 3
5. Redéployer

L'étape 4 est celle qu'on oublie : sans binding nommé `SYNC`, le service répond
`500 espace KV non lié`.

## Brancher le site

Dans la section **Synchro** :

| Champ | Vous | Votre ami |
|---|---|---|
| Adresse du serveur | la même | la même |
| Salon | le même | le même |
| Clé du salon | la même | la même |
| Votre profil | `rachid` | `pote` |

Le profil doit différer : c'est lui qui sépare les deux collections.

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
uniquement, comparaison à temps constant). C'est adapté à un usage privé entre
amis, pas à des données sensibles : qui connaît le nom du salon et la clé peut
lire et modifier les profils. **Le premier à utiliser un nom de salon en fixe la
clé** — choisissez un nom peu commun.

## En cas de problème

| Réponse | Cause | Correction |
|---|---|---|
| `500 espace KV non lié` | binding absent ou mal nommé | il doit s'appeler `SYNC` |
| `403 clé incorrecte` | le salon existe déjà avec une autre clé | changer de nom de salon, ou reprendre la clé d'origine |
| `401` | en-tête `x-sync-key` absent, ou clé de moins de 8 caractères | allonger la clé |
| `400 identifiant invalide` | salon ou profil hors `[a-z0-9_-]`, 3 à 40 caractères | renommer |
| Erreur réseau depuis le site | adresse en `http://` | le site exige `https://` hors localhost |

Suivre les journaux en direct pendant un test :

```bash
npx wrangler tail
```

## Repartir de zéro

```bash
npx wrangler kv namespace list                 # retrouver l'id
npx wrangler kv key list --namespace-id=<id>   # voir les clés stockées
npx wrangler delete                            # supprimer le Worker
```
