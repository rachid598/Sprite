# Import de collection Epic — prototype

## État au 17 octobre 2026

L'adaptateur, l'aperçu et la fusion additive fonctionnent avec les schémas de
collection documentés. Les tests simulent la connexion, le chiffrement des
sessions et la révocation. **Aucune connexion à un vrai compte Epic n'a été
testée.** Le bouton reste désactivé tant qu'une passerelle n'est pas configurée.

Le service indépendant [api-fortnite.com](https://www.api-fortnite.com/docs)
requiert une clé `x-api-key`. Les routes OAuth et de collection sont réservées aux
offres Pro/Custom dans son
[OpenAPI](https://prod.api-fortnite.com/swagger/v1/swagger.json).
L'appel sans clé à `/api/v2/sprites/collection` a répondu HTTP 401,
`API key required`. Aucun abonnement n'a été acheté.

La réponse des routes OAuth n'a **pas de schéma** dans l'OpenAPI. Le prototype
reconnaît explicitement `flowId` + `url` (ou `verificationUrl` /
`verificationUriComplete`), puis `accessToken` / `access_token` et
`deviceAuth`. Ces champs doivent être vérifiés avec le fournisseur avant
activation publique ; une forme inconnue entraîne une erreur sans importer.

## Parcours

1. Depuis Sauvegarde, l'utilisateur choisit de connecter son compte et ouvre
   lui-même la page Epic retournée. Seul `https://www.epicgames.com` est accepté.
2. Le Worker appelle `GET /api/v1/oauth/get-token`, puis
   `POST /api/v1/oauth/complete` avec `flowId` au plus toutes les cinq secondes.
3. Il lit le dernier catalogue de la saison demandée via `/api/v2/sprites/versions`,
   puis `GET /api/v2/sprites/collection?version=…` avec le jeton du joueur.
4. Le navigateur rapproche les noms français / anglais et les variantes du
   catalogue local. Les entrées non reconnues sont signalées et ignorées.
5. L'utilisateur voit les ajouts et décide de fusionner. Rien n'est retiré de
   sa collection ; la maîtrise est lue explicitement, jamais estimée depuis l'XP.

Un export JSON conforme à `SpriteCollectionResponseDto` peut aussi être importé
localement, sans passerelle ni transmission. Il doit contenir `gameVersion` et
`sprites: [{name, variants: [{variant, owned, mastered}]}]`.

## Déploiement de la passerelle

Le serveur Epic est indépendant de Firebase et de `server/worker.js`.
Il demande un compte Cloudflare déjà accessible et une clé Pro du fournisseur.

Avec Wrangler installé :

1. Dans `server/`, créer un espace KV dédié :
   `wrangler kv namespace create EPIC_SESSIONS`.
2. Inscrire son identifiant dans `wrangler.epic.toml`.
3. Enregistrer `FORTNITE_API_KEY` avec
   `wrangler secret put FORTNITE_API_KEY --config wrangler.epic.toml`.
4. Générer 32 octets aléatoires, codés en 64 caractères hexadécimaux, et les
   enregistrer sous `SESSION_ENCRYPTION_KEY` avec la même commande.
   Ne jamais placer ces secrets dans Git, dans le chat ou dans le JavaScript public.
5. Vérifier `ALLOWED_ORIGIN`, puis déployer :
   `wrangler deploy --config wrangler.epic.toml`.
6. Valider le parcours réel sur un compte volontaire et renseigner seulement
   l'URL publique du Worker dans `assets/js/epic-config.js`.
7. Relancer les tests et `node tools/gen-sw.mjs`, puis publier le client.

## Sessions et limites

- La clé fournisseur et les jetons Epic ne quittent pas le Worker.
- Les sessions KV sont chiffrées en AES-GCM avec une clé de déploiement distincte.
- Le navigateur garde seulement une capacité aléatoire en mémoire de l'onglet :
  aucun jeton Epic dans localStorage, l'URL, Firebase ou les sauvegardes.
- La connexion en attente expire après dix minutes, la session après une heure.
- Déconnecter révoque le device auth lorsque le fournisseur en a renvoyé un.
  Le cron, toutes les cinq minutes, traite aussi les sessions expirées ; une
  révocation échouée est retentée au passage suivant. La fermeture de l'onglet
  ne supprime pas instantanément la session côté serveur.
- Aucune reconnexion silencieuse via device auth ni aucun partage public de
  collection n'est effectué.
- Les réponses sont non mises en cache et l'origine du client est contrôlée.
- Un plafond KV de 20 démarrages par heure réduit les abus mais n'est pas atomique :
  un déploiement ouvert à grande échelle doit ajouter une limitation atomique
  (Cloudflare Rate Limiting / Durable Objects) avant diffusion.
- Sans accès Pro, hébergement et test OAuth réel, ce prototype ne constitue pas
  une connexion Epic opérationnelle.

Tests : `node --test tests/epic-import.test.mjs`.
