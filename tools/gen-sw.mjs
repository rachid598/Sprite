/*
 * Génère sw.js à partir de la liste réelle des fichiers du site.
 *
 * À relancer après avoir ajouté ou retiré une illustration :
 *   node tools/gen-sw.mjs
 *
 * Le marqueur __BUILD__ est remplacé par le SHA du commit au déploiement
 * (voir .github/workflows/pages.yml) : chaque mise en ligne invalide donc
 * l'ancien cache. En local il reste tel quel, ce qui convient.
 */

import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const sprites = readdirSync(join(root, 'assets/sprites'))
  .filter((f) => f.endsWith('.webp'))
  .sort()
  .map((f) => `assets/sprites/${f}`);

// Coquille de l'application : tout ce qu'il faut pour démarrer hors ligne.
const shell = [
  './',
  'index.html',
  'fr/',
  'fr/index.html',
  'fr/manifest.webmanifest',
  'en/',
  'en/index.html',
  'en/manifest.webmanifest',
  'assets/css/styles.css',
  'assets/js/app.js',
  'assets/js/data.js',
  'assets/js/i18n.js',
  'assets/js/art.js',
  'assets/js/store.js',
  'assets/img/favicon.svg',
  'assets/img/icon-192.png',
  'assets/img/icon-512.png',
  'assets/img/icon-maskable-512.png',
  'assets/img/apple-touch-icon.png',
];

const files = [...shell, ...sprites];

const sw = `/*
 * Service worker — généré par tools/gen-sw.mjs, ne pas modifier à la main.
 *
 * Stratégie :
 *   - navigations  : réseau d'abord, cache en secours (permet l'usage hors ligne)
 *   - autres URL   : cache d'abord, puis réseau (les assets sont versionnés)
 */

const BUILD = '__BUILD__';
const CACHE = 'sprite-tracker-' + BUILD;

// ${files.length} fichiers, dont ${sprites.length} illustrations.
const FILES = ${JSON.stringify(files, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // addAll échoue en bloc si une seule requête rate : on tolère les manques.
      await Promise.all(
        FILES.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => {}))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(
        noms.filter((n) => n.startsWith('sprite-tracker-') && n !== CACHE).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, net.clone());
          return net;
        } catch {
          return (await caches.match(req)) || (await caches.match('fr/')) || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const hit = await caches.match(req, { ignoreSearch: false });
      if (hit) return hit;
      // Les assets portent un ?v=<sha> : on réessaie sans, le contenu est identique.
      const sansVersion = await caches.match(req, { ignoreSearch: true });
      if (sansVersion) return sansVersion;
      try {
        const net = await fetch(req);
        if (net.ok) (await caches.open(CACHE)).put(req, net.clone());
        return net;
      } catch {
        return Response.error();
      }
    })()
  );
});

// Permet à la page de demander l'activation immédiate d'une nouvelle version.
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});
`;

writeFileSync(join(root, 'sw.js'), sw);
console.log(`sw.js généré : ${files.length} fichiers (${sprites.length} illustrations)`);
