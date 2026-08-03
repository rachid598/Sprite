/*
 * Service worker — généré par tools/gen-sw.mjs, ne pas modifier à la main.
 *
 * Stratégie :
 *   - navigations  : réseau d'abord, cache en secours (permet l'usage hors ligne)
 *   - autres URL   : cache d'abord, puis réseau (les assets sont versionnés)
 */

const BUILD = '__BUILD__';
const CACHE = 'sprite-tracker-' + BUILD;

// 138 fichiers, dont 117 illustrations.
const FILES = [
  "./",
  "index.html",
  "fr/",
  "fr/index.html",
  "fr/manifest.webmanifest",
  "en/",
  "en/index.html",
  "en/manifest.webmanifest",
  "assets/css/styles.css",
  "assets/js/app.js",
  "assets/js/data.js",
  "assets/js/i18n.js",
  "assets/js/art.js",
  "assets/js/store.js",
  "assets/js/pwa.js",
  "assets/js/sync.js",
  "assets/img/favicon.svg",
  "assets/img/icon-192.png",
  "assets/img/icon-512.png",
  "assets/img/icon-maskable-512.png",
  "assets/img/apple-touch-icon.png",
  "assets/sprites/air_galaxy.webp",
  "assets/sprites/air_gold.webp",
  "assets/sprites/air_gummy.webp",
  "assets/sprites/air_holofoil.webp",
  "assets/sprites/air_normal.webp",
  "assets/sprites/aura_galaxy.webp",
  "assets/sprites/aura_gem.webp",
  "assets/sprites/aura_gold.webp",
  "assets/sprites/aura_gummy.webp",
  "assets/sprites/aura_normal.webp",
  "assets/sprites/batman_cube.webp",
  "assets/sprites/batman_galaxy.webp",
  "assets/sprites/batman_gold.webp",
  "assets/sprites/batman_gummy.webp",
  "assets/sprites/batman_holofoil.webp",
  "assets/sprites/batman_normal.webp",
  "assets/sprites/boss_cube.webp",
  "assets/sprites/boss_galaxy.webp",
  "assets/sprites/boss_gold.webp",
  "assets/sprites/boss_gummy.webp",
  "assets/sprites/boss_normal.webp",
  "assets/sprites/demon_galaxy.webp",
  "assets/sprites/demon_gem.webp",
  "assets/sprites/demon_gold.webp",
  "assets/sprites/demon_gummy.webp",
  "assets/sprites/demon_normal.webp",
  "assets/sprites/dream_cube.webp",
  "assets/sprites/dream_galaxy.webp",
  "assets/sprites/dream_gold.webp",
  "assets/sprites/dream_gummy.webp",
  "assets/sprites/dream_normal.webp",
  "assets/sprites/duck_galaxy.webp",
  "assets/sprites/duck_gem.webp",
  "assets/sprites/duck_gold.webp",
  "assets/sprites/duck_gummy.webp",
  "assets/sprites/duck_normal.webp",
  "assets/sprites/earth_cube.webp",
  "assets/sprites/earth_galaxy.webp",
  "assets/sprites/earth_gem.webp",
  "assets/sprites/earth_gold.webp",
  "assets/sprites/earth_gummy.webp",
  "assets/sprites/earth_normal.webp",
  "assets/sprites/earth_quack.webp",
  "assets/sprites/fire_cube.webp",
  "assets/sprites/fire_galaxy.webp",
  "assets/sprites/fire_gold.webp",
  "assets/sprites/fire_gummy.webp",
  "assets/sprites/fire_holofoil.webp",
  "assets/sprites/fire_normal.webp",
  "assets/sprites/fire_quack.webp",
  "assets/sprites/fishy_cube.webp",
  "assets/sprites/fishy_galaxy.webp",
  "assets/sprites/fishy_gold.webp",
  "assets/sprites/fishy_gummy.webp",
  "assets/sprites/fishy_normal.webp",
  "assets/sprites/ghost_galaxy.webp",
  "assets/sprites/ghost_gold.webp",
  "assets/sprites/ghost_gummy.webp",
  "assets/sprites/ghost_holofoil.webp",
  "assets/sprites/ghost_normal.webp",
  "assets/sprites/johnwick_normal.webp",
  "assets/sprites/king_galaxy.webp",
  "assets/sprites/king_gold.webp",
  "assets/sprites/king_gummy.webp",
  "assets/sprites/king_holofoil.webp",
  "assets/sprites/king_normal.webp",
  "assets/sprites/llama_galaxy.webp",
  "assets/sprites/llama_gem.webp",
  "assets/sprites/llama_gold.webp",
  "assets/sprites/llama_gummy.webp",
  "assets/sprites/llama_normal.webp",
  "assets/sprites/peanut_normal.webp",
  "assets/sprites/peely_galaxy.webp",
  "assets/sprites/peely_gold.webp",
  "assets/sprites/peely_gummy.webp",
  "assets/sprites/peely_holofoil.webp",
  "assets/sprites/peely_normal.webp",
  "assets/sprites/pollo_normal.webp",
  "assets/sprites/punk_cube.webp",
  "assets/sprites/punk_galaxy.webp",
  "assets/sprites/punk_gem.webp",
  "assets/sprites/punk_gold.webp",
  "assets/sprites/punk_gummy.webp",
  "assets/sprites/punk_normal.webp",
  "assets/sprites/reaper_cube.webp",
  "assets/sprites/reaper_galaxy.webp",
  "assets/sprites/reaper_gem.webp",
  "assets/sprites/reaper_gold.webp",
  "assets/sprites/reaper_gummy.webp",
  "assets/sprites/reaper_holofoil.webp",
  "assets/sprites/reaper_normal.webp",
  "assets/sprites/seven_galaxy.webp",
  "assets/sprites/seven_gold.webp",
  "assets/sprites/seven_gummy.webp",
  "assets/sprites/seven_holofoil.webp",
  "assets/sprites/seven_normal.webp",
  "assets/sprites/striker_galaxy.webp",
  "assets/sprites/striker_gold.webp",
  "assets/sprites/striker_gummy.webp",
  "assets/sprites/striker_holofoil.webp",
  "assets/sprites/striker_normal.webp",
  "assets/sprites/vinijr_normal.webp",
  "assets/sprites/water_galaxy.webp",
  "assets/sprites/water_gem.webp",
  "assets/sprites/water_gold.webp",
  "assets/sprites/water_gummy.webp",
  "assets/sprites/water_holofoil.webp",
  "assets/sprites/water_normal.webp",
  "assets/sprites/water_quack.webp",
  "assets/sprites/zeropoint_cube.webp",
  "assets/sprites/zeropoint_galaxy.webp",
  "assets/sprites/zeropoint_gem.webp",
  "assets/sprites/zeropoint_gold.webp",
  "assets/sprites/zeropoint_gummy.webp",
  "assets/sprites/zeropoint_holofoil.webp",
  "assets/sprites/zeropoint_normal.webp",
  "assets/sprites/zeropoint_quack.webp"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // addAll échoue en bloc si une seule requête rate : on tolère les manques.
      await Promise.all(
        FILES.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => {}))
      );
      // Pas de skipWaiting() ici : la nouvelle version reste « en attente » pour
      // que la page puisse proposer la mise à jour au lieu de l'imposer. C'est
      // le message 'skip-waiting' plus bas qui la déclenche.
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
